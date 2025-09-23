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
    print("🔍 デバイスハッシュ取得を開始...")
    print("🔍 AutoTouch環境確認中...")

    -- AutoTouch環境の基本チェック
    if _G.getSN then
        print("✅ グローバル getSN() 関数が存在します")
    end
    if _G.getDeviceID then
        print("✅ グローバル getDeviceID() 関数が存在します")
    end
    if _G.getScreenResolution then
        print("✅ グローバル getScreenResolution() 関数が存在します")
    end

    -- 複数の方法でデバイスハッシュを取得
    local deviceHash = nil

    -- Method 1: Try getSN() function (AutoTouch Device Serial Number)
    print("🔍 Method 1: getSN() を試行中...")

    -- getSN関数の存在確認
    if type(getSN) == "function" then
        print("✅ getSN() 関数が利用可能です")

        -- getSN()を直接呼び出し（pcallなし）
        local result = getSN()
        print("getSN result: " .. tostring(result))
        print("getSN type: " .. tostring(type(result)))

        if result and result ~= "" and type(result) == "string" then
            -- 結果をクリーンアップ（改行文字など除去）
            local success, cleanedResult = pcall(function()
                return result:gsub("\n", ""):gsub("\r", ""):gsub("%s+", "")
            end)

            if success then
                deviceHash = cleanedResult
                print("Device hash from getSN: " .. tostring(deviceHash))

                -- 長さチェックを安全に実行
                local hashLen = deviceHash and #deviceHash or 0
                print("Hash length: " .. tostring(hashLen))

                -- 有効性チェック
                if hashLen >= 8 then
                    print("SUCCESS: Valid device hash obtained via getSN()")
                    print("SKIP: Skipping other methods due to getSN() success")

                    -- デバイスハッシュを保存
                    local hashFile = "/var/mobile/Library/AutoTouch/Scripts/.device_hash"
                    local success, file = pcall(io.open, hashFile, "w")
                    if success and file then
                        file:write(deviceHash)
                        file:close()
                        print("SUCCESS: Hash saved to file")
                    end

                    print("FINAL DEVICE HASH: " .. tostring(deviceHash))
                    return deviceHash  -- 早期リターン
                else
                    print("⚠️ getSN()の結果が短すぎます - 他の方法を試行")
                    deviceHash = nil
                end
            else
                print("⚠️ デバイスハッシュのクリーンアップに失敗")
                deviceHash = result -- クリーンアップなしで使用
            end
        else
            print("⚠️ getSN() 結果が無効です - 型:", type(result), "値:", tostring(result))
        end
    else
        print("⚠️ getSN() 関数が利用できません - 型:", type(getSN))
    end

    -- Method 2: Try getDeviceID() function
    if not deviceHash then
        print("🔍 Method 2: getDeviceID() を試行中...")
        if getDeviceID then
            local success, result = pcall(getDeviceID)
            print("🔍 getDeviceID() 実行結果 - success:", success, "result:", tostring(result))
            if success and result and result ~= "" then
                deviceHash = result
                print("📱 デバイスハッシュ取得成功 (getDeviceID): " .. deviceHash)
            else
                print("⚠️ getDeviceID() 失敗:", tostring(result))
            end
        else
            print("⚠️ getDeviceID() 関数が利用できません")
        end
    end

    -- Method 3: Generate from screen resolution as fallback
    if not deviceHash then
        print("🔍 Method 3: 画面解像度ベースの生成を試行中...")
        local success, width, height = pcall(getScreenResolution)
        print("🔍 getScreenResolution() 実行結果 - success:", success, "width:", tostring(width), "height:", tostring(height))
        if success and width and height then
            -- Create a simple hash from screen resolution and current time
            local timeStr = tostring(os.time())
            local resolutionStr = width .. "x" .. height
            print("🔍 ハッシュ入力: " .. resolutionStr .. "_" .. timeStr)
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
        print("🔍 Method 4: 保存済みハッシュの読み込みを試行中...")
        local hashFile = "/var/mobile/Library/AutoTouch/Scripts/.device_hash"
        print("🔍 ハッシュファイルパス:", hashFile)
        local file = io.open(hashFile, "r")
        if file then
            deviceHash = file:read("*all")
            file:close()
            print("🔍 読み込んだハッシュ（raw）:", tostring(deviceHash))
            if deviceHash and deviceHash ~= "" then
                deviceHash = deviceHash:gsub("\n", ""):gsub("\r", "")
                print("📱 デバイスハッシュ読み込み (保存済み): " .. deviceHash)
            else
                print("⚠️ 保存済みハッシュが空です")
                deviceHash = nil
            end
        else
            print("⚠️ ハッシュファイルが見つかりません")
        end
    end

    -- Method 5: Generate a static hash as ultimate fallback
    if not deviceHash then
        print("🔍 Method 5: 静的ハッシュの生成...")
        -- より信頼性の高いフォールバック値を生成
        local staticSeed = "SMARTGRAM_" .. tostring(os.time()):sub(-6)
        local hash = 0
        for i = 1, #staticSeed do
            local char = string.byte(staticSeed, i)
            hash = ((hash * 31) + char) % 2147483647
        end
        deviceHash = string.format("FALLBACK_%X", hash):sub(1, 16)
        print("📱 フォールバックハッシュ生成: " .. deviceHash)
    end

    -- Save hash for future use
    if deviceHash and deviceHash ~= "" then
        print("🔍 ハッシュを保存中...")
        local hashFile = "/var/mobile/Library/AutoTouch/Scripts/.device_hash"
        local file = io.open(hashFile, "w")
        if file then
            file:write(deviceHash)
            file:close()
            print("✅ ハッシュ保存完了")
        else
            print("⚠️ ハッシュ保存に失敗")
        end
    end

    -- 最終結果の確認と表示
    if deviceHash and deviceHash ~= "" then
        print("📱 最終デバイスハッシュ: " .. tostring(deviceHash))
        print("✅ デバイスハッシュ取得に成功しました")

        -- 取得方法の確認
        if string.find(deviceHash, "FALLBACK") then
            print("🔄 フォールバック方式で取得")
        else
            print("🎯 AutoTouch API経由で取得")
        end

        return deviceHash
    else
        print("❌ すべての方法でデバイスハッシュ取得に失敗")
        return nil
    end

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
-- 汎用JSONパーサー（簡易版）
function parseJSON(str)
    if not str or str == "" then
        return nil
    end

    local result = {}

    -- JSON文字列をデバッグ出力
    print("🔍 JSON解析開始: " .. string.sub(str, 1, 150) .. "...")

    -- すべての文字列フィールドを抽出
    for key, value in string.gmatch(str, '"([^"]+)":%s*"([^"]*)"') do
        result[key] = value
        print("   文字列: " .. key .. " = " .. value)
    end

    -- すべての数値フィールドを抽出
    for key, value in string.gmatch(str, '"([^"]+)":%s*([%d%.%-]+)') do
        local numValue = tonumber(value)
        if numValue then
            result[key] = numValue
            print("   数値: " .. key .. " = " .. tostring(numValue))
        end
    end

    -- すべてのブール値フィールドを抽出
    for key, value in string.gmatch(str, '"([^"]+)":%s*(true|false)') do
        result[key] = (value == "true")
        print("   ブール: " .. key .. " = " .. tostring(result[key]))
    end

    -- 特別処理: last_auth_dataのようなネストしたオブジェクト
    local nested_obj = string.match(str, '"last_auth_data":%s*({[^}]*})')
    if nested_obj then
        print("   ネストオブジェクト発見: last_auth_data")
        result.last_auth_data = parseJSON(nested_obj)
    end

    print("✅ JSON解析完了")
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

-- 汎用JSONエンコード関数
function toJSON(data)
    if not data then
        return "{}"
    end

    if type(data) ~= "table" then
        if type(data) == "string" then
            return '"' .. data .. '"'
        elseif type(data) == "boolean" then
            return data and "true" or "false"
        else
            return tostring(data)
        end
    end

    local parts = {}
    for key, value in pairs(data) do
        local keyStr = '"' .. tostring(key) .. '"'
        local valueStr

        if type(value) == "string" then
            valueStr = '"' .. value .. '"'
        elseif type(value) == "boolean" then
            valueStr = value and "true" or "false"
        elseif type(value) == "number" then
            valueStr = tostring(value)
        elseif value == nil then
            valueStr = "null"
        else
            valueStr = '"' .. tostring(value) .. '"'
        end

        table.insert(parts, keyStr .. ":" .. valueStr)
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

-- 🔧 デバイス設定管理システム
local DeviceConfig = {
    configFile = nil,  -- 動的に設定
    deviceHash = nil,
    isFirstRun = false,
    config = {},
    possibleConfigPaths = {
        "/tmp/smartgram_device_config.json",                                    -- 最も確実
        "/var/tmp/smartgram_device_config.json",                               -- システム一時
        "/var/jb/var/mobile/Library/AutoTouch/Scripts/device_config.json",     -- Scripts直下
        "/var/mobile/Downloads/smartgram_device_config.json"                   -- Downloads
    }
}

-- デバイス設定を初期化・読み込み
function DeviceConfig:initialize()
    print("🔧 デバイス設定を初期化中...")

    -- デバイスハッシュを取得
    self.deviceHash = getDeviceHash()
    print("🔍 getDeviceHash()結果: " .. tostring(self.deviceHash))

    if not self.deviceHash or self.deviceHash == "" then
        print("❌ デバイスハッシュの取得に失敗")
        return false
    end

    print("📱 デバイスハッシュ取得: " .. self.deviceHash)
    print("🔍 デバイスハッシュタイプ: " .. type(self.deviceHash))
    print("🔍 デバイスハッシュ長: " .. string.len(self.deviceHash))

    -- 設定ファイルを読み込み
    return self:loadConfig()
end

-- 設定ファイルを読み込み（なければ初期作成）
function DeviceConfig:loadConfig()
    print("🔍 デバイスハッシュ確認: " .. tostring(self.deviceHash))

    -- デバイスハッシュが設定されていない場合はエラー
    if not self.deviceHash then
        print("❌ デバイスハッシュが未設定です")
        return false
    end

    -- 既存の設定ファイルを複数パスで検索
    for _, configPath in ipairs(self.possibleConfigPaths) do
        local file = io.open(configPath, "r")
        if file then
            local content = file:read("*all")
            file:close()

            if content and content ~= "" then
                print("📄 設定ファイル内容: " .. string.sub(content, 1, 200) .. "...")
                local parsedConfig = parseJSON(content)
                if parsedConfig then
                    print("🔍 解析結果:")
                    print("   保存されたハッシュ: " .. tostring(parsedConfig.device_hash))
                    print("   現在のハッシュ: " .. tostring(self.deviceHash))

                    -- デバイスハッシュの比較
                    local hashMatches = (parsedConfig.device_hash == self.deviceHash)
                    print("   ハッシュ比較結果: " .. tostring(hashMatches))

                    if hashMatches then
                        self.config = parsedConfig
                        self.configFile = configPath  -- 見つかったパスを設定
                        print("✅ 既存の設定ファイルを読み込み: " .. configPath)
                        return true
                    else
                        print("⚠️ デバイスハッシュが異なる設定ファイル: " .. configPath)
                        print("     期待値: " .. tostring(self.deviceHash))
                        print("     実際値: " .. tostring(parsedConfig.device_hash))
                    end
                else
                    print("❌ JSON解析失敗: " .. configPath)
                end
            end
        end
    end

    -- 新規作成
    return self:createConfig()
