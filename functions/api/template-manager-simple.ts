// Simple Template Manager - minimal approach to avoid stack overflow
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

// Load specific known files without directory traversal
export async function loadTemplateSimple(env: any): Promise<any> {
  try {
    console.log('🔍 Loading template with simple approach');
    const supabase = getSupabaseClient(env);

    // List of known files to load
    const knownFiles = [
      'smartgram/main.lua',
      'smartgram/functions/main.lua',
      'smartgram/functions/timeline.lua',
      'smartgram/functions/follow.lua',
      'smartgram/functions/unfollow.lua',
      'smartgram/functions/hashtaglike.lua',
      'smartgram/functions/activelike.lua'
    ];

    const loadedFiles: Record<string, string> = {};
    let successCount = 0;

    for (const filePath of knownFiles) {
      try {
        console.log(`📄 Attempting to load: ${filePath}`);

        const { data: fileData, error: downloadError } = await supabase.storage
          .from('templates')
          .download(filePath);

        if (downloadError) {
          console.error(`❌ Failed to download ${filePath}:`, downloadError.message);
          continue;
        }

        // Convert to text (all our target files are Lua scripts)
        const text = await fileData.text();
        loadedFiles[filePath] = text;
        successCount++;

        console.log(`✅ Loaded: ${filePath} (${text.length} chars)`);

      } catch (fileError) {
        console.error(`❌ Error loading ${filePath}:`, fileError);
        continue;
      }
    }

    console.log(`🎯 Successfully loaded ${successCount}/${knownFiles.length} files`);

    return {
      success: true,
      message: `Loaded ${successCount} files successfully`,
      fileCount: successCount,
      totalExpected: knownFiles.length,
      files: Object.keys(loadedFiles),
      sampleContent: {
        'smartgram/main.lua': loadedFiles['smartgram/main.lua']?.substring(0, 200) + '...',
        'smartgram/functions/timeline.lua': loadedFiles['smartgram/functions/timeline.lua']?.substring(0, 200) + '...'
      }
    };

  } catch (error) {
    console.error('❌ Template loading error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    };
  }
}

// Test function with timeout protection
export async function testTemplateLoadSimple(env: any): Promise<any> {
  return new Promise(async (resolve) => {
    // Set a timeout to prevent hanging
    const timeoutId = setTimeout(() => {
      resolve({
        success: false,
        error: 'Operation timed out after 10 seconds',
        timeout: true
      });
    }, 10000);

    try {
      const result = await loadTemplateSimple(env);
      clearTimeout(timeoutId);
      resolve(result);
    } catch (error) {
      clearTimeout(timeoutId);
      resolve({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });
    }
  });
}