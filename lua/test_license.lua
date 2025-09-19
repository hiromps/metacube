-- ==========================================
-- SocialTouch ライセンステスト用スクリプト
-- API通信テスト
-- ==========================================

-- ログ出力設定
local function log(message)
    print(os.date("[%Y-%m-%d %H:%M:%S] ") .. message)
end

-- 設定
local Config = {
    API_BASE_URL = "http://localhost:3001/api",
    TEST_DEVICE_HASH = "58ff07d6539b1b8c"
}

-- HTTP リクエスト（シミュレーション）
local function httpRequest(url, method, data)
    log(string.format("🌐 HTTPリクエスト: %s %s", method, url))

    -- 実際のHTTPリクエストの代わりにcurlコマンドを使用
    local jsonData = ""
    if data then
        local parts = {}
        for k, v in pairs(data) do
            table.insert(parts, string.format('"%s":"%s"', k, v))
        end
        jsonData = "{" .. table.concat(parts, ",") .. "}"
    end

    local command = string.format('curl -s -X %s %s -H "Content-Type: application/json" -d \'%s\'',
                                   method, url, jsonData)

    log("実行コマンド: " .. command)

    local handle = io.popen(command)
    local response = handle:read("*a")
    handle:close()

    if not response or response == "" then
        return nil, "HTTPリクエストに失敗しました"
    end

    log("レスポンス: " .. response)

    -- 簡易JSON解析
    local result = {}
    for key, value in string.gmatch(response, '"([%w_]+)":"?([^",}]+)"?') do
        if value == "true" then
            result[key] = true
        elseif value == "false" then
            result[key] = false
        else
            result[key] = value
        end
    end

    return result, nil
end

-- ライセンス認証テスト
local function testLicenseVerification()
    log("=== ライセンス認証テスト開始 ===")

    local url = Config.API_BASE_URL .. "/license/verify"
    local data = { device_hash = Config.TEST_DEVICE_HASH }

    local response, err = httpRequest(url, "POST", data)

    if err then
        log("❌ API通信エラー: " .. err)
        return false
    end

    if not response then
        log("❌ レスポンスが空です")
        return false
    end

    log("📊 認証結果:")
    log("  - success: " .. tostring(response.success))
    log("  - is_valid: " .. tostring(response.is_valid))
    log("  - status: " .. tostring(response.status))
    log("  - expires_at: " .. tostring(response.expires_at))

    if response.success and response.is_valid then
        log("✅ ライセンス認証成功！")
        return true, response.expires_at
    else
        log("❌ ライセンス認証失敗")
        return false
    end
end

-- デバイスハッシュ生成テスト
local function testDeviceHashGeneration()
    log("=== デバイスハッシュ生成テスト ===")

    -- シミュレートされたデバイス情報
    local deviceId = "test_device_001"
    local model = "iPhone"

    local data = deviceId .. ":" .. model .. ":socialtouch"
    log("ハッシュ元データ: " .. data)

    -- 簡易ハッシュ生成
    local hash = ""
    local sum = 0

    for i = 1, string.len(data) do
        sum = sum + string.byte(data, i)
    end

    math.randomseed(sum)
    for i = 1, 16 do
        local n = math.random(0, 15)
        if n < 10 then
            hash = hash .. tostring(n)
        else
            hash = hash .. string.char(87 + n)
        end
    end

    log("生成されたハッシュ: " .. hash)
    return hash
end

-- メイン実行
local function main()
    log("==========================================")
    log("    SocialTouch License Test Script      ")
    log("==========================================")

    -- デバイスハッシュ生成テスト
    local generatedHash = testDeviceHashGeneration()

    print() -- 空行

    -- ライセンス認証テスト
    local isValid, expiresAt = testLicenseVerification()

    print() -- 空行

    if isValid then
        log("🎉 すべてのテストが正常に完了しました")
        log("📅 有効期限: " .. tostring(expiresAt))

        -- Luaスクリプトでの処理例
        log("📱 実際のAutoTouchスクリプトでは以下の処理を実行:")
        log("  1. ツール選択画面を表示")
        log("  2. 選択されたツールを実行")
        log("  3. ライセンス認証は24時間キャッシュされます")
    else
        log("⚠️ ライセンス認証に失敗しました")
        log("📝 実際のスクリプトでは登録画面を表示します")
    end

    log("==========================================")
end

-- テスト実行
main()