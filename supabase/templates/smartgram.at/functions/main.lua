-- ==========================================
-- Instagram自動化ツール メインランチャー
-- スクリプト選択ダイアログ
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
    VERSION = "1.0.0",

    -- 除外するファイル名
    EXCLUDE_FILES = {
        "main.lua"  -- 自分自身は除外
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
-- メイン処理
-- ==========================================
local function main()
    log("=== 🚀 Instagram自動化ツール メインランチャー ===")
    log(string.format("バージョン: %s", Config.VERSION))
    log("==========================================")

    -- 初期トースト表示
    toast("🚀 Instagram自動化ツール", 2)
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
log("    Instagram Automation Tool Launcher    ")
log("             Version " .. Config.VERSION)
log("==========================================")
log("")
log("📱 起動中...")
log("")

-- メイン実行
safeMain()