-- ================================
-- Smartgram License Manager for AutoTouch
-- Version: 3.1.0 (オンライン専用版)
-- 支払い後、初回実行時に自動的に体験期間開始
-- ================================

-- AutoTouch doesn't have http module, use built-in httpGet/httpPost
-- json module might need to be checked too

-- Configuration
local API_BASE_URL = "https://smartgram.jp/api"
local CACHE_FILE = "/var/mobile/Library/AutoTouch/Scripts/.smartgram_cache"
local LOG_FILE = "/var/mobile/Library/AutoTouch/Scripts/.smartgram_log"
local CACHE_DURATION = 24 * 60 * 60 -- 24 hours
local ACTIVATION_COOLDOWN = 24 * 60 * 60 -- 24 hours between activations (AutoTouch style)

-- ================================
-- ログ管理関数
-- ================================

-- printのみを使用（ログファイル機能は無効）

-- 重要なメッセージのみtoast表示
function showToast(message, duration)
    toast(message, duration or 2)
end

-- ログファイル機能は削除（printのみ使用）

-- ================================
-- ライセンス管理関数
-- ================================

-- AutoTouchスタイルのライセンス状態取得関数
function getLicense()
    local cache = loadCache()
    if cache and cache.is_valid then
        if cache.status == "trial" then
            return "TRIAL"
        elseif cache.status == "active" then
            return "PRO"
        end
    end
    return nil
end

-- Smartgramライセンス状態取得（詳細版）
function getLicenseDetails()
    local cache = loadCache()
    if not cache then
        return {
            status = "none",
            is_valid = false,
            message = "No license cache found"
        }
    end

    -- 開発モード: APIレスポンスのtime_remaining_secondsを直接使用
    local currentTimeRemaining = cache.time_remaining_seconds or 0

    print("🔍 デバッグ: キャッシュのtime_remaining_seconds:", currentTimeRemaining)
    print("🔍 デバッグ: 計算結果の時間:", math.floor(currentTimeRemaining / 3600), "時間")

    return {
        status = cache.status or "unknown",
        is_valid = cache.is_valid or false,
        trial_ends_at = cache.trial_ends_at,
        time_remaining_seconds = currentTimeRemaining,
        message = cache.message or "License data available"
    }
end

-- デバイスハッシュ取得
function getDeviceHash()
    -- 複数の方法でデバイスハッシュを取得
    local deviceHash = nil

    -- Method 1: Try getSN() function
    if getSN then
        local success, result = pcall(getSN)
        if success and result and result ~= "" then
            deviceHash = result
            print("📱 デバイスハッシュ取得成功 (getSN): " .. deviceHash)
        else
            print("⚠️ getSN() 失敗:", result)
        end
    else
        print("⚠️ getSN() 関数が利用できません")
    end

    -- Method 2: Try getDeviceID() function
    if not deviceHash and getDeviceID then
        local success, result = pcall(getDeviceID)
        if success and result and result ~= "" then
            deviceHash = result
            print("📱 デバイスハッシュ取得成功 (getDeviceID): " .. deviceHash)
        else
            print("⚠️ getDeviceID() 失敗:", result)
        end
    end

    -- Method 3: Generate from screen resolution as fallback
    if not deviceHash then
        local success, width, height = pcall(getScreenResolution)
        if success and width and height then
            -- Create a simple hash from screen resolution and current time
            local timeStr = tostring(os.time())
            local resolutionStr = width .. "x" .. height
            -- Simple hash generation (not cryptographically secure)
            local hashInput = resolutionStr .. "_" .. timeStr
            local hash = 0
            for i = 1, #hashInput do
                local char = string.byte(hashInput, i)
                hash = ((hash * 31) + char) % 2147483647
            end
            deviceHash = string.format("%X", hash):sub(1, 12)
            print("📱 デバイスハッシュ生成 (画面解像度ベース): " .. deviceHash)
        else
            print("⚠️ 画面解像度の取得に失敗")
        end
    end

    -- Method 4: Fallback to saved hash or default
    if not deviceHash then
        local hashFile = "/var/mobile/Library/AutoTouch/Scripts/.device_hash"
        local file = io.open(hashFile, "r")
        if file then
            deviceHash = file:read("*all")
            file:close()
            if deviceHash and deviceHash ~= "" then
                deviceHash = deviceHash:gsub("\n", ""):gsub("\r", "")
                print("📱 デバイスハッシュ読み込み (保存済み): " .. deviceHash)
            end
        end
    end

    -- Save hash for future use
    if deviceHash then
        local hashFile = "/var/mobile/Library/AutoTouch/Scripts/.device_hash"
        local file = io.open(hashFile, "w")
        if file then
            file:write(deviceHash)
            file:close()
        end
    else
        -- Ultimate fallback
        deviceHash = "UNKNOWN_DEVICE"
        print("❌ デバイスハッシュの取得に失敗 - フォールバック値を使用")
    end

    print("📱 最終デバイスハッシュ: " .. deviceHash)
    return deviceHash

    -- Original detection code (for reference)
    --[[
    -- Check for saved hash first
    local hashFile = "/var/mobile/Library/AutoTouch/Scripts/.device_hash"
    print("Checking for saved hash at:", hashFile)

    local file = io.open(hashFile, "r")
    if file then
        local savedHash = file:read("*all")
        file:close()
        if savedHash and savedHash ~= "" then
            savedHash = savedHash:gsub("\n", ""):gsub("\r", "") -- Remove any newlines
            print("Found saved hash:", savedHash)
            print("Saved hash length:", string.len(savedHash))
            if string.len(savedHash) >= 12 then
                print("=== デバイスハッシュ検出: 成功(ファイルから) ===")
                return savedHash
            else
                print("Saved hash too short, regenerating...")
            end
        else
            print("Saved hash file is empty")
        end
    else
        print("No saved hash file found")
    end
    --]]

