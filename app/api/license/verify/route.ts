import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/client'
import { isValidDeviceHash } from '@/lib/utils/crypto'

// Cache for license verification (in-memory for MVP)
const licenseCache = new Map<string, {
  is_valid: boolean
  expires_at: string | null
  cached_at: number
}>()

// Cache duration in milliseconds (24 hours)
const CACHE_DURATION = 24 * 60 * 60 * 1000

export async function POST(request: NextRequest) {
  const startTime = Date.now()
  let body: any = {}
  let device_hash: string = ''

  try {
    // More robust JSON parsing for Cloudflare Pages
    const text = await request.text()
    if (!text || text.trim() === '') {
      throw new Error('Empty request body')
    }

    body = JSON.parse(text)
    device_hash = body?.device_hash || ''

    // Validate input
    if (!device_hash) {
      return NextResponse.json(
        { success: false, error: 'Device hash is required' },
        { status: 400 }
      )
    }

    // Validate device hash format
    if (!isValidDeviceHash(device_hash)) {
      return NextResponse.json(
        { success: false, error: 'Invalid device hash format' },
        { status: 400 }
      )
    }

    // Check cache first
    const cached = licenseCache.get(device_hash)
    if (cached && (Date.now() - cached.cached_at) < CACHE_DURATION) {
      // Log cached response
      await supabaseAdmin
        .from('api_logs')
        .insert({
          device_hash,
          endpoint: '/api/license/verify',
          method: 'POST',
          status_code: 200,
          response_time_ms: Date.now() - startTime,
          ip_address: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip')
        })

      return NextResponse.json({
        success: true,
        is_valid: cached.is_valid,
        expires_at: cached.expires_at,
        cached: true
      })
    }

    // Call database function to verify license
    const { data: result, error: dbError } = await supabaseAdmin
      .rpc('verify_license', {
        p_device_hash: device_hash
      })

    if (dbError) {
      console.error('Database error:', dbError)
      return NextResponse.json(
        { success: false, error: 'Failed to verify license' },
        { status: 500 }
      )
    }

    if (!result?.success) {
      return NextResponse.json(
        {
          success: false,
          error: result?.error || 'Device not found',
          is_valid: false
        },
        { status: result?.error === 'Device not found' ? 404 : 400 }
      )
    }

    // Update cache
    licenseCache.set(device_hash, {
      is_valid: result.is_valid,
      expires_at: result.expires_at,
      cached_at: Date.now()
    })

    // Clean old cache entries (simple cleanup strategy)
    if (licenseCache.size > 1000) {
      const entriesToDelete: string[] = []
      const cutoffTime = Date.now() - CACHE_DURATION

      licenseCache.forEach((value, key) => {
        if (value.cached_at < cutoffTime) {
          entriesToDelete.push(key)
        }
      })

      entriesToDelete.forEach(key => licenseCache.delete(key))
    }

    return NextResponse.json({
      success: true,
      is_valid: result.is_valid,
      status: result.status,
      expires_at: result.expires_at,
      cached: false
    })

  } catch (error) {
    console.error('Verification error:', error)

    // Determine error type for better response
    let errorMessage = 'Internal server error'
    let statusCode = 500

    if (error instanceof SyntaxError) {
      errorMessage = 'Invalid JSON in request body'
      statusCode = 400
    } else if (error instanceof Error && error.message === 'Empty request body') {
      errorMessage = 'Request body is required'
      statusCode = 400
    }

    // Log error (with safe error handling for logging)
    try {
      await supabaseAdmin
        .from('api_logs')
        .insert({
          device_hash: device_hash || body?.device_hash || 'unknown',
          endpoint: '/api/license/verify',
          method: 'POST',
          status_code: statusCode,
          response_time_ms: Date.now() - startTime,
          ip_address: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
          error_message: error instanceof Error ? error.message : 'Unknown error'
        })
    } catch (logError) {
      console.error('Failed to log error:', logError)
    }

    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: statusCode }
    )
  }
}

// OPTIONS method for CORS
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    }
  })
}

// GET method for health check
export async function GET(request: NextRequest) {
  return NextResponse.json({
    success: true,
    message: 'License verification endpoint is running',
    cache_size: licenseCache.size
  })
}