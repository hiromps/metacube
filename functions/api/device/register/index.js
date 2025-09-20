// Cloudflare Functions version of device registration API
const { createClient } = require('@supabase/supabase-js')

// Initialize Supabase client
function getSupabaseClient(env) {
  return createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY
  )
}

// Validate device hash format (16 characters, hex)
function isValidDeviceHash(hash) {
  return /^[a-fA-F0-9]{16}$/.test(hash)
}

exports.onRequestPost = async function(context) {
  const { request, env } = context
  let body = {}

  try {
    body = await request.json()
    const { device_hash, email, password } = body

    // Validate input
    if (!device_hash || !email || !password) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required fields' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      )
    }

    // Validate device hash format
    if (!isValidDeviceHash(device_hash)) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid device hash format' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      )
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid email format' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      )
    }

    // Get Supabase client
    const supabase = getSupabaseClient(env)

    // Check if device already exists
    const { data: existingDevice } = await supabase
      .from('devices')
      .select('id')
      .eq('device_hash', device_hash)
      .single()

    if (existingDevice) {
      return new Response(
        JSON.stringify({ success: false, error: 'Device already registered' }),
        {
          status: 409,
          headers: { 'Content-Type': 'application/json' }
        }
      )
    }

    // Create user account
    const { data: authUser, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${env.NEXT_PUBLIC_APP_URL}/dashboard`,
        data: {
          device_hash
        }
      }
    })

    if (authError || !authUser.user) {
      console.error('Auth error:', authError)
      return new Response(
        JSON.stringify({
          success: false,
          error: authError?.message || 'Failed to create user account'
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      )
    }

    // Call database function to create device and license
    const { data: result, error: dbError } = await supabase
      .rpc('create_device_and_license', {
        p_user_id: authUser.user.id,
        p_device_hash: device_hash,
        p_email: email
      })

    if (dbError || !result?.success) {
      console.error('Database error:', dbError)
      // Rollback user creation if device creation fails
      if (authUser.user) {
        await supabase.auth.admin.deleteUser(authUser.user.id)
      }
      return new Response(
        JSON.stringify({
          success: false,
          error: result?.error || 'Failed to register device'
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        }
      )
    }

    // Log successful registration
    await supabase
      .from('api_logs')
      .insert({
        device_hash,
        endpoint: '/api/device/register',
        method: 'POST',
        status_code: 200,
        ip_address: request.headers.get('cf-connecting-ip') ||
                   request.headers.get('x-forwarded-for') ||
                   'unknown'
      })

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Device registered successfully',
        data: {
          device_id: result.device_id,
          license_id: result.license_id,
          trial_ends_at: result.trial_ends_at,
          user_id: authUser.user.id
        }
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Registration error:', error)
    return new Response(
      JSON.stringify({ success: false, error: 'Internal server error' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    )
  }
}

// OPTIONS method for CORS
exports.onRequestOptions = async function(context) {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    }
  })
}