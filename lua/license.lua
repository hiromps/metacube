-- ==========================================
-- Instagram自動いいね セキュリティ強化版
-- デバイス認証機能付き
-- ==========================================

-- ==========================================
-- セキュリティモジュール
-- ==========================================
local Security = {}

-- 認証済みデバイスリスト（ハッシュ化されたデバイスID）
-- 新規購入者のデバイスIDをここに追加
Security.authorizedDevices = {
    -- 例: "aac62cabf60fd77aab722285f60c0a67",
    -- 例: "HASH_OF_DEVICE_ID_2",
    -- テスト用デバイス（開発時のみ有効）
    "d788852180c20fafb5234778b327d5dc",
}

-- 簡易ハッシュ関数（SHA-256の代替）
function Security.simpleHash(str)
    local hash = 0
    for i = 1, #str do
        local char = string.byte(str, i)
        hash = ((hash * 31) + char) % 2147483647
    end
    -- さらに複雑化
    local result = ""
    local seed = hash
    for i = 1, 16 do
        seed = (seed * 1103515245 + 12345) % 2147483647
        result = result .. string.format("%02x", seed % 256)
    end
    return result
end

-- デバイス認証
function Security.authenticateDevice()
    -- デバイスIDを取得（複数の方法を試す）
    local deviceId = nil
    
    -- 方法1: getSN()を試す
    if getSN then
        deviceId = getSN()
    end
    
    -- 方法2: getDeviceID()を試す
    if not deviceId and getDeviceID then
        deviceId = getDeviceID()
    end
    
    -- 方法3: 画面解像度ベースの一意ID生成
    if not deviceId then
        local screenWidth, screenHeight = getScreenResolution()
        deviceId = string.format("%d_%d", screenWidth, screenHeight)
    end
    
    -- デバイスIDが取得できない場合
    if not deviceId or deviceId == "" then
        return false, "デバイスIDを取得できません"
    end
    
    -- ハッシュ化
    local hashedId = Security.simpleHash(deviceId)
    
    -- 認証リストと照合
    for _, authorizedHash in ipairs(Security.authorizedDevices) do
        if hashedId == authorizedHash then
            return true, "認証成功"
        end
    end
    
    -- 未認証デバイス
    return false, "未認証デバイス: " .. string.sub(hashedId, 1, 8) .. "..."
end

-- デバイス情報表示（購入者登録用）
function Security.showDeviceInfo()
    -- デバイスIDを取得（複数の方法を試す）
    local deviceId = nil
    
    -- 方法1: getSN()を試す
    if getSN then
        deviceId = getSN()
    end
    
    -- 方法2: getDeviceID()を試す
    if not deviceId and getDeviceID then
        deviceId = getDeviceID()
    end
    
    -- 方法3: 画面解像度ベースの一意ID生成
    if not deviceId then
        local screenWidth, screenHeight = getScreenResolution()
        deviceId = string.format("%d_%d", screenWidth, screenHeight)
    end
    
    if not deviceId or deviceId == "" then
        return nil, nil, "デバイスIDを取得できません"
    end
    
    local hashedId = Security.simpleHash(deviceId)
    
    local message = "=== デバイス情報 ===\n"
    message = message .. "デバイスID: " .. string.sub(deviceId, 1, 12) .. "...\n"
    message = message .. "ライセンスキー: " .. hashedId .. "\n"
    message = message .. "==================\n"
    message = message .. "この情報を開発者に送信してください"
    
    return deviceId, hashedId, message
end

