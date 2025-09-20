// Catch-all API route handler for Cloudflare Pages Functions
export async function onRequest(context: any) {
  const { request, params } = context;
  const path = params.path ? params.path.join('/') : '';

  // Route to specific handlers based on path
  if (path === 'license/verify') {
    return handleLicenseVerify(request);
  } else if (path === 'device/register') {
    return handleDeviceRegister(request);
  } else if (path === 'paypal/success') {
    return handlePayPalSuccess(request);
  } else if (path === 'paypal/cancel') {
    return handlePayPalCancel(request);
  } else if (path === 'paypal/webhook') {
    return handlePayPalWebhook(request);
  }

  // 404 for unknown API routes
  return new Response(
    JSON.stringify({ error: 'API endpoint not found', path }),
    {
      status: 404,
      headers: { 'Content-Type': 'application/json' }
    }
  );
}

// License verification handler
async function handleLicenseVerify(request: Request) {
  if (request.method === 'GET') {
    return new Response(
      JSON.stringify({
        success: true,
        message: 'License verification endpoint is running',
        timestamp: new Date().toISOString()
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      }
    );
  }

  if (request.method === 'POST') {
    try {
      const body = await request.json();
      return new Response(
        JSON.stringify({
          success: true,
          message: 'License verification received',
          received_data: body,
          timestamp: new Date().toISOString()
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        }
      );
    } catch (error) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Invalid request body'
        }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        }
      );
    }
  }

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      }
    });
  }

  return new Response(
    JSON.stringify({ error: 'Method not allowed' }),
    {
      status: 405,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    }
  );
}

// Device registration handler
async function handleDeviceRegister(request: Request) {
  if (request.method === 'GET') {
    return new Response(
      JSON.stringify({
        success: true,
        message: 'Device registration endpoint is running',
        methods: ['POST'],
        timestamp: new Date().toISOString()
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      }
    );
  }

  if (request.method === 'POST') {
    try {
      const body = await request.json();
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Device registration received',
          received_data: body,
          timestamp: new Date().toISOString()
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        }
      );
    } catch (error) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Invalid request body'
        }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        }
      );
    }
  }

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      }
    });
  }

  return new Response(
    JSON.stringify({ error: 'Method not allowed' }),
    {
      status: 405,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    }
  );
}

// PayPal success handler
async function handlePayPalSuccess(request: Request) {
  const url = new URL(request.url);
  const subscriptionId = url.searchParams.get('subscription_id');
  const token = url.searchParams.get('token');

  return new Response(
    JSON.stringify({
      success: true,
      message: 'PayPal payment successful',
      subscription_id: subscriptionId,
      token: token,
      timestamp: new Date().toISOString()
    }),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    }
  );
}

// PayPal cancel handler
async function handlePayPalCancel(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get('token');

  return new Response(
    JSON.stringify({
      success: true,
      message: 'PayPal payment cancelled',
      token: token,
      timestamp: new Date().toISOString()
    }),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    }
  );
}

// PayPal webhook handler
async function handlePayPalWebhook(request: Request) {
  if (request.method === 'GET') {
    return new Response(
      JSON.stringify({
        success: true,
        message: 'PayPal webhook endpoint is running',
        timestamp: new Date().toISOString()
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      }
    );
  }

  if (request.method === 'POST') {
    try {
      const body = await request.json();
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
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        }
      );
    } catch (error) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'PayPal webhook processing error'
        }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        }
      );
    }
  }

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      }
    });
  }

  return new Response(
    JSON.stringify({ error: 'Method not allowed' }),
    {
      status: 405,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    }
  );
}