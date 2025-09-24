// Background Worker for .ate File Generation
// Cloudflare Workers implementation for processing .ate file generation queue

import { createClient } from '@supabase/supabase-js'

// Crypto utilities for AES-256-GCM encryption
interface EncryptionResult {
  encryptedData: ArrayBuffer;
  iv: Uint8Array;
  authTag: Uint8Array;
  keyHash: string;
}

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

// Generate AES-256-GCM encryption key
async function generateEncryptionKey(): Promise<CryptoKey> {
  return await crypto.subtle.generateKey(
    {
      name: 'AES-GCM',
      length: 256
    },
    true, // extractable
    ['encrypt', 'decrypt']
  );
}

// Create SHA-256 hash of encryption key for verification
async function getKeyHash(key: CryptoKey): Promise<string> {
  const keyData = await crypto.subtle.exportKey('raw', key);
  const hashBuffer = await crypto.subtle.digest('SHA-256', keyData);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// Encrypt data with AES-256-GCM
async function encryptData(data: ArrayBuffer, key: CryptoKey): Promise<EncryptionResult> {
  const iv = crypto.getRandomValues(new Uint8Array(12)); // 96-bit IV for GCM

  const encryptedBuffer = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv,
      tagLength: 128 // 128-bit authentication tag
    },
    key,
    data
  );

  const keyHash = await getKeyHash(key);

  // Extract auth tag (last 16 bytes)
  const encryptedData = encryptedBuffer.slice(0, -16);
  const authTag = new Uint8Array(encryptedBuffer.slice(-16));

  return {
    encryptedData,
    iv,
    authTag,
    keyHash
  };
}

// Create ZIP file structure for .ate archive
function createZipFile(files: Array<{ name: string; content: string }>): Uint8Array {
  // Simple ZIP implementation for .ate files
  // In production, consider using a proper ZIP library

  let zipData = '';
  const entries: Array<{name: string, content: string, offset: number}> = [];
  let currentOffset = 0;

  // Create file entries
  for (const file of files) {
    const content = new TextEncoder().encode(file.content);

    // Local file header
    const header = [
      0x50, 0x4b, 0x03, 0x04, // Local file header signature
      0x14, 0x00, // Version needed to extract
      0x00, 0x00, // General purpose bit flag
      0x00, 0x00, // Compression method (stored)
      0x00, 0x00, 0x00, 0x00, // Last mod time/date
      0x00, 0x00, 0x00, 0x00, // CRC-32
      ...intToBytes(content.length, 4), // Compressed size
      ...intToBytes(content.length, 4), // Uncompressed size
      ...intToBytes(file.name.length, 2), // File name length
      0x00, 0x00, // Extra field length
    ];

    entries.push({
      name: file.name,
      content: file.content,
      offset: currentOffset
    });

    zipData += String.fromCharCode(...header);
    zipData += file.name;
    zipData += file.content;

    currentOffset += header.length + file.name.length + content.length;
  }

  // Central directory
  let centralDir = '';
  for (const entry of entries) {
    const content = new TextEncoder().encode(entry.content);
    const cdHeader = [
      0x50, 0x4b, 0x01, 0x02, // Central directory file header signature
      0x14, 0x00, // Version made by
      0x14, 0x00, // Version needed to extract
      0x00, 0x00, // General purpose bit flag
      0x00, 0x00, // Compression method
      0x00, 0x00, 0x00, 0x00, // Last mod time/date
      0x00, 0x00, 0x00, 0x00, // CRC-32
      ...intToBytes(content.length, 4), // Compressed size
      ...intToBytes(content.length, 4), // Uncompressed size
      ...intToBytes(entry.name.length, 2), // File name length
      0x00, 0x00, // Extra field length
      0x00, 0x00, // File comment length
      0x00, 0x00, // Disk number start
      0x00, 0x00, // Internal file attributes
      0x00, 0x00, 0x00, 0x00, // External file attributes
      ...intToBytes(entry.offset, 4), // Relative offset of local header
    ];

    centralDir += String.fromCharCode(...cdHeader);
    centralDir += entry.name;
  }

  // End of central directory record
  const eocd = [
    0x50, 0x4b, 0x05, 0x06, // End of central dir signature
    0x00, 0x00, // Number of this disk
    0x00, 0x00, // Number of disk with start of central directory
    ...intToBytes(entries.length, 2), // Total number of entries in central directory on this disk
    ...intToBytes(entries.length, 2), // Total number of entries in central directory
    ...intToBytes(centralDir.length, 4), // Size of central directory
    ...intToBytes(currentOffset, 4), // Offset of start of central directory
    0x00, 0x00, // ZIP file comment length
  ];

  const fullZip = zipData + centralDir + String.fromCharCode(...eocd);
  return new TextEncoder().encode(fullZip);
}

