#!/usr/bin/env node

// Check Supabase Storage configuration
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function checkStorageConfig() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    console.log('🔍 Checking Supabase configuration...');
    console.log('URL:', supabaseUrl ? '✅ Set' : '❌ Missing');
    console.log('Service Key:', supabaseKey ? '✅ Set' : '❌ Missing');

    if (!supabaseUrl || !supabaseKey) {
      console.error('❌ Missing Supabase configuration');
      process.exit(1);
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('\n📦 Checking storage buckets...');
    const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();

    if (bucketsError) {
      console.error('❌ Error listing buckets:', bucketsError.message);
      return;
    }

    console.log('Available buckets:', buckets.map(b => b.name));

    // Check if templates bucket exists
    const templatesBucket = buckets.find(b => b.name === 'templates');
    if (!templatesBucket) {
      console.log('\n🆕 Creating templates bucket...');
      const { data: newBucket, error: createError } = await supabase.storage.createBucket('templates', {
        public: false,
        allowedMimeTypes: ['application/octet-stream', 'text/plain', 'image/png']
      });

      if (createError) {
        console.error('❌ Error creating bucket:', createError.message);
        return;
      }
      console.log('✅ Templates bucket created');
    } else {
      console.log('✅ Templates bucket exists');
    }

    // List files in templates bucket
    console.log('\n📁 Files in templates bucket:');
    const { data: files, error: filesError } = await supabase.storage
      .from('templates')
      .list('', { limit: 50 });

    if (filesError) {
      console.error('❌ Error listing files:', filesError.message);
      return;
    }

    if (files.length === 0) {
      console.log('📂 No files in templates bucket yet');
    } else {
      files.forEach(file => {
        console.log(`  - ${file.name} (${file.metadata?.size || 'unknown'} bytes)`);
      });
    }

    console.log('\n✅ Storage configuration check completed');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

checkStorageConfig();