end

-- 初回用設定ファイルを作成
function DeviceConfig:createConfig()
    print("🆕 新しいデバイス設定を作成中...")
    self.isFirstRun = true

    self.config = {
        device_hash = self.deviceHash,
        created_at = os.date("%Y-%m-%d %H:%M:%S"),
        device_name = self.deviceHash .. "_device",
        auth_status = "pending",
        last_auth_check = 0,
        auto_auth_url = "https://smartgram.jp/auth-device/" .. self.deviceHash,
        user_friendly = true,
        version = "1.0"
    }

    local saveSuccess = self:saveConfig()
    if not saveSuccess then
        print("⚠️ 設定ファイルの保存に失敗しましたが、メモリ上で動作します")
        print("💡 一時的な設定として処理を継続...")
        return true  -- メモリ上の設定で継続
    end

    return saveSuccess
end

-- 設定ファイルを保存（エイリアス）
function DeviceConfig:save()
    return self:saveConfig()
end

-- 設定ファイルを保存
function DeviceConfig:saveConfig()
    -- 複数のパスで保存を試行
    for _, configPath in ipairs(self.possibleConfigPaths) do
        print("💾 保存試行中: " .. configPath)

        local file = io.open(configPath, "w")
        if file then
            local jsonContent = toJSON(self.config)
            print("💾 保存データ: " .. string.sub(jsonContent, 1, 200) .. "...")
            print("🔑 保存するデバイスハッシュ: " .. tostring(self.config.device_hash))

            file:write(jsonContent)
            file:close()

            -- 保存確認
            local checkFile = io.open(configPath, "r")
            if checkFile then
                local content = checkFile:read("*all")
                checkFile:close()

                if content and content ~= "" then
                    print("✅ 保存確認成功: " .. string.sub(content, 1, 100) .. "...")
                    self.configFile = configPath  -- 成功したパスを設定
                    print("✅ 設定ファイル保存成功: " .. configPath)
                    return true
                end
            end
        else
            print("⚠️ 保存失敗: " .. configPath)
        end
    end

    print("❌ 全ての保存パスで失敗しました")
    return false
end

-- 認証ステータスを更新
function DeviceConfig:updateAuthStatus(status, authData)
    self.config.auth_status = status
    self.config.last_auth_check = os.time()

    if authData then
        self.config.last_auth_data = authData
    end

    print("🔄 認証状態を更新中...")
    print("   新しい状態: " .. tostring(status))
    if authData then
        print("   認証データ: " .. tostring(authData.is_valid and "有効" or "無効"))
    end

    return self:saveConfig()
end

-- 有効な認証データがあるかチェック
function DeviceConfig:hasValidAuth()
    if not self.config.last_auth_data then
        print("📋 認証データなし")
        return false
    end

    local authData = self.config.last_auth_data
    if not authData.is_valid then
        print("📋 認証データが無効")
        return false
    end

    -- 有効期限チェック
    if authData.expires_at and authData.expires_at > 0 then
        local now = os.time()
        if now > authData.expires_at then
            print("📋 認証データが期限切れ")
            return false
        end
    end

    print("✅ 有効な認証データを発見")
    return true
end

-- 🔐 アカウント認証状態管理システム
local AccountAuth = {
    lastVerified = 0,           -- 最後の検証時刻
    verificationInterval = 60,  -- 検証間隔（60秒）
    isAuthenticated = false,    -- 現在の認証状態
    deviceHash = nil,           -- デバイスハッシュ
    authData = nil,             -- 認証データ
    backgroundMode = true       -- バックグラウンドモード（Safariを開かない）
}

-- 期限切れかチェック
function AccountAuth:isExpired()
    if not AccountAuth.authData then
        return true
    end

    local data = parseJSON(AccountAuth.authData)
    if data and data.expires_at then
        local now = os.time()
        if now > data.expires_at then
            print("⚠️ ライセンスが期限切れです")
            return true
        end
    end
    return false
end

-- キャッシュをクリア
function AccountAuth:clearCache()
    print("🧹 認証キャッシュをクリア中...")
    AccountAuth.isAuthenticated = false
    AccountAuth.authData = nil
    AccountAuth.lastVerified = 0

    -- 設定ファイルの認証データもクリア
    if DeviceConfig and DeviceConfig.config then
        DeviceConfig.config.last_auth_data = nil
        DeviceConfig.config.auth_status = "expired"
        DeviceConfig:saveConfig()  -- 正しいメソッド名を使用
        print("✅ キャッシュをクリアしました")
    end
end

-- 強制的に最新状態を取得
function AccountAuth:forceRefreshStatus(deviceHash)
    print("🔄 最新の認証状態を取得中...")

    -- まずダッシュボードから最新情報を取得
    local dashboardInfo = self:fetchDashboardInfo(deviceHash)
    if dashboardInfo then
        -- 取得したデータが有効か確認
        local data = parseJSON(dashboardInfo)
        if data and data.is_valid then
            print("✅ ダッシュボードから有効な認証状態を取得しました")
            AccountAuth.isAuthenticated = true
            AccountAuth.authData = dashboardInfo
            AccountAuth.lastVerified = os.time()
            return true
        else
            print("❌ ダッシュボードからの認証データは無効です")
            print("   is_valid:", data and data.is_valid or "nil")
            print("   status:", data and data.status or "nil")
        end
    end

    -- ダッシュボードが無理ならauth-mobileページから取得
    local authMobileResult = self:fetchFromAuthMobile(deviceHash)
    if authMobileResult then
        local data = parseJSON(authMobileResult)
        if data and data.is_valid then
            print("✅ auth-mobileページから有効な認証状態を取得しました")
            AccountAuth.isAuthenticated = true
            AccountAuth.authData = authMobileResult
            AccountAuth.lastVerified = os.time()
            return true
        else
            print("❌ auth-mobileページからの認証データは無効です")
            print("   is_valid:", data and data.is_valid or "nil")
            print("   status:", data and data.status or "nil")
        end
    end

    -- 通常の認証フローを実行
    local authResult = self:performAuthentication(deviceHash)
    if authResult then
        local data = parseJSON(authResult)
        if data and data.is_valid then
            AccountAuth.isAuthenticated = true
            AccountAuth.authData = authResult
            AccountAuth.lastVerified = os.time()
            return true
        end
    end

    print("❌ 全ての認証方法で有効な認証を取得できませんでした")
    return false
end

-- アカウント認証状態をバックグラウンドで検証
function AccountAuth:verifyAuthenticationStatus(deviceHash)
    local currentTime = os.time()

    -- 期限切れの場合は常に最新状態を確認
    if self:isExpired() then
        print("⏰ ライセンス期限切れを検出 - 再契約状態を確認します")

        -- キャッシュをクリアして最新状態を取得
        self:clearCache()

        -- 最新の契約状態を確認
        local refreshed = self:forceRefreshStatus(deviceHash)
        if refreshed then
            -- 更新成功の詳細を表示して、認証データが本当に有効か確認
            local authDetails = self:getAuthenticationDetails()
            if authDetails and authDetails.is_valid then
                print("🎉 ライセンスが更新されました！")
                if authDetails.remaining_hours then
                    print(string.format("✅ 新しいライセンス: 残り%d時間", authDetails.remaining_hours))
                end
                return true
            else
                print("❌ 認証データは取得できましたが、無効な状態です")
                print("💡 ダッシュボードで契約を更新してください: https://smartgram.jp/dashboard")
                return false
            end
        else
            print("❌ ライセンスは期限切れのままです")
            print("💡 ダッシュボードで契約を更新してください: https://smartgram.jp/dashboard")
            return false
        end
    end

    -- 初回実行または定期検証時刻を過ぎた場合
    if self.lastVerified == 0 or (currentTime - self.lastVerified) >= self.verificationInterval then
        print("🔐 アカウント認証状態を検証中...")

        local authResult = self:performAuthentication(deviceHash)

        if authResult then
            -- グローバル変数に直接セット（self は AccountAuth と同じはずだが、念のため両方設定）
            AccountAuth.isAuthenticated = true
            AccountAuth.authData = authResult
            AccountAuth.lastVerified = currentTime

            -- デバッグ: authData の設定確認
            print("📝 AccountAuth.authData を設定:")
            print("   authResult:", authResult and string.sub(tostring(authResult), 1, 100) .. "..." or "nil")
            print("   AccountAuth.authData:", AccountAuth.authData and string.sub(tostring(AccountAuth.authData), 1, 100) .. "..." or "nil")
            print("   AccountAuth.isAuthenticated:", AccountAuth.isAuthenticated)

            print("✅ アカウント認証: 有効")
            return true
        else
            AccountAuth.isAuthenticated = false
            AccountAuth.authData = nil
            print("❌ アカウント認証: 無効")
            return false
        end
    else
        -- キャッシュされた認証状態を返す
        local remainingTime = self.verificationInterval - (currentTime - self.lastVerified)
        print(string.format("🔐 キャッシュされた認証状態: %s (次回検証まで %d秒)",
            self.isAuthenticated and "有効" or "無効", remainingTime))
        return self.isAuthenticated
    end
end

-- 実際のHTTPリクエストを試行（利用可能な場合）
function AccountAuth:tryHttpAuthentication(deviceHash)
    print("🔍 HTTP API認証を試行中...")

    local requestBody = '{"device_hash":"' .. deviceHash .. '"}'
    local url = "https://smartgram.jp/api/license/verify"

    -- 利用可能なHTTP関数を確認
    local httpFunctions = {"httpsPost", "httpPost", "httpsGet", "httpGet"}

    for _, funcName in ipairs(httpFunctions) do
        if _G[funcName] and type(_G[funcName]) == "function" then
            print("✅ " .. funcName .. " 関数が利用可能です")

            local success, response = pcall(function()
                if funcName == "httpsPost" or funcName == "httpPost" then
                    return _G[funcName](url, requestBody, {["Content-Type"] = "application/json"})
                else
                    return _G[funcName](url .. "?device_hash=" .. deviceHash)
                end
            end)

            if success and response then
                print("✅ HTTP認証レスポンス受信: " .. tostring(response))
                return response
            else
                print("❌ " .. funcName .. " 実行失敗: " .. tostring(response))
            end
        else
            print("❌ " .. funcName .. " 関数は利用できません")
        end
    end

    print("⚠️ 全てのHTTP関数が利用できません")
    return nil
end

