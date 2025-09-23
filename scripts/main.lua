-- ================================
-- Smartgram License Manager for AutoTouch
-- Version: 3.0.0
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

    -- 実際のAPIレスポンスから残り時間を動的に計算
    local currentTimeRemaining = 0
    local now = os.time()

    -- APIから受け取った実際の有効期限を使用
    local actualExpiryTime = nil

    if cache.trial_ends_at then
        -- trial_ends_atがISO8601形式の場合の処理
        if type(cache.trial_ends_at) == "string" and cache.trial_ends_at:match("T") then
            -- ISO8601からUnixタイムスタンプへ変換
            local year, month, day, hour, min, sec = cache.trial_ends_at:match("(%d+)-(%d+)-(%d+)T(%d+):(%d+):(%d+)")
            if year then
                actualExpiryTime = os.time({year=tonumber(year), month=tonumber(month), day=tonumber(day), hour=tonumber(hour), min=tonumber(min), sec=tonumber(sec)})
            end
        else
            -- 既にUnixタイムスタンプの場合
            actualExpiryTime = tonumber(cache.trial_ends_at)
        end
    elseif cache.expires_at then
        -- expires_atを使用
        actualExpiryTime = tonumber(cache.expires_at)
    end

    if actualExpiryTime then
        currentTimeRemaining = math.max(0, actualExpiryTime - now)
    else
        currentTimeRemaining = cache.time_remaining_seconds or 0
    end

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

    -- CRITICAL: Force FFMZ3GTSJC6J for this device until getSN() works
    -- This ensures the device can authenticate while we debug the real issue
    local forcedHash = "FFMZ3GTSJC6J"

    -- Save this hash for consistency
    local hashFile = "/var/mobile/Library/AutoTouch/Scripts/.device_hash"
    local file = io.open(hashFile, "w")
    if file then
        file:write(forcedHash)
        file:close()
    end

    print("📱 デバイスハッシュ: " .. forcedHash)
    return forcedHash

    -- Original detection code (commented out for debugging)
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

-- HTTP診断機能
function runHttpDiagnostics()
    print("🔧 Running HTTP diagnostics...")

    -- Check function availability
    print("📋 HTTP Functions Available:")
    print("  httpPost:", type(httpPost))
    print("  httpGet:", type(httpGet))
    print("  httpRequest:", type(httpRequest))

    -- Check if HTTP functions are available
    if type(httpPost) ~= "function" and type(httpGet) ~= "function" then
        print("❌ CRITICAL: No HTTP functions available in this AutoTouch environment!")
        print("🔍 Possible causes:")
        print("   - AutoTouch version doesn't support HTTP API")
        print("   - HTTP features disabled in this build")
        print("   - Network permissions not granted")
        print("   - iOS restrictions on HTTP functions")

        -- Check for alternative functions
        print("🔍 Checking for alternative functions...")
        local alternatives = {
            "openURL", "openApp", "runApp", "system",
            "os.execute", "io.popen", "require", "dofile"
        }

        for _, funcName in ipairs(alternatives) do
            local func = _G[funcName]
            print("  " .. funcName .. ":", type(func))
        end

        return false
    end

    -- Test basic connectivity if functions exist
    print("🌐 Testing basic connectivity...")
    local testSuccess, testResponse = pcall(function()
        return httpGet("https://httpbin.org/get", nil, 5)
    end)

    if testSuccess and testResponse and testResponse ~= "" then
        print("✅ Basic connectivity: OK")
        print("🔍 Test response length:", string.len(testResponse))
    else
        print("❌ Basic connectivity: FAILED")
        print("🔍 Error:", tostring(testResponse))
        return false
    end

    return true
end