-- ==========================================
-- GUI設定ダイアログ（認証後のみ表示）
-- ==========================================
local function showSettingsDialog()
    -- ダイアログコントロールの定義
    local titleLabel = {
        type = CONTROLLER_TYPE.LABEL, 
        text = "🔒 Instagram自動いいね [認証版] 🔒"
    }
    
    local separator1 = {
        type = CONTROLLER_TYPE.LABEL,
        text = "━━━━━━━━━━━━━━━━━━━"
    }
    
    local likeCountInput = {
        type = CONTROLLER_TYPE.INPUT,
        title = "💗 いいね回数:",
        key = "likeCount",
        value = "30"
    }
    
    local helpLabel = {
        type = CONTROLLER_TYPE.LABEL,
        text = "※ 1～500の範囲で設定してください"
    }
    
    local separator2 = {
        type = CONTROLLER_TYPE.LABEL,
        text = "━━━━━━━━━━━━━━━━━━━"
    }
    
    local speedPicker = {
        type = CONTROLLER_TYPE.PICKER,
        title = "⚡ 実行速度:",
        key = "speed",
        value = "通常",
        options = {"高速", "通常"}
    }
    
    local debugSwitch = {
        type = CONTROLLER_TYPE.SWITCH,
        title = "🔍 デバッグモード:",
        key = "debug",
        value = 0  -- デフォルトはOFF
    }
    
    local separator3 = {
        type = CONTROLLER_TYPE.LABEL,
        text = "━━━━━━━━━━━━━━━━━━━"
    }
    
    local noteLabel = {
        type = CONTROLLER_TYPE.LABEL,
        text = "⚠️ Instagramを開いてから実行してください"
    }
    
    local licenseLabel = {
        type = CONTROLLER_TYPE.LABEL,
        text = "✅ ライセンス認証済み"
    }
    
    -- ボタンの定義
    local startButton = {
        type = CONTROLLER_TYPE.BUTTON,
        title = "🚀 開始",
        color = 0x68D391,  -- 緑色
        width = 0.5,
        flag = 1,
        collectInputs = true
    }
    
    local cancelButton = {
        type = CONTROLLER_TYPE.BUTTON,
        title = "❌ キャンセル",
        color = 0xFF5733,  -- 赤色
        width = 0.5,
        flag = 2,
        collectInputs = false
    }
    
    -- コントロール配列
    local controls = {
        titleLabel,
        separator1,
        likeCountInput,
        helpLabel,
        separator2,
        speedPicker,
        debugSwitch,
        separator3,
        noteLabel,
        licenseLabel,
        startButton,
        cancelButton
    }
    
    -- ダイアログ表示（縦横両対応）
    local orientations = {
        ORIENTATION_TYPE.PORTRAIT,
        ORIENTATION_TYPE.LANDSCAPE_LEFT,
        ORIENTATION_TYPE.LANDSCAPE_RIGHT
    }
    
    local result = dialog(controls, orientations)
    
    -- 結果処理
    if result == 1 then  -- 開始ボタンが押された
        local likeCount = tonumber(likeCountInput.value)
        
        -- 入力値の検証
        if not likeCount or likeCount < 1 or likeCount > 500 then
            toast("⚠️ 1から500までの数値を入力してください", 2)
            return nil
        end
        
        -- 速度モードの変換
        local speedMode = "normal"
        if speedPicker.value == "高速" then
            speedMode = "fast"
        end
        
        return {
            likeCount = likeCount,
            speedMode = speedMode,
            debugMode = (debugSwitch.value == 1)
        }
    else
        return nil  -- キャンセル
    end
end

-- ==========================================
-- 設定セクション
-- ==========================================
local Config = {
    -- 色比較の許容値 (0-20)
    colorTolerance = 20,
    -- 解像度変換用の基準値
    resolutionScale = {w = 1, h = 1},
    -- デバッグモード（GUIで設定）
    debug = false,
    -- 最大実行回数
    maxIterations = 500,
    -- いいねボタンの最大クリック数（GUIで設定）
    maxLikeCount = 30,
    -- ログファイルのパス
    logFilePath = "like_log_security.txt",
    -- 速度設定
    speedMultiplier = 1,
    -- セキュリティ版識別子
    version = "SECURITY_1.0"
}

-- ==========================================
-- ユーティリティ関数
-- ==========================================
local Utils = {}

-- 文字列分割関数
function Utils.split(str, delimiter)
    local pattern = "%s*" .. delimiter .. "%s*"
    local p, nrep = str:gsub(pattern, "")
    return {str:match((("%s*(.-)%s*" .. delimiter .. "%s*"):rep(nrep) .. "(.*)"))}
