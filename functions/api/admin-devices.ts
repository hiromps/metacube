// Admin endpoint to get all devices (bypasses RLS)
import { createClient } from '@supabase/supabase-js'

export async function handleAdminDevices(request: Request, env?: any): Promise<Response> {
  try {
    // Get auth token
    const authHeader = request.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: '認証が必要です' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const token = authHeader.replace('Bearer ', '')

    // Initialize Supabase with service role key (bypasses RLS)
    const supabaseUrl = env?.NEXT_PUBLIC_SUPABASE_URL || 'https://bsujceqmhvpltedjkvum.supabase.co'
    const supabaseServiceKey = env?.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJzdWpjZXFtaHZwbHRlZGprdnVtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1ODI4NTUwNiwiZXhwIjoyMDczODYxNTA2fQ.24rZzpq0fO-TZyCrdsgqtLrQ6HzfLZf-adqyoO8i3pg'

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    // Verify the user is authenticated (but we'll use service role for data)
    const supabaseClient = createClient(supabaseUrl, env?.NEXT_PUBLIC_SUPABASE_ANON_KEY || '', {
      global: {
        headers: {
          Authorization: authHeader
        }
      },
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'ユーザー認証に失敗しました' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // TODO: Add admin check here
    // For now, allowing all authenticated users for testing

    // Get ALL devices using service role (bypasses RLS)
    const { data: devices, error: devicesError } = await supabaseAdmin
      .from('devices')
      .select('*')
      .order('created_at', { ascending: false })

    if (devicesError) {
      console.error('Admin devices query error:', devicesError)
      return new Response(JSON.stringify({
        error: 'デバイス取得エラー',
        details: devicesError.message
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Get all users for email mapping
    const { data: { users }, error: usersError } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 1000
    })

    if (usersError) {
      console.error('Admin users query error:', usersError)
    }

    // Create user email map
    const userEmailMap = new Map()
    if (users) {
      users.forEach(u => {
        userEmailMap.set(u.id, u.email)
      })
    }

    // Process devices with user email info
    const processedDevices = devices?.map(device => ({
      ...device,
      user_email: userEmailMap.get(device.user_id) || 'Unknown'
    })) || []

    return new Response(JSON.stringify({
      success: true,
      devices: processedDevices,
      total: processedDevices.length
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    })

  } catch (error: any) {
    console.error('Admin devices error:', error)
    return new Response(JSON.stringify({
      error: '管理者デバイス取得処理でエラーが発生しました',
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}