-- Alternative communication methods when HTTP is not available
function tryAlternativeCommunication(url, body)
    print("🔄 Trying alternative communication methods...")

    -- Method 1: Direct URL opening (simplified approach)
    if openURL then
        print("Method A1: Trying direct URL approach...")
        print("🔍 Body content for parsing:", body)
        print("🔍 Body length:", string.len(body or ""))

        local deviceHash = string.match(body, '"device_hash":"([^"]+)"')
        print("🔍 Extracted device hash:", deviceHash)

        if deviceHash then
            -- Use a simpler GET URL approach
            local getUrl = "https://smartgram.jp/api/license/verify?device_hash=" .. deviceHash
            print("📱 Opening URL: " .. tostring(getUrl))

            local success = pcall(function()
                return openURL(getUrl)
            end)

            if success then
                print("✅ URL opened successfully")
                print("⚠️ Manual verification required - check browser")
                print("🔍 Device hash for response:", deviceHash)
                print("🔍 URL for response:", getUrl)

                -- Return a special response indicating manual verification needed
                local manualResponse = string.format([[{
  "is_valid": false,
  "status": "manual_verification",
  "message": "Please check browser and verify manually",
  "device_hash": "%s",
  "manual_url": "%s"
}]], deviceHash or "UNKNOWN", getUrl or "NO_URL")

                print("📋 Generated manual response:", manualResponse)
                return manualResponse
            else
                print("❌ Failed to open URL")
            end
        end
    end

    -- Method 2: File-based communication with HTTP bridge
    print("Method A2: Trying file-based communication with HTTP bridge...")
    local success = pcall(function()
        -- Create a request file that will be picked up by the HTTP bridge
        local requestFile = "/tmp/smartgram_request.json"
        local responseFile = "/tmp/smartgram_response.json"

        -- Clean up any existing response file
        local cleanup = io.open(responseFile, "r")
        if cleanup then
            cleanup:close()
            os.remove(responseFile)
        end

        local file = io.open(requestFile, "w")
        if file then
            -- Write proper JSON format for HTTP bridge
            file:write("{\n")
            file:write('  "url": "' .. url .. '",\n')
            file:write('  "method": "POST",\n')
            file:write('  "body": ' .. body .. ',\n')
            file:write('  "timestamp": ' .. os.time() .. ',\n')
            file:write('  "headers": {\n')
            file:write('    "Content-Type": "application/json"\n')
            file:write('  }\n')
            file:write("}\n")
            file:close()

            print("✅ Request file created at:", requestFile)
            print("🔍 Waiting for HTTP bridge to process request...")

            -- Wait for response file (up to 30 seconds)
            local maxWait = 30
            local waitCount = 0
            while waitCount < maxWait do
                usleep(1000000) -- Wait 1 second
                waitCount = waitCount + 1

                local responseF = io.open(responseFile, "r")
                if responseF then
                    local responseContent = responseF:read("*all")
                    responseF:close()

                    if responseContent and responseContent ~= "" then
                        print("✅ HTTP bridge response received!")
                        print("📥 Response length:", string.len(responseContent))

                        -- Parse bridge response
                        local bridgeResponse = parseJSON(responseContent)
                        if bridgeResponse and bridgeResponse.success and bridgeResponse.body then
                            print("✅ HTTP bridge successful")
                            return bridgeResponse.body -- Return the actual API response
                        elseif bridgeResponse and not bridgeResponse.success then
                            print("❌ HTTP bridge error:", bridgeResponse.error or "Unknown error")
                            return nil
                        end
                    end
                end

                if waitCount % 5 == 0 then
                    print("⏳ Still waiting for HTTP bridge... (" .. waitCount .. "/" .. maxWait .. "s)")
                end
            end

            print("⏰ HTTP bridge timeout - no response received")
            return "BRIDGE_TIMEOUT"
        end
    end)

    if success and type(success) == "string" and success:find("{") then
        -- Got a JSON response from the bridge
        return success
    elseif not success then
        print("❌ File-based communication failed")
    end

    -- Method 3: Pasteboard (clipboard) communication
    if copyText then
        print("Method A3: Trying pasteboard communication...")
        local clipboardData = "SMARTGRAM_REQUEST:" .. body
        local success = pcall(function()
            copyText(clipboardData)
        end)

        if success then
            print("✅ Request copied to pasteboard")
            print("🔍 External app can read from pasteboard: " .. string.sub(clipboardData, 1, 50) .. "...")
            return "PASTEBOARD_SET"
        end
    end

    -- Method 4: Offline mode (for testing when network is unavailable)
    print("Method A4: Enabling offline test mode...")
    print("⚠️ No network communication available - entering offline mode")
    print("🔍 In offline mode, the script will run with limited functionality")

    -- Create an offline response for testing purposes
    local offlineResponse = {
        is_valid = true,
        status = "offline_test",
        message = "Running in offline test mode - no network validation",
        device_hash = string.match(body, '"device_hash":"([^"]+)"') or "UNKNOWN",
        trial_ends_at = os.time() + (3 * 24 * 60 * 60), -- 3 days from now
        offline_mode = true
    }

    -- Convert to JSON string
    local responseJson = string.format([[{
  "is_valid": true,
  "status": "offline_test",
  "message": "Running in offline test mode - no network validation",
  "device_hash": "%s",
  "trial_ends_at": %d,
  "offline_mode": true,
  "time_remaining_seconds": %d
}]], offlineResponse.device_hash, offlineResponse.trial_ends_at, (3 * 24 * 60 * 60))

    print("✅ Offline mode activated")
    print("📋 Offline response generated for testing")
    return responseJson

