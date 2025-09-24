// Template Manager for reading and processing .at templates from Supabase Storage
import { createClient } from '@supabase/supabase-js'
import { unzip } from 'fflate'

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

// Extract ZIP archive using fflate library
async function extractZipArchive(zipBuffer: ArrayBuffer): Promise<Map<string, Uint8Array>> {
  return new Promise((resolve, reject) => {
    try {
      console.log(`🔍 Starting ZIP extraction with fflate - buffer size: ${zipBuffer.byteLength} bytes`);

      const zipData = new Uint8Array(zipBuffer);

      unzip(zipData, (err, extracted) => {
        if (err) {
          console.error('❌ ZIP extraction error:', err);
          reject(new Error(`ZIP extraction failed: ${err.message}`));
          return;
        }

        const files = new Map<string, Uint8Array>();

        for (const [fileName, fileData] of Object.entries(extracted)) {
          if (!fileName.endsWith('/')) { // Skip directories
            files.set(fileName, fileData);
            console.log(`📄 Extracted: ${fileName} (${fileData.length} bytes)`);
          } else {
            console.log(`📁 Skipped directory: ${fileName}`);
          }
        }

        console.log(`✅ Successfully extracted ${files.size} files from ZIP archive`);
        resolve(files);
      });

    } catch (error) {
      console.error('❌ ZIP extraction setup error:', error);
      reject(error);
    }
  });
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