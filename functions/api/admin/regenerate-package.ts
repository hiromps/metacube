// 管理者専用: ユーザーパッケージ再生成API
import { createClient } from '@supabase/supabase-js'

export async function handleAdminRegeneratePackage(request: Request, env?: any): Promise<Response> {
  try {
    const { device_hash } = await request.json()

    if (!device_hash) {
      return new Response(JSON.stringify({ error: 'デバイスハッシュが必要です' }), {
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

    // デバイスハッシュでユーザー情報を取得
    const { data: deviceData, error: deviceError } = await supabase
      .from('device_plan_view')
      .select('device_hash, plan_name, plan_display_name, plan_expires_at, subscription_status, user_id')
      .eq('device_hash', device_hash)
      .single()

    if (deviceError || !deviceData) {
      return new Response(JSON.stringify({ error: 'デバイス情報が見つかりません' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // ユーザーのメールアドレスを取得
    const { data: userData } = await supabase.auth.admin.getUserById(deviceData.user_id)
    const userEmail = userData.user?.email || 'unknown@example.com'

    // 管理者用パッケージを生成（より詳細な情報付き）
    const customMainLua = generateAdminPackage({
      device_hash: deviceData.device_hash,
      plan: deviceData.plan_name,
      expires_at: deviceData.plan_expires_at || '2025-12-31 23:59:59',
      subscription_status: deviceData.subscription_status,
      email: userEmail
    })

    const fileName = `smartgram_${deviceData.device_hash.substring(0, 8)}_admin.ate`

    return new Response(customMainLua, {
      status: 200,
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'X-Device-Hash': deviceData.device_hash,
        'X-Plan': deviceData.plan_name,
        'X-Generated-By': 'admin'
      }
    })

  } catch (error: any) {
    console.error('Admin package generation error:', error)
    return new Response(JSON.stringify({ error: 'パッケージ生成に失敗しました' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

function generateAdminPackage(userInfo: {
  device_hash: string
  plan: string
  expires_at: string
  subscription_status: string
  email: string
}): string {
  // 管理者用の詳細情報付きパッケージ
  return `-- ==========================================
-- SMARTGRAM AutoTouch Launcher (管理者生成版)
-- Version 4.0.0 Local Auth Edition
-- 生成日時: ${new Date().toISOString()}
-- 対象ユーザー: ${userInfo.email}
-- デバイスハッシュ: ${userInfo.device_hash}
-- プラン: ${userInfo.plan}
-- 有効期限: ${userInfo.expires_at}
-- ==========================================

-- 管理者メモ:
-- このファイルは管理者により生成されました
-- ユーザー専用設定が適用されています

-- 設定
local Config = {
    VERSION = "4.0.0-ADMIN",
    DEBUG = false,
    TOAST_DURATION = 3,
    ADMIN_GENERATED = true,
    GENERATED_AT = "${new Date().toISOString()}",
    TARGET_USER = "${userInfo.email}"
}

function log(message)
    if Config.DEBUG then
        local timestamp = os.date("%m-%d %H:%M:%S")
        print(timestamp .. " [ADMIN] " .. message)
    end
end

-- 管理者生成ログ
log("=== 管理者生成パッケージ ===")
log("対象ユーザー: " .. Config.TARGET_USER)
log("生成日時: " .. Config.GENERATED_AT)
log("=============================")

-- ==========================================
-- プラン制限管理モジュール
-- ==========================================
local PlanManager = {}

-- プラン別機能制限定義
PlanManager.PLAN_FEATURES = {
    trial = {
        timeline_lua = true,
        follow_lua = true,
        unfollow_lua = true,
        hashtaglike_lua = true,
        activelike_lua = true
    },
    starter = {
        timeline_lua = true,
        follow_lua = false,
        unfollow_lua = false,
        hashtaglike_lua = false,
        activelike_lua = false
    },
    pro = {
        timeline_lua = true,
        follow_lua = true,
        unfollow_lua = true,
        hashtaglike_lua = false,
        activelike_lua = false
    },
    pro_yearly = {
        timeline_lua = true,
        follow_lua = true,
        unfollow_lua = true,
        hashtaglike_lua = false,
        activelike_lua = false
    },
    max = {
        timeline_lua = true,
        follow_lua = true,
        unfollow_lua = true,
        hashtaglike_lua = true,
        activelike_lua = true
    }
}

-- 現在のプラン情報を保存
PlanManager.currentPlan = nil
PlanManager.scriptAccess = nil

-- ==========================================
-- セキュリティモジュール（管理者設定版）
-- ==========================================
local Security = {}

-- 管理者により設定されたデバイス（${userInfo.email}専用）
Security.authorizedDevices = {
    "${userInfo.device_hash}"
}

-- 管理者により設定されたプラン情報
Security.devicePlans = {
    ["${userInfo.device_hash}"] = {
        plan = "${userInfo.plan}",
        expires_at = "${userInfo.expires_at}",
        subscription_status = "${userInfo.subscription_status}",
        admin_generated = true,
        target_user = "${userInfo.email}"
    }
}

-- [残りのコードは標準版と同じ...]
-- 認証・実行・UI機能は標準パッケージと同じコードを使用

-- 管理者ログ記録
function Security.logAdminUsage(deviceHash, scriptName)
    local logFile = "admin_usage_log.txt"
    local file = io.open(logFile, "a")
    if file then
        file:write(string.format("[%s] ADMIN-GENERATED - User: %s - Device: %s - Script: %s - Plan: %s\\n",
            os.date("%Y-%m-%d %H:%M:%S"),
            Config.TARGET_USER,
            deviceHash and string.sub(deviceHash, 1, 16) or "unknown",
            scriptName,
            PlanManager.currentPlan or "unknown"
        ))
        file:close()
        log("✅ 管理者ログ記録完了")
        return true
    else
        log("⚠️ 管理者ログファイル作成失敗")
        return false
    end
end

-- [その他の機能は標準版main.luaと同じ...]

-- エントリーポイントでの管理者ログ
log("👑 管理者生成パッケージを実行中...")
log("対象ユーザー: " .. Config.TARGET_USER)

-- 標準main.lua機能を実行
-- main()
`
}