// .ate File Generation Scheduler
// Polls the generation queue and triggers worker processes

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

// Trigger worker to process a queue item
async function triggerWorker(queueId: string, env: any): Promise<boolean> {
  try {
    // In Cloudflare Pages, we can call the worker directly
    const workerUrl = `${env.WORKER_BASE_URL || 'https://smartgram.jp'}/api/ate-worker/process`;

    const response = await fetch(workerUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        queue_id: queueId
      })
    });

    if (!response.ok) {
      console.error(`Worker failed for queue ${queueId}:`, await response.text());
      return false;
    }

    console.log(`✅ Worker triggered successfully for queue ${queueId}`);
    return true;
  } catch (error) {
    console.error(`❌ Failed to trigger worker for queue ${queueId}:`, error);
    return false;
  }
}

// Process pending queue items
async function processQueue(env: any): Promise<{ processed: number; failed: number }> {
  const supabase = getSupabaseClient(env);
  let processed = 0;
  let failed = 0;

  try {
    // Get pending queue items, ordered by priority and created time
    const { data: queueItems, error: queueError } = await supabase
      .from('file_generation_queue')
      .select('id, priority, created_at, retry_count, max_retries')
      .eq('status', 'queued')
      .lt('retry_count', 3) // Only items that haven't exceeded retry limit
      .order('priority', { ascending: true }) // Higher priority first (1 = highest)
      .order('created_at', { ascending: true }) // Older items first
      .limit(10); // Process max 10 items per run

    if (queueError) {
      console.error('Error fetching queue items:', queueError);
      return { processed: 0, failed: 1 };
    }

    if (!queueItems || queueItems.length === 0) {
      console.log('No pending queue items found');
      return { processed: 0, failed: 0 };
    }

    console.log(`Found ${queueItems.length} pending queue items`);

    // Process each queue item
    for (const item of queueItems) {
      try {
        console.log(`Processing queue item ${item.id} (priority: ${item.priority})`);

        const success = await triggerWorker(item.id, env);

        if (success) {
          processed++;
        } else {
          failed++;

          // Update retry count
          await supabase
            .from('file_generation_queue')
            .update({
              retry_count: item.retry_count + 1,
              error_message: 'Worker trigger failed'
            })
            .eq('id', item.id);
        }

        // Small delay between processing items
        await new Promise(resolve => setTimeout(resolve, 500));

      } catch (error) {
        console.error(`Error processing queue item ${item.id}:`, error);
        failed++;

        // Mark as failed if max retries exceeded
        if (item.retry_count >= item.max_retries - 1) {
          await supabase.rpc('fail_ate_generation', {
            queue_id_param: item.id,
            error_message_param: 'Max retries exceeded'
          });
        }
      }
    }

  } catch (error) {
    console.error('Queue processing error:', error);
    failed++;
  }

  console.log(`Queue processing completed: ${processed} processed, ${failed} failed`);
  return { processed, failed };
}

// Cleanup old queue items and expired files
async function cleanup(env: any): Promise<void> {
  const supabase = getSupabaseClient(env);

  try {
    // Clean up old completed/failed queue items (older than 7 days)
    const { error: cleanupError } = await supabase
      .from('file_generation_queue')
      .delete()
      .in('status', ['completed', 'failed'])
      .lt('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

    if (cleanupError) {
      console.error('Cleanup error:', cleanupError);
    } else {
      console.log('✅ Queue cleanup completed');
    }

    // Clean up expired ate files
    const { data: expiredCount, error: expiredError } = await supabase.rpc('cleanup_expired_ate_files');

    if (expiredError) {
      console.error('Expired files cleanup error:', expiredError);
    } else {
      console.log(`✅ Expired files cleanup completed: ${expiredCount} files marked inactive`);
    }

  } catch (error) {
    console.error('Cleanup failed:', error);
  }
}

// Main scheduler function
async function runScheduler(env: any): Promise<{ processed: number; failed: number; cleaned: boolean }> {
  console.log('🚀 Starting .ate file generation scheduler');

  const startTime = Date.now();

  // Process queue items
  const queueResult = await processQueue(env);

  // Run cleanup every hour (check if we should run it)
  const shouldCleanup = Math.random() < 0.1; // 10% chance, or implement time-based logic
  let cleaned = false;

  if (shouldCleanup) {
    console.log('Running cleanup tasks');
    await cleanup(env);
    cleaned = true;
  }

  const duration = Date.now() - startTime;
  console.log(`⏱️ Scheduler completed in ${duration}ms`);

  return {
    processed: queueResult.processed,
    failed: queueResult.failed,
    cleaned
  };
}

// Cloudflare Workers/Pages entry point
export async function onRequest(context: any) {
  const { request, env } = context;
  const url = new URL(request.url);

  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      }
    });
  }

  // Manual scheduler trigger
  if (request.method === 'POST' && url.pathname === '/api/ate-scheduler/run') {
    try {
      const result = await runScheduler(env);

      return new Response(JSON.stringify({
        success: true,
        message: 'Scheduler run completed',
        ...result,
        timestamp: new Date().toISOString()
      }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });

    } catch (error) {
      console.error('Scheduler error:', error);
      return new Response(JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Scheduler failed'
      }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }
  }

  // Queue status endpoint
  if (request.method === 'GET' && url.pathname === '/api/ate-scheduler/status') {
    try {
      const supabase = getSupabaseClient(env);

      // Get queue statistics
      const { data: queueStats, error: statsError } = await supabase
        .from('file_generation_queue')
        .select('status')
        .not('status', 'eq', 'completed');

      if (statsError) {
        throw new Error(`Failed to get queue stats: ${statsError.message}`);
      }

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
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });

    } catch (error) {
      return new Response(JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get status'
      }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }
  }

  // Health check
  if (request.method === 'GET' && url.pathname === '/api/ate-scheduler/health') {
    return new Response(JSON.stringify({
      status: 'healthy',
      service: 'ate-scheduler',
      timestamp: new Date().toISOString()
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }

  return new Response(JSON.stringify({ error: 'Not found' }), {
    status: 404,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    }
  });
}