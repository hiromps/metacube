// Simple ZIP-based .ate file generator (no encryption)
// Based on discovery that AutoTouch .ate files are standard ZIP files

import { createSimpleZIP, SimpleZipEntry } from './simple-zip'
import { processTemplates } from './template-processor'

export async function generateSimpleATE(device_hash: string) {
  console.log('🚀 Starting simple .ate generation (no encryption)...')

  try {
    // Step 1: Process templates with device data
    console.log('📋 Step 1: Processing templates...')
    const templateResult = await processTemplates(device_hash)

    if (!templateResult.success) {
      throw new Error(`Template processing failed: ${templateResult.error}`)
    }

    console.log(`✅ Template processing complete: ${Object.keys(templateResult.files).length} files`)

    // Step 2: Create simple ZIP entries (exactly 2 files like AutoTouch sample)
    console.log('📦 Step 2: Creating AutoTouch 2-file structure...')

    let workerContent = ''
    let indexContent = ''

    // Split content between worker.js and index.js
    for (const [filePath, content] of Object.entries(templateResult.files)) {
      if (filePath === 'smartgram/main.lua' || filePath.includes('timeline.lua')) {
        indexContent += `-- File: ${filePath}\n${content as string}\n\n`
      } else {
        workerContent += `-- File: ${filePath}\n${content as string}\n\n`
      }
    }

    // Ensure both files have content
    if (!indexContent) {
      indexContent = '-- AutoTouch Index Entry Point\n' + Object.values(templateResult.files)[0] || '-- Empty index\n'
    }
    if (!workerContent) {
      workerContent = '-- AutoTouch Worker Script\nrequire("index")\n'
    }

    const zipEntries: SimpleZipEntry[] = [
      {
        name: 'worker.js',
        content: workerContent,
        isText: true
      },
      {
        name: 'index.js',
        content: indexContent,
        isText: true
      }
    ]

    console.log(`📄 Created 2-file structure: worker.js (${workerContent.length} chars) + index.js (${indexContent.length} chars)`)

    // Step 3: Create simple ZIP file
    console.log('📦 Step 3: Creating simple ZIP file...')
    const zipResult = createSimpleZIP(zipEntries)

    console.log(`✅ Simple .ate file generated: ${zipResult.zipBuffer.byteLength} bytes`)

    return {
      success: true,
      data: zipResult.zipBuffer,
      fileCount: zipResult.fileCount,
      message: `Simple .ate file created with ${zipResult.fileCount} files (${zipResult.zipBuffer.byteLength} bytes)`
    }

  } catch (error) {
    console.error('❌ Simple .ate generation failed:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      message: 'Simple .ate file generation failed'
    }
  }
}