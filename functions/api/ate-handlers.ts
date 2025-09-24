// Additional handlers for .ate file system - to be imported into main API file

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

// Simplified .ate generation function with better error handling
export async function processAteGeneration(queueId: string, env: any): Promise<boolean> {
  const supabase = getSupabaseClient(env);

  try {
    console.log('🔄 Starting .ate generation for queue ID:', queueId);

    // Get queue item details first
    const { data: queueItem, error: fetchError } = await supabase
      .from('file_generation_queue')
      .select('*')
      .eq('id', queueId)
      .single();

    if (fetchError) {
      throw new Error(`Failed to fetch queue item: ${fetchError.message}`);
    }

    if (!queueItem) {
      throw new Error(`Queue item not found: ${queueId}`);
    }

    console.log('📋 Queue item details:', {
      id: queueItem.id,
      device_id: queueItem.device_id,
      template_id: queueItem.template_id,
      plan_id: queueItem.plan_id,
      status: queueItem.status
    });

    // Mark as processing
    const { error: updateError } = await supabase
      .from('file_generation_queue')
      .update({
        status: 'processing',
        started_at: new Date().toISOString()
      })
      .eq('id', queueId);

    if (updateError) {
      throw new Error(`Failed to update status to processing: ${updateError.message}`);
    }

    console.log('⏳ Processing started, simulating generation...');

    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Create a simple test .ate file content (Base64 encoded ZIP-like structure)
    const testFileContent = Buffer.from('PK\x03\x04\x14\x00\x00\x00\x00\x00test.ate').toString('base64');
    const fileName = `smartgram_${queueItem.device_id}.ate`;
    const filePath = `generated/${queueId}/${fileName}`;

    console.log('💾 Creating test file:', filePath);

    // Try to create the file record directly without using the complex RPC
    const { data: fileRecord, error: fileError } = await supabase
      .from('ate_files')
      .insert({
        device_id: queueItem.device_id,
        template_id: queueItem.template_id,
        plan_id: queueItem.plan_id,
        filename: fileName,
        file_path: filePath,
        file_size: testFileContent.length,
        checksum: 'test-checksum-' + queueId.substring(0, 8),
        encryption_key_hash: 'test-key-hash',
        generation_status: 'success',
        is_active: true,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 hours
      })
      .select('id')
      .single();

    if (fileError) {
      throw new Error(`Failed to create file record: ${fileError.message}`);
    }

    console.log('📁 File record created:', fileRecord.id);

    // Update queue item to completed
    const { error: completeError } = await supabase
      .from('file_generation_queue')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        ate_file_id: fileRecord.id
      })
      .eq('id', queueId);

    if (completeError) {
      throw new Error(`Failed to mark as completed: ${completeError.message}`);
    }

    console.log('✅ Generation completed successfully for queue:', queueId);
    return true;

  } catch (error) {
    console.error('❌ Generation failed for queue:', queueId, 'Error:', error);

    // Try to mark as failed
    try {
      await supabase
        .from('file_generation_queue')
        .update({
          status: 'failed',
          completed_at: new Date().toISOString(),
          error_message: error instanceof Error ? error.message : 'Unknown error'
        })
        .eq('id', queueId);
    } catch (failError) {
      console.error('❌ Failed to mark queue item as failed:', failError);
    }

    return false;
  }
}

// Process queue items
export async function processQueue(env: any): Promise<{ processed: number; failed: number }> {
  const supabase = getSupabaseClient(env);
  let processed = 0;
  let failed = 0;

  try {
    const { data: queueItems, error: queueError } = await supabase
      .from('file_generation_queue')
      .select('id, priority, created_at')
      .eq('status', 'queued')
      .order('priority', { ascending: true })
      .order('created_at', { ascending: true })
      .limit(5);

    if (queueError || !queueItems || queueItems.length === 0) {
      return { processed: 0, failed: 0 };
    }

    for (const item of queueItems) {
      try {
        const success = await processAteGeneration(item.id, env);
        if (success) processed++;
        else failed++;

        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        failed++;
      }
    }

  } catch (error) {
    failed++;
  }

  return { processed, failed };
}

// Scheduler handlers
export async function handleSchedulerRun(request: Request, env: any) {
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

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }

  try {
    console.log('🚀 Running scheduler');
    const result = await processQueue(env);

    return new Response(JSON.stringify({
      success: true,
      message: 'Scheduler run completed',
      processed: result.processed,
      failed: result.failed,
      cleaned: false,
      timestamp: new Date().toISOString()
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });

  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Scheduler failed'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }
}

export async function handleSchedulerStatus(request: Request, env: any) {
  try {
    const supabase = getSupabaseClient(env);

    const { data: queueStats } = await supabase
      .from('file_generation_queue')
      .select('status')
      .not('status', 'eq', 'completed');

    const stats = {
      queued: queueStats?.filter(q => q.status === 'queued').length || 0,
      processing: queueStats?.filter(q => q.status === 'processing').length || 0,
      failed: queueStats?.filter(q => q.status === 'failed').length || 0,
      total_active: queueStats?.length || 0
    };

    return new Response(JSON.stringify({
      success: true,
      queue_stats: stats,
      timestamp: new Date().toISOString()
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });

  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get status'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }
}

export async function handleAteStatus(request: Request, env: any) {
  try {
    const url = new URL(request.url);
    const device_hash = url.searchParams.get('device_hash');

    if (!device_hash) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Device hash is required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }

    const supabase = getSupabaseClient(env);

    // Get download info using helper function
    const { data: downloadInfo, error } = await supabase.rpc('get_download_info', {
      device_hash_param: device_hash
    });

    if (error) {
      console.error('Error getting download info:', error);
      // Fallback response for database issues
      return new Response(JSON.stringify({
        success: true,
        is_ready: false,
        message: 'No .ate file found. Generate one first.',
        device_hash: device_hash
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }

    if (!downloadInfo || downloadInfo.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        is_ready: false,
        message: 'No .ate file found. Generate one first.',
        device_hash: device_hash
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }

    const fileInfo = downloadInfo[0];

    return new Response(JSON.stringify({
      success: true,
      is_ready: fileInfo.is_ready,
      ate_file_id: fileInfo.ate_file_id,
      filename: fileInfo.filename,
      file_size_bytes: fileInfo.file_size_bytes,
      expires_at: fileInfo.expires_at,
      download_count: fileInfo.download_count,
      last_downloaded_at: fileInfo.last_downloaded_at,
      download_url: fileInfo.is_ready ? `/api/ate/download/${fileInfo.ate_file_id}` : null,
      device_hash: device_hash
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });

  } catch (error) {
    console.error('Error in handleAteStatus:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get status'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }
}

export async function handleSchedulerHealth(request: Request, env: any) {
  return new Response(JSON.stringify({
    status: 'healthy',
    service: 'ate-scheduler',
    timestamp: new Date().toISOString()
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
  });
}

export async function handleWorkerProcess(request: Request, env: any) {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const { queue_id } = await request.json();
    if (!queue_id) {
      return new Response(JSON.stringify({ error: 'Queue ID required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const success = await processAteGeneration(queue_id, env);

    return new Response(JSON.stringify({
      success,
      message: success ? 'Generation completed' : 'Generation failed'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Processing failed'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

export async function handleWorkerHealth(request: Request, env: any) {
  return new Response(JSON.stringify({
    status: 'healthy',
    service: 'ate-worker',
    timestamp: new Date().toISOString()
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
}