end

-- Simple JSON parser for basic responses
function parseJSON(str)
    if not str or str == "" then
        return nil
    end

    local result = {}

    -- Extract is_valid
    local is_valid = string.match(str, '"is_valid":%s*([^,}]+)')
    if is_valid then
        result.is_valid = is_valid == "true"
    end

    -- Extract status
    local status = string.match(str, '"status":%s*"([^"]+)"')
    if status then
        result.status = status
    end

    -- Extract message
    local message = string.match(str, '"message":%s*"([^"]+)"')
    if message then
        result.message = message
    end

    -- Extract trial_ends_at
    local trial_ends_at = string.match(str, '"trial_ends_at":%s*"([^"]+)"')
    if trial_ends_at then
        result.trial_ends_at = trial_ends_at
    end

    -- Extract time_remaining_seconds
    local time_remaining = string.match(str, '"time_remaining_seconds":%s*([^,}]+)')
    if time_remaining then
        result.time_remaining_seconds = tonumber(time_remaining)
    end

    -- Extract cached_at
    local cached_at = string.match(str, '"cached_at":%s*([^,}]+)')
    if cached_at then
        result.cached_at = tonumber(cached_at)
    end

    -- Extract expires_at
    local expires_at = string.match(str, '"expires_at":%s*([^,}]+)')
    if expires_at then
        result.expires_at = tonumber(expires_at)
    end

    return result
end

-- キャッシュ読み込み
function loadCache()
    local file = io.open(CACHE_FILE, "r")
    if not file then
        -- 代替パスを試行
        local fallbackCacheFile = "/tmp/smartgram_cache"
        file = io.open(fallbackCacheFile, "r")
        if file then
            CACHE_FILE = fallbackCacheFile  -- パスを更新
        else
            return nil
        end
    end

    local content = file:read("*all")
    file:close()

    if not content or content == "" then
        return nil
    end

    local cache = parseJSON(content)
    if not cache then
        return nil
    end

    -- キャッシュ有効期限チェック
    local now = os.time()
    if cache.expires_at and cache.expires_at > now then
        return cache
    else
        return nil
    end
end

-- Convert table to JSON string
function toJSON(data)
    if not data then
        return "{}"
    end

    local parts = {}

    if data.is_valid ~= nil then
        table.insert(parts, '"is_valid":' .. (data.is_valid and "true" or "false"))
    end

    if data.status then
        table.insert(parts, '"status":"' .. data.status .. '"')
    end

    if data.message then
        table.insert(parts, '"message":"' .. data.message .. '"')
    end

    if data.trial_ends_at then
        table.insert(parts, '"trial_ends_at":"' .. data.trial_ends_at .. '"')
    end

    if data.cached_at then
        table.insert(parts, '"cached_at":' .. tostring(data.cached_at))
    end

    if data.expires_at then
        table.insert(parts, '"expires_at":' .. tostring(data.expires_at))
    end

    if data.time_remaining_seconds then
        table.insert(parts, '"time_remaining_seconds":' .. tostring(data.time_remaining_seconds))
    end

    return "{" .. table.concat(parts, ",") .. "}"
end

-- キャッシュ保存
function saveCache(data)
    -- キャッシュディレクトリを作成
    local cacheDir = "/var/mobile/Library/AutoTouch/Scripts"
    pcall(function()
        os.execute("mkdir -p " .. cacheDir)
    end)

    data.cached_at = os.time()
    data.expires_at = os.time() + CACHE_DURATION

    local jsonString = toJSON(data)

    local file = io.open(CACHE_FILE, "w")
    if file then
        file:write(jsonString)
        file:close()
        return true
    else
        -- 代替パスを試行
        local fallbackCacheFile = "/tmp/smartgram_cache"
        local fallbackFile = io.open(fallbackCacheFile, "w")
        if fallbackFile then
            fallbackFile:write(jsonString)
            fallbackFile:close()
            CACHE_FILE = fallbackCacheFile
            return true
        else
            return false
        end
    end
end

-- WebView経由でAPI認証を実行
function tryWebViewAuthentication(deviceHash)
    print("🌐 WebView経由でAPI認証を開始...")

    -- 認証用WebページのURL（デバイスハッシュをパラメータで渡す）
    local authURL = string.format("https://smartgram.jp/auth-mobile?device_hash=%s&source=autotools", deviceHash)
    print("📱 認証ページを開きます:", authURL)

    -- WebページでAPI接続を実行し、結果をURLスキーム経由で受け取る
    local success, result = pcall(function()
        return openURL(authURL)
    end)

    if success then
        print("✅ 認証ページを開きました")
        print("⏳ API認証処理中...")

        -- WebView認証の完了を待機（URLスキーム経由で結果を受け取る）
        return waitForWebViewResult(deviceHash)
    else
        print("❌ 認証ページの表示に失敗:", tostring(result))
        return nil
    end
end

-- WebView認証結果の待機
function waitForWebViewResult(deviceHash)
    print("📲 認証結果を待機中...")

    -- AutoTouchアプリに戻る（ユーザーが手動で操作しやすくするため）
    local success, activateResult = pcall(function()
        appActivate("me.autotouch.AutoTouch.ios8")
        print("📱 AutoTouchアプリに戻りました")
    end)

    if not success then
        print("⚠️ AutoTouchアプリの起動に失敗 (手動で戻ってください):", activateResult)
    end

    -- 結果ファイルのパス（WebページがJavaScript経由で書き込む）
    local resultFile = "/tmp/smartgram_auth_result.json"
    local maxWaitTime = 30  -- 30秒まで待機
    local waitInterval = 1  -- 1秒間隔でチェック

    for i = 1, maxWaitTime do
        -- 結果ファイルの存在確認
        local file = io.open(resultFile, "r")
        if file then
            local content = file:read("*all")
            file:close()

            if content and content ~= "" then
                print("✅ 認証結果を受信しました")
                print("📊 レスポンス:", content)

                -- 結果ファイルを削除（次回実行のため）
                os.remove(resultFile)

                return content
            end
        end

        -- プログレス表示
        if i % 5 == 0 then
            print(string.format("⏳ 認証処理中... (%d/%d秒)", i, maxWaitTime))
        end

        -- 1秒待機
        usleep(1000000)
    end

    print("⏰ 認証がタイムアウトしました")
    return nil
