import { createClient } from '@supabase/supabase-js'

// Initialize Supabase client for Cloudflare Functions
function getSupabaseClient(env: any) {
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = env.SUPABASE_SERVICE_ROLE_KEY

  console.log('Environment check - URL exists:', !!supabaseUrl, 'Key exists:', !!supabaseServiceKey);

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase config - URL:', !!supabaseUrl, 'Key:', !!supabaseServiceKey);
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

  console.log('API Request - Path:', path, 'URL:', request.url, 'Method:', request.method);

  // Route to specific handlers based on path
  if (path === 'license/verify') {
    return handleLicenseVerify(request, env);
  } else if (path === 'device/register') {
    return handleDeviceRegister(request, env);
  } else if (path === 'device/login') {
    return handleDeviceLogin(request, env);
  } else if (path === 'device/change') {
    return handleDeviceChange(request, env);
  } else if (path === 'device/activate') {
    return handleDeviceActivate(request, env);
  } else if (path === 'user/status') {
    console.log('Routing to handleUserStatus');
    return handleUserStatus(request, env);
  } else if (path === 'user/dashboard') {
    return handleUserDashboard(request, env);
  } else if (path === 'admin/update-device') {
    return handleAdminUpdateDevice(request, env);
  } else if (path === 'admin/create-test-data') {
    return handleAdminCreateTestData(request, env);
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

    // Get device from Supabase
    const supabase = getSupabaseClient(env);

    // First, try to get device from database
    const { data: deviceData, error: deviceError } = await supabase
      .from('devices')
      .select('*')
      .eq('device_hash', device_hash)
      .single();

    if (deviceError && deviceError.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.error('Database error:', deviceError);
      console.error('Error details:', {
        message: deviceError.message,
        code: deviceError.code,
        details: deviceError.details,
        hint: deviceError.hint
      });
      return new Response(
        JSON.stringify({
          is_valid: false,
          error: 'Database error occurred',
          details: deviceError.message,
          code: deviceError.code
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

    const device = deviceData;

    if (!device) {
      return new Response(
        JSON.stringify({
          is_valid: false,
          status: 'unregistered',
          license_type: null, // AutoTouchスタイル
          error: 'Device not registered',
          message: 'Please register your device first',
          registration_url: 'https://smartgram-el5.pages.dev/register'
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
    if (device && device.status === 'registered' && !device.trial_activated) {
      // Activate trial on first execution
      const trialEndTime = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000); // 72 hours from now

      // Update device in database
      const { data: updatedDevice, error: updateError } = await supabase
        .from('devices')
        .update({
          status: 'trial',
          trial_ends_at: trialEndTime.toISOString(),
          trial_activated: true,
          trial_activated_at: new Date().toISOString(),
          first_execution_at: new Date().toISOString()
        })
        .eq('device_hash', device_hash)
        .select()
        .single();

      if (updateError) {
        console.error('Failed to activate trial:', updateError);
        return new Response(
          JSON.stringify({
            is_valid: false,
            error: 'Failed to activate trial'
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
          is_valid: true,
          status: 'trial',
          license_type: 'TRIAL', // AutoTouchスタイル
          expires_at: trialEndTime.toISOString(),
          trial_ends_at: trialEndTime.toISOString(),
          time_remaining_seconds: 3 * 24 * 60 * 60, // 72 hours in seconds
          device_hash: device_hash,
          device_model: 'iPhone 7/8',
          registered_at: device.created_at,
          message: 'Trial activated! Enjoy 3 days of free access',
          trial_activated_at: new Date().toISOString(),
          first_execution_at: new Date().toISOString()
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

    // Check if device exists but return appropriate response based on status
    if (!device) {
      return new Response(
        JSON.stringify({
          is_valid: false,
          status: 'unregistered',
          license_type: null,
          error: 'Device not registered',
          message: 'Please register your device first',
          registration_url: 'https://smartgram-el5.pages.dev/register'
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

    // Use trial_ends_at for trial expiration check
    const expiresAt = device.trial_ends_at || device.expires_at;
    const isExpired = expiresAt ? new Date(expiresAt) < new Date() : false;
    const isValid = device.status === 'active' || (device.status === 'trial' && !isExpired);

    // Calculate time remaining for trial users
    let timeRemainingSeconds = 0;
    if (device.status === 'trial' && device.trial_ends_at) {
      const timeRemaining = new Date(device.trial_ends_at).getTime() - new Date().getTime();
      timeRemainingSeconds = Math.max(0, Math.floor(timeRemaining / 1000));
    }

    // Check if device has active subscription (need separate query since we removed join)
    let hasActiveSubscription = false;
    if (device) {
      const { data: subscriptions } = await supabase
        .from('subscriptions')
        .select('status')
        .eq('device_id', device.id);

      hasActiveSubscription = subscriptions?.some((sub: any) => sub.status === 'active') || false;
    }

    return new Response(
      JSON.stringify({
        is_valid: isValid,
        status: device.status,
        license_type: device.status === 'trial' ? 'TRIAL' : (device.status === 'active' || hasActiveSubscription ? 'PRO' : null),
        expires_at: expiresAt,
        trial_ends_at: device.trial_ends_at,
        time_remaining_seconds: timeRemainingSeconds,
        device_hash: device_hash,
        device_model: 'iPhone 7/8',
        registered_at: device.created_at,
        message: isValid ? 'License is valid' : (device.status === 'registered' ? 'Device registered - Trial will start on first execution' : 'License has expired'),
        trial_activated: device.trial_activated,
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

// User dashboard data handler
async function handleUserDashboard(request: Request, env: any) {
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

    // Get user info from auth
    const { data: userAuth, error: authError } = await supabase.auth.admin.getUserById(userId);

    if (authError || !userAuth.user) {
      console.warn('User not found in auth:', authError?.message);
    }

    // Get user's device and subscription data
    const { data: devices, error: deviceError } = await supabase
      .from('devices')
      .select(`
        id,
        device_hash,
        status,
        trial_ends_at,
        created_at,
        subscriptions (
          id,
          paypal_subscription_id,
          status,
          created_at
        )
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (deviceError) {
      console.error('Error fetching devices:', deviceError);
      return new Response(
        JSON.stringify({
          error: 'Failed to fetch user data'
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

    const device = devices && devices.length > 0 ? devices[0] : null;
    const subscription = device?.subscriptions && device.subscriptions.length > 0 ? device.subscriptions[0] : null;

    // Calculate trial status
    let trialDaysRemaining = null;
    let isTrialActive = false;
    if (device && device.trial_ends_at) {
      const trialEndDate = new Date(device.trial_ends_at);
      const now = new Date();
      const diffTime = trialEndDate.getTime() - now.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays > 0) {
        trialDaysRemaining = diffDays;
        isTrialActive = true;
      }
    }

    const isSubscriptionActive = subscription?.status === 'active';

    return new Response(
      JSON.stringify({
        email: userAuth?.user?.email || 'unknown@example.com',
        device: device ? {
          id: device.id,
          device_hash: device.device_hash,
          status: device.status,
          trial_ends_at: device.trial_ends_at,
          created_at: device.created_at
        } : null,
        subscription: subscription ? {
          id: subscription.id,
          paypal_subscription_id: subscription.paypal_subscription_id,
          status: subscription.status,
          created_at: subscription.created_at
        } : null,
        trialDaysRemaining,
        isTrialActive,
        isSubscriptionActive
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
    console.error('Error in handleUserDashboard:', error);
    return new Response(
      JSON.stringify({
        error: 'Failed to get dashboard data'
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
    console.log('handleUserStatus called with URL:', request.url);

    const supabase = getSupabaseClient(env);
    const url = new URL(request.url);
    const userId = url.searchParams.get('user_id');
    const deviceHash = url.searchParams.get('device_hash'); // Optional parameter for device creation

    console.log('Parsed parameters - userId:', userId, 'deviceHash:', deviceHash);

    if (!userId) {
      console.log('Missing userId, returning 400');
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

    // Try to get user email from the request or use a default
    // In production, this would come from a verified JWT token
    let userEmail = 'akihiro0324mnr@gmail.com'; // Default test user

    // Get device information for this user
    const { data: deviceData, error: deviceError } = await supabase
      .from('devices')
      .select(`
        id,
        device_hash,
        status,
        trial_activated,
        trial_activated_at,
        first_execution_at,
        trial_ends_at,
        registered_at,
        subscriptions(
          id,
          paypal_subscription_id,
          status,
          plan_id
        )
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1);

    // If no device found, try to create a test device for known test user
    if (deviceError || !deviceData || deviceData.length === 0) {
      console.log('No device found for user, checking if we should create test data:', deviceError?.message);

      // Only auto-create test device if device_hash is explicitly provided
      if (deviceHash) {
        console.log('Creating device for user with provided device hash:', deviceHash);
        try {
          const { data: newDevice, error: insertError } = await supabase
            .from('devices')
            .insert({
              user_id: userId,
              device_hash: deviceHash,
              status: 'registered',
              trial_activated: false,
              trial_activated_at: null,
              first_execution_at: null,
              trial_ends_at: null,
              registered_at: new Date().toISOString()
            })
            .select()
            .single();

          if (!insertError && newDevice) {
            console.log('Successfully created device:', newDevice);
            const testUserData = {
              user_id: userId,
              email: userEmail,
              status: 'registered',
              device_id: newDevice.id,
              device_hash: deviceHash,
              trial_activated: false,
              trial_activated_at: null,
              first_execution_at: null,
              trial_ends_at: null,
              subscription_id: null,
              paypal_subscription_id: null,
              subscription_status: 'registered',
              status_description: 'Registered - Trial will start on first main.lua execution',
              has_access_to_content: true,
              has_access_to_tools: false,
              time_remaining_seconds: null
            };

            return new Response(
              JSON.stringify(testUserData),
              {
                status: 200,
                headers: {
                  'Content-Type': 'application/json',
                  'Access-Control-Allow-Origin': '*'
                }
              }
            );
          }
        } catch (createError) {
          console.error('Failed to create device:', createError);
        }
      }

      const defaultUserData = {
        user_id: userId,
        email: userEmail,
        status: 'unregistered',
        device_id: null,
        device_hash: null,
        trial_activated: false,
        trial_activated_at: null,
        first_execution_at: null,
        trial_ends_at: null,
        subscription_id: null,
        paypal_subscription_id: null,
        subscription_status: 'unregistered',
        status_description: 'No device registered - Please register your device first',
        has_access_to_content: false,
        has_access_to_tools: false,
        time_remaining_seconds: null
      };

      return new Response(
        JSON.stringify(defaultUserData),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        }
      );
    }

    const device = deviceData[0];
    const subscription = device.subscriptions && device.subscriptions.length > 0 ? device.subscriptions[0] : null;

    // Calculate time remaining for trial
    let timeRemainingSeconds = null;
    let hasAccessToTools = false;
    let statusDescription = '';

    const now = new Date();
    const trialEndDate = device.trial_ends_at ? new Date(device.trial_ends_at) : null;

    switch (device.status) {
      case 'registered':
        statusDescription = 'Registered - Trial will start on first main.lua execution';
        hasAccessToTools = false;
        break;
      case 'trial':
        if (trialEndDate && trialEndDate > now) {
          timeRemainingSeconds = Math.floor((trialEndDate.getTime() - now.getTime()) / 1000);
          hasAccessToTools = true;
          const daysLeft = Math.ceil(timeRemainingSeconds / (24 * 60 * 60));
          statusDescription = `Trial Active - ${daysLeft} days remaining`;
        } else {
          statusDescription = 'Trial Expired';
          hasAccessToTools = false;
        }
        break;
      case 'active':
        statusDescription = 'Active Subscription';
        hasAccessToTools = true;
        break;
      case 'expired':
        statusDescription = 'Subscription Expired';
        hasAccessToTools = false;
        break;
      default:
        statusDescription = 'Unknown Status';
        hasAccessToTools = false;
    }

    const userData = {
      user_id: userId,
      email: userEmail,
      status: device.status,
      device_id: device.id,
      device_hash: device.device_hash,
      trial_activated: device.trial_activated || false,
      trial_activated_at: device.trial_activated_at,
      first_execution_at: device.first_execution_at,
      trial_ends_at: device.trial_ends_at,
      subscription_id: subscription?.id || null,
      paypal_subscription_id: subscription?.paypal_subscription_id || null,
      subscription_status: subscription?.status || device.status,
      status_description: statusDescription,
      has_access_to_content: true, // All registered users can access content
      has_access_to_tools: hasAccessToTools,
      time_remaining_seconds: timeRemainingSeconds
    };

    return new Response(
      JSON.stringify(userData),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      }
    );
  } catch (error) {
    console.error('Error in handleUserStatus:', error);
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    return new Response(
      JSON.stringify({
        error: 'Failed to get user status',
        details: error instanceof Error ? error.message : 'Unknown error',
        url: request.url
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
    const { device_hash, email, user_id } = body;

    // Validate required fields - now using user_id instead of password
    if (!device_hash || !email || !user_id) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Device hash, email, and user_id are required'
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

    // Check if device already exists for this user
    const { data: existingDevice, error: checkError } = await supabase
      .from('devices')
      .select('id, device_hash')
      .eq('user_id', user_id)
      .eq('device_hash', device_hash)
      .maybeSingle();

    if (checkError) {
      console.error('Error checking existing device:', checkError);
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Database error while checking device'
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
          error: 'Device already registered for this user'
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

    // Register device with registered status (free registration)
    const { data: deviceData, error: deviceError } = await supabase.rpc('register_device_with_setup', {
      p_user_id: user_id,
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
      JSON.stringify({
        success: true,
        message: 'Device registered successfully for free access',
        data: deviceData
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
    console.error('Device registration error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Registration failed. Please try again.'
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

// Device login handler (for auto-login with device hash)
async function handleDeviceLogin(request: Request, env: any) {
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

    // まずモックデータでデバイスを確認
    const mockDevices: { [key: string]: any } = {
      // User requested device registration: akihiro0324mnr@gmail.com
      'FFMZ3GTSJC6J': {
        status: 'registered',
        expires_at: null,
        device_model: 'iPhone 7/8',
        registered_at: new Date().toISOString(),
        trial_activated: false,
        email: 'akihiro0324mnr@gmail.com',
        user_id: 'mock-user-id-123'
      }
    };

    const device = mockDevices[device_hash];

    if (!device || !device.email) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Device not found or not registered'
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

    // デバイスが有効な状態かチェック
    const validStatuses = ['registered', 'trial', 'active'];
    if (!validStatuses.includes(device.status)) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Device license is expired or invalid'
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

    // ユーザー情報を返す
    return new Response(
      JSON.stringify({
        success: true,
        message: 'Device found and valid for auto-login',
        user: {
          email: device.email,
          user_id: device.user_id
        },
        device: {
          device_hash: device_hash,
          status: device.status,
          device_model: device.device_model,
          registered_at: device.registered_at
        }
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
        error: 'Device login failed. Please try again.'
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
}// Admin API functions to append to functions/api/[[path]].ts

// Admin: Update device hash handler
async function handleAdminUpdateDevice(request: Request, env: any) {
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
    const { user_id, new_device_hash, admin_key } = body;

    // Simple admin authentication
    if (admin_key !== 'smartgram-admin-2024') {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Invalid admin key'
        }),
        {
          status: 401,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        }
      );
    }

    if (!user_id || !new_device_hash) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'User ID and new device hash are required'
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

    // Update device hash in database
    const { data, error } = await supabase
      .from('devices')
      .update({
        device_hash: new_device_hash,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', user_id)
      .select()
      .single();

    if (error) {
      console.error('Error updating device hash:', error);
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Failed to update device hash: ' + error.message
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
        message: 'Device hash updated successfully',
        data: {
          device_hash: new_device_hash,
          updated_at: new Date().toISOString()
        }
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
    console.error('Admin update device error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Internal server error'
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

// Admin: Create test data handler
async function handleAdminCreateTestData(request: Request, env: any) {
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
    const { device_hash, email, trial_days, admin_key } = body;

    // Simple admin authentication
    if (admin_key !== 'smartgram-admin-2024') {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Invalid admin key'
        }),
        {
          status: 401,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        }
      );
    }

    if (!device_hash || !email) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Device hash and email are required'
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

    // Create or get user
    const { data: userData, error: userError } = await supabase.auth.admin.createUser({
      email: email,
      password: 'test-password-' + Math.random().toString(36).substring(7),
      email_confirm: true
    });

    if (userError && !userError.message.includes('already been registered')) {
      console.error('Error creating user:', userError);
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Failed to create user: ' + userError.message
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

    let userId = userData?.user?.id;

    // If user already exists, get the user ID
    if (!userId) {
      const { data: authUsers } = await supabase.auth.admin.listUsers();
      const existingUser = authUsers.users.find(user => user.email === email);
      if (existingUser) {
        userId = existingUser.id;
      }
    }

    if (!userId) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Failed to get user ID'
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

    // Calculate trial end date
    const trialDaysNum = parseInt(trial_days) || 3;
    const trialEndDate = new Date();
    trialEndDate.setDate(trialEndDate.getDate() + trialDaysNum);

    // Create or update device
    const { data: deviceData, error: deviceError } = await supabase
      .from('devices')
      .upsert({
        user_id: userId,
        device_hash: device_hash,
        status: 'trial',
        trial_ends_at: trialEndDate.toISOString(),
        created_at: new Date().toISOString()
      }, {
        onConflict: 'user_id'
      })
      .select()
      .single();

    if (deviceError) {
      console.error('Error creating/updating device:', deviceError);
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Failed to create device: ' + deviceError.message
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
        message: 'Test data created successfully',
        data: {
          user_id: userId,
          email: email,
          device_hash: device_hash,
          trial_ends_at: trialEndDate.toISOString(),
          trial_days: trialDaysNum
        }
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
    console.error('Admin create test data error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Internal server error: ' + (error instanceof Error ? error.message : 'Unknown error')
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