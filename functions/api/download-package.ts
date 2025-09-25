// 管理者アップロード専用ファイルダウンロードAPI
import { createClient } from '@supabase/supabase-js'

export async function handleDownloadPackage(request: Request, env?: any): Promise<Response> {
  try {
    console.log('📦 handleDownloadPackage: Starting download request')

    const authHeader = request.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      console.log('❌ handleDownloadPackage: Missing or invalid Authorization header')
      return new Response(JSON.stringify({ error: '認証が必要です' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const token = authHeader.split(' ')[1]

    // Supabaseクライアントを作成
    const supabaseUrl = env?.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = env?.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(JSON.stringify({ error: 'サービス設定エラー' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    // Supabaseでユーザー認証
    console.log('🔐 handleDownloadPackage: Authenticating user with token')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !user) {
      console.log('❌ handleDownloadPackage: Authentication failed:', authError?.message)
      return new Response(JSON.stringify({ error: '認証に失敗しました' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    console.log('✅ handleDownloadPackage: User authenticated:', user.email)

    // まず管理者がアップロードした専用パッケージがあるかチェック
    console.log('🔍 Checking for custom packages for user:', user.id)
    const { data: customPackage, error: packageError } = await supabase
      .from('user_packages')
      .select('file_name, file_content, version, upload_date, notes')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('upload_date', { ascending: false })
      .limit(1)
      .maybeSingle()

    console.log('📦 Custom package query result:', {
      hasPackage: !!customPackage,
      packageError: packageError,
      packageName: customPackage?.file_name
    })

    if (customPackage && !packageError) {
      // 管理者がアップロードした専用パッケージが存在する場合

      // ダウンロード回数を更新
      const { data: currentPackage } = await supabase
        .from('user_packages')
        .select('download_count')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .single()

      await supabase
        .from('user_packages')
        .update({
          download_count: (currentPackage?.download_count || 0) + 1,
          last_downloaded: new Date().toISOString()
        })
        .eq('user_id', user.id)
        .eq('is_active', true)

      // Base64デコードしてファイル内容を返す（Cloudflare Workers互換）
      const binaryString = atob(customPackage.file_content)
      const bytes = new Uint8Array(binaryString.length)
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i)
      }

      return new Response(bytes, {
        status: 200,
        headers: {
          'Content-Type': 'application/octet-stream',
          'Content-Disposition': `attachment; filename="${customPackage.file_name}"`,
          'X-Package-Type': 'custom',
          'X-Package-Version': customPackage.version,
          'X-Upload-Date': customPackage.upload_date
        }
      })
    }

    // 管理者パッケージがない場合はエラーを返す
    return new Response(JSON.stringify({
      error: '管理者がアップロードしたファイルが見つかりません。管理者にお問い合わせください。'
    }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error: any) {
    console.error('📦 handleDownloadPackage: Error occurred:', error)
    console.error('📦 Error stack:', error.stack)

    return new Response(JSON.stringify({
      error: 'ファイル生成に失敗しました',
      details: error instanceof Error ? error.message : String(error)
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}
