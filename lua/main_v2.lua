-- ==========================================
-- SocialTouch ライセンス認証システム
-- Instagram自動化ツール メインランチャー
-- Version 2.0.0 - ライセンス管理対応版
-- ==========================================

-- Enable logging
print = log

-- ==========================================
-- 設定
-- ==========================================
local Config = {
    -- バージョン情報
    VERSION = "2.0.0",

    -- API設定
    API_BASE_URL = "https://your-domain.com/api", -- 本番環境URL
    -- API_BASE_URL = "http://localhost:3000/api", -- 開発環境URL

    -- キャッシュ設定
    CACHE_FILE = "/var/mobile/Documents/socialtouch_license.cache",
    CACHE_DURATION = 24 * 60 * 60, -- 24時間（秒）

    -- デバッグモード
    DEBUG = true,

    -- 除外するファイル
    EXCLUDE_FILES = {
        "main.lua"
    }
}

-- ==========================================
-- デバイスハッシュ生成
-- ==========================================
local function getDeviceIdentifier()
    -- AutoTouchのデバイスID取得関数
    local deviceId = getSN and getSN() or "unknown_device"

    -- iPhoneモデル取得
    local model = getDeviceModel and getDeviceModel() or "iPhone"

    return deviceId, model
end

local function generateDeviceHash()
    local deviceId, model = getDeviceIdentifier()

    -- シンプルなハッシュ生成（16文字の16進数）
    local data = deviceId .. ":" .. model .. ":socialtouch"

    -- 簡易ハッシュ関数（実際のSHA256の代替）
    local hash = ""
    local sum = 0

    for i = 1, string.len(data) do
        sum = sum + string.byte(data, i)
    end

    -- 16文字の16進数文字列を生成
    math.randomseed(sum)
    for i = 1, 16 do
        local n = math.random(0, 15)
        if n < 10 then
            hash = hash .. tostring(n)
        else
            hash = hash .. string.char(87 + n) -- a-f
        end
    end

    return hash
end

-- ==========================================
-- ライセンスキャッシュ管理
-- ==========================================
local function readLicenseCache()
    local file = io.open(Config.CACHE_FILE, "r")
    if not file then
        log("📂 キャッシュファイルが存在しません")
        return nil
    end

    local content = file:read("*all")
    file:close()

    if not content or content == "" then
        return nil
    end

    -- JSON解析の代替（簡易パース）
    local cache = {}
    for key, value in string.gmatch(content, "([%w_]+)=([^\n]+)") do
        cache[key] = value
    end

    -- タイムスタンプチェック
    local timestamp = tonumber(cache.timestamp)
    if not timestamp then
        return nil
    end

    local currentTime = os.time()
    if currentTime - timestamp > Config.CACHE_DURATION then
        log("⏰ キャッシュの有効期限が切れています")
        return nil
    end

    log("✅ 有効なキャッシュを発見")
    return {
        is_valid = cache.is_valid == "true",
        expires_at = cache.expires_at,
        device_hash = cache.device_hash
    }
end

local function writeLicenseCache(isValid, expiresAt, deviceHash)
    local file = io.open(Config.CACHE_FILE, "w")
    if not file then
        log("❌ キャッシュファイルの作成に失敗")
        return false
    end

    local content = string.format(
        "is_valid=%s\nexpires_at=%s\ndevice_hash=%s\ntimestamp=%d",
        tostring(isValid),
        expiresAt or "",
        deviceHash,
        os.time()
    )

    file:write(content)
    file:close()

    log("💾 ライセンスキャッシュを保存しました")
    return true
end

-- ==========================================
-- HTTP リクエスト（AutoTouch用）
-- ==========================================
local function httpRequest(url, method, data)
    log(string.format("🌐 HTTPリクエスト: %s %s", method, url))

    -- AutoTouchのHTTP関数を使用
    if not httpGet and not httpPost then
        log("❌ HTTP機能が利用できません")
        return nil, "HTTP機能が利用できません"
    end

    local response = nil
    local error = nil

    if method == "POST" and httpPost then
        -- POSTリクエスト（AutoTouch形式）
        local jsonData = ""
        if data then
            -- 簡易JSON生成
            local parts = {}
            for k, v in pairs(data) do
                table.insert(parts, string.format('"%s":"%s"', k, v))
            end
            jsonData = "{" .. table.concat(parts, ",") .. "}"
        end

        response = httpPost(url, jsonData)
    elseif method == "GET" and httpGet then
        response = httpGet(url)
    else
        return nil, "サポートされていないHTTPメソッド"
    end

    if not response then
        return nil, "HTTPリクエストに失敗しました"
    end

    -- レスポンスを解析（簡易JSON解析）
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

