// Complete .ate file generator with template processing and encryption
import { createClient } from '@supabase/supabase-js'
import { processTemplate } from './template-processor'
import { createAutoTouchZIP, ZipFileEntry, arrayBufferToBase64 } from './zip-aes-crypto'

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

    // Step 3: Prepare files for AutoTouch ZIP format
    console.log('📦 Step 3: Preparing files for AutoTouch ZIP format...')

    const zipEntries: ZipFileEntry[] = []

    // Add processed Lua scripts
    for (const [filePath, content] of Object.entries(templateResult.files)) {
      // AutoTouch expects specific file names
      let fileName = filePath
      if (filePath === 'smartgram/main.lua') {
        fileName = 'index.js' // Main entry point
      } else if (filePath.includes('functions/')) {
        fileName = filePath.replace('smartgram/functions/', '') // Keep function files in root
      } else {
        fileName = filePath.replace('smartgram/', '') // Remove smartgram prefix
      }

      zipEntries.push({
        name: fileName,
        content: content as string,
        isText: true
      })
      console.log(`📄 Added Lua script: ${fileName}`)
    }

    // Add image files (convert base64 to binary)
    for (const [filePath, base64Content] of Object.entries(imageFiles)) {
      const fileName = filePath.replace('smartgram/', '') // Remove smartgram prefix

      // Convert base64 to binary
      const binaryString = atob(base64Content)
      const imageBytes = new Uint8Array(binaryString.length)
      for (let i = 0; i < binaryString.length; i++) {
        imageBytes[i] = binaryString.charCodeAt(i)
      }

      zipEntries.push({
        name: fileName,
        content: imageBytes,
        isText: false
      })
      console.log(`🖼️ Added image: ${fileName}`)
    }

    console.log(`📊 Total ZIP entries: ${zipEntries.length} files`)

    // Step 4: Create AutoTouch compatible encrypted ZIP (.ate file)
    console.log('🔐 Step 4: Creating AutoTouch compatible .ate file...')
    const zipResult = await createAutoTouchZIP(zipEntries, '1111') // Password: 1111

    // Step 5: Convert to base64 for response
    console.log('📤 Step 5: Preparing download...')
    const base64Data = arrayBufferToBase64(zipResult.zipBuffer)

    console.log(`✅ AutoTouch compatible .ate file generated: ${zipResult.zipBuffer.byteLength} bytes`)

    // Count file types
    const luaCount = zipEntries.filter(entry => entry.name.endsWith('.lua') || entry.name.endsWith('.js')).length
    const imageCount = zipEntries.filter(entry => entry.name.endsWith('.png')).length

    return {
      success: true,
      message: 'AutoTouch compatible .ate file generated successfully',
      fileSize: zipResult.zipBuffer.byteLength,
      fileCount: zipResult.fileCount,
      breakdown: {
        luaFiles: luaCount,
        imageFiles: imageCount,
        totalSize: zipResult.zipBuffer.byteLength,
        format: 'ZIP AES (AutoTouch compatible)'
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