end

-- 解像度変換
function Utils.convertCoordinates(x, y)
    return {
        math.floor(x * Config.resolutionScale.w + 0.5),
        math.floor(y * Config.resolutionScale.h + 0.5)
    }
end

-- RGB色比較
function Utils.compareRGB(color1, color2)
    local r1, g1, b1 = intToRgb(color1)
    local r2, g2, b2 = intToRgb(color2)
    
    if math.abs(r2 - r1) <= Config.colorTolerance and
       math.abs(g2 - g1) <= Config.colorTolerance and
       math.abs(b2 - b1) <= Config.colorTolerance then
        return 1
    end
    return 0
end

-- 待機関数（速度設定対応）
function Utils.wait(milliseconds)
    usleep(milliseconds * 1000 * Config.speedMultiplier)
end

-- ==========================================
-- ログシステム
-- ==========================================
local Logger = {}

function Logger.init()
    local file = io.open(Config.logFilePath, "w")
    if file then
        file:write("=== Instagram自動いいね セキュリティ版 ログ ===\n")
        file:write("バージョン: " .. Config.version .. "\n")
        file:write("開始時刻: " .. os.date("%Y-%m-%d %H:%M:%S") .. "\n")
        file:write("いいね目標数: " .. Config.maxLikeCount .. "回\n")
        file:write("================================\n\n")
        file:close()
    end
end

function Logger.write(message)
    local file = io.open(Config.logFilePath, "a")
    if file then
        local timestamp = os.date("%Y-%m-%d %H:%M:%S")
        file:write("[" .. timestamp .. "] " .. message .. "\n")
        file:close()
    end
    
    if Config.debug then
        print("[" .. os.date("%H:%M:%S") .. "] " .. message)
    end
end

function Logger.writeSummary(likeCount, duration)
    local file = io.open(Config.logFilePath, "a")
    if file then
        file:write("\n================================\n")
        file:write("=== 実行結果サマリー ===\n")
        file:write("終了時刻: " .. os.date("%Y-%m-%d %H:%M:%S") .. "\n")
        file:write("いいね総数: " .. likeCount .. "回\n")
        file:write("実行時間: " .. string.format("%.2f", duration) .. "秒\n")
        file:write("平均速度: " .. string.format("%.2f", likeCount / duration) .. "回/秒\n")
        file:write("================================\n")
        file:close()
    end
end

-- ==========================================
-- タッチ操作関数
-- ==========================================
local Touch = {}

-- 通常タップ
function Touch.tap(x, y, duration)
    local coords = Utils.convertCoordinates(x, y)
    touchDown(0, coords[1], coords[2])
    Utils.wait(duration or 50)
    touchUp(0, coords[1], coords[2])
    
    if duration and duration <= 50 then
        Utils.wait(5)
    else
        Utils.wait(200)
    end
end

-- 長押しタップ
function Touch.longTap(x, y, duration)
    local coords = Utils.convertCoordinates(x, y)
    touchDown(0, coords[1], coords[2])
    Utils.wait(duration)
    touchUp(0, coords[1], coords[2])
    Utils.wait(200)
end

-- スワイプ/ドラッグ
function Touch.swipe(startX, startY, endX, endY, steps)
    steps = steps or 50
    local startCoords = Utils.convertCoordinates(startX, startY)
    local endCoords = Utils.convertCoordinates(endX, endY)
    local deltaX = (endCoords[1] - startCoords[1]) / steps
    local deltaY = (endCoords[2] - startCoords[2]) / steps
    
    touchDown(0, startCoords[1], startCoords[2])
    Utils.wait(200)
    
    for i = 1, steps do
        touchMove(0, 
            startCoords[1] + (deltaX * i),
            startCoords[2] + (deltaY * i))
        usleep(500)
    end
    
    if steps >= 100 then
        Utils.wait(200)
    end
    
    touchUp(0, endCoords[1], endCoords[2])
    Utils.wait(200)
end

-- ==========================================
-- カラーチェッカークラス
-- ==========================================
local ColorChecker = {}
ColorChecker.__index = ColorChecker

