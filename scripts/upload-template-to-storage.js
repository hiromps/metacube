#!/usr/bin/env node

// Upload template files to Supabase Storage as ZIP archive
const { createClient } = require('@supabase/supabase-js');
const archiver = require('archiver');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

async function uploadTemplate() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('📦 Creating ZIP archive from local template files...');

    const templateDir = './supabase/templates/smartgram.at';
    if (!fs.existsSync(templateDir)) {
      console.error('❌ Template directory not found:', templateDir);
      process.exit(1);
    }

    // Create ZIP archive in memory
    const archive = archiver('zip', {
      zlib: { level: 9 } // Maximum compression
    });

    const zipBuffer = [];
    archive.on('data', (chunk) => {
      zipBuffer.push(chunk);
    });

    archive.on('end', async () => {
      const finalBuffer = Buffer.concat(zipBuffer);
      console.log(`✅ ZIP created: ${finalBuffer.length} bytes`);

      console.log('📤 Uploading to Supabase Storage...');

      // Delete existing file first
      const { error: deleteError } = await supabase.storage
        .from('templates')
        .remove(['smartgram.at']);

      if (deleteError && deleteError.message !== 'Object not found') {
        console.warn('⚠️  Could not delete existing file:', deleteError.message);
      }

      // Upload new file
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('templates')
        .upload('smartgram.at', finalBuffer, {
          contentType: 'application/zip',
          cacheControl: '3600'
        });

      if (uploadError) {
        console.error('❌ Upload failed:', uploadError.message);
        process.exit(1);
      }

      console.log('✅ Template uploaded successfully');
      console.log('📊 Upload info:', uploadData);

      // Verify the upload
      console.log('\n🔍 Verifying upload...');
      const { data: files, error: listError } = await supabase.storage
        .from('templates')
        .list('', { limit: 10 });

      if (listError) {
        console.error('❌ Could not verify upload:', listError.message);
        return;
      }

      const uploadedFile = files.find(f => f.name === 'smartgram.at');
      if (uploadedFile) {
        console.log('✅ File verified in storage');
        console.log(`📊 Size: ${uploadedFile.metadata?.size || 'unknown'} bytes`);
      } else {
        console.error('❌ File not found in storage after upload');
      }
    });

    archive.on('error', (err) => {
      console.error('❌ Archive error:', err);
      process.exit(1);
    });

    // Add all files from template directory
    const addFilesToArchive = (dir, archivePath = '') => {
      const items = fs.readdirSync(dir);

      for (const item of items) {
        const fullPath = path.join(dir, item);
        const archiveItemPath = archivePath ? `${archivePath}/${item}` : item;

        const stats = fs.statSync(fullPath);
        if (stats.isDirectory()) {
          console.log(`📁 Adding directory: ${archiveItemPath}/`);
          addFilesToArchive(fullPath, archiveItemPath);
        } else {
          console.log(`📄 Adding file: ${archiveItemPath} (${stats.size} bytes)`);
          archive.file(fullPath, { name: archiveItemPath });
        }
      }
    };

    addFilesToArchive(templateDir);

    // Finalize the archive
    archive.finalize();

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

uploadTemplate();