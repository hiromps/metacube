import { createClient } from '@supabase/supabase-js'

// Initialize Supabase client for Cloudflare Functions
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

// Catch-all API route handler for Cloudflare Pages Functions
export async function onRequest(context: any) {
  const { request, params, env } = context;
  const path = params.path ? params.path.join('/') : '';

  // Route to specific handlers based on path
  if (path === 'license/verify') {
    return handleLicenseVerify(request, env);
  } else if (path === 'device/register') {
    return handleDeviceRegister(request, env);
  } else if (path === 'device/change') {
    return handleDeviceChange(request, env);
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
async function handleLicenseVerify(request: Request, env: any) {
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

  try {
    const body = await request.json();
    const { device_hash } = body;

    if (!device_hash) {
      return new Response(
        JSON.stringify({
          is_valid: false,
          error: 'Device hash is required'
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

    // TODO: Implement Supabase integration here
    // For MVP, simulate license check with mock data
    const mockDevices: { [key: string]: any } = {
      // 従来のテスト用デバイス
      'DEMO-DEVICE-001': {
        status: 'active',
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 days from now
      },
      'DEMO-DEVICE-002': {
        status: 'trial',
        expires_at: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString() // 3 days trial
      },
      'DEMO-DEVICE-003': {
        status: 'expired',
        expires_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString() // Expired yesterday
      },

      // iPhone 7/8のシリアル番号サンプル（実際のパターンに基づく）
      'F2LXJ7XXHG7F': {
        status: 'active',
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        device_model: 'iPhone 7',
        registered_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
      },
      'FMRY2J9KHFLL': {
        status: 'trial',
        expires_at: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
        device_model: 'iPhone 8',
        registered_at: new Date().toISOString()
      },
      'D4HJMQLNHFM4': {
        status: 'expired',
        expires_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        device_model: 'iPhone 7 Plus',
        registered_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
      },

      // UUIDベースのフォールバック用
      'UUID_A1B2C3D4E5F6': {
        status: 'trial',
        expires_at: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
        device_model: 'iPhone Unknown',
        registered_at: new Date().toISOString()
      }
    };

    const device = mockDevices[device_hash];

    if (!device) {
      return new Response(
        JSON.stringify({
          is_valid: false,
          error: 'Device not registered',
          registration_url: 'https://metacube-el5.pages.dev/register'
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

    const isExpired = new Date(device.expires_at) < new Date();
    const isValid = device.status === 'active' || (device.status === 'trial' && !isExpired);

    return new Response(
      JSON.stringify({
        is_valid: isValid,
        status: device.status,
        expires_at: device.expires_at,
        message: isValid ? 'License is valid' : 'License has expired'
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
        is_valid: false,
        error: 'Invalid request'
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

// Device registration handler
async function handleDeviceRegister(request: Request, env: any) {
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

  try {
    const body = await request.json();
    const { device_hash, email, password } = body;

    // Validate required fields
    if (!device_hash || !email || !password) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Device hash, email, and password are required'
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

    // TODO: Implement Supabase user creation and device registration
    // For MVP, simulate registration with mock response

    // Calculate trial end date (3 days from now)
    const trialEndsAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Device registered successfully. Your 3-day trial has started.',
        device_hash: device_hash,
        trial_ends_at: trialEndsAt,
        status: 'trial'
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
        error: 'Registration failed. Please try again.'
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

// Device change handler
async function handleDeviceChange(request: Request, env: any) {
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      }
    });
  }

  if (request.method !== 'POST') {
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

  try {
    const supabase = getSupabaseClient(env);
    const body = await request.json();
    const { old_device_hash, new_device_hash, email } = body;

    // Validate required fields
    if (!old_device_hash || !new_device_hash || !email) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Old device hash, new device hash, and email are required'
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

    // Check if old and new device hashes are the same
    if (old_device_hash === new_device_hash) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'New device hash must be different from the current one'
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

    // Find user by email using users table
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .single();

    if (userError || !userData) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'User not found with this email'
        }),
        {
          status: 404,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        }
      );
    }

    // Check if old device exists and belongs to the user
    const { data: oldDevice, error: oldDeviceError } = await supabase
      .from('devices')
      .select('*')
      .eq('device_hash', old_device_hash)
      .eq('user_id', userData.id)
      .single();

    if (oldDeviceError || !oldDevice) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Current device not found or not registered to this user'
        }),
        {
          status: 404,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        }
      );
    }

    // Check if license is still valid
    const isTrialExpired = oldDevice.trial_ends_at && new Date(oldDevice.trial_ends_at) < new Date();
    const isValidStatus = ['active', 'trial'].includes(oldDevice.status);

    if (!isValidStatus || (oldDevice.status === 'trial' && isTrialExpired)) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Cannot change device: license has expired or is not active'
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

    // Check if new device is already registered to any user
    const { data: existingDevice, error: existingError } = await supabase
      .from('devices')
      .select('device_hash')
      .eq('device_hash', new_device_hash)
      .maybeSingle();

    if (existingError) {
      console.error('Error checking existing device:', existingError);
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Database error while checking device availability'
        }),
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        }
      );
    }

    if (existingDevice) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'New device is already registered to another account'
        }),
        {
          status: 409,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        }
      );
    }

    // Update device hash in database
    const { data: updatedDevice, error: updateError } = await supabase
      .from('devices')
      .update({
        device_hash: new_device_hash,
        updated_at: new Date().toISOString()
      })
      .eq('id', oldDevice.id)
      .eq('user_id', userData.id)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating device:', updateError);
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Failed to update device in database'
        }),
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Device changed successfully',
        old_device_hash: old_device_hash,
        new_device_hash: new_device_hash,
        status: oldDevice.status,
        expires_at: oldDevice.trial_ends_at || 'No expiration',
        changed_at: new Date().toISOString()
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
    console.error('Device change error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Device change failed. Please try again.'
      }),
      {
        status: 500,
      headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      }
    );
  }
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