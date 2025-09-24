#!/usr/bin/env node

// Check existing template structure in Supabase Storage
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function checkTemplateStructure() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('🔍 Checking template structure in storage...');

    // List all files in templates bucket recursively
    const { data: files, error: filesError } = await supabase.storage
      .from('templates')
      .list('', {
        limit: 100,
        offset: 0,
        search: ''
      });

    if (filesError) {
      console.error('❌ Error listing files:', filesError.message);
      return;
    }

    console.log('\n📂 Current structure in templates bucket:');
    for (const file of files) {
      console.log(`${file.name} (${file.metadata?.size || 'unknown'} bytes)`);

      // If it's a directory/archive, try to get more info
      if (file.name === 'smartgram.at') {
        console.log('  📄 This appears to be the main template file');

        // Try to download and check if it's a ZIP archive
        const { data: fileData, error: downloadError } = await supabase.storage
          .from('templates')
          .download('smartgram.at');

        if (downloadError) {
          console.error('    ❌ Cannot download:', downloadError.message);
        } else {
          const fileBuffer = await fileData.arrayBuffer();
          const bytes = new Uint8Array(fileBuffer);

          // Check if it starts with ZIP signature (PK)
          if (bytes[0] === 0x50 && bytes[1] === 0x4B) {
            console.log('    ✅ File appears to be a ZIP archive');
            console.log(`    📊 Size: ${bytes.length} bytes`);
          } else {
            console.log('    ❓ File format unknown (not ZIP)');
            console.log(`    📊 Size: ${bytes.length} bytes`);
            console.log(`    🔍 First few bytes: ${Array.from(bytes.slice(0, 10)).map(b => b.toString(16).padStart(2, '0')).join(' ')}`);
          }
        }
      }
    }

    // Check if we need to upload local templates
    const fs = require('fs');
    const path = require('path');

    const localTemplatePath = './supabase/templates/smartgram.at';
    if (fs.existsSync(localTemplatePath)) {
      console.log('\n🏠 Local template directory found');
      console.log('📁 Local files:');

      const walkDir = (dir, prefix = '') => {
        const items = fs.readdirSync(dir, { withFileTypes: true });
        for (const item of items) {
          const fullPath = path.join(dir, item.name);
          if (item.isDirectory()) {
            console.log(`${prefix}📁 ${item.name}/`);
            walkDir(fullPath, prefix + '  ');
          } else {
            const stats = fs.statSync(fullPath);
            console.log(`${prefix}📄 ${item.name} (${stats.size} bytes)`);
          }
        }
      };

      walkDir(localTemplatePath);
    } else {
      console.log('\n❌ Local template directory not found');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

checkTemplateStructure();