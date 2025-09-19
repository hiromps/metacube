import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/client'
import { isValidDeviceHash } from '@/lib/utils/crypto'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { device_hash, email, password } = body

    // Validate input
    if (!device_hash || !email || !password) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
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

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { success: false, error: 'Invalid email format' },
        { status: 400 }
      )
    }

    // Check if device already exists
    const { data: existingDevice } = await supabaseAdmin
      .from('devices')
      .select('id')
      .eq('device_hash', device_hash)
      .single()

    if (existingDevice) {
      return NextResponse.json(
        { success: false, error: 'Device already registered' },
        { status: 409 }
      )
    }

    // Create user account
    const { data: authUser, error: authError } = await supabaseAdmin.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard`,
        data: {
          device_hash
        }
      }
    })

    if (authError || !authUser.user) {
      console.error('Auth error:', authError)
      return NextResponse.json(
        { success: false, error: authError?.message || 'Failed to create user account' },
        { status: 400 }
      )
    }

    // Call database function to create device and license
    const { data: result, error: dbError } = await supabaseAdmin
      .rpc('create_device_and_license', {
        p_user_id: authUser.user.id,
        p_device_hash: device_hash,
        p_email: email
      })

    if (dbError || !result?.success) {
      console.error('Database error:', dbError)
      // Rollback user creation if device creation fails
      if (authUser.user) {
        await supabaseAdmin.auth.admin.deleteUser(authUser.user.id)
      }
      return NextResponse.json(
        { success: false, error: result?.error || 'Failed to register device' },
        { status: 500 }
      )
    }

    // Log successful registration
    await supabaseAdmin
      .from('api_logs')
      .insert({
        device_hash,
        endpoint: '/api/device/register',
        method: 'POST',
        status_code: 200,
        ip_address: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip')
      })

    return NextResponse.json({
      success: true,
      message: 'Device registered successfully',
      data: {
        device_id: result.device_id,
        license_id: result.license_id,
        trial_ends_at: result.trial_ends_at,
        user_id: authUser.user.id
      }
    })

  } catch (error) {
    console.error('Registration error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// OPTIONS method for CORS
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, { status: 200 })
}