// Cloudflare Functions version of license verification API
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

// Cache for license verification (using Cloudflare KV would be better for production)
const licenseCache = new Map()
const CACHE_DURATION = 24 * 60 * 60 * 1000 // 24 hours

exports.onRequestPost = async function(context) {
  const { request, env } = context
  const startTime = Date.now()
  let body = {}
  let device_hash = ''

  try {
    // Parse request body
    const text = await request.text()
    if (!text || text.trim() === '') {
      return new Response(
        JSON.stringify({ success: false, error: 'Empty request body' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      )
    }

    body = JSON.parse(text)
    device_hash = body?.device_hash || ''

    // Validate input
    if (!device_hash) {
      return new Response(
        JSON.stringify({ success: false, error: 'Device hash is required' }),
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

    // Check cache first
    const cached = licenseCache.get(device_hash)
    if (cached && (Date.now() - cached.cached_at) < CACHE_DURATION) {
      return new Response(
        JSON.stringify({
          success: true,
          is_valid: cached.is_valid,
          expires_at: cached.expires_at,
          cached: true
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        }
      )
    }

    // Get Supabase client
    const supabase = getSupabaseClient(env)

    // Call database function to verify license
    const { data: result, error: dbError } = await supabase
      .rpc('verify_license', {
        p_device_hash: device_hash
      })

    if (dbError) {
      console.error('Database error:', dbError)
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to verify license' }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        }
      )
    }

    if (!result?.success) {
      return new Response(
        JSON.stringify({
          success: false,
          error: result?.error || 'Device not found',
          is_valid: false
        }),
        {
          status: result?.error === 'Device not found' ? 404 : 400,
          headers: { 'Content-Type': 'application/json' }
        }
      )
    }

    // Update cache
    licenseCache.set(device_hash, {
      is_valid: result.is_valid,
      expires_at: result.expires_at,
      cached_at: Date.now()
    })

    return new Response(
      JSON.stringify({
        success: true,
        is_valid: result.is_valid,
        status: result.status,
        expires_at: result.expires_at,
        cached: false
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Verification error:', error)

    let errorMessage = 'Internal server error'
    let statusCode = 500

    if (error instanceof SyntaxError) {
      errorMessage = 'Invalid JSON in request body'
      statusCode = 400
    }

    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      {
        status: statusCode,
        headers: { 'Content-Type': 'application/json' }
      }
    )
  }
}

// GET method for health check
exports.onRequestGet = async function(context) {
  return new Response(
    JSON.stringify({
      success: true,
      message: 'License verification endpoint is running',
      cache_size: licenseCache.size
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    }
  )
}

// OPTIONS method for CORS
exports.onRequestOptions = async function(context) {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    }
  })
}