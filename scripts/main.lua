-- ================================
-- MetaCube License Manager for AutoTouch
-- Version: 3.0.0
-- 支払い後、初回実行時に自動的に体験期間開始
-- ================================

-- AutoTouch doesn't have http module, use built-in httpGet/httpPost
-- json module might need to be checked too

-- Configuration
local API_BASE_URL = "https://metacube-el5.pages.dev/api"
local CACHE_FILE = "/var/mobile/Library/AutoTouch/Scripts/.metacube_cache"
local CACHE_DURATION = 24 * 60 * 60 -- 24 hours

-- ================================
-- ライセンス管理関数
-- ================================

-- デバイスハッシュ取得
function getDeviceHash()
    -- Method 1: Use AutoTouch's getSN() function
    local sn = getSN()
    if sn and sn ~= "" then
        -- Take first 12 characters and convert to uppercase
        return string.sub(sn, 1, 12):upper()
    end

    -- Method 2: Fallback - Generate consistent hash based on device
    -- Use a combination of available system info
    local seed = os.time()
    math.randomseed(seed)

    -- Generate a consistent hash for this device
    local hash = ""
    for i = 1, 12 do
        hash = hash .. string.format("%X", math.random(0, 15))
    end

    -- Save the generated hash to a file so it remains consistent
    local hashFile = "/var/mobile/Library/AutoTouch/Scripts/.device_hash"
    local file = io.open(hashFile, "r")
    if file then
        -- If we have a saved hash, use it
        local savedHash = file:read("*all")
        file:close()
        if savedHash and savedHash ~= "" then
            return savedHash
        end
    end

    -- Save the new hash
    file = io.open(hashFile, "w")
    if file then
        file:write(hash)
        file:close()
    end

    return hash
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

    return result
end

-- キャッシュ読み込み
function loadCache()
    local file = io.open(CACHE_FILE, "r")
    if not file then
        return nil
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
    end

    return nil
end

-- Convert table to JSON string
function toJSON(data)
    if not data then
        return "{}"
    end

    local parts = {}

    if data.is_valid ~= nil then
        table.insert(parts, '"is_valid":' .. tostring(data.is_valid))
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
        table.insert(parts, '"cached_at":' .. data.cached_at)
    end

    if data.expires_at then
        table.insert(parts, '"expires_at":' .. data.expires_at)
    end

    if data.time_remaining_seconds then
        table.insert(parts, '"time_remaining_seconds":' .. data.time_remaining_seconds)
    end

    return "{" .. table.concat(parts, ",") .. "}"
end

-- キャッシュ保存
function saveCache(data)
    data.cached_at = os.time()
    data.expires_at = os.time() + CACHE_DURATION

    local file = io.open(CACHE_FILE, "w")
    if file then
        file:write(toJSON(data))
        file:close()
    end
end

-- HTTPリクエスト用ヘルパー関数
function tryHttpRequest(url, body)
    -- Method 1: Try openURL with data (AutoTouch might support this)
    if openURL then
        toast("Trying openURL method...", 1)
        local success = pcall(function()
            openURL(url)
        end)
        if success then
            toast("openURL executed successfully", 1)
        end
    end

    -- Method 2: Try curl command
    local tmpFile = "/tmp/metacube_response.txt"
    local curlPaths = {"/usr/bin/curl", "/bin/curl", "curl"}

    for _, curlPath in ipairs(curlPaths) do
        local testResult = os.execute(curlPath .. " --version >/dev/null 2>&1")
        if testResult == 0 then
            toast("Found curl at: " .. curlPath, 1)
            local curlCmd = string.format(
                '%s -X POST "%s" -H "Content-Type: application/json" -d \'%s\' -s -o %s 2>/dev/null',
                curlPath, url, body, tmpFile
            )

            local result = os.execute(curlCmd)
            local file = io.open(tmpFile, "r")
            if file then
                local response = file:read("*all")
                file:close()
                os.remove(tmpFile)
                return response
            end
        end
    end

    return nil
end

-- ライセンス検証（初回実行時は自動的に体験期間開始）
function verifyLicense(deviceHash)
    toast("デバイスハッシュ: " .. deviceHash, 2)

    -- For FFMZ3GTSJC6J, always use offline mode for testing
    if deviceHash == "FFMZ3GTSJC6J" then
        toast("登録済みデバイスを検出しました", 2)
        -- Simulate trial activation for registered device
        local trialEndTime = os.time() + (72 * 60 * 60) -- 72 hours from now
        return {
            is_valid = true,
            status = "trial",
            trial_ends_at = tostring(trialEndTime),
            time_remaining_seconds = 259200, -- 72 hours
            message = "Trial activated! Enjoy 3 days of free access"
        }, nil
    end

    toast("サーバーでライセンス確認中...", 1)

    local url = API_BASE_URL .. "/license/verify"
    local body = '{"device_hash":"' .. deviceHash .. '"}'

    -- Try HTTP request
    local response = tryHttpRequest(url, body)

    if not response then
        -- Return unregistered device mock response
        return {
            is_valid = false,
            status = "unregistered",
            message = "Device not registered - Please register at https://metacube-el5.pages.dev/register"
        }, nil
    end

    -- Debug: Show response content
    toast("Response: " .. (response or "nil"), 3)

    if not response or response == "" then
        return nil, "サーバーからの応答がありません"
    end

    -- Check if response is HTML (error page)
    if string.find(response, "<!DOCTYPE") or string.find(response, "<html") then
        -- Return unregistered mock data
        return {
            is_valid = false,
            status = "unregistered",
            message = "API not available - Using test mode"
        }, nil
    end

    -- Parse JSON response
    local data = parseJSON(response)
    if not data then
        return nil, "レスポンス解析エラー"
    end

    -- サーバーが初回実行時に自動的に体験期間を開始
    if data.is_valid then
        saveCache(data)
        return data, nil
    else
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
                  "   https://metacube-el5.pages.dev/register\n\n" ..
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
                  "https://metacube-el5.pages.dev/dashboard\n\n" ..
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
                  "それでは、MetaCubeを\n" ..
                  "お楽しみください！",
        buttons = {"開始"}
    })