end

-- HTTPリクエスト用ヘルパー関数（WebView方式優先）
function tryHttpRequest(url, body)
    print("🌐 Smartgram APIサーバーに接続中...")

    local deviceHash = string.match(body, '"device_hash":"([^"]+)"')
    print("📱 デバイスハッシュ:", deviceHash)

    -- Method 1: WebView経由の認証（推奨方式）
    print("🔄 WebView経由でAPI認証を試行...")
    local webResult = tryWebViewAuthentication(deviceHash)
    if webResult then
        return webResult
    end

    -- Method 2: 直接HTTP接続（フォールバック）
    print("⏳ 直接HTTP接続を試行中...")
    local success, response = pcall(function()
        local headers = {
            ["Content-Type"] = "application/json",
            ["Accept"] = "application/json"
        }
        return httpPost(url, body, headers)
    end)

    if success and response and response ~= "" then
        print("✅ 直接HTTP接続成功")
        if not string.find(response, "<!DOCTYPE") and not string.find(response, "<html") then
            return response
        else
            print("❌ HTMLエラーページを受信")
        end
    else
        print("❌ 直接HTTP接続失敗:", tostring(response))
    end

    -- すべての方法が失敗
    print("❌ すべての接続方法が失敗しました")
    print("📱 ブラウザでの認証も完了していない可能性があります")

    return nil
end

-- ライセンス検証（初回実行時は自動的に体験期間開始）
function verifyLicense(deviceHash)

    -- Validate device hash before sending
    if not deviceHash or deviceHash == "" then
        print("ERROR: Device hash is empty!")
        return nil, "Device hash is empty"
    end

    if string.len(deviceHash) < 12 then
        print("ERROR: Device hash too short:", string.len(deviceHash))
        return nil, "Device hash too short"
    end


    local url = API_BASE_URL .. "/license/verify"
    local body = '{"device_hash":"' .. deviceHash .. '"}'

    -- Try HTTP request
    local response = tryHttpRequest(url, body)

    if not response then
        print("❌ APIサーバーへの接続に失敗しました")
        print("🔌 インターネット接続が必要です")
        -- オフラインではツールを使用不可
        return nil, "ネットワーク接続エラー: Smartgramサーバーに接続できません。\n\nインターネット接続を確認してください。"
    end

    -- Debug: Show response content (logged only)

    if not response or response == "" then
        return nil, "サーバーからの応答がありません"
    end

    -- Check if response is HTML (error page)
    if string.find(response, "<!DOCTYPE") or string.find(response, "<html") then
        print("❌ APIエンドポイントエラー: HTMLページを受信")
        return nil, "APIエラー: Smartgramサーバーが正しく応答していません。\n\nしばらく時間をおいてから再度お試しください。"
    end

    -- Parse JSON response
    local data = parseJSON(response)
    if not data then
        print("JSON parsing failed for response")
        return nil, "レスポンス解析エラー"
    end

    -- デバッグ: パースされたデータを確認
    print("🔍 デバッグ: APIレスポンス詳細:")
    print("  - is_valid:", data.is_valid)
    print("  - status:", data.status)
    print("  - time_remaining_seconds:", data.time_remaining_seconds)
    print("  - trial_ends_at:", data.trial_ends_at)


    -- サーバーが初回実行時に自動的に体験期間を開始
    if data.is_valid then
        print("✅ サーバー認証成功")
        print("📊 ステータス: " .. (data.status or "unknown"))
        -- 動的に残り時間を計算してログに表示
        local now = os.time()
        local actualExpiryTime = nil

        -- APIから受け取った実際の有効期限を使用
        if data.trial_ends_at then
            -- trial_ends_atがISO8601形式の場合の処理
            if type(data.trial_ends_at) == "string" and data.trial_ends_at:match("T") then
                -- ISO8601からUnixタイムスタンプへ変換
                local year, month, day, hour, min, sec = data.trial_ends_at:match("(%d+)-(%d+)-(%d+)T(%d+):(%d+):(%d+)")
                if year then
                    actualExpiryTime = os.time({year=tonumber(year), month=tonumber(month), day=tonumber(day), hour=tonumber(hour), min=tonumber(min), sec=tonumber(sec)})
                end
            else
                -- 既にUnixタイムスタンプの場合
                actualExpiryTime = tonumber(data.trial_ends_at)
            end
        elseif data.expires_at then
            actualExpiryTime = tonumber(data.expires_at)
        end

        if actualExpiryTime then
            local currentTimeRemaining = math.max(0, actualExpiryTime - now)
            local days = math.floor(currentTimeRemaining / 86400)
            local hours = math.floor((currentTimeRemaining % 86400) / 3600)
            print("⏰ Trial: " .. days .. "日" .. hours .. "時間 残り")
        elseif data.time_remaining_seconds then
            local days = math.floor(data.time_remaining_seconds / 86400)
            local hours = math.floor((data.time_remaining_seconds % 86400) / 3600)
            print("⏰ Trial: " .. days .. "日" .. hours .. "時間 残り")
        end
        if data.trial_ends_at then
            print("📅 有効期限: " .. data.trial_ends_at)
        end

        -- キャッシュ保存と確認
        print("🔍 デバッグ: キャッシュ保存前のデータ:")
        print("  - time_remaining_seconds:", data.time_remaining_seconds)
        saveCache(data)

        -- 保存確認
        local savedCache = loadCache()
        if savedCache then
            print("🔍 デバッグ: 保存されたキャッシュの確認:")
            print("  - time_remaining_seconds:", savedCache.time_remaining_seconds)
            print("  - status:", savedCache.status)
        else
            print("⚠️ キャッシュの保存に失敗しました")
        end

        return data, nil
    else
        print("❌ Server authentication FAILED:", (data.message or "ライセンス無効"))
        return nil, data.message or "ライセンス無効"
    end
