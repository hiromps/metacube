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
  } else if (path === 'device/activate') {
    return handleDeviceActivate(request, env);
  } else if (path === 'user/status') {
    return handleUserStatus(request, env);
  } else if (path === 'content/access') {
    return handleContentAccess(request, env);
  } else if (path === 'paypal/success') {
    return handlePayPalSuccess(request, env);
  } else if (path === 'paypal/cancel') {
    return handlePayPalCancel(request);
  } else if (path === 'paypal/webhook') {
    return handlePayPalWebhook(request, env);
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
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      }
    });
  }

  if (request.method !== 'POST' && request.method !== 'GET') {
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
    let device_hash: string;

    if (request.method === 'POST') {
      const body = await request.json();
      device_hash = body.device_hash;
    } else {
      // GET request - extract from query parameters
      const url = new URL(request.url);
      device_hash = url.searchParams.get('device_hash') || '';
    }

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

      // User requested device registration: akihiro0324mnr@gmail.com
      'FFMZ3GTSJC6J': {
        status: 'registered',
        expires_at: null,
        device_model: 'iPhone 7/8',
        registered_at: new Date().toISOString(),
        trial_activated: false,
        email: 'akihiro0324mnr@gmail.com'
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
          status: 'unregistered',
          license_type: null, // AutoTouchスタイル
          error: 'Device not registered',
          message: 'Please register your device first',
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

    // Handle 'registered' status - trial activation on first run
    if (device.status === 'registered' && !device.trial_activated) {
      // Activate trial on first execution
      const trialEndTime = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000); // 72 hours from now
      device.status = 'trial';
      device.expires_at = trialEndTime.toISOString();
      device.trial_activated = true;
      device.trial_activated_at = new Date().toISOString();
      device.first_execution_at = new Date().toISOString();

      return new Response(
        JSON.stringify({
          is_valid: true,
          status: 'trial',
          license_type: 'TRIAL', // AutoTouchスタイル
          expires_at: device.expires_at,
          trial_ends_at: device.expires_at,
          time_remaining_seconds: 3 * 24 * 60 * 60, // 72 hours in seconds
          device_hash: device_hash,
          device_model: device.device_model || 'iPhone 7/8',
          registered_at: device.registered_at,
          message: 'Trial activated! Enjoy 3 days of free access',
          trial_activated_at: device.trial_activated_at,
          first_execution_at: device.first_execution_at
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

    const isExpired = device.expires_at ? new Date(device.expires_at) < new Date() : false;
    const isValid = device.status === 'active' || (device.status === 'trial' && !isExpired);

    // Calculate time remaining for trial users
    let timeRemainingSeconds = 0;
    if (device.status === 'trial' && device.expires_at) {
      const timeRemaining = new Date(device.expires_at).getTime() - new Date().getTime();
      timeRemainingSeconds = Math.max(0, Math.floor(timeRemaining / 1000));
    }

    return new Response(
      JSON.stringify({
        is_valid: isValid,
        status: device.status,
        license_type: device.status === 'trial' ? 'TRIAL' : (device.status === 'active' ? 'PRO' : null), // AutoTouchスタイル
        expires_at: device.expires_at,
        trial_ends_at: device.status === 'trial' ? device.expires_at : null,
        time_remaining_seconds: timeRemainingSeconds,
        device_hash: device_hash,
        device_model: device.device_model || 'iPhone',
        registered_at: device.registered_at,
        message: isValid ? 'License is valid' : (device.status === 'registered' ? 'Device registered - Trial will start on first execution' : 'License has expired')
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

// Device activation handler (after setup period)
async function handleDeviceActivate(request: Request, env: any) {
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
    const { device_hash } = body;

    if (!device_hash) {
      return new Response(
        JSON.stringify({
          success: false,
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

    // Call the activate_trial function
    const { data, error } = await supabase.rpc('activate_trial', {
      p_device_hash: device_hash
    });

    if (error) {
      return new Response(
        JSON.stringify({
          success: false,
          error: error.message
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

    return new Response(
      JSON.stringify(data),
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
        error: 'Activation failed'
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

// User status handler
async function handleUserStatus(request: Request, env: any) {
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      }
    });
  }

  if (request.method !== 'GET') {
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
    const url = new URL(request.url);
    const userId = url.searchParams.get('user_id');

    if (!userId) {
      return new Response(
        JSON.stringify({
          error: 'User ID is required'
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

    // Get user status from the view
    const { data, error } = await supabase
      .from('user_status')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) {
      return new Response(
        JSON.stringify({
          error: 'User not found'
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

    return new Response(
      JSON.stringify(data),
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
        error: 'Failed to get user status'
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

// Content access handler
async function handleContentAccess(request: Request, env: any) {
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      }
    });
  }

  if (request.method !== 'GET') {
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
    const url = new URL(request.url);
    const userId = url.searchParams.get('user_id');

    if (!userId) {
      return new Response(
        JSON.stringify({
          has_access: false,
          reason: 'User ID is required'
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

    // Call the check_content_access function
    const { data, error } = await supabase.rpc('check_content_access', {
      p_user_id: userId
    });

    if (error) {
      return new Response(
        JSON.stringify({
          has_access: false,
          reason: error.message
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

    return new Response(
      JSON.stringify(data),
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
        has_access: false,
        reason: 'Failed to check access'
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

    const supabase = getSupabaseClient(env);

    // Create user in Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password
    });

    if (authError) {
      return new Response(
        JSON.stringify({
          success: false,
          error: authError.message
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

    if (!authData.user) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Failed to create user account'
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

    // Register device with registered status (no trial yet)
    const { data: deviceData, error: deviceError } = await supabase.rpc('register_device_with_setup', {
      p_user_id: authData.user.id,
      p_device_hash: device_hash,
      p_email: email
    });

    if (deviceError) {
      return new Response(
        JSON.stringify({
          success: false,
          error: deviceError.message
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

    return new Response(
      JSON.stringify(deviceData),
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
async function handlePayPalSuccess(request: Request, env: any) {
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
async function handlePayPalWebhook(request: Request, env: any) {
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
      const supabase = getSupabaseClient(env);
      const body = await request.json();

      // Handle subscription creation/activation
      if (body.event_type === 'BILLING.SUBSCRIPTION.CREATED' ||
          body.event_type === 'BILLING.SUBSCRIPTION.ACTIVATED') {
        const resource = body.resource;
        const subscriptionId = resource.id;
        const customId = resource.custom_id; // device_id

        // Start setup period for the device
        const { data, error } = await supabase.rpc('start_setup_period', {
          p_device_id: customId,
          p_paypal_subscription_id: subscriptionId
        });

        if (error) {
          console.error('Failed to start setup period:', error);
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: 'PayPal webhook processed',
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