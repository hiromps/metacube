// 管理者専用: ユーザーパッケージアップロードAPI
import { createClient } from '@supabase/supabase-js'

interface UploadPackageRequest {
  user_id: string
  device_hash: string
  file_name: string
  file_content: string // base64エンコード済み
  file_size: number
  notes?: string
}

export async function handleAdminUploadPackage(request: Request, env?: any): Promise<Response> {
  try {
    const uploadData: UploadPackageRequest = await request.json()

    if (!uploadData.user_id || !uploadData.device_hash || !uploadData.file_content) {
      return new Response(JSON.stringify({
        error: '必須フィールドが不足しています'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

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

    // ユーザーが存在するか確認
    const { data: userData, error: userError } = await supabase.auth.admin.getUserById(uploadData.user_id)
    if (userError || !userData.user) {
      return new Response(JSON.stringify({ error: 'ユーザーが見つかりません' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
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
        version: generateVersion(),
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
        headers: { 'Content-Type': 'application/json' }
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
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error: any) {
    console.error('Upload package error:', error)
    return new Response(JSON.stringify({
      error: 'アップロードに失敗しました',
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

function generateVersion(): string {
  const now = new Date()
  return `${now.getFullYear()}.${(now.getMonth() + 1).toString().padStart(2, '0')}.${now.getDate().toString().padStart(2, '0')}.${now.getHours().toString().padStart(2, '0')}${now.getMinutes().toString().padStart(2, '0')}`
}