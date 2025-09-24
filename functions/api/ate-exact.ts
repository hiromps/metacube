// Exact AutoTouch ATE file generator using analysis report specifications
import { createAutoTouchATE, AutoTouchFileEntry } from './autotouch-exact'
import { processTemplate } from './template-processor'

export async function generateExactATE(device_hash: string, env?: any) {
  console.log('🎯 Starting EXACT AutoTouch ATE generation (vendor 0x0003)...')

  try {
    // Step 1: Process templates with device data
    console.log('📋 Step 1: Processing templates with device data...')
    const templateResult = await processTemplate(env || {}, device_hash)

    if (!templateResult.success) {
      throw new Error(`Template processing failed: ${templateResult.error}`)
    }

    console.log(`✅ Templates processed: ${Object.keys(templateResult.files).length} files`)

    // Step 2: Create exact AutoTouch 2-file structure (worker.js + index.js)
    console.log('📦 Step 2: Creating AutoTouch exact structure...')

    let workerContent = ''
    let indexContent = ''

    // Split content into worker.js and index.js
    for (const [filePath, content] of Object.entries(templateResult.files)) {
      if (filePath.includes('main.lua') || filePath.includes('timeline')) {
        // Main scripts go to worker.js
        workerContent += `-- ${filePath}\n${content as string}\n\n`
      } else {
        // Other scripts go to index.js
        indexContent += `-- ${filePath}\n${content as string}\n\n`
      }
    }

    // Ensure both files have content (AutoTouch requires both)
    if (!workerContent) {
      workerContent = '-- AutoTouch Worker Script\n-- Device: ' + device_hash + '\n\nprint("Worker initialized")\n'
    }
    if (!indexContent) {
      indexContent = '-- AutoTouch Index Script\n-- Device: ' + device_hash + '\n\nrequire("worker")\nprint("Index initialized")\n'
    }

    const ateEntries: AutoTouchFileEntry[] = [
      {
        name: 'worker.lua',
        content: workerContent,
        isText: true
      },
      {
        name: 'index.lua',
        content: indexContent,
        isText: true
      }
    ]

    console.log(`📄 Structure: worker.lua (${workerContent.length} bytes) + index.lua (${indexContent.length} bytes)`)

    // Step 3: Create exact AutoTouch ATE file with correct parameters
    console.log('🔐 Step 3: Creating ATE with vendor 0x0003, AES 0x08, Deflate64...')

    // Use empty password as default (AutoTouch allows passwordless encryption)
    const ateResult = await createAutoTouchATE(ateEntries, '')

    console.log(`✅ EXACT AutoTouch ATE generated: ${ateResult.zipBuffer.byteLength} bytes`)

    return {
      success: true,
      data: ateResult.zipBuffer,
      fileCount: ateResult.fileCount,
      message: `AutoTouch ATE (v0x0003) created: ${ateResult.fileCount} files, ${ateResult.zipBuffer.byteLength} bytes`
    }

  } catch (error) {
    console.error('❌ EXACT ATE generation failed:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      message: 'Failed to generate exact AutoTouch ATE file'
    }
  }
}

// Handler for exact AutoTouch ATE generation endpoint
export async function handleAteGenerateExact(request: Request, env: any): Promise<Response> {
  console.log('🎯 EXACT AutoTouch ATE generation requested')

  try {
    const body = await request.json() as { device_hash: string, password?: string }
    const { device_hash, password = '' } = body

    if (!device_hash) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Device hash is required',
          message: 'Please provide device_hash parameter'
        }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        }
      )
    }

    console.log(`📱 Generating EXACT ATE for device: ${device_hash}`)

    const result = await generateExactATE(device_hash, env)

    if (!result.success || !result.data) {
      throw new Error(result.error || 'Exact ATE generation failed')
    }

    console.log(`✅ Sending EXACT ATE file: ${result.data.byteLength} bytes`)

    // Return binary .ate file
    return new Response(result.data, {
      status: 200,
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': 'attachment; filename="smartgram_exact.ate"',
        'Access-Control-Allow-Origin': '*',
        'X-AutoTouch-Version': '0x0003',
        'X-AES-Strength': '0x08',
        'X-Compression': 'Deflate64'
      }
    })

  } catch (error) {
    console.error('❌ EXACT ATE handler error:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        message: 'Failed to generate exact AutoTouch ATE'
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      }
    )
  }
}