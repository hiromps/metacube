-- HTTP Test Script for AutoTouch
-- This script tests HTTP connectivity and AutoTouch HTTP API functions
-- Based on AutoTouch HTTP API documentation: https://docs.autotouch.net/http-api.html

print("🔧 AutoTouch HTTP API Test Script")
print("=" .. string.rep("=", 40))

-- Test 1: Check HTTP function availability
print("\n📋 Test 1: HTTP Function Availability")
print("httpPost function:", type(httpPost))
print("httpGet function:", type(httpGet))
print("httpRequest function:", type(httpRequest))

if not httpPost then
    print("❌ CRITICAL: httpPost function not available!")
end

if not httpGet then
    print("❌ CRITICAL: httpGet function not available!")
end

-- Test 2: Simple connectivity test
print("\n🌐 Test 2: Basic Connectivity Test")
local testUrl = "https://httpbin.org/get"
print("Testing URL:", testUrl)

local success, response = pcall(function()
    return httpGet(testUrl, nil, 10) -- 10 second timeout
end)

if success and response and response ~= "" then
    print("✅ Basic HTTP GET successful")
    print("Response length:", string.len(response))
    print("Response preview:", string.sub(response, 1, 200) .. "...")
else
    print("❌ Basic HTTP GET failed")
    print("Success:", success)
    print("Response:", tostring(response))
end

-- Test 3: POST test with JSON data
print("\n📤 Test 3: HTTP POST Test")
local postUrl = "https://httpbin.org/post"
local postData = '{"test": "data", "timestamp": "' .. os.date("%Y-%m-%d %H:%M:%S") .. '"}'

print("Testing POST URL:", postUrl)
print("POST data:", postData)

-- Method 1: POST with headers
local success1, response1 = pcall(function()
    local headers = "Content-Type: application/json\r\nAccept: application/json"
    return httpPost(postUrl, postData, headers, 15)
end)

if success1 and response1 and response1 ~= "" then
    print("✅ HTTP POST with headers successful")
    print("Response length:", string.len(response1))
    if response1:find('"test": "data"') then
        print("✅ JSON data was correctly sent")
    else
        print("⚠️ JSON data may not have been processed correctly")
    end
else
    print("❌ HTTP POST with headers failed")
    print("Success:", success1)
    print("Response:", tostring(response1))
end

-- Method 2: POST without headers
local success2, response2 = pcall(function()
    return httpPost(postUrl, postData)
end)

if success2 and response2 and response2 ~= "" then
    print("✅ HTTP POST without headers successful")
    print("Response length:", string.len(response2))
else
    print("❌ HTTP POST without headers failed")
    print("Success:", success2)
    print("Response:", tostring(response2))
end

-- Test 4: Test our target API
print("\n🎯 Test 4: smartgram API Test")
local apiUrl = "https://smartgram.jp/api/license/verify"
local deviceHash = "TEST123456789"  -- Test device hash
local apiData = '{"device_hash":"' .. deviceHash .. '"}'

print("API URL:", apiUrl)
print("API data:", apiData)

local success3, response3 = pcall(function()
    local headers = "Content-Type: application/json"
    return httpPost(apiUrl, apiData, headers, 30)
end)

if success3 and response3 and response3 ~= "" then
    print("✅ smartgram API responded")
    print("Response length:", string.len(response3))
    print("Response preview:", string.sub(response3, 1, 300) .. "...")

    -- Check if it's JSON
    if response3:find("{") and response3:find("}") then
        print("✅ Response appears to be JSON")

        -- Try to extract key fields
        if response3:find('"is_valid"') then
            print("✅ Response contains is_valid field")
        end
        if response3:find('"status"') then
            print("✅ Response contains status field")
        end
    else
        print("⚠️ Response doesn't appear to be JSON")
    end
else
    print("❌ smartgram API test failed")
    print("Success:", success3)
    print("Response:", tostring(response3))
end

-- Test 5: Network diagnostics
print("\n🔍 Test 5: Network Diagnostics")

-- Test multiple domains
local testDomains = {
    "https://www.google.com",
    "https://httpbin.org/get",
    "https://api.github.com",
    "https://smartgram.jp"
}

for i, domain in ipairs(testDomains) do
    local success, response = pcall(function()
        return httpGet(domain, nil, 5) -- 5 second timeout
    end)

    if success and response and response ~= "" then
        print("✅", domain, "- Reachable")
    else
        print("❌", domain, "- Failed")
    end
end

-- Summary
print("\n📊 Test Summary")
print("=" .. string.rep("=", 40))

local httpPostAvailable = (type(httpPost) == "function")
local httpGetAvailable = (type(httpGet) == "function")
local basicConnectivity = (success and response and response ~= "")
local apiConnectivity = (success3 and response3 and response3 ~= "")

print("HTTP POST available:", httpPostAvailable and "✅ YES" or "❌ NO")
print("HTTP GET available:", httpGetAvailable and "✅ YES" or "❌ NO")
print("Basic connectivity:", basicConnectivity and "✅ YES" or "❌ NO")
print("smartgram API:", apiConnectivity and "✅ YES" or "❌ NO")

if httpPostAvailable and httpGetAvailable and basicConnectivity then
    print("\n🎉 CONCLUSION: HTTP functions appear to be working!")
    if not apiConnectivity then
        print("⚠️ However, smartgram API may have issues - check server status")
    end
else
    print("\n❌ CONCLUSION: HTTP functions have issues")
    print("🔧 Possible solutions:")
    print("   - Check AutoTouch version and HTTP API support")
    print("   - Verify network connectivity")
    print("   - Check iOS network permissions for AutoTouch")
    print("   - Try different HTTP function signatures")
end

print("\n✅ HTTP test completed")