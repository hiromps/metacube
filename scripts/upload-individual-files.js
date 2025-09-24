#!/usr/bin/env node

// Upload individual template files to Supabase Storage (no ZIP needed)
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

async function uploadIndividualFiles() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('📤 Uploading individual template files to Supabase Storage...');

    const templateDir = './supabase/templates/smartgram.at';
    if (!fs.existsSync(templateDir)) {
      console.error('❌ Template directory not found:', templateDir);
      process.exit(1);
    }

    // Create smartgram folder structure in storage
    const baseStoragePath = 'smartgram';

    // Function to upload files recursively
    const uploadFilesFromDir = async (localDir, storagePath) => {
      const items = fs.readdirSync(localDir, { withFileTypes: true });

      for (const item of items) {
        const localFilePath = path.join(localDir, item.name);
        const storageFilePath = `${storagePath}/${item.name}`;

        if (item.isDirectory()) {
          console.log(`📁 Processing directory: ${storageFilePath}/`);
          await uploadFilesFromDir(localFilePath, storageFilePath);
        } else {
          console.log(`📄 Uploading: ${storageFilePath}`);

          // Read file content
          const fileContent = fs.readFileSync(localFilePath);

          // Determine content type
          let contentType = 'application/octet-stream';
          if (item.name.endsWith('.lua')) {
            contentType = 'text/plain';
          } else if (item.name.endsWith('.png')) {
            contentType = 'image/png';
          } else if (item.name.endsWith('.jpg') || item.name.endsWith('.jpeg')) {
            contentType = 'image/jpeg';
          }

          // Remove existing file first
          const { error: removeError } = await supabase.storage
            .from('templates')
            .remove([storageFilePath]);

          if (removeError && removeError.message !== 'Object not found') {
            console.warn(`⚠️  Could not remove existing file ${storageFilePath}:`, removeError.message);
          }

          // Upload file
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('templates')
            .upload(storageFilePath, fileContent, {
              contentType,
              cacheControl: '3600'
            });

          if (uploadError) {
            console.error(`❌ Failed to upload ${storageFilePath}:`, uploadError.message);
          } else {
            console.log(`✅ Uploaded: ${storageFilePath} (${fileContent.length} bytes)`);
          }
        }
      }
    };

    // Upload all files
    await uploadFilesFromDir(templateDir, baseStoragePath);

    console.log('\n🔍 Verifying uploads...');

    // List uploaded files
    const listFiles = async (prefix = '', level = 0) => {
      const { data: files, error: listError } = await supabase.storage
        .from('templates')
        .list(prefix, { limit: 100 });

      if (listError) {
        console.error(`❌ Could not list files in ${prefix}:`, listError.message);
        return;
      }

      const indent = '  '.repeat(level);
      for (const file of files) {
        const fullPath = prefix ? `${prefix}/${file.name}` : file.name;
        if (file.name === '.emptyFolderPlaceholder') continue;

        if (file.metadata?.size !== undefined) {
          console.log(`${indent}📄 ${file.name} (${file.metadata.size} bytes)`);
        } else {
          console.log(`${indent}📁 ${file.name}/`);
          await listFiles(fullPath, level + 1);
        }
      }
    };

    await listFiles('smartgram', 0);

    console.log('\n✅ Individual file upload completed!');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

uploadIndividualFiles();