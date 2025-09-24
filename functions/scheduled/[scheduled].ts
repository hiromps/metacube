// Cloudflare Pages Scheduled Worker
// Automatically triggers .ate file generation scheduler

export async function onRequest(context: any) {
  const { request, env } = context;

  // This will be called by Cloudflare Cron Triggers or external schedulers
  console.log('⏰ Scheduled .ate file processor triggered');

  try {
    // Call the scheduler
    const schedulerUrl = `${env.WORKER_BASE_URL || 'https://smartgram.jp'}/api/ate-scheduler/run`;

    const response = await fetch(schedulerUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      }
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(`Scheduler failed: ${result.error}`);
    }

    console.log('✅ Scheduled processor completed:', result);

    return new Response(JSON.stringify({
      success: true,
      message: 'Scheduled processor completed successfully',
      result,
      triggered_at: new Date().toISOString()
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json'
      }
    });

  } catch (error) {
    console.error('❌ Scheduled processor failed:', error);

    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Scheduled processor failed',
      triggered_at: new Date().toISOString()
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
}