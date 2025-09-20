-- ==========================================
-- SocialTouch - Instagram自動化ツール
-- ライセンス認証付きメインランチャー
-- ==========================================

-- Enable logging
print = log

-- ==========================================
-- 設定
-- ==========================================
local Config = {
    -- デバッグモード
    DEBUG = true,

    -- バージョン情報
    VERSION = "2.0.0",

    -- API設定
    API_BASE_URL = "https://metacube-el5.pages.dev/api",
    CACHE_FILE = "/var/mobile/Library/AutoTouch/Scripts/cache/license.dat",
    CACHE_DURATION = 86400, -- 24 hours

    -- 除外するファイル名
    EXCLUDE_FILES = {
        "main.lua",  -- 自分自身は除外
        "license.lua"  -- ライセンスモジュールも除外
    }
}

-- ==========================================
-- ファイル検出関数
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

    -- AutoTouchではファイル検出が難しいため、事前定義リストを直接使用
    log("📋 利用可能なスクリプトリスト")

    -- /AutoTouchScripts/test/内の全ファイル
    local defaultFiles = {"test1.lua", "test2.lua", "timeline.lua", "unfollow.lua","auto_unfollow_color.lua"}
    for _, filename in ipairs(defaultFiles) do
        -- main.luaは除外
        if filename ~= "main.lua" then
            local description = fileDescriptions[filename] or filename:gsub("%.lua$", "")
            table.insert(files, {
                filename = filename,
                displayName = description .. " (" .. filename .. ")"
            })
            log(string.format("✅ 利用可能: %s", filename))
        end
    end

    -- 検出されたファイル数をログ出力
    log(string.format("📊 合計 %d 個のスクリプトを検出", #files))

    -- ファイルリストをソート
    table.sort(files, function(a, b) return a.filename < b.filename end)

    return files
end

-- ==========================================
-- スクリプト選択ダイアログ
-- ==========================================
local function showScriptSelector()
    log("📱 Instagram自動化ツール ランチャー起動")

    -- 利用可能なLuaファイルを取得
    local luaFiles = getLuaFiles()

    if #luaFiles == 0 then
        alert("⚠️ 実行可能なスクリプトが見つかりません")
        return nil
    end

    -- ファイル名のリストを作成
    local fileOptions = {}
    for _, file in ipairs(luaFiles) do
        table.insert(fileOptions, file.displayName)
    end

    -- ダイアログコントロールの定義
    local controls = {
        -- タイトル
        {
            type = CONTROLLER_TYPE.LABEL,
            text = "🚀 Instagram 自動化ツール 🚀"
        },

        -- バージョン表示
        {
            type = CONTROLLER_TYPE.LABEL,
            text = "Version " .. Config.VERSION
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

        -- 検出されたファイル一覧
        {
            type = CONTROLLER_TYPE.LABEL,
            text = "📂 検出されたスクリプト"
        },
        {
            type = CONTROLLER_TYPE.LABEL,
            text = string.format("%d個のスクリプトが見つかりました", #luaFiles)
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

        -- 実行ボタン（緑色）
        {
            type = CONTROLLER_TYPE.BUTTON,
            title = "▶️ 実行",
            color = 0x68D391,
            width = 0.5,
            flag = 1,
            collectInputs = true
        },

        -- キャンセルボタン（赤色）
        {
            type = CONTROLLER_TYPE.BUTTON,
            title = "❌ 終了",
            color = 0xFF5733,
            width = 0.5,
            flag = 2,
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

    -- 結果処理
    if result == 1 then  -- 実行ボタン
        local selectedIndex = 1
        local selectedDisplay = controls[6].value
        local debugMode = controls[18].value == 1

        -- 選択されたファイル名を取得
        local selectedFile = nil
        for i, file in ipairs(luaFiles) do
            if file.displayName == selectedDisplay then
                selectedFile = file.filename
                selectedIndex = i
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
    else  -- キャンセルボタン
        log("❌ キャンセルされました")
        return nil
    end
end

-- ==========================================
-- スクリプト実行関数
-- ==========================================
local function executeScript(scriptFileName, debugMode)
    if not scriptFileName then
        log("⚠️ スクリプトファイルが指定されていません")
        toast("⚠️ スクリプトが選択されていません", 3)
        return false
    end

    -- AutoTouchの実際のパスを使用（rootDir()関数を利用）
    local scriptName = scriptFileName

    -- rootDir()を使用して絶対パスを構築（絶対パスのみ使用）
    local rootPath = rootDir and rootDir() or "/var/jb/var/mobile/Library/AutoTouch/Scripts"
    local absolutePath = rootPath .. "/AutoTouchScripts/" .. scriptFileName

    log(string.format("📂 スクリプトを読み込み中: %s", scriptName))
    log(string.format("📍 実行パス: %s", absolutePath))
    toast(string.format("📂 %s を起動中...", scriptName), 2)

    -- 絶対パスでファイルの存在を確認
    local checkFile = io.open(absolutePath, "r")
    if not checkFile then
        log(string.format("❌ ファイルが見つかりません: %s", absolutePath))
        log("💡 ヒント: スクリプトファイルを以下の場所に配置してください:")
        log(string.format("   %s", absolutePath))

        -- エラーメッセージを表示
        alert(string.format(
            "ファイルが見つかりません\n\n" ..
            "ファイル: %s\n\n" ..
            "配置場所:\n" ..
            "%s/\n" ..
            "AutoTouchScripts/test/%s",
            scriptName, rootPath, scriptName
        ))
        return false
    end

    log("✅ ファイルを発見")
    checkFile:close()

    -- 実行用のパスを設定
    local scriptPath = absolutePath

    -- スクリプトが存在するか確認（エラーハンドリング）
    local success, err = pcall(function()
        -- スクリプトを読み込んで実行
        log(string.format("🎯 実行中: dofile('%s')", scriptPath))
        dofile(scriptPath)
    end)

    if success then
        log(string.format("✅ %s を正常に実行しました", scriptName))
        return true
    else
        log(string.format("❌ スクリプト実行エラー: %s", tostring(err)))
        toast(string.format("❌ エラー: %s", scriptName), 3)

        -- エラーダイアログ表示
        alert(string.format(
            "スクリプト実行エラー\n\n" ..
            "ファイル: %s\n" ..
            "エラー: %s\n\n" ..
            "スクリプトファイルが存在することを確認してください。",
            scriptName, tostring(err)
        ))

        return false
    end
end

-- ==========================================
-- 起動確認ダイアログ（オプション）
-- ==========================================
-- AutoTouchのalert関数が正しく動作しない場合があるため、
-- 必要に応じてコメントアウトして使用
local function showConfirmation(scriptInfo)
    -- シンプルなトースト通知のみにする
    toast(string.format("📱 %s を実行します", scriptInfo.displayName or scriptInfo.script), 2)
    return true  -- 常に実行を許可
end

-- ==========================================
-- ライセンス認証関数
-- ==========================================


-- AutoTouch対応の時間取得関数
local function getCurrentTimestamp()
    local currentTime = 1695000000  -- デフォルト値（2023年頃）

    -- AutoTouchで利用可能な時間関数を試行
    if type(getCurrentTime) == "function" then
        currentTime = getCurrentTime()
    elseif type(getTimestamp) == "function" then
        currentTime = getTimestamp()
    elseif type(os) == "table" and type(os.time) == "function" then
        -- 標準のos.timeが利用可能な場合
        currentTime = os.time()
    end

    return currentTime
end

-- クリップボードにコピー（AutoTouch関数）
local function copyToClipboard(text)
    -- AutoTouchのクリップボード機能を使用
    -- 利用できない場合は、pasteboard APIを直接呼ぶ
    if type(copyText) == "function" then
        copyText(text)
    elseif type(pasteboard) == "table" and pasteboard.copy then
        pasteboard.copy(text)
    else
        -- フォールバック: ファイルに保存
        local file = io.open("/var/mobile/Library/AutoTouch/Scripts/clipboard.txt", "w")
        if file then
            file:write(text)
            file:close()
            log("📋 クリップボードファイルに保存: clipboard.txt")
        end
    end
end

-- デバイスID取得（シンプル版）
local function getDeviceHash()
    log("🔍 デバイスIDを取得中...")

    -- AutoTouchのgetSN()関数を使用
    if type(getSN) == "function" then
        local serial = getSN()
        if serial and serial ~= "" and serial ~= "unknown" then
            log(string.format("✅ getSN()成功: %s", serial))
            return serial
        else
            log("⚠️ getSN()は利用可能ですが、有効なシリアル番号を取得できませんでした")
        end
    else
        log("⚠️ getSN()関数が利用できません")
    end

    -- フォールバック: 簡単な固定IDを生成
    log("🔄 フォールバック: 固定IDを生成します")
    local fallbackId = "DEVICE_" .. tostring(getCurrentTimestamp() % 1000000)
    log(string.format("✅ フォールバックID: %s", fallbackId))

    return fallbackId
end

-- キャッシュ読み込み
local function loadLicenseCache()
    local file = io.open(Config.CACHE_FILE, "r")
    if not file then
        return nil
    end

    local content = file:read("*all")
    file:close()

    if not content or content == "" then
        return nil
    end

    -- キャッシュデータをパース
    local cache = {}
    for line in content:gmatch("[^\n]+") do
        local key, value = line:match("([^:]+):(.+)")
        if key and value then
            cache[key] = value
        end
    end

    -- キャッシュの有効期限チェック
    local timestamp = tonumber(cache.timestamp)
    if timestamp then
        local currentTime = getCurrentTimestamp()
        if (currentTime - timestamp) > Config.CACHE_DURATION then
            return nil
        end
    else
        return nil
    end

    return cache
end

-- キャッシュ保存
local function saveLicenseCache(data)
    -- キャッシュディレクトリ作成
    os.execute("mkdir -p /var/mobile/Library/AutoTouch/Scripts/cache/")

    local file = io.open(Config.CACHE_FILE, "w")
    if not file then
        return false
    end

    file:write(string.format("is_valid:%s\n", tostring(data.is_valid)))
    file:write(string.format("status:%s\n", data.status or "unknown"))
    file:write(string.format("expires_at:%s\n", data.expires_at or ""))
    -- タイムスタンプ取得
    local currentTime = getCurrentTimestamp()
    file:write(string.format("timestamp:%d\n", currentTime))
    file:close()

    return true
end

-- HTTP POST リクエスト（改善版）
local function httpPost(url, data)
    local jsonData = string.format('{"device_hash":"%s"}', data.device_hash)

    -- より詳細なログ
    log(string.format("📡 API Request: %s", url))
    log(string.format("📦 Payload: %s", jsonData))

    -- curlコマンドの構築（エラー出力も取得）
    local cmd = string.format(
        'curl -X POST "%s" -H "Content-Type: application/json" -d \'%s\' --connect-timeout 10 --max-time 15 -s 2>&1',
        url, jsonData
    )

    local handle = io.popen(cmd)
    if not handle then
        log("❌ Failed to execute curl command")
        return nil
    end

    local result = handle:read("*a")
    handle:close()

    log(string.format("📥 API Response: %s", result or "empty"))

    if not result or result == "" then
        log("❌ Empty response from API")
        return nil
    end

    -- curlエラーのチェック
    if result:match("^curl:") or result:match("Could not resolve") then
        log(string.format("❌ Curl error: %s", result))
        return nil
    end

    -- 簡易JSONパース
    local response = {}
    response.is_valid = result:match('"is_valid":(%w+)')
    response.status = result:match('"status":"([^"]+)"')
    response.expires_at = result:match('"expires_at":"([^"]+)"')
    response.error = result:match('"error":"([^"]+)"')
    response.registration_url = result:match('"registration_url":"([^"]+)"')
    response.message = result:match('"message":"([^"]+)"')

    if response.is_valid == "true" then
        response.is_valid = true
    elseif response.is_valid == "false" then
        response.is_valid = false
    end

    log(string.format("✅ Parsed response - Valid: %s, Status: %s",
        tostring(response.is_valid), response.status or "unknown"))

    return response
end

-- ライセンス検証
local function verifyLicense(deviceHash)
    local url = Config.API_BASE_URL .. "/license/verify"
    local data = { device_hash = deviceHash }

    local response = httpPost(url, data)

    if not response then
        return nil, "ネットワークエラー: ライセンスサーバーに接続できません"
    end

    if response.error then
        return false, response
    end

    return response.is_valid, response
end

-- ライセンス認証エラー表示（改善版）
local function showLicenseError(message, deviceHash)
    -- ダイアログの作成
    local controls = {
        {
            type = CONTROLLER_TYPE.LABEL,
            text = "❌ ライセンス認証エラー"
        },
        {
            type = CONTROLLER_TYPE.LABEL,
            text = "━━━━━━━━━━━━━━━━━━━"
        },
        {
            type = CONTROLLER_TYPE.LABEL,
            text = message or "ライセンスが無効です"
        },
        {
            type = CONTROLLER_TYPE.LABEL,
            text = "━━━━━━━━━━━━━━━━━━━"
        },
        {
            type = CONTROLLER_TYPE.LABEL,
            text = "📱 あなたのデバイスID"
        },
        {
            type = CONTROLLER_TYPE.INPUT,
            title = "",
            key = "device_id",
            value = deviceHash,
            prompt = "デバイスID（長押しでコピー可能）"
        },
        {
            type = CONTROLLER_TYPE.LABEL,
            text = "━━━━━━━━━━━━━━━━━━━"
        },
        {
            type = CONTROLLER_TYPE.LABEL,
            text = "🔗 登録方法"
        },
        {
            type = CONTROLLER_TYPE.LABEL,
            text = "1. 上記のデバイスIDをコピー"
        },
        {
            type = CONTROLLER_TYPE.LABEL,
            text = "2. Safariで以下のURLを開く："
        },
        {
            type = CONTROLLER_TYPE.INPUT,
            title = "",
            key = "url",
            value = "https://metacube-el5.pages.dev/register",
            prompt = "登録URL（長押しでコピー可能）"
        },
        {
            type = CONTROLLER_TYPE.LABEL,
            text = "3. デバイスIDを入力して登録"
        },
        {
            type = CONTROLLER_TYPE.LABEL,
            text = "━━━━━━━━━━━━━━━━━━━"
        },
        {
            type = CONTROLLER_TYPE.BUTTON,
            title = "📝 メモ帳にコピー",
            color = 0x68D391,
            width = 0.5,
            flag = 1,
            collectInputs = false
        },
        {
            type = CONTROLLER_TYPE.BUTTON,
            title = "❌ 終了",
            color = 0xFF5733,
            width = 0.5,
            flag = 2,
            collectInputs = false
        }
    }

    local orientations = {ORIENTATION_TYPE.PORTRAIT}
    local result = dialog(controls, orientations)

    if result == 1 then
        -- メモ帳にコピー（クリップボードに保存）
        local copyText = string.format(
            "SocialTouch ライセンス登録情報\n\n" ..
            "デバイスID: %s\n\n" ..
            "登録URL: https://metacube-el5.pages.dev/register\n\n" ..
            "※このデバイスIDを登録ページで入力してください",
            deviceHash
        )

        -- クリップボードにコピー（AutoTouchの機能を利用）
        copyToClipboard(copyText)
        toast("📋 情報をクリップボードにコピーしました", 3)

        -- 少し待ってからメモ帳を開く提案
        usleep(1000000)
        alert("クリップボードにコピーしました。\n\nSafariを開いて登録URLにアクセスし、\nデバイスIDを貼り付けて登録してください。")
    end

    log(string.format("❌ ライセンスエラー: %s (デバイス: %s)", message, deviceHash))
end

-- ライセンス認証メイン処理
local function checkLicense()
    log("🔐 ライセンス認証開始...")
    toast("🔐 ライセンス確認中...", 2)

    -- デバイスハッシュ取得
    local deviceHash = getDeviceHash()
    log(string.format("📱 デバイスID: %s", deviceHash))

    -- キャッシュ確認
    local cache = loadLicenseCache()
    local isValid = false
    local licenseData = nil

    if cache and cache.is_valid == "true" then
        isValid = true
        licenseData = cache
        log("✅ ライセンス確認完了（キャッシュ）")
        toast("✅ ライセンス確認完了", 2)
    else
        -- サーバーで検証
        local valid, data = verifyLicense(deviceHash)

        if valid == nil then
            -- ネットワークエラー、キャッシュがあれば使用
            if cache then
                isValid = cache.is_valid == "true"
                licenseData = cache
                log("⚠️ オフラインモード（キャッシュ使用）")
                toast("⚠️ オフラインモード", 3)
            else
                showLicenseError("ネットワークエラー: サーバーに接続できません", deviceHash)
                return false
            end
        elseif valid == false then
            -- ライセンス無効
            local message = data.error or "ライセンスが無効です"
            showLicenseError(message, deviceHash)
            return false
        else
            -- ライセンス有効
            isValid = true
            licenseData = data
            saveLicenseCache(data)
            log("✅ ライセンス認証成功")
            toast("✅ ライセンス認証成功", 2)
        end
    end

    -- ライセンス状態表示
    if licenseData and licenseData.status == "trial" then
        toast(string.format("📅 体験版 - 有効期限: %s",
            licenseData.expires_at and licenseData.expires_at:match("(%d+%-%d+%-%d+)") or "不明"), 3)
        log(string.format("📅 体験版モード - 有効期限: %s", licenseData.expires_at or "不明"))
    elseif licenseData and licenseData.status == "active" then
        toast("✨ プロ版ライセンス", 2)
        log("✨ プロ版ライセンス有効")
    end

    return isValid
end

-- ==========================================
-- メイン処理
-- ==========================================
local function main()
    log("=== 🚀 SocialTouch メインランチャー ===")
    log(string.format("バージョン: %s", Config.VERSION))
    log("==========================================")

    -- 初期トースト表示
    toast("🚀 SocialTouch", 2)
    usleep(1000000)  -- 1秒待機

    -- ライセンス認証
    if not checkLicense() then
        log("❌ ライセンス認証に失敗したため終了します")
        return
    end

    usleep(1000000)  -- 1秒待機

    -- スクリプト選択ダイアログを表示
    local selection = showScriptSelector()

    if not selection then
        log("😴 ランチャーを終了します")
        toast("👋 終了しました", 2)
        return
    end

    -- 確認ダイアログをスキップしてすぐに実行（AutoTouchでalertが正しく動作しない場合があるため）
    log(string.format("📌 選択されたスクリプト: %s", selection.displayName))
    toast(string.format("✅ %s を実行します", selection.displayName), 2)
    usleep(1000000)  -- 1秒待機

    -- デバッグモードをグローバルに設定
    Config.DEBUG = selection.debug

    -- 選択されたスクリプトを実行
    log(string.format("🎯 %s を実行します", selection.script))
    toast(string.format("🎯 %s を開始", selection.displayName), 2)
    usleep(1500000)  -- 1.5秒待機

    -- スクリプト実行
    local executeSuccess = executeScript(selection.script, selection.debug)

    if not executeSuccess then
        log("⚠️ スクリプトの実行に失敗しました")

        -- 再実行を提案
        local retry = alert(
            "スクリプトの実行に失敗しました。\n\n" ..
            "もう一度実行しますか？",
            "再実行", "終了"
        )

        if retry == 1 then
            log("🔄 再実行を試みます")
            toast("🔄 再実行中...", 2)
            usleep(1000000)
            main()  -- 再帰的に実行
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

        -- エラーダイアログ
        alert(string.format(
            "🚨 致命的エラーが発生しました\n\n" ..
            "%s\n\n" ..
            "アプリを再起動してください。",
            tostring(err)
        ))

        -- スクリーンショット保存
        screenshot(string.format("launcher_error_%d.png", os.time()))
    end
end

-- ==========================================
-- スタートアップメッセージ
-- ==========================================
log("==========================================")
log("          SocialTouch Launcher            ")
log("     Instagram Automation Tool Suite      ")
log("             Version " .. Config.VERSION)
log("==========================================")
log("")
log("📱 起動中...")
log("🔐 ライセンス認証システム有効")
log("")

-- メイン実行
safeMain()