end

-- 登録画面表示
function showRegistrationScreen(deviceHash)
    -- AutoTouch dialog format
    dialog({
        title = "📱 デバイス未登録",
        message = "デバイスハッシュ:\n" .. deviceHash .. "\n\n" ..
                  "このデバイスは未登録です。\n" ..
                  "以下の手順で登録してください:\n\n" ..
                  "1. ブラウザで以下のURLを開く:\n" ..
                  "   https://smartgram.jp/register\n\n" ..
                  "2. メールアドレスとパスワードで登録\n\n" ..
                  "3. PayPalで支払い完了\n\n" ..
                  "4. このスクリプトを再実行\n\n" ..
                  "支払い完了後、初回実行時に自動的に\n" ..
                  "3日間の体験期間が開始されます。",
        buttons = {"OK"}
    })
    return false
end

-- 期限切れ画面表示
function showExpiredScreen()
    dialog({
        title = "⏰ 体験期間終了",
        message = "3日間の体験期間が終了しました。\n\n" ..
                  "継続利用するには有料プランへの\n" ..
                  "アップグレードが必要です。\n\n" ..
                  "ダッシュボードで契約状況を確認:\n" ..
                  "https://smartgram.jpdashboard\n\n" ..
                  "※PayPalの自動更新が有効な場合は\n" ..
                  "自動的に有料プランに移行します。",
        buttons = {"OK"}
    })
    return false
end

-- 体験期間開始メッセージ
function showTrialActivatedMessage(data)
    local endDate = ""
    if data.trial_ends_at then
        -- Unix timestampから日時文字列に変換
        local endTime = tonumber(data.trial_ends_at)
        if endTime then
            endDate = os.date("%Y年%m月%d日 %H:%M", endTime)
        else
            endDate = data.trial_ends_at
        end
    end

    dialog({
        title = "🎉 体験期間開始",
        message = "3日間（72時間）すべての機能を\n" ..
                  "無料でご利用いただけます。\n\n" ..
                  "体験期間終了予定:\n" ..
                  endDate .. "\n\n" ..
                  "体験期間終了後は自動的に\n" ..
                  "月額プランに移行します。\n\n" ..
                  "それでは、Smartgramを\n" ..
                  "お楽しみください！",
        buttons = {"開始"}
    })
end