function ColorChecker:new()
    local self = setmetatable({}, ColorChecker)
    self.data = {
        pngNo = {},
        colors = {},
        points = {},
        tapPoints = {},
        tags = {},
        values = {}
    }
    self.count = 0
    return self
end

function ColorChecker:addData(dataString)
    local entries = Utils.split(dataString, "^")
    for _, entry in pairs(entries) do
        local parts = Utils.split(entry, ",")
        self.count = self.count + 1
        local idx = self.count
        
        self.data.pngNo[idx] = parts[1]
        self.data.colors[idx * 2 - 1] = tonumber(parts[2])
        self.data.colors[idx * 2] = tonumber(parts[5])
        self.data.points[idx * 2 - 1] = Utils.convertCoordinates(tonumber(parts[3]), tonumber(parts[4]))
        self.data.points[idx * 2] = Utils.convertCoordinates(tonumber(parts[6]), tonumber(parts[7]))
        self.data.tapPoints[idx] = parts[8]
        self.data.tags[idx] = parts[9]
    end
end

function ColorChecker:findColors()
    local rgb = getColors(self.data.points)
    if rgb then
        for i = 1, self.count do
            self.data.values[i] = 
                Utils.compareRGB(rgb[i * 2 - 1], self.data.colors[i * 2 - 1]) +
                Utils.compareRGB(rgb[i * 2], self.data.colors[i * 2])
        end
    end
end

function ColorChecker:tapAction(index)
    local tapData = Utils.split(self.data.tapPoints[index], "_")
    Touch.tap(tonumber(tapData[1]), tonumber(tapData[2]), 200)
end

function ColorChecker:check(beforeCallback, afterCallback)
    self:findColors()
    
    for i = 1, self.count do
        if self.data.values[i] == 2 then
            local shouldContinue = true
            
            if beforeCallback then
                shouldContinue = beforeCallback(self, i)
            end
            
            if shouldContinue then
                self:tapAction(i)
                
                if afterCallback then
                    afterCallback(self, i)
                end
                
                return true
            end
        end
    end
    
    return false
end

-- ==========================================
-- ゲーム固有のアクション
-- ==========================================
local GameActions = {}

-- ハートを探してタップ（いいねボタン）
function GameActions.findAndTapHeart()
    local result = findImage("image/heart_empty.png", 1, 0.99, {21, 128, 62, 1115}, nil)
    for i, v in pairs(result) do
        Touch.tap(v[1], v[2], 200)
        Logger.write("いいねボタンをタップしました - 座標: (" .. v[1] .. ", " .. v[2] .. ")")
        return true
    end
    Logger.write("いいねボタンが見つかりませんでした")
    return false
end

-- 複雑なスワイプパターン
function GameActions.complexSwipePattern()
    local swipeData = {
        {4, 45.16, 1128.53, 49647.33},
        {4, 59.52, 1106.14, 16715.79},
        {4, 70.82, 1089.84, 16663.96},
        {4, 90.32, 1061.34, 16785.71},
        {4, 115.97, 1022.65, 16681.17},
        {4, 144.72, 982.95, 16572.79},
        {4, 180.64, 938.15, 16547.58},
        {4, 220.66, 890.30, 16731.88},
        {4, 259.68, 844.48, 16679.25},
        {4, 298.68, 801.71, 16932.00},
        {4, 332.55, 765.07, 16326.12},
        {4, 367.45, 729.43, 16866.79},
        {4, 408.50, 691.75, 16644.33},
        {4, 449.56, 652.06, 16448.33},
        {4, 487.53, 616.42, 16598.08},
        {4, 523.46, 585.86, 16711.67},
        {4, 551.17, 560.42, 16723.21},
        {4, 578.89, 536.99, 16621.88},
        {4, 605.58, 515.62, 16742.33},
        {4, 627.12, 499.33, 16727.04},
        {4, 649.70, 483.03, 16621.17},
        {4, 669.20, 467.76, 16916.33},
        {4, 684.61, 453.51, 16789.00},
        {4, 698.97, 439.27, 16227.12},
        {4, 708.21, 425.00, 17031.04},
        {4, 718.47, 412.78, 16699.54},
        {4, 727.71, 401.59, 16459.62},
        {4, 733.88, 389.38, 16664.75},
        {4, 737.97, 380.22, 16737.21},
        {4, 741.05, 372.05, 16551.88},
        {4, 742.08, 365.95, 16906.50},
        {4, 743.11, 361.88, 16596.29},
        {4, 743.11, 357.80, 17088.46},
        {4, 743.11, 355.77, 16155.50},
        {4, 743.11, 353.73, 33181.79},
        {4, 743.11, 352.72, 17139.25},
        {4, 744.14, 352.72, 49929.96},
        {4, 745.16, 352.72, 15086.58}
    }
    
    touchDown(swipeData[1][1], swipeData[1][2], swipeData[1][3])
    usleep(swipeData[1][4])
    
    for i = 2, #swipeData do
        touchMove(swipeData[i][1], swipeData[i][2], swipeData[i][3])
        usleep(swipeData[i][4])
    end
    
    touchUp(4, 749.27, 348.64)
