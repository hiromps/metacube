// Template Manager for reading and processing .at templates from Supabase Storage
import { createClient } from '@supabase/supabase-js'

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

// Extract ZIP archive in Cloudflare Workers environment
async function extractZipArchive(zipBuffer: ArrayBuffer): Promise<Map<string, Uint8Array>> {
  const files = new Map<string, Uint8Array>();

  try {
    // Simple ZIP parsing for Cloudflare Workers
    const dataView = new DataView(zipBuffer);
    const decoder = new TextDecoder('utf-8');

    // Find End of Central Directory Record
    let eocdOffset = -1;
    for (let i = zipBuffer.byteLength - 22; i >= 0; i--) {
      if (dataView.getUint32(i, true) === 0x06054b50) { // EOCD signature
        eocdOffset = i;
        break;
      }
    }

    if (eocdOffset === -1) {
      throw new Error('Invalid ZIP file: EOCD not found');
    }

    const centralDirEntries = dataView.getUint16(eocdOffset + 8, true);
    const centralDirOffset = dataView.getUint32(eocdOffset + 16, true);

    // Read central directory entries
    let currentOffset = centralDirOffset;
    for (let i = 0; i < centralDirEntries; i++) {
      if (dataView.getUint32(currentOffset, true) !== 0x02014b50) { // Central dir header signature
        break;
      }

      const fileNameLength = dataView.getUint16(currentOffset + 28, true);
      const extraFieldLength = dataView.getUint16(currentOffset + 30, true);
      const commentLength = dataView.getUint16(currentOffset + 32, true);
      const localHeaderOffset = dataView.getUint32(currentOffset + 42, true);

      // Extract file name
      const fileNameBytes = new Uint8Array(zipBuffer, currentOffset + 46, fileNameLength);
      const fileName = decoder.decode(fileNameBytes);

      // Skip directories
      if (!fileName.endsWith('/')) {
        // Read local file header
        const localSig = dataView.getUint32(localHeaderOffset, true);
        if (localSig === 0x04034b50) { // Local file header signature
          const compMethod = dataView.getUint16(localHeaderOffset + 8, true);
          const compSize = dataView.getUint32(localHeaderOffset + 18, true);
          const uncompSize = dataView.getUint32(localHeaderOffset + 22, true);
          const localFileNameLength = dataView.getUint16(localHeaderOffset + 26, true);
          const localExtraLength = dataView.getUint16(localHeaderOffset + 28, true);

          const fileDataOffset = localHeaderOffset + 30 + localFileNameLength + localExtraLength;

          if (compMethod === 0) { // No compression
            const fileData = new Uint8Array(zipBuffer, fileDataOffset, uncompSize);
            files.set(fileName, fileData);
          } else {
            console.warn(`⚠️ Skipping compressed file: ${fileName} (compression method: ${compMethod})`);
            // For now, we'll skip compressed files as decompression requires additional libraries
            // In production, we'd need to implement deflate decompression or use a library
          }
        }
      }

      currentOffset += 46 + fileNameLength + extraFieldLength + commentLength;
    }

    console.log(`📦 Extracted ${files.size} files from ZIP archive`);
    return files;

  } catch (error) {
    console.error('❌ ZIP extraction error:', error);
    throw error;
  }
}

// Load template from Supabase Storage
export async function loadTemplate(env: any, templateName: string = 'smartgram.at'): Promise<Map<string, string>> {
  try {
    console.log(`🔍 Loading template: ${templateName}`);
    const supabase = getSupabaseClient(env);

    // Download template ZIP from storage
    const { data: zipData, error: downloadError } = await supabase.storage
      .from('templates')
      .download(templateName);

    if (downloadError) {
      throw new Error(`Failed to download template: ${downloadError.message}`);
    }

    const zipBuffer = await zipData.arrayBuffer();
    console.log(`📥 Downloaded template: ${zipBuffer.byteLength} bytes`);

    // Extract ZIP contents
    const extractedFiles = await extractZipArchive(zipBuffer);

    // Convert binary files to strings (for Lua scripts) or keep as binary (for images)
    const template = new Map<string, string>();
    const textDecoder = new TextDecoder('utf-8');

    for (const [fileName, fileData] of extractedFiles) {
      if (fileName.endsWith('.lua')) {
        // Decode Lua scripts as text
        const content = textDecoder.decode(fileData);
        template.set(fileName, content);
        console.log(`📄 Loaded script: ${fileName} (${content.length} chars)`);
      } else if (fileName.endsWith('.png') || fileName.endsWith('.jpg') || fileName.endsWith('.jpeg')) {
        // Keep images as base64 for now
        const base64Content = btoa(String.fromCharCode(...fileData));
        template.set(fileName, base64Content);
        console.log(`🖼️ Loaded image: ${fileName} (${base64Content.length} chars base64)`);
      } else {
        // Try to decode as text for other files
        try {
          const content = textDecoder.decode(fileData);
          template.set(fileName, content);
          console.log(`📄 Loaded file: ${fileName} (${content.length} chars)`);
        } catch {
          // If text decoding fails, store as base64
          const base64Content = btoa(String.fromCharCode(...fileData));
          template.set(fileName, base64Content);
          console.log(`📄 Loaded binary file: ${fileName} (${base64Content.length} chars base64)`);
        }
      }
    }

    console.log(`✅ Template loaded: ${template.size} files`);
    return template;

  } catch (error) {
    console.error('❌ Template loading error:', error);
    throw error;
  }
}

// Test function for template loading
export async function testTemplateLoad(env: any): Promise<any> {
  try {
    const template = await loadTemplate(env, 'smartgram.at');

    return {
      success: true,
      message: 'Template loaded successfully',
      fileCount: template.size,
      files: Array.from(template.keys()),
      sampleContent: {
        'main.lua': template.get('main.lua')?.substring(0, 200) + '...',
        'functions/timeline.lua': template.get('functions/timeline.lua')?.substring(0, 200) + '...'
      }
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    };
  }
}