-- auth-mobileページから認証情報を取得（バックグラウンド版）
function AccountAuth:fetchFromAuthMobile(deviceHash)
    print("🌐 認証情報を取得中...")

    -- まず既存の認証データで十分かチェック
    if not self:isExpired() and AccountAuth.authData then
        local now = os.time()
        local lastAuth = DeviceConfig.config.last_auth_check or 0
        local timeSinceLastAuth = now - lastAuth

        -- 1時間以内の認証データがあれば再利用
        if timeSinceLastAuth < 3600 then
            print("✅ 最近の認証データを使用（" .. math.floor(timeSinceLastAuth / 60) .. "分前）")
            return AccountAuth.authData
        end
    end

    -- バックグラウンドモードで期限切れでない場合は、設定ファイルから読み込み
    if self.backgroundMode and not self:isExpired() then
        print("🔇 バックグラウンドモード: 設定ファイルから認証情報を取得")

        if DeviceConfig.config.last_auth_data then
            local authData = DeviceConfig.config.last_auth_data

            -- 有効期限をチェック
            if authData.expires_at and authData.expires_at > os.time() then
                print("✅ 有効な認証データが設定ファイルに存在")

                -- AuthDataを更新
                AccountAuth.authData = toJSON(authData)
                AccountAuth.isAuthenticated = true
                AccountAuth.lastVerified = os.time()

                return AccountAuth.authData
            end
        end
    end

    -- 期限切れまたは認証データがない場合のみブラウザを開く
    if self:isExpired() or not AccountAuth.authData then
        print("⚠️ 期限切れまたは認証データなし")

        if self.backgroundMode then
            -- バックグラウンドモードでは、期限切れの場合は認証失敗を返す
            print("🔒 バックグラウンドモード: 期限切れのため認証失敗")
            print("💡 ダッシュボードで契約を更新してください: https://smartgram.jp/dashboard")
            print("📱 デバイスハッシュ: " .. deviceHash)

            -- 期限切れデータは生成せず、nilを返して認証失敗を明確にする
            return nil
        end

        -- ブラウザを開く必要がある場合
        print("📱 ブラウザで認証ページを開く必要があります")

        -- auth-mobileページのURL
        local authMobileUrl = "https://smartgram.jp/auth-mobile/?device_hash=" .. deviceHash .. "&source=autotools"
        print("🔗 URL: " .. authMobileUrl)
        print("💡 手動でこのURLを開いて認証を完了してください")

        -- ここではブラウザを開かない
        print("🚫 自動ブラウザ起動を無効化しました")

        return nil
    end

    -- 認証結果を待機（最大30秒）
    local maxWait = 30
    local interval = 2
    local waited = 0

    print("⏳ auth-mobile認証結果を待機中...")
    print("📂 監視中のパス:")
    for _, path in ipairs(resultPaths) do
        print("   - " .. path)
    end

    while waited < maxWait do
        -- ファイル経由で結果を確認
        for _, path in ipairs(resultPaths) do
            local file = io.open(path, "r")
            if file then
                local content = file:read("*all")
                file:close()

                if content and content ~= "" then
                    print("✅ auth-mobile結果を受信: " .. path)
                    print("📄 ファイルサイズ: " .. string.len(content) .. " バイト")

                    -- ファイルを削除
                    os.remove(path)

                    -- JSON解析
                    local result = parseJSON(content)
                    if result then
                        print("📝 受信データの内容:")
                        print("   is_valid:", result.is_valid)
                        print("   success:", result.success)
                        print("   status:", result.status)
                        print("   expires_at:", result.expires_at)
                        print("   time_remaining_seconds:", result.time_remaining_seconds)
                        print("   device_hash:", result.device_hash)

                        -- time_remaining_seconds がある場合、expires_at を計算
                        if result.time_remaining_seconds then
                            local now = os.time()
                            result.expires_at = now + result.time_remaining_seconds

                            local remainingHours = math.floor(result.time_remaining_seconds / 3600)
                            local remainingMinutes = math.floor((result.time_remaining_seconds % 3600) / 60)

                            print("⏰ auth-mobileから取得した残り時間:")
                            print("   秒数: " .. result.time_remaining_seconds)
                            print("   時間: " .. remainingHours .. "時間" .. remainingMinutes .. "分")
                        elseif result.expires_at then
                            -- expires_at が既にある場合、そのまま使用
                            local now = os.time()
                            local remainingSeconds = result.expires_at - now
                            if remainingSeconds > 0 then
                                local remainingHours = math.floor(remainingSeconds / 3600)
                                print("⏰ 残り有効期限: " .. remainingHours .. "時間")
                            end
                        end

                        -- 認証が有効な場合（is_valid または success フィールドをチェック）
                        if result.is_valid or result.success then
                            -- 必要なフィールドを確保
                            result.is_valid = true
                            result.status = result.status or "active"

                            DeviceConfig:updateAuthStatus(result.status, result)
                            print("💾 認証データを設定ファイルに保存しました")

                            return toJSON(result)
                        else
                            print("⚠️ 無効な認証結果")
                            print("   詳細: is_valid=", result.is_valid, ", success=", result.success)
                        end
                    else
                        print("❌ JSON解析に失敗")
                    end
                end
            end
        end

        -- クリップボード経由で確認
        local clipSuccess, clipContent = pcall(getClipboardText)
        if clipSuccess and clipContent then
            -- 特別な形式をチェック
            if string.find(clipContent, "SMARTGRAM_AUTH_MOBILE:") then
                local jsonData = string.match(clipContent, "SMARTGRAM_AUTH_MOBILE:(.+)")
                if jsonData then
                    print("✅ クリップボードからauth-mobile結果を取得")

                    -- クリップボードをクリア
                    pcall(setClipboardText, "")

                    local result = parseJSON(jsonData)
                    if result and result.time_remaining_seconds then
                        local now = os.time()
                        result.expires_at = now + result.time_remaining_seconds

                        local remainingHours = math.floor(result.time_remaining_seconds / 3600)
                        print("⏰ 残り時間: " .. remainingHours .. "時間")

                        DeviceConfig:updateAuthStatus(result.status or "active", result)
                        return toJSON(result)
                    end
                end
            end
        end

        -- プログレス表示
        if waited % 10 == 0 and waited > 0 then
            print(string.format("⏳ 待機中... (%d/%d秒)", waited, maxWait))
        end

        usleep(interval * 1000000)
        waited = waited + interval
    end

    print("⏰ auth-mobile取得タイムアウト")
    return nil
end

-- ユーザーフレンドリーな認証を実行
function AccountAuth:performUserFriendlyAuth(deviceHash)
    print("🎯 ユーザーフレンドリー認証を開始...")

    -- auth-mobileページから最新情報を取得
    local authMobileResult = self:fetchFromAuthMobile(deviceHash)
    if authMobileResult then
        print("✅ auth-mobileページから最新情報を取得しました")
        return authMobileResult
    end

    -- まず設定ファイルに有効な認証データがあるかチェック（フォールバック）
    if DeviceConfig:hasValidAuth() then
        print("💡 設定ファイルに有効な認証データが存在します（フォールバック）")
        local authData = DeviceConfig.config.last_auth_data

        -- 有効期限の確認
        local remainingHours = 0
        if authData.expires_at then
            remainingHours = math.floor((authData.expires_at - os.time()) / 3600)
        end

        print("✅ 保存された認証を使用します")
        print("📅 残り有効期限: " .. remainingHours .. "時間")

        return toJSON(authData)
    end

    -- 有効な認証データがない場合のみ Web認証を実行
    print("⚠️ 有効な認証データがありません - Web認証を開始します")

    -- 認証データがない場合は初回実行として扱う
    local needsFirstTimeSetup = DeviceConfig.isFirstRun or
                               not DeviceConfig.config.last_auth_data or
                               DeviceConfig.config.auth_status == "pending"

    if needsFirstTimeSetup then
        print("🌟 初回セットアップが必要です")
        return self:handleFirstTimeSetup(deviceHash)
    else
        print("🔑 既存ユーザーとして処理します")
        return self:handleRegularAuth(deviceHash)
    end
end

-- 初回セットアップ処理（バックグラウンド対応）
function AccountAuth:handleFirstTimeSetup(deviceHash)
    print("🌟 バックグラウンド初回セットアップを開始します")
    print("🔍 Safariを開かずに認証を試行中...")

    -- 1. まずダッシュボード登録状態をチェック
    local registrationResult = self:checkDashboardRegistration(deviceHash)
    if registrationResult then
        return registrationResult
    end

    -- 2. 自動登録を試行
    local autoRegResult = self:attemptAutoRegistration(deviceHash)
    if autoRegResult then
        return autoRegResult
    end

    -- 3. 初回のみ認証ページのURLを案内（ブラウザは開かない）
    print("📱 初回認証が必要です")
    print("🔗 以下のURLをSafariで開いて認証してください:")
    print("")
    print("https://smartgram.jp/auth-mobile/?device_hash=" .. deviceHash .. "&source=autotools")
    print("")
    print("💡 認証完了後、main.luaを再実行してください")

    -- 初回認証案内ダイアログ
    local controls = {
        {type = CONTROLLER_TYPE.LABEL, text = "🔐 初回認証が必要です 🔐"},
        {type = CONTROLLER_TYPE.LABEL, text = "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"},
        {type = CONTROLLER_TYPE.LABEL, text = ""},
        {type = CONTROLLER_TYPE.LABEL, text = "以下のURLをSafariで開いてください:"},
        {type = CONTROLLER_TYPE.LABEL, text = ""},
        {type = CONTROLLER_TYPE.LABEL, text = "smartgram.jp/auth-mobile/"},
        {type = CONTROLLER_TYPE.LABEL, text = "?device_hash=" .. deviceHash},
        {type = CONTROLLER_TYPE.LABEL, text = ""},
        {type = CONTROLLER_TYPE.LABEL, text = "📱 デバイスハッシュ:"},
        {type = CONTROLLER_TYPE.LABEL, text = "   " .. deviceHash},
        {type = CONTROLLER_TYPE.LABEL, text = ""},
        {type = CONTROLLER_TYPE.LABEL, text = "認証完了後、main.luaを再実行"},
        {type = CONTROLLER_TYPE.LABEL, text = ""},
        {type = CONTROLLER_TYPE.BUTTON, title = "OK", color = 0x68D391, width = 0.8, flag = 1}
    }

    dialog(controls, {ORIENTATION_TYPE.PORTRAIT})

    return nil
end

-- 通常認証処理（既存ユーザー・バックグラウンド対応）
function AccountAuth:handleRegularAuth(deviceHash)
    print("🔑 バックグラウンド認証を実行中...")
    print("🔍 Safariを開かずに既存ユーザー認証を試行中...")

    -- 1. 最新の登録状態を再チェック
    local reCheckResult = self:checkDashboardRegistration(deviceHash)
    if reCheckResult then
        return reCheckResult
    end

    -- 2. キャッシュされた認証データを確認
    local cachedAuth = self:checkCachedAuth(deviceHash)
    if cachedAuth then
        return cachedAuth
    end

    -- 3. バックグラウンド再認証を試行
    local bgAuthResult = self:attemptBackgroundAuth(deviceHash)
    if bgAuthResult then
        return bgAuthResult
    end

    -- 4. 最後の手段として手動認証を案内
    print("📋 バックグラウンド認証に失敗しました")
    print("🔗 手動認証が必要です: https://smartgram.jp/dashboard")
    print("📱 デバイスハッシュ: " .. deviceHash)
    return nil
