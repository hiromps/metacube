// PayPal webhook handler function
export async function onRequestPost(context) {
  try {
    const { request } = context
    const body = await request.json()

    return new Response(
      JSON.stringify({
        success: true,
        message: 'PayPal webhook received',
        event_type: body.event_type || 'unknown',
        webhook_id: body.id || 'unknown',
        timestamp: new Date().toISOString()
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        error: 'PayPal webhook processing error',
        timestamp: new Date().toISOString()
      }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      }
    )
  }
}

export async function onRequestGet(context) {
  return new Response(
    JSON.stringify({
      success: true,
      message: 'PayPal webhook endpoint is running',
      timestamp: new Date().toISOString()
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    }
  )
}

export async function onRequestOptions(context) {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    }
  })
}