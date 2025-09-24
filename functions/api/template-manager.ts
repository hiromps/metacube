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

// Load individual files from Supabase Storage (non-recursive approach)
async function loadFilesFromStorage(supabase: any, basePath: string): Promise<Map<string, Uint8Array>> {
  const files = new Map<string, Uint8Array>();

  try {
    console.log(`🔍 Loading files from storage path: ${basePath}`);

    // Queue-based directory traversal to avoid recursion stack overflow
    const pathsToProcess = [basePath];
    const processedPaths = new Set<string>();

    while (pathsToProcess.length > 0) {
      const currentPath = pathsToProcess.shift()!;

      if (processedPaths.has(currentPath)) {
        console.log(`⚠️ Skipping already processed path: ${currentPath}`);
        continue;
      }

      processedPaths.add(currentPath);
      console.log(`🔍 Processing path: ${currentPath}`);

      const { data: items, error: listError } = await supabase.storage
        .from('templates')
        .list(currentPath, { limit: 100 });

      if (listError) {
        console.error(`❌ Failed to list files in ${currentPath}:`, listError.message);
        continue;
      }

      for (const item of items) {
        const fullPath = currentPath ? `${currentPath}/${item.name}` : item.name;

        if (item.metadata?.size !== undefined) {
          // It's a file
          console.log(`📄 Loading file: ${fullPath} (${item.metadata.size} bytes)`);

          try {
            const { data: fileData, error: downloadError } = await supabase.storage
              .from('templates')
              .download(fullPath);

            if (downloadError) {
              console.error(`❌ Failed to download ${fullPath}:`, downloadError.message);
              continue;
            }

            const arrayBuffer = await fileData.arrayBuffer();
            const uint8Array = new Uint8Array(arrayBuffer);
            files.set(fullPath, uint8Array);

            console.log(`✅ Loaded: ${fullPath} (${uint8Array.length} bytes)`);
          } catch (fileError) {
            console.error(`❌ Error processing file ${fullPath}:`, fileError);
            continue;
          }
        } else {
          // It's a directory, add to queue for processing
          console.log(`📁 Found directory: ${fullPath} - adding to queue`);
          if (!processedPaths.has(fullPath)) {
            pathsToProcess.push(fullPath);
          }
        }
      }
    }

    console.log(`🎯 Total files loaded: ${files.size}`);
    console.log(`🎯 Processed paths: ${Array.from(processedPaths)}`);
    return files;

  } catch (error) {
    console.error('❌ Error loading files from storage:', error);
    throw error;
  }
}

// Load template from Supabase Storage (individual files, no ZIP)
export async function loadTemplate(env: any, templatePath: string = 'smartgram'): Promise<Map<string, string>> {
  try {
    console.log(`🔍 Loading template from path: ${templatePath}`);
    const supabase = getSupabaseClient(env);

    // Load all files from the template path
    const rawFiles = await loadFilesFromStorage(supabase, templatePath);

    // Convert binary files to strings (for Lua scripts) or keep as base64 (for images)
    const template = new Map<string, string>();
    const textDecoder = new TextDecoder('utf-8');

    for (const [fileName, fileData] of rawFiles) {
      if (fileName.endsWith('.lua')) {
        // Decode Lua scripts as text
        const content = textDecoder.decode(fileData);
        template.set(fileName, content);
        console.log(`📄 Loaded script: ${fileName} (${content.length} chars)`);
      } else if (fileName.endsWith('.png') || fileName.endsWith('.jpg') || fileName.endsWith('.jpeg')) {
        // Keep images as base64
        const base64Content = btoa(String.fromCharCode(...fileData));
        template.set(fileName, base64Content);
        console.log(`🖼️ Loaded image: ${fileName} (${base64Content.length} chars base64)`);
      } else {
        // Try to decode as text for other files
        try {
          const content = textDecoder.decode(fileData);
          template.set(fileName, content);
          console.log(`📄 Loaded text file: ${fileName} (${content.length} chars)`);
        } catch {
          // If text decoding fails, store as base64
          const base64Content = btoa(String.fromCharCode(...fileData));
          template.set(fileName, base64Content);
          console.log(`📄 Loaded binary file: ${fileName} (${base64Content.length} chars base64)`);
        }
      }
    }

    console.log(`✅ Template loaded successfully: ${template.size} files`);
    return template;

  } catch (error) {
    console.error('❌ Template loading error:', error);
    throw error;
  }
}

// Test function for template loading
export async function testTemplateLoad(env: any): Promise<any> {
  try {
    const template = await loadTemplate(env, 'smartgram');

    // Get sample content for verification
    const sampleContent: Record<string, string> = {};

    const mainLua = template.get('smartgram/main.lua');
    if (mainLua) {
      sampleContent['smartgram/main.lua'] = mainLua.substring(0, 200) + '...';
    }

    const timelineLua = template.get('smartgram/functions/timeline.lua');
    if (timelineLua) {
      sampleContent['smartgram/functions/timeline.lua'] = timelineLua.substring(0, 200) + '...';
    }

    const functionsMainLua = template.get('smartgram/functions/main.lua');
    if (functionsMainLua) {
      sampleContent['smartgram/functions/main.lua'] = functionsMainLua.substring(0, 200) + '...';
    }

    return {
      success: true,
      message: 'Template loaded successfully from individual files',
      fileCount: template.size,
      files: Array.from(template.keys()).sort(),
      luaFiles: Array.from(template.keys()).filter(f => f.endsWith('.lua')).sort(),
      imageFiles: Array.from(template.keys()).filter(f => f.endsWith('.png')).length,
      sampleContent
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    };
  }
}