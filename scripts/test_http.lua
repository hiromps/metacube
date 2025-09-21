-- Test script to verify HTTP functionality similar to AutoTouch environment
-- This simulates what main.lua would do

-- Configuration
local API_BASE_URL = "https://metacube-el5.pages.dev/api"

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

-- HTTPリクエスト用ヘルパー関数 (simulated AutoTouch functions)
function tryHttpRequest(url, body)
    print("HTTP request started to: " .. url)
    print("Request body: " .. body)

    -- Simulate successful httpGet response for testing
    local deviceHash = string.match(body, '"device_hash":"([^"]+)"')
    if deviceHash then
        local getUrl = url .. "?device_hash=" .. deviceHash
        print("GET URL:", getUrl)

        -- For testing, return a mock successful response
        if deviceHash == "FFMZ3GTSJC6J" then
            print("Simulating successful AutoTouch httpGet response")
            return '{"is_valid":true,"status":"trial","message":"Trial activated successfully","trial_ends_at":"1727047200","time_remaining_seconds":259200}'
        else
            print("Simulating unregistered device response")
            return '{"is_valid":false,"status":"unregistered","message":"Device not registered"}'
        end
    end

    print("All HTTP methods failed")
    return nil
end

-- Test license verification
function testLicenseVerify(deviceHash)
    print("=== TESTING LICENSE VERIFICATION ===")
    print("Device Hash:", deviceHash)

    local url = API_BASE_URL .. "/license/verify"
    local body = '{"device_hash":"' .. deviceHash .. '"}'
    print("API URL:", url)
    print("Request body:", body)

    -- Try HTTP request
    local response = tryHttpRequest(url, body)
    print("HTTP request completed, response:", tostring(response or "nil"))

    if not response then
        print("HTTP request failed - no response received")
        return {
            is_valid = false,
            status = "unregistered",
            message = "Device not registered - Please register at https://metacube-el5.pages.dev/register"
        }
    end

    -- Parse JSON response
    local data = parseJSON(response)
    if not data then
        print("JSON parsing failed for response")
        return nil
    end

    print("Server response parsed successfully")
    print("Response status: " .. (data.status or "unknown"))
    print("Response is_valid: " .. tostring(data.is_valid))

    if data.is_valid then
        print("✅ Server authentication SUCCESS")
        if data.trial_ends_at then
            print("Trial expires at:", data.trial_ends_at)
        end
        if data.time_remaining_seconds then
            print("Time remaining:", data.time_remaining_seconds, "seconds")
        end
        return data
    else
        print("❌ Server authentication FAILED:", (data.message or "ライセンス無効"))
        return data
    end
end

-- Main test function
function main()
    print("🧪 Testing HTTP functionality for AutoTouch")

    -- Test with known device
    print("\n--- Testing with FFMZ3GTSJC6J ---")
    local result1 = testLicenseVerify("FFMZ3GTSJC6J")
    if result1 then
        print("Test 1 result:", result1.status or "unknown")
    end

    -- Test with unknown device
    print("\n--- Testing with unknown device ---")
    local result2 = testLicenseVerify("UNKNOWN12345")
    if result2 then
        print("Test 2 result:", result2.status or "unknown")
    end

    print("\n🏁 Test completed")
end

-- Run tests
main()