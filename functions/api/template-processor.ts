// Template variable replacement processor
import { createClient } from '@supabase/supabase-js'
import { loadTemplateSimple } from './template-manager-simple'

// Initialize Supabase client
function getSupabaseClient(env: any) {
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase configuration')
  }

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })
}

// Template variable replacement data
interface TemplateVariables {
  DEVICE_HASH: string
  PLAN_TYPE: string
  EXPIRES_AT: string
  STATUS: string
}

// Get user data for template variables
async function getUserTemplateData(env: any, device_hash: string): Promise<TemplateVariables> {
  try {
    console.log(`🔍 Getting user data for device: ${device_hash}`)
    const supabase = getSupabaseClient(env)

    // Get device and plan information using the existing RPC function
    const { data: deviceInfo, error: deviceError } = await supabase.rpc('get_download_info', {
      device_hash_param: device_hash
    })

    if (deviceError) {
      throw new Error(`Failed to get device info: ${deviceError.message}`)
    }

    if (!deviceInfo || deviceInfo.length === 0) {
      throw new Error('Device not found or not authorized')
    }

    const deviceData = deviceInfo[0]
    console.log('📋 Device data retrieved:', {
      device_hash: deviceData.device_hash,
      plan_name: deviceData.plan_name,
      device_status: deviceData.device_status
    })

    // Get plan details
    const { data: planData, error: planError } = await supabase
      .from('device_plan_view')
      .select('plan_name, plan_display_name, plan_features, plan_limitations')
      .eq('device_hash', device_hash)
      .single()

    if (planError) {
      console.error('Error getting plan data:', planError)
      // Use basic plan info from device data as fallback
    }

    // Calculate expiration date
    let expiresAt = '2099-12-31 23:59:59' // Default far future

    if (deviceData.trial_ends_at) {
      const trialEnd = new Date(deviceData.trial_ends_at)
      expiresAt = trialEnd.toISOString().replace('T', ' ').substring(0, 19)
    }

    // Determine status
    let status = 'expired'
    if (deviceData.device_status === 'trial') {
      status = 'trial'
    } else if (deviceData.device_status === 'active') {
      status = 'active'
    }

    const templateVars: TemplateVariables = {
      DEVICE_HASH: device_hash,
      PLAN_TYPE: planData?.plan_name || deviceData.plan_name || 'starter',
      EXPIRES_AT: expiresAt,
      STATUS: status
    }

    console.log('🎯 Template variables prepared:', templateVars)
    return templateVars

  } catch (error) {
    console.error('❌ Error getting user template data:', error)
    throw error
  }
}

// Replace variables in template content
function replaceTemplateVariables(content: string, variables: TemplateVariables): string {
  let result = content

  for (const [key, value] of Object.entries(variables)) {
    const placeholder = `{{${key}}}`
    const regex = new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')
    result = result.replace(regex, value)
  }

  return result
}

// Process all template files with user-specific data
export async function processTemplate(env: any, device_hash: string): Promise<any> {
  try {
    console.log(`🔄 Processing template for device: ${device_hash}`)

    // Step 1: Load template files
    const templateResult = await loadTemplateSimple(env)
    if (!templateResult.success) {
      throw new Error(`Failed to load template: ${templateResult.error}`)
    }

    // Step 2: Get user-specific data
    const variables = await getUserTemplateData(env, device_hash)

    // Step 3: Load the actual file contents (the previous call just gave us metadata)
    console.log('📄 Loading full template contents...')
    const supabase = getSupabaseClient(env)

    const processedFiles: Record<string, string> = {}
    let replacementCount = 0

    for (const filePath of templateResult.files) {
      try {
        console.log(`🔄 Processing file: ${filePath}`)

        // Load file content
        const { data: fileData, error: downloadError } = await supabase.storage
          .from('templates')
          .download(filePath)

        if (downloadError) {
          console.error(`❌ Failed to download ${filePath}:`, downloadError.message)
          continue
        }

        let content = await fileData.text()
        const originalContent = content

        // Replace variables
        content = replaceTemplateVariables(content, variables)

        // Count replacements made
        const replacements = (originalContent.match(/\{\{[^}]+\}\}/g) || []).length
        replacementCount += replacements

        processedFiles[filePath] = content

        console.log(`✅ Processed ${filePath}: ${replacements} variables replaced`)

      } catch (fileError) {
        console.error(`❌ Error processing file ${filePath}:`, fileError)
        continue
      }
    }

    console.log(`🎯 Template processing completed: ${Object.keys(processedFiles).length} files, ${replacementCount} variables replaced`)

    return {
      success: true,
      message: 'Template processed successfully',
      fileCount: Object.keys(processedFiles).length,
      replacementCount,
      variables,
      files: processedFiles,
      sampleProcessedContent: {
        'smartgram/main.lua': processedFiles['smartgram/main.lua']?.substring(0, 300) + '...'
      }
    }

  } catch (error) {
    console.error('❌ Template processing error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }
  }
}

// Test function for template processing
export async function testTemplateProcess(env: any): Promise<any> {
  // Use a test device hash for demonstration
  const testDeviceHash = 'TEST123DEVICE'

  try {
    const result = await processTemplate(env, testDeviceHash)
    return result
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      note: 'This test uses a dummy device hash. In production, use a real device hash.'
    }
  }
}