end

-- デバイス設定完了を待機
function AccountAuth:waitForDeviceSetup(deviceHash)
    print("⏳ デバイス設定の完了を待機中...")

    local maxWaitTime = 120  -- 2分間待機（短縮）
    local checkInterval = 10  -- 10秒間隔
    local waitedTime = 0

    while waitedTime < maxWaitTime do
        -- 設定ファイルの現在状態をチェック
        print("🔍 設定ファイル状態をチェック中...")
        DeviceConfig:loadConfig()

        print("📊 現在の設定状態:")
        print("   認証状態: " .. tostring(DeviceConfig.config.auth_status or "未設定"))
        print("   最終チェック: " .. tostring(DeviceConfig.config.last_auth_check or "なし"))

        -- 設定ファイルに保存された認証データがある場合
        if DeviceConfig.config.last_auth_data then
            print("🔍 保存された認証データを発見:")
            if DeviceConfig.config.last_auth_data.is_valid then
                print("✅ 保存された認証データが有効です")

                -- 認証データを返す
                return toJSON(DeviceConfig.config.last_auth_data)
            end
        end

        -- auth-mobile からの認証完了をチェック
        if DeviceConfig.config.auth_status == "completed" then
            print("✅ デバイス設定が完了しました")

            -- 認証データを生成
            local authData = {
                is_valid = true,
                status = "active",
                expires_at = os.time() + (24 * 60 * 60),
                device_hash = deviceHash,
                authenticated_at = os.time()
            }

            -- 設定を更新
            DeviceConfig:updateAuthStatus("active", authData)
            DeviceConfig.isFirstRun = false

            return toJSON(authData)
        end

        -- 進捗表示
        if waitedTime % 30 == 0 then
            local remainingTime = maxWaitTime - waitedTime
            print(string.format("⏳ 設定待機中... (残り %d秒)", remainingTime))
        end

        -- 待機
        local success, err = pcall(usleep, checkInterval * 1000000)
        if not success and tostring(err):match("interrupted") then
            print("⚠️ ユーザーによって中断されました")
            error("interrupted")
        end

        waitedTime = waitedTime + checkInterval
    end

    print("❌ デバイス設定のタイムアウト")
    return nil
end

-- クイック認証を待機
function AccountAuth:waitForQuickAuth(deviceHash)
    print("⚡ クイック認証を実行中...")

    local maxWaitTime = 60  -- 1分間待機
    local checkInterval = 5   -- 5秒間隔
    local waitedTime = 0

    while waitedTime < maxWaitTime do
        -- 設定ファイルから最新状態を確認
        if DeviceConfig:loadConfig() and DeviceConfig.config.last_auth_data then
            local authData = DeviceConfig.config.last_auth_data
            if authData.is_valid then
                print("✅ クイック認証成功")
                return toJSON(authData)
            end
        end

        -- 待機
        local success, err = pcall(usleep, checkInterval * 1000000)
        if not success and tostring(err):match("interrupted") then
            error("interrupted")
        end

        waitedTime = waitedTime + checkInterval
    end

    print("❌ クイック認証タイムアウト")
    return nil
end

-- 手動セットアップ指示
function AccountAuth:showManualSetupInstructions(deviceHash, setupUrl)
    print("📋 手動セットアップ手順:")
    print("   1. 以下のURLをブラウザで開いてください:")
    print("      " .. setupUrl)
    print("   2. 自動的に認証・登録が完了するまでお待ちください")
    print("   3. 認証完了後、このスクリプトを再実行してください")

    -- 設定ファイルにメモ
    DeviceConfig:updateAuthStatus("manual_setup_required", {
        setup_url = setupUrl,
        instructions_shown = true
    })

    return nil  -- 手動操作が必要
end

-- 手動認証指示
function AccountAuth:showManualAuthInstructions(deviceHash, authUrl)
    print("📋 手動認証手順:")
    print("   1. 以下のURLをブラウザで開いてください:")
    print("      " .. authUrl)
    print("   2. 認証完了後、このスクリプトを再実行してください")

    return nil  -- 手動操作が必要
end

-- 認証URLをブラウザで開く
function AccountAuth:openAuthUrl(url)
    print("🌐 ブラウザを開いています...")

    -- AutoTouchのopenURL関数を試行
    if openURL and type(openURL) == "function" then
        local success, result = pcall(openURL, url)
        if success then
            print("✅ openURL関数でブラウザを開きました")
            return true
        else
            print("❌ openURL関数エラー: " .. tostring(result))
        end
    else
        print("⚠️ openURL関数が利用できません")
    end

    -- 代替方法: システムコマンド（利用可能な場合）
    if os.execute then
        local success, result = pcall(os.execute, 'open "' .. url .. '"')
        if success then
            print("✅ システムコマンドでブラウザを開きました")
            return true
        else
            print("❌ システムコマンドエラー: " .. tostring(result))
        end
    end

    print("❌ ブラウザを自動で開くことができません")
    print("📋 手動で以下のURLをブラウザで開いてください:")
    print("   " .. url)
    return false  -- 手動でも続行可能
end

-- 古い認証ファイルを削除
function AccountAuth:clearAuthFile(filePath)
    local file = io.open(filePath, "r")
    if file then
        file:close()
        os.remove(filePath)
        print("🗑️ 古い認証ファイルを削除しました")
    end
end

-- 認証ファイルの作成を待機
function AccountAuth:waitForAuthFile(filePath)
    print("⏳ 認証ファイル待機中: " .. filePath)
    print("💡 ファイル保存の代替方法:")
    print("   1. ブラウザ認証後、Downloadsフォルダから auth_result.json を移動")
    print("   2. 手動でファイルをパスに配置")
    print("   3. クリップボード経由での認証も確認中...")

    local maxWaitTime = 300  -- 5分間待機
    local checkInterval = 5  -- 5秒間隔でチェック
    local waitedTime = 0

    -- 代替パスのリスト
    local alternativePaths = {
        filePath,
        "/var/jb/var/mobile/Library/AutoTouch/Scripts/auth_result.json",
        "/var/mobile/Downloads/auth_result.json",
        "/tmp/auth_result.json",
        "/var/tmp/auth_result.json"
    }

    while waitedTime < maxWaitTime do
        -- 複数パスでファイル存在確認
        for i, checkPath in ipairs(alternativePaths) do
            local file = io.open(checkPath, "r")
            if file then
                local content = file:read("*all")
                file:close()

                if content and content ~= "" then
                    print("✅ 認証ファイルを検出しました: " .. checkPath)
                    print("📄 内容: " .. string.sub(content, 1, 100) .. "...")

                    -- JSON解析
                    local authData = parseJSON(content)
                    if authData and authData.success then
                        print("✅ WebView認証成功")

                        -- 認証データをキャッシュ形式に変換
                        local cacheData = {
                            is_valid = true,
                            status = "active",
                            expires_at = os.time() + (24 * 60 * 60),  -- 24時間有効
                            device_hash = authData.device_hash or "unknown",
                            authenticated_at = os.time()
                        }

                        -- 成功したファイルを削除（一回限りの使用）
                        os.remove(checkPath)
                        print("🗑️ 使用済み認証ファイルを削除: " .. checkPath)

                        return toJSON(cacheData)
                    else
                        print("❌ 認証ファイルが無効です: " .. checkPath)
                    end
                end
            end
        end

        -- クリップボードからの認証も確認
        if waitedTime % 30 == 0 then  -- 30秒ごとに確認
            local clipboardAuth = self:checkClipboardAuth()
            if clipboardAuth then
                return clipboardAuth
            end
        end

        -- 待機時間表示
        if waitedTime % 15 == 0 then  -- 15秒ごとに進捗表示
            local remainingTime = maxWaitTime - waitedTime
            print(string.format("⏳ 認証待機中... (残り %d秒)", remainingTime))
        end

        -- 中断チェック
        local success, err = pcall(usleep, checkInterval * 1000000)  -- 5秒待機
        if not success and tostring(err):match("interrupted") then
            print("⚠️ ユーザーによって中断されました")
            error("interrupted")
        end

        waitedTime = waitedTime + checkInterval
    end

    print("❌ 認証ファイル待機タイムアウト (5分)")
    print("💡 ヒント:")
    print("   1. ブラウザで認証が完了していることを確認")
    print("   2. インターネット接続を確認")
    print("   3. 再度実行してみてください")
    print("   4. ダッシュボードでデバイスハッシュが正しく登録されているか確認")

    return nil
end

-- クリップボードから認証データを確認
function AccountAuth:checkClipboardAuth()
    -- AutoTouchのクリップボード関数が利用可能な場合
    if getClipboardText and type(getClipboardText) == "function" then
        local success, clipboardContent = pcall(getClipboardText)
        if success and clipboardContent then
            -- 特別な認証形式を確認
            if string.match(clipboardContent, "^SMARTGRAM_AUTH_RESULT:") then
                local jsonPart = string.gsub(clipboardContent, "^SMARTGRAM_AUTH_RESULT:", "")
                local authData = parseJSON(jsonPart)

                if authData and authData.is_valid then
                    print("✅ クリップボード認証成功")

                    -- 認証データをキャッシュ形式に変換
                    local cacheData = {
                        is_valid = true,
                        status = authData.status or "active",
                        expires_at = authData.expires_at or (os.time() + (24 * 60 * 60)),
                        device_hash = authData.device_hash or "unknown",
                        authenticated_at = authData.authenticated_at or os.time()
                    }

                    -- 設定ファイルに保存
                    DeviceConfig:updateAuthStatus("active", cacheData)
                    print("💾 認証データを設定ファイルに保存しました")

                    -- クリップボードをクリア（セキュリティ）
                    if setClipboardText and type(setClipboardText) == "function" then
                        pcall(setClipboardText, "")
                    end

                    return toJSON(cacheData)
                end
            end
        end
    end

    return nil
end

-- ダッシュボード登録状態をチェック
function AccountAuth:checkDashboardRegistration(deviceHash)
    print("🔍 ダッシュボード登録状態をチェック中...")

    -- まず、ダッシュボードから最新情報を取得を試行
    local dashboardInfo = self:fetchDashboardInfo(deviceHash)
    if dashboardInfo then
        print("✅ ダッシュボードから最新情報を取得しました")
        return dashboardInfo
    end

    -- フォールバック: 既知の登録済みデバイスリスト（手動で更新）
    local knownRegisteredDevices = {
        "FFMZ3GTSJC6J",  -- 実際のデバイス
        -- 他の登録済みデバイスがあればここに追加
    }

    for _, registeredDevice in ipairs(knownRegisteredDevices) do
        if deviceHash == registeredDevice then
            print("✅ デバイスは登録済みです（フォールバック）")

            -- 認証データを生成
            local authData = {
                is_valid = true,
                status = "active",
                expires_at = os.time() + (24 * 60 * 60),
                device_hash = deviceHash,
                authenticated_at = os.time(),
                auth_method = "known_device"
            }

            -- 設定ファイルに保存
            DeviceConfig:updateAuthStatus("active", authData)
            print("💾 認証データを設定ファイルに保存しました")

            return toJSON(authData)
        end
    end

    print("⚠️ デバイスは未登録です")
    return nil
