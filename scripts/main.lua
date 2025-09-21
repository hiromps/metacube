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
local LOG_FILE = "/var/mobile/Library/AutoTouch/Scripts/.metacube_log"
local CACHE_DURATION = 24 * 60 * 60 -- 24 hours

-- ================================
-- ログ管理関数
-- ================================

-- printのみを使用（ログファイル機能は無効）

-- 重要なメッセージのみtoast表示
function showToast(message, duration)
    toast(message, duration or 2)
    print("TOAST:", message)
end

-- ログファイル機能は削除（printのみ使用）

-- ================================
-- ライセンス管理関数
-- ================================

-- デバイスハッシュ取得
function getDeviceHash()
    -- Check for saved hash first
    local hashFile = "/var/mobile/Library/AutoTouch/Scripts/.device_hash"
    print("Checking for saved hash at:", hashFile)

    local file = io.open(hashFile, "r")
    if file then
        local savedHash = file:read("*all")
        file:close()
        if savedHash and savedHash ~= "" then
            print("Found saved hash:", savedHash)
            return savedHash:gsub("\n", ""):gsub("\r", "") -- Remove any newlines
        end
        print("Saved hash file is empty")
    else
        print("No saved hash file found")
    end

    -- Method 1: Try AutoTouch's getSN() function
    print("Attempting to get device SN using getSN()...")
    local success, sn = pcall(getSN)
    if success and sn and sn ~= "" then
        print("getSN() returned:", type(sn), sn)
        -- Take first 12 characters and convert to uppercase
        local deviceHash = string.sub(tostring(sn), 1, 12):upper()
        print("Generated device hash from SN:", deviceHash)

        -- Save the hash for future use
        file = io.open(hashFile, "w")
        if file then
            file:write(deviceHash)
            file:close()
            print("Saved device hash to file")
        end

        return deviceHash
    else
        print("getSN() failed or returned empty:", success, sn)
    end

    -- Method 2: Try alternative AutoTouch device info functions
    print("Trying alternative device info methods...")

    -- Try getDeviceInfo if available
    local success2, devInfo = pcall(function() return getDeviceInfo() end)
    if success2 and devInfo then
        print("getDeviceInfo() returned:", type(devInfo), devInfo)
        if type(devInfo) == "string" and devInfo ~= "" then
            local deviceHash = string.sub(devInfo:gsub("[^%w]", ""), 1, 12):upper()
            if deviceHash ~= "" then
                print("Generated hash from device info:", deviceHash)
                -- Save the hash
                file = io.open(hashFile, "w")
                if file then
                    file:write(deviceHash)
                    file:close()
                end
                return deviceHash
            end
        end
    end

    -- Method 3: Generate stable hash based on current time (but make it stable)
    print("All device info methods failed, generating stable hash...")

    -- Use a predictable seed based on file system to make it consistent
    local tempFile = "/var/mobile/Library/AutoTouch/Scripts/.device_seed"
    local seed = nil

    local seedFile = io.open(tempFile, "r")
    if seedFile then
        seed = tonumber(seedFile:read("*all"))
        seedFile:close()
        print("Found existing seed:", seed)
    else
        -- Create a new seed
        seed = os.time()
        seedFile = io.open(tempFile, "w")
        if seedFile then
            seedFile:write(tostring(seed))
            seedFile:close()
            print("Generated new seed:", seed)
        end
    end

    if seed then
        math.randomseed(seed)
        local hash = ""
        for i = 1, 12 do
            hash = hash .. string.format("%X", math.random(0, 15))
        end

        print("Generated stable hash:", hash)

        -- Save the hash
        file = io.open(hashFile, "w")
        if file then
            file:write(hash)
            file:close()
            print("Saved generated hash to file")
        end

        return hash
    end

    -- Final fallback
    print("All methods failed, using test device hash")
    local fallback = "FFMZ3GTSJC6J"

    -- Save even the fallback
    file = io.open(hashFile, "w")
    if file then
        file:write(fallback)
        file:close()
    end

    return fallback
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
    print("HTTP request started to: " .. url)
    print("Request body: " .. body)

    -- Method 1: Try AutoTouch's built-in HTTP functions
    print("Trying AutoTouch httpPost function...")
    local success, response = pcall(function()
        -- AutoTouch httpPost(url, data, headers)
        local headers = {
            ["Content-Type"] = "application/json"
        }
        return httpPost(url, body, headers)
    end)

    if success and response then
        print("httpPost successful, response length:", string.len(response))
        print("Response content:", response)
        return response
    else
        print("httpPost failed:", response)
    end

    -- Method 2: Try alternative AutoTouch HTTP function
    print("Trying alternative AutoTouch HTTP method...")
    local success2, response2 = pcall(function()
        -- Some AutoTouch versions might have different function names
        return httpRequest(url, "POST", body, {["Content-Type"] = "application/json"})
    end)

    if success2 and response2 then
        print("httpRequest successful, response length:", string.len(response2))
        return response2
    else
        print("httpRequest failed:", response2)
    end

    -- Method 3: Try basic HTTP GET with parameters (as fallback)
    print("Trying GET request as fallback...")
    local deviceHash = string.match(body, '"device_hash":"([^"]+)"')
    if deviceHash then
        local getUrl = url .. "?device_hash=" .. deviceHash
        print("GET URL:", getUrl)

        local success3, response3 = pcall(function()
            return httpGet(getUrl)
        end)

        if success3 and response3 then
            print("httpGet successful, response length:", string.len(response3))
            return response3
        else
            print("httpGet failed:", response3)
        end
    end

    -- Method 4: Try openURL as last resort (might not work for API calls but worth trying)
    print("Trying openURL as last resort...")
    local success4, response4 = pcall(function()
        return openURL(url)
    end)

    if success4 then
        print("openURL executed (may have opened browser)")
        -- openURL typically doesn't return response, so we return nil
    else
        print("openURL failed:", response4)
    end

    print("All HTTP methods failed")
    return nil
