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

// Simplified .ate generation function
export async function processAteGeneration(queueId: string, env: any): Promise<boolean> {
  const supabase = getSupabaseClient(env);

  try {
    console.log('Processing .ate generation for queue ID:', queueId);

    // Mark as processing
    await supabase
      .from('file_generation_queue')
      .update({
        status: 'processing',
        started_at: new Date().toISOString()
      })
      .eq('id', queueId);

    // Simulate processing (replace with actual implementation)
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Mark as completed
    const { error: completeError } = await supabase.rpc('complete_ate_generation', {
      queue_id_param: queueId,
      file_path_param: `generated/temp/${queueId}.ate`,
      file_size_param: 1024,
      checksum_param: 'temp_checksum',
      encryption_key_hash_param: 'temp_key_hash'
    });

    if (completeError) {
      throw new Error(`Failed to complete generation: ${completeError.message}`);
    }

    console.log('✅ Generation completed successfully');
    return true;

  } catch (error) {
    console.error('❌ Generation failed:', error);

    await supabase.rpc('fail_ate_generation', {
      queue_id_param: queueId,
      error_message_param: error instanceof Error ? error.message : 'Unknown error'
    });

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

    // For now, return no file found until tables are properly set up
    return new Response(JSON.stringify({
      success: true,
      is_ready: false,
      message: 'No .ate file found. Generate one first.',
      device_hash: device_hash
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