-- ==========================================
-- ライセンス認証
-- ==========================================
local function verifyLicense(deviceHash)
    -- まずキャッシュを確認
    local cache = readLicenseCache()
    if cache and cache.is_valid then
        log("✅ キャッシュからライセンスを確認")
        return true, cache.expires_at
    end

    -- APIにリクエスト
    local url = Config.API_BASE_URL .. "/license/verify"
    local data = { device_hash = deviceHash }

    local response, err = httpRequest(url, "POST", data)

    if err then
        log(string.format("❌ API通信エラー: %s", err))
        -- オフラインフォールバック（キャッシュがあれば使用）
        if cache then
            log("⚠️ オフラインモード: キャッシュを使用")
            return cache.is_valid, cache.expires_at
        end
        return false, nil
    end

    if not response or not response.success then
        log("❌ ライセンス認証に失敗しました")
        return false, nil
    end

    -- キャッシュに保存
    writeLicenseCache(response.is_valid, response.expires_at, deviceHash)

    return response.is_valid, response.expires_at
end

-- ==========================================
-- 登録画面表示
-- ==========================================
local function showRegistrationScreen(deviceHash)
    local message = string.format([[
🚫 ライセンス未登録

このデバイスはまだ登録されていません。
以下の手順で登録してください：

1. デバイスハッシュをコピー：
   %s

2. 登録サイトにアクセス：
   %s/register

3. デバイスハッシュを入力して登録

4. 3日間の無料体験が開始されます

5. 登録後、このスクリプトを再実行

━━━━━━━━━━━━━━━━━━━
月額プラン: 2,980円
3日間無料体験付き
━━━━━━━━━━━━━━━━━━━
]], deviceHash, Config.API_BASE_URL:gsub("/api", ""))

    alert(message)

    -- デバイスハッシュをクリップボードにコピー（可能な場合）
    if copyText then
        copyText(deviceHash)
        toast("📋 デバイスハッシュをコピーしました", 3)
    end

    return false
end

-- ==========================================
-- ライセンス有効期限表示
-- ==========================================
local function showLicenseInfo(expiresAt)
    if not expiresAt then
        return "無期限"
    end

    -- 日付文字列をパース（簡易版）
    local year, month, day = string.match(expiresAt, "(%d+)-(%d+)-(%d+)")
    if year and month and day then
        return string.format("%s年%s月%s日まで", year, month, day)
    end

    return expiresAt
end