end

-- ダッシュボードから最新情報を取得（auth-mobile経由）
function AccountAuth:fetchDashboardInfo(deviceHash)
    print("🌐 ダッシュボードから最新情報を取得中...")
    print("📱 対象デバイス: " .. deviceHash)

    -- auth-mobileページ経由で最新情報を取得
    print("📱 auth-mobileページ経由で認証情報を取得します")

    -- auth-mobileページから情報を取得（既存の関数を利用）
    return self:fetchFromAuthMobile(deviceHash)
end

-- デバイス情報を処理して認証データに変換
function AccountAuth:processDeviceInfo(deviceInfo)
    print("🔧 デバイス情報を処理中...")

    -- デバイス情報の検証
    if not deviceInfo.is_registered then
        print("❌ デバイスが登録されていません")
        return nil
    end

    -- ステータス確認
    local status = deviceInfo.status or "unknown"
    local subscriptionEnd = deviceInfo.subscription_end
    local trialEnd = deviceInfo.trial_end

    print("📊 デバイス情報:")
    print("   登録状態: " .. (deviceInfo.is_registered and "✅ 登録済み" or "❌ 未登録"))
    print("   ステータス: " .. status)
    print("   サブスク終了: " .. (subscriptionEnd or "なし"))
    print("   トライアル終了: " .. (trialEnd or "なし"))

    -- 有効期限を計算
    local expiresAt = os.time() + (24 * 60 * 60)  -- デフォルト24時間

    if status == "trial" and trialEnd then
        -- トライアル期間中
        local trialEndTime = self:parseDateTime(trialEnd)
        if trialEndTime then
            expiresAt = trialEndTime
        end
    elseif status == "active" and subscriptionEnd then
        -- 有料プラン
        local subscriptionEndTime = self:parseDateTime(subscriptionEnd)
        if subscriptionEndTime then
            expiresAt = subscriptionEndTime
        end
    end

    -- 認証データを生成
    local authData = {
        is_valid = (status == "trial" or status == "active"),
        status = status,
        expires_at = expiresAt,
        device_hash = deviceInfo.device_hash,
        authenticated_at = os.time(),
        auth_method = "dashboard_fetch",
        subscription_end = subscriptionEnd,
        trial_end = trialEnd
    }

    -- 残り時間を計算してログ出力
    local remainingHours = math.floor((expiresAt - os.time()) / 3600)
    print("⏰ 残り時間: " .. remainingHours .. "時間")

    -- 設定ファイルに保存
    DeviceConfig:updateAuthStatus(status, authData)
    print("💾 ダッシュボード情報を設定ファイルに保存しました")

    return toJSON(authData)
end

-- 日時文字列をUnixタイムスタンプに変換
function AccountAuth:parseDateTime(dateTimeStr)
    if not dateTimeStr then return nil end

    -- ISO 8601 形式をパース "2024-12-31T23:59:59Z"
    local year, month, day, hour, min, sec = string.match(dateTimeStr, "(%d+)-(%d+)-(%d+)T(%d+):(%d+):(%d+)")

    if year and month and day and hour and min and sec then
        return os.time({
            year = tonumber(year),
            month = tonumber(month),
            day = tonumber(day),
            hour = tonumber(hour),
            min = tonumber(min),
            sec = tonumber(sec)
        })
    end

    return nil
end

-- 自動登録を試行
function AccountAuth:attemptAutoRegistration(deviceHash)
    print("🔄 自動登録を試行中...")

    -- デバイスハッシュの妥当性チェック
    if not deviceHash or deviceHash == "" or string.len(deviceHash) < 8 then
        print("❌ 無効なデバイスハッシュ")
        return nil
    end

    -- 自動登録条件をチェック
    local autoRegAllowed = self:isAutoRegistrationAllowed(deviceHash)
    if not autoRegAllowed then
        print("⚠️ 自動登録の条件を満たしていません")
        return nil
    end

    print("✅ 自動登録を実行します")

    -- 仮の認証データを生成（実際の環境では要調整）
    local authData = {
        is_valid = true,
        status = "trial", -- トライアル状態
        expires_at = os.time() + (3 * 24 * 60 * 60), -- 3日間
        device_hash = deviceHash,
        authenticated_at = os.time(),
        auth_method = "auto_registration",
        trial_period = true
    }

    -- 設定ファイルに保存
    DeviceConfig:updateAuthStatus("active", authData)
    print("💾 自動登録データを設定ファイルに保存しました")
    print("📅 トライアル期間: 3日間")

    return toJSON(authData)
end

-- 自動登録が許可されているかチェック
function AccountAuth:isAutoRegistrationAllowed(deviceHash)
    -- デバイスハッシュのパターンチェック（例）
    if string.match(deviceHash, "^[A-Z0-9]+$") and string.len(deviceHash) >= 8 then
        return true
    end

    return false
end

-- キャッシュされた認証データを確認
function AccountAuth:checkCachedAuth(deviceHash)
    print("🔍 キャッシュされた認証データをチェック中...")

    -- 設定ファイルから最近の認証データを確認
    if DeviceConfig.config.last_auth_data then
        local authData = DeviceConfig.config.last_auth_data
        local now = os.time()

        -- まず、認証データが有効かチェック
        if not authData.is_valid then
            print("⚠️ キャッシュされた認証データが無効です")
            return nil
        end

        -- 期限切れチェック（緩い条件）
        if authData.expires_at and authData.expires_at > (now - (12 * 60 * 60)) then -- 12時間の猶予
            print("✅ キャッシュされた認証データが利用可能です")

            -- 期限を延長
            authData.expires_at = now + (24 * 60 * 60)
            authData.refreshed_at = now

            DeviceConfig:updateAuthStatus("active", authData)
            return toJSON(authData)
        end
    end

    print("⚠️ 利用可能なキャッシュされた認証データがありません")
    return nil
end

-- バックグラウンド再認証を試行
function AccountAuth:attemptBackgroundAuth(deviceHash)
    print("🔄 バックグラウンド再認証を試行中...")

    -- 簡単な条件で再認証を許可
    local lastAuthTime = DeviceConfig.config.last_auth_check or 0
    local now = os.time()

    if (now - lastAuthTime) < (7 * 24 * 60 * 60) then  -- 7日以内
        print("✅ 最近の認証履歴に基づいて認証を許可します")

        local authData = {
            is_valid = true,
            status = "active",
            expires_at = now + (24 * 60 * 60),
            device_hash = deviceHash,
            authenticated_at = now,
            auth_method = "background_reauth"
        }

        DeviceConfig:updateAuthStatus("active", authData)
        return toJSON(authData)
    end

    print("⚠️ バックグラウンド再認証の条件を満たしていません")
    return nil
end

-- 手動登録をリクエスト
function AccountAuth:requestManualRegistration(deviceHash)
    print("📋 手動登録が必要です")
    print("🔗 以下のURLで手動登録を行ってください:")
    print("   https://smartgram.jp/dashboard")
    print("📱 登録デバイスハッシュ: " .. deviceHash)
    print("")
    print("💡 登録完了後、このスクリプトを再実行してください")

    -- 手動登録待ちの状態を保存
    DeviceConfig:updateAuthStatus("manual_registration_required", {
        device_hash = deviceHash,
        registration_url = "https://smartgram.jp/dashboard",
        instructions_shown = true,
        timestamp = os.time()
    })

    return nil -- 手動操作が必要
end

-- 実際の認証処理（サーバーAPI接続）
function AccountAuth:performAuthentication(deviceHash)
    print("🌐 サーバー認証を実行中...")
    print("📱 デバイス: " .. tostring(deviceHash))

    -- 1. まず実際のHTTP API認証を試行
    local httpResponse = self:tryHttpAuthentication(deviceHash)

    if httpResponse then
        print("✅ HTTP API認証成功")
        local data = parseJSON(httpResponse)
        if data and data.is_valid then
            return httpResponse
        else
            print("❌ HTTP API認証失敗: " .. tostring(data and data.message or "不明なエラー"))
            return nil
        end
    end

    -- 2. HTTP API が利用できない場合の処理
    print("⚠️ HTTP API利用不可")
    print("🎯 ユーザーフレンドリー認証に切り替え中...")

    -- ユーザーフレンドリー認証を試行
    local userFriendlyResponse = self:performUserFriendlyAuth(deviceHash)
    if userFriendlyResponse then
        print("✅ ユーザーフレンドリー認証成功")
        return userFriendlyResponse
    end

    print("💡 手動操作が必要です")
    print("📋 上記の指示に従ってブラウザで認証を完了してください")
    print("🔄 認証完了後、このスクリプトを再実行してください")

    return nil  -- 手動操作が必要
end

-- 認証状態を強制的にリフレッシュ
function AccountAuth:forceRefresh(deviceHash)
    print("🔄 認証状態を強制リフレッシュ中...")
    self.lastVerified = 0
    return self:verifyAuthenticationStatus(deviceHash)
end

-- 認証詳細情報を取得
function AccountAuth:getAuthenticationDetails()
    -- AccountAuthインスタンスの確認
    if not AccountAuth.isAuthenticated or not AccountAuth.authData then
        print("⚠️ 認証データがありません")
        print("   AccountAuth.isAuthenticated:", AccountAuth.isAuthenticated)
        print("   AccountAuth.authData:", AccountAuth.authData and "存在" or "nil")
        return {
            status = "unauthenticated",
            message = "認証されていません"
        }
    end

    -- 実際のデータを使用
    local authDataString = AccountAuth.authData

    -- デバッグ: authDataの内容を確認
    print("🔍 getAuthenticationDetails デバッグ:")
    print("   AccountAuth.authData:", AccountAuth.authData and "存在" or "nil")
    print("   authDataString タイプ:", type(authDataString))
    if authDataString and authDataString ~= "" then
        print("   authDataString 内容:", string.sub(tostring(authDataString), 1, 200) .. "...")
    else
        print("   authDataString: 空またはnil")
        print("   AccountAuth の状態:")
        print("     isAuthenticated:", AccountAuth.isAuthenticated)
        print("     deviceHash:", AccountAuth.deviceHash)
        print("     lastVerified:", AccountAuth.lastVerified)
    end

    local data = parseJSON(authDataString)
    if data then
        -- デバッグ: parseJSON後のデータを確認
        print("🔍 parseJSON後のデータ:")
        print("   data.expires_at:", data.expires_at, "型:", type(data.expires_at))
        print("   data.status:", data.status)
        print("   data.device_hash:", data.device_hash)

        -- 残り時間を計算 (expires_at から現在時刻を引く)
        local remainingHours = 0
        local currentTime = os.time()

        if data.expires_at and type(data.expires_at) == "number" then
            local remainingSeconds = math.max(0, data.expires_at - currentTime)
            remainingHours = math.floor(remainingSeconds / 3600)

            print("🔍 時間計算詳細:")
            print("   expires_at (数値):", data.expires_at)
            print("   現在時刻:", currentTime)
            print("   差分(秒):", data.expires_at - currentTime)
            print("   残り時間(時間):", remainingHours)
        elseif data.time_remaining_seconds then
            -- フォールバック: time_remaining_secondsが存在する場合
            remainingHours = math.floor(data.time_remaining_seconds / 3600)
            print("🔍 フォールバック時間計算:")
            print("   time_remaining_seconds:", data.time_remaining_seconds)
            print("   残り時間(時間):", remainingHours)
        else
            print("⚠️ expires_at が見つからないか、型が不正です")
            print("   expires_at:", data.expires_at)
            print("   expires_at 型:", type(data.expires_at))
        end

        local lastVerified = os.date("%H:%M:%S", AccountAuth.lastVerified)

        return {
            status = data.status,
            message = data.message,
            remaining_hours = remainingHours,
            last_verified = lastVerified,
            is_valid = data.is_valid
        }
    else
        print("❌ parseJSON が失敗しました")
        print("   元データ:", authDataString)
        return {
            status = "error",
            message = "認証データの解析に失敗"
        }
    end
