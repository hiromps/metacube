// Simple test function for device registration
export async function onRequestPost(context) {
  try {
    const { request } = context
    const body = await request.json()

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Device registration endpoint received POST request',
        received_data: body,
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
        error: 'Invalid request',
        timestamp: new Date().toISOString()
      }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      }
    )
  }
}

export async function onRequestOptions(context) {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    }
  })
}