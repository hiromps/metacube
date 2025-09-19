-- ==========================================
-- Instagram アクティブユーザー自動いいね
-- フォロー中タブから最新投稿へ遷移していいね実行
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
        BACK_BUTTON = 114559        -- 戻るボタンタップ時間
    },

    -- 座標定義
    COORDINATES = {
        BACK_BUTTON = {x = 39.00, y = 90.03},  -- 戻るボタンの座標
        FOLLOW_TAB_OFFSET = -300,  -- フォローボタンからフォロー中タブへのX軸オフセット
        -- プロフィール統計情報の領域（個別に検出）- 微調整版
        POSTS_REGION = {x = 235.56, y = 220.22, width = 108.67, height = 40.27},      -- 投稿数
        POSTS_REGION_ALT = {x = 242.33, y = 234.97, width = 45.57, height = 40.66},   -- 投稿数（代替座標）
        POSTS_REGION_ALT2 = {x = 230.00, y = 205.00, width = 90.00, height = 50.00},  -- 投稿数（範囲拡大座標）
        FOLLOWERS_REGION = {x = 353.02, y = 220.00, width = 101.05, height = 40.00},  -- フォロワー数（複数座標で検出）
        FOLLOWERS_REGION_ALT = {x = 355.31, y = 200.84, width = 87.90, height = 38.62}, -- フォロワー数（代替座標）
        FOLLOWERS_REGION_ALT2 = {x = 359.06, y = 214.06, width = 53.46, height = 35.07}, -- フォロワー数（特殊文字対策座標）
        FOLLOWING_REGION = {x = 542.90, y = 220.00, width = 136.93, height = 40.00},   -- フォロー中数（Y座標を微調整）
        FOLLOWING_REGION_ALT = {x = 551.59, y = 215.19, width = 62.87, height = 31.90}, -- フォロー中数（特殊文字対策座標）
        FOLLOWING_REGION_ALT2 = {x = 545.00, y = 200.00, width = 80.00, height = 35.00} -- フォロー中数（追加対策座標）
    },

    -- プロフィールチェック設定
    PROFILE_CHECK = {
        minPosts = 1,      -- 最小投稿数（0を除外）
        minFollowers = 100, -- 最小フォロワー数（デフォルト: 100）
        minFollowing = 50   -- 最小フォロー中数（デフォルト: 50）
    },

    -- スクロール設定
    SCROLL = {
        distance = 500,
        duration = 300000  -- 0.3秒
    },

    -- デフォルト設定
    DEFAULT = {
        likeCount = 1,
        loopCount = 30,  -- 全体ループ回数
        maxAttempts = 100,
        debugMode = false,
        followEnabled = true  -- フォロー機能の有効/無効（デフォルト: 有効）
    }
}

-- ==========================================
-- ユーティリティ関数
-- ==========================================
local Utils = {}

function Utils.log(message)
    print("[ActiveLike] " .. os.date("%H:%M:%S") .. " - " .. message)
end


function Utils.wait(microseconds)
    -- 長い待機時間を小分割して中断可能にする
    local totalWait = microseconds
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
                error("interrupted")  -- 中断を上位に伝播
            end
            error(err)
        end
        totalWait = totalWait - waitTime
    end
    return true
end

function Utils.convertCoordinates(x, y)
    local screenWidth, screenHeight = getScreenResolution()

    -- iPhone標準解像度（750x1334）からの変換
    local baseWidth = 750
    local baseHeight = 1334

    local scaleX = screenWidth / baseWidth
    local scaleY = screenHeight / baseHeight

    return {math.floor(x * scaleX), math.floor(y * scaleY)}
end

-- ==========================================
-- タッチ操作
-- ==========================================
local Touch = {}

function Touch.tap(x, y, duration)
    local coords = Utils.convertCoordinates(x, y)

    local success, err = pcall(touchDown, 2, coords[1], coords[2])
    if not success then
        if tostring(err):match("interrupted") then
            INTERRUPTED = true
            error("interrupted")
        end
        Utils.log("タップエラー: " .. tostring(err))
        return false
    end

    Utils.wait(duration or Config.TIMING.TAP_DURATION)

    pcall(touchUp, 2, coords[1], coords[2])
    return true
end

function Touch.scroll(startY, endY)
    local screenWidth, _ = getScreenResolution()
    local centerX = screenWidth / 2

    local success, err = pcall(touchDown, 3, centerX, startY)
    if not success then
        if tostring(err):match("interrupted") then
            INTERRUPTED = true
            error("interrupted")
        end
        return false
    end

    Utils.wait(50000)

    -- スムーズなスクロール
    local steps = 10
    local stepY = (endY - startY) / steps

    for i = 1, steps do
        if INTERRUPTED then
            pcall(touchUp, 3, centerX, startY + stepY * i)
            error("interrupted")
        end
        pcall(touchMove, 3, centerX, startY + stepY * i)
        Utils.wait(30000)
    end

    pcall(touchUp, 3, centerX, endY)
    return true
end

-- ==========================================
-- 画像検出
-- ==========================================
local ImageDetection = {}

function ImageDetection.findButton(imagePath, region)
    Utils.log("画像を検索中: " .. imagePath)

    local success, result = pcall(
        findImage,
        imagePath,
        1,
        Config.IMAGE_DETECTION.tolerance,
        region
    )

    if not success then
        if tostring(result):match("interrupted") then
            INTERRUPTED = true
            error("interrupted")
        end
        Utils.log("画像検出エラー: " .. tostring(result))
        return nil
    end

    if result and #result > 0 then
        Utils.log("画像を検出: " .. imagePath)
        return result
    end

    return nil
end

function ImageDetection.waitForImage(imagePath, timeout)
    local startTime = os.time()
    local elapsed = 0

    while elapsed < timeout do
        if INTERRUPTED then
            error("interrupted")
        end

        local result = ImageDetection.findButton(imagePath)
        if result then
            return result
        end

        Utils.wait(Config.TIMING.IMAGE_SEARCH)
        elapsed = os.time() - startTime
    end

    Utils.log("タイムアウト: " .. imagePath .. " が見つかりません")
    return nil
end

-- ==========================================
-- メインアプリケーション
-- ==========================================
local App = {}

function App:init(settings)
    self.settings = settings or {}
    self.likeCount = tonumber(self.settings.likeCount) or Config.DEFAULT.likeCount
    self.loopCount = tonumber(self.settings.loopCount) or Config.DEFAULT.loopCount
    -- デバッグモードの設定（falseも有効な値として扱う）
    if self.settings.debugMode ~= nil then
        self.debugMode = self.settings.debugMode
    else
        self.debugMode = Config.DEFAULT.debugMode
    end
    -- フォロー機能の設定（falseも有効な値として扱う）
    if self.settings.followEnabled ~= nil then
        self.followEnabled = self.settings.followEnabled
    else
        self.followEnabled = Config.DEFAULT.followEnabled
    end
    self.processedCount = 0
    self.totalProcessedCount = 0  -- 全ループでの合計いいね数
    self.currentLoop = 0  -- 現在のループ回数
    self.isRunning = true
    self.consecutiveScrolls = 0  -- 連続スクロール回数
    self.maxConsecutiveScrolls = 5  -- 最大連続スクロール回数
    self.startTime = os.time()  -- 開始時刻
    self.allTappedPositions = {}  -- すべてのタップ履歴（スクロールでリセット）
    self.recentTappedPositions = {}  -- 最近のタップ履歴（最大6個、スクロールでリセット）
    self.maxRecentHistory = 6  -- 最近の履歴の最大数
    self.lastTappedY = nil  -- 最後にタップしたユーザーのY座標
    self.processedUsers = {}  -- 処理済みユーザー座標（フォロー有無を記録）

    -- プロフィール統計フィルターの設定を反映
    -- デバッグ用: 受信した設定値の詳細ログ（反映前）
    Utils.log("=== 設定値確認 ===")
    Utils.log(string.format("受信 - minPosts: %s (type: %s)",
        tostring(self.settings.minPosts), type(self.settings.minPosts)))
    Utils.log(string.format("受信 - minFollowers: %s (type: %s)",
        tostring(self.settings.minFollowers), type(self.settings.minFollowers)))
    Utils.log(string.format("受信 - minFollowing: %s (type: %s)",
        tostring(self.settings.minFollowing), type(self.settings.minFollowing)))

    -- 設定値を反映（nilチェックを厳密に）
    if self.settings.minPosts ~= nil then
        Config.PROFILE_CHECK.minPosts = self.settings.minPosts
    end
    if self.settings.minFollowers ~= nil then
        Config.PROFILE_CHECK.minFollowers = self.settings.minFollowers
    end
    if self.settings.minFollowing ~= nil then
        Config.PROFILE_CHECK.minFollowing = self.settings.minFollowing
    end

    Utils.log("=== ActiveLike 初期化 ===")
    Utils.log("目標いいね数: " .. self.likeCount .. " x " .. self.loopCount .. "ループ")
    Utils.log("👤 自動フォロー機能: " .. (self.followEnabled and "有効" or "無効"))

    Utils.log(string.format("📊 プロフィールフィルター（最終値）: 投稿数≥%d, フォロワー≥%d, フォロー中≥%d",
        Config.PROFILE_CHECK.minPosts,
        Config.PROFILE_CHECK.minFollowers,
        Config.PROFILE_CHECK.minFollowing))

    -- 開始通知とプログレスバー初期表示
    local progressBar = "░░░░░░░░░░"
    toast(string.format("🚀 ActiveLike開始！\n[%s] 0/%d ループ (0%%)\n👤 フォロー機能: %s",
        progressBar,
        self.loopCount,
        self.followEnabled and "有効" or "無効"
    ), 3)
end