// Helper function to convert integer to byte array
function intToBytes(value: number, bytes: number): number[] {
  const result = [];
  for (let i = 0; i < bytes; i++) {
    result.push(value & 0xff);
    value >>>= 8;
  }
  return result;
}

// Process template variables
function processTemplate(template: string, variables: Record<string, any>): string {
  let processed = template;

  for (const [key, value] of Object.entries(variables)) {
    const placeholder = `{{${key}}}`;
    const replacement = typeof value === 'object' ? JSON.stringify(value) : String(value);
    processed = processed.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), replacement);
  }

  return processed;
}

// Main worker function
async function processAteGeneration(queueId: string, env: any): Promise<void> {
  const supabase = getSupabaseClient(env);

  try {
    console.log('Processing .ate generation for queue ID:', queueId);

    // Get queue item details
    const { data: queueData, error: queueError } = await supabase
      .from('file_generation_queue')
      .select(`
        *,
        devices!inner(device_hash, user_id),
        ate_templates!inner(name, template_path, file_structure, required_variables),
        plans!inner(name, tools)
      `)
      .eq('id', queueId)
      .eq('status', 'queued')
      .single();

    if (queueError || !queueData) {
      throw new Error(`Queue item not found: ${queueError?.message}`);
    }

    // Mark as processing
    await supabase
      .from('file_generation_queue')
      .update({
        status: 'processing',
        started_at: new Date().toISOString()
      })
      .eq('id', queueId);

    const device = queueData.devices;
    const template = queueData.ate_templates;
    const plan = queueData.plans;

    console.log('Processing for device:', device.device_hash, 'plan:', plan.name);

    // Get device license info
    const { data: licenseData } = await supabase
      .from('licenses')
      .select('expires_at, license_key')
      .eq('device_id', device.id)
      .single();

    // Prepare template variables
    const variables = {
      device_hash: device.device_hash,
      plan_tools: plan.tools,
      plan_name: plan.name,
      license_key: licenseData?.license_key || generateLicenseKey(device.device_hash),
      expires_at: licenseData?.expires_at || null,
      app_version: '1.0.0',
      generated_at: new Date().toISOString(),
      user_id: device.user_id
    };

    console.log('Template variables prepared:', Object.keys(variables));

    // Download template files from Supabase Storage
    const templateFiles: Array<{ name: string; content: string }> = [];
    const fileStructure = template.file_structure as Array<{ file: string; type: string; required: boolean }>;

    for (const fileInfo of fileStructure) {
      try {
        // Download from Supabase Storage
        const { data: fileBlob, error: downloadError } = await supabase.storage
          .from('ate-templates')
          .download(`${template.template_path}${fileInfo.file}`);

        if (downloadError || !fileBlob) {
          if (fileInfo.required) {
            throw new Error(`Required template file not found: ${fileInfo.file}`);
          }
          console.warn(`Optional template file skipped: ${fileInfo.file}`);
          continue;
        }

        // Read file content
        const fileContent = await fileBlob.text();

        // Process template variables
        const processedContent = processTemplate(fileContent, variables);

        templateFiles.push({
          name: fileInfo.file,
          content: processedContent
        });

        console.log(`Processed template file: ${fileInfo.file}`);
      } catch (error) {
        console.error(`Error processing template file ${fileInfo.file}:`, error);
        if (fileInfo.required) {
          throw error;
        }
      }
    }

    if (templateFiles.length === 0) {
      throw new Error('No template files processed successfully');
    }

    // Create ZIP archive
    console.log('Creating ZIP archive with', templateFiles.length, 'files');
    const zipBuffer = createZipFile(templateFiles);
    const zipArrayBuffer = zipBuffer.buffer.slice(zipBuffer.byteOffset, zipBuffer.byteOffset + zipBuffer.byteLength);

    // Generate encryption key and encrypt
    console.log('Encrypting .ate file');
    const encryptionKey = await generateEncryptionKey();
    const encryptionResult = await encryptData(zipArrayBuffer, encryptionKey);

    // Combine IV + Auth Tag + Encrypted Data for final .ate file
    const finalAteFile = new Uint8Array(
      encryptionResult.iv.length +
      encryptionResult.authTag.length +
      encryptionResult.encryptedData.byteLength
    );

    finalAteFile.set(encryptionResult.iv, 0);
    finalAteFile.set(encryptionResult.authTag, encryptionResult.iv.length);
    finalAteFile.set(new Uint8Array(encryptionResult.encryptedData), encryptionResult.iv.length + encryptionResult.authTag.length);

    // Generate filename and path
    const timestamp = Math.floor(Date.now() / 1000);
    const filename = `${device.device_hash}_${timestamp}.ate`;
    const filePath = `generated/${device.device_hash}/${filename}`;

    console.log('Uploading to storage:', filePath);

    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from('ate-files')
      .upload(filePath, finalAteFile, {
        contentType: 'application/octet-stream',
        upsert: true
      });

    if (uploadError) {
      throw new Error(`Storage upload failed: ${uploadError.message}`);
    }

    // Calculate checksum
    const checksumBuffer = await crypto.subtle.digest('SHA-256', finalAteFile);
    const checksum = Array.from(new Uint8Array(checksumBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    console.log('File upload successful, updating database');

    // Complete generation using helper function
    const { data: ateFileId, error: completeError } = await supabase.rpc('complete_ate_generation', {
      queue_id_param: queueId,
      file_path_param: filePath,
      file_size_param: finalAteFile.length,
      checksum_param: checksum,
      encryption_key_hash_param: encryptionResult.keyHash
    });

    if (completeError) {
      throw new Error(`Failed to complete generation: ${completeError.message}`);
    }

    console.log('✅ .ate file generation completed successfully:', ateFileId);

  } catch (error) {
    console.error('❌ .ate file generation failed:', error);

    // Mark generation as failed
    await supabase.rpc('fail_ate_generation', {
      queue_id_param: queueId,
      error_message_param: error instanceof Error ? error.message : 'Unknown error'
    });

    throw error;
  }
}

// Generate a simple license key
function generateLicenseKey(deviceHash: string): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `${deviceHash.substring(0, 4)}-${timestamp}-${random}`.toUpperCase();
}

// Worker entry point for Cloudflare Workers
export async function onRequest(context: any) {
  const { request, env } = context;
  const url = new URL(request.url);

  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      }
    });
  }

  // Process queue item
  if (request.method === 'POST' && url.pathname === '/api/ate-worker/process') {
    try {
      const { queue_id } = await request.json();

      if (!queue_id) {
        return new Response(JSON.stringify({ error: 'Queue ID required' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      await processAteGeneration(queue_id, env);

      return new Response(JSON.stringify({
        success: true,
        message: 'Generation completed successfully'
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });

    } catch (error) {
      console.error('Worker error:', error);
      return new Response(JSON.stringify({
        error: error instanceof Error ? error.message : 'Processing failed'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  // Health check endpoint
  if (request.method === 'GET' && url.pathname === '/api/ate-worker/health') {
    return new Response(JSON.stringify({
      status: 'healthy',
      timestamp: new Date().toISOString()
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  return new Response(JSON.stringify({ error: 'Not found' }), {
    status: 404,
    headers: { 'Content-Type': 'application/json' }
  });
}