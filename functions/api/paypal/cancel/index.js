// PayPal cancel callback function
export async function onRequestGet(context) {
  try {
    const { request } = context
    const url = new URL(request.url)
    const token = url.searchParams.get('token')

    return new Response(
      JSON.stringify({
        success: true,
        message: 'PayPal payment cancelled',
        token: token,
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
        error: 'PayPal cancel callback error',
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
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    }
  })
}