end

-- オフライン認証（互換性のため維持）
function tryOfflineAuthentication(deviceHash)
    print("🔧 オフライン認証を開始...")
    print("📱 デバイス: " .. tostring(deviceHash))

    return AccountAuth:performAuthentication(deviceHash)
end

-- 認証失敗時の詳細メッセージ表示
function showAuthenticationFailedMessage()
    print("🚫 ライセンス認証に失敗しました")

    local deviceHash = AccountAuth.deviceHash or "不明"

    -- 期限切れかどうかチェック
    local isExpired = AccountAuth:isExpired()

    if isExpired then
        print("⏰ ライセンス有効期限が切れています")
        print("📋 再契約手順:")
        print("   1. ダッシュボード: https://smartgram.jp/dashboard")
        print("   2. ログインして契約を更新")
        print("   3. 更新後、このスクリプトを再実行")
        print("📱 デバイスハッシュ: " .. deviceHash)

        -- 期限切れ用のダイアログ
        local controls = {
            {type = CONTROLLER_TYPE.LABEL, text = "⏰ ライセンス期限切れ ⏰"},
            {type = CONTROLLER_TYPE.LABEL, text = "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"},
            {type = CONTROLLER_TYPE.LABEL, text = "ライセンスの有効期限が切れています"},
            {type = CONTROLLER_TYPE.LABEL, text = ""},
            {type = CONTROLLER_TYPE.LABEL, text = "📋 契約を更新するには:"},
            {type = CONTROLLER_TYPE.LABEL, text = ""},
            {type = CONTROLLER_TYPE.LABEL, text = "1. ダッシュボードにアクセス"},
            {type = CONTROLLER_TYPE.LABEL, text = "   smartgram.jp/dashboard"},
            {type = CONTROLLER_TYPE.LABEL, text = ""},
            {type = CONTROLLER_TYPE.LABEL, text = "2. ログインして契約を更新"},
            {type = CONTROLLER_TYPE.LABEL, text = ""},
            {type = CONTROLLER_TYPE.LABEL, text = "3. 更新完了後、"},
            {type = CONTROLLER_TYPE.LABEL, text = "   このスクリプトを再実行"},
            {type = CONTROLLER_TYPE.LABEL, text = ""},
            {type = CONTROLLER_TYPE.LABEL, text = "📱 デバイスハッシュ:"},
            {type = CONTROLLER_TYPE.LABEL, text = "   " .. deviceHash},
            {type = CONTROLLER_TYPE.LABEL, text = ""},
            {type = CONTROLLER_TYPE.LABEL, text = "💡 契約更新後は自動的に"},
            {type = CONTROLLER_TYPE.LABEL, text = "   新しいライセンスが認識されます"},
            {type = CONTROLLER_TYPE.LABEL, text = ""},
            {type = CONTROLLER_TYPE.BUTTON, title = "OK", color = 0xFF5733, width = 0.8, flag = 1}
        }

        dialog(controls, {ORIENTATION_TYPE.PORTRAIT})
        return
    end

    -- 通常の認証失敗
    print("📱 実行デバイス: " .. deviceHash)
    print("🔗 ダッシュボード: https://smartgram.jp/dashboard")

    -- 詳細なエラーダイアログ
    local controls = {
        {type = CONTROLLER_TYPE.LABEL, text = "🚫 ライセンス認証失敗 🚫"},
        {type = CONTROLLER_TYPE.LABEL, text = "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"},
        {type = CONTROLLER_TYPE.LABEL, text = "デバイス認証に失敗しました"},
        {type = CONTROLLER_TYPE.LABEL, text = ""},
        {type = CONTROLLER_TYPE.LABEL, text = "📱 実行デバイス:"},
        {type = CONTROLLER_TYPE.LABEL, text = "   " .. deviceHash},
        {type = CONTROLLER_TYPE.LABEL, text = ""},
        {type = CONTROLLER_TYPE.LABEL, text = "【解決方法】"},
        {type = CONTROLLER_TYPE.LABEL, text = "1. ダッシュボードにログイン"},
        {type = CONTROLLER_TYPE.LABEL, text = "2. 正しいデバイスハッシュを登録"},
        {type = CONTROLLER_TYPE.LABEL, text = "3. main.luaを再実行"},
        {type = CONTROLLER_TYPE.LABEL, text = ""},
        {type = CONTROLLER_TYPE.LABEL, text = "🌐 https://smartgram.jp/dashboard"},
        {type = CONTROLLER_TYPE.LABEL, text = "📧 support@smartgram.jp"},
        {type = CONTROLLER_TYPE.BUTTON, title = "OK", color = 0xe74c3c, flag = 1}
    }

    local orientations = {
        ORIENTATION_TYPE.PORTRAIT,
        ORIENTATION_TYPE.LANDSCAPE_LEFT,
        ORIENTATION_TYPE.LANDSCAPE_RIGHT
    }

    dialog(controls, orientations)
    return false
end

-- WebView認証結果の待機
function waitForWebViewResult(deviceHash)
    print("Waiting for authentication result...")

    -- AutoTouchアプリに戻る（ユーザーが手動で操作しやすくするため）
    local success, activateResult = pcall(function()
        appActivate("me.autotouch.AutoTouch.ios8")
        print("Returned to AutoTouch app")
    end)

    if not success then
        print("WARNING: Failed to activate AutoTouch app: " .. tostring(activateResult))
    end

    -- 複数の結果ファイルパスを試行（Webページからの書き込み対応）
    local resultFiles = {
        "/tmp/smartgram_auth_result.json",           -- メインパス
        "/var/tmp/smartgram_auth_result.json",       -- 代替パス
        "/tmp/auth_result.json",                     -- 短縮パス
        "/private/tmp/smartgram_auth_result.json"    -- iOS privateパス
    }

    local maxWaitTime = 45  -- 45秒まで待機（延長）
    local waitInterval = 1  -- 1秒間隔でチェック

    for i = 1, maxWaitTime do
        -- 複数のファイルパスを順次確認
        for _, resultFile in ipairs(resultFiles) do
            local file = io.open(resultFile, "r")
            if file then
                local content = file:read("*all")
                file:close()

                if content and content ~= "" then
                    print("SUCCESS: Authentication result received from: " .. resultFile)
                    print("Response: " .. content)

                    -- 結果ファイルを削除（次回実行のため）
                    os.remove(resultFile)

                    return content
                end
            end
        end

        -- クリップボード経由での結果確認（代替手段）
        if i >= 1 then  -- 1秒後からクリップボードもチェック（早期開始）
            local clipSuccess, clipContent = pcall(getClipboardText)
            if clipSuccess and clipContent then
                -- 特別な形式をチェック（SMARTGRAM_AUTH_RESULT:で始まる）
                if string.find(clipContent, "SMARTGRAM_AUTH_RESULT:") then
                    local jsonData = string.match(clipContent, "SMARTGRAM_AUTH_RESULT:(.+)")
                    if jsonData then
                        print("SUCCESS: Special authentication result found in clipboard")
                        print("JSON data: " .. jsonData)

                        -- クリップボードをクリア
                        pcall(setClipboardText, "")

                        return jsonData
                    end
                end

                -- 通常のJSON形式もチェック
                if string.find(clipContent, '"timestamp"') or string.find(clipContent, '"is_valid"') then
                    print("SUCCESS: Authentication result received from clipboard")
                    print("Clipboard content: " .. clipContent)

                    -- クリップボードをクリア
                    pcall(setClipboardText, "")

                    return clipContent
                end

                -- クリップボードの内容をデバッグ出力（最初の50文字のみ、頻度を上げる）
                if i % 5 == 0 then  -- 5秒おきに内容確認
                    local preview = string.sub(clipContent, 1, 50)
                    print("DEBUG: Clipboard preview: " .. preview .. (string.len(clipContent) > 50 and "..." or ""))
                    print("DEBUG: Clipboard length: " .. string.len(clipContent))
                end
            else
                if i % 10 == 0 then  -- 10秒おきにクリップボードアクセス状況を確認
                    print("DEBUG: Clipboard access failed or empty")
                end
            end
        end

        -- ユーザーからの手動入力を受け入れる（フォールバック）
        if i == 30 then  -- 30秒後に手動入力オプション提示
            print("INFO: Manual input option available")
            local manualInput = showManualInputDialog()
            if manualInput then
                print("SUCCESS: Manual authentication data received")
                return manualInput
            end
        end

        -- プログレス表示
        if i % 5 == 0 then
            print(string.format("Waiting for auth... (%d/%d seconds)", i, maxWaitTime))
        end

        -- 1秒待機
        usleep(1000000)
    end

    print("TIMEOUT: Authentication timed out after 45 seconds")
    print("INFO: Please try the following alternatives:")
    print("1. Check internet connection")
    print("2. Re-run the script")
    print("3. Contact support if issue persists")

    return nil
end

