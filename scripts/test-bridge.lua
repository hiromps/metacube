-- Test script for HTTP bridge communication
-- This script tests only the file-based bridge communication

print("🔧 HTTP Bridge Communication Test")
print("=" .. string.rep("=", 40))

-- Configuration
local requestFile = "/tmp/metacube_request.json"
local responseFile = "/tmp/metacube_response.json"
local deviceHash = "FFMZ3GTSJC6J"

-- Test 1: Check file I/O capabilities
print("\n📁 Test 1: File I/O Test")
local testSuccess = pcall(function()
    local testFile = "/tmp/test_write.txt"
    local file = io.open(testFile, "w")
    if file then
        file:write("Test: " .. os.time())
        file:close()
        print("✅ File write successful")

        -- Read it back
        local readFile = io.open(testFile, "r")
        if readFile then
            local content = readFile:read("*all")
            readFile:close()
            print("✅ File read successful:", content)

            -- Clean up
            os.remove(testFile)
            print("✅ File cleanup successful")
            return true
        end
    end
    return false
end)

if not testSuccess then
    print("❌ File I/O test failed - bridge communication not possible")
    return
end

-- Test 2: Clean up any existing files
print("\n🧹 Test 2: Cleanup Existing Files")
local cleanup = io.open(responseFile, "r")
if cleanup then
    cleanup:close()
    os.remove(responseFile)
    print("✅ Removed existing response file")
end

local cleanup2 = io.open(requestFile, "r")
if cleanup2 then
    cleanup2:close()
    os.remove(requestFile)
    print("✅ Removed existing request file")
end

-- Test 3: Create HTTP bridge request
print("\n📤 Test 3: Create Bridge Request")
local requestSuccess = pcall(function()
    local file = io.open(requestFile, "w")
    if file then
        local requestData = string.format([[{
  "url": "https://metacube-el5.pages.dev/api/license/verify",
  "method": "POST",
  "body": "{\"device_hash\":\"%s\"}",
  "timestamp": %d,
  "headers": {
    "Content-Type": "application/json"
  }
}]], deviceHash, os.time())

        file:write(requestData)
        file:close()

        print("✅ Request file created")
        print("📋 Request data:", requestData)
        return true
    end
    return false
end)

if not requestSuccess then
    print("❌ Failed to create request file")
    return
end

-- Test 4: Wait for HTTP bridge to process
print("\n⏳ Test 4: Waiting for HTTP Bridge Response")
print("🔍 Make sure HTTP bridge is running: node http-bridge.js")
print("📂 Request file:", requestFile)
print("📂 Response file:", responseFile)

local maxWait = 30
local waitCount = 0
local responseReceived = false

while waitCount < maxWait do
    usleep(1000000) -- Wait 1 second
    waitCount = waitCount + 1

    -- Check if response file exists
    local responseF = io.open(responseFile, "r")
    if responseF then
        local responseContent = responseF:read("*all")
        responseF:close()

        if responseContent and responseContent ~= "" then
            print("✅ HTTP bridge response received!")
            print("📥 Response length:", string.len(responseContent))
            print("📋 Response content:", responseContent)

            -- Try to parse the bridge response
            local success, result = pcall(function()
                -- Simple JSON parsing for bridge response
                if responseContent:find('"success":%s*true') then
                    local body = responseContent:match('"body":%s*"([^"]+)"')
                    if body then
                        print("✅ Bridge successful, API response body:", body)
                        return body
                    end
                else
                    local error = responseContent:match('"error":%s*"([^"]+)"')
                    print("❌ Bridge error:", error or "Unknown error")
                end
                return nil
            end)

            responseReceived = true
            break
        end
    end

    if waitCount % 5 == 0 then
        print("⏳ Still waiting... (" .. waitCount .. "/" .. maxWait .. "s)")
    end
end

-- Test 5: Results
print("\n📊 Test Results")
print("=" .. string.rep("=", 40))

if responseReceived then
    print("✅ HTTP Bridge communication: SUCCESS")
    print("🎯 The bridge is working and can process requests")
    print("💡 You can now use the full main.lua script")
else
    print("❌ HTTP Bridge communication: TIMEOUT")
    print("🔍 Possible causes:")
    print("   - HTTP bridge not running (run: node http-bridge.js)")
    print("   - Bridge script not found")
    print("   - Network connectivity issues")
    print("   - File permissions problems")

    -- Check if request file still exists
    local stillExists = io.open(requestFile, "r")
    if stillExists then
        stillExists:close()
        print("⚠️ Request file still exists - bridge may not be processing")
    else
        print("🔍 Request file was processed but no response received")
    end
end

-- Cleanup
print("\n🧹 Cleanup")
pcall(function() os.remove(requestFile) end)
pcall(function() os.remove(responseFile) end)
print("✅ Test completed")