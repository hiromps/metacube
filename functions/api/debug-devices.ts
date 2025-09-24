// Debug utility to check devices in database
import { createClient } from '@supabase/supabase-js'

// Initialize Supabase client
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

// Debug function to list devices
export async function debugDevices(env: any): Promise<any> {
  try {
    console.log('🔍 Debugging devices in database...')
    const supabase = getSupabaseClient(env)

    // List all devices
    const { data: devices, error: devicesError } = await supabase
      .from('devices')
      .select('device_hash, status, created_at, trial_ends_at')
      .limit(10)

    if (devicesError) {
      throw new Error(`Failed to get devices: ${devicesError.message}`)
    }

    console.log(`📱 Found ${devices?.length || 0} devices`)

    // Test the specific device hash
    const testHash = 'FFMZ3GTSJC6J'
    console.log(`🔍 Checking specific device: ${testHash}`)

    const { data: specificDevice, error: specificError } = await supabase
      .from('devices')
      .select('*')
      .eq('device_hash', testHash)
      .single()

    if (specificError) {
      console.error(`❌ Error finding device ${testHash}:`, specificError.message)
    }

    // Test the RPC function
    console.log(`🔍 Testing get_download_info RPC for: ${testHash}`)
    const { data: rpcResult, error: rpcError } = await supabase.rpc('get_download_info', {
      device_hash_param: testHash
    })

    if (rpcError) {
      console.error(`❌ RPC error:`, rpcError.message)
    }

    // Check device_plan_view
    console.log(`🔍 Checking device_plan_view for: ${testHash}`)
    const { data: planView, error: planError } = await supabase
      .from('device_plan_view')
      .select('*')
      .eq('device_hash', testHash)

    if (planError) {
      console.error(`❌ Plan view error:`, planError.message)
    }

    return {
      success: true,
      message: 'Device debugging completed',
      allDevices: devices?.map(d => ({
        device_hash: d.device_hash,
        status: d.status,
        created_at: d.created_at
      })) || [],
      specificDevice: specificDevice || null,
      specificDeviceError: specificError?.message || null,
      rpcResult: rpcResult || null,
      rpcError: rpcError?.message || null,
      planView: planView || null,
      planError: planError?.message || null
    }

  } catch (error) {
    console.error('❌ Debug error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }
  }
}