-- Debug Test Script - Minimal test to identify the print issue

print("🔧 Debug Test Script START")
print("=" .. string.rep("=", 40))

-- Test 1: Basic variable handling
print("\n📋 Test 1: Basic Variable Handling")
local testHash = "FFMZ3GTSJC6J"
print("Test hash:", testHash)
print("Test hash type:", type(testHash))
print("Test hash length:", string.len(testHash))

-- Test 2: String concatenation
print("\n🔗 Test 2: String Concatenation")
local url = "https://example.com/api"
local fullUrl = url .. "/license/verify"
print("Base URL:", url)
print("Full URL:", fullUrl)

-- Test 3: JSON creation
print("\n📋 Test 3: JSON Creation")
local deviceHash = "FFMZ3GTSJC6J"
local jsonBody = '{"device_hash":"' .. deviceHash .. '"}'
print("Device hash:", deviceHash)
print("JSON body:", jsonBody)

-- Test 4: Function call test
print("\n🔧 Test 4: Function Call Test")

function testFunction(param)
    print("Function received:", param)
    print("Function received type:", type(param))
    print("Function received length:", string.len(param or ""))
    return "success"
end

local result = testFunction(testHash)
print("Function returned:", result)

-- Test 5: Simple openURL test
print("\n🌐 Test 5: OpenURL Test")
if openURL then
    print("✅ openURL function available")
    local testUrl = "https://www.google.com"
    print("Test URL:", testUrl)

    local success = pcall(function()
        return openURL(testUrl)
    end)

    if success then
        print("✅ openURL call successful")
    else
        print("❌ openURL call failed")
    end
else
    print("❌ openURL function not available")
end

-- Test 6: File I/O test
print("\n📁 Test 6: File I/O Test")
local testFile = "/tmp/debug_test.txt"
local fileSuccess = pcall(function()
    local file = io.open(testFile, "w")
    if file then
        file:write("Debug test: " .. os.date())
        file:close()
        print("✅ File write successful")

        -- Read it back
        local readFile = io.open(testFile, "r")
        if readFile then
            local content = readFile:read("*all")
            readFile:close()
            print("✅ File read successful:", content)
            os.remove(testFile)
        end
    end
end)

if not fileSuccess then
    print("❌ File I/O test failed")
end

-- Test 7: Alert/Dialog test
print("\n💬 Test 7: Alert Test")
if alert then
    print("✅ alert function available")

    local alertResult = alert("Debug Test", "This is a debug test alert. Click OK to continue.", {"OK", "Cancel"})
    print("Alert result:", alertResult)
else
    print("❌ alert function not available")
end

print("\n✅ Debug test completed")
print("If you see this message, basic AutoTouch functions are working")