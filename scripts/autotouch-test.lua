-- AutoTouch Environment Test Script
-- Tests available functions and capabilities in current AutoTouch environment

print("🔧 AutoTouch Environment Test")
print("=" .. string.rep("=", 50))

-- Test 1: Basic AutoTouch functions
print("\n📋 Test 1: Core AutoTouch Functions")
local coreFunctions = {
    "touchDown", "touchUp", "touchMove", "usleep",
    "getColor", "findImage", "getScreenResolution",
    "screenshot", "toast", "alert", "vibrate"
}

for _, funcName in ipairs(coreFunctions) do
    local func = _G[funcName]
    if func then
        print("✅", funcName .. ":", type(func))
    else
        print("❌", funcName .. ":", "not available")
    end
end

-- Test 2: Network functions
print("\n🌐 Test 2: Network Functions")
local networkFunctions = {
    "httpPost", "httpGet", "httpRequest", "openURL"
}

for _, funcName in ipairs(networkFunctions) do
    local func = _G[funcName]
    if func then
        print("✅", funcName .. ":", type(func))
    else
        print("❌", funcName .. ":", "not available")
    end
end

-- Test 3: File I/O functions
print("\n📁 Test 3: File I/O Functions")
local ioFunctions = {
    "io.open", "io.close", "os.time", "os.date", "os.remove"
}

for _, funcName in ipairs(ioFunctions) do
    -- Split module.function notation
    local module, func = funcName:match("([^%.]+)%.(.+)")
    if module and func then
        local moduleTable = _G[module]
        if moduleTable and moduleTable[func] then
            print("✅", funcName .. ":", type(moduleTable[func]))
        else
            print("❌", funcName .. ":", "not available")
        end
    else
        local globalFunc = _G[funcName]
        if globalFunc then
            print("✅", funcName .. ":", type(globalFunc))
        else
            print("❌", funcName .. ":", "not available")
        end
    end
end

-- Test 4: System functions
print("\n⚙️ Test 4: System Functions")
local systemFunctions = {
    "system", "os.execute", "dofile", "loadfile", "require"
}

for _, funcName in ipairs(systemFunctions) do
    local func = _G[funcName]
    if func then
        print("✅", funcName .. ":", type(func))
    else
        print("❌", funcName .. ":", "not available")
    end
end

-- Test 5: Clipboard/Pasteboard functions
print("\n📋 Test 5: Clipboard Functions")
local clipboardFunctions = {
    "copyText", "pasteText", "getClipboard", "setClipboard"
}

for _, funcName in ipairs(clipboardFunctions) do
    local func = _G[funcName]
    if func then
        print("✅", funcName .. ":", type(func))
    else
        print("❌", funcName .. ":", "not available")
    end
end

-- Test 6: Device information functions
print("\n📱 Test 6: Device Information Functions")
local deviceFunctions = {
    "getDeviceID", "getSN", "getDeviceName", "getSystemVersion"
}

for _, funcName in ipairs(deviceFunctions) do
    local func = _G[funcName]
    if func then
        print("✅", funcName .. ":", type(func))
        -- Try to get actual value
        local success, result = pcall(func)
        if success and result then
            print("    Value:", tostring(result):sub(1, 20) .. "...")
        end
    else
        print("❌", funcName .. ":", "not available")
    end
end

-- Test 7: Screen functions
print("\n🖥️ Test 7: Screen Functions")
if getScreenResolution then
    local success, width, height = pcall(getScreenResolution)
    if success then
        print("✅ Screen resolution:", width .. "x" .. height)
    else
        print("❌ Failed to get screen resolution")
    end
else
    print("❌ getScreenResolution not available")
end

-- Test 8: File system test
print("\n💾 Test 8: File System Test")
local testFile = "/tmp/autotouch_test.txt"
local fileSuccess = pcall(function()
    local file = io.open(testFile, "w")
    if file then
        file:write("AutoTouch test: " .. os.date())
        file:close()
        print("✅ File write successful")

        -- Read it back
        local readFile = io.open(testFile, "r")
        if readFile then
            local content = readFile:read("*all")
            readFile:close()
            print("✅ File read successful:", content:sub(1, 30) .. "...")

            -- Clean up
            os.remove(testFile)
            print("✅ File cleanup successful")
        end
    end
end)

if not fileSuccess then
    print("❌ File system test failed")
end

-- Test 9: openURL test (if available)
print("\n🔗 Test 9: URL Opening Test")
if openURL then
    print("✅ openURL function available")

    -- Test with a simple URL
    local urlSuccess = pcall(function()
        return openURL("https://www.google.com")
    end)

    if urlSuccess then
        print("✅ openURL execution successful")
    else
        print("❌ openURL execution failed")
    end
else
    print("❌ openURL function not available")
end

-- Test 10: Alternative communication capabilities
print("\n🔄 Test 10: Communication Alternatives")

-- Check for any HTTP-related environment variables
local envVars = {"HTTP_PROXY", "HTTPS_PROXY", "NO_PROXY"}
for _, var in ipairs(envVars) do
    local value = os.getenv and os.getenv(var)
    if value then
        print("🔍 Environment variable", var .. ":", value)
    end
end

-- Summary
print("\n📊 Test Summary")
print("=" .. string.rep("=", 50))

local hasHTTP = (type(httpPost) == "function" or type(httpGet) == "function")
local hasURL = (type(openURL) == "function")
local hasFileIO = (type(io.open) == "function")
local hasClipboard = (type(copyText) == "function")

print("HTTP functions:", hasHTTP and "✅ Available" or "❌ Not available")
print("URL opening:", hasURL and "✅ Available" or "❌ Not available")
print("File I/O:", hasFileIO and "✅ Available" or "❌ Not available")
print("Clipboard:", hasClipboard and "✅ Available" or "❌ Not available")

if hasHTTP then
    print("\n🎉 Recommendation: Use direct HTTP communication")
elseif hasURL and hasFileIO then
    print("\n🔄 Recommendation: Use URL + file-based bridge communication")
elseif hasFileIO then
    print("\n📁 Recommendation: Use file-based bridge communication only")
else
    print("\n⚠️ Recommendation: Limited communication options - may need manual intervention")
end

print("\n✅ AutoTouch environment test completed")