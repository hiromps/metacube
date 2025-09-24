-- ==========================================
-- Instagram ハッシュタグ自動いいね
-- 検索からキーワード入力して投稿にいいねを実行
-- ==========================================

-- グローバル中断フラグ
local INTERRUPTED = false

-- ==========================================
-- 設定値
-- ==========================================
local Config = {
    -- 画像検出設定
    IMAGE_DETECTION = {
        tolerance = 0.95,
        timeout = 5000000  -- 5秒
    },

    -- タイミング設定（マイクロ秒）
    TIMING = {
        TAP_DURATION = 50000,      -- 0.05秒
        AFTER_TAP = 1500000,        -- 1.5秒
        SCREEN_TRANSITION = 2000000, -- 2秒
        IMAGE_SEARCH = 500000,      -- 0.5秒
        BETWEEN_LIKES = 2000000,    -- 2秒（いいね間隔）
        TYPING_DELAY = 100000       -- 0.1秒（文字入力間隔）
    },

    -- 座標定義
    COORDINATES = {
        BACK_BUTTON = {x = 39.00, y = 90.03},  -- 戻るボタンの座標
        SEARCH_BUTTON_REGION = {x = 87.50, y = 63.89, width = 79.55, height = 42.08},  -- 検索ボタンの検索範囲
        SEARCH_CONFIRM = {x = 657.92, y = 1287.37},  -- 検索確定ボタンの座標

        -- ランダム投稿選択座標
        RANDOM_POSTS = {
            x = {140, 400, 650},              -- X座標（左、中央、右）
            y = {350, 620, 870}               -- Y座標（1段目、2段目、3段目）
        },

        -- リールいいねボタン検索範囲
        REEL_HEART_REGION = {x = 652.82, y = 545.07, width = 73.94, height = 526.06}
    },

    -- スクロール設定
    SCROLL = {
        distance = 500,
        duration = 300000  -- 0.3秒
    },

    -- デフォルト設定
    DEFAULT = {
        likeCount = 30,
        searchKeyword = "",  -- GUIで設定
        maxAttempts = 100,
        debugMode = false,
        speedMultiplier = 1.0,
        useDoubleTapFirst = false  -- ダブルタップ優先モード
    }
}

-- ==========================================
-- ユーティリティ関数
-- ==========================================
local Utils = {}

function Utils.log(message)
    print("[HashtagLike] " .. os.date("%H:%M:%S") .. " - " .. message)
end

function Utils.wait(microseconds)
    if INTERRUPTED then
        error("interrupted")
    end

    local totalWait = microseconds * Config.DEFAULT.speedMultiplier
    local chunkSize = 100000  -- 0.1秒単位

    while totalWait > 0 do
        if INTERRUPTED then
            error("interrupted")
        end
        local waitTime = math.min(totalWait, chunkSize)
        local success, err = pcall(usleep, waitTime)
        if not success then
            if err:match("interrupted") then
                INTERRUPTED = true
                error("interrupted")
            end
        end
        totalWait = totalWait - waitTime
    end
end

function Utils.convertCoordinates(x, y)
    local screenWidth, screenHeight = getScreenResolution()

    -- iPhone標準解像度（750x1334）からの変換
    local baseWidth = 750
    local baseHeight = 1334

    local scaleX = screenWidth / baseWidth
    local scaleY = screenHeight / baseHeight

    return {x * scaleX, y * scaleY}
end

-- ==========================================
-- タッチ操作
-- ==========================================
local Touch = {}

function Touch.tap(x, y, duration)
    local coords = Utils.convertCoordinates(x, y)
    local success, err = pcall(function()
        touchDown(0, coords[1], coords[2])
        Utils.wait(duration or Config.TIMING.TAP_DURATION)
        touchUp(0, coords[1], coords[2])
    end)

    if not success then
        if tostring(err):match("interrupted") then
            INTERRUPTED = true
            error("interrupted")
        end
        Utils.log("⚠️ タップエラー: " .. tostring(err))
    end
end

function Touch.complexSwipe(startX, startY, endX, endY, steps, duration)
    local startCoords = Utils.convertCoordinates(startX, startY)
    local endCoords = Utils.convertCoordinates(endX, endY)

    local success, err = pcall(function()
        touchDown(0, startCoords[1], startCoords[2])

        for i = 1, steps do
            if INTERRUPTED then
                touchUp(0, endCoords[1], endCoords[2])
                error("interrupted")
            end

            local progress = i / steps
            local currentX = startCoords[1] + (endCoords[1] - startCoords[1]) * progress
            local currentY = startCoords[2] + (endCoords[2] - startCoords[2]) * progress

            touchMove(0, currentX, currentY)
            Utils.wait(duration / steps)
        end

        touchUp(0, endCoords[1], endCoords[2])
    end)

    if not success then
        pcall(touchUp, 0, endCoords[1], endCoords[2])
        if tostring(err):match("interrupted") then
            INTERRUPTED = true
            error("interrupted")
        end
        Utils.log("⚠️ スワイプエラー: " .. tostring(err))
    end
