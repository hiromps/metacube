// ユーザー専用smartgram.ateファイル生成API
import { createClient } from '@supabase/supabase-js'

interface UserPlanInfo {
  device_hash: string
  plan: string
  expires_at: string
  subscription_status: string
}

export async function handleDownloadPackage(request: Request, env?: any): Promise<Response> {
  try {
    const authHeader = request.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
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
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !user) {
      return new Response(JSON.stringify({ error: '認証に失敗しました' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // まず管理者がアップロードした専用パッケージがあるかチェック
    const { data: customPackage, error: packageError } = await supabase
      .from('user_packages')
      .select('file_name, file_content, version, upload_date, notes')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('upload_date', { ascending: false })
      .limit(1)
      .single()

    if (customPackage && !packageError) {
      // 管理者がアップロードした専用パッケージが存在する場合

      // ダウンロード回数を更新
      await supabase
        .from('user_packages')
        .update({
          download_count: supabase.raw('download_count + 1'),
          last_downloaded: new Date().toISOString()
        })
        .eq('user_id', user.id)
        .eq('is_active', true)

      // Base64デコードしてファイル内容を返す
      const fileContent = Buffer.from(customPackage.file_content, 'base64').toString('utf-8')

      return new Response(fileContent, {
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

    // 管理者パッケージがない場合は、従来の自動生成パッケージを提供
    const { data: deviceData, error: deviceError } = await supabase
      .from('device_plan_view')
      .select('device_hash, plan_name, plan_display_name, plan_expires_at, subscription_status')
      .eq('user_id', user.id)
      .single()

    if (deviceError || !deviceData) {
      return new Response(JSON.stringify({ error: 'デバイス情報が見つかりません' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // ユーザー専用main.luaを生成
    const customMainLua = generateCustomMainLua({
      device_hash: deviceData.device_hash,
      plan: deviceData.plan_name,
      expires_at: deviceData.plan_expires_at || '2025-12-31 23:59:59',
      subscription_status: deviceData.subscription_status
    })

    // .ateファイル形式でレスポンス（実際にはZIPファイルとして配布）
    const fileName = `smartgram_${deviceData.device_hash.substring(0, 8)}.ate`

    return new Response(customMainLua, {
      status: 200,
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'X-Device-Hash': deviceData.device_hash,
        'X-Plan': deviceData.plan_name,
        'X-Package-Type': 'auto-generated'
      }
    })

  } catch (error: any) {
    console.error('Download package error:', error)
    return new Response(JSON.stringify({ error: 'ファイル生成に失敗しました' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

function generateCustomMainLua(userInfo: UserPlanInfo): string {
  // セキュア.ate版用テンプレート（コード保護対応）
  return `-- ==========================================
-- SMARTGRAM AutoTouch Launcher
-- Version 4.0.0 Secure ATE Edition
-- ユーザー専用.ate版: ${userInfo.device_hash}
-- 配布形式: .ateファイル（コード保護）
-- ==========================================

-- 設定
local Config = {
    VERSION = "4.0.0-ATE-SECURE",
    DEBUG = false,
    TOAST_DURATION = 3,
    DISTRIBUTION_TYPE = "ATE_ONLY",  -- セキュアな.ate配布専用
    CODE_PROTECTED = true
}

function log(message)
    if Config.DEBUG then
        local timestamp = os.date("%m-%d %H:%M:%S")
        print(timestamp .. " [ATE-SECURE] " .. message)
    end
end

-- ==========================================
-- 完全ローカル認証システム
-- HTTP通信は使用しません
-- ==========================================


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

-- 完全ローカル認証モード（外部モジュール依存なし）

-- ==========================================
-- セキュリティモジュール（フォールバック用）
-- ==========================================
local Security = {}

-- 認証済みデバイスリスト（あなた専用）
Security.authorizedDevices = {
    "${userInfo.device_hash}"
}

-- プラン情報（あなた専用）
Security.devicePlans = {
    ["${userInfo.device_hash}"] = {
        plan = "${userInfo.plan}",
        expires_at = "${userInfo.expires_at}",
        subscription_status = "${userInfo.subscription_status}"
    }
}

-- 日時解析関数（YYYY-MM-DD HH:MM:SS形式）
function Security.parseDateTime(dateTimeStr)
    if not dateTimeStr then return nil end

    -- YYYY-MM-DD HH:MM:SS 形式をパース
    local year, month, day, hour, min, sec = dateTimeStr:match("(%d%d%d%d)-(%d%d)-(%d%d) (%d%d):(%d%d):(%d%d)")

    if year and month and day and hour and min and sec then
        return os.time({
            year = tonumber(year),
            month = tonumber(month),
            day = tonumber(day),
            hour = tonumber(hour),
            min = tonumber(min),
            sec = tonumber(sec)
        })
    end

    -- YYYY-MM-DD 形式もサポート（時刻は23:59:59として扱う）
    year, month, day = dateTimeStr:match("(%d%d%d%d)-(%d%d)-(%d%d)")
    if year and month and day then
        return os.time({
            year = tonumber(year),
            month = tonumber(month),
            day = tonumber(day),
            hour = 23,
            min = 59,
            sec = 59
        })
    end

    return nil
end

-- カウントダウン表示関数（警告表示付き）
function Security.formatCountdown(expiresTime)
    if not expiresTime then return "期限不明" end

    local currentTime = os.time()
    local remainingSeconds = expiresTime - currentTime

    if remainingSeconds <= 0 then
        return "🚨 期限切れ"
    end

    local days = math.floor(remainingSeconds / 86400)
    local hours = math.floor((remainingSeconds % 86400) / 3600)
    local minutes = math.floor((remainingSeconds % 3600) / 60)
    local seconds = remainingSeconds % 60

    -- 期限が近い場合の警告表示
    local warningIcon = ""
    if days == 0 and hours <= 1 then
        warningIcon = "🚨 "  -- 1時間以内
    elseif days == 0 and hours <= 24 then
        warningIcon = "⚠️ "  -- 24時間以内
    elseif days <= 3 then
        warningIcon = "⚡ "  -- 3日以内
    end

    if days > 0 then
        return string.format("%s残り %d日 %02d:%02d:%02d", warningIcon, days, hours, minutes, seconds)
    elseif hours > 0 then
        return string.format("%s残り %02d:%02d:%02d", warningIcon, hours, minutes, seconds)
    else
        return string.format("%s残り %02d:%02d", warningIcon, minutes, seconds)
    end
end

-- 簡易ハッシュ関数（SHA-256代替）
function Security.simpleHash(str)
    local hash = 0
    for i = 1, #str do
        local char = string.byte(str, i)
        hash = ((hash * 31) + char) % 2147483647
    end
    -- 複雑化処理
    local result = ""
    local seed = hash
    for i = 1, 16 do
        seed = (seed * 1103515245 + 12345) % 2147483647
        result = result .. string.format("%02x", seed % 256)
    end
    return result
end

-- デバイス認証（プラン情報付き）
function Security.authenticateDevice()
    -- デバイスIDを取得（複数の方法を試す）
    local deviceId = nil

    -- 方法1: getSN()を試す
    if getSN then
        deviceId = getSN()
    end

    -- 方法2: getDeviceID()を試す
    if not deviceId and getDeviceID then
        deviceId = getDeviceID()
    end

    -- 方法3: 画面解像度ベースの一意ID生成
    if not deviceId then
        local screenWidth, screenHeight = getScreenResolution()
        deviceId = string.format("%d_%d_%d", screenWidth, screenHeight, os.time())
    end

    -- デバイスIDが取得できない場合
    if not deviceId or deviceId == "" then
        return false, "デバイスIDを取得できません", nil, nil
    end

    -- ダッシュボードとの統一のため、デバイスIDをそのまま使用
    -- （必要に応じて大文字変換で統一）
    local deviceHash = deviceId:upper()

    -- 認証リストと照合（ダッシュボードのdevice_hashと直接比較）
    for _, authorizedHash in ipairs(Security.authorizedDevices) do
        if deviceHash == authorizedHash or deviceId == authorizedHash then
            -- プラン情報を取得（deviceHashまたはdeviceIdで検索）
            local planInfo = Security.devicePlans[authorizedHash] or Security.devicePlans[deviceHash] or Security.devicePlans[deviceId]
            if planInfo then
                -- 有効期限チェック（時分秒まで対応）
                local currentTime = os.time()
                local expiresTime = Security.parseDateTime(planInfo.expires_at)

                if expiresTime and currentTime <= expiresTime then
                    return true, "認証成功", authorizedHash, planInfo
                else
                    return false, "サブスクリプション期限切れ", authorizedHash, planInfo
                end
            else
                -- プラン情報がない場合はtrialとして扱う
                local defaultPlan = {
                    plan = "trial",
                    expires_at = "2025-12-31",
                    subscription_status = "trial"
                }
                return true, "認証成功（トライアル）", authorizedHash, defaultPlan
            end
        end
    end

    -- 未認証デバイス
    return false, "未認証デバイス", deviceHash, nil
end

-- デバイス情報表示（購入者登録用）
function Security.showDeviceInfo()
    -- デバイスIDを取得（複数の方法を試す）
    local deviceId = nil

    -- 方法1: getSN()を試す
    if getSN then
        deviceId = getSN()
    end

    -- 方法2: getDeviceID()を試す
    if not deviceId and getDeviceID then
        deviceId = getDeviceID()
    end

    -- 方法3: 画面解像度ベースの一意ID生成
    if not deviceId then
        local screenWidth, screenHeight = getScreenResolution()
        deviceId = string.format("%d_%d_%d", screenWidth, screenHeight, os.time())
    end

    if not deviceId or deviceId == "" then
        return nil, nil, "デバイスIDを取得できません"
    end

    local hashedId = Security.simpleHash(deviceId)

    local message = "=== デバイス情報 ===\\n"
    message = message .. "デバイスID: " .. string.sub(deviceId, 1, 12) .. "...\\n"
    message = message .. "ライセンスキー: " .. hashedId .. "\\n"
    message = message .. "==================\\n"
    message = message .. "この情報を開発者に送信してください"

    return deviceId, hashedId, message
end

-- 認証ログ記録
function Security.logAuthenticationAttempt(success, hashedId)
    local logFile = "authentication_log.txt"
    local file = io.open(logFile, "a")
    if file then
        file:write(string.format("[%s] Auth: %s - Device: %s\\n",
            os.date("%Y-%m-%d %H:%M:%S"),
            success and "SUCCESS" or "FAILED",
            hashedId and string.sub(hashedId, 1, 16) or "unknown"
        ))
        file:close()
        log("✅ 認証ログ記録完了")
        return true
    else
        log("⚠️ 認証ログファイル作成失敗")
        return false
    end
end

-- ==========================================
-- プラン制限チェック関数
-- ==========================================

function PlanManager.isScriptAllowed(scriptName)
    if not scriptName or scriptName == "" then
        log("⚠️ スクリプト名が無効です")
        return false
    end

    if not PlanManager.scriptAccess then
        log("⚠️ プラン情報が取得されていません - 全スクリプトを許可")
        return true
    end

    -- 日本語ファイル名を英語ファイル名にマッピング
    local japaneseToEnglish = {
        ["タイムライン.lua"] = "timeline.lua",
        ["フォロー.lua"] = "follow.lua",
        ["アンフォロー.lua"] = "unfollow.lua",
        ["ハッシュタグ.lua"] = "hashtaglike.lua",
        ["アクティブ.lua"] = "activelike.lua"
    }

    -- 日本語ファイル名の場合は英語に変換
    local baseScriptName = japaneseToEnglish[scriptName] or scriptName

    -- スクリプト名からアクセスキーを生成
    local accessKey = baseScriptName:gsub("%.lua$", "_lua")
    local allowed = PlanManager.scriptAccess[accessKey]

    log(string.format("🔍 スクリプトアクセス確認: %s (%s) -> %s",
        scriptName, accessKey, allowed and "許可" or "制限"))

    return allowed == true
end

function PlanManager.getRestrictedMessage(planName)
    local planMessages = {
        trial = "3日間トライアル - 全機能利用可能",
        starter = "STARTERプラン - timeline.luaのみ利用可能",
        pro = "PROプラン - timeline.lua, follow.lua, unfollow.luaが利用可能",
        pro_yearly = "PROプラン(年額) - timeline.lua, follow.lua, unfollow.luaが利用可能",
        max = "MAXプラン - 全機能利用可能",
        offline_authenticated = "オフラインモード(認証済み) - 全機能利用可能",
        offline_restricted = "オフラインモード(制限) - timeline.luaのみ利用可能"
    }

    return planMessages[planName] or "プラン情報不明"
end

-- ==========================================
-- ファイル検出関数（プラン制限対応）
-- ==========================================
local function getLuaFiles()
    local files = {}

    -- rootDir()を使用して絶対パスを構築（/functions/ディレクトリ使用）
    local rootPath = rootDir and rootDir() or "/var/jb/var/mobile/Library/AutoTouch/Scripts"
    local scriptDir = rootPath .. "/smartgram.at/functions/"

    log(string.format("📂 スクリプトディレクトリを探索: %s", scriptDir))

    -- 利用可能なスクリプトリスト（英語名と日本語名の両方をサポート）
    local availableScripts = {
        {filename = "timeline.lua", displayName = "タイムライン自動いいね", englishName = "timeline.lua"},
        {filename = "follow.lua", displayName = "自動フォロー", englishName = "follow.lua"},
        {filename = "unfollow.lua", displayName = "自動アンフォロー", englishName = "unfollow.lua"},
        {filename = "hashtaglike.lua", displayName = "ハッシュタグ自動いいね", englishName = "hashtaglike.lua"},
        {filename = "activelike.lua", displayName = "アクティブユーザー自動いいね", englishName = "activelike.lua"},
        -- 日本語ファイル名もサポート
        {filename = "タイムライン.lua", displayName = "タイムライン自動いいね", englishName = "timeline.lua"},
        {filename = "フォロー.lua", displayName = "自動フォロー", englishName = "follow.lua"},
        {filename = "アンフォロー.lua", displayName = "自動アンフォロー", englishName = "unfollow.lua"},
        {filename = "ハッシュタグ.lua", displayName = "ハッシュタグ自動いいね", englishName = "hashtaglike.lua"},
        {filename = "アクティブ.lua", displayName = "アクティブユーザー自動いいね", englishName = "activelike.lua"}
    }

    -- 各スクリプトファイルの存在をチェック
    for _, script in ipairs(availableScripts) do
        local filePath = scriptDir .. script.filename
        local file = io.open(filePath, "r")

        if file then
            file:close()
            -- プラン制限をチェック
            if PlanManager.isScriptAllowed(script.filename) then
                table.insert(files, script)
                log(string.format("✅ スクリプト検出（許可）: %s", script.filename))
            else
                log(string.format("🚫 スクリプト検出（制限）: %s - %s", script.filename, PlanManager.getRestrictedMessage(PlanManager.currentPlan)))
            end
        end
    end

    log(string.format("📋 利用可能なスクリプト: %d個", #files))
    return files
end

-- ==========================================
-- ライセンス未認証ダイアログ
-- ==========================================
local function showLicenseErrorDialog(deviceHash)
    local message = "🚨 ライセンス認証エラー\\n\\n"
    message = message .. "このデバイスは認証されていません。\\n\\n"

    if deviceHash then
        message = message .. "デバイスハッシュ:\\n" .. deviceHash .. "\\n\\n"
    end

    message = message .. "SMARTGRAM公式サイトで\\n"
    message = message .. "ライセンスを購入してください:\\n\\n"
    message = message .. "https://smartgram.jp\\n\\n"
    message = message .. "購入後、デバイスハッシュを\\n"
    message = message .. "登録してください。"

    local controls = {
        {
            type = CONTROLLER_TYPE.LABEL,
            text = "🚨 認証エラー"
        },
        {
            type = CONTROLLER_TYPE.LABEL,
            text = message
        },
        {
            type = CONTROLLER_TYPE.BUTTON,
            title = "📋 デバイス情報をコピー",
            color = 0x3498db,
            width = 1.0,
            flag = 1,
            collectInputs = false
        },
        {
            type = CONTROLLER_TYPE.BUTTON,
            title = "❌ 終了",
            color = 0xFF5733,
            width = 1.0,
            flag = 2,
            collectInputs = false
        }
    }

    local orientations = {
        ORIENTATION_TYPE.PORTRAIT,
        ORIENTATION_TYPE.LANDSCAPE_LEFT,
        ORIENTATION_TYPE.LANDSCAPE_RIGHT
    }

    local result = dialog(controls, orientations)

    if result == 1 then
        -- デバイス情報をクリップボードにコピー
        local deviceId, hashedId, deviceMessage = Security.showDeviceInfo()
        if hashedId then
            copyTextToClipboard(deviceMessage)
            toast("📋 デバイス情報をコピーしました", 3)
        end
    end

    return false
end

-- ==========================================
-- スクリプト選択ダイアログ（プラン制限対応）
-- ==========================================
local function selectScript()
    local luaFiles = getLuaFiles()

    if #luaFiles == 0 then
        if PlanManager.currentPlan then
            -- プラン制限でアクセスできるスクリプトがない場合
            local restrictionMessage = string.format(
                "🚫 プラン制限\\n\\n" ..
                "%s\\n\\n" ..
                "利用可能なスクリプトがありません。\\n\\n" ..
                "プランアップグレードを検討してください。\\n\\n" ..
                "詳細: https://smartgram.jp",
                PlanManager.getRestrictedMessage(PlanManager.currentPlan)
            )

            alert(restrictionMessage)
        else
            alert("利用可能なスクリプトが見つかりません。\\n\\nスクリプトファイルを確認してください。")
        end
        return nil
    end

    -- ファイル名のリストを作成
    local fileOptions = {}
    for _, file in ipairs(luaFiles) do
        table.insert(fileOptions, file.displayName)
    end

    -- ダイアログコントロールの定義
    local controls = {
        -- タイトル
        {
            type = CONTROLLER_TYPE.LABEL,
            text = "🚀 Instagram 自動化ツール 🚀"
        },

        -- ライセンス認証済み表示
        {
            type = CONTROLLER_TYPE.LABEL,
            text = "✅ ローカル認証済み"
        },

        -- バージョン表示
        {
            type = CONTROLLER_TYPE.LABEL,
            text = "Version " .. Config.VERSION .. " [Local Auth]"
        },

        -- プラン情報表示
        {
            type = CONTROLLER_TYPE.LABEL,
            text = PlanManager.currentPlan and PlanManager.getRestrictedMessage(PlanManager.currentPlan) or "プラン情報取得中..."
        },

        -- 有効期限カウントダウン表示
        {
            type = CONTROLLER_TYPE.LABEL,
            text = "⏰ " .. (Security.formatCountdown(Security.expiresTime) or "有効期限情報なし")
        },

        -- セパレーター
        {
            type = CONTROLLER_TYPE.LABEL,
            text = "━━━━━━━━━━━━━━━━━━━"
        },

        -- 説明文
        {
            type = CONTROLLER_TYPE.LABEL,
            text = "実行する機能を選択してください"
        },

        -- セパレーター
        {
            type = CONTROLLER_TYPE.LABEL,
            text = "━━━━━━━━━━━━━━━━━━━"
        },

        -- スクリプト選択ピッカー
        {
            type = CONTROLLER_TYPE.PICKER,
            title = "📋 スクリプト選択:",
            key = "script",
            value = fileOptions[1] or "",
            options = fileOptions
        },

        -- セパレーター
        {
            type = CONTROLLER_TYPE.LABEL,
            text = "━━━━━━━━━━━━━━━━━━━"
        },

        -- 検出されたファイル一覧
        {
            type = CONTROLLER_TYPE.LABEL,
            text = "📂 検出されたスクリプト"
        },
        {
            type = CONTROLLER_TYPE.LABEL,
            text = string.format("%d個のスクリプトが見つかりました", #luaFiles)
        },

        -- セパレーター
        {
            type = CONTROLLER_TYPE.LABEL,
            text = "━━━━━━━━━━━━━━━━━━━"
        },

        -- 注意事項
        {
            type = CONTROLLER_TYPE.LABEL,
            text = "⚠️ 注意事項:"
        },
        {
            type = CONTROLLER_TYPE.LABEL,
            text = "• Instagramアカウントが制限される可能性"
        },
        {
            type = CONTROLLER_TYPE.LABEL,
            text = "• 自己責任でご利用ください"
        },
        {
            type = CONTROLLER_TYPE.LABEL,
            text = "• 過度な使用は避けてください"
        },

        -- セパレーター
        {
            type = CONTROLLER_TYPE.LABEL,
            text = "━━━━━━━━━━━━━━━━━━━"
        },

        -- デバッグモードスイッチ
        {
            type = CONTROLLER_TYPE.SWITCH,
            title = "🔍 デバッグモード:",
            key = "debug",
            value = Config.DEBUG and 1 or 0
        },

        -- セパレーター
        {
            type = CONTROLLER_TYPE.LABEL,
            text = "━━━━━━━━━━━━━━━━━━━"
        },

        -- 実行ボタン（緑色）
        {
            type = CONTROLLER_TYPE.BUTTON,
            title = "▶️ 実行",
            color = 0x68D391,
            width = 0.5,
            flag = 1,
            collectInputs = true
        },

        -- キャンセルボタン（赤色）
        {
            type = CONTROLLER_TYPE.BUTTON,
            title = "❌ 終了",
            color = 0xFF5733,
            width = 0.5,
            flag = 2,
            collectInputs = false
        }
    }

    -- ダイアログ表示（画面回転対応）
    local orientations = {
        ORIENTATION_TYPE.PORTRAIT,
        ORIENTATION_TYPE.LANDSCAPE_LEFT,
        ORIENTATION_TYPE.LANDSCAPE_RIGHT
    }

    local result, dialogValues = dialog(controls, orientations)

    -- 結果処理
    if result == 1 then  -- 実行ボタン
        -- ダイアログの戻り値から選択されたスクリプトを取得
        local selectedDisplay = ""
        local debugMode = false

        if dialogValues and dialogValues.script then
            selectedDisplay = dialogValues.script
        elseif #fileOptions > 0 then
            -- フォールバック: 最初のオプションを選択
            selectedDisplay = fileOptions[1]
            log("⚠️ ダイアログ値取得失敗 - 最初のオプションを使用")
        end

        if dialogValues and dialogValues.debug then
            debugMode = dialogValues.debug == 1
        end

        -- 選択されたファイル名を取得
        local selectedFile = nil
        for i, file in ipairs(luaFiles) do
            if file.displayName == selectedDisplay then
                selectedFile = file.filename
                break
            end
        end

        if selectedFile then
            log(string.format("📋 選択されたスクリプト: %s", selectedFile))

            -- デバッグモード設定を更新
            if debugMode ~= Config.DEBUG then
                Config.DEBUG = debugMode
                log(string.format("🔍 デバッグモード: %s", debugMode and "有効" or "無効"))
            end

            return selectedFile
        else
            log("❌ スクリプトファイル名の取得に失敗")
            alert("スクリプト選択エラー")
            return nil
        end
    else
        -- キャンセルまたは終了
        log("🚪 ユーザーがスクリプト選択をキャンセル")
        return nil
    end
end

-- ==========================================
-- スクリプト実行関数
-- ==========================================
local function runScript(scriptName)
    if not scriptName then
        log("❌ スクリプト名が指定されていません")
        return false
    end

    -- プラン制限チェック
    if not PlanManager.isScriptAllowed(scriptName) then
        local restrictionMessage = string.format(
            "🚫 プラン制限\\n\\n" ..
            "スクリプト: %s\\n\\n" ..
            "%s\\n\\n" ..
            "このスクリプトを利用するには\\n" ..
            "プランアップグレードが必要です。\\n\\n" ..
            "詳細: https://smartgram.jp",
            scriptName,
            PlanManager.getRestrictedMessage(PlanManager.currentPlan)
        )

        alert(restrictionMessage)
        return false
    end

    -- 使用量ログを記録
    Security.logUsage(Security.currentDeviceHash, scriptName)

    -- 実際のファイル名を決定（日本語ファイル名の場合はそのまま使用）
    local scriptFileName = scriptName

    -- rootDir()を使用して絶対パスを構築（/functions/ディレクトリ使用）
    local rootPath = rootDir and rootDir() or "/var/jb/var/mobile/Library/AutoTouch/Scripts"
    local absolutePath = rootPath .. "/smartgram.at/functions/" .. scriptFileName

    log(string.format("📂 スクリプトを読み込み中: %s", scriptName))
    log(string.format("📍 実行パス: %s", absolutePath))
    toast(string.format("📂 %s を起動中...", scriptName), 2)

    -- 絶対パスでファイルの存在を確認
    local checkFile = io.open(absolutePath, "r")
    if not checkFile then
        log(string.format("❌ ファイルが見つかりません: %s", absolutePath))
        log("💡 ヒント: スクリプトファイルを以下の場所に配置してください:")
        log(string.format("   %s", absolutePath))

        -- エラーメッセージを表示
        alert(string.format(
            "ファイルが見つかりません\\n\\n" ..
            "ファイル: %s\\n\\n" ..
            "配置場所:\\n" ..
            "%s/\\n" ..
            "smartgram.at/functions/%s",
            scriptName, rootPath, scriptName
        ))
        return false
    end

    log("✅ ファイルを発見")
    checkFile:close()

    -- 実行用のパスを設定
    local scriptPath = absolutePath

    -- スクリプトが存在するか確認（エラーハンドリング）
    local success, err = pcall(function()
        -- スクリプトを読み込んで実行
        log(string.format("🎯 実行中: dofile('%s')", scriptPath))
        dofile(scriptPath)
    end)

    if success then
        log(string.format("✅ %s を正常に実行しました", scriptName))
        return true
    else
        -- interrupted エラー（ユーザーによる中断）の場合は正常終了扱い
        if tostring(err):match("interrupted") then
            log(string.format("⚠️ %s がユーザーによって中断されました", scriptName))
            toast("👋 スクリプトを中断しました", 2)
            return true  -- 中断は成功として扱う
        else
            log(string.format("❌ %s の実行でエラーが発生: %s", scriptName, tostring(err)))
            alert(string.format("スクリプト実行エラー:\\n%s\\n\\nエラー:\\n%s", scriptName, tostring(err)))
            return false
        end
    end
end

-- 使用量ログ記録
function Security.logUsage(deviceHash, scriptName)
    local logFile = "usage_log.txt"
    local file = io.open(logFile, "a")
    if file then
        file:write(string.format("[%s] %s - %s - Plan: %s\\n",
            os.date("%Y-%m-%d %H:%M:%S"),
            deviceHash and string.sub(deviceHash, 1, 16) or "unknown",
            scriptName,
            PlanManager.currentPlan or "unknown"
        ))
        file:close()
        log("✅ 使用量ログ記録完了")
        return true
    else
        log("⚠️ 使用量ログファイル作成失敗")
        return false
    end
end

-- ==========================================
-- メイン処理（完全ローカル認証）
-- ==========================================
local function main()
    log("=== 🚀 Instagram自動化ツール メインランチャー ===")
    log(string.format("バージョン: %s [Local Auth Edition]", Config.VERSION))
    log("==========================================")

    -- 初期トースト表示
    toast("🔒 ローカル認証確認中...", 2)
    usleep(1000000)  -- 1秒待機

    -- 完全ローカル認証モード（プラン情報付き）
    log("🔐 完全ローカル認証モードで実行中...")
    local isAuthenticated, authMessage, hashedId, planInfo = Security.authenticateDevice()

    -- 認証ログを記録
    Security.logAuthenticationAttempt(isAuthenticated, hashedId)

    if not isAuthenticated then
        -- 未認証デバイスの場合
        log(string.format("❌ ライセンス認証失敗: %s", authMessage))
        toast("❌ ライセンス認証エラー", 3)
        usleep(2000000)  -- 2秒待機

        -- エラーダイアログを表示
        showLicenseErrorDialog(hashedId)

        log("😴 未認証のため終了します")
        return
    else
        -- ローカルプラン情報を設定
        if planInfo then
            PlanManager.currentPlan = planInfo.plan
            PlanManager.scriptAccess = PlanManager.PLAN_FEATURES[planInfo.plan] or PlanManager.PLAN_FEATURES.trial
            -- 有効期限をカウントダウン表示用に設定
            Security.expiresTime = Security.parseDateTime(planInfo.expires_at)
            -- デバイスハッシュを保存
            Security.currentDeviceHash = hashedId
            log(string.format("📋 ローカルプラン情報: %s", planInfo.plan))
            log(string.format("📅 有効期限: %s", planInfo.expires_at))
            -- カウントダウン表示をログにも出力
            if Security.expiresTime then
                log(string.format("⏰ カウントダウン: %s", Security.formatCountdown(Security.expiresTime)))
            end
        end
    end

    -- 認証成功
    log(string.format("✅ ライセンス認証成功: %s", authMessage))
    toast("✅ ライセンス認証成功", 2)
    usleep(1000000)  -- 1秒待機

    -- スクリプト選択ループ
    while true do
        local selectedScript = selectScript()

        if not selectedScript then
            -- ユーザーがキャンセルまたは終了を選択
            log("👋 ツールを終了します")
            toast("👋 SMARTGRAMツールを終了", 2)
            break
        end

        -- 選択されたスクリプトを実行
        local success = runScript(selectedScript)

        if success then
            log(string.format("✅ %s の実行が完了しました", selectedScript))
            toast("✅ 実行完了", 2)
        else
            log(string.format("❌ %s の実行に失敗しました", selectedScript))
        end

        -- 少し待機してから次の選択へ
        usleep(1000000)  -- 1秒待機
    end

    log("=== 🏁 Instagram自動化ツール 終了 ===")
end

-- ==========================================
-- エントリーポイント
-- ==========================================
main()
`
}