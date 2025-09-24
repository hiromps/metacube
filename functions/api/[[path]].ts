import { createClient } from '@supabase/supabase-js'
import {
  handlePlansList,
  handlePlanChange,
  handleUsageCheck,
  handleUsageIncrement,
  handleFeatureCheck
} from './multiplan-handlers'
import { handleDownloadPackage } from './download-package'
import {
  handleSchedulerRun,
  handleSchedulerStatus,
  handleSchedulerHealth,
  handleWorkerProcess,
  handleWorkerHealth,
  handleAteStatus
} from './ate-handlers'

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
  } else if (path === 'save-auth-result') {
    return handleSaveAuthResult(request, env);
  } else if (path === 'content/access') {
    return handleContentAccess(request, env);
  } else if (path === 'paypal/success') {
    return handlePayPalSuccess(request, env);
  } else if (path === 'paypal/cancel') {
    return handlePayPalCancel(request);
  } else if (path === 'paypal/webhook') {
    return handlePayPalWebhook(request, env);
  } else if (path === 'device/user-email') {
    return handleGetUserEmailByDevice(request, env);
  } else if (path === 'plans/list') {
    return handlePlansList(request, env);
  } else if (path === 'plans/upgrade') {
    return handlePlanChange(request, env);
  } else if (path === 'plans/downgrade') {
    return handlePlanChange(request, env);
  } else if (path === 'usage/check') {
    return handleUsageCheck(request, env);
  } else if (path === 'usage/increment') {
    return handleUsageIncrement(request, env);
  } else if (path === 'feature/check') {
    return handleFeatureCheck(request, env);
  } else if (path === 'download/package') {
    return handleDownloadPackage(request, env);
  } else if (path === 'admin/upload-package') {
    console.log('Routing to admin upload package handler');
    return handleAdminUploadPackageInternal(request, env);
  } else if (path === 'ate/generate') {
    return handleAteGenerateImmediate(request, env);
  } else if (path.startsWith('ate/download/')) {
    const ateFileId = path.split('/')[2];
    return handleAteDownload(request, env, ateFileId);
  } else if (path === 'ate/status') {
    return handleAteStatus(request, env);
  } else if (path === 'ate-scheduler/run') {
    return handleSchedulerRun(request, env);
  } else if (path === 'ate-scheduler/status') {
    return handleSchedulerStatus(request, env);
  } else if (path === 'ate-scheduler/health') {
    return handleSchedulerHealth(request, env);
  } else if (path === 'ate-worker/process') {
    return handleWorkerProcess(request, env);
  } else if (path === 'ate-worker/health') {
    return handleWorkerHealth(request, env);
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

    // Normalize device hash for consistent lookup (uppercase)
    const normalizedDeviceHash = device_hash.toUpperCase();

    // First, try to get device from database
    console.log('License verification for device hash:', device_hash);
    console.log('Normalized device hash:', normalizedDeviceHash);
    const { data: deviceData, error: deviceError } = await supabase
      .from('devices')
      .select('*')
      .eq('device_hash', normalizedDeviceHash)
      .single();

    console.log('Device query result:', { deviceData, deviceError });

    // Check if we have any devices at all for debugging
    const { data: allDevices } = await supabase
      .from('devices')
      .select('device_hash, status')
      .limit(10);
    console.log('Sample devices in database:', allDevices);

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
          error: 'デバイスが登録されていません',
          message: 'まずデバイスを登録してください',
          registration_url: 'https://smartgram.jp/register'
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
      console.log('Device not found in database for hash:', device_hash);
      return new Response(
        JSON.stringify({
          is_valid: false,
          status: 'unregistered',
          license_type: null,
          error: 'デバイスが登録されていません',
          message: 'まずデバイスを登録してください',
          registration_url: 'https://smartgram.jp/register'
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

    // Get plan information using the device_plan_view
    let planInfo = null;
    if (device) {
      const { data: devicePlan } = await supabase
        .from('device_plan_view')
        .select('plan_name, plan_display_name, plan_features, plan_limitations, plan_price')
        .eq('device_id', device.id)
        .single();

      planInfo = devicePlan;
    }

    // Determine license type based on plan hierarchy
    let licenseType = 'UNREGISTERED';
    if (device.status === 'trial') {
      licenseType = 'TRIAL';
    } else if (planInfo?.plan_name) {
      licenseType = planInfo.plan_name.toUpperCase();
    } else if (device.status === 'active' || hasActiveSubscription) {
      licenseType = 'STARTER'; // Default fallback
    }

    // Create script access object with plan-based restrictions
    const scriptAccess = planInfo?.plan_features ? {
      timeline_lua: planInfo.plan_features.timeline_lua === true,
      follow_lua: planInfo.plan_features.follow_lua === true,
      unfollow_lua: planInfo.plan_features.unfollow_lua === true,
      hashtaglike_lua: planInfo.plan_features.hashtaglike_lua === true,
      activelike_lua: planInfo.plan_features.activelike_lua === true
    } : {
      // Default for trial users - all access
      timeline_lua: device.status === 'trial',
      follow_lua: device.status === 'trial',
      unfollow_lua: device.status === 'trial',
      hashtaglike_lua: device.status === 'trial',
      activelike_lua: device.status === 'trial'
    };

    return new Response(
      JSON.stringify({
        is_valid: isValid,
        status: device.status,
        license_type: licenseType,
        expires_at: expiresAt,
        trial_ends_at: device.trial_ends_at,
        time_remaining_seconds: timeRemainingSeconds,
        device_hash: device_hash,
        device_model: 'iPhone 7/8',
        registered_at: device.created_at,
        message: isValid ? 'ライセンスは有効です' : (device.status === 'registered' ? 'デバイス登録済み - 初回実行時に体験版が開始されます' : 'ライセンスの有効期限が切れています'),
        trial_activated: device.trial_activated,
        trial_activated_at: device.trial_activated_at,
        first_execution_at: device.first_execution_at,
        // 新しいプラン情報
        plan_info: planInfo ? {
          name: planInfo.plan_name,
          display_name: planInfo.plan_display_name,
          price: planInfo.plan_price,
          features: planInfo.plan_features,
          limitations: planInfo.plan_limitations
        } : null,
        // 機能別アクセス権限
        features: planInfo?.plan_features || (device.status === 'trial' ? {
          timeline_lua: true,
          follow_lua: true,
          unfollow_lua: true,
          hashtaglike_lua: true,
          activelike_lua: true,
          max_daily_actions: 10000
        } : {}),
        // AutoTouchスクリプト用の機能フラグ（プラン別制限適用）
        script_access: scriptAccess,
        // プラン制限情報（AutoTouch main.luaで使用）
        plan_restrictions: {
          name: planInfo?.plan_name || (device.status === 'trial' ? 'trial' : 'unregistered'),
          display_name: planInfo?.plan_display_name || (device.status === 'trial' ? 'TRIAL' : 'UNREGISTERED'),
          max_daily_actions: planInfo?.plan_features?.max_daily_actions || (device.status === 'trial' ? 10000 : 0),
          available_scripts: Object.keys(scriptAccess).filter(key => scriptAccess[key as keyof typeof scriptAccess]).map(key => key.replace('_lua', '')),
          upgrade_required_for: Object.keys(scriptAccess).filter(key => !scriptAccess[key as keyof typeof scriptAccess]).map(key => key.replace('_lua', ''))
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
          error: error instanceof Error ? error.message : 'Failed to queue generation'
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
        status_description: 'デバイス未登録 - まずデバイスを登録してください',
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
    const { device_hash, email, user_id, password } = body;

    // Validate required fields - accept either user_id or password+email for registration
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

    let final_user_id = user_id;

    // If no user_id provided but password is, create/get user
    if (!user_id && password) {
      const supabase = getSupabaseClient(env);

      // Try to create user or get existing user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: email,
        password: password
      });

      if (authError && authError.message.includes('already registered')) {
        // User exists, try to sign in
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
          email: email,
          password: password
        });

        if (signInError || !signInData.user) {
          return new Response(
            JSON.stringify({
              success: false,
              error: 'Failed to authenticate user: ' + (signInError?.message || 'Unknown error')
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
        final_user_id = signInData.user.id;
      } else if (authError) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Failed to create user: ' + authError.message
          }),
          {
            status: 400,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*'
            }
          }
        );
      } else {
        final_user_id = authData.user?.id;
      }

      if (!final_user_id) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Failed to obtain user ID'
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

    if (!final_user_id) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'User ID or password is required for registration'
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
      .eq('user_id', final_user_id)
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

    // Normalize device hash for consistent storage (uppercase)
    const normalizedDeviceHash = device_hash.toUpperCase();

    // Register device with registered status (free registration)
    console.log('Attempting device registration with:', {
      user_id: final_user_id,
      device_hash: device_hash,
      normalized_device_hash: normalizedDeviceHash,
      email: email
    });

    const { data: deviceData, error: deviceError } = await supabase.rpc('register_device_with_setup', {
      p_user_id: final_user_id,
      p_device_hash: normalizedDeviceHash,
      p_email: email
    });

    if (deviceError) {
      console.error('Device registration RPC error:', deviceError);
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

    console.log('Device registration successful:', deviceData);

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

    // Get user from Authorization header
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (!token) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Authorization token required'
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

    // Verify user with token
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Invalid or expired token'
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

    // Verify email matches the authenticated user
    if (user.email !== email) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Email does not match authenticated user'
        }),
        {
          status: 403,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        }
      );
    }

    // Find device by device_hash and user_id
    const { data: oldDevice, error: oldDeviceError } = await supabase
      .from('devices')
      .select('*')
      .eq('device_hash', old_device_hash)
      .eq('user_id', user.id)
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
      .eq('user_id', user.id)
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

      console.log('PayPal webhook received:', body.event_type, body.id);

      // Handle subscription creation/activation
      if (body.event_type === 'BILLING.SUBSCRIPTION.CREATED' ||
          body.event_type === 'BILLING.SUBSCRIPTION.ACTIVATED') {
        const resource = body.resource;
        const subscriptionId = resource.id;
        const customId = resource.custom_id; // device_id
        const planId = resource.plan_id; // PayPal plan ID

        console.log('Processing subscription activation:', {
          subscriptionId,
          customId,
          planId
        });

        // Map PayPal plan ID to our internal plan names
        let internalPlanName = 'starter'; // default fallback

        // Extract plan name from custom_id if it contains plan info
        // Expected format: "device_id:plan_name" or just "device_id"
        const [deviceId, planName] = customId?.split(':') || [customId, 'starter'];

        if (planName && ['starter', 'pro', 'max'].includes(planName)) {
          internalPlanName = planName;
        } else {
          // Fallback: determine plan based on PayPal plan ID or amount
          const billingCycles = resource.billing_info?.cycle_executions || [];
          const regularCycle = billingCycles.find((cycle: any) => cycle.tenure_type === 'REGULAR');
          const amount = regularCycle?.pricing_scheme?.fixed_price?.value;

          if (amount) {
            const price = parseInt(amount);
            if (price >= 15000) internalPlanName = 'max';
            else if (price >= 8800) internalPlanName = 'pro';
            else internalPlanName = 'starter';
          }
        }

        console.log('Determined internal plan name:', internalPlanName);

        // Create or update subscription with plan information
        const { data: subscriptionData, error: subError } = await supabase
          .from('subscriptions')
          .upsert({
            device_id: deviceId,
            paypal_subscription_id: subscriptionId,
            plan_id: internalPlanName,
            status: 'active',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'device_id,paypal_subscription_id'
          });

        if (subError) {
          console.error('Failed to create/update subscription:', subError);
        } else {
          console.log('Subscription created/updated successfully');

          // Update device status to active
          await supabase
            .from('devices')
            .update({
              status: 'active',
              updated_at: new Date().toISOString()
            })
            .eq('id', deviceId);
        }
      }

      // Handle subscription cancellation/suspension
      if (body.event_type === 'BILLING.SUBSCRIPTION.CANCELLED' ||
          body.event_type === 'BILLING.SUBSCRIPTION.SUSPENDED') {
        const resource = body.resource;
        const subscriptionId = resource.id;

        console.log('Processing subscription cancellation/suspension:', subscriptionId);

        // Update subscription status
        const { error: updateError } = await supabase
          .from('subscriptions')
          .update({
            status: 'cancelled',
            updated_at: new Date().toISOString()
          })
          .eq('paypal_subscription_id', subscriptionId);

        if (!updateError) {
          // Update device status to expired
          const { data: subscription } = await supabase
            .from('subscriptions')
            .select('device_id')
            .eq('paypal_subscription_id', subscriptionId)
            .single();

          if (subscription) {
            await supabase
              .from('devices')
              .update({
                status: 'expired',
                updated_at: new Date().toISOString()
              })
              .eq('id', subscription.device_id);
          }
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
      console.error('PayPal webhook processing error:', error);
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

// Handle saving authentication result from WebView (for AutoTouch mobile auth)
async function handleSaveAuthResult(request: Request, env: any) {
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Allow-Headers': 'Content-Type'
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
    console.log('Saving auth result:', body);

    // In a real implementation, you would save to a database or temporary storage
    // For this POC, we'll return success

    // Note: In a production environment, you might want to:
    // 1. Store the result in a temporary cache (Redis, etc.)
    // 2. Use a file system that's accessible to both web and AutoTouch
    // 3. Use a message queue system

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Authentication result saved successfully'
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
    console.error('Save auth result error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Failed to save authentication result'
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

// Get user email by device hash handler
async function handleGetUserEmailByDevice(request: Request, env: any) {
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

  if (request.method !== 'GET' && request.method !== 'POST') {
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

    const supabase = getSupabaseClient(env);

    // Query to get user email associated with the device hash
    const { data: deviceData, error: deviceError } = await supabase
      .from('devices')
      .select(`
        id,
        device_hash,
        user_id,
        status,
        trial_ends_at,
        users!inner (
          id,
          email,
          created_at
        )
      `)
      .eq('device_hash', device_hash)
      .maybeSingle();

    if (deviceError) {
      console.error('Database error:', deviceError);
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Database query failed'
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

    if (!deviceData) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Device not found',
          device_hash: device_hash
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

    // Return user email and device information
    const userData = deviceData.users as any;
    return new Response(
      JSON.stringify({
        success: true,
        device_hash: deviceData.device_hash,
        user_id: deviceData.user_id,
        user_email: userData.email,
        device_status: deviceData.status,
        trial_ends_at: deviceData.trial_ends_at,
        user_created_at: userData.created_at
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
    console.error('Get user email error:', error);
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

// 管理者専用: ユーザーパッケージアップロードAPI
interface UploadPackageRequest {
  user_id: string
  device_hash: string
  file_name: string
  file_content: string // base64エンコード済み
  file_size: number
  notes?: string
}

async function handleAdminUploadPackageInternal(request: Request, env?: any): Promise<Response> {
  console.log('handleAdminUploadPackageInternal called');

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
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }

  try {
    const uploadData: UploadPackageRequest = await request.json()
    console.log('Upload data received:', { user_id: uploadData.user_id, device_hash: uploadData.device_hash, file_name: uploadData.file_name });

    if (!uploadData.user_id || !uploadData.device_hash || !uploadData.file_content) {
      return new Response(JSON.stringify({
        error: '必須フィールドが不足しています'
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      })
    }

    const supabase = getSupabaseClient(env);

    // ユーザーが存在するか確認
    const { data: userData, error: userError } = await supabase.auth.admin.getUserById(uploadData.user_id)
    if (userError || !userData.user) {
      console.error('User not found:', userError);
      return new Response(JSON.stringify({ error: 'ユーザーが見つかりません' }), {
        status: 404,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      })
    }

    // 既存のパッケージを無効化（新しいバージョンのため）
    await supabase
      .from('user_packages')
      .update({ is_active: false })
      .eq('user_id', uploadData.user_id)
      .eq('device_hash', uploadData.device_hash)

    // 新しいパッケージを保存
    const { data: packageData, error: packageError } = await supabase
      .from('user_packages')
      .insert({
        user_id: uploadData.user_id,
        device_hash: uploadData.device_hash,
        file_name: uploadData.file_name,
        file_content: uploadData.file_content,
        file_size: uploadData.file_size,
        uploaded_by: 'admin',
        notes: uploadData.notes || '管理者によりアップロード',
        version: generateVersionString(),
        is_active: true
      })
      .select()
      .single()

    if (packageError) {
      console.error('Package insert error:', packageError)
      return new Response(JSON.stringify({
        error: 'パッケージの保存に失敗しました',
        details: packageError.message
      }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      })
    }

    // 成功レスポンス
    return new Response(JSON.stringify({
      success: true,
      message: 'パッケージをアップロードしました',
      package_id: packageData.id,
      version: packageData.version,
      user_email: userData.user.email
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    })

  } catch (error: any) {
    console.error('Upload package error:', error)
    return new Response(JSON.stringify({
      error: 'アップロードに失敗しました',
      details: error.message
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    })
  }
}

function generateVersionString(): string {
  const now = new Date()
  return `${now.getFullYear()}.${(now.getMonth() + 1).toString().padStart(2, '0')}.${now.getDate().toString().padStart(2, '0')}.${now.getHours().toString().padStart(2, '0')}${now.getMinutes().toString().padStart(2, '0')}`
}

// .ate File Generation API Handlers

// Immediate .ate file generation (bypasses queue for instant completion)
async function handleAteGenerateImmediate(request: Request, env: any) {
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
    const { device_hash, template_name = 'smartgram' } = body;

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

    const supabase = getSupabaseClient(env);

    // Get device info
    const { data: devices, error: deviceError } = await supabase
      .from('devices')
      .select('id, user_id')
      .eq('device_hash', device_hash.toUpperCase())
      .limit(1);

    if (deviceError || !devices || devices.length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          error: `Device not found: ${device_hash}`
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

    const device = devices[0];

    // Get existing template (or use default)
    let templateId;
    const { data: templates } = await supabase
      .from('ate_templates')
      .select('id')
      .eq('name', 'smartgram')
      .limit(1);

    if (!templates || templates.length === 0) {
      // Create default template
      const { data: newTemplate, error: createError } = await supabase
        .from('ate_templates')
        .insert({
          name: 'smartgram',
          version: '1.0.0',
          description: 'SMARTGRAM automation template',
          template_path: 'templates/smartgram.at/',
          file_structure: ['main.lua', 'timeline.lua', 'follow.lua'],
          required_variables: ['device_hash', 'plan_name']
        })
        .select('id')
        .single();

      if (createError) {
        throw new Error(`Failed to create template: ${createError.message}`);
      }
      templateId = newTemplate.id;
    } else {
      templateId = templates[0].id;
    }

    // Get starter plan
    let planId;
    const { data: plans } = await supabase
      .from('plans')
      .select('id')
      .eq('name', 'starter')
      .limit(1);

    if (!plans || plans.length === 0) {
      throw new Error('Starter plan not found');
    }
    planId = plans[0].id;

    // Get user's plan information for script access control
    const { data: devicePlan } = await supabase
      .from('device_plan_view')
      .select('plan_name, plan_features')
      .eq('device_hash', device_hash.toUpperCase())
      .single();

    const planFeatures = devicePlan?.plan_features || {
      timeline_lua: true,
      follow_lua: false,
      unfollow_lua: false,
      hashtaglike_lua: false,
      activelike_lua: false
    };

    // Create real .ate file content with plan-based scripts
    const ateContent = await generateRealAteFile(device_hash, planFeatures);
    const fileName = `smartgram_${device_hash}_${Date.now()}.ate`;
    const filePath = `generated/${device_hash}/${fileName}`;

    const { data: fileRecord, error: fileError } = await supabase
      .from('ate_files')
      .insert({
        device_id: device.id,
        template_id: templateId,
        plan_id: planId,
        filename: fileName,
        file_path: filePath,
        file_size_bytes: ateContent.content.length,
        checksum: 'test-' + Date.now(),
        encryption_key_hash: 'test-key-' + Date.now(),
        encryption_algorithm: 'AES-256-GCM',
        generated_variables: {
          device_hash: device_hash,
          plan_name: devicePlan?.plan_name || 'starter',
          template_name: 'smartgram',
          generated_at: new Date().toISOString(),
          version: '1.0.0',
          included_scripts: ateContent.includedScripts,
          plan_features: planFeatures
        },
        generation_status: 'success',
        is_active: true,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      })
      .select('id')
      .single();

    if (fileError) {
      throw new Error(`Failed to create file: ${fileError.message}`);
    }

    console.log('✅ Immediate generation completed:', fileRecord.id);

    return new Response(
      JSON.stringify({
        success: true,
        message: '.ate file generated successfully',
        ate_file_id: fileRecord.id,
        device_hash: device_hash,
        filename: fileName,
        download_url: `/api/ate/download/${fileRecord.id}`,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        estimated_time: 'Completed immediately'
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
    console.error('Detailed error in immediate generation:', error);

    const errorDetails = error instanceof Error ? {
      message: error.message,
      stack: error.stack?.split('\n').slice(0, 5).join('\n'), // First 5 lines of stack
      name: error.name
    } : { message: String(error) };

    return new Response(
      JSON.stringify({
        success: false,
        error: 'Failed to generate .ate file immediately',
        details: errorDetails,
        timestamp: new Date().toISOString()
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

// Generate real AutoTouch .ate file content with plan-based scripts (simplified version)
async function generateRealAteFile(deviceHash: string, planFeatures: any): Promise<{ content: string; includedScripts: string[] }> {
  const includedScripts: string[] = [];

  // Build menu options based on plan features
  let menuOptions = '';
  let menuHandlers = '';
  let optionIndex = 1;

  if (planFeatures.timeline_lua) {
    menuOptions += `    if script_access.timeline_lua then table.insert(available_tools, "Timeline Auto Like") end\n`;
    menuHandlers += `    ${optionIndex === 1 ? 'if' : 'elseif'} choice == ${optionIndex} and script_access.timeline_lua then\n        runTimelineScript()\n`;
    optionIndex++;
  }

  if (planFeatures.follow_lua) {
    menuOptions += `    if script_access.follow_lua then table.insert(available_tools, "Auto Follow") end\n`;
    menuHandlers += `    ${optionIndex === 1 ? 'if' : 'elseif'} choice == ${optionIndex} and script_access.follow_lua then\n        runFollowScript()\n`;
    optionIndex++;
  }

  if (planFeatures.unfollow_lua) {
    menuOptions += `    if script_access.unfollow_lua then table.insert(available_tools, "Auto Unfollow") end\n`;
    menuHandlers += `    ${optionIndex === 1 ? 'if' : 'elseif'} choice == ${optionIndex} and script_access.unfollow_lua then\n        runUnfollowScript()\n`;
    optionIndex++;
  }

  if (planFeatures.hashtaglike_lua) {
    menuOptions += `    if script_access.hashtaglike_lua then table.insert(available_tools, "Hashtag Like") end\n`;
    menuHandlers += `    ${optionIndex === 1 ? 'if' : 'elseif'} choice == ${optionIndex} and script_access.hashtaglike_lua then\n        runHashtagLikeScript()\n`;
    optionIndex++;
  }

  if (planFeatures.activelike_lua) {
    menuOptions += `    if script_access.activelike_lua then table.insert(available_tools, "Active Like") end\n`;
    menuHandlers += `    ${optionIndex === 1 ? 'if' : 'elseif'} choice == ${optionIndex} and script_access.activelike_lua then\n        runActiveLikeScript()\n`;
    optionIndex++;
  }

  // Main script (always included)
  const mainLua = `-- SMARTGRAM AutoTouch Main Script
-- Generated for device: ${deviceHash}
-- Plan: ${JSON.stringify(planFeatures)}
-- Generated: ${new Date().toISOString()}

toast("SMARTGRAM v1.0 - ${deviceHash}", 3);

-- License verification
local device_hash = "${deviceHash}"
local license_info = nil

function checkLicense()
    local http = require("http")
    local url = "https://smartgram.jp/api/license/verify"
    local data = '{"device_hash":"' .. device_hash .. '"}'

    local response = http.post(url, data, {["Content-Type"] = "application/json"})
    if response and response.statusCode == 200 then
        license_info = json.decode(response.body)
        if license_info.is_valid then
            toast("認証成功: " .. license_info.license_type, 2)
            return true
        else
            toast("ライセンス無効", 3)
            return false
        end
    else
        toast("認証失敗", 3)
        return false
    end
end

-- Main menu
function showMainMenu()
    if not checkLicense() then
        return
    end

    local script_access = license_info.script_access or {}
    local available_tools = {}

${menuOptions}
    table.insert(available_tools, "Exit")

    local choice = alert("SMARTGRAM", "機能を選択:", 0, unpack(available_tools))

${menuHandlers}    end
end

showMainMenu()
`;
  includedScripts.push('main.lua');

  // Timeline script (STARTER and above)
  let timelineLua = '';
  if (planFeatures.timeline_lua) {
    timelineLua = `-- Timeline Auto Like Script
function runTimelineScript()
    toast("Timeline自動いいね開始", 2)
    activateApplication("com.burbn.instagram")
    usleep(2000000)

    local like_count = 0
    for i = 1, 20 do
        -- Double tap like
        touchDown(0, 400, 600)
        usleep(50000)
        touchUp(0, 400, 600)
        usleep(100000)
        touchDown(0, 400, 600)
        usleep(50000)
        touchUp(0, 400, 600)
        usleep(1000000)

        -- Scroll
        touchDown(0, 400, 700)
        usleep(100000)
        touchMove(0, 400, 300)
        touchUp(0, 400, 300)
        usleep(2000000)

        like_count = like_count + 1
        if i % 5 == 0 then toast("いいね: " .. like_count, 1) end
    end
    toast("完了: " .. like_count .. "件", 3)
end
`;
    includedScripts.push('timeline.lua');
  }

  // Other scripts (simplified versions)
  let followLua = '';
  if (planFeatures.follow_lua) {
    followLua = `function runFollowScript()
    toast("自動フォロー開始", 2)
    activateApplication("com.burbn.instagram")
    usleep(2000000)
    toast("フォロー機能実行中", 2)
end`;
    includedScripts.push('follow.lua');
  }

  let unfollowLua = '';
  if (planFeatures.unfollow_lua) {
    unfollowLua = `function runUnfollowScript()
    toast("自動アンフォロー開始", 2)
    activateApplication("com.burbn.instagram")
    usleep(2000000)
    toast("アンフォロー機能実行中", 2)
end`;
    includedScripts.push('unfollow.lua');
  }

  let hashtagLikeLua = '';
  if (planFeatures.hashtaglike_lua) {
    hashtagLikeLua = `function runHashtagLikeScript()
    toast("ハッシュタグいいね開始", 2)
    activateApplication("com.burbn.instagram")
    usleep(2000000)
    toast("ハッシュタグ機能実行中", 2)
end`;
    includedScripts.push('hashtaglike.lua');
  }

  let activeLikeLua = '';
  if (planFeatures.activelike_lua) {
    activeLikeLua = `function runActiveLikeScript()
    toast("アクティブいいね開始", 2)
    activateApplication("com.burbn.instagram")
    usleep(2000000)
    toast("アクティブ機能実行中", 2)
end`;
    includedScripts.push('activelike.lua');
  }

  // Create .ate file structure (JSON format representing ZIP contents)
  const ateStructure = {
    format: "SMARTGRAM_ATE_v1.0",
    device_hash: deviceHash,
    generated_at: new Date().toISOString(),
    plan_features: planFeatures,
    files: {
      "main.lua": mainLua,
      ...(timelineLua && { "timeline.lua": timelineLua }),
      ...(followLua && { "follow.lua": followLua }),
      ...(unfollowLua && { "unfollow.lua": unfollowLua }),
      ...(hashtagLikeLua && { "hashtaglike.lua": hashtagLikeLua }),
      ...(activeLikeLua && { "activelike.lua": activeLikeLua }),
      "config.json": JSON.stringify({
        device_hash: deviceHash,
        version: "1.0.0",
        plan_features: planFeatures,
        included_scripts: includedScripts,
        generated_at: new Date().toISOString()
      }, null, 2)
    }
  };

  // Convert to base64 for storage
  const content = Buffer.from(JSON.stringify(ateStructure, null, 2)).toString('base64');

  return {
    content,
    includedScripts
  };
}

// Queue .ate file generation (original async method)
async function handleAteGenerate(request: Request, env: any) {
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
    const { device_hash, template_name = 'smartgram', priority = 5 } = body;

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

    const supabase = getSupabaseClient(env);

    // First, find the device to get device_id
    const { data: devices, error: deviceError } = await supabase
      .from('devices')
      .select('id, user_id')
      .eq('device_hash', device_hash.toUpperCase())
      .limit(1);

    if (deviceError) {
      console.error('Error finding device:', deviceError);
      return new Response(
        JSON.stringify({
          success: false,
          error: `Device lookup failed: ${deviceError.message}`
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

    if (!devices || devices.length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          error: `Device not found: ${device_hash}`
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

    const device = devices[0];

    // Get or create a valid template_id from ate_templates table
    let templateId;
    const { data: templates, error: templateError } = await supabase
      .from('ate_templates')
      .select('id')
      .eq('name', 'smartgram')
      .limit(1);

    if (templateError || !templates || templates.length === 0) {
      // Create a default template if it doesn't exist
      const { data: newTemplate, error: createError } = await supabase
        .from('ate_templates')
        .insert({
          name: 'smartgram',
          display_name: 'SMARTGRAM Default',
          description: 'Default template for SMARTGRAM automation',
          config: {},
          is_active: true
        })
        .select('id')
        .single();

      if (createError || !newTemplate) {
        console.error('Failed to create template:', createError);
        return new Response(
          JSON.stringify({
            success: false,
            error: `Failed to create template: ${createError?.message || 'Unknown error'}`
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
      templateId = newTemplate.id;
    } else {
      templateId = templates[0].id;
    }

    // Try to get ANY existing plan_id from plans table
    let planId;
    console.log('Looking for existing plans...');

    const { data: plans, error: planError } = await supabase
      .from('plans')
      .select('id')
      .limit(1);

    console.log('Plans query result:', { plans, planError });

    if (planError) {
      console.error('Plans table query failed:', planError);
      // Plans table might not exist - return error instead of random UUID
      return new Response(
        JSON.stringify({
          success: false,
          error: `Plans table access failed: ${planError.message}`,
          debug: {
            planError: planError,
            suggestion: 'Plans table may not exist or access is restricted'
          }
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

    if (!plans || plans.length === 0) {
      // No plans exist, try to create one
      console.log('No plans found, attempting to create default plan...');
      const { data: newPlan, error: createPlanError } = await supabase
        .from('plans')
        .insert({
          name: 'basic',
          display_name: 'Basic Plan',
          price: 2980,
          billing_cycle: 'monthly',
          features: {},
          limitations: {},
          is_active: true
        })
        .select('id')
        .single();

      console.log('Plan creation result:', { newPlan, createPlanError });

      if (createPlanError || !newPlan) {
        console.error('Failed to create plan:', createPlanError);
        return new Response(
          JSON.stringify({
            success: false,
            error: `Failed to create default plan: ${createPlanError?.message || 'Unknown error'}`,
            debug: {
              createPlanError,
              suggestion: 'Plan creation failed - check table schema and permissions'
            }
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
      planId = newPlan.id;
    } else {
      planId = plans[0].id;
      console.log('Using existing plan_id:', planId);
    }

    // Insert directly into file_generation_queue
    const insertData = {
      device_id: device.id,
      template_id: templateId,
      plan_id: planId,
      priority: priority,
      status: 'queued'
    };

    console.log('Attempting to insert queue entry with data:', insertData);
    console.log('Device info:', device);

    let queueId, error;

    try {
      // Try basic insert without template fields
      const result = await supabase
        .from('file_generation_queue')
        .insert(insertData)
        .select('id')
        .single();

      console.log('Insert result:', result);
      queueId = result.data?.id;
      error = result.error;

      if (error) {
        console.error('Supabase error details:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        });
      }
    } catch (insertError) {
      console.error('Insert exception:', insertError);
      console.error('Exception details:', {
        name: insertError instanceof Error ? insertError.name : 'Unknown',
        message: insertError instanceof Error ? insertError.message : String(insertError),
        stack: insertError instanceof Error ? insertError.stack : 'No stack'
      });
      error = insertError;
    }

    if (error) {
      console.error('Final error queuing .ate generation:', error);

      // Return detailed error information for debugging
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorDetails = error && typeof error === 'object' ?
        JSON.stringify(error, Object.getOwnPropertyNames(error)) : 'No details';

      return new Response(
        JSON.stringify({
          success: false,
          error: `Failed to queue generation: ${errorMessage}`,
          debug: {
            errorDetails,
            insertData,
            deviceId: device.id
          }
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
        message: '.ate file generation queued',
        queue_id: queueId,
        device_hash: device_hash,
        template: 'smartgram',
        estimated_time: '2-5 minutes'
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
    console.error('Error in handleAteGenerate:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Failed to queue .ate file generation'
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

// Download .ate file
async function handleAteDownload(request: Request, env: any, ateFileId: string) {
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
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
    if (!ateFileId) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'File ID is required'
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

    // Get file info
    const { data: fileData, error: fileError } = await supabase
      .from('ate_files')
      .select('*')
      .eq('id', ateFileId)
      .eq('is_active', true)
      .single();

    if (fileError || !fileData) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'File not found or expired'
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

    // Check if file is ready
    if (fileData.generation_status !== 'success') {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'File is not ready yet',
          status: fileData.generation_status
        }),
        {
          status: 202,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        }
      );
    }

    // Check expiration
    if (fileData.expires_at && new Date(fileData.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'File has expired'
        }),
        {
          status: 410,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        }
      );
    }

    // Get client IP and user agent for logging
    const clientIP = request.headers.get('cf-connecting-ip') ||
                    request.headers.get('x-forwarded-for') ||
                    'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    // Download file from Supabase Storage
    const { data: fileBlob, error: storageError } = await supabase.storage
      .from('ate-files')
      .download(fileData.file_path);

    if (storageError || !fileBlob) {
      console.error('Storage error:', storageError);
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Failed to retrieve file'
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

    // Log download event
    await supabase.rpc('log_download', {
      ate_file_id_param: ateFileId,
      download_ip_param: clientIP,
      user_agent_param: userAgent,
      bytes_downloaded_param: fileBlob.size
    });

    // Return file for download
    return new Response(fileBlob, {
      status: 200,
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${fileData.filename}"`,
        'Content-Length': fileBlob.size.toString(),
        'Access-Control-Allow-Origin': '*'
      }
    });

  } catch (error) {
    console.error('Error in handleAteDownload:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Download failed'
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

