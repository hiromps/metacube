// Complete .ate file generator with template processing and encryption
import { createClient } from '@supabase/supabase-js'
import { processTemplate } from './template-processor'
import { createAteFile, arrayBufferToBase64 } from './crypto-utils'

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

// Load image files from Supabase Storage to include in .ate file
async function loadImageFiles(env: any): Promise<Record<string, string>> {
  try {
    console.log('🖼️ Loading image files from storage...')
    const supabase = getSupabaseClient(env)

    const imageFiles: Record<string, string> = {}

    // Known image files in the template
    const knownImages = [
      'smartgram/images/follow_button.png',
      'smartgram/images/heart_button.png',
      'smartgram/images/home_icon.png',
      'smartgram/images/instagram_icon.png',
      'smartgram/images/like_button.png',
      'smartgram/images/profile_icon.png',
      'smartgram/images/search_icon.png',
      'smartgram/images/story_ring.png',
      'smartgram/images/timeline_icon.png',
      'smartgram/images/unfollow_button.png',
      // Additional images
      'smartgram/images/back_button.png',
      'smartgram/images/comment_button.png',
      'smartgram/images/dm_button.png',
      'smartgram/images/hashtag_icon.png',
      'smartgram/images/menu_icon.png',
      'smartgram/images/notification_icon.png',
      'smartgram/images/plus_icon.png',
      'smartgram/images/save_button.png',
      'smartgram/images/settings_icon.png',
      'smartgram/images/share_button.png',
      'smartgram/images/user_avatar.png',
      'smartgram/images/verified_badge.png',
      'smartgram/images/video_icon.png'
    ]

    let loadedCount = 0
    for (const imagePath of knownImages) {
      try {
        const { data: imageData, error: downloadError } = await supabase.storage
          .from('templates')
          .download(imagePath)

        if (downloadError) {
          console.log(`⚠️ Could not load image ${imagePath}: ${downloadError.message}`)
          continue
        }

        // Convert to base64
        const arrayBuffer = await imageData.arrayBuffer()
        const uint8Array = new Uint8Array(arrayBuffer)
        let binary = ''
        for (let i = 0; i < uint8Array.length; i++) {
          binary += String.fromCharCode(uint8Array[i])
        }
        const base64 = btoa(binary)

        imageFiles[imagePath] = base64
        loadedCount++
        console.log(`✅ Loaded image: ${imagePath} (${base64.length} chars base64)`)

      } catch (imageError) {
        console.log(`⚠️ Error loading image ${imagePath}:`, imageError)
        continue
      }
    }

    console.log(`🖼️ Loaded ${loadedCount}/${knownImages.length} image files`)
    return imageFiles

  } catch (error) {
    console.error('❌ Error loading image files:', error)
    return {} // Return empty object if image loading fails
  }
}

// Generate complete .ate file with templates, images, and encryption
export async function generateCompleteAteFile(env: any, device_hash: string): Promise<any> {
  try {
    console.log(`🚀 Generating complete .ate file for device: ${device_hash}`)

    // Step 1: Process templates with user data
    console.log('📄 Step 1: Processing templates...')
    const templateResult = await processTemplate(env, device_hash)

    if (!templateResult.success) {
      throw new Error(`Template processing failed: ${templateResult.error}`)
    }

    console.log(`✅ Template processing: ${templateResult.fileCount} files, ${templateResult.replacementCount} variables`)

    // Step 2: Load image files
    console.log('🖼️ Step 2: Loading images...')
    const imageFiles = await loadImageFiles(env)
    console.log(`✅ Image loading: ${Object.keys(imageFiles).length} files`)

    // Step 3: Combine all files
    console.log('📦 Step 3: Combining files...')
    const allFiles = {
      ...templateResult.files,  // Processed Lua scripts
      ...imageFiles             // PNG images
    }

    const totalFiles = Object.keys(allFiles).length
    console.log(`📊 Total files for .ate: ${totalFiles} files`)

    // Log file breakdown
    const luaCount = Object.keys(templateResult.files).length
    const imageCount = Object.keys(imageFiles).length
    console.log(`📋 File breakdown: ${luaCount} Lua scripts, ${imageCount} images`)

    // Step 4: Create encrypted .ate file
    console.log('🔐 Step 4: Creating encrypted .ate file...')
    const ateBuffer = await createAteFile(allFiles, '1111') // Password: 1111

    // Step 5: Convert to base64 for response
    console.log('📤 Step 5: Preparing download...')
    const base64Data = arrayBufferToBase64(ateBuffer)

    console.log(`✅ Complete .ate file generated: ${ateBuffer.byteLength} bytes`)

    return {
      success: true,
      message: 'Complete .ate file generated successfully',
      fileSize: ateBuffer.byteLength,
      fileCount: totalFiles,
      breakdown: {
        luaFiles: luaCount,
        imageFiles: imageCount,
        totalSize: ateBuffer.byteLength
      },
      variables: templateResult.variables,
      downloadData: base64Data,
      filename: `smartgram_${device_hash}.ate`
    }

  } catch (error) {
    console.error('❌ Complete .ate generation error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }
  }
}

// Test function for complete .ate generation
export async function testCompleteAteGeneration(env: any): Promise<any> {
  const testDeviceHash = 'FFMZ3GTSJC6J'

  try {
    console.log(`🧪 Testing complete .ate generation with device: ${testDeviceHash}`)
    const result = await generateCompleteAteFile(env, testDeviceHash)

    // Don't include full download data in test response (too large for logs)
    if (result.success && result.downloadData) {
      const dataPreview = result.downloadData.substring(0, 100) + '...'
      return {
        ...result,
        downloadData: dataPreview,
        note: 'Download data truncated for test response'
      }
    }

    return result
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      note: `Test uses device hash: ${testDeviceHash}`
    }
  }
}