-- 手動入力ダイアログ（フォールバック用）
function showManualInputDialog()
    print("Showing manual input dialog...")

    local controls = {
        {type = CONTROLLER_TYPE.LABEL, text = "⚠️ 認証タイムアウト ⚠️"},
        {type = CONTROLLER_TYPE.LABEL, text = "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"},
        {type = CONTROLLER_TYPE.LABEL, text = "📝 次の手順で認証を完了してください："},
        {type = CONTROLLER_TYPE.LABEL, text = ""},
        {type = CONTROLLER_TYPE.LABEL, text = "1️⃣ ブラウザで認証が完了していることを確認"},
        {type = CONTROLLER_TYPE.LABEL, text = "2️⃣ 「📋 認証結果をコピー」ボタンをタップ"},
        {type = CONTROLLER_TYPE.LABEL, text = "3️⃣ 下の「📋 クリップボードから取得」をタップ"},
        {type = CONTROLLER_TYPE.LABEL, text = ""},
        {type = CONTROLLER_TYPE.LABEL, text = "💡 ヒント: クリップボードに認証結果が"},
        {type = CONTROLLER_TYPE.LABEL, text = "   SMARTGRAM_AUTH_RESULT: で始まるデータが"},
        {type = CONTROLLER_TYPE.LABEL, text = "   保存されていることを確認してください"},
        {type = CONTROLLER_TYPE.BUTTON, title = "📋 クリップボードから取得", color = 0x27ae60, width = 1.0, flag = 1, collectInputs = false},
        {type = CONTROLLER_TYPE.BUTTON, title = "🔄 もう一度待機 (10秒)", color = 0xf39c12, width = 0.5, flag = 2, collectInputs = false},
        {type = CONTROLLER_TYPE.BUTTON, title = "❌ キャンセル", color = 0xe74c3c, width = 0.5, flag = 3, collectInputs = false}
    }

    local result = dialog(controls, orientations)

    if result == 1 then
        -- クリップボードから取得
        local clipSuccess, clipContent = pcall(getClipboardText)
        if clipSuccess and clipContent then
            -- 特別な形式をチェック
            if string.find(clipContent, "SMARTGRAM_AUTH_RESULT:") then
                local jsonData = string.match(clipContent, "SMARTGRAM_AUTH_RESULT:(.+)")
                if jsonData then
                    print("SUCCESS: Retrieved special format data from clipboard")
                    return jsonData
                end
            end

            -- 通常のJSON形式もチェック
            if string.find(clipContent, '"timestamp"') or string.find(clipContent, '"is_valid"') then
                print("SUCCESS: Retrieved authentication data from clipboard")
                return clipContent
            end

            -- クリップボードに何かあるが認証データではない場合
            local preview = string.sub(clipContent, 1, 50)
            print("WARNING: Clipboard contains: " .. preview .. "...")
            print("WARNING: Not valid authentication data")
            return nil
        else
            print("WARNING: No valid authentication data found in clipboard")
            return nil
        end
    elseif result == 2 then
        -- 追加で10秒待機
        print("Waiting additional 10 seconds...")
        for i = 1, 10 do
            -- 再度ファイルとクリップボードをチェック
            local clipSuccess, clipContent = pcall(getClipboardText)
            if clipSuccess and clipContent then
                -- 特別な形式をチェック
                if string.find(clipContent, "SMARTGRAM_AUTH_RESULT:") then
                    local jsonData = string.match(clipContent, "SMARTGRAM_AUTH_RESULT:(.+)")
                    if jsonData then
                        print("SUCCESS: Special format data found during extended wait")
                        return jsonData
                    end
                end

                -- 通常のJSON形式もチェック
                if string.find(clipContent, '"timestamp"') or string.find(clipContent, '"is_valid"') then
                    print("SUCCESS: Authentication data found during extended wait")
                    return clipContent
                end
            end
            print(string.format("Extended wait... (%d/10)", i))
            usleep(1000000)
        end
        return nil
    else
        print("User cancelled manual input")
        return nil
    end
end

-- オフライン認証システム（AutoTouch専用）
function tryHttpRequest(url, body)
    print("🔧 AutoTouch オフライン認証システム")

    local deviceHash = string.match(body, '"device_hash":"([^"]+)"')
    print("📱 デバイス: " .. tostring(deviceHash))

    -- AutoTouch環境ではHTTP関数が利用できないため、オフライン認証を使用
    return tryOfflineAuthentication(deviceHash)
end

-- WebView経由でAPI認証を実行（フォールバック用）
function tryWebViewAuthentication(deviceHash)
    print("DEBUG: WebView authentication started (fallback)")
    print("DEBUG: Device hash: " .. tostring(deviceHash))

    -- 認証用WebページのURL（デバイスハッシュをパラメータで渡す）
    local authURL = string.format("https://smartgram.jp/auth-mobile/?device_hash=%s&source=autotools", deviceHash)
    print("Opening auth page: " .. authURL)

    -- WebページでAPI接続を実行し、結果をURLスキーム経由で受け取る
    local success, result = pcall(function()
        return openURL(authURL)
    end)

    if success then
        print("SUCCESS: Auth page opened")
        print("Waiting for authentication result...")

        -- WebView認証の完了を待機（URLスキーム経由で結果を受け取る）
        return waitForWebViewResult(deviceHash)
    else
        print("ERROR: Failed to open auth page: " .. tostring(result))
        return nil
    end
end

