// user_packagesテーブルからファイルをダウンロード
import { createClient } from '@supabase/supabase-js'

export async function handleDownloadPackage(request: Request, env?: any): Promise<Response> {
  try {
    console.log('📦 Starting download request')

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

    console.log('✅ User authenticated:', user.email)

    // user_packagesテーブルからアクティブなパッケージを取得
    const { data: packageData, error: packageError } = await supabase
      .from('user_packages')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    console.log('📦 Package query result:', {
      found: !!packageData,
      error: packageError,
      fileName: packageData?.file_name,
      userId: user.id
    })

    // パッケージが見つからない場合
    if (!packageData || packageError) {
      // デバッグ用：全パッケージ確認
      const { data: allPackages } = await supabase
        .from('user_packages')
        .select('id, user_id, file_name, is_active, created_at')
        .limit(5)

      return new Response(JSON.stringify({
        error: 'アップロードされたファイルが見つかりません',
        debug: {
          userId: user.id,
          userEmail: user.email,
          packageError: packageError?.message,
          allPackagesCount: allPackages?.length || 0,
          allPackages: allPackages?.map(p => ({
            id: p.id,
            user_id: p.user_id,
            file_name: p.file_name,
            is_active: p.is_active,
            created_at: p.created_at
          })) || []
        }
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // ダウンロード回数を更新
    await supabase
      .from('user_packages')
      .update({
        download_count: (packageData.download_count || 0) + 1,
        last_downloaded: new Date().toISOString()
      })
      .eq('id', packageData.id)

    // Base64ファイル内容をデコード
    const binaryString = atob(packageData.file_content)
    const bytes = new Uint8Array(binaryString.length)
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i)
    }

    // ファイルダウンロードレスポンス
    return new Response(bytes, {
      status: 200,
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${packageData.file_name}"`,
        'X-Package-Version': packageData.version || 'unknown',
        'X-Upload-Date': packageData.created_at
      }
    })

  } catch (error: any) {
    console.error('📦 Download error:', error)
    return new Response(JSON.stringify({
      error: 'ダウンロード処理でエラーが発生しました',
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}