end

-- ==========================================
-- プログレス表示関数
-- ==========================================
local function showProgress(current, total)
    if Config.debug then  -- デバッグモードの時のみ表示
        local percentage = math.floor((current / total) * 100)
        local progressBar = ""
        local barLength = 10
        local filled = math.floor(barLength * current / total)
        
        for i = 1, barLength do
            if i <= filled then
                progressBar = progressBar .. "■"
            else
                progressBar = progressBar .. "□"
            end
        end
        
        local message = string.format("進捗: %s %d/%d (%d%%)", progressBar, current, total, percentage)
        toast(message, 1)
    end
end

-- ==========================================
-- メインアプリケーション
-- ==========================================
local App = {}
App.iterationCount = 0
App.likeCount = 0
App.isRunning = true
App.startTime = 0

function App:init()
    self.startTime = os.time()
    
    Logger.init()
    Logger.write("セキュリティ版 - 自動化処理を開始します")
    Logger.write("最大いいね数: " .. Config.maxLikeCount .. "回")
    
    self.colorChecker = ColorChecker:new()
    local colorData = "00001,0xFAFAFA,0,0,0xFAFAFA,0,0,0_0,B00001"
    self.colorChecker:addData(colorData)
    
    math.randomseed(os.time())
    Logger.write("初期化完了")
    
    -- 開始通知（デバッグモードの時のみ）
    if Config.debug then
        toast("🚀 自動いいね開始！目標: " .. Config.maxLikeCount .. "回", 2)
    end
end

function App:beforeTapCallback(checker, index)
    if checker.data.tags[index] == "B00001" then
        local heartFound = GameActions.findAndTapHeart()
        
        if heartFound then
            self.likeCount = self.likeCount + 1
            Logger.write("いいね実行 [" .. self.likeCount .. "/" .. Config.maxLikeCount .. "]")
            
            -- プログレス表示
            showProgress(self.likeCount, Config.maxLikeCount)
            
            if self.likeCount % 10 == 0 then
                Logger.write("===== 進捗: " .. self.likeCount .. "回のいいねを完了 =====")
                if Config.debug then  -- デバッグモードの時のみ表示
                    toast("✅ " .. self.likeCount .. "回完了！", 1)
                end
            end
            
            if self.likeCount >= Config.maxLikeCount then
                Logger.write("目標の" .. Config.maxLikeCount .. "回のいいねに到達しました")
                self.isRunning = false
                return false
            end
        end
        
        self.iterationCount = self.iterationCount + 1
        
        if self.iterationCount >= Config.maxIterations then
            Logger.write("最大イテレーション数(" .. Config.maxIterations .. ")に到達")
            self.isRunning = false
            return false
        end
        
        Utils.wait(1000)
        GameActions.complexSwipePattern()
        
        return false
    end
    
    return true
end

function App:afterTapCallback(checker, index)
    if Config.debug then
        Logger.write("タグ処理完了: " .. checker.data.tags[index])
    end
end