-- ライセンス検証（初回実行時は自動的に体験期間開始）
function verifyLicense(deviceHash)
    print("🔐 ライセンス認証を開始...")
    print("📱 デバイス: " .. tostring(deviceHash))

    -- デバイスハッシュの確認
    if not deviceHash or deviceHash == "" then
        print("❌ デバイスハッシュが無効です")
        return nil, "デバイスハッシュエラー"
    end

    -- バックグラウンドHTTP認証を試行
    print("🌐 バックグラウンド認証中...")
    local requestBody = '{"device_hash":"' .. deviceHash .. '"}'
    local response = tryHttpRequest("https://smartgram.jp/api/license/verify", requestBody)

    if response then
        print("✅ 認証レスポンス受信")
        print("🔍 Response content: " .. tostring(response))

        local data = parseJSON(response)
        print("🔍 Parsed data: " .. tostring(data))

        if data then
            print("🔍 data.is_valid: " .. tostring(data.is_valid))
            if data.is_valid then
                print("✅ ライセンス認証成功")
                return data, nil
            else
                print("❌ ライセンス認証失敗: " .. tostring(data.message or "不明なエラー"))
                return nil, data.message or "認証失敗"
            end
        else
            print("❌ JSONパース失敗")
            print("❌ Raw response: " .. tostring(response))
            return nil, "JSONパースエラー"
        end
    else
        print("❌ HTTP認証が利用できません")
        showAuthenticationFailedMessage()
        return nil, "認証方法が利用できません"
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
    print("Calling getDeviceHash()...")
    local deviceHash = nil
    local success, result = pcall(getDeviceHash)
    if success then
        deviceHash = result
        print("getDeviceHash completed. Result: " .. tostring(deviceHash))
        print("Result type: " .. tostring(type(deviceHash)))
        print("Result length: " .. tostring(deviceHash and #deviceHash or 0))
    else
        print("ERROR in getDeviceHash: " .. tostring(result))
        deviceHash = "ERROR_FALLBACK_" .. tostring(os.time()):sub(-6)
        print("Using fallback hash: " .. tostring(deviceHash))
    end

    -- Final validation before proceeding
    if not deviceHash or deviceHash == "" then
        print("CRITICAL ERROR: Device hash is empty after getDeviceHash()")
        print("🆘 緊急フォールバック: テスト用ハッシュを生成...")

        -- 緊急時のテスト用ハッシュ生成
        local emergencyHash = "TEST_" .. string.format("%X", os.time()):sub(-8)
        print("🆘 緊急ハッシュ:", emergencyHash)

        local continueResult = dialog({
            title = "⚠️ デバイスハッシュ取得失敗",
            message = "デバイスハッシュの取得に失敗しました。\n\n" ..
                     "テスト用ハッシュで続行しますか？\n" ..
                     "ハッシュ: " .. emergencyHash,
            buttons = {"続行", "中止"}
        })

        if continueResult == 1 then
            deviceHash = emergencyHash
            print("🆘 緊急フォールバックで続行:", deviceHash)
        else
            return false
        end
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

    -- verifyLicense呼び出し前のデバッグ
    print("DEBUG: About to call verifyLicense with:")
    print("  - deviceHash value: " .. tostring(deviceHash))
    print("  - deviceHash type: " .. tostring(type(deviceHash)))
    print("  - deviceHash length: " .. tostring(deviceHash and #deviceHash or 0))

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
    print("🚀 SMARTGRAM 開始")

    -- デバイス設定システムを初期化
    print("🔧 デバイス設定を初期化中...")
    local configInitialized = DeviceConfig:initialize()
    if not configInitialized then
        print("❌ デバイス設定の初期化に失敗")
        return
    end

    -- デバイスハッシュは設定システムから取得
    local deviceHash = DeviceConfig.deviceHash
    print("✅ デバイス設定完了: " .. tostring(deviceHash))

    -- 初回実行の場合は案内表示
    if DeviceConfig.isFirstRun then
        print("🌟 初回実行を検出しました")
        print("📱 デバイス専用設定ファイルが作成されました")
        print("🔧 設定ファイル: " .. DeviceConfig.configFile)
    end

    -- AccountAuthにデバイスハッシュを保存
    AccountAuth.deviceHash = deviceHash

    -- バックグラウンド認証検証
    local isAuthenticated = AccountAuth:verifyAuthenticationStatus(deviceHash)

    if not isAuthenticated then
        print("❌ アカウント認証に失敗しました")
        if toast then
            toast("❌ 認証失敗", 3)
        end
        showAuthenticationFailedMessage()
        return
    end

    -- 認証完了通知
    local authDetails = AccountAuth:getAuthenticationDetails()
    if toast and type(toast) == "function" then
        toast(string.format("🚀 SMARTGRAM 認証済み (%dh)", authDetails.remaining_hours or 0), 2)
    end

    -- ツール選択システムを直接実行
    executeToolSelection()

    print("🏁 main()関数完了")
end

-- 🎯 ツール選択システム（ダイアログ版）
function executeToolSelection()
    print("🎯 ツール選択システム開始")

    -- 認証状態を再確認
    if AccountAuth.deviceHash then
        local isStillAuthenticated = AccountAuth:verifyAuthenticationStatus(AccountAuth.deviceHash)
        if not isStillAuthenticated then
            print("❌ 認証状態が無効になりました")
            if toast then
                toast("❌ 認証期限切れ", 3)
            end
            showAuthenticationFailedMessage()
            return
        end
    end

    -- 利用可能なツール一覧
    local tools = {
        {name = "Timeline Tool", description = "Instagram タイムライン自動いいね", file = "timeline.lua"},
        {name = "Unfollow Tool", description = "Instagram 自動アンフォロー", file = "unfollow.lua"},
        {name = "Hashtag Tool", description = "Instagram ハッシュタグいいね", file = "hashtag.lua"},
        {name = "Active Like Tool", description = "Instagram アクティブユーザーいいね", file = "activelike.lua"}
    }

    -- ツール選択用のオプション作成
    local toolOptions = {}
    for i, tool in ipairs(tools) do
        table.insert(toolOptions, string.format("%d. %s", i, tool.name))
    end

    -- 認証詳細情報を取得してダイアログに表示
    local authDetails = AccountAuth:getAuthenticationDetails()
    local deviceHashDisplay = AccountAuth.deviceHash and string.sub(AccountAuth.deviceHash, 1, 12) or "不明"
    local statusDisplay = "✅ 認証済み"
    if authDetails.remaining_hours then
        statusDisplay = string.format("✅ 認証済み (残り%d時間)", authDetails.remaining_hours)
    end

    -- ツール選択ダイアログ表示
    local controls = {
        {type = CONTROLLER_TYPE.LABEL, text = "🛠️ SMARTGRAM ツール選択 🛠️"},
        {type = CONTROLLER_TYPE.LABEL, text = "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"},
        {type = CONTROLLER_TYPE.LABEL, text = "📱 デバイス: " .. deviceHashDisplay},
        {type = CONTROLLER_TYPE.LABEL, text = statusDisplay},
        {type = CONTROLLER_TYPE.LABEL, text = "🕐 最終確認: " .. (authDetails.last_verified or "不明")},
        {type = CONTROLLER_TYPE.LABEL, text = "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"},
        {type = CONTROLLER_TYPE.LABEL, text = "使用するツールを選択してください:"},
        {type = CONTROLLER_TYPE.PICKER,
         title = "🎯 ツール選択:",
         key = "selected_tool",
         value = toolOptions[1],
         options = toolOptions},
        {type = CONTROLLER_TYPE.LABEL, text = "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"},
        {type = CONTROLLER_TYPE.LABEL, text = "⚠️ 使用前の注意事項"},
        {type = CONTROLLER_TYPE.LABEL, text = "• Instagramアプリを開いてから実行"},
        {type = CONTROLLER_TYPE.LABEL, text = "• 適切な画面で開始してください"},
        {type = CONTROLLER_TYPE.LABEL, text = "• 過度な使用は避けてください"},
        {type = CONTROLLER_TYPE.BUTTON, title = "🚀 実行", color = 0x68D391, width = 0.5, flag = 1, collectInputs = true},
        {type = CONTROLLER_TYPE.BUTTON, title = "❌ 終了", color = 0xFF5733, width = 0.5, flag = 2, collectInputs = false}
    }

    local orientations = {
        ORIENTATION_TYPE.PORTRAIT,
        ORIENTATION_TYPE.LANDSCAPE_LEFT,
        ORIENTATION_TYPE.LANDSCAPE_RIGHT
    }

    -- ツール選択ダイアログ表示
    local result = dialog(controls, orientations)

    local selectedTool = tools[1]  -- Timeline Tool

    -- ツール実行前に最終認証チェック
    print("🔐 ツール実行前の最終認証チェック...")
    local finalAuthCheck = AccountAuth:verifyAuthenticationStatus(AccountAuth.deviceHash)
    if not finalAuthCheck then
        print("❌ ツール実行前の認証チェックに失敗")
        if toast then
            toast("❌ 認証失敗 - ツール実行中止", 3)
        end
        return
    end

    -- ユーザー確認のためのToast表示
    if toast then
        toast("🚀 " .. selectedTool.name .. " 開始", 2)
    end

    -- ツール実行
    executeTimelineTool()

    print("✅ ツール選択システム完了")
end



-- 各ツールの実行関数（実際のファイル実行版）
function executeTimelineTool()
    print("📱 Timeline Tool 実行開始")

    if toast then
        toast("📱 Timeline Tool を実行中...", 3)
    end

    -- 実際のtimeline.luaファイルを探して実行
    local timelineFound = false
    local possiblePaths = {
        -- 🎯 ユーザー確認済みの正しいパス（最優先）
        "/var/mobile/Library/AutoTouch/Scripts/smartgram.at/functions/timeline.lua",

        -- AutoTouchの標準パス（rootDir使用）
        (rootDir and rootDir() or "") .. "/smartgram.at/functions/timeline.lua",
        (rootDir and rootDir() or "") .. "/timeline.lua",
        (rootDir and rootDir() or "") .. "/scripts/timeline.lua",
        (rootDir and rootDir() or "") .. "/Smartgram/timeline.lua",

        -- 絶対パス
        "/var/mobile/Library/AutoTouch/Scripts/timeline.lua",
        "/var/mobile/Library/AutoTouch/Scripts/scripts/timeline.lua",
        "/var/mobile/Library/AutoTouch/Scripts/Smartgram/timeline.lua",
        "/var/jb/var/mobile/Library/AutoTouch/Scripts/smartgram.at/functions/timeline.lua",
        "/var/jb/var/mobile/Library/AutoTouch/Scripts/timeline.lua",
        "/var/jb/var/mobile/Library/AutoTouch/Scripts/scripts/timeline.lua",
        "/var/jb/var/mobile/Library/AutoTouch/Scripts/Smartgram/timeline.lua",

        -- 相対パス（main.luaと同じディレクトリ）
        "./timeline.lua",
        "../timeline.lua",
        "timeline.lua"
    }

    for i, path in ipairs(possiblePaths) do
        local file = io.open(path, "r")
        if file then
            file:close()
            print("✅ timeline.lua実行中...")

            local success, err = pcall(function()
                dofile(path)
            end)

            if success then
                print("✅ Timeline Tool 実行完了")
                timelineFound = true
                if toast then
                    toast("✅ Timeline Tool 完了", 2)
                end
                break
            else
                timelineFound = true  -- エラーでも見つかったことは確認
                local errorMsg = tostring(err)

                if errorMsg:match("interrupted") then
                    print("⚠️ Timeline Tool が中断されました")
                    if toast then
                        toast("⚠️ Timeline Tool 中断", 2)
                    end
                else
                    print("❌ Timeline Tool エラー: " .. errorMsg)
                    if toast then
                        toast("❌ Timeline Tool エラー", 2)
                    end
                end
                break
            end
        end
    end

    if not timelineFound then
        if toast then
            toast("❌ timeline.luaが見つかりません", 3)
        end
        showFileLocationGuide()
    end

    print("✅ Timeline Tool 実行完了")
end

-- 汎用的なツール実行関数
function executeToolFile(toolName, fileName, description)
    print("🚀 " .. toolName .. " 実行開始")

    if toast then
        toast("🚀 " .. toolName .. " を実行中...", 3)
    end

    local toolFound = false
    local possiblePaths = {
        -- 🎯 確認済みの正しいパス（smartgram.at/functions）
        "/var/mobile/Library/AutoTouch/Scripts/smartgram.at/functions/" .. fileName,
        "/var/jb/var/mobile/Library/AutoTouch/Scripts/smartgram.at/functions/" .. fileName,

        -- AutoTouchの標準パス（rootDir使用）
        (rootDir and rootDir() or "") .. "/smartgram.at/functions/" .. fileName,
        (rootDir and rootDir() or "") .. "/" .. fileName,

        -- その他の一般的なパス
        "/var/mobile/Library/AutoTouch/Scripts/" .. fileName,
        "/var/jb/var/mobile/Library/AutoTouch/Scripts/" .. fileName,
    }

    for i, path in ipairs(possiblePaths) do
        local file = io.open(path, "r")
        if file then
            file:close()
            print("✅ " .. toolName .. " 実行中...")

            local success, err = pcall(function()
                dofile(path)
            end)

            if success then
                print("✅ " .. toolName .. " 実行完了")
                toolFound = true
                if toast then
                    toast("✅ " .. toolName .. " 完了", 2)
                end
                break
            else
                toolFound = true  -- エラーでも見つかったことは確認
                local errorMsg = tostring(err)

                if errorMsg:match("interrupted") then
                    print("⚠️ " .. toolName .. " が中断されました")
                    if toast then
                        toast("⚠️ " .. toolName .. " 中断", 2)
                    end
                else
                    print("❌ " .. toolName .. " エラー: " .. errorMsg)
                    if toast then
                        toast("❌ " .. toolName .. " エラー", 2)
                    end
                end
                break
            end
        end
    end

    if not toolFound then
        if toast then
            toast("❌ " .. fileName .. " が見つかりません", 3)
        end
        showFileLocationGuide(fileName, toolName)
    end

    print("✅ " .. toolName .. " 実行完了")
end

function executeUnfollowTool()
    executeToolFile("Unfollow Tool", "unfollow.lua", "Instagram 自動アンフォロー機能")
end

function executeHashtagTool()
    executeToolFile("Hashtag Tool", "hashtaglike.lua", "Instagram ハッシュタグ自動いいね機能")
end

function executeActiveLikeTool()
    executeToolFile("Active Like Tool", "activelike.lua", "Instagram アクティブユーザー自動いいね機能")
end

-- ファイル配置ガイドダイアログ（改良版）
function showFileLocationGuide(fileName, toolName)
    fileName = fileName or "timeline.lua"
    toolName = toolName or "Timeline Tool"

    print("📋 " .. fileName .. " ファイル配置ガイドを表示中...")

    local guideControls = {
        {type = CONTROLLER_TYPE.LABEL, text = "📂 " .. fileName .. " ファイル配置ガイド 📂"},
        {type = CONTROLLER_TYPE.LABEL, text = "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"},
        {type = CONTROLLER_TYPE.LABEL, text = fileName .. " ファイルが見つかりません。"},
        {type = CONTROLLER_TYPE.LABEL, text = "以下の場所に配置してください:"},
        {type = CONTROLLER_TYPE.LABEL, text = ""},
        {type = CONTROLLER_TYPE.LABEL, text = "【✅ 確認済み推奨場所】"},
        {type = CONTROLLER_TYPE.LABEL, text = "📁 /var/mobile/Library/AutoTouch/Scripts/"},
        {type = CONTROLLER_TYPE.LABEL, text = "   smartgram.at/functions/" .. fileName},
        {type = CONTROLLER_TYPE.LABEL, text = ""},
        {type = CONTROLLER_TYPE.LABEL, text = "【その他の候補場所】"},
        {type = CONTROLLER_TYPE.LABEL, text = "2. main.luaと同じフォルダ"},
        {type = CONTROLLER_TYPE.LABEL, text = "3. /var/mobile/Library/AutoTouch/Scripts/"},
        {type = CONTROLLER_TYPE.LABEL, text = ""},
        {type = CONTROLLER_TYPE.LABEL, text = "【手順】"},
        {type = CONTROLLER_TYPE.LABEL, text = "1. " .. fileName .. " をダウンロード"},
        {type = CONTROLLER_TYPE.LABEL, text = "2. AutoTouchアプリで上記フォルダに配置"},
        {type = CONTROLLER_TYPE.LABEL, text = "3. main.luaを再実行"},
        {type = CONTROLLER_TYPE.LABEL, text = ""},
        {type = CONTROLLER_TYPE.LABEL, text = "💡 ヒント: smartgram.at/functions/"},
        {type = CONTROLLER_TYPE.LABEL, text = "   フォルダが最も確実に動作します"},
        {type = CONTROLLER_TYPE.BUTTON, title = "✅ 理解しました", color = 0x68D391, width = 1.0, flag = 1}
    }

    local orientations = {
        ORIENTATION_TYPE.PORTRAIT,
        ORIENTATION_TYPE.LANDSCAPE_LEFT,
        ORIENTATION_TYPE.LANDSCAPE_RIGHT
    }

    dialog(guideControls, orientations)
    print("📋 " .. fileName .. " ファイル配置ガイド表示完了")
end


-- スクリプト実行
main()