end

-- ==========================================
-- 画像検出
-- ==========================================
local ImageDetection = {}

function ImageDetection.find(imagePath, tolerance, region)
    tolerance = tolerance or Config.IMAGE_DETECTION.tolerance

    local success, result = pcall(function()
        if region then
            -- 座標変換
            local coords = Utils.convertCoordinates(region.x, region.y)
            local x1 = math.floor(coords[1])
            local y1 = math.floor(coords[2])
            local x2 = math.floor(x1 + region.width * (coords[1] / region.x))
            local y2 = math.floor(y1 + region.height * (coords[2] / region.y))
            return findImage(imagePath, 1, tolerance, {x1, y1, x2, y2})
        else
            return findImage(imagePath, 1, tolerance)
        end
    end)

    if not success then
        if tostring(result):match("interrupted") then
            INTERRUPTED = true
            error("interrupted")
        end
        Utils.log("⚠️ 画像検出エラー: " .. tostring(result))
        return nil
    end

    -- findImageは成功時でもnilや空のテーブルを返すことがある
    if result and type(result) == "table" and #result > 0 then
        return result
    end

    return nil
end

function ImageDetection.waitFor(imagePath, timeout, tolerance, region)
    timeout = timeout or Config.IMAGE_DETECTION.timeout
    tolerance = tolerance or Config.IMAGE_DETECTION.tolerance

    local startTime = os.time()

    while os.time() - startTime < (timeout / 1000000) do
        if INTERRUPTED then
            error("interrupted")
        end

        local result = ImageDetection.find(imagePath, tolerance, region)
        if result then
            return result
        end

        Utils.wait(Config.TIMING.IMAGE_SEARCH)
    end

    return nil
end

-- ==========================================
-- メインアプリケーション
-- ==========================================
local App = {
    searchKeyword = "",
    likeCount = 30,
    currentLikes = 0,
    isRunning = false,
    debugMode = false,
    speedMultiplier = 1.0
}

-- 初期画面から検索ボタンをタップ
function App:tapSearchButton()
    Utils.log("🔍 検索ボタンを探しています...")

    -- 検索範囲を指定して検索
    local region = Config.COORDINATES.SEARCH_BUTTON_REGION
    local result = ImageDetection.waitFor("image/search.png", 10000000, 0.95, region)  -- 10秒待機

    if result then
        local x, y
        -- 結果の形式を確認
        if type(result[1]) == "table" then
            -- result = {{x1, y1}, {x2, y2}, ...}の形式
            x = result[1][1]
            y = result[1][2]
        else
            -- result = {x, y}の形式
            x = result[1]
            y = result[2]
        end

        Utils.log(string.format("✅ 検索ボタンを検出: (%.2f, %.2f)", x, y))

        -- 検索ボタンをタップ
        Touch.tap(x, y, Config.TIMING.TAP_DURATION)
        Utils.wait(Config.TIMING.SCREEN_TRANSITION)

        return true
    else
        Utils.log("❌ 検索ボタンが見つかりません")
        return false
    end
end

-- キーワードを入力
function App:inputSearchKeyword()
    Utils.log("📝 検索キーワードを入力中: " .. self.searchKeyword)

    -- キーワードを直接入力（検索ボタンタップ後は入力フィールドがアクティブになっている）
    local success, err = pcall(function()
        inputText(self.searchKeyword)
    end)

    if not success then
        Utils.log("⚠️ テキスト入力エラー: " .. tostring(err))
        return false
    end

    Utils.wait(Config.TIMING.AFTER_TAP)

    -- 検索確定ボタンをタップ
    Utils.log("🔍 検索確定ボタンをタップ中...")
    local confirmCoords = Utils.convertCoordinates(Config.COORDINATES.SEARCH_CONFIRM.x, Config.COORDINATES.SEARCH_CONFIRM.y)

    local success, err = pcall(function()
        touchDown(5, confirmCoords[1], confirmCoords[2])
        usleep(99826)  -- 約0.1秒
        touchUp(5, confirmCoords[1], confirmCoords[2])
    end)

    if not success then
        if tostring(err):match("interrupted") then
            INTERRUPTED = true
            error("interrupted")
        end
        Utils.log("⚠️ 検索確定ボタンタップエラー: " .. tostring(err))
        return false
    end

    Utils.log("✅ 検索確定ボタンをタップしました")
    Utils.wait(Config.TIMING.SCREEN_TRANSITION)

    return true
