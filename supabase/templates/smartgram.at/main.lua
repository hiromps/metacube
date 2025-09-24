-- ==========================================
-- SMARTGRAM AutoTouch Launcher
-- セキュア.ate版 - 完全ローカル認証
-- Version 4.0.0 Secure ATE Edition
-- 配布形式: .ateファイルのみ（コード保護）
-- ==========================================

-- Enable logging
print = log

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

-- 認証済みデバイスリスト（ダッシュボードのdevice_hashを直接使用）
-- Webダッシュボードでdevicesテーブルに保存されているdevice_hashをそのまま使用
Security.authorizedDevices = {
    -- プレースホルダーデバイス（配布時に実際の値に置き換える）
    "{{DEVICE_HASH}}"  -- プレースホルダー: デバイスハッシュ
}

-- プラン情報付きデバイス管理（ダッシュボードのdevice_hashを直接使用）
Security.devicePlans = {
    -- Webダッシュボードのdevice_hashをそのまま使用
    -- ダッシュボードでdevicesテーブルに保存されているdevice_hashと一致させる

    -- プレースホルダーデバイス（配布時に実際の値に置き換える）
    ["{{DEVICE_HASH}}"] = {
        plan = "{{PLAN_TYPE}}",  -- プレースホルダー: プランタイプ (trial, starter, pro, pro_yearly, max)
        expires_at = "{{EXPIRES_AT}}",  -- プレースホルダー: 有効期限（YYYY-MM-DD HH:MM:SS）
        subscription_status = "{{STATUS}}"  -- プレースホルダー: ステータス (active, trial, expired)
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

    -- YYYY-MM-DD 形式（後方互換性）
    local year2, month2, day2 = dateTimeStr:match("(%d%d%d%d)-(%d%d)-(%d%d)")
    if year2 and month2 and day2 then
        return os.time({
            year = tonumber(year2),
            month = tonumber(month2),
            day = tonumber(day2),
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

    local message = "=== デバイス情報 ===\n"
    message = message .. "デバイスID: " .. string.sub(deviceId, 1, 12) .. "...\n"
    message = message .. "ライセンスキー: " .. hashedId .. "\n"
    message = message .. "==================\n"
    message = message .. "この情報を開発者に送信してください"

    return deviceId, hashedId, message
end

-- 認証ログ記録
function Security.logAuthenticationAttempt(success, hashedId)
    local logFile = "authentication_log.txt"
    local file = io.open(logFile, "a")

    if file then
        file:write(string.format(
            "[%s] %s - Hash: %s\n",
            os.date("%Y-%m-%d %H:%M:%S"),
            success and "SUCCESS" or "FAILED",
            string.sub(hashedId or "unknown", 1, 16) .. "..."
        ))
        file:close()
    end
end

-- ==========================================
-- 設定
-- ==========================================
local Config = {
    -- デバッグモード
    DEBUG = true,

    -- バージョン情報
    VERSION = "4.0.0",

    -- 完全ローカル認証版識別子
    LICENSED = true,
    LOCAL_AUTH = true,

    -- PayPal連携モード（無効）
    PAYPAL_MODE = false,

    -- 除外するファイル名
    EXCLUDE_FILES = {
        "main.lua"  -- 自分自身は除外
    }
}

-- ==========================================
-- ライセンス認証エラーダイアログ
-- ==========================================
local function showLicenseErrorDialog(hashedId)
    log("🔒 ライセンス認証エラーダイアログを表示")

    -- デバイス登録情報をファイルに保存
    local file = io.open("device_registration_request.txt", "w")
    if file then
        file:write("=== デバイス登録リクエスト ===\n")
        file:write("日時: " .. os.date("%Y-%m-%d %H:%M:%S") .. "\n")
        file:write("ライセンスキー: " .. (hashedId or "エラー") .. "\n")
        file:write("================================\n")
        file:write("\n【購入者への手順】\n")
        file:write("1. このライセンスキーを販売者に送信\n")
        file:write("2. 認証済みバージョンを受け取る\n")
        file:write("3. 新しいスクリプトを実行\n")
        file:close()
    end

    local errorControls = {
        {type = CONTROLLER_TYPE.LABEL, text = "🔒 ライセンス認証が必要です 🔒"},
        {type = CONTROLLER_TYPE.LABEL, text = "━━━━━━━━━━━━━━━━━━━"},
        {type = CONTROLLER_TYPE.LABEL, text = "このデバイスは認証されていません"},
        {type = CONTROLLER_TYPE.LABEL, text = ""},
        {type = CONTROLLER_TYPE.LABEL, text = "あなたのライセンスキー:"},
        {type = CONTROLLER_TYPE.INPUT,
         title = "",
         key = "licenseKey",
         value = hashedId or "エラー",
         prompt = "ライセンスキー"},
        {type = CONTROLLER_TYPE.LABEL, text = ""},
        {type = CONTROLLER_TYPE.LABEL, text = "【対処方法】"},
        {type = CONTROLLER_TYPE.LABEL, text = "1. 上記のキーをコピー"},
        {type = CONTROLLER_TYPE.LABEL, text = "2. 販売者に送信"},
        {type = CONTROLLER_TYPE.LABEL, text = "3. 認証版の提供を待つ"},
        {type = CONTROLLER_TYPE.LABEL, text = "━━━━━━━━━━━━━━━━━━━"},
        {type = CONTROLLER_TYPE.LABEL, text = "📧 サポート連絡先:"},
        {type = CONTROLLER_TYPE.LABEL, text = "support@example.com"},
        {type = CONTROLLER_TYPE.LABEL, text = "━━━━━━━━━━━━━━━━━━━"},
        {type = CONTROLLER_TYPE.BUTTON, title = "閉じる", color = 0xFF5733, flag = 1}
    }

    dialog(errorControls, {ORIENTATION_TYPE.PORTRAIT})

    toast("❌ ライセンス認証が必要です", 3)
    log("❌ 未認証デバイスのため終了")
end

-- ==========================================
-- プラン別スクリプトアクセス制御
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
    local fileDescriptions = {
        -- 英語ファイル名
        ["follow.lua"] = "自動フォロー",
        ["activelike.lua"] = "アクティブいいね",
        ["timeline.lua"] = "タイムライン自動いいね（完成版）",
        ["unfollow.lua"] = "自動アンフォロー（完成版）",
        ["hashtaglike.lua"] = "ハッシュタグ自動いいね",

        -- 日本語ファイル名（使用する場合）
        ["タイムライン.lua"] = "タイムライン自動いいね",
        ["フォロー.lua"] = "自動フォロー",
        ["アンフォロー.lua"] = "自動アンフォロー",
        ["ハッシュタグ.lua"] = "ハッシュタグ自動いいね",
        ["アクティブ.lua"] = "アクティブいいね"
    }

    -- AutoTouchではファイル検出が難しいため、事前定義リストを直接使用
    log("📋 利用可能なスクリプトリスト (/functions/)")

    if PlanManager.currentPlan then
        log(string.format("📋 現在のプラン: %s", PlanManager.getRestrictedMessage(PlanManager.currentPlan)))
    end

    -- /functions/内の全ファイル（日本語ファイル名も対応）
    local defaultFiles = {
        "timeline.lua",
        "follow.lua",
        "unfollow.lua",
        "hashtaglike.lua",
        "activelike.lua"
        -- 日本語ファイル名の例:
        -- "タイムライン.lua",
        -- "フォロー.lua",
        -- "アンフォロー.lua",
        -- "ハッシュタグ.lua",
        -- "アクティブ.lua"
    }
    for _, filename in ipairs(defaultFiles) do
        -- main.luaは除外
        if filename ~= "main.lua" then
            -- プラン制限チェック
            local isAllowed = PlanManager.isScriptAllowed(filename)

            if isAllowed then
                local description = fileDescriptions[filename] or filename:gsub("%.lua$", "")
                table.insert(files, {
                    filename = filename,
                    displayName = description .. " (" .. filename .. ")"
                })
                log(string.format("✅ 利用可能: %s", filename))
            else
                log(string.format("🔒 制限中: %s (プランアップグレードが必要)", filename))
            end
        end
    end

    -- 検出されたファイル数をログ出力
    log(string.format("📊 利用可能: %d 個 / 総スクリプト: %d 個", #files, #defaultFiles))

    -- 利用可能なスクリプトがない場合の警告
    if #files == 0 then
        log("⚠️ 現在のプランで利用可能なスクリプトがありません")
    end

    -- ファイルリストをソート
    table.sort(files, function(a, b) return a.filename < b.filename end)

    return files
end

-- ==========================================
-- スクリプト選択ダイアログ（認証済み版）
-- ==========================================
local function showScriptSelector()
    local modeText = Config.PAYPAL_MODE and "[PayPal認証済み]" or "[認証済み]"
    log("📱 Instagram自動化ツール ランチャー起動 " .. modeText)

    -- 利用可能なLuaファイルを取得
    local luaFiles = getLuaFiles()

    if #luaFiles == 0 then
        -- プラン制限による場合は専用メッセージを表示
        if PlanManager.currentPlan then
            local upgradeControls = {
                {type = CONTROLLER_TYPE.LABEL, text = "🚫 利用可能な機能なし 🚫"},
                {type = CONTROLLER_TYPE.LABEL, text = "━━━━━━━━━━━━━━━━━━━"},
                {type = CONTROLLER_TYPE.LABEL, text = "現在のプランでは利用可能な"},
                {type = CONTROLLER_TYPE.LABEL, text = "機能がありません。"},
                {type = CONTROLLER_TYPE.LABEL, text = ""},
                {type = CONTROLLER_TYPE.LABEL, text = PlanManager.getRestrictedMessage(PlanManager.currentPlan)},
                {type = CONTROLLER_TYPE.LABEL, text = ""},
                {type = CONTROLLER_TYPE.LABEL, text = "💡 プランアップグレードで"},
                {type = CONTROLLER_TYPE.LABEL, text = "より多くの機能が利用可能です"},
                {type = CONTROLLER_TYPE.LABEL, text = "━━━━━━━━━━━━━━━━━━━"},
                {type = CONTROLLER_TYPE.LABEL, text = "🌐 https://smartgram.jp"},
                {type = CONTROLLER_TYPE.BUTTON, title = "OK", color = 0xFF5733, flag = 1}
            }
            dialog(upgradeControls, {ORIENTATION_TYPE.PORTRAIT})
        else
            alert("⚠️ 実行可能なスクリプトが見つかりません")
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
            text = "⚠️ 注意事項"
        },
        {
            type = CONTROLLER_TYPE.LABEL,
            text = "• Instagramアプリを開いてから実行"
        },
        {
            type = CONTROLLER_TYPE.LABEL,
            text = "• 適切な画面で開始してください"
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

        -- フォールバック: displayNameが一致しない場合、最初のファイルを使用
        if not selectedFile and #luaFiles > 0 then
            selectedFile = luaFiles[1].filename
            selectedDisplay = luaFiles[1].displayName
            log("⚠️ ファイル名マッチング失敗 - 最初のファイルを使用")
        end

        log(string.format("選択されたスクリプト: %s", selectedFile or "不明"))
        log(string.format("選択された表示名: %s", selectedDisplay or "不明"))
        log(string.format("デバッグモード: %s", debugMode and "ON" or "OFF"))

        return {
            script = selectedFile,
            displayName = selectedDisplay,
            debug = debugMode
        }
    else  -- キャンセルボタン
        log("❌ キャンセルされました")
        return nil
    end
end

-- ==========================================
-- スクリプト実行関数
-- ==========================================
local function executeScript(scriptFileName, debugMode)
    if not scriptFileName then
        log("⚠️ スクリプトファイルが指定されていません")
        toast("⚠️ スクリプトが選択されていません", 3)
        return false
    end

    -- AutoTouchの実際のパスを使用（rootDir()関数を利用）
    local scriptName = scriptFileName

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
            "ファイルが見つかりません\n\n" ..
            "ファイル: %s\n\n" ..
            "配置場所:\n" ..
            "%s/\n" ..
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
        end

        log(string.format("❌ スクリプト実行エラー: %s", tostring(err)))
        toast(string.format("❌ エラー: %s", scriptName), 3)

        -- エラーダイアログ表示
        alert(string.format(
            "スクリプト実行エラー\n\n" ..
            "ファイル: %s\n" ..
            "エラー: %s\n\n" ..
            "スクリプトファイルが存在することを確認してください。",
            scriptName, tostring(err)
        ))

        return false
    end
end

-- ==========================================
-- ローカル使用量ログ（ファイルベース）
-- ==========================================
function PlanManager.logUsage(deviceHash, scriptName)
    if not deviceHash or deviceHash == "" or not scriptName or scriptName == "" then
        log("⚠️ 使用量ログ: パラメータ不足")
        return false
    end

    log(string.format("📊 使用量ログ記録: %s", scriptName))

    local logFile = "usage_log.txt"
    local file = io.open(logFile, "a")
    if file then
        file:write(string.format("[%s] %s - %s - Plan: %s\n",
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
    usleep(1500000)  -- 1.5秒待機

    -- ローカルプラン情報確認
    if PlanManager.currentPlan then
        log(string.format("✅ ローカルプラン確認完了: %s", PlanManager.currentPlan))
        toast(string.format("✅ %s", PlanManager.getRestrictedMessage(PlanManager.currentPlan)), 2)
    else
        log("⚠️ プラン情報が設定されていません - デフォルトを適用")
        PlanManager.currentPlan = "trial"
        PlanManager.scriptAccess = PlanManager.PLAN_FEATURES.trial
        toast("⚠️ デフォルトプラン適用", 2)
    end

    usleep(1000000)  -- 1秒待機

    -- スクリプト選択ダイアログを表示
    local selection = showScriptSelector()

    if not selection then
        log("😴 ランチャーを終了します")
        toast("👋 終了しました", 2)
        return
    end

    -- 選択されたスクリプトの最終確認
    if not selection.script or selection.script == "" then
        log("⚠️ 無効なスクリプトが選択されました")
        toast("⚠️ 無効なスクリプト", 3)
        return main()  -- メニューに戻る
    end

    -- 選択されたスクリプトのアクセス権限を再確認
    if not PlanManager.isScriptAllowed(selection.script) then
        log(string.format("🔒 アクセス拒否: %s", selection.script))

        local restrictedDialog = {
            {type = CONTROLLER_TYPE.LABEL, text = "🔒 アクセス制限 🔒"},
            {type = CONTROLLER_TYPE.LABEL, text = "━━━━━━━━━━━━━━━━━━━"},
            {type = CONTROLLER_TYPE.LABEL, text = "選択された機能は現在のプランでは"},
            {type = CONTROLLER_TYPE.LABEL, text = "利用できません。"},
            {type = CONTROLLER_TYPE.LABEL, text = ""},
            {type = CONTROLLER_TYPE.LABEL, text = PlanManager.getRestrictedMessage(PlanManager.currentPlan)},
            {type = CONTROLLER_TYPE.LABEL, text = ""},
            {type = CONTROLLER_TYPE.LABEL, text = "💡 プランアップグレードで利用可能"},
            {type = CONTROLLER_TYPE.LABEL, text = "🌐 https://smartgram.jp"},
            {type = CONTROLLER_TYPE.BUTTON, title = "戻る", color = 0xFF5733, flag = 1}
        }

        dialog(restrictedDialog, {ORIENTATION_TYPE.PORTRAIT})
        toast("🔒 アクセスが制限されています", 3)
        return main()  -- メニューに戻る
    end

    -- 確認ダイアログをスキップしてすぐに実行
    log(string.format("📌 選択されたスクリプト: %s", selection.displayName))
    toast(string.format("✅ %s を実行します", selection.displayName), 2)
    usleep(1000000)  -- 1秒待機

    -- デバッグモードをグローバルに設定
    Config.DEBUG = selection.debug

    -- 選択されたスクリプトを実行
    log(string.format("🎯 %s を実行します", selection.script))
    toast(string.format("🎯 %s を開始", selection.displayName), 2)
    usleep(1500000)  -- 1.5秒待機

    -- main.lua経由であることを示すフラグを設定
    _G.LAUNCHED_FROM_MAIN = true

    -- デバイスハッシュをグローバルに設定（使用量カウント用）
    _G.DEVICE_HASH = hashedId

    -- スクリプト実行
    local executeSuccess = executeScript(selection.script, selection.debug)

    -- スクリプト実行成功時のログ記録
    if executeSuccess then
        log("📊 スクリプト実行成功")
        PlanManager.logUsage(hashedId, selection.script)
    end

    if not executeSuccess then
        log("⚠️ スクリプトの実行に失敗しました")

        -- 再実行を提案
        local retry = alert(
            "スクリプトの実行に失敗しました。\n\n" ..
            "もう一度実行しますか？",
            "再実行", "終了"
        )

        if retry == 1 then
            log("🔄 再実行を試みます")
            toast("🔄 再実行中...", 2)
            usleep(1000000)
            main()  -- 再帰的に実行
        else
            log("😴 ランチャーを終了します")
            toast("👋 終了しました", 2)
        end
    end
end

-- ==========================================
-- エラーハンドリング付き実行
-- ==========================================
local function safeMain()
    local success, err = pcall(main)

    if not success then
        -- interrupted エラー（ユーザーによる中断）の場合は正常終了扱い
        if tostring(err):match("interrupted") then
            log("⚠️ ユーザーによる中断を検出")
            toast("👋 終了しました", 2)
            return
        end

        -- その他のエラーの場合のみエラー処理
        log(string.format("🚨 致命的エラー: %s", tostring(err)))

        -- エラーダイアログ
        alert(string.format(
            "🚨 致命的エラーが発生しました\n\n" ..
            "%s\n\n" ..
            "アプリを再起動してください。",
            tostring(err)
        ))

        -- スクリーンショット保存
        screenshot(string.format("launcher_error_%d.png", os.time()))
    end
end

-- ==========================================
-- デバイス登録モード（オプション機能）
-- ==========================================
local function deviceRegistrationMode()
    log("📱 デバイス登録モード起動")

    local deviceId, hashedId, message = Security.showDeviceInfo()

    if not hashedId then
        toast("❌ デバイスID取得エラー", 3)
        return
    end

    -- 登録情報をファイルに保存
    local file = io.open("my_device_info.txt", "w")
    if file then
        file:write("=== あなたのデバイス情報 ===\n")
        file:write("ライセンスキー: " .. hashedId .. "\n")
        file:write("登録日時: " .. os.date("%Y-%m-%d %H:%M:%S") .. "\n")
        file:write("\n【次の手順】\n")
        file:write("1. このライセンスキーを販売者に送信\n")
        file:write("2. 認証済みバージョンを受け取る\n")
        file:write("3. 新しいスクリプトを実行\n")
        file:close()
    end

    -- ダイアログで表示
    local controls = {
        {type = CONTROLLER_TYPE.LABEL, text = "📱 デバイス登録情報 📱"},
        {type = CONTROLLER_TYPE.LABEL, text = "━━━━━━━━━━━━━━━━━━━"},
        {type = CONTROLLER_TYPE.INPUT,
         title = "ライセンスキー:",
         key = "key",
         value = hashedId,
         prompt = "このキーをコピーしてください"},
        {type = CONTROLLER_TYPE.LABEL, text = ""},
        {type = CONTROLLER_TYPE.LABEL, text = "📋 このキーを販売者に送信してください"},
        {type = CONTROLLER_TYPE.LABEL, text = "📧 送信後、認証版が提供されます"},
        {type = CONTROLLER_TYPE.BUTTON, title = "OK", color = 0x68D391, flag = 1}
    }

    dialog(controls, {ORIENTATION_TYPE.PORTRAIT})
    toast("✅ デバイス情報をmy_device_info.txtに保存しました", 3)
end

-- ==========================================
-- スタートアップメッセージ
-- ==========================================
log("==========================================")
log("  Instagram Automation Tool Launcher")
log("     Local Auth Edition " .. Config.VERSION)
log("  🔐 完全ローカル認証 + プラン制限対応")
log("==========================================")
log("")
log("🔒 起動中...")
log("")

-- メイン実行
safeMain()