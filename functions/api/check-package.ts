// ユーザーのパッケージ存在確認
import { createClient } from '@supabase/supabase-js'

export async function handleCheckPackage(request: Request, env?: any): Promise<Response> {
  try {
    // 認証ヘッダーチェック
    const authHeader = request.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: '認証が必要です' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const token = authHeader.replace('Bearer ', '')

    // Supabase初期化
    const supabaseUrl = env?.SUPABASE_URL || 'https://bsujceqmhvpltedjkvum.supabase.co'
    const supabaseServiceKey = env?.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJzdWpjZXFtaHZwbHRlZGprdnVtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNDcyNzUzOSwiZXhwIjoyMDUwMzAzNTM5fQ.bRjRIgfgNSC6fLfMGnEYNpON1rF_ygf2aHhx8r8fL90'
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // ユーザー認証
    const { data: { user }, error: userError } = await supabase.auth.getUser(token)
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'ユーザー認証に失敗しました' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // user_packagesテーブルでアクティブなパッケージを確認
    const { data: packageData, error: packageError } = await supabase
      .from('user_packages')
      .select('id, file_name, version, created_at, updated_at')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (packageError && packageError.code !== 'PGRST116') {
      console.error('Package check error:', packageError)
      return new Response(JSON.stringify({ error: 'パッケージ確認エラー' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    return new Response(JSON.stringify({
      hasPackage: !!packageData,
      package: packageData ? {
        fileName: packageData.file_name,
        version: packageData.version,
        uploadedAt: packageData.created_at,
        updatedAt: packageData.updated_at
      } : null
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error: any) {
    console.error('Check package error:', error)
    return new Response(JSON.stringify({
      error: 'パッケージ確認処理でエラーが発生しました',
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}