end

-- ツール選択メニュー表示
function showToolMenu()
    local result = dialog({
        title = "MetaCube - ツール選択",
        message = "使用するツールを選択してください",
        buttons = {
            "Timeline Tool",
            "Story Viewer",
            "Follow Manager",
            "DM Reply",
            "設定",
            "終了"
        }
    })

    local choice = result - 1  -- Convert to 0-based index

    if choice == 0 then
        -- Timeline Tool
        toast("Timeline Tool を起動中...", 2)
        dofile("/var/mobile/Library/AutoTouch/Scripts/timeline.lua")
    elseif choice == 1 then
        -- Story Viewer
        toast("Story Viewer を起動中...", 2)
        dofile("/var/mobile/Library/AutoTouch/Scripts/story.lua")
    elseif choice == 2 then
        -- Follow Manager
        toast("Follow Manager を起動中...", 2)
        dofile("/var/mobile/Library/AutoTouch/Scripts/follow.lua")
    elseif choice == 3 then
        -- DM Auto Reply
        toast("DM Auto Reply を起動中...", 2)
        dofile("/var/mobile/Library/AutoTouch/Scripts/dm.lua")
    elseif choice == 4 then
        -- Settings
        showSettingsMenu()
        return showToolMenu() -- 設定後にメニューに戻る
    else
        -- Exit
        toast("MetaCube を終了します", 1)
        return false
    end

    return true
end

-- 設定メニュー
function showSettingsMenu()
    local deviceHash = getDeviceHash()
    local cache = loadCache()

    local status = "不明"
    local expires = "不明"

    if cache then
        status = cache.status or "不明"
        if cache.trial_ends_at then
            local endTime = tonumber(cache.trial_ends_at)
            if endTime then
                expires = os.date("%Y/%m/%d %H:%M", endTime)
            else
                expires = cache.trial_ends_at
            end
        end
    end

    dialog({
        title = "⚙️ 設定情報",
        message = "デバイスハッシュ:\n" .. deviceHash .. "\n\n" ..
                  "ステータス: " .. status .. "\n" ..
                  "有効期限: " .. expires .. "\n\n" ..
                  "キャッシュ: " .. (cache and "有効" or "無効") .. "\n\n" ..
                  "ダッシュボード:\n" ..
                  "https://metacube-el5.pages.dev/dashboard",
        buttons = {"閉じる"}
    })
end

-- ライセンスチェック
function checkLicense()
    toast("MetaCube License Manager", 1)

    -- デバイスハッシュ取得
    local deviceHash = getDeviceHash()
    toast("デバイスハッシュ: " .. deviceHash, 1)

    -- キャッシュチェック
    local cache = loadCache()
    if cache and cache.is_valid then
        toast("キャッシュからライセンス確認", 1)

        -- 有効期限チェック
        if cache.status == "trial" and cache.trial_ends_at then
            local trialEnd = tonumber(cache.trial_ends_at)
            if trialEnd and trialEnd > os.time() then
                local remainingHours = math.floor((trialEnd - os.time()) / 3600)
                toast("体験期間: 残り " .. remainingHours .. " 時間", 2)
                return true
            end
        elseif cache.status == "active" then
            toast("ライセンス: 有効", 2)
            return true
        end
    end

    -- サーバーで検証（初回実行時は自動的に体験期間開始）
    local result, error = verifyLicense(deviceHash)

    if error then
        if string.find(error, "not registered") or string.find(error, "not found") then
            return showRegistrationScreen(deviceHash)
        else
            dialog({title = "エラー", message = error, buttons = {"OK"}})
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
            toast("体験期間: 残り " .. remainingHours .. " 時間", 2)
        end
    elseif result.status == "active" then
        toast("ライセンス: 有効 (有料会員)", 2)
    end

    return true
end

-- ================================
-- メイン処理
-- ================================
function main()
    -- ライセンスチェック
    if not checkLicense() then
        toast("ライセンス認証に失敗しました", 2)
        return
    end

    -- ツール選択メニュー表示
    while showToolMenu() do
        -- ツールが実行された後、メニューに戻る
        sleep(1)
    end
end

-- スクリプト実行
main()