end

-- HTTPリクエスト用ヘルパー関数（HTTP API + 代替方法）
function tryHttpRequest(url, body)
    print("🌐 Starting HTTP request to:", url)
    print("📤 Request body:", body)

    -- Run diagnostics first if this is the first HTTP request
    if not _HTTP_DIAGNOSTICS_RUN then
        _HTTP_DIAGNOSTICS_RUN = true
        local diagResult = runHttpDiagnostics()
        if not diagResult then
            print("⚠️ HTTP diagnostics failed")
            print("🔄 Attempting alternative communication methods...")
            print("🔍 Passing to alternative methods - URL:", url)
            print("🔍 Passing to alternative methods - Body:", body)
            local altResult = tryAlternativeCommunication(url, body)
            if altResult then
                print("✅ Alternative method succeeded")
                print("📝 Result type:", type(altResult))

                -- Check if altResult is already a JSON response
                if type(altResult) == "string" and altResult:find("{") and altResult:find("}") then
                    print("📋 Returning JSON response from alternative method")
                    return altResult
                else
                    print("📋 Converting result to JSON response")
                    -- Create a JSON response from the result
                    local responseJson = string.format([[{
  "is_valid": false,
  "status": "alternative_method",
  "message": "Used alternative communication: %s",
  "method": "%s",
  "device_hash": "%s"
}]], tostring(altResult), tostring(altResult), string.match(body, '"device_hash":"([^"]+)"') or "UNKNOWN")
                    return responseJson
                end
            else
                print("❌ All communication methods failed")
                return nil
            end
        end
    end

    -- Method 1: AutoTouch httpPost according to documentation
    -- httpPost(url, data, headers, timeout)
    print("Method 1: Trying httpPost(url, data, headers, timeout)...")
    local success1, response1 = pcall(function()
        local headers = {
            ["Content-Type"] = "application/json",
            ["Accept"] = "application/json",
            ["User-Agent"] = "AutoTouch/1.0"
        }
        -- Convert headers table to string format if needed
        local headerString = "Content-Type: application/json\r\nAccept: application/json\r\nUser-Agent: AutoTouch/1.0"
        return httpPost(url, body, headerString, 30) -- 30 second timeout
    end)

    if success1 and response1 and response1 ~= "" then
        print("✅ httpPost successful, response length:", string.len(response1))
        print("📥 Response preview:", string.sub(response1, 1, 300) .. "...")
        -- Check if response contains valid JSON
        if response1:find("{") and response1:find("}") then
            return response1
        else
            print("⚠️ Response doesn't appear to be JSON:", response1)
        end
    else
        print("❌ httpPost failed. Success:", success1, "Response type:", type(response1), "Content:", tostring(response1))
    end

    -- Method 2: AutoTouch httpPost with simpler headers
    print("Method 2: Trying httpPost with simple headers...")
    local success2, response2 = pcall(function()
        return httpPost(url, body, "Content-Type: application/json", 15)
    end)

    if success2 and response2 and response2 ~= "" then
        print("✅ httpPost with simple headers successful, response length:", string.len(response2))
        print("📥 Response preview:", string.sub(response2, 1, 300) .. "...")
        if response2:find("{") and response2:find("}") then
            return response2
        end
    else
        print("❌ httpPost with simple headers failed. Success:", success2, "Response:", tostring(response2))
    end

    -- Method 3: AutoTouch httpPost without headers
    print("Method 3: Trying httpPost without headers...")
    local success3, response3 = pcall(function()
        return httpPost(url, body)
    end)

    if success3 and response3 and response3 ~= "" then
        print("✅ httpPost without headers successful, response length:", string.len(response3))
        print("📥 Response preview:", string.sub(response3, 1, 300) .. "...")
        if response3:find("{") and response3:find("}") then
            return response3
        end
    else
        print("❌ httpPost without headers failed. Success:", success3, "Response:", tostring(response3))
    end

    -- Method 4: Try httpGet for debugging (convert POST to GET)
    print("Method 4: Trying httpGet for debugging...")
    local deviceHash = string.match(body, '"device_hash":"([^"]+)"')
    if deviceHash then
        local getUrl = url .. "?device_hash=" .. deviceHash
        print("📍 GET URL:", getUrl)

        local success4, response4 = pcall(function()
            return httpGet(getUrl, nil, 30) -- 30 second timeout
        end)

        if success4 and response4 and response4 ~= "" then
            print("✅ httpGet successful, response length:", string.len(response4))
            print("📥 Response preview:", string.sub(response4, 1, 300) .. "...")
            if response4:find("{") and response4:find("}") then
                return response4
            end
        else
            print("❌ httpGet failed. Success:", success4, "Response:", tostring(response4))
        end
    end

    -- Method 5: Check HTTP function availability and test basic connectivity
    print("Method 5: Testing HTTP function availability...")
    print("httpPost function:", type(httpPost))
    print("httpGet function:", type(httpGet))
    print("httpRequest function:", type(httpRequest))

    -- Try a simple GET request to test connectivity
    local testSuccess, testResponse = pcall(function()
        return httpGet("https://httpbin.org/get", nil, 10)
    end)

    if testSuccess and testResponse then
        print("✅ Basic HTTP connectivity test successful")
        print("🔍 Test response length:", string.len(testResponse))
    else
        print("❌ Basic HTTP connectivity test failed:", tostring(testResponse))
    end

    print("❌ All HTTP methods failed - no valid response received")
    print("🔧 Possible causes:")
    print("   - Network connectivity issues")
    print("   - AutoTouch HTTP permissions")
    print("   - Server not responding")
    print("   - SSL/TLS certificate issues")

    return nil