end

-- ランダムな投稿をタップ
function App:selectRandomPost()
    Utils.log("🎲 ランダム投稿を選択中...")

    math.randomseed(os.time())
    local rand = math.random(1, 9)  -- 1-9のランダム値（3段×3列）

    local tx = Config.COORDINATES.RANDOM_POSTS.x
    local ty = Config.COORDINATES.RANDOM_POSTS.y
    local selectedX, selectedY

    if rand == 1 then
        -- 1段目左（最新投稿）
        selectedX, selectedY = tx[1], ty[1]
        Utils.log("📍 選択: 1段目左（最新投稿）")
    elseif rand == 2 then
        -- 1段目中央
        selectedX, selectedY = tx[2], ty[1]
        Utils.log("📍 選択: 1段目中央")
    elseif rand == 3 then
        -- 1段目右
        selectedX, selectedY = tx[3], ty[1]
        Utils.log("📍 選択: 1段目右")
    elseif rand == 4 then
        -- 2段目左
        selectedX, selectedY = tx[1], ty[2]
        Utils.log("📍 選択: 2段目左")
    elseif rand == 5 then
        -- 2段目中央
        selectedX, selectedY = tx[2], ty[2]
        Utils.log("📍 選択: 2段目中央")
    elseif rand == 6 then
        -- 2段目右
        selectedX, selectedY = tx[3], ty[2]
        Utils.log("📍 選択: 2段目右")
    elseif rand == 7 then
        -- 3段目左
        selectedX, selectedY = tx[1], ty[3]
        Utils.log("📍 選択: 3段目左")
    elseif rand == 8 then
        -- 3段目中央
        selectedX, selectedY = tx[2], ty[3]
        Utils.log("📍 選択: 3段目中央")
    elseif rand == 9 then
        -- 3段目右
        selectedX, selectedY = tx[3], ty[3]
        Utils.log("📍 選択: 3段目右")
    end

    -- 座標変換
    local coords = Utils.convertCoordinates(selectedX, selectedY)

    -- タップ実行
    local success, err = pcall(function()
        touchDown(1, coords[1], coords[2])
        usleep(50000)  -- 0.05秒
        touchUp(1, coords[1], coords[2])
    end)

    if not success then
        if tostring(err):match("interrupted") then
            INTERRUPTED = true
            error("interrupted")
        end
        Utils.log("⚠️ ランダム投稿タップエラー: " .. tostring(err))
        return false
    end

    Utils.log(string.format("✅ ランダム投稿をタップしました: (%.2f, %.2f)", coords[1], coords[2]))
    Utils.wait(2000000)  -- 2秒待機（投稿詳細画面読み込み）

    return true
end

-- ダブルタップでいいねを実行
function App:findAndTapHeart()
    Utils.log("💗 ダブルタップでいいねを実行中...")

    -- 画面中央付近をダブルタップ
    local centerX, centerY = 375, 667  -- 画面中央の座標
    local coords = Utils.convertCoordinates(centerX, centerY)

    local success, err = pcall(function()
        -- 1回目のタップ
        touchDown(1, coords[1], coords[2])
        usleep(50000)
        touchUp(1, coords[1], coords[2])

        -- 短い間隔
        usleep(100000)  -- 0.1秒

        -- 2回目のタップ
        touchDown(1, coords[1], coords[2])
        usleep(50000)
        touchUp(1, coords[1], coords[2])
    end)

    if success then
        Utils.log(string.format("💗 ダブルタップ実行: (%.2f, %.2f)", coords[1], coords[2]))
        self.currentLikes = self.currentLikes + 1
        toast(string.format("ダブルタップいいね: %d/%d", self.currentLikes, self.likeCount), 1)
        return true
    else
        if tostring(err):match("interrupted") then
            INTERRUPTED = true
            error("interrupted")
        end
        Utils.log("❌ ダブルタップに失敗しました: " .. tostring(err))
        return false
    end
end

-- スクロール処理
function App:scrollFeed()
    Utils.log("📜 スクロール中...")

    Touch.complexSwipe(
        375, 800,  -- 開始位置
        375, 300,  -- 終了位置
        20,        -- ステップ数
        Config.SCROLL.duration
    )

    Utils.wait(Config.TIMING.AFTER_TAP)
end