-- 新しい座標管理システム（デバッグ強化版）
function App:addProcessedUser(y, followStatus)
    -- followStatus: "followed" (フォローした), "not_followed" (フォローしなかった), "skipped" (スキップした)
    local user = {
        y = y,
        status = followStatus,
        timestamp = os.time()
    }
    table.insert(self.processedUsers, user)

    -- 詳細なデバッグログ
    Utils.log(string.rep("=", 50))
    Utils.log("✅ 処理済みユーザー記録")
    Utils.log(string.format("  📍 Y座標: %.2f", y))
    Utils.log(string.format("  📊 ステータス: %s", followStatus))
    Utils.log(string.format("  🕐 記録時刻: %s", os.date("%H:%M:%S", user.timestamp)))
    Utils.log(string.format("  📋 総数: %d人", #self.processedUsers))

    -- 現在の全処理済みユーザーリストを表示
    Utils.log("📜 全処理済みユーザー:")
    for i, u in ipairs(self.processedUsers) do
        Utils.log(string.format("  %d. Y=%.2f, ステータス=%s, 時刻=%s",
            i, u.y, u.status, os.date("%H:%M:%S", u.timestamp)))
    end
    Utils.log(string.rep("=", 50))
end

function App:isUserProcessed(y)
    Utils.log("🔍 重複チェック開始")
    Utils.log(string.format("  🎯 対象Y座標: %.2f", y))
    Utils.log(string.format("  📊 比較対象数: %d人", #self.processedUsers))

    for i, user in ipairs(self.processedUsers) do
        local distance = math.abs(y - user.y)
        Utils.log(string.format("  比較%d: 記録Y=%.2f, 距離=%.2f, ステータス=%s",
            i, user.y, distance, user.status))

        if distance <= 15 then  -- 15ピクセル以内は同一ユーザー
            Utils.log("⚠️ 重複ユーザー検出!")
            Utils.log(string.format("  📍 入力Y: %.2f", y))
            Utils.log(string.format("  📍 記録Y: %.2f", user.y))
            Utils.log(string.format("  📏 距離: %.2f ピクセル (閾値: 15)", distance))
            Utils.log(string.format("  📊 前回ステータス: %s", user.status))
            Utils.log(string.format("  🕐 前回記録時刻: %s", os.date("%H:%M:%S", user.timestamp)))
            return true, user.status
        end
    end

    Utils.log(string.format("✅ 新規ユーザー: Y=%.2f (未処理)", y))
    return false, nil
end

function App:scrollInitialScreen()
    Utils.log("🔄 ===== スクロール実行開始 =====")
    Utils.log("⚠️ 新しいユーザーが見つからないため、やむを得ずスクロール実行")
    Utils.log(string.format("📊 スクロール前の処理済みユーザー数: %d人", #self.processedUsers))

    -- スクロール後はタップ履歴をクリア
    self.allTappedPositions = {}  -- 古い履歴のみクリア
    self.recentTappedPositions = {}
    self.lastTappedY = nil  -- 最後のタップもクリア

    -- スクロール回数をカウント
    self.scrollCount = (self.scrollCount or 0) + 1
    Utils.log(string.format("📊 スクロール回数: %d回目", self.scrollCount))

    -- スクロール動作
    local coords = Utils.convertCoordinates(524.48, 1204.91)
    local success, err = pcall(touchDown, 1, coords[1], coords[2])
    if not success then
        if tostring(err):match("interrupted") then
            INTERRUPTED = true
            error("interrupted")
        end
        return false
    end

    Utils.wait(34050.96)

    local scrollData = {
        {1, 509.09, 1184.53, 16892.75},
        {1, 503.95, 1165.19, 16410.67},
        {1, 492.67, 1140.75, 17027.33},
        {1, 478.29, 1106.14, 16625.21},
        {1, 459.82, 1059.31, 16550.62},
        {1, 443.40, 1010.43, 16627.50},
        {1, 426.98, 962.58, 16953.08},
        {1, 406.45, 914.72, 16294.25},
        {1, 382.84, 868.90, 16734.50},
        {1, 363.34, 820.05, 16877.17},
        {1, 344.87, 768.12, 16602.42},
        {1, 330.49, 718.23, 16380.54},
        {1, 318.18, 667.33, 16826.17},
        {1, 308.94, 620.49, 16526.21},
        {1, 299.70, 585.86, 16628.25},
        {1, 288.41, 552.28, 16782.92},
        {1, 278.15, 529.87, 16719.00},
        {1, 265.83, 506.46, 16677.04},
        {1, 253.52, 486.10, 16708.54},
        {1, 239.15, 465.73, 16597.33},
        {1, 223.75, 446.39, 16770.08},
        {1, 210.41, 431.12, 16733.04},
        {1, 199.12, 413.80, 16505.29},
        {1, 190.91, 398.53, 16705.67},
        {1, 184.74, 385.30, 16792.12},
        {1, 177.57, 372.05, 16461.62},
        {1, 170.38, 355.77, 16652.96},
        {1, 160.11, 341.52, 16846.21},
        {1, 150.88, 326.25, 16534.54},
        {1, 140.61, 311.98, 16759.67},
        {1, 133.43, 299.77, 16692.62},
        {1, 126.24, 287.56, 16664.42},
        {1, 120.08, 278.40, 16714.83},
        {1, 114.96, 271.27, 16691.75},
        {1, 110.85, 266.19, 16805.92},
        {1, 95.46, 255.99, 33264.62},
        {1, 94.43, 255.99, 83353.04},
        {1, 93.40, 255.99, 16612.96},
        {1, 91.35, 255.99, 50980.88}
    }

    for _, data in ipairs(scrollData) do
        if INTERRUPTED then
            pcall(touchUp, 1, coords[1], coords[2])
            error("interrupted")
        end

        coords = Utils.convertCoordinates(data[2], data[3])
        pcall(touchMove, data[1], coords[1], coords[2])
        Utils.wait(data[4])
    end

    coords = Utils.convertCoordinates(87.24, 251.92)
    pcall(touchUp, 1, coords[1], coords[2])

    Utils.wait(Config.TIMING.SCREEN_TRANSITION)

    Utils.log("🔄 ===== スクロール実行完了 =====")
    Utils.log(string.format("📊 スクロール前の処理済みユーザー数: %d人", #self.processedUsers))

    -- スクロール成功後は処理済みユーザーをクリーンな状態にリセット
    self.processedUsers = {}
    Utils.log("🧹 処理済みユーザーをクリーンな状態にリセット")

    Utils.log("✅ 画面が更新されました - 画面安定のため追加待機")

    -- スクロール後の画面安定のため追加待機（重要）
    Utils.wait(1500000)  -- 1.5秒追加待機

    Utils.log("🔍 新しいユーザーの検索を開始します（クリーンな状態）")

    return true
end

function App:checkFollowedOnlyAndScroll()
    -- followedbtn.pngだけが画面にあるかチェック
    Utils.log("フォローボタンの状態を確認中...")

    -- followbtn.pngまたはfollowbtn_v2.pngを検索
    local followBtnResult = ImageDetection.findButton("image/followbtn.png")
    if not followBtnResult then
        followBtnResult = ImageDetection.findButton("image/followbtn_v2.png")
    end

    local followedBtnResult = ImageDetection.findButton("image/followedbtn.png")

    -- followedbtn.pngのみ存在する場合
    if followedBtnResult and not followBtnResult then
        Utils.log("⚠️ フォロー済みボタンのみ検出 - スクロールします")
        self:scrollInitialScreen()
        return true
    end

    return false
end

function App:tapInitialScreen()
    Utils.log("初期画面をタップ中...")

    -- まず、followedbtn.pngだけの状態かチェック
    if self:checkFollowedOnlyAndScroll() then
        -- スクロール後、再度フォローボタンを探す
        Utils.wait(1000000)  -- 1秒待機
    end

    -- フォローボタンが見つかるまで最大5回スクロール
    local maxScrollAttempts = 5
    local scrollAttempts = 0

    while scrollAttempts < maxScrollAttempts do
        -- 🛑 中断チェック
        if INTERRUPTED then
            Utils.log("⚠️ ユーザーによる中断を検出 - tapInitialScreen終了")
            error("interrupted")
        end

        -- 複数のフォローボタンを検出して未処理のものを選択
        Utils.log("フォローボタンを検索中（複数検出）...")

        local results = {}

        -- followbtn.pngを検索（複数検出）
        local success1, result1 = pcall(findImage, "image/followbtn.png", 0, 0.95)  -- 0 = 全件取得
        if success1 and result1 and #result1 > 0 then
            for _, r in ipairs(result1) do
                table.insert(results, {x = r[1], y = r[2], type = "followbtn"})
            end
            Utils.log(string.format("followbtn.png: %d個検出", #result1))
        end

        -- followbtn_v2.pngを検索（複数検出）
        local success2, result2 = pcall(findImage, "image/followbtn_v2.png", 0, 0.95)  -- 0 = 全件取得
        if success2 and result2 and #result2 > 0 then
            for _, r in ipairs(result2) do
                table.insert(results, {x = r[1], y = r[2], type = "followbtn_v2"})
            end
            Utils.log(string.format("followbtn_v2.png: %d個検出", #result2))
        end

        if #results > 0 then
            Utils.log(string.format("合計 %d 個のフォローボタンを検出", #results))

            -- 🔍 未処理のユーザーを探す
            Utils.log("🔍 初期ユーザー選択開始")
            Utils.log(string.format("  📊 検出ボタン数: %d個", #results))
            Utils.log(string.format("  📊 処理済みユーザー数: %d人", #self.processedUsers))

            for i, result in ipairs(results) do
                -- 🛑 中断チェック
                if INTERRUPTED then
                    Utils.log("⚠️ ユーザーによる中断を検出 - ボタン検索ループ終了")
                    error("interrupted")
                end

                local x = result.x
                local y = result.y

                Utils.log(string.format("ボタン%d: タイプ=%s, 座標=(%d, %d)", i, result.type, x, y))

                -- 重複チェック
                local isProcessed, status = self:isUserProcessed(y)

                if not isProcessed then
                    -- 未処理ユーザーを選択
                    local offsetX = x + Config.COORDINATES.FOLLOW_TAB_OFFSET

                    Utils.log("🎯 新しい初期ユーザー選択!")
                    Utils.log(string.format("  📋 ボタンタイプ: %s", result.type))
                    Utils.log(string.format("  📍 フォローボタン位置: (%d, %d)", x, y))
                    Utils.log(string.format("  📍 フォロー中タブ位置: (%d, %d)", offsetX, y))
                    Utils.log(string.format("  🎯 選択理由: 未処理ユーザー"))

                    -- オフセットした位置をタップ
                    local coords = Utils.convertCoordinates(offsetX, y)
                    local success, err = pcall(touchDown, 2, coords[1], coords[2])
                    if not success then
                        if tostring(err):match("interrupted") then
                            INTERRUPTED = true
                            error("interrupted")
                        end
                        Utils.log("タップエラー: " .. tostring(err))
                        return false
                    end

                    Utils.wait(49274)
                    pcall(touchUp, 2, coords[1], coords[2])
                    Utils.wait(Config.TIMING.SCREEN_TRANSITION)

                    -- 最後にタップしたY座標を記録
                    self.lastTappedY = y
                    Utils.log(string.format("📝 初期ユーザーを選択: Y=%d", y))

                    Utils.log("✅ フォロー中タブをタップしました")
                    return true
                else
                    Utils.log(string.format("⏭️ ボタン%d スキップ: Y=%d は処理済み (ステータス=%s)", i, y, status or "不明"))
                end
            end

            -- すべてのボタンが処理済みの場合のみスクロール
            Utils.log(string.format("⚠️ 全%d個のボタンが既に処理済みです - スクロールします", #results))
            scrollAttempts = scrollAttempts + 1
            if scrollAttempts >= maxScrollAttempts then
                Utils.log("❌ 最大スクロール回数に達しました")
                return false
            end

            Utils.log("🚀 scrollInitialScreen()を呼び出し中...")
            local scrollResult = self:scrollInitialScreen()
            Utils.log(string.format("📋 スクロール結果: %s", scrollResult and "成功" or "失敗"))
            Utils.wait(1000000)  -- 1秒待機
            Utils.log("🔄 スクロール後の待機完了 - ループを継続します")
        else
            scrollAttempts = scrollAttempts + 1
            Utils.log(string.format("⚠️ フォローボタンが見つかりません - スクロール試行 %d/%d", scrollAttempts, maxScrollAttempts))

            if scrollAttempts >= maxScrollAttempts then
                -- 最大試行回数に達したらスクリプトを中断
                Utils.log("❌ 最大試行回数に達したらスクリプトを中断")
                self.isRunning = false
                error("未フォローのユーザーが表示されていません")
            end

            Utils.log("🚀 (ボタン未検出) scrollInitialScreen()を呼び出し中...")
            local scrollResult = self:scrollInitialScreen()
            Utils.log(string.format("📋 (ボタン未検出) スクロール結果: %s", scrollResult and "成功" or "失敗"))
            Utils.wait(1000000)  -- 1秒待機
            Utils.log("🔄 (ボタン未検出) スクロール後の待機完了 - ループを継続します")
        end
    end

    return false
end

-- OCRヘルパー関数：指定領域から数値を取得
function App:performOCR(region, regionName)
    -- 🛑 OCR開始時の中断チェック
    if INTERRUPTED then
        Utils.log("⚠️ ユーザーによる中断を検出 - OCR処理終了")
        error("interrupted")
    end

    -- 座標オフセットを1個のみに変更
    local offsets = {
        {x = 0, y = 0},      -- 元の座標のみ使用
    }

    local validResults = {}  -- 有効な結果を保存

    -- 座標でOCRを試行（1回のみ）
    for i, offset in ipairs(offsets) do
        -- 座標を実際のスクリーン座標に変換
        local coords = Utils.convertCoordinates(region.x + offset.x, region.y + offset.y)
        local x = math.floor(coords[1])
        local y = math.floor(coords[2])
        local width = math.floor(region.width)
        local height = math.floor(region.height)

        -- OCR用の領域指定（x, y, width, height）
        local ocrRegion = {x, y, width, height}

        if i == 1 then
            Utils.log(string.format("🔍 OCR実行 [%s]: x=%d, y=%d, w=%d, h=%d",
                regionName, x, y, width, height))
        end

        -- 画面の指定領域を直接OCR
        local success, ocrResult = pcall(function()
            return ocr({region = ocrRegion})
        end)

        if success then
            -- OCR結果からテキストを抽出
            local extractedText = self:getTextFromOCR(ocrResult)
            Utils.log(string.format("🔍 座標%d OCR結果: [%s]", i, extractedText or "nil"))
            if extractedText and extractedText ~= "" then
                -- 特殊文字チェック（#と=も含める）
                local hasSpecialChars = string.match(extractedText, "[‡÷%-+*/#†=]")
                if not hasSpecialChars then
                    -- 特殊文字がない場合は優先的に採用
                    table.insert(validResults, {text = extractedText, priority = 1})
                    Utils.log(string.format("✅ 座標%d: %s (特殊文字なし)", i, extractedText))
                else
                    -- 特殊文字がある場合は失敗として扱い、代替座標を試行
                    Utils.log(string.format("⚠️ 座標%d: %s (特殊文字検出 - 失敗扱い)", i, extractedText))
                    return false, nil  -- 特殊文字検出時は即座に失敗を返す
                end
            end
        elseif tostring(ocrResult):match("interrupted") then
            INTERRUPTED = true
            error("interrupted")
        else
            Utils.log(string.format("❌ 座標%d OCR失敗: %s", i, tostring(ocrResult)))
        end
    end

    -- 最も信頼性の高い結果を選択
    if #validResults > 0 then
        -- 優先度でソート
        table.sort(validResults, function(a, b) return a.priority < b.priority end)
        local text = validResults[1].text
        Utils.log(string.format("📝 OCR最終結果 [%s]: %s",
            regionName, text))

        -- 以降の処理を継続
        return self:processOCRResult(text, regionName)
    else
        Utils.log("❌ すべてのOCR試行が失敗しました")
        return false, nil
    end
end

-- OCR結果を処理する関数
function App:processOCRResult(text, regionName)
    if not text or text == "" then
        Utils.log("❌ OCRテキストが空です")
        return false, nil
    end

    Utils.log(string.format("📝 OCR結果 [%s]: %s", regionName, text))

    -- OCR結果が明らかにおかしい場合（特殊文字が多すぎる）
    local specialCharCount = 0
    for i = 1, #text do
        local char = string.sub(text, i, i)
        if not string.match(char, "[%w%d%.,KMkm ]") then
            specialCharCount = specialCharCount + 1
        end
    end

    -- 特殊文字が文字数の半分以上の場合は信頼性が低い
    if specialCharCount > #text / 2 then
        Utils.log(string.format("⚠️ OCR結果の信頼性が低い（特殊文字過多）: %s", text))
        -- まず数字だけを抽出してみる
        local numbersOnly = string.gsub(text, "[^%d]", "")
        if numbersOnly ~= "" then
            text = numbersOnly
            Utils.log(string.format("📝 数字のみ抽出: %s", text))
        else
            return false, nil
        end
    end

    -- 空白を削除
    text = string.gsub(text, " ", "")

    -- 「万」が「7」として認識される問題に対処
    -- 万を削除する前に、数値.数値7 のパターンをチェック
    if string.match(text, "%d+%.%d+7") then
        -- 例: "1.57" は実際は "1.5万" の可能性が高い
        text = string.gsub(text, "7$", "")  -- 末尾の7を削除
        Utils.log(string.format("⚠️ 「万」を「7」として誤認識: %s → %s万として処理", text .. "7", text))
    end

    -- OCR誤認識パターンの補正
    -- RAQなどの文字列が含まれる場合、数字の誤認識の可能性
    if string.match(text, "RAQ") then
        -- RAQ → 568 のような誤認識を想定
        text = string.gsub(text, "R", "5")
        text = string.gsub(text, "A", "6")
        text = string.gsub(text, "Q", "8")
        Utils.log(string.format("⚠️ 文字誤認識を補正: RAQ → %s", text))
    end

    -- その他の一般的な誤認識パターン
    text = string.gsub(text, "O", "0")  -- Oを0に
    text = string.gsub(text, "o", "0")  -- oを0に
    text = string.gsub(text, "l", "1")  -- lを1に
    text = string.gsub(text, "I", "1")  -- Iを1に
    text = string.gsub(text, "S", "5")  -- Sを5に
    text = string.gsub(text, "G", "6")  -- Gを6に
    text = string.gsub(text, "B", "8")  -- Bを8に
    text = string.gsub(text, "Z", "2")  -- Zを2に

    -- 特殊文字の処理（‡, ÷, - など）
    -- まず特殊文字が含まれているかチェック
    if string.match(text, "[‡÷%-+*/]") then
        Utils.log(string.format("⚠️ 特殊文字を検出: %s - 数字のみ抽出を試みます", text))

        -- 特殊文字を含む場合でも数字を抽出
        -- よくあるパターン：7÷0 → 730、#41g → 416、7*0 → 730
        local numbersOnly = string.gsub(text, "[^%d]", "")

        if numbersOnly ~= "" and #numbersOnly >= 1 then
            Utils.log(string.format("📝 特殊文字から数字を抽出: %s → %s", text, numbersOnly))
            text = numbersOnly
        else
            -- 数字が全く抽出できない場合のみスキップ
            Utils.log(string.format("❌ 数字を抽出できません: %s", text))
            return false, nil
        end
    end

    -- 数字とK,M表記のみを抽出（それ以外は全て削除）
    text = string.gsub(text, "[^%d,%.KMkm]", "")

    -- 数字が含まれているか確認
    if not string.match(text, "%d") then
        Utils.log(string.format("⚠️ 数字が検出されませんでした [%s]", regionName))
        return false, nil
    end

    if text ~= "" then
        return true, text
    end

    return false, nil
end

-- 数値抽出ヘルパー関数
function App:extractNumber(ocrText)
    if not ocrText or ocrText == "" then
        return nil
    end

    -- 日本語の「万」表記の処理（performOCRで既に7が削除されている場合）
    -- 例: "1.5" (元は "1.57" で万が7として認識されたもの)
    if string.match(ocrText, "^%d+%.%d$") or string.match(ocrText, "^%d+%.%d%d$") then
        -- X.X または X.XX 形式で、かつ3桁目がない場合は「万」の可能性
        local num = tonumber(ocrText)
        if num and num < 100 then  -- 100未満の場合は万の可能性が高い
            local result = math.floor(num * 10000)
            Utils.log(string.format("📊 日本語「万」表記として処理: %s万 → %d", ocrText, result))
            return result
        end
    end

    -- 小数点をカンマの代わりとして認識しているケースの処理
    -- 例: "2.675" は実際は "2,675"（2675）
    -- 例: "1.432" は実際は "1,432"（1432）
    if string.match(ocrText, "^%d+%.%d%d%d$") then
        -- X.XXX形式の場合、小数点をカンマとして扱い、数値に変換
        local cleanedText = string.gsub(ocrText, "%.", "")
        local num = tonumber(cleanedText)
        if num then
            Utils.log(string.format("📊 小数点をカンマとして処理: %s → %d", ocrText, num))
            return num
        end
    end

    -- 単一数字の処理（全て実数として扱う）
    -- カンマや小数点の処理で1000〜9999の問題は既に解決済み
    if string.match(ocrText, "^[0-9]$") then
        local singleNum = tonumber(ocrText)
        Utils.log(string.format("📊 単一数字検出: %s (実数として処理)", ocrText))
        return singleNum
    end

    -- カンマを削除
    local cleanText = string.gsub(ocrText, ",", "")

    -- 小数点も削除（カンマの誤認識として）
    cleanText = string.gsub(cleanText, "%.", "")

    -- まず単純な数字を探す
    local simpleNum = string.match(cleanText, "(%d+)")
    if simpleNum then
        local num = tonumber(simpleNum)
        -- 妥当な範囲の数値かチェック
        if num and num >= 0 then
            return num
        end
    end

    -- K（千）やM（百万）表記も処理
    for match in string.gmatch(ocrText, "([%d,%.]+[KMkm]?)") do
        local numValue = 0
        local cleanNumber = match

        if string.match(cleanNumber, "[Kk]$") then
            cleanNumber = string.gsub(cleanNumber, "[Kk]$", "")
            numValue = tonumber(string.gsub(cleanNumber, ",", "")) * 1000
        elseif string.match(cleanNumber, "[Mm]$") then
            cleanNumber = string.gsub(cleanNumber, "[Mm]$", "")
            numValue = tonumber(string.gsub(cleanNumber, ",", "")) * 1000000
        else
            cleanNumber = string.gsub(cleanNumber, ",", "")
            numValue = tonumber(cleanNumber)
        end

        if numValue and numValue >= 0 then
            return math.floor(numValue)
        end
    end

    return nil
end

-- OCR結果からテキストを抽出するヘルパー関数
function App:getTextFromOCR(ocrResult)
    if not ocrResult then return "" end

    if type(ocrResult) == "table" then
        if ocrResult.text then
            return ocrResult.text
        elseif ocrResult[1] then
            if type(ocrResult[1]) == "table" and ocrResult[1].text then
                return ocrResult[1].text
            else
                return tostring(ocrResult[1])
            end
        else
            local text = ""
            for k, v in pairs(ocrResult) do
                if type(v) == "string" then
                    text = text .. v .. " "
                elseif type(v) == "table" and v.text then
                    text = text .. v.text .. " "
                end
            end
            return text
        end
    elseif type(ocrResult) == "string" then
        return ocrResult
    else
        return tostring(ocrResult)
    end
end

function App:checkProfileStats()
    Utils.log("プロフィール統計情報をチェック中...")

    -- プロフィール画面を確実に読み込むため3秒待機（OCR精度向上のため）
    Utils.log("📱 プロフィール画面の読み込み待機中...")
    Utils.wait(3000000)  -- 3秒待機（マイクロ秒）

    local maxRetries = 3  -- 最大リトライ回数
    local success1, postsResult, success2, followersResult, success3, followingResult

    -- 投稿数のOCR（3座標で試行、リトライ付き）
    for i = 1, maxRetries do
        -- メイン座標で試行
        success1, postsResult = self:performOCR(Config.COORDINATES.POSTS_REGION, "投稿数")
        if success1 and postsResult then
            Utils.log("✅ 投稿数OCR成功 (メイン座標)")
            break
        end

        -- 代替座標で試行
        success1, postsResult = self:performOCR(Config.COORDINATES.POSTS_REGION_ALT, "投稿数ALT")
        if success1 and postsResult then
            Utils.log("✅ 投稿数OCR成功 (代替座標)")
            break
        end

        -- 追加対策座標で試行
        success1, postsResult = self:performOCR(Config.COORDINATES.POSTS_REGION_ALT2, "投稿数ALT2")
        if success1 and postsResult then
            Utils.log("✅ 投稿数OCR成功 (追加対策座標)")
            break
        end

        if i < maxRetries then
            Utils.log(string.format("⚠️ 投稿数OCRリトライ中... (%d/%d)", i, maxRetries))
            Utils.wait(500000)  -- 0.5秒待機
        end
    end

    -- フォロワー数のOCR（3座標で試行、リトライ付き）
    for i = 1, maxRetries do
        -- メイン座標で試行
        success2, followersResult = self:performOCR(Config.COORDINATES.FOLLOWERS_REGION, "フォロワー")
        if success2 and followersResult then
            Utils.log("✅ フォロワー数OCR成功 (メイン座標)")
            break
        end

        -- 代替座標で試行
        success2, followersResult = self:performOCR(Config.COORDINATES.FOLLOWERS_REGION_ALT, "フォロワーALT")
        if success2 and followersResult then
            Utils.log("✅ フォロワー数OCR成功 (代替座標)")
            break
        end

        -- 特殊文字対策座標で試行
        success2, followersResult = self:performOCR(Config.COORDINATES.FOLLOWERS_REGION_ALT2, "フォロワーALT2")
        if success2 and followersResult then
            Utils.log("✅ フォロワー数OCR成功 (特殊文字対策座標)")
            break
        end

        if i < maxRetries then
            Utils.log(string.format("⚠️ フォロワー数OCRリトライ中... (%d/%d)", i, maxRetries))
            Utils.wait(500000)  -- 0.5秒待機
        end
    end

    -- フォロー中数のOCR（3座標で試行、リトライ付き）
    for i = 1, maxRetries do
        -- メイン座標で試行
        success3, followingResult = self:performOCR(Config.COORDINATES.FOLLOWING_REGION, "フォロー中")
        if success3 and followingResult then
            Utils.log("✅ フォロー中数OCR成功 (メイン座標)")
            break
        end

        -- 特殊文字対策座標で試行
        success3, followingResult = self:performOCR(Config.COORDINATES.FOLLOWING_REGION_ALT, "フォロー中ALT")
        if success3 and followingResult then
            Utils.log("✅ フォロー中数OCR成功 (特殊文字対策座標)")
            break
        end

        -- 追加対策座標で試行
        success3, followingResult = self:performOCR(Config.COORDINATES.FOLLOWING_REGION_ALT2, "フォロー中ALT2")
        if success3 and followingResult then
            Utils.log("✅ フォロー中数OCR成功 (追加対策座標)")
            break
        end

        if i < maxRetries then
            Utils.log(string.format("⚠️ フォロー中数OCRリトライ中... (%d/%d)", i, maxRetries))
            Utils.wait(500000)  -- 0.5秒待機
        end
    end

    -- 成功した項目数をカウント
    local successCount = 0
    if success1 and postsResult then successCount = successCount + 1 end
    if success2 and followersResult then successCount = successCount + 1 end
    if success3 and followingResult then successCount = successCount + 1 end

    if successCount > 0 then
        Utils.log(string.format("📊 OCR結果: %d/3項目を取得", successCount))
    else
        Utils.log("❌ すべてのOCRが失敗しました")
    end

    -- performOCRが直接文字列を返すため、getTextFromOCRは不要

    -- 各統計の数値を取得
    local postCount = nil
    local followerCount = nil
    local followingCount = nil

    -- 投稿数を抽出
    if success1 and postsResult then
        -- performOCRは既に数字のみを返す
        local postsText = postsResult
        Utils.log("🔍 投稿数OCR結果: [" .. tostring(postsText) .. "]")

        postCount = self:extractNumber(postsText)

        if postCount then
            Utils.log(string.format("📸 投稿数: %d", postCount))
        else
            Utils.log("⚠️ 投稿数を数値に変換できませんでした")
        end
    else
        Utils.log("❌ 投稿数OCRが失敗しました")
    end

    -- フォロワー数を抽出
    if success2 and followersResult then
        -- performOCRは既に数字のみを返す
        local followersText = followersResult
        Utils.log("🔍 フォロワー数OCR結果: [" .. tostring(followersText) .. "]")

        followerCount = self:extractNumber(followersText)

        if followerCount then
            Utils.log(string.format("👥 フォロワー数: %d", followerCount))
        else
            Utils.log("⚠️ フォロワー数を数値に変換できませんでした")
            -- フォロワー数が取得できない場合はデフォルト値を設定
            followerCount = 0
            Utils.log("📝 フォロワー数をデフォルト値(0)に設定")
        end
    else
        Utils.log("❌ フォロワー数OCRが失敗しました（リトライ後も失敗）")
        -- OCR失敗時はデフォルト値を設定
        followerCount = 0
        Utils.log("📝 フォロワー数をデフォルト値(0)に設定")
    end

    -- フォロー中数を抽出
    if success3 and followingResult then
        -- performOCRは既に数字のみを返す
        local followingText = followingResult
        Utils.log("🔍 フォロー中数OCR結果: [" .. tostring(followingText) .. "]")

        followingCount = self:extractNumber(followingText)

        if followingCount then
            Utils.log(string.format("📋 フォロー中: %d", followingCount))
        else
            Utils.log("⚠️ フォロー中数を数値に変換できませんでした")
            -- フォロー中数が取得できない場合はデフォルト値を設定
            followingCount = 0
            Utils.log("📝 フォロー中数をデフォルト値(0)に設定")
        end
    else
        Utils.log("❌ フォロー中数OCRが失敗しました（リトライ後も失敗）")
        -- OCR失敗時はデフォルト値を設定
        followingCount = 0
        Utils.log("📝 フォロー中数をデフォルト値(0)に設定")
    end

    -- 統計情報が取得できなかった場合のフォールバック
    if not postCount and not followerCount and not followingCount then
        Utils.log("⚠️ 統計情報を取得できませんでした - OCR精度の問題の可能性があります")

        -- OCRが完全に失敗した場合、条件チェックをスキップするか決定
        if Config.PROFILE_CHECK.minFollowers == 0 and Config.PROFILE_CHECK.minFollowing == 0 then
            -- フィルター無効の場合は処理を続行
            Utils.log("📝 フィルター無効のため処理を続行します")
            return true
        else
            -- フィルター有効の場合はデフォルトで続行
            Utils.log("📝 OCR失敗 - デフォルトで処理を続行します")
            toast("⚠️ OCR不正確 - 統計チェックなしで続行", 2)
            return true  -- OCRが失敗しても処理は続行
        end
    end

    -- すべての値が同じ値の場合は誤認識と判断（0の場合は正常な可能性もある）
    if postCount and followerCount and followingCount and
       postCount == followerCount and followerCount == followingCount and
       postCount > 100 then  -- 100以上で全部同じは異常
        Utils.log(string.format("⚠️ すべての値が同じ (%d) - OCR誤認識の可能性が高いです", postCount))
        Utils.log("📝 デフォルト動作: 処理を続行します")
        return true  -- 誤認識の場合も処理を続行
    end

    -- デフォルト値を設定
    postCount = postCount or 0
    followerCount = followerCount or 0
    followingCount = followingCount or 0

    -- 統計サマリーをわかりやすく表示
    Utils.log("┏━━━━━━━━━━━━━━━━━━━━━━━━")
    Utils.log(string.format("┃ 📊 プロフィール統計"))
    Utils.log(string.format("┃ 📸 投稿数: %s", postCount > 0 and tostring(postCount) or "0 (投稿なし)"))
    Utils.log(string.format("┃ 👥 フォロワー: %s",
        followerCount >= 1000000 and string.format("%.1fM", followerCount/1000000) or
        followerCount >= 1000 and string.format("%.1fK", followerCount/1000) or
        tostring(followerCount)))
    Utils.log(string.format("┃ 📋 フォロー中: %s",
        followingCount >= 1000 and string.format("%.1fK", followingCount/1000) or
        tostring(followingCount)))
    Utils.log("┗━━━━━━━━━━━━━━━━━━━━━━━━")

    -- 条件チェック結果を収集
    local skipReasons = {}
    local passedChecks = {}

    -- 投稿数チェック
    if postCount < Config.PROFILE_CHECK.minPosts then
        table.insert(skipReasons, string.format("投稿数不足 (%d < %d)", postCount, Config.PROFILE_CHECK.minPosts))
    else
        table.insert(passedChecks, string.format("投稿数OK (%d ≥ %d)", postCount, Config.PROFILE_CHECK.minPosts))
    end

    -- フォロワー数チェック（0の場合も含めて常にチェック）
    if followerCount < Config.PROFILE_CHECK.minFollowers then
        table.insert(skipReasons, string.format("フォロワー不足 (%d < %d)",
            followerCount, Config.PROFILE_CHECK.minFollowers))
    else
        table.insert(passedChecks, string.format("フォロワーOK (%d ≥ %d)",
            followerCount, Config.PROFILE_CHECK.minFollowers))
    end

    -- フォロー中数チェック（0の場合も含めて常にチェック）
    if followingCount < Config.PROFILE_CHECK.minFollowing then
        table.insert(skipReasons, string.format("フォロー中不足 (%d < %d)",
            followingCount, Config.PROFILE_CHECK.minFollowing))
    else
        table.insert(passedChecks, string.format("フォロー中OK (%d ≥ %d)",
            followingCount, Config.PROFILE_CHECK.minFollowing))
    end

    -- 結果表示
    if #skipReasons > 0 then
        Utils.log("❌ スキップ理由:")
        for _, reason in ipairs(skipReasons) do
            Utils.log("  ・" .. reason)
        end

        -- トースト表示
        toast(string.format("⏭️ スキップ: %s", skipReasons[1]), 1)
        return false
    else
        Utils.log("✅ すべての条件をクリア:")
        for _, check in ipairs(passedChecks) do
            Utils.log("  ・" .. check)
        end

        -- 全条件クリア時のトースト表示
        toast(string.format("✅ 条件クリア 📸%d 👥%d 📋%d",
            postCount, followerCount, followingCount), 2)

        return true
    end
end

function App:selectNextUserAfterSkip()
    -- 初期画面に戻った後、フォローボタンを検出して適切に処理
    Utils.log("🔍 初期画面でフォローボタンを検出中...")
    local waitCount = 0
    local maxWait = 10

    while waitCount < maxWait do
        -- followbtn.png、followbtn_v2.png、followedbtn.png のいずれかを検出
        local btn1 = ImageDetection.findButton("image/followbtn.png")
        local btn2 = ImageDetection.findButton("image/followbtn_v2.png")
        local btn3 = ImageDetection.findButton("image/followedbtn.png")

        if btn1 or btn2 then
            -- フォローボタンが見つかった場合、履歴にない新しいボタンを選択
            Utils.log("✅ フォローボタンを検出 - 新しいユーザーを選択します")

            local allButtons = {}
            if btn1 then
                for _, button in ipairs(btn1) do
                    table.insert(allButtons, {x = button[1], y = button[2]})
                end
            end
            if btn2 then
                for _, button in ipairs(btn2) do
                    table.insert(allButtons, {x = button[1], y = button[2]})
                end
            end

            -- 処理済みでないユーザーを選択
            for _, button in ipairs(allButtons) do
                -- 新しい座標管理システムで処理済みかチェック
                local isProcessed, status = self:isUserProcessed(button.y)

                if not isProcessed then
                    -- 新しいユーザーのフォロー中タブをタップ
                    local offsetX = button.x - 300
                    Utils.log(string.format("✅ 新しいユーザーを選択: X=%d→%d, Y=%d",
                        button.x, offsetX, button.y))
                    Touch.tap(offsetX, button.y)

                    -- 最後にタップしたY座標を記録
                    self.lastTappedY = button.y

                    Utils.wait(Config.TIMING.SCREEN_TRANSITION)
                    -- 再度この関数を呼び出して投稿ボタンを検索
                    return self:detectAndTapProfileButton()
                end
            end

            -- すべてのボタンが既に処理済みの場合
            Utils.log("⚠️ すべてのボタンが既に処理済み - スクロールします")
            break
        elseif btn3 then
            -- followedbtn（フォロー中）のみの場合
            Utils.log("📱 フォロー中ボタンのみ検出 - スクロールが必要")
            break
        end

        waitCount = waitCount + 1
        Utils.log(string.format("⏳ フォローボタン検出待機中... (%d/%d)", waitCount, maxWait))
        Utils.wait(500000)  -- 0.5秒待機
    end

    -- スクロールして新しいユーザーを表示
    Utils.log("📜 画面をスクロールして新しいユーザーを表示...")
    self:scrollInitialScreen()
    Utils.wait(Config.TIMING.SCREEN_TRANSITION)

    -- スクロール後に新しいフォローボタンを探して再度試行
    Utils.log("🔄 スクロール完了 - 新しいユーザーを検索中...")
    return self:findAndTapNextFollowButton()  -- 新しいボタンを探してタップ
end

function App:detectAndTapProfileButton()
    Utils.log("投稿ボタンを検索中...")

    -- プロフィール統計情報をチェック
    local statsCheck = self:checkProfileStats()
    if not statsCheck then
        Utils.log("📊 プロフィール統計が条件を満たさないため、次のユーザーへ移動")

        -- スキップしたユーザーを処理済みとして記録
        if self.lastTappedY then
            self:addProcessedUser(self.lastTappedY, "skipped")
        end

        self:tapBackButton()
        Utils.wait(Config.TIMING.SCREEN_TRANSITION)

        -- 初期画面で新しいユーザーを選択（共通関数を使用）
        return self:selectNextUserAfterSkip()
    end

    -- 統計チェックをパスした後、非公開アカウントかどうかを確認
    Utils.log("🔒 非公開アカウントチェック中...")

    -- 一度スクロールしてlock.pngを検出
    self:complexSwipePattern()
    Utils.wait(1000000)  -- 1秒待機

    -- lock.pngを検出
    local lockSuccess, lockResult = pcall(findImage, "image/lock.png", 1, 0.95, nil, nil)

    -- デバッグログ
    Utils.log(string.format("🔍 lock.png検出結果: success=%s, result=%s",
        tostring(lockSuccess), tostring(lockResult)))

    if lockSuccess and lockResult and #lockResult > 0 then
        Utils.log("❌ 非公開アカウントを検出しました（lock.png発見） - スキップします")
        toast("🔒 非公開アカウント - スキップ", 2)

        -- 非公開アカウントを処理済みとして記録
        if self.lastTappedY then
            self:addProcessedUser(self.lastTappedY, "private")
        end

        -- 戻るボタンを1回タップして初期画面に戻る
        self:tapBackButton()
        Utils.wait(Config.TIMING.SCREEN_TRANSITION)

        -- 初期画面で新しいユーザーを選択
        return self:selectNextUserAfterSkip()
    end

    Utils.log("✅ 公開アカウントです - 投稿ボタンを検索します")

    -- スクロール後の画面で投稿ボタン（黒）を検出
    local postImage = "image/post.png"  -- 黒い投稿ボタン
    Utils.log("📸 スクロール後の画面で投稿ボタン（黒）を検出中...")

    local postResult = ImageDetection.findButton(postImage)
    if postResult then
        -- 投稿ボタンが見つかった場合はタップして最新投稿へ移動
        local postX = postResult[1][1]
        local postY = postResult[1][2]
        Utils.log(string.format("✅ 投稿ボタンを検出 - タップして最新投稿へ移動: (%d, %d)", postX, postY))

        -- 投稿ボタンをタップ
        local success, err = pcall(touchDown, 5, postX, postY)
        if not success then
            if tostring(err):match("interrupted") then
                INTERRUPTED = true
                error("interrupted")
            end
            Utils.log("タップエラー: " .. tostring(err))
            return false
        end

        Utils.wait(50000)
        pcall(touchUp, 5, postX, postY)

        Utils.log("✅ 最新の投稿をタップしました")
        Utils.wait(Config.TIMING.SCREEN_TRANSITION)

        -- 最新投稿へ移動後、さらにタップして個別投稿画面へ
        Utils.log("📸 個別投稿画面へ遷移中...")
        local success2, err2 = pcall(touchDown, 3, 137.54, 404.64)
        if success2 then
            Utils.wait(50000)
            pcall(touchUp, 3, 137.54, 404.64)
            Utils.wait(Config.TIMING.SCREEN_TRANSITION)
            Utils.log("✅ 個別投稿画面へ遷移しました")
        else
            Utils.log("⚠️ 個別投稿画面への遷移に失敗: " .. tostring(err2))
        end

        -- いいねループを開始
        self:executeLikeLoop()

        return true
    else
        -- 投稿ボタンが見つからない場合のみエラー画像をチェック
        local errorImages = {
            "image/private.png",    -- グレーの非公開アイコン
            "image/noimage.png",    -- 画像なし
            "image/nopost.png",     -- 投稿なし
            "image/new.png",        -- 新規アカウント
            "image/lock.png"        -- ロック
        }

        Utils.log("⚠️ 投稿ボタンが見つからないため、エラー画像をチェック中...")
        for _, imagePath in ipairs(errorImages) do
            local errorResult = ImageDetection.findButton(imagePath)
            if errorResult then
                if imagePath == "image/private.png" then
                    Utils.log("🔒 非公開アカウント（グレー）を検出 - 戻るボタンをタップして次のユーザーへ")
                else
                    Utils.log("⚠️ エラー画像を検出: " .. imagePath .. " - 戻るボタンをタップして次のユーザーへ")
                end

                self:tapBackButton()
                Utils.wait(Config.TIMING.SCREEN_TRANSITION)

                -- 初期画面に戻った後、必ずフォローボタンを検出してから次の処理へ
                Utils.log("🔍 フォローボタンを検出中...")
                local waitCount = 0
                local maxWait = 10

                while waitCount < maxWait do
                    -- followbtn.png、followbtn_v2.png、followedbtn.png のいずれかを検出
                    local btn1 = ImageDetection.findButton("image/followbtn.png")
                    local btn2 = ImageDetection.findButton("image/followbtn_v2.png")
                    local btn3 = ImageDetection.findButton("image/followedbtn.png")

                    if btn1 or btn2 or btn3 then
                        Utils.log("✅ フォローボタンを検出しました")
                        break
                    end

                    waitCount = waitCount + 1
                    Utils.log(string.format("⏳ フォローボタン検出待機中... (%d/%d)", waitCount, maxWait))
                    Utils.wait(500000)  -- 0.5秒待機
                end

                -- 戻った後、フォローボタンを探して次のユーザーへ
                Utils.log("次のフォローボタンを検索中...")
                local nextFollowBtn = self:findAndTapNextFollowButton()
                if nextFollowBtn then
                    Utils.log("✅ 次のユーザーを検出 - 続行します")
                    Utils.wait(Config.TIMING.SCREEN_TRANSITION)
                    -- 再度この関数を呼び出して投稿ボタンを検索
                    return self:detectAndTapProfileButton()
                else
                    Utils.log("⚠️ 次のフォローボタンが見つかりません")
                    return false
                end
            end
        end
    end

    -- 投稿ボタン（黒）が既に見つかっている場合は処理を続行
    if postResult then
        -- 検出した画像をタップ
        local x = postResult[1][1]
        local y = postResult[1][2]
        Utils.log(string.format("投稿ボタン（黒）をタップ - 位置: (%d, %d)", x, y))

        -- 投稿ボタンをタップ
        local success, err = pcall(touchDown, 5, x, y)
        if not success then
            if tostring(err):match("interrupted") then
                INTERRUPTED = true
                error("interrupted")
            end
            Utils.log("タップエラー: " .. tostring(err))
            return false
        end

        Utils.wait(64550)
        pcall(touchUp, 5, x, y)

        Utils.wait(Config.TIMING.SCREEN_TRANSITION)

        -- 投稿ボタンタップ後、最新投稿へ移動する新規動作
        Utils.log("投稿ボタンタップ後、最新投稿へ移動...")

        local success2, err2 = pcall(touchDown, 3, 137.54, 404.64)
        if not success2 then
            if tostring(err2):match("interrupted") then
                INTERRUPTED = true
                error("interrupted")
            end
            Utils.log("タップエラー: " .. tostring(err2))
        end

        Utils.wait(64353)
        pcall(touchUp, 3, 137.54, 404.64)

        Utils.wait(Config.TIMING.SCREEN_TRANSITION)

        -- ステップ3: いいねループ実行（最新投稿タップ後のみ）
        Utils.log("いいねループを開始...")
        self:executeLikeLoop()

        return true
    end

    Utils.log("⚠️ 投稿ボタンが見つかりません")
    return false
end

function App:executeLikeLoop()
    -- いいねループ処理（最新投稿タップ後のみ実行）
    -- 最初のスクロールを実行
    Utils.log("最初のスクロールを実行中...")
    self:complexSwipePattern()
    Utils.wait(Config.TIMING.SCREEN_TRANSITION)

    local attempts = 0
    local maxAttempts = Config.DEFAULT.maxAttempts

    while self.isRunning and self.processedCount < self.likeCount and attempts < maxAttempts do
        if INTERRUPTED then
            Utils.log("⚠️ ユーザーによる中断")
            break
        end

        attempts = attempts + 1

        -- いいね実行
        local liked = self:performLike()

        if liked then
            -- ステップ1: いいね成功
            self.consecutiveScrolls = 0  -- 連続スクロールカウンタをリセット

            -- ステップ2-3: フォロー処理判定と戻る処理
            self:handlePostLikeActions()

            -- 目標達成チェック
            if self.processedCount >= self.likeCount then
                Utils.log("🎯 目標いいね数に到達!")
                break
            end

            -- ステップ4: 次のユーザーまたは投稿へ
            Utils.wait(Config.TIMING.BETWEEN_LIKES)

            -- 戻った後は新しいユーザーを探す
            Utils.log("🔍 次のユーザーを探しています...")
            local nextUser = self:findAndTapNextFollowButton()
            if nextUser then
                Utils.log("✅ 次のユーザーが見つかりました - 続行")
                -- 次のループで投稿ボタンを検索
            else
                Utils.log("⚠️ 新しいユーザーが見つかりません - スクロールします")
                self:scrollInitialScreen()
                Utils.wait(Config.TIMING.SCREEN_TRANSITION)
            end
        else
            -- いいねボタンが見つからない - スクロール
            self.consecutiveScrolls = self.consecutiveScrolls + 1
            Utils.log(string.format("連続スクロール: %d/%d", self.consecutiveScrolls, self.maxConsecutiveScrolls))

            -- スクロール中の状態表示
            toast(string.format("🔍 探索中... %d/%d いいね\n連続スクロール: %d/%d",
                self.processedCount,
                self.likeCount,
                self.consecutiveScrolls,
                self.maxConsecutiveScrolls
            ), 1)

            -- 連続スクロール上限チェック
            if self.consecutiveScrolls >= self.maxConsecutiveScrolls then
                Utils.log("⚠️ 連続スクロール上限に到達 - いいねループを終了します")
                break
            end

            self:scrollToNextPost()
        end
    end
end

function App:updateProgressBar()
    -- プログレスバーの更新
    local loopProgress = math.floor((self.currentLoop / self.loopCount) * 100)
    local likeProgress = math.floor((self.processedCount / self.likeCount) * 100)

    -- プログレスバーを生成
    local filled = math.floor(loopProgress / 10)
    local progressBar = string.rep("█", filled) .. string.rep("░", 10 - filled)

    -- 現在の合計いいね数を計算（過去のループ分 + 現在のループ分）
    local currentTotal = self.totalProcessedCount + self.processedCount

    -- プログレス表示（最初のループ開始時はtoastを表示しない）
    if not (self.currentLoop == 1 and self.processedCount == 0) then
        toast(string.format("📊 進捗状況\n[%s] %d/%d ループ (%d%%)\n💗 現在: %d/%d | 合計: %d",
            progressBar,
            self.currentLoop,
            self.loopCount,
            loopProgress,
            self.processedCount,
            self.likeCount,
            currentTotal
        ), 1)
    end
end

function App:performLike()
    -- ハートボタンを検索していいねを実行
    local heartImage = "image/heart_empty.png"

    local result = ImageDetection.findButton(heartImage)
    if result then
        local x = result[1][1]
        local y = result[1][2]

        Utils.log(string.format("いいねを実行: (%d, %d)", x, y))

        -- ハートボタンをタップ
        local success, err = pcall(touchDown, 4, x, y)
        if not success then
            if tostring(err):match("interrupted") then
                INTERRUPTED = true
                error("interrupted")
            end
            return false
        end

        Utils.wait(50000)
        pcall(touchUp, 4, x, y)

        self.processedCount = self.processedCount + 1
        -- totalProcessedCountは runSingleLoop() の最後でまとめて更新するため、ここでは更新しない
        Utils.log(string.format("✅ いいね完了 (%d/%d)", self.processedCount, self.likeCount))

        -- プログレスバー更新
        self:updateProgressBar()

        return true
    end

    Utils.log("❌ ハートボタンが見つかりません")
    return false
end

function App:complexSwipePattern()
    Utils.log("複雑なスクロールパターンを実行中...")

    local swipeData = {
        -- touchDown(id, x, y) + 待機時間
        {6, 579.91, 1158.07, 33008.75},
        -- touchMove(id, x, y) + 待機時間
        {6, 569.64, 1141.77, 17062.17},
        {6, 565.54, 1126.50, 16527.71},
        {6, 559.39, 1109.20, 16746.83},
        {6, 553.22, 1090.88, 16814.08},
        {6, 545.01, 1068.47, 16541.21},
        {6, 537.83, 1044.04, 16520.46},
        {6, 528.59, 1017.56, 16794.50},
        {6, 518.33, 992.11, 16766.04},
        {6, 508.06, 964.61, 16394.29},
        {6, 496.78, 938.15, 16835.62},
        {6, 483.43, 906.58, 16703.29},
        {6, 471.11, 877.07, 16608.46},
        {6, 456.75, 845.49, 16758.50},
        {6, 441.34, 813.92, 16621.33},
        {6, 426.98, 780.34, 16279.46},
        {6, 408.50, 749.78, 16924.92},
        {6, 392.07, 719.25, 16667.50},
        {6, 375.65, 687.68, 16551.25},
        {6, 359.23, 656.13, 16794.75},
        {6, 341.79, 624.56, 16565.58},
        {6, 324.34, 595.04, 16522.62},
        {6, 307.91, 565.51, 16960.29},
        {6, 291.49, 540.06, 16630.00},
        {6, 273.02, 512.56, 16532.58},
        {6, 258.65, 491.19, 16831.25},
        {6, 243.26, 467.76, 16643.29},
        {6, 228.88, 445.37, 16518.46},
        {6, 214.51, 426.01, 16744.29},
        {6, 201.16, 406.68, 16848.62},
        {6, 191.93, 390.39, 16507.25},
        {6, 181.66, 375.13, 16916.29},
        {6, 173.46, 358.82, 16582.08},
        {6, 166.27, 344.57, 16350.54},
        {6, 161.14, 332.36, 16766.83},
        {6, 156.01, 322.18, 16711.42},
        {6, 152.93, 314.02, 16502.04},
        {6, 149.85, 308.93, 17097.54},
        {6, 148.82, 304.86, 16475.71},
        {6, 147.80, 303.84, 16613.38},
        {6, 146.77, 302.82, 264906.75}
    }

    -- 最初のタッチダウン
    local firstData = swipeData[1]
    local coords = Utils.convertCoordinates(firstData[2], firstData[3])
    local success, err = pcall(touchDown, firstData[1], coords[1], coords[2])
    if not success then
        if tostring(err):match("interrupted") then
            INTERRUPTED = true
            error("interrupted")
        end
        Utils.log("スワイプ開始エラー: " .. tostring(err))
        return false
    end
    Utils.wait(firstData[4])

    -- タッチムーブ
    for i = 2, #swipeData do
        if INTERRUPTED then
            pcall(touchUp, swipeData[1][1], coords[1], coords[2])
            error("interrupted")
        end

        local data = swipeData[i]
        coords = Utils.convertCoordinates(data[2], data[3])
        pcall(touchMove, data[1], coords[1], coords[2])
        Utils.wait(data[4])
    end

    -- 最後のタッチアップ (touchUp(6, 142.66, 299.77))
    coords = Utils.convertCoordinates(142.66, 299.77)
    pcall(touchUp, 6, coords[1], coords[2])

    return true
end

function App:handleFollowDialog()
    -- フォロー確認ダイアログのチェック
    Utils.log("フォロー確認ダイアログをチェック中...")

    local success, result = pcall(
        findImage,
        "image/follow_dialog.png",
        1,
        0.95,
        nil  -- 全画面検索
    )

    if success and result and #result > 0 then
        Utils.log("💬 フォロー確認ダイアログが表示されました")

        -- 検出された画像の位置を取得
        local dialogX = result[1][1]
        local dialogY = result[1][2]

        Utils.log(string.format("🔵 ダイアログを検出した位置をタップ: (%d, %d)", dialogX, dialogY))

        -- ダイアログの位置をタップ
        local tapSuccess, tapErr = pcall(touchDown, 8, dialogX, dialogY)
        if not tapSuccess then
            if tostring(tapErr):match("interrupted") then
                INTERRUPTED = true
                error("interrupted")
            end
            Utils.log("ダイアログタップエラー: " .. tostring(tapErr))
            return false
        end

        Utils.wait(101398)
        pcall(touchUp, 8, dialogX, dialogY)

        Utils.log("✅ ダイアログ処理完了")
        Utils.wait(5000000)  -- 5秒待機
        return true
    end

    return false
end

-- ステップ2-3: いいね後のフォロー処理判定と戻る処理
function App:handlePostLikeActions()
    Utils.log("🎬 ===== いいね後の処理開始 =====")
    Utils.log(string.format("  🎯 現在のユーザーY座標: %s", self.lastTappedY and tostring(self.lastTappedY) or "未設定"))
    Utils.log(string.format("  👤 フォロー機能: %s", self.followEnabled and "有効" or "無効"))
    Utils.wait(500000)  -- 0.5秒待機

    -- ステップ2: フォロー処理判定
    if self.followEnabled then
        Utils.log("👤 フォロー機能が有効 - フォローボタンを検索中...")
        local followButtonImage = "image/post_follow.png"
        local followResult = ImageDetection.findButton(followButtonImage)

        if followResult then
            Utils.log("📱 投稿画面でフォローボタンを検出")
            Utils.log("  ➡️ executeFollowAction()を呼び出し")
            self:executeFollowAction()
        else
            Utils.log("📱 フォローボタンが見つかりません")
            Utils.log("  ➡️ ユーザーを'not_followed'として記録後、戻る処理実行")
            -- 戻る処理の前にユーザーを処理済みとして記録
            if self.lastTappedY then
                self:addProcessedUser(self.lastTappedY, "not_followed")
            end
            self:executeBackActions()  -- 戻る処理のみ
        end
    else
        Utils.log("👤 フォロー機能が無効 - 戻る処理のみ実行")
        Utils.log("  ➡️ ユーザーを'not_followed'として記録後、戻る処理実行")
        -- 戻る処理の前にユーザーを処理済みとして記録
        if self.lastTappedY then
            Utils.log(string.format("  📝 記録対象Y座標: %d", self.lastTappedY))
            self:addProcessedUser(self.lastTappedY, "not_followed")
        else
            Utils.log("  ⚠️ lastTappedYが設定されていません")
        end
        Utils.log("  ➡️ executeBackActions()を呼び出し")
        self:executeBackActions()  -- 戻る処理のみ
    end
end

-- フォロー実行と戻る処理
function App:executeFollowAction()
    Utils.log("フォローボタンをタップ中...")
    local followButtonImage = "image/post_follow.png"
    local followResult = ImageDetection.findButton(followButtonImage)

    if followResult then
        local followX = followResult[1][1]
        local followY = followResult[1][2]
        Utils.log(string.format("フォローボタンを検出 - タップ位置: (%d, %d)", followX, followY))

        -- フォローボタンをタップ
        local success, err = pcall(touchDown, 7, followX, followY)
        if not success then
            if tostring(err):match("interrupted") then
                INTERRUPTED = true
                error("interrupted")
            end
            Utils.log("⚠️ フォローボタンタップエラー: " .. tostring(err))
        else
            Utils.wait(50000)
            pcall(touchUp, 7, followX, followY)
            Utils.log("✅ フォローボタンをタップしました")

            -- フォロー確認ダイアログが表示される可能性があるため待機してチェック
            Utils.wait(1000000)  -- 1秒待機

            -- ダイアログが表示されたかチェックして処理
            if self:handleFollowDialog() then
                Utils.log("💬 フォロー確認ダイアログを処理しました")
            end
        end
    end

    -- フォロー後の処理：戻る処理の前にユーザーを処理済みとして記録
    if self.lastTappedY then
        self:addProcessedUser(self.lastTappedY, "followed")
    end
    self:executeBackActions()  -- 戻る処理のみ
end

-- 戻る処理（2回）
function App:executeBackActions()
    Utils.log("🔙 ===== 戻る処理開始 =====")
    Utils.log(string.format("  📊 処理前の処理済みユーザー数: %d人", #self.processedUsers))
    Utils.wait(Config.TIMING.SCREEN_TRANSITION)

    -- 1回目の戻るボタン
    Utils.log("🔙 1回目の戻るボタンをタップ...")
    self:tapBackButton()
    Utils.wait(Config.TIMING.SCREEN_TRANSITION)

    -- 2回目の戻るボタン
    Utils.log("🔙 2回目の戻るボタンをタップ...")
    self:tapBackButton()
    Utils.wait(Config.TIMING.SCREEN_TRANSITION)

    -- 戻った後の状態を確認
    Utils.log("✅ 戻る処理完了")
    Utils.log(string.format("  📊 処理後の処理済みユーザー数: %d人", #self.processedUsers))
    Utils.log("  ➡️ 次のユーザー選択へ")
end


function App:findAndTapNextFollowButton(attemptCount)
    -- 🛑 関数開始時の中断チェック
    if INTERRUPTED then
        Utils.log("⚠️ ユーザーによる中断を検出 - findAndTapNextFollowButton終了")
        error("interrupted")
    end

    -- 再帰の深さを制限（無限ループ防止）
    attemptCount = attemptCount or 0
    if attemptCount >= 3 then
        Utils.log("❌ 最大スクロール回数に達しました - 新しいユーザーが見つかりません")
        return false
    end

    -- followbtn.pngまたはfollowbtn_v2.pngを検索（複数検出対応）
    Utils.log(string.format("次のフォローボタンを探しています... (試行: %d/3)", attemptCount + 1))

    -- タップ履歴をログ出力
    if #self.allTappedPositions > 0 or #self.recentTappedPositions > 0 then
        Utils.log(string.format("📝 全体履歴: %d件 | 最近の履歴: %d件",
            #self.allTappedPositions, #self.recentTappedPositions))

        if #self.recentTappedPositions > 0 then
            Utils.log("最近のタップ:")
            for i, pos in ipairs(self.recentTappedPositions) do
                Utils.log(string.format("  [%d] Y=%d", i, pos.y))
            end
        end
    end

    -- followbtn.pngを検索（複数検出）
    local results = {}
    local success1, result1 = pcall(findImage, "image/followbtn.png", 0, 0.95)  -- 0 = 全件取得
    if success1 and result1 and #result1 > 0 then
        for _, r in ipairs(result1) do
            table.insert(results, {x = r[1], y = r[2], type = "followbtn"})
        end
        Utils.log(string.format("followbtn.png: %d個検出", #result1))
    end

    -- followbtn_v2.pngを検索（複数検出）
    local success2, result2 = pcall(findImage, "image/followbtn_v2.png", 0, 0.95)  -- 0 = 全件取得
    if success2 and result2 and #result2 > 0 then
        for _, r in ipairs(result2) do
            table.insert(results, {x = r[1], y = r[2], type = "followbtn_v2"})
        end
        Utils.log(string.format("followbtn_v2.png: %d個検出", #result2))
    end

    if #results > 0 then
        Utils.log(string.format("合計 %d 個のフォローボタンを検出", #results))

        -- 処理済みでないボタンを探す
        Utils.log("🔍 ユーザー選択開始")
        Utils.log(string.format("  📊 検出ボタン数: %d個", #results))
        Utils.log(string.format("  📊 処理済みユーザー数: %d人", #self.processedUsers))

        for i, result in ipairs(results) do
            local x = result.x
            local y = result.y

            Utils.log(string.format("ボタン%d: タイプ=%s, 座標=(%d, %d)", i, result.type, x, y))

            -- 新しい座標管理システムで処理済みかチェック
            local isProcessed, status = self:isUserProcessed(y)

            -- まだ処理していない位置なら選択
            if not isProcessed then
                -- X軸を左にオフセット（フォロー中タブの位置）
                local offsetX = x + Config.COORDINATES.FOLLOW_TAB_OFFSET

                Utils.log("🎯 新しいユーザー選択!")
                Utils.log(string.format("  📋 ボタンタイプ: %s", result.type))
                Utils.log(string.format("  📍 フォローボタン位置: (%d, %d)", x, y))
                Utils.log(string.format("  📍 フォロー中タブ位置: (%d, %d)", offsetX, y))
                Utils.log(string.format("  🎯 選択理由: 未処理ユーザー"))

                -- 最後にタップしたY座標を記録
                self.lastTappedY = y

                Utils.log(string.format("📥 ユーザー選択実行: Y=%d", y))

                -- オフセットした位置をタップ
                local coords = Utils.convertCoordinates(offsetX, y)
                local success, err = pcall(touchDown, 2, coords[1], coords[2])
                if not success then
                    if tostring(err):match("interrupted") then
                        INTERRUPTED = true
                        error("interrupted")
                    end
                    Utils.log("タップエラー: " .. tostring(err))
                    return false
                end

                Utils.wait(49274)
                pcall(touchUp, 2, coords[1], coords[2])

                Utils.log("✅ フォロー中タブタップ完了")

                -- プロフィール画面に遷移後、投稿ボタンを検索
                Utils.wait(Config.TIMING.SCREEN_TRANSITION)
                return self:detectAndTapProfileButton()
            else
                Utils.log(string.format("⏭️ ボタン%d スキップ: Y=%d は処理済み (ステータス=%s)", i, y, status or "不明"))
            end
        end

        -- すべてのボタンが既にタップ済みの場合
        Utils.log(string.format("⚠️ 全%d個のボタンが既にタップ済みです", #results))
    end

    -- どのボタンも見つからない、または全て既にタップ済みの場合はスクロール
    Utils.log("⚠️ 新しいフォローボタンが見つかりません - スクロールします")
    self:scrollInitialScreen()
    Utils.wait(Config.TIMING.SCREEN_TRANSITION)

    -- スクロール後に新しいフォローボタンを探して再試行
    Utils.log("🔄 スクロール完了 - 新しいフォローボタンを検索中...")
    return self:findAndTapNextFollowButton(attemptCount + 1)  -- 再帰的に新しいボタンを探す（カウントをインクリメント）
end

function App:tapBackButton()
    Utils.log("戻るボタンをタップ中...")

    -- 戻る座標をConfigから取得
    local coords = Utils.convertCoordinates(Config.COORDINATES.BACK_BUTTON.x, Config.COORDINATES.BACK_BUTTON.y)

    local success, err = pcall(touchDown, 4, coords[1], coords[2])
    if not success then
        if tostring(err):match("interrupted") then
            INTERRUPTED = true
            error("interrupted")
        end
        Utils.log("戻るボタンタップエラー: " .. tostring(err))
        return false
    end

    Utils.wait(Config.TIMING.BACK_BUTTON)
    pcall(touchUp, 4, coords[1], coords[2])
    Utils.log("✅ 戻るボタンをタップしました")

    return true
end

function App:scrollToNextPost()
    Utils.log("次の投稿へスクロール中...")

    -- 複雑なスワイプパターンを使用
    self:complexSwipePattern()
    Utils.wait(Config.TIMING.AFTER_TAP)
end

function App:runSingleLoop()
    -- 中断チェック
    if INTERRUPTED then
        error("interrupted")
    end

    self.currentLoop = self.currentLoop + 1
    self.processedCount = 0  -- ループごとにリセット

    -- ループ開始時のログ（処理済みユーザーは保持）
    Utils.log(string.format("📊 ループ %d開始 - 処理済みユーザー数: %d人", self.currentLoop, #self.processedUsers))

    Utils.log(string.format("=== ループ %d/%d 開始 ===", self.currentLoop, self.loopCount))

    -- ループ開始時のプログレスバー更新
    self:updateProgressBar()

    -- ステップ1: 初期画面タップ（フォロー中タブ）
    local success = self:tapInitialScreen()
    if not success then
        Utils.log("❌ 初期画面のタップに失敗")
        return false
    end

    -- ステップ2: プロフィールボタン検出とタップ
    success = self:detectAndTapProfileButton()
    if not success then
        Utils.log("⚠️ プロフィールボタンが見つかりません")
        return false
    end

    -- ループ完了
    self.totalProcessedCount = self.totalProcessedCount + self.processedCount
    Utils.log(string.format("=== ループ %d/%d 完了 - %d いいね ===", self.currentLoop, self.loopCount, self.processedCount))

    return true
end

function App:run()
    Utils.log("=== ActiveLike 開始 ===")

    -- 指定回数ループ実行
    for loop = 1, self.loopCount do
        -- 中断チェック
        if INTERRUPTED then
            Utils.log("⚠️ ユーザーによる中断を検出しました")
            break
        end

        local success, err = pcall(function()
            return self:runSingleLoop()
        end)

        if not success then
            if tostring(err):match("interrupted") then
                Utils.log("⚠️ 処理が中断されました")
                break
            end
            Utils.log("❌ エラー: " .. tostring(err))
        end

        -- 最後のループでなければ少し待機
        if loop < self.loopCount then
            Utils.log("次のループまで待機中...")
            Utils.wait(3000000)  -- 3秒待機
        end
    end

    -- 完了
    self:finish()
end

function App:finish()
    Utils.log("=== ActiveLike 終了 ===")
    Utils.log(string.format("完了: 合計 %d いいね (%d ループ実行)", self.totalProcessedCount, self.currentLoop))

    -- 実行時間の計算
    local elapsedTime = os.time() - self.startTime
    local minutes = math.floor(elapsedTime / 60)
    local seconds = elapsedTime % 60

    -- 完了時の詳細表示
    alert(string.format("🎊 完了!\n━━━━━━━━━━\n💗 合計: %d いいね\n🔄 実行: %d/%d ループ\n⏱️ 時間: %d分%d秒",
        self.totalProcessedCount,
        self.currentLoop,
        self.loopCount,
        minutes,
        seconds
    ))
end

-- ==========================================
-- GUI設定ダイアログ
-- ==========================================
local function showSettingsDialog()
    local controls = {
        {type = CONTROLLER_TYPE.LABEL, text = "📱 ActiveLike 📱"},
        {type = CONTROLLER_TYPE.INPUT,
         title = "🔄 ループ回数:",
         key = "loopCount",
         value = tostring(Config.DEFAULT.loopCount)},
        {type = CONTROLLER_TYPE.INPUT,
         title = "💗 いいね/ループ:",
         key = "likeCount",
         value = tostring(Config.DEFAULT.likeCount)},
        {type = CONTROLLER_TYPE.INPUT,
         title = "📸 最小投稿数:",
         key = "minPosts",
         value = tostring(Config.PROFILE_CHECK.minPosts)},
        {type = CONTROLLER_TYPE.INPUT,
         title = "👥 最小フォロワー:",
         key = "minFollowers",
         value = tostring(Config.PROFILE_CHECK.minFollowers)},
        {type = CONTROLLER_TYPE.INPUT,
         title = "📋 最小フォロー中:",
         key = "minFollowing",
         value = tostring(Config.PROFILE_CHECK.minFollowing)},
        {type = CONTROLLER_TYPE.SWITCH,
         title = "👤 自動フォロー:",
         key = "followEnabled",
         value = 1},
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
         flag = 2}
    }

    local orientations = {ORIENTATION_TYPE.PORTRAIT}

    -- ダイアログを表示して結果を取得
    local result, values = dialog(controls, orientations)

    if result == 1 then
        -- valuesテーブルが返される場合
        if values then
            return {
                loopCount = tonumber(values.loopCount) or tonumber(values[2]) or Config.DEFAULT.loopCount,
                likeCount = tonumber(values.likeCount) or tonumber(values[3]) or Config.DEFAULT.likeCount,
                minPosts = tonumber(values.minPosts) or tonumber(values[4]) or Config.PROFILE_CHECK.minPosts,
                minFollowers = tonumber(values.minFollowers) or tonumber(values[5]) or Config.PROFILE_CHECK.minFollowers,
                minFollowing = tonumber(values.minFollowing) or tonumber(values[6]) or Config.PROFILE_CHECK.minFollowing,
                debugMode = false,  -- デフォルトで無効
                followEnabled = values.followEnabled == 1 or values[7] == 1
            }
        else
            -- controlsの値が直接更新される場合
            return {
                loopCount = tonumber(controls[2].value) or Config.DEFAULT.loopCount,
                likeCount = tonumber(controls[3].value) or Config.DEFAULT.likeCount,
                minPosts = tonumber(controls[4].value) or Config.PROFILE_CHECK.minPosts,
                minFollowers = tonumber(controls[5].value) or Config.PROFILE_CHECK.minFollowers,
                minFollowing = tonumber(controls[6].value) or Config.PROFILE_CHECK.minFollowing,
                debugMode = false,  -- デフォルトで無効
                followEnabled = (controls[7].value == 1)
            }
        end
    end

    return nil
end

-- ==========================================
-- メインエントリーポイント
-- ==========================================
local function main()
    -- 設定ダイアログ表示
    local settings = showSettingsDialog()

    if not settings then
        toast("❌ キャンセルされました", 2)
        return
    end

    -- アプリケーション実行
    local app = {}
    setmetatable(app, {__index = App})

    app:init(settings)

    -- 中断可能な待機
    local success, err = pcall(function()
        Utils.wait(2000000)  -- 2秒待機
    end)

    if success then
        -- アプリケーション実行（中断エラーをキャッチ）
        local runSuccess, runErr = pcall(function()
            app:run()
        end)

        if not runSuccess and tostring(runErr):match("interrupted") then
            toast("⚠️ ユーザーによって中断されました", 2)
            Utils.log("スクリプトが正常に中断されました")
        elseif not runSuccess then
            Utils.log("❌ 実行エラー: " .. tostring(runErr))
            toast("❌ 実行エラーが発生しました", 2)
        end
    else
        if tostring(err):match("interrupted") then
            toast("⚠️ 開始前に中断されました", 2)
        end
    end
end

-- スクリプト実行
main()