function App:run()
    self:init()
    
    while self.isRunning do
        self.colorChecker:check(
            function(checker, index) return self:beforeTapCallback(checker, index) end,
            function(checker, index) return self:afterTapCallback(checker, index) end
        )
        
        Utils.wait(1000)
    end
    
    local duration = os.time() - self.startTime
    Logger.write("自動化処理を終了します")
    Logger.writeSummary(self.likeCount, duration)
    
    -- 完了通知（常に表示）
    toast("🎊 自動いいね完了！総数: " .. self.likeCount .. "回", 3)
    
    if Config.debug then
        print("\n===== 実行完了 =====")
        print("いいね総数: " .. self.likeCount .. "回")
        print("実行時間: " .. string.format("%.2f", duration) .. "秒")
        print("ログファイル: " .. Config.logFilePath)
        print("==================")
    end
    
    stop()
end

-- ==========================================
-- アプリケーション実行エントリーポイント
-- ==========================================

-- デバイス認証を実行
local isAuthenticated, authMessage = Security.authenticateDevice()

if not isAuthenticated then
    -- 未認証デバイスの場合
    local deviceId, hashedId, infoMessage = Security.showDeviceInfo()
    
    toast("❌ ライセンス認証エラー", 3)
    usleep(3000000)
    
    -- エラーダイアログ表示
    local errorControls = {
        {type = CONTROLLER_TYPE.LABEL, text = "🔒 ライセンス認証が必要です 🔒"},
        {type = CONTROLLER_TYPE.LABEL, text = "━━━━━━━━━━━━━━━━━━━"},
        {type = CONTROLLER_TYPE.LABEL, text = "このデバイスは認証されていません"},
        {type = CONTROLLER_TYPE.LABEL, text = ""},
        {type = CONTROLLER_TYPE.LABEL, text = "あなたのライセンスキー:"},
        {type = CONTROLLER_TYPE.INPUT, 
         title = "", 
         key = "licenseKey", 
         value = hashedId or "エラー",
         prompt = "ライセンスキー"},
        {type = CONTROLLER_TYPE.LABEL, text = ""},
        {type = CONTROLLER_TYPE.LABEL, text = "【対処方法】"},
        {type = CONTROLLER_TYPE.LABEL, text = "1. device_register_final.lua を実行"},
        {type = CONTROLLER_TYPE.LABEL, text = "2. 表示されたキーを販売者に送信"},
        {type = CONTROLLER_TYPE.LABEL, text = "3. 認証版の提供を待つ"},
        {type = CONTROLLER_TYPE.LABEL, text = "━━━━━━━━━━━━━━━━━━━"},
        {type = CONTROLLER_TYPE.BUTTON, title = "閉じる", color = 0xFF5733, flag = 1}
    }
    
    dialog(errorControls, {ORIENTATION_TYPE.PORTRAIT})
    
    -- ログに記録
    local file = io.open("device_registration_request.txt", "w")
    if file then
        file:write("=== デバイス登録リクエスト ===\n")
        file:write("日時: " .. os.date("%Y-%m-%d %H:%M:%S") .. "\n")
        file:write("デバイスID: " .. deviceId .. "\n")
        file:write("ライセンスキー: " .. hashedId .. "\n")
        file:write("================================\n")
        file:close()
    end
    
    stop()
else
    -- 認証成功
    toast("✅ ライセンス認証成功", 2)
    usleep(1000000)
    
    -- GUI設定ダイアログを表示
    local settings = showSettingsDialog()
    
    if settings then
        -- 設定値を適用
        Config.maxLikeCount = settings.likeCount
        Config.debug = settings.debugMode
        
        -- 速度設定の適用
        if settings.speedMode == "fast" then
            Config.speedMultiplier = 0.5
        end
        
        -- 確認メッセージ（常に表示）
        toast("設定完了！" .. Config.maxLikeCount .. "回のいいねを実行します", 2)
        usleep(2000000)  -- 2秒待機
        
        -- アプリケーション実行
        App:run()
    else
        toast("❌ キャンセルされました", 2)
        stop()
    end
end