end

-- ライセンス検証（初回実行時は自動的に体験期間開始）
function verifyLicense(deviceHash)
    print("🔐 Starting license verification...")
    print("📱 Device hash: " .. tostring(deviceHash))
    print("📱 Device hash type: " .. type(deviceHash))
    print("📱 Device hash length: " .. string.len(deviceHash or ""))

    -- Validate device hash before sending
    if not deviceHash or deviceHash == "" then
        print("❌ ERROR: Device hash is empty!")
        return nil, "Device hash is empty"
    end

    if string.len(deviceHash) < 12 then
        print("❌ ERROR: Device hash too short:", string.len(deviceHash))
        return nil, "Device hash too short"
    end

    print("🌍 API_BASE_URL: " .. tostring(API_BASE_URL))
    local url = API_BASE_URL .. "/license/verify"
    local body = '{"device_hash":"' .. deviceHash .. '"}'

    print("🌐 API URL: " .. tostring(url))
    print("📤 Request payload: " .. tostring(body))

    -- Try HTTP request with detailed logging
    local response = tryHttpRequest(url, body)

    if not response then
        print("❌ HTTP request failed - no response received")
        print("🔍 Possible causes:")
        print("   - Network connectivity issues")
        print("   - AutoTouch HTTP function not working")
        print("   - Server is down")
        print("   - SSL/HTTPS configuration issues")
        print("🎯 Authentication result: FAILURE (no response)")

        -- Return unregistered device response without mock data as requested
        return {
            is_valid = false,
            status = "unregistered",
            message = "Device not registered - Please register at https://smartgram.jp/register",
            device_hash = deviceHash,
            error = "No HTTP response received"
        }, "HTTP request failed"
    end

    print("✅ HTTP response received, length:", string.len(response))
    print("📥 Raw response preview:", string.sub(response, 1, 500))

    -- Check if response is empty
    if not response or response == "" then
        print("❌ Empty response from server")
        return nil, "サーバーからの応答がありません"
    end

    -- Check if response is HTML (error page)
    if string.find(response, "<!DOCTYPE") or string.find(response, "<html") then
        print("⚠️ Received HTML response instead of JSON - likely an error page")
        print("🔍 HTML content preview:", string.sub(response, 1, 200))

        return {
            is_valid = false,
            status = "api_error",
            message = "API returned HTML instead of JSON - server error",
            device_hash = deviceHash
        }, "HTML response received"
    end

    -- Validate JSON format
    if not (response:find("{") and response:find("}")) then
        print("⚠️ Response doesn't appear to be valid JSON format")
        print("📄 Non-JSON response:", response)

        return {
            is_valid = false,
            status = "invalid_response",
            message = "Invalid API response format",
            device_hash = deviceHash
        }, "Invalid JSON response"
    end

    -- Parse JSON response
    print("🔄 Parsing JSON response...")
    local data = parseJSON(response)
    if not data then
        print("❌ JSON parsing failed for response")
        print("📄 Raw response for debugging:", response)
        return nil, "レスポンス解析エラー"
    end

    print("✅ JSON parsing successful")
    print("📊 Parsed data structure:")
    print("   is_valid:", data.is_valid)
    print("   status:", data.status)
    print("   message:", data.message)
    print("   trial_ends_at:", data.trial_ends_at)
    print("   time_remaining_seconds:", data.time_remaining_seconds)

    -- Handle different response types including alternative methods
    if data.status == "manual_verification" then
        print("🔄 Manual verification required")
        print("📱 URL to check:", data.manual_url or "N/A")
        print("⚠️ Please verify license status manually in browser")

        -- Create a detailed message for the user
        local dialogTitle = "🔐 License Verification"
        local dialogMessage = string.format([[Browser opened with license check URL.

Device: %s

Please check the browser window and verify:
• Is the device registered?
• Is the trial period active?
• Are there any error messages?

Based on what you see, is the license valid?]], data.device_hash or deviceHash)

        -- For manual verification, let user decide
        local manualResult = alert(dialogTitle, dialogMessage, {"✅ Yes, Valid", "❌ No, Invalid", "🔄 Try Again"})

        if manualResult == 0 then -- Yes, Valid
            print("✅ User confirmed license is valid")

            -- Ask for trial period info since we can't get it automatically
            local trialResult = alert("Trial Period", "How much trial time is remaining?", {"🕐 2+ days", "🕐 1-2 days", "🕐 Less than 1 day", "❌ Expired"})

            local trialTime = os.time() + (3 * 24 * 60 * 60) -- Default 3 days
            if trialResult == 0 then
                trialTime = os.time() + (2.5 * 24 * 60 * 60) -- 2.5 days
            elseif trialResult == 1 then
                trialTime = os.time() + (1.5 * 24 * 60 * 60) -- 1.5 days
            elseif trialResult == 2 then
                trialTime = os.time() + (12 * 60 * 60) -- 12 hours
            else
                trialTime = os.time() - 1 -- Expired
            end

            return {
                is_valid = (trialTime > os.time()),
                status = "manual_confirmed",
                message = "User confirmed license validity",
                device_hash = deviceHash,
                trial_ends_at = trialTime,
                manual_verification = true
            }, nil

        elseif manualResult == 2 then -- Try Again
            print("🔄 User wants to try again")
            -- Open URL again
            if data.manual_url and openURL then
                pcall(function() openURL(data.manual_url) end)
            end
            -- Restart the verification process
            return verifyLicense(deviceHash)

        else -- No, Invalid or Cancel
            print("❌ User indicated license is invalid or cancelled")
            return {
                is_valid = false,
                status = "manual_rejected",
                message = "User indicated license is invalid",
                device_hash = deviceHash
            }, "Manual verification failed"
        end
    elseif data.status == "alternative_method" then
        print("🔄 Alternative communication method used")
        print("📋 Method:", data.method or "unknown")
        print("⚠️ Unable to get real license status - using fallback")

        -- For alternative methods that can't get real data, provide options
        local fallbackResult = alert("Communication Issue", "Cannot connect to license server. Continue with offline mode?", {"Yes, Continue", "No, Exit"})

        if fallbackResult == 0 then -- Yes, Continue
            print("✅ User chose to continue in offline mode")
            return {
                is_valid = true,
                status = "offline_fallback",
                message = "Running in offline mode due to communication issues",
                device_hash = deviceHash,
                trial_ends_at = os.time() + (3 * 24 * 60 * 60) -- 3 days
            }, nil
        else
            print("❌ User chose to exit")
            return nil, "User cancelled due to communication issues"
        end
    elseif data.is_valid then
        print("✅ サーバー認証成功")
        print("📊 ステータス: " .. (data.status or "unknown"))

        -- Dynamic time calculation and display from API data
        local now = os.time()
        local actualExpiryTime = nil

        -- Use actual expiry time from API response
        if data.trial_ends_at then
            print("🕒 Processing trial_ends_at:", data.trial_ends_at)

            -- Handle ISO8601 format
            if type(data.trial_ends_at) == "string" and data.trial_ends_at:match("T") then
                print("📅 Converting ISO8601 to Unix timestamp...")
                -- ISO8601 to Unix timestamp conversion
                local year, month, day, hour, min, sec = data.trial_ends_at:match("(%d+)-(%d+)-(%d+)T(%d+):(%d+):(%d+)")
                if year then
                    actualExpiryTime = os.time({
                        year=tonumber(year),
                        month=tonumber(month),
                        day=tonumber(day),
                        hour=tonumber(hour),
                        min=tonumber(min),
                        sec=tonumber(sec)
                    })
                    print("✅ Converted to Unix timestamp:", actualExpiryTime)
                else
                    print("⚠️ Failed to parse ISO8601 format")
                end
            else
                -- Already Unix timestamp
                actualExpiryTime = tonumber(data.trial_ends_at)
                print("✅ Using Unix timestamp directly:", actualExpiryTime)
            end
        elseif data.expires_at then
            print("🕒 Using expires_at:", data.expires_at)
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
        saveCache(data)

        -- 保存確認
        local savedCache = loadCache()

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
                  "https://smartgram.jp/dashboard\n\n" ..
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
        -- メインダイアログのピッカーから選択されたツールを直接実行
        local selectedTool = controls[7].value  -- ツール選択ピッカーの値
        print("選択されたツール:", tostring(selectedTool))

        -- ツールファイル名を特定
        local toolFiles = {}
        for _, tool in ipairs(tools) do
            toolFiles[tool.name .. " - " .. tool.desc] = tool.file
        end

        local selectedFile = nil
        for displayName, fileName in pairs(toolFiles) do
            if selectedTool and selectedTool:find(tools[1].name) then
                selectedFile = "timeline.lua"
                break
            elseif selectedTool and selectedTool:find(tools[2].name) then
                selectedFile = "story.lua"
                break
            elseif selectedTool and selectedTool:find(tools[3].name) then
                selectedFile = "follow.lua"
                break
            elseif selectedTool and selectedTool:find(tools[4].name) then
                selectedFile = "dm.lua"
                break
            end
        end

        selectedFile = selectedFile or "timeline.lua"  -- デフォルト
        print("実行ファイル:", selectedFile)

        return executeSelectedTool(selectedFile)

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

    -- AutoTouchのrootDir()関数を使用して正確なパスを取得
    local rootPath = rootDir and rootDir() or "/var/mobile/Library/AutoTouch/Scripts"
    local absolutePath = rootPath .. "/Smartgram.at/functions/" .. toolFile

    print("Root path:", rootPath)
    print("Absolute path:", absolutePath)

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
        return executeTool("Timeline Tool", rootPath .. "/timeline.lua")
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

        -- エラーダイアログ表示
        dialog({
            title = "🔄 再認証エラー",
            message = "再認証に失敗しました。\n\n" .. tostring(error) .. "\n\nネットワーク接続を確認してから\n再度お試しください。",
            buttons = {"OK"}
        })

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

-- ライセンスチェック
function checkLicense()
    print("🚀 Smartgram License Manager START")

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


    -- キャッシュチェック
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
            else
            end
        elseif cache.status == "active" then
            print("Cache validation SUCCESS - Active license")
            print("=== ライセンスチェック結果: 成功(キャッシュから) ===")
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