-- ==========================================
-- ファイル検出関数（既存のコードを維持）
-- ==========================================
local function getLuaFiles()
    local files = {}
    local fileDescriptions = {
        ["test1.lua"] = "テストスクリプト1",
        ["test2.lua"] = "テストスクリプト2",
        ["timeline.lua"] = "タイムライン自動いいね（完成版）",
        ["unfollow.lua"] = "自動アンフォロー（完成版）",
        ["auto_unfollow_color.lua"] = "自動アンフォロー（旧版）"
    }

    log("📋 利用可能なスクリプトリスト")

    local defaultFiles = {"test1.lua", "test2.lua", "timeline.lua", "unfollow.lua", "auto_unfollow_color.lua"}
    for _, filename in ipairs(defaultFiles) do
        if filename ~= "main.lua" then
            local description = fileDescriptions[filename] or filename:gsub("%.lua$", "")
            table.insert(files, {
                filename = filename,
                displayName = description .. " (" .. filename .. ")"
            })
            log(string.format("✅ 利用可能: %s", filename))
        end
    end

    log(string.format("📊 合計 %d 個のスクリプトを検出", #files))
    table.sort(files, function(a, b) return a.filename < b.filename end)

    return files
end

-- ==========================================
-- スクリプト選択ダイアログ（ライセンス情報追加）
-- ==========================================
local function showScriptSelector(licenseExpiry)
    log("📱 Instagram自動化ツール ランチャー起動")

    local luaFiles = getLuaFiles()

    if #luaFiles == 0 then
        alert("⚠️ 実行可能なスクリプトが見つかりません")
        return nil
    end

    local fileOptions = {}
    for _, file in ipairs(luaFiles) do
        table.insert(fileOptions, file.displayName)
    end

    local controls = {
        -- タイトル
        {
            type = CONTROLLER_TYPE.LABEL,
            text = "🚀 SocialTouch 🚀"
        },

        -- バージョン表示
        {
            type = CONTROLLER_TYPE.LABEL,
            text = "Version " .. Config.VERSION
        },

        -- ライセンス情報
        {
            type = CONTROLLER_TYPE.LABEL,
            text = "━━━━━━━━━━━━━━━━━━━"
        },
        {
            type = CONTROLLER_TYPE.LABEL,
            text = "✅ ライセンス認証済み"
        },
        {
            type = CONTROLLER_TYPE.LABEL,
            text = "有効期限: " .. showLicenseInfo(licenseExpiry)
        },

        -- セパレーター
        {
            type = CONTROLLER_TYPE.LABEL,
            text = "━━━━━━━━━━━━━━━━━━━"
        },

        -- 説明文
        {
            type = CONTROLLER_TYPE.LABEL,
            text = "実行する機能を選択してください"
        },

        -- セパレーター
        {
            type = CONTROLLER_TYPE.LABEL,
            text = "━━━━━━━━━━━━━━━━━━━"
        },

        -- スクリプト選択ピッカー
        {
            type = CONTROLLER_TYPE.PICKER,
            title = "📋 スクリプト選択:",
            key = "script",
            value = fileOptions[1] or "",
            options = fileOptions
        },

        -- セパレーター
        {
            type = CONTROLLER_TYPE.LABEL,
            text = "━━━━━━━━━━━━━━━━━━━"
        },

        -- 注意事項
        {
            type = CONTROLLER_TYPE.LABEL,
            text = "⚠️ 注意事項"
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

        -- デバッグモードスイッチ
        {
            type = CONTROLLER_TYPE.SWITCH,
            title = "🔍 デバッグモード:",
            key = "debug",
            value = Config.DEBUG and 1 or 0
        },

        -- セパレーター
        {
            type = CONTROLLER_TYPE.LABEL,
            text = "━━━━━━━━━━━━━━━━━━━"
        },

        -- 実行ボタン
        {
            type = CONTROLLER_TYPE.BUTTON,
            title = "▶️ 実行",
            color = 0x68D391,
            width = 0.5,
            flag = 1,
            collectInputs = true
        },

        -- キャンセルボタン
        {
            type = CONTROLLER_TYPE.BUTTON,
            title = "❌ 終了",
            color = 0xFF5733,
            width = 0.5,
            flag = 2,
            collectInputs = false
        }
    }

    local orientations = {
        ORIENTATION_TYPE.PORTRAIT,
        ORIENTATION_TYPE.LANDSCAPE_LEFT,
        ORIENTATION_TYPE.LANDSCAPE_RIGHT
    }

    local result = dialog(controls, orientations)

    if result == 1 then
        local selectedDisplay = controls[9].value
        local debugMode = controls[16].value == 1

        local selectedFile = nil
        for i, file in ipairs(luaFiles) do
            if file.displayName == selectedDisplay then
                selectedFile = file.filename
                break
            end
        end

        log(string.format("選択されたスクリプト: %s", selectedFile or "不明"))
        log(string.format("デバッグモード: %s", debugMode and "ON" or "OFF"))

        return {
            script = selectedFile,
            displayName = selectedDisplay,
            debug = debugMode
        }
    else
        log("❌ キャンセルされました")
        return nil
    end
end

-- ==========================================
-- スクリプト実行関数（既存のコードを維持）
-- ==========================================
local function executeScript(scriptFileName, debugMode)
    if not scriptFileName then
        log("⚠️ スクリプトファイルが指定されていません")
        toast("⚠️ スクリプトが選択されていません", 3)
        return false
    end

    local scriptName = scriptFileName
    local rootPath = rootDir and rootDir() or "/var/jb/var/mobile/Library/AutoTouch/Scripts"
    local absolutePath = rootPath .. "/AutoTouchScripts/" .. scriptFileName

    log(string.format("📂 スクリプトを読み込み中: %s", scriptName))
    log(string.format("📍 実行パス: %s", absolutePath))
    toast(string.format("📂 %s を起動中...", scriptName), 2)

    local checkFile = io.open(absolutePath, "r")
    if not checkFile then
        log(string.format("❌ ファイルが見つかりません: %s", absolutePath))
        alert(string.format(
            "ファイルが見つかりません\n\n" ..
            "ファイル: %s\n\n" ..
            "配置場所:\n%s/AutoTouchScripts/%s",
            scriptName, rootPath, scriptName
        ))
        return false
    end

    log("✅ ファイルを発見")
    checkFile:close()

    local scriptPath = absolutePath

    local success, err = pcall(function()
        log(string.format("🎯 実行中: dofile('%s')", scriptPath))
        dofile(scriptPath)
    end)

    if success then
        log(string.format("✅ %s を正常に実行しました", scriptName))
        return true
    else
        log(string.format("❌ スクリプト実行エラー: %s", tostring(err)))
        toast(string.format("❌ エラー: %s", scriptName), 3)
        alert(string.format(
            "スクリプト実行エラー\n\n" ..
            "ファイル: %s\n" ..
            "エラー: %s",
            scriptName, tostring(err)
        ))
        return false
    end
end

-- ==========================================
-- メイン処理（ライセンス認証追加）
-- ==========================================
local function main()
    log("=== 🚀 SocialTouch ライセンス認証システム ===")
    log(string.format("バージョン: %s", Config.VERSION))
    log("==========================================")

    -- 初期トースト表示
    toast("🔐 ライセンス確認中...", 2)
    usleep(1000000)

    -- デバイスハッシュ生成
    local deviceHash = generateDeviceHash()
    log(string.format("📱 デバイスハッシュ: %s", deviceHash))

    -- ライセンス認証
    local isValid, expiresAt = verifyLicense(deviceHash)

    if not isValid then
        log("❌ ライセンスが無効です")
        -- 登録画面を表示
        showRegistrationScreen(deviceHash)
        return
    end

    log("✅ ライセンス認証成功")
    toast("✅ ライセンス認証完了", 2)
    usleep(1000000)

    -- スクリプト選択ダイアログを表示
    local selection = showScriptSelector(expiresAt)

    if not selection then
        log("😴 ランチャーを終了します")
        toast("👋 終了しました", 2)
        return
    end

    log(string.format("📌 選択されたスクリプト: %s", selection.displayName))
    toast(string.format("✅ %s を実行します", selection.displayName), 2)
    usleep(1000000)

    Config.DEBUG = selection.debug

    log(string.format("🎯 %s を実行します", selection.script))
    toast(string.format("🎯 %s を開始", selection.displayName), 2)
    usleep(1500000)

    local executeSuccess = executeScript(selection.script, selection.debug)

    if not executeSuccess then
        log("⚠️ スクリプトの実行に失敗しました")

        local retry = alert(
            "スクリプトの実行に失敗しました。\n\n" ..
            "もう一度実行しますか？",
            "再実行", "終了"
        )

        if retry == 1 then
            log("🔄 再実行を試みます")
            toast("🔄 再実行中...", 2)
            usleep(1000000)
            main()
        else
            log("😴 ランチャーを終了します")
            toast("👋 終了しました", 2)
        end
    end
end

-- ==========================================
-- エラーハンドリング付き実行
-- ==========================================
local function safeMain()
    local success, err = pcall(main)

    if not success then
        log(string.format("🚨 致命的エラー: %s", tostring(err)))

        alert(string.format(
            "🚨 致命的エラーが発生しました\n\n" ..
            "%s\n\n" ..
            "アプリを再起動してください。",
            tostring(err)
        ))

        screenshot(string.format("launcher_error_%d.png", os.time()))
    end
end

-- ==========================================
-- スタートアップメッセージ
-- ==========================================
log("==========================================")
log("    SocialTouch License System v2.0.0    ")
log("==========================================")
log("")
log("📱 起動中...")
log("")

-- メイン実行
safeMain()