-- メイン処理ループ
function App:run()
    Utils.log("🚀 ハッシュタグ自動いいね開始")
    Utils.log("🔍 検索キーワード: " .. self.searchKeyword)
    Utils.log("❤️ 目標いいね数: " .. self.likeCount)

    self.isRunning = true
    self.currentLikes = 0

    -- 検索ボタンをタップ
    if not self:tapSearchButton() then
        Utils.log("❌ 検索ボタンのタップに失敗しました")
        return
    end

    -- キーワード入力
    if not self:inputSearchKeyword() then
        Utils.log("❌ キーワード入力に失敗しました")
        return
    end

    -- 検索結果が表示されるまで待機
    Utils.wait(Config.TIMING.SCREEN_TRANSITION * 2)

    -- ランダムな投稿を選択
    if not self:selectRandomPost() then
        Utils.log("❌ ランダム投稿の選択に失敗しました")
        return
    end

    -- いいねループ開始
    Utils.log("🔄 いいねループを開始します")
    Utils.log(string.format("目標: %d回のいいね", self.likeCount))

    -- いいね処理ループ
    local attempts = 0

    while self.isRunning and self.currentLikes < self.likeCount and attempts < Config.DEFAULT.maxAttempts do
        if INTERRUPTED then
            Utils.log("⚠️ ユーザーによる中断を検出")
            break
        end

        -- ハートを探していいね実行
        local heartFound = self:findAndTapHeart()
        if heartFound then
            Utils.log("✅ いいねを実行しました")
            Utils.wait(Config.TIMING.BETWEEN_LIKES)
        else
            Utils.log("❌ ハートが見つかりませんでした")
        end

        -- スクロール
        self:scrollFeed()

        attempts = attempts + 1
    end

    -- 完了メッセージ
    Utils.log(string.format("✅ 完了 - いいね数: %d/%d", self.currentLikes, self.likeCount))
    toast(string.format("✅ 完了！いいね数: %d", self.currentLikes), 3)
end

-- ==========================================
-- GUI ダイアログ
-- ==========================================
function App:showDialog()
    local controls = {
        {type = CONTROLLER_TYPE.LABEL, text = "📱 ハッシュタグ自動いいね 📱"},
        {type = CONTROLLER_TYPE.LABEL, text = "━━━━━━━━━━━━━━━━━━━━━━"},

        {type = CONTROLLER_TYPE.INPUT,
         title = "🔍 検索キーワード:",
         key = "keyword",
         value = "#"},

        {type = CONTROLLER_TYPE.INPUT,
         title = "❤️ いいね数:",
         key = "likeCount",
         value = "30"},

        {type = CONTROLLER_TYPE.PICKER,
         title = "⚡ 速度:",
         key = "speed",
         value = "通常",
         options = {"高速", "通常", "低速"}},

        {type = CONTROLLER_TYPE.SWITCH,
         title = "🔍 デバッグモード:",
         key = "debug",
         value = 0},

        {type = CONTROLLER_TYPE.BUTTON,
         title = "🚀 開始",
         color = 0x68D391,
         width = 0.5,
         flag = 1,
         collectInputs = true},

        {type = CONTROLLER_TYPE.BUTTON,
         title = "❌ キャンセル",
         color = 0xFF5733,
         width = 0.5,
         flag = 2,
         collectInputs = false}
    }

    local orientations = {ORIENTATION_TYPE.PORTRAIT}
    local result = dialog(controls, orientations)

    if result == 1 then
        -- 設定を取得
        self.searchKeyword = controls[3].value or "#instagram"
        self.likeCount = tonumber(controls[4].value) or 30

        -- 速度設定
        local speedMode = controls[5].value
        if speedMode == "高速" then
            self.speedMultiplier = 0.5
            Config.DEFAULT.speedMultiplier = 0.5
        elseif speedMode == "低速" then
            self.speedMultiplier = 2.0
            Config.DEFAULT.speedMultiplier = 2.0
        else
            self.speedMultiplier = 1.0
            Config.DEFAULT.speedMultiplier = 1.0
        end

        -- デバッグモード
        self.debugMode = (controls[6].value == 1)
        Config.DEFAULT.debugMode = self.debugMode

        return true
    end

    return false
end

-- ==========================================
-- エントリーポイント
-- ==========================================
local function main()
    Utils.log("========================================")
    Utils.log("Instagram ハッシュタグ自動いいね")
    Utils.log("========================================")

    -- GUIダイアログ表示
    if App:showDialog() then
        -- メイン処理実行
        local success, err = pcall(function()
            App:run()
        end)

        if not success then
            if tostring(err):match("interrupted") then
                Utils.log("⚠️ ユーザーによって中断されました")
                toast("⚠️ 中断しました", 2)
            else
                Utils.log("❌ エラー: " .. tostring(err))
                toast("❌ エラーが発生しました", 2)
            end
        end
    else
        Utils.log("キャンセルされました")
        toast("キャンセルしました", 1)
    end
end

-- 実行
main()