end

-- ライセンス検証（初回実行時は自動的に体験期間開始）
function verifyLicense(deviceHash)
    print("=== LICENSE VERIFICATION START ===")
    print("Device Hash:", deviceHash)

    -- Try server authentication first for all devices

    print("Attempting online verification...")

    local url = API_BASE_URL .. "/license/verify"
    local body = '{"device_hash":"' .. deviceHash .. '"}'
    print("API URL:", url)
    print("Request body:", body)

    -- Try HTTP request
    local response = tryHttpRequest(url, body)
    print("HTTP request completed, response:", tostring(response or "nil"))

    if not response then
        print("HTTP request failed - no response received")
        print("Authentication result: FAILURE (unregistered)")
        -- Return unregistered device mock response
        return {
            is_valid = false,
            status = "unregistered",
            message = "Device not registered - Please register at https://metacube-el5.pages.dev/register"
        }, nil
    end

    -- Debug: Show response content (logged only)
    print("Response content: " .. (response or "nil"))

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
        print("JSON parsing failed for response")
        return nil, "レスポンス解析エラー"
    end

    print("Server response parsed successfully")
    print("Response status: " .. (data.status or "unknown"))
    print("Response is_valid: " .. tostring(data.is_valid))

    -- サーバーが初回実行時に自動的に体験期間を開始
    if data.is_valid then
        print("✅ Server authentication SUCCESS")
        print("Server authentication SUCCESS")
        if data.trial_ends_at then
            print("Trial expires at:", data.trial_ends_at)
            print("Trial expires at: " .. data.trial_ends_at)
        end
        if data.time_remaining_seconds then
            print("Time remaining:", data.time_remaining_seconds, "seconds")
            print("Time remaining: " .. data.time_remaining_seconds .. " seconds")
        end
        saveCache(data)
        return data, nil
    else
        print("❌ Server authentication FAILED:", (data.message or "ライセンス無効"))
        print("Server authentication FAILED: " .. (data.message or "ライセンス無効"))
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
    print("Showing tool selection menu")
    local result = dialog({
        title = "🛠️ MetaCube ツール選択",
        message = "認証が完了しました。\n使用するツールを選択してください：",
        buttons = {
            "Timeline Tool",
            "Story Viewer",
            "Follow Manager",
            "DM Reply",
            "設定",
            "ログ表示",
            "終了"
        }
    })

    print("Dialog result: " .. tostring(result))

    if not result then
        -- User cancelled or dialog failed
        print("Dialog cancelled or failed")
        return false
    end

    local choice = result - 1  -- Convert to 0-based index
    print("Selected choice: " .. tostring(choice))

    if choice == 0 then
        -- Timeline Tool
        print("User selected: Timeline Tool")
        local success, err = pcall(function()
            dofile("/var/mobile/Library/AutoTouch/Scripts/timeline.lua")
        end)
        if not success then
            print("Timeline Tool execution failed: " .. tostring(err))
            dialog({title = "エラー", message = "Timeline Tool の実行に失敗しました", buttons = {"OK"}})
        end
    elseif choice == 1 then
        -- Story Viewer
        print("User selected: Story Viewer")
        local success, err = pcall(function()
            dofile("/var/mobile/Library/AutoTouch/Scripts/story.lua")
        end)
        if not success then
            print("Story Viewer execution failed: " .. tostring(err))
            dialog({title = "エラー", message = "Story Viewer の実行に失敗しました", buttons = {"OK"}})
        end
    elseif choice == 2 then
        -- Follow Manager
        print("User selected: Follow Manager")
        local success, err = pcall(function()
            dofile("/var/mobile/Library/AutoTouch/Scripts/follow.lua")
        end)
        if not success then
            print("Follow Manager execution failed: " .. tostring(err))
            dialog({title = "エラー", message = "Follow Manager の実行に失敗しました", buttons = {"OK"}})
        end
    elseif choice == 3 then
        -- DM Auto Reply
        print("User selected: DM Auto Reply")
        local success, err = pcall(function()
            dofile("/var/mobile/Library/AutoTouch/Scripts/dm.lua")
        end)
        if not success then
            print("DM Auto Reply execution failed: " .. tostring(err))
            dialog({title = "エラー", message = "DM Auto Reply の実行に失敗しました", buttons = {"OK"}})
        end
    elseif choice == 4 then
        -- Settings
        print("User selected: Settings")
        showSettingsMenu()
        return showToolMenu() -- 設定後にメニューに戻る
    elseif choice == 5 then
        -- Show Log
        print("User selected: Show Log")
        showLogMenu()
        return showToolMenu() -- ログ表示後にメニューに戻る
    else
        -- Exit
        print("User selected: Exit - terminating MetaCube")
        return false
    end

    return true
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
    print("🚀 MetaCube License Manager START")
    print("=== MetaCube License Manager START ===")
    print("Starting license check process...")

    -- デバイスハッシュ取得
    local deviceHash = getDeviceHash()
    print("📱 Device hash obtained:", deviceHash)
    print("Device hash obtained: " .. deviceHash)

    -- キャッシュチェック
    local cache = loadCache()
    print("Cache check: " .. (cache and "found" or "not found"))
    if cache and cache.is_valid then
        print("Valid cache found - using cached license data")
        print("Cache status: " .. (cache.status or "unknown"))

        -- 有効期限チェック
        if cache.status == "trial" and cache.trial_ends_at then
            local trialEnd = tonumber(cache.trial_ends_at)
            if trialEnd and trialEnd > os.time() then
                local remainingHours = math.floor((trialEnd - os.time()) / 3600)
                print("Cache validation SUCCESS - Trial remaining: " .. remainingHours .. " hours")
                print("=== LICENSE CHECK RESULT: SUCCESS (from cache) ===")
                showToast("体験期間: 残り " .. remainingHours .. " 時間")
                return true
            else
                print("Cache trial expired - proceeding to server verification")
            end
        elseif cache.status == "active" then
            print("Cache validation SUCCESS - Active license")
            print("=== LICENSE CHECK RESULT: SUCCESS (from cache) ===")
            showToast("ライセンス: 有効 (有料会員)")
            return true
        end
    else
        print("No valid cache found - proceeding to server verification")
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
        print("Server verification SUCCESS - Trial license")
        -- 初回アクティベーションメッセージ表示
        if result.message and string.find(result.message, "activated") then
            print("First trial activation detected")
            showTrialActivatedMessage(result)
        else
            local remainingSeconds = result.time_remaining_seconds or 0
            local remainingHours = math.floor(remainingSeconds / 3600)
            print("Trial ongoing - remaining: " .. remainingHours .. " hours")
            showToast("体験期間: 残り " .. remainingHours .. " 時間")
        end
    elseif result.status == "active" then
        print("Server verification SUCCESS - Active paid license")
        showToast("ライセンス: 有効 (有料会員)")
    end

    print("=== LICENSE CHECK RESULT: SUCCESS (from server) ===")
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

    print("License check SUCCESS - starting tool selection")
    -- 認証成功を明確に表示
    dialog({
        title = "✅ 認証成功",
        message = "ライセンス認証が完了しました。\n\n使用するツールを選択してください。",
        buttons = {"ツール選択へ"}
    })

    -- ツール選択メニュー表示
    while showToolMenu() do
        -- ツールが実行された後、メニューに戻る
        sleep(1)
    end
end

-- スクリプト実行
main()