-- ツール選択メニュー表示（AutoTouch CONTROLLER_TYPE使用）
function showToolMenu()
    local licenseStatus = getLicense() or "NONE"
    local licenseDetails = getLicenseDetails()

    -- 利用可能ツールの定義
    local tools = {
        {name = "Timeline Tool", desc = "タイムライン自動いいね", file = "timeline.lua"},
        {name = "Story Viewer", desc = "ストーリー自動視聴", file = "story.lua"},
        {name = "Follow Manager", desc = "フォロー管理ツール", file = "follow.lua"},
        {name = "DM Reply", desc = "DM自動返信", file = "dm.lua"}
    }

    -- ツール選択オプションの作成
    local toolOptions = {}
    for _, tool in ipairs(tools) do
        table.insert(toolOptions, tool.name .. " - " .. tool.desc)
    end

    -- AutoTouch用高度ダイアログ（CONTROLLER_TYPE使用）
    local controls = {
        -- タイトル
        {
            type = CONTROLLER_TYPE.LABEL,
            text = "🛠️ Smartgram ツール選択 🛠️"
        },

        -- ライセンス状態表示
        {
            type = CONTROLLER_TYPE.LABEL,
            text = "ライセンス: " .. (licenseStatus == "TRIAL" and "体験版" or licenseStatus == "PRO" and "有料版" or "未認証")
        },

        -- セパレーター
        {
            type = CONTROLLER_TYPE.LABEL,
            text = "━━━━━━━━━━━━━━━━━━━"
        },

        -- 残り時間表示
        {
            type = CONTROLLER_TYPE.LABEL,
            text = licenseDetails.time_remaining_seconds and
                   string.format("残り時間: %d時間", math.floor(licenseDetails.time_remaining_seconds / 3600)) or
                   "残り時間: 不明"
        },

        -- セパレーター
        {
            type = CONTROLLER_TYPE.LABEL,
            text = "━━━━━━━━━━━━━━━━━━━"
        },

        -- 説明文
        {
            type = CONTROLLER_TYPE.LABEL,
            text = "使用するツールを選択してください："
        },

        -- ツール選択ピッカー
        {
            type = CONTROLLER_TYPE.PICKER,
            title = "🎯 ツール選択:",
            key = "selected_tool",
            value = toolOptions[1] or "",
            options = toolOptions
        },

        -- セパレーター
        {
            type = CONTROLLER_TYPE.LABEL,
            text = "━━━━━━━━━━━━━━━━━━━"
        },

        -- 注意事項
        {
            type = CONTROLLER_TYPE.LABEL,
            text = "⚠️ 使用上の注意"
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

        -- 実行ボタン（緑色）
        {
            type = CONTROLLER_TYPE.BUTTON,
            title = "▶️ 実行",
            color = 0x68D391,
            width = 0.25,
            flag = 1,
            collectInputs = true
        },

        -- 設定ボタン（青色）
        {
            type = CONTROLLER_TYPE.BUTTON,
            title = "⚙️ 設定",
            color = 0x4A90E2,
            width = 0.25,
            flag = 2,
            collectInputs = false
        },

        -- 再認証ボタン（オレンジ色）
        {
            type = CONTROLLER_TYPE.BUTTON,
            title = "🔄 再認証",
            color = 0xFF9500,
            width = 0.25,
            flag = 4,
            collectInputs = false
        },

        -- 終了ボタン（赤色）
        {
            type = CONTROLLER_TYPE.BUTTON,
            title = "❌ 終了",
            color = 0xFF5733,
            width = 0.25,
            flag = 3,
            collectInputs = false
        }
    }

    -- ダイアログ表示（画面回転対応）
    local orientations = {
        ORIENTATION_TYPE.PORTRAIT,
        ORIENTATION_TYPE.LANDSCAPE_LEFT,
        ORIENTATION_TYPE.LANDSCAPE_RIGHT
    }

    local result = dialog(controls, orientations)

    if not result or result == nil or result == "" then
        -- フォールバック: 従来のシンプルダイアログ
        print("⚠️ 高度ダイアログが失敗しました。シンプルダイアログにフォールバックします")
        result = dialog({
            title = "Smartgram ツール選択",
            message = "認証完了！使用するツールを選択:",
            buttons = {
                "Timeline Tool",
                "Story Viewer",
                "Follow Manager",
                "DM Reply",
                "設定",
                "終了"
            }
        })

        if not result then
            print("Fallback dialog also failed, using default Timeline Tool")
            result = 1
        end

        -- シンプルダイアログの結果処理
        return handleSimpleDialogResult(result)
    end

    -- 高度ダイアログの結果処理

    -- 結果が有効な数値かチェック
    if type(result) ~= "number" or result == 0 then
        print("⚠️ 無効なダイアログ結果です。シンプルダイアログにフォールバックします")
        result = dialog({
            title = "Smartgram ツール選択",
            message = "認証完了！使用するツールを選択:",
            buttons = {
                "Timeline Tool",
                "Story Viewer",
                "Follow Manager",
                "DM Reply",
                "設定",
                "終了"
            }
        })
        print("フォールバックダイアログの結果:", tostring(result))
        return handleSimpleDialogResult(result)
    end

    if result == 1 then  -- 実行ボタン
        -- デフォルトでtimeline.luaを実行（ピッカー値の取得が困難なため）
        print("選択されたツール: Timeline Tool (デフォルト)")
        print("実行ファイル: timeline.lua")

        return executeSelectedTool("timeline.lua")

    elseif result == 2 then  -- 設定ボタン
        print("設定ボタンが押されました")
        print("🌐 ログイン機能を直接実行します")

        -- ダイアログを経由せずに直接ログイン処理を実行
        openLoginPage()

        print("ログイン処理が完了しました")
        return showToolMenu() -- ログイン処理後にメニューに戻る

    elseif result == 4 then  -- 再認証ボタン
        return performReAuthentication()

    else  -- 終了ボタン (result == 3)
        return false
    end
end

-- ツール実行共通関数
function executeSelectedTool(toolFile)
    print("Executing tool:", toolFile)

    -- 複数のパスを試行してファイルを探す
    local possiblePaths = {
        "/var/mobile/Library/AutoTouch/Scripts/Smartgram.at/functions/" .. toolFile,
        "/var/mobile/Library/AutoTouch/Scripts/" .. toolFile,
        "/var/jb/var/mobile/Library/AutoTouch/Scripts/Smartgram.at/functions/" .. toolFile,
        "/var/jb/var/mobile/Library/AutoTouch/Scripts/" .. toolFile
    }

    -- rootDir()が使用可能な場合は追加
    if rootDir then
        local rootPath = rootDir()
        if rootPath then
            table.insert(possiblePaths, 1, rootPath .. "/Smartgram.at/functions/" .. toolFile)
            table.insert(possiblePaths, 2, rootPath .. "/" .. toolFile)
            print("Root path:", rootPath)
        end
    end

    local absolutePath = nil

    -- 各パスを順番に試行
    for i, path in ipairs(possiblePaths) do
        print("試行パス " .. i .. ":", path)
        local checkFile = io.open(path, "r")
        if checkFile then
            checkFile:close()
            absolutePath = path
            print("✅ ファイル発見:", absolutePath)
            break
        else
            print("❌ ファイルなし:", path)
        end
    end

    if not absolutePath then
        print("❌ 全てのパスでファイルが見つかりませんでした")
        print("利用可能パス:")
        for i, path in ipairs(possiblePaths) do
            print("  " .. i .. ". " .. path)
        end
        return false
    end

    if toolFile == "timeline.lua" then
        return executeTool("Timeline Tool", absolutePath)
    elseif toolFile == "story.lua" then
        return executeTool("Story Viewer", absolutePath)
    elseif toolFile == "follow.lua" then
        return executeTool("Follow Manager", absolutePath)
    elseif toolFile == "dm.lua" then
        return executeTool("DM Reply", absolutePath)
    else
        print("Unknown tool:", toolFile)
        return executeTool("Timeline Tool", absolutePath)
    end
end

-- ツール実行関数
function executeTool(toolName, toolPath)
    print("Attempting to execute:", toolName)
    print("Tool path:", toolPath)

    -- ファイル存在確認
    local checkFile = io.open(toolPath, "r")
    if not checkFile then
        print("❌ ファイルが見つかりません:", toolPath)
        showToast("❌ ファイルが見つかりません: " .. toolName)

        dialog({
            title = "ファイルエラー",
            message = "ファイルが見つかりません:\n" .. toolPath .. "\n\n配置場所を確認してください。",
            buttons = {"OK"}
        })
        return false
    end
    checkFile:close()
    print("✅ ファイル確認完了:", toolPath)

    local success, err = pcall(function()
        print("🎯 dofile実行:", toolPath)
        dofile(toolPath)
    end)

    if not success then
        local errorMessage = tostring(err)
        print("Tool execution failed:", errorMessage)

        -- ユーザーキャンセルの場合とエラーの場合を区別
        if errorMessage:find("interrupted") or errorMessage:find("cancel") or errorMessage:find("abort") then
            print("ユーザーによってキャンセルされました")
            -- timeline.lua側でトーストが表示されるため、main.lua側のトーストは削除
        else
            print("実行エラーが発生しました")
            showToast("❌ " .. toolName .. " 実行エラー")

            -- エラーダイアログ
            dialog({
                title = toolName .. " エラー",
                message = "実行中にエラーが発生しました:\n\n" .. errorMessage,
                buttons = {"OK"}
            })
        end
    else
        print("Tool executed successfully:", toolName)
    end

    return true  -- メニューに戻る
end

-- 再認証機能
function performReAuthentication()
    showToast("🔄 再認証中...")

    -- キャッシュファイルを削除して強制的に再認証
    local cacheFile = "/var/mobile/Library/AutoTouch/Scripts/.smartgram_cache"
    local success, err = pcall(function()
        os.remove(cacheFile)
    end)

    if success then
    else
        print("Failed to clear cache:", err)
    end

    -- 再認証プロセスを実行
    showToast("🔐 ライセンス確認中...")

    local deviceHash = getDeviceHash()

    -- サーバー認証を実行（キャッシュなし）
    local result, error = verifyLicense(deviceHash)

    if error then
        print("再認証失敗:", error)
        showToast("❌ 再認証失敗")

        -- ネットワークエラーの場合は専用ダイアログ
        if string.find(error, "ネットワーク接続エラー") then
            dialog({
                title = "🔌 ネットワーク接続エラー",
                message = "再認証にはインターネット接続が必要です。\n\n" ..
                         "接続を確認してから再度お試しください。",
                buttons = {"OK"}
            })
        else
            -- その他のエラー
            dialog({
                title = "🔄 再認証エラー",
                message = "再認証に失敗しました。\n\n" .. tostring(error) .. "\n\nしばらく時間をおいてから\n再度お試しください。",
                buttons = {"OK"}
            })
        end

        return showToolMenu() -- メニューに戻る
    end

    if not result or not result.is_valid then
        print("再認証失敗: 無効なライセンス")
        showToast("❌ ライセンス無効")

        -- ライセンス無効ダイアログ
        dialog({
            title = "🔄 ライセンス状態",
            message = "ライセンスが無効です。\n\n" .. (result and result.message or "ライセンスが見つかりません") .. "\n\n登録が必要な場合は設定から\n確認してください。",
            buttons = {"OK"}
        })

        return showToolMenu() -- メニューに戻る
    end

    -- 再認証成功 - キャッシュを明示的に保存
    saveCache(result)

    -- キャッシュ保存確認
    local savedCache = loadCache()

    showToast("✅ 再認証成功")

    -- 成功ダイアログ表示
    local statusMessage = ""
    if result.status == "trial" then
        local hours = result.time_remaining_seconds and math.floor(result.time_remaining_seconds / 3600) or 0
        statusMessage = string.format("体験版 (残り%d時間)", hours)
    elseif result.status == "active" then
        statusMessage = "有料版 (アクティブ)"
    else
        statusMessage = result.status or "不明"
    end

    dialog({
        title = "✅ 再認証完了",
        message = "ライセンス認証が完了しました。\n\n" ..
                  "ステータス: " .. statusMessage .. "\n\n" ..
                  "最新の情報でツールをご利用いただけます。",
        buttons = {"ツール選択へ"}
    })

    return showToolMenu() -- 更新されたライセンス情報でメニューに戻る
end

-- シンプルダイアログの結果処理関数
function handleSimpleDialogResult(result)
    print("Processing simple dialog result:", result)

    local choice = result - 1  -- Convert to 0-based index
    print("Selected choice: " .. tostring(choice))

    if choice == 0 then
        return executeSelectedTool("timeline.lua")
    elseif choice == 1 then
        return executeSelectedTool("story.lua")
    elseif choice == 2 then
        return executeSelectedTool("follow.lua")
    elseif choice == 3 then
        return executeSelectedTool("dm.lua")
    elseif choice == 4 then
        print("シンプルダイアログで設定ボタンが押されました")
        print("🌐 ログイン機能を直接実行します（シンプルダイアログ）")

        -- ダイアログを経由せずに直接ログイン処理を実行
        openLoginPage()

        print("ログイン処理が完了しました（シンプルダイアログ）")
        return showToolMenu() -- ログイン処理後にメニューに戻る
    elseif choice == 5 then
        return false
    else
        return false
    end
end

-- ログ表示メニュー（簡易版）
function showLogMenu()
    dialog({
        title = "📋 実行ログ",
        message = "ログはAutoTouchのコンソール出力で\n確認してください。\n\nprint文で出力されたメッセージが\n表示されます。",
        buttons = {"OK"}
    })
end

-- 設定メニュー
function showSettingsMenu()
    print("🔧 showSettingsMenu() 開始")
    local deviceHash = getDeviceHash()
    local licenseStatus = getLicense() -- AutoTouchスタイル
    local licenseDetails = getLicenseDetails() -- 詳細情報

    local status = licenseDetails.status or "不明"
    local expires = "不明"

    if licenseDetails.trial_ends_at then
        local endTime = tonumber(licenseDetails.trial_ends_at)
        if endTime then
            expires = os.date("%Y/%m/%d %H:%M", endTime)
        else
            expires = licenseDetails.trial_ends_at
        end
    end

    -- AutoTouchスタイルの表示
    local licenseDisplay = "未認証"
    if licenseStatus == "TRIAL" then
        licenseDisplay = "体験版 (TRIAL)"
    elseif licenseStatus == "PRO" then
        licenseDisplay = "有料版 (PRO)"
    end

    local remainingTime = ""
    if licenseDetails.time_remaining_seconds and licenseDetails.time_remaining_seconds > 0 then
        local hours = math.floor(licenseDetails.time_remaining_seconds / 3600)
        local minutes = math.floor((licenseDetails.time_remaining_seconds % 3600) / 60)
        remainingTime = "\n残り時間: " .. hours .. "時間" .. minutes .. "分"
    end

    print("🔧 設定ダイアログを表示します（シンプル形式）")
    local settingsResult = dialog({
        title = "⚙️ Smartgram ライセンス情報",
        message = "デバイスハッシュ:\n" .. deviceHash .. "\n\n" ..
                  "ライセンス: " .. licenseDisplay .. "\n" ..
                  "ステータス: " .. status .. "\n" ..
                  "有効期限: " .. expires .. remainingTime .. "\n\n" ..
                  "ダッシュボード:\n" ..
                  "https://smartgram.jp/dashboard",
        buttons = {"🌐 ログインページを開く", "ライセンス確認", "閉じる"}
    })

    print("🔧 設定ダイアログの結果:", tostring(settingsResult))
    print("🔧 設定ダイアログの結果の型:", type(settingsResult))

    -- 設定ダイアログの結果処理
    if not settingsResult or settingsResult == "" then
        print("⚠️ 設定ダイアログの結果が無効です。デフォルト処理を実行します")
        -- デフォルト処理: 詳細な設定情報を再表示
        local retryResult = dialog({
            title = "⚙️ Smartgram ライセンス情報 (再試行)",
            message = "デバイスハッシュ: " .. deviceHash .. "\n" ..
                      "ライセンス: " .. licenseDisplay .. "\n" ..
                      "ステータス: " .. status .. "\n\n" ..
                      "操作を選択してください:",
            buttons = {"ログインページを開く", "閉じる"}
        })
        print("🔧 再試行ダイアログの結果:", tostring(retryResult))
        if retryResult == 1 then
            openLoginPage()
        end
    elseif settingsResult == 1 then
        -- ログインページを開く
        print("ログインページを開くボタンが押されました")
        openLoginPage()
    elseif settingsResult == 2 then
        -- ライセンス確認（従来の処理）
        print("ライセンス確認が選択されました")
    else
        print("設定ダイアログが閉じられました (結果:", tostring(settingsResult), ")")
    end
end

-- ログインページを開く関数（Safari強化版）
function openLoginPage()
    local loginURL = "https://smartgram.jp/login/"
    local deviceHash = getDeviceHash()

    print("🌐 Safariでログインページを開いています...")

    local urlWithDevice = loginURL .. "?device=" .. deviceHash
    print("URL:"..urlWithDevice)

    local success, err = pcall(function()
        if openURL then
            openURL(urlWithDevice)
            return true
        else
            error("openURL function not available")
        end
    end)

    if success then
        print("✅ Safariでログインページを開きました")
        showToast("🌐 Safariでログインページを開きました", 3)

        -- 短い待機の後に手順案内
        usleep(2000000) -- 2秒待機（Safariの起動を待つ）
        showLoginInstructions(deviceHash)
    else
        print("❌ Safari起動に失敗しました:", tostring(err))
        -- 最終手段として手動ログイン案内を表示
        showManualLoginInstructions(loginURL, deviceHash)
    end
end

-- ログイン手順の案内
function showLoginInstructions(deviceHash)
    local instructionResult = dialog({
        title = "📱 ログイン手順",
        message = "Safariでログインページが開きました！\n\n" ..
                  "【ログイン手順】\n" ..
                  "1. メールアドレスを入力\n" ..
                  "2. パスワードを入力\n" ..
                  "3. ログインボタンをタップ\n\n" ..
                  "【デバイス登録】\n" ..
                  "新規登録の場合はデバイスハッシュ:\n" ..
                  deviceHash,
        buttons = {"デバイスハッシュをコピー", "OK"}
    })

    if instructionResult == 1 then
        -- デバイスハッシュをクリップボードにコピー
        if copyText then
            copyText(deviceHash)
            showToast("📋 デバイスハッシュをコピーしました")
            print("📋 デバイスハッシュをクリップボードにコピー:", deviceHash)
        else
            showToast("⚠️ クリップボード機能が利用できません")
        end
    end
end

-- 手動ログイン手順（最終手段）
function showManualLoginInstructions(loginURL, deviceHash)
    print("❌ 全ての自動起動方法が失敗しました")

    local manualResult = dialog({
        title = "📱 手動でログインしてください",
        message = "自動でSafariを開けませんでした。\n\n" ..
                  "【手動手順】\n" ..
                  "1. Safariを開く\n" ..
                  "2. 以下のURLにアクセス:\n" ..
                  loginURL .. "\n\n" ..
                  "【デバイスハッシュ】\n" ..
                  deviceHash,
        buttons = {"URLをコピー", "デバイスハッシュをコピー", "閉じる"}
    })

    if manualResult == 1 then
        -- URLをクリップボードにコピー
        if copyText then
            copyText(loginURL)
            showToast("📋 URLをクリップボードにコピーしました")
            print("📋 URLをクリップボードにコピー:", loginURL)
        end
    elseif manualResult == 2 then
        -- デバイスハッシュをクリップボードにコピー
        if copyText then
            copyText(deviceHash)
            showToast("📋 デバイスハッシュをコピーしました")
            print("📋 デバイスハッシュをクリップボードにコピー:", deviceHash)
        end
    end
end

-- キャッシュクリア機能
function clearCache()
    local cacheFiles = {
        "/var/mobile/Library/AutoTouch/Scripts/.smartgram_cache",
        "/tmp/smartgram_cache"
    }

    local clearedCount = 0
    for _, cacheFile in ipairs(cacheFiles) do
        local success, err = pcall(function()
            os.remove(cacheFile)
        end)
        if success then
            clearedCount = clearedCount + 1
            print("🗑️ キャッシュクリア:", cacheFile)
        end
    end

    if clearedCount > 0 then
        print("✅ キャッシュクリア完了 (" .. clearedCount .. "個)")
        return true
    else
        print("ℹ️ クリア対象のキャッシュファイルがありませんでした")
        return false
    end
end

-- ライセンスチェック
function checkLicense()
    print("🚀 Smartgram License Manager START")
    print("📱 Version: 3.1.0 (オンライン専用版)")
    print("🌐 実際のデータベース接続が必要です")

    -- 古いキャッシュをクリア（確実にサーバーに接続するため）
    print("🗑️ 古いキャッシュをクリアしています...")
    clearCache()

    -- デバイスハッシュ取得
    local deviceHash = getDeviceHash()

    -- Final validation before proceeding
    if not deviceHash or deviceHash == "" then
        print("CRITICAL ERROR: Device hash is empty after getDeviceHash()")
        dialog({
            title = "❌ エラー",
            message = "デバイスハッシュの取得に失敗しました。\n\n" ..
                     "AutoTouchの設定を確認してください。",
            buttons = {"OK"}
        })
        return false
    end

    -- キャッシュチェック（24時間有効）
    local cache = loadCache()
    if cache and cache.is_valid then
        -- 有効期限チェック
        if cache.status == "trial" and cache.trial_ends_at then
            local trialEnd = tonumber(cache.trial_ends_at)
            if trialEnd and trialEnd > os.time() then
                local remainingHours = math.floor((trialEnd - os.time()) / 3600)
                print("Cache validation SUCCESS - Trial remaining: " .. remainingHours .. " hours")
                showToast("体験期間: 残り " .. remainingHours .. " 時間")
                return true
            end
        elseif cache.status == "active" then
            print("Cache validation SUCCESS - Active license")
            showToast("ライセンス: 有効 (有料会員)")
            return true
        end
    else
        print("No valid cache found - proceeding to server verification")
    end

    -- 実際のSmartgramサーバーに接続してライセンス検証
    print("📡 Smartgramサーバーとの通信を開始...")
    print("🔗 エンドポイント: " .. API_BASE_URL .. "/license/verify")
    local result, error = verifyLicense(deviceHash)

    if error then
        if string.find(error, "not registered") or string.find(error, "not found") then
            return showRegistrationScreen(deviceHash)
        elseif string.find(error, "ネットワーク接続エラー") then
            -- ネットワークエラー専用のダイアログ
            dialog({
                title = "🔌 インターネット接続が必要",
                message = "Smartgramを使用するには\nインターネット接続が必要です。\n\n" ..
                         "以下を確認してください:\n" ..
                         "• Wi-Fiまたはモバイルデータが有効\n" ..
                         "• 機内モードがOFF\n" ..
                         "• VPNやプロキシの設定\n\n" ..
                         "接続確認後、再度お試しください。",
                buttons = {"OK"}
            })
            return false
        else
            dialog({
                title = "⚠️ エラー",
                message = error,
                buttons = {"OK"}
            })
            return false
        end
    end

    if not result or not result.is_valid then
        if result and result.status == "expired" then
            return showExpiredScreen()
        elseif result and result.status == "unregistered" then
            return showRegistrationScreen(deviceHash)
        else
            dialog({
                title = "ライセンス無効",
                message = "ステータス: " .. (result and result.status or "unknown") .. "\n\n" ..
                         "サポートにお問い合わせください。",
                buttons = {"OK"}
            })
            return false
        end
    end

    -- ライセンス有効
    if result.status == "trial" then
        -- 初回アクティベーションメッセージ表示
        if result.message and string.find(result.message, "activated") then
            showTrialActivatedMessage(result)
        else
            local remainingSeconds = result.time_remaining_seconds or 0
            local remainingHours = math.floor(remainingSeconds / 3600)
            print("Trial ongoing - remaining: " .. remainingHours .. " hours")
            showToast("体験期間: 残り " .. remainingHours .. " 時間")
        end
    elseif result.status == "active" then
        showToast("ライセンス: 有効 (有料会員)")
    end

    return true
end

-- ================================
-- メイン処理
-- ================================
function main()
    -- ライセンスチェック
    if not checkLicense() then
        print("License check failed - main() exiting")
        showToast("ライセンス認証に失敗しました")
        return
    end


    -- AutoTouchスタイルのライセンス情報取得
    local licenseStatus = getLicense()
    local licenseDetails = getLicenseDetails()

    local licenseDisplay = "ライセンス認証完了"
    if licenseStatus == "TRIAL" then
        licenseDisplay = "体験版 (TRIAL) アクティブ"
    elseif licenseStatus == "PRO" then
        licenseDisplay = "有料版 (PRO) アクティブ"
    end

    local timeInfo = ""
    if licenseDetails.time_remaining_seconds and licenseDetails.time_remaining_seconds > 0 then
        local hours = math.floor(licenseDetails.time_remaining_seconds / 3600)
        timeInfo = "\n残り時間: " .. hours .. " 時間"
    end

    -- 認証成功を明確に表示（AutoTouch環境対応）
    local dialogResult = dialog({
        title = "✅ " .. licenseDisplay,
        message = "Smartgram ライセンス認証が完了しました。" .. timeInfo .. "\n\n使用するツールを選択してください。",
        buttons = {"ツール選択へ"}
    })

    -- ツール選択メニュー表示
    while showToolMenu() do
        -- ツールが実行された後、メニューに戻る
        local success_sleep, err_sleep = pcall(function()
            usleep(1000000)  -- 1 second in microseconds
        end)

        if not success_sleep then
            print("usleep not available, continuing without delay")
        end
    end
end

-- スクリプト実行
main()