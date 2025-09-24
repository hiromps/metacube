-- ==========================================
-- Instagram自動フォロー 完全版
-- AutoTouch標準dialog関数使用
-- timeline.lua形式のリファクタリング版
-- ==========================================

-- グローバル中断フラグ
local INTERRUPTED = false

-- グローバル中断チェック関数
local function checkInterrupted()
    -- 非常に短い待機で中断をチェック
    local success = pcall(function()
        usleep(1)  -- 1マイクロ秒の最小待機
    end)
    if not success then
        INTERRUPTED = true
        return true
    end
    return INTERRUPTED
end

-- すべてのAutoTouch API呼び出しを保護するラッパー
local function safeCall(func, ...)
    if checkInterrupted() then
        error("interrupted")
    end
    local success, result = pcall(func, ...)
    if not success then
        INTERRUPTED = true
        error("interrupted")
    end
    return result
end

-- ==========================================
-- GUI設定ダイアログ
-- ==========================================
local function showSettingsDialog()
    -- ダイアログコントロールの定義
    local controls = {
        {type = CONTROLLER_TYPE.LABEL, text = "📱 Instagram自動フォロー設定 📱"},
        {type = CONTROLLER_TYPE.LABEL, text = "━━━━━━━━━━━━━━━━━━━"},
        {type = CONTROLLER_TYPE.INPUT, title = "👥 フォロー数:", key = "followCount", value = "10"},
        {type = CONTROLLER_TYPE.LABEL, text = "※ 1～100の範囲で設定してください"},
        {type = CONTROLLER_TYPE.INPUT, title = "📜 最大連続スクロール:", key = "maxScrolls", value = "10"},
        {type = CONTROLLER_TYPE.LABEL, text = "※ 連続スクロール回数の上限（5～20推奨）"},
        {type = CONTROLLER_TYPE.LABEL, text = "━━━━━━━━━━━━━━━━━━━"},
        {type = CONTROLLER_TYPE.PICKER, title = "⚡ 実行速度:", key = "speed", value = "通常", options = {"高速", "通常", "低速"}},
        {type = CONTROLLER_TYPE.SWITCH, title = "🔍 デバッグモード:", key = "debug", value = 1},
        {type = CONTROLLER_TYPE.LABEL, text = "━━━━━━━━━━━━━━━━━━━"},
        {type = CONTROLLER_TYPE.LABEL, text = "⚠️ フォロー候補画面を開いてから実行"},
        {type = CONTROLLER_TYPE.BUTTON, title = "🚀 開始", color = 0x68D391, width = 0.5, flag = 1, collectInputs = true},
        {type = CONTROLLER_TYPE.BUTTON, title = "❌ キャンセル", color = 0xFF5733, width = 0.5, flag = 2, collectInputs = false}
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
        local followCount = tonumber(controls[3].value)

        -- 入力値の検証
        if not followCount or followCount < 1 or followCount > 100 then
            toast("⚠️ フォロー数は1から100までの数値を入力してください", 2)
            return nil
        end

        local maxScrolls = tonumber(controls[5].value) or 10
        if maxScrolls < 1 or maxScrolls > 50 then
            maxScrolls = 10  -- デフォルト値
        end

        -- 速度モードの変換
        local speedMultiplier = 1
        if controls[8].value == "高速" then
            speedMultiplier = 0.7
        elseif controls[8].value == "低速" then
            speedMultiplier = 1.5
        end

        return {
            followCount = followCount,
            maxScrolls = maxScrolls,
            speedMultiplier = speedMultiplier,
            debugMode = (controls[9].value == 1)
        }
    else
        return nil  -- キャンセル
    end
end

-- ==========================================
-- 設定セクション
-- ==========================================
local Config = {
    -- フォローボタン検出設定
    IMAGE_DETECTION = {
        followbtn = {
            path = "image/followbtn.png",  -- フォローボタン（メイン）
            tolerance = 0.99,  -- 高精度：ほぼ完全一致のみ
            region = {405, 215, 313, 1028}  -- フォローボタンの検索範囲
        },
        followbtn_v2 = {
            path = "image/followbtn_v2.png",  -- フォローボタン（バリエーション）
            tolerance = 0.99,  -- 高精度：ほぼ完全一致のみ
            region = {405, 215, 313, 1028}
        },
        followedbtn = {
            path = "image/followedbtn.png",  -- フォロー中ボタン（スキップ用）
            tolerance = 0.95,  -- フォロー済み確認は少し緩め
            region = {405, 215, 313, 1028}
        },
        followback = {
            path = "image/followback.png",  -- フォローバックボタン（スキップ用）
            tolerance = 0.95,  -- フォローバック確認は少し緩め
            region = {405, 215, 313, 1028}
        },
        follow_dialog = {
            path = "image/follow_dialog.png",  -- フォロー確認ダイアログ
            tolerance = 0.95,
            region = nil  -- 全画面検索
        }
    },

    -- パフォーマンス設定
    PROCESS = {
        DEBUG_MODE = true,              -- デバッグモード
        MAX_FOLLOW_COUNT = 10,          -- デフォルト最大フォロー数
        MAX_ITERATIONS = 200,           -- 最大イテレーション
        MAX_CONSECUTIVE_SCROLLS = 10,   -- 最大連続スクロール回数
        SPEED_MULTIPLIER = 1,           -- 速度倍率
        LOG_FILE_PATH = "follow_log.txt"  -- ログファイルパス
    },

    -- タイミング設定（マイクロ秒）
    TIMING = {
        AFTER_FOLLOW = 1500000,         -- フォロー後の待機（1.5秒）
        BETWEEN_SEARCHES = 500000,      -- 検索間隔（0.5秒）
        SCROLL_DURATION = 1200000,      -- スクロール時間（1.2秒）
        TAP_DURATION = 200000           -- タップ持続時間（0.2秒）
    },

    -- スクロール設定
    SCROLL = {
        START_X = 87,
        START_Y = 877,
        END_X = 87,
        END_Y = 333,
        STEPS = 20  -- スクロールステップ数
    }
}

-- ==========================================
-- ログシステム
-- ==========================================
local Logger = {}

function Logger.init()
    Logger.file = io.open(Config.PROCESS.LOG_FILE_PATH, "w")
    if Logger.file then
        Logger.file:write(string.format("=== Instagram自動フォロー ログ ===\n"))
        Logger.file:write(string.format("開始時刻: %s\n", os.date("%Y-%m-%d %H:%M:%S")))
        Logger.file:write(string.format("================================\n\n"))
        Logger.file:flush()
    end
end

function Logger.write(message)
    if Config.PROCESS.DEBUG_MODE then
        print(message)
    end

    if Logger.file then
        local timestamp = os.date("%H:%M:%S")
        Logger.file:write(string.format("[%s] %s\n", timestamp, message))
        Logger.file:flush()
    end
end

function Logger.writeSummary(stats)
    if Logger.file then
        Logger.file:write("\n=== 実行統計 ===\n")
        Logger.file:write(string.format("フォロー成功: %d件\n", stats.followedCount))
        Logger.file:write(string.format("スキップ: %d件\n", stats.skippedCount))
        Logger.file:write(string.format("エラー: %d件\n", stats.errorCount))
        Logger.file:write(string.format("総イテレーション: %d回\n", stats.totalIterations))
        Logger.file:write(string.format("終了時刻: %s\n", os.date("%Y-%m-%d %H:%M:%S")))
        Logger.file:close()
    end
end

-- ログ関数のエイリアス
local log = function(msg) Logger.write(msg) end

-- ==========================================
-- ユーティリティ関数
-- ==========================================
local Utils = {}

-- 中断可能な待機関数
function Utils.wait(microseconds)
    local totalWait = microseconds * Config.PROCESS.SPEED_MULTIPLIER
    local chunkSize = 10000  -- 0.01秒単位で分割（さらに短く）

    while totalWait > 0 do
        -- 頻繁に中断をチェック
        if checkInterrupted() then
            error("interrupted")
        end

        local waitTime = math.min(totalWait, chunkSize)
        local success = pcall(usleep, waitTime)

        if not success then
            INTERRUPTED = true
            error("interrupted")
        end

        totalWait = totalWait - waitTime
    end

    return true
end

-- 座標変換（将来の解像度対応用）
function Utils.convertCoordinates(x, y)
    local screenWidth, screenHeight = getScreenResolution()
    local baseWidth = 750  -- iPhone標準幅
    local baseHeight = 1334  -- iPhone標準高さ

    local scaleX = screenWidth / baseWidth
    local scaleY = screenHeight / baseHeight

    return {math.floor(x * scaleX), math.floor(y * scaleY)}
end

-- ==========================================
-- タッチ操作モジュール
-- ==========================================
local Touch = {}

function Touch.tap(x, y, duration)
    if checkInterrupted() then
        error("interrupted")
    end

    local coords = Utils.convertCoordinates(x, y)

    -- touchDownを実行
    local downSuccess = pcall(touchDown, 0, coords[1], coords[2])
    if not downSuccess then
        INTERRUPTED = true
        error("interrupted")
    end

    -- 待機（中断可能）
    local waitDuration = duration or Config.TIMING.TAP_DURATION
    local waitSuccess = pcall(Utils.wait, waitDuration)

    -- 必ずtouchUpを実行（エラーでも）
    pcall(touchUp, 0, coords[1], coords[2])

    if not waitSuccess then
        INTERRUPTED = true
        error("interrupted")
    end

    return true
end

function Touch.swipe(startX, startY, endX, endY, duration)
    if checkInterrupted() then
        error("interrupted")
    end

    local startCoords = Utils.convertCoordinates(startX, startY)
    local endCoords = Utils.convertCoordinates(endX, endY)

    -- touchDownを実行
    local downSuccess = pcall(touchDown, 0, startCoords[1], startCoords[2])
    if not downSuccess then
        INTERRUPTED = true
        error("interrupted")
    end

    -- スワイプ動作を複数ステップに分割（ステップ数を減らして高速化）
    local steps = math.min(Config.SCROLL.STEPS, 10)  -- 最大10ステップに制限
    local stepDuration = duration / steps

    for i = 1, steps do
        -- 頻繁に中断チェック
        if checkInterrupted() then
            pcall(touchUp, 0, endCoords[1], endCoords[2])
            error("interrupted")
        end

        local progress = i / steps
        local currentX = startCoords[1] + (endCoords[1] - startCoords[1]) * progress
        local currentY = startCoords[2] + (endCoords[2] - startCoords[2]) * progress

        -- touchMoveを実行（エラーは即中断）
        local moveSuccess = pcall(touchMove, 0, math.floor(currentX), math.floor(currentY))
        if not moveSuccess then
            pcall(touchUp, 0, endCoords[1], endCoords[2])
            INTERRUPTED = true
            error("interrupted")
        end

        -- 短い待機
        if stepDuration > 0 then
            local waitSuccess = pcall(usleep, math.min(stepDuration, 10000))  -- 最大10ms
            if not waitSuccess then
                pcall(touchUp, 0, endCoords[1], endCoords[2])
                INTERRUPTED = true
                error("interrupted")
            end
        end
    end

    -- 必ずtouchUpを実行
    pcall(touchUp, 0, endCoords[1], endCoords[2])
    return true
end

-- ==========================================
-- プログレス表示関数
-- ==========================================
local function showProgress(current, total)
    if Config.PROCESS.DEBUG_MODE then  -- デバッグモードの時のみ表示
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
-- フォロー処理モジュール
-- ==========================================
local FollowActions = {}

-- フォローボタンを検出してタップ
function FollowActions.findAndTapFollow()
    -- 中断チェック
    if checkInterrupted() then
        error("interrupted")
    end

    -- まず、フォローバックボタンを検出して除外リストを作成
    local excludePositions = {}
    local successFB, followbackResult = pcall(
        findImage,
        Config.IMAGE_DETECTION.followback.path,
        0,  -- 0 = 全件取得
        0.95,  -- フォローバックは確実に検出
        Config.IMAGE_DETECTION.followback.region
    )

    if successFB and followbackResult and #followbackResult > 0 then
        log(string.format("🔄 フォローバックボタンを%d個検出（除外対象）", #followbackResult))
        for _, fb in ipairs(followbackResult) do
            table.insert(excludePositions, {x = fb[1], y = fb[2]})
        end
    end

    local allResults = {}  -- 全ての検出結果を格納

    -- followbtn.pngを検索（中断チェック付き）
    local success1, result1 = pcall(
        findImage,
        Config.IMAGE_DETECTION.followbtn.path,
        0,  -- 0 = 全件取得
        Config.IMAGE_DETECTION.followbtn.tolerance,
        Config.IMAGE_DETECTION.followbtn.region
    )

    if not success1 then
        -- すべてのfindImageエラーを中断として扱う
        INTERRUPTED = true
        error("interrupted")
    elseif result1 and #result1 > 0 then
        log(string.format("🔵 followbtn.png: %d個検出 (精度0.99)", #result1))
        for _, r in ipairs(result1) do
            -- フォローバックボタンと重複していないかチェック
            local isOverlap = false
            for _, exclude in ipairs(excludePositions) do
                -- 座標が近い場合は除外（許容範囲50ピクセル）
                if math.abs(r[1] - exclude.x) < 50 and math.abs(r[2] - exclude.y) < 50 then
                    isOverlap = true
                    log(string.format("⚠️ 位置(%d, %d)はフォローバックと重複のため除外", r[1], r[2]))
                    break
                end
            end

            if not isOverlap then
                table.insert(allResults, {x = r[1], y = r[2], type = "v1"})
            end
        end
    else
        log("⚠️ followbtn.png: 検出なし (精度0.99でほぼ完全一致のみ)")
    end

    -- followbtn_v2.pngを検索
    local success2, result2 = pcall(
        findImage,
        Config.IMAGE_DETECTION.followbtn_v2.path,
        0,  -- 0 = 全件取得
        Config.IMAGE_DETECTION.followbtn_v2.tolerance,
        Config.IMAGE_DETECTION.followbtn_v2.region
    )

    if not success2 then
        -- すべてのfindImageエラーを中断として扱う
        INTERRUPTED = true
        error("interrupted")
    elseif result2 and #result2 > 0 then
        log(string.format("🔴 followbtn_v2.png: %d個検出 (精度0.99)", #result2))
        for _, r in ipairs(result2) do
            -- フォローバックボタンと重複していないかチェック
            local isOverlap = false
            for _, exclude in ipairs(excludePositions) do
                -- 座標が近い場合は除外（許容範囲50ピクセル）
                if math.abs(r[1] - exclude.x) < 50 and math.abs(r[2] - exclude.y) < 50 then
                    isOverlap = true
                    log(string.format("⚠️ 位置(%d, %d)はフォローバックと重複のため除外", r[1], r[2]))
                    break
                end
            end

            if not isOverlap then
                table.insert(allResults, {x = r[1], y = r[2], type = "v2"})
            end
        end
    else
        log("⚠️ followbtn_v2.png: 検出なし (精度0.99でほぼ完全一致のみ)")
    end

    -- フォローボタンが見つかった場合
    if #allResults > 0 then
        log(string.format("📍 合計%d個のフォローボタンを検出 (精度0.99でほぼ完全一致)", #allResults))

        -- 最初のフォローボタンをタップ
        local target = allResults[1]
        local buttonType = target.type == "v1" and "followbtn" or "followbtn_v2"
        log(string.format("✅ 高精度検出により%sをタップ: (%d, %d)", buttonType, target.x, target.y))

        -- フォローボタンをタップ
        if Touch.tap(target.x, target.y, Config.TIMING.TAP_DURATION) then
            log("👥 フォロー実行")
            return true
        end
    end

    -- フォローボタンが見つからない場合は、スキップ対象ボタンの確認
    local skipCount = 0

    -- フォロー中ボタンの確認
    local success2, followedbtnResult = pcall(
        findImage,
        Config.IMAGE_DETECTION.followedbtn.path,
        0,  -- 0 = 全件取得
        Config.IMAGE_DETECTION.followedbtn.tolerance,
        Config.IMAGE_DETECTION.followedbtn.region
    )

    if success2 and followedbtnResult and #followedbtnResult > 0 then
        skipCount = skipCount + #followedbtnResult
        log(string.format("⏭️ フォロー中ボタン: %d個検出", #followedbtnResult))
    end

    -- フォローバックボタンの確認
    local success3, followbackResult = pcall(
        findImage,
        Config.IMAGE_DETECTION.followback.path,
        0,  -- 0 = 全件取得
        Config.IMAGE_DETECTION.followback.tolerance,
        Config.IMAGE_DETECTION.followback.region
    )

    if success3 and followbackResult and #followbackResult > 0 then
        skipCount = skipCount + #followbackResult
        log(string.format("🔄 フォローバックボタン: %d個検出", #followbackResult))
    end

    -- スキップ対象のボタンのみの場合
    if skipCount > 0 then
        log(string.format("⏭️ 画面内に%d個のスキップ対象ボタンのみ（フォローボタンなし）", skipCount))
        return "all_followed"  -- スキップ対象のみの画面
    end

    return false
end

-- ダイアログ処理専用関数
function FollowActions.handleFollowDialog()
    -- フォロー確認ダイアログのチェック
    local success, result = pcall(
        findImage,
        Config.IMAGE_DETECTION.follow_dialog.path,
        1,
        Config.IMAGE_DETECTION.follow_dialog.tolerance,
        Config.IMAGE_DETECTION.follow_dialog.region
    )

    if success and result and #result > 0 then
        log("💬 予期せずフォロー確認ダイアログが表示されました")

        -- 検出された画像の位置を取得
        local dialogX = result[1][1]
        local dialogY = result[1][2]

        log(string.format("🔵 ダイアログを検出した位置をタップ: (%d, %d)", dialogX, dialogY))

        if Touch.tap(dialogX, dialogY, 101398) then
            log("✅ ダイアログ処理完了")
            Utils.wait(1000000)  -- 1秒待機
            return true
        end
    end

    return false
end

-- 複雑なスワイプパターンによるスクロール
function FollowActions.complexSwipePattern()
    local swipeData = {
        -- touchDown(id, x, y) + 待機時間
        {6, 199.12, 1152.98, 99658.92},
        -- touchMove(id, x, y) + 待機時間
        {6, 206.30, 1140.75, 16609.46},
        {6, 211.43, 1130.57, 16585.50},
        {6, 219.65, 1116.32, 16783.88},
        {6, 227.85, 1100.04, 16732.83},
        {6, 236.07, 1083.73, 16522.50},
        {6, 245.30, 1067.45, 16653.83},
        {6, 251.46, 1054.22, 16719.08},
        {6, 260.70, 1037.93, 16695.54},
        {6, 268.91, 1022.65, 16533.62},
        {6, 279.18, 1006.36, 16758.75},
        {6, 289.44, 990.08, 16546.71},
        {6, 298.68, 973.77, 16763.79},
        {6, 307.91, 958.51, 16660.88},
        {6, 318.18, 942.22, 16697.50},
        {6, 327.42, 924.90, 16779.25},
        {6, 337.68, 908.62, 16568.92},
        {6, 348.98, 889.28, 16691.46},
        {6, 358.21, 872.99, 16649.04},
        {6, 367.45, 855.67, 16625.62},
        {6, 376.68, 838.37, 16676.75},
        {6, 386.95, 822.09, 16590.21},
        {6, 396.18, 806.80, 16730.12},
        {6, 406.45, 789.50, 16671.62},
        {6, 416.71, 773.21, 16844.75},
        {6, 426.98, 756.91, 16490.88},
        {6, 437.24, 740.62, 16869.96},
        {6, 446.48, 725.36, 16426.50},
        {6, 455.72, 710.09, 16760.29},
        {6, 467.01, 694.81, 16856.71},
        {6, 479.32, 675.47, 16362.17},
        {6, 487.53, 661.22, 16725.71},
        {6, 496.78, 644.91, 16848.08},
        {6, 503.95, 628.63, 16423.08},
        {6, 513.20, 613.36, 16688.17},
        {6, 521.40, 598.10, 16694.71},
        {6, 528.59, 585.86, 16649.46},
        {6, 534.75, 573.65, 16778.67},
        {6, 541.93, 560.42, 16808.71},
        {6, 548.09, 549.22, 16415.12},
        {6, 553.22, 540.06, 16711.79},
        {6, 558.36, 529.87, 16619.08},
        {6, 563.48, 519.69, 16798.71},
        {6, 567.59, 510.53, 16633.33},
        {6, 572.73, 502.39, 16658.96},
        {6, 575.81, 496.28, 16703.71},
        {6, 579.91, 489.16, 16625.67},
        {6, 582.98, 484.07, 16640.75},
        {6, 584.01, 480.99, 16720.71},
        {6, 585.04, 477.94, 16631.67},
        {6, 586.07, 476.92, 16575.04},
        {6, 587.09, 475.91, 16704.54},
        {6, 587.09, 474.89, 49881.08},
        {6, 588.12, 474.89, 50045.62}
    }

    -- 中断チェック
    if checkInterrupted() then
        error("interrupted")
    end

    -- 最初のタッチダウン
    local success = pcall(touchDown, swipeData[1][1], swipeData[1][2], swipeData[1][3])
    if not success then
        INTERRUPTED = true
        error("interrupted")
    end

    -- 最初の待機
    local waitSuccess = pcall(usleep, swipeData[1][4] * Config.PROCESS.SPEED_MULTIPLIER)
    if not waitSuccess then
        pcall(touchUp, 6, 587.09, 473.87)
        INTERRUPTED = true
        error("interrupted")
    end

    -- 各ステップを実行
    for i = 2, #swipeData do
        -- 中断チェック
        if checkInterrupted() then
            pcall(touchUp, 6, 587.09, 473.87)
            error("interrupted")
        end

        -- タッチムーブ
        local moveSuccess = pcall(touchMove, swipeData[i][1], swipeData[i][2], swipeData[i][3])
        if not moveSuccess then
            pcall(touchUp, 6, 587.09, 473.87)
            INTERRUPTED = true
            error("interrupted")
        end

        -- 待機（速度調整付き）
        local waitTime = swipeData[i][4] * Config.PROCESS.SPEED_MULTIPLIER
        local sleepSuccess = pcall(usleep, waitTime)
        if not sleepSuccess then
            pcall(touchUp, 6, 587.09, 473.87)
            INTERRUPTED = true
            error("interrupted")
        end
    end

    -- タッチアップ（最後の座標を使用）
    pcall(touchUp, 6, 587.09, 473.87)
    log("📜 複雑なスワイプ完了")
end

-- スクロール処理（complexSwipePatternを呼び出す）
function FollowActions.scroll()
    log("📜 スクロール実行")
    return FollowActions.complexSwipePattern()
end

-- ==========================================
-- メインアプリケーション
-- ==========================================
local App = {}

function App:init(settings)
    self.settings = settings or {}
    self.stats = {
        followedCount = 0,
        skippedCount = 0,
        errorCount = 0,
        totalIterations = 0,
        startTime = os.time(),
        consecutiveScrolls = 0,  -- 連続スクロール回数
        maxConsecutiveScrolls = 10  -- 最大連続スクロール回数
    }

    -- 設定の適用
    Config.PROCESS.MAX_FOLLOW_COUNT = self.settings.followCount or Config.PROCESS.MAX_FOLLOW_COUNT
    Config.PROCESS.MAX_CONSECUTIVE_SCROLLS = self.settings.maxScrolls or Config.PROCESS.MAX_CONSECUTIVE_SCROLLS
    Config.PROCESS.SPEED_MULTIPLIER = self.settings.speedMultiplier or Config.PROCESS.SPEED_MULTIPLIER
    Config.PROCESS.DEBUG_MODE = self.settings.debugMode ~= nil and self.settings.debugMode or Config.PROCESS.DEBUG_MODE

    -- 統計に最大連続スクロール数を設定
    self.stats.maxConsecutiveScrolls = Config.PROCESS.MAX_CONSECUTIVE_SCROLLS

    -- ログ初期化
    Logger.init()

    log("🚀 Instagram自動フォロー開始")
    log(string.format("設定: フォロー数=%d, 速度=%.1fx, デバッグ=%s",
        Config.PROCESS.MAX_FOLLOW_COUNT,
        Config.PROCESS.SPEED_MULTIPLIER,
        Config.PROCESS.DEBUG_MODE and "ON" or "OFF"
    ))

    -- 開始通知とプログレスバー初期表示
    local progressBar = "░░░░░░░░░░"
    toast(string.format("🚀 フォロー開始！\n[%s] 0/%d (0%%)",
        progressBar,
        Config.PROCESS.MAX_FOLLOW_COUNT
    ), 2)
end

function App:processFollow()
    local followsInBatch = 0
    local maxBatchSize = 10  -- 画面内の最大処理数を増やす
    local noButtonFound = false

    for i = 1, maxBatchSize do
        -- より頻繁な中断チェック
        if checkInterrupted() then
            log("⚠️ ユーザーによる中断を検出")
            break
        end

        if self.stats.followedCount >= Config.PROCESS.MAX_FOLLOW_COUNT then
            log("✅ 目標フォロー数に到達")
            break
        end

        -- フォロー処理実行
        local result = FollowActions.findAndTapFollow()

        if result == true then
            self.stats.followedCount = self.stats.followedCount + 1
            followsInBatch = followsInBatch + 1
            log(string.format("📊 進捗: %d/%d",
                self.stats.followedCount,
                Config.PROCESS.MAX_FOLLOW_COUNT
            ))

            -- プログレス表示
            showProgress(self.stats.followedCount, Config.PROCESS.MAX_FOLLOW_COUNT)

            -- 5回ごとに詳細表示
            if self.stats.followedCount % 5 == 0 then
                toast(string.format("✅ %d人フォロー完了！", self.stats.followedCount), 1)
            end

            -- フォロー後の待機
            Utils.wait(Config.TIMING.AFTER_FOLLOW)

        elseif result == "all_followed" then
            -- 画面内が全てフォロー済みまたはフォローバックの場合
            self.stats.skippedCount = self.stats.skippedCount + 1
            log("📋 画面内のユーザーは全てスキップ対象（フォロー済み/フォローバック）")
            noButtonFound = true
            break

        else
            -- フォローボタンが見つからない場合
            noButtonFound = true
            break
        end

        -- 次の検索前の待機
        Utils.wait(Config.TIMING.BETWEEN_SEARCHES)
    end

    return followsInBatch > 0, noButtonFound
end

function App:run()
    self.isRunning = true

    while self.isRunning do
        -- 高頻度中断チェック（毎ループ先頭）
        if checkInterrupted() then
            log("🛑 ユーザーによる強制停止を検出")
            break
        end

        -- イテレーション制限チェック
        self.stats.totalIterations = self.stats.totalIterations + 1
        if self.stats.totalIterations > Config.PROCESS.MAX_ITERATIONS then
            log("⚠️ 最大イテレーション数に到達")
            break
        end

        -- 目標達成チェック
        if self.stats.followedCount >= Config.PROCESS.MAX_FOLLOW_COUNT then
            log("🎉 目標フォロー数を達成しました！")
            toast(string.format("🎊 目標達成！%d人フォロー", self.stats.followedCount), 2)
            break
        end

        -- フォロー処理
        local success, err = pcall(function()
            -- まずダイアログが表示されていないかチェック
            if FollowActions.handleFollowDialog() then
                -- ダイアログが処理された場合は次のループへ
                return
            end

            local foundFollows, needScroll = self:processFollow()

            if needScroll then
                -- フォローボタンが見つからない場合
                self.stats.consecutiveScrolls = self.stats.consecutiveScrolls + 1
                log(string.format("📜 連続スクロール: %d/%d",
                    self.stats.consecutiveScrolls,
                    self.stats.maxConsecutiveScrolls))

                -- スクロール時もプログレス維持
                if self.stats.followedCount > 0 then
                    local progressPercent = math.floor((self.stats.followedCount / Config.PROCESS.MAX_FOLLOW_COUNT) * 100)
                    toast(string.format("🔍 探索中... %d/%d (%d%%)",
                        self.stats.followedCount,
                        Config.PROCESS.MAX_FOLLOW_COUNT,
                        progressPercent
                    ), 1)
                end

                -- 連続スクロール回数チェック
                if self.stats.consecutiveScrolls >= self.stats.maxConsecutiveScrolls then
                    log("⚠️ 連続スクロール上限に到達 - フォロー可能なユーザーが見つかりません")
                    toast("⚠️ フォロー可能なユーザーがいません", 2)
                    self.isRunning = false
                    return
                end

                FollowActions.scroll()
                Utils.wait(Config.TIMING.BETWEEN_SEARCHES)

                -- スクロール後に再度フォローボタンをチェック
                local checkSuccess, checkResult = pcall(
                    findImage,
                    Config.IMAGE_DETECTION.followbtn.path,
                    1,
                    Config.IMAGE_DETECTION.followbtn.tolerance,
                    Config.IMAGE_DETECTION.followbtn.region
                )

                if checkSuccess and checkResult and #checkResult > 0 then
                    log("🔄 スクロール後にフォローボタンを発見 - 連続スクロールカウントをリセット")
                    self.stats.consecutiveScrolls = 0
                end
            else
                -- フォローボタンを押せた場合は連続カウントをリセット
                if foundFollows then
                    log("✅ フォロー成功 - 連続スクロールカウントをリセット")
                    self.stats.consecutiveScrolls = 0
                end
            end
        end)

        if not success then
            if tostring(err):match("interrupted") then
                log("⚠️ 処理が中断されました")
                INTERRUPTED = true
                break
            else
                -- エラーはすべて中断とみなす（AutoTouchの仕様）
                INTERRUPTED = true
                log("🛑 エラーによる強制終了: " .. tostring(err))
                break
            end
        end

        -- プログレス表示
        if self.stats.totalIterations % 10 == 0 then
            local elapsedTime = os.time() - self.stats.startTime
            log(string.format("⏱️ 経過時間: %d秒 | 進捗: %d/%d",
                elapsedTime,
                self.stats.followedCount,
                Config.PROCESS.MAX_FOLLOW_COUNT
            ))

            -- 10イテレーションごとに詳細状態をtoast表示
            local progressPercent = math.floor((self.stats.followedCount / Config.PROCESS.MAX_FOLLOW_COUNT) * 100)
            local remainingCount = Config.PROCESS.MAX_FOLLOW_COUNT - self.stats.followedCount
            local averageSpeed = self.stats.followedCount / math.max(elapsedTime, 1)  -- 1秒あたりのフォロー数
            local estimatedTime = remainingCount / math.max(averageSpeed, 0.01)  -- 残り時間の推定

            toast(string.format("📊 進捗: %d/%d (%d%%)\n⏱️ 経過: %d秒 | 残り約%d秒",
                self.stats.followedCount,
                Config.PROCESS.MAX_FOLLOW_COUNT,
                progressPercent,
                elapsedTime,
                math.floor(estimatedTime)
            ), 2)
        end
    end

    self:finalize()
end

function App:finalize()
    log("\n=== 実行完了 ===")
    log(string.format("✅ フォロー成功: %d件", self.stats.followedCount))
    log(string.format("⏭️ スキップ: %d件", self.stats.skippedCount))
    log(string.format("❌ エラー: %d件", self.stats.errorCount))

    -- 最終プログレス表示
    local progressBar = ""
    for i = 1, 10 do
        progressBar = progressBar .. "█"
    end

    local finalPercent = math.floor((self.stats.followedCount / Config.PROCESS.MAX_FOLLOW_COUNT) * 100)
    if self.stats.followedCount >= Config.PROCESS.MAX_FOLLOW_COUNT then
        finalPercent = 100
        progressBar = "██████████"
    else
        local barLength = 10
        local filledLength = math.floor(barLength * self.stats.followedCount / Config.PROCESS.MAX_FOLLOW_COUNT)
        progressBar = ""
        for i = 1, barLength do
            if i <= filledLength then
                progressBar = progressBar .. "█"
            else
                progressBar = progressBar .. "░"
            end
        end
    end

    -- 連続スクロールで終了した場合の通知
    if self.stats.consecutiveScrolls >= self.stats.maxConsecutiveScrolls then
        log("📋 終了理由: フォロー可能なユーザーが見つからなくなりました")
        toast("⚠️ フォロー可能なユーザーが見つかりません", 3)
    end

    local elapsedTime = os.time() - self.stats.startTime
    log(string.format("⏱️ 総実行時間: %d秒", elapsedTime))

    -- ログファイルに統計を記録
    Logger.writeSummary(self.stats)

    -- 完了通知とプログレス（常に表示）
    toast(string.format("🎊 自動フォロー完了！\n[%s] %d/%d (%d%%)\n⏱️ 総時間: %d秒",
        progressBar,
        self.stats.followedCount,
        Config.PROCESS.MAX_FOLLOW_COUNT,
        finalPercent,
        elapsedTime
    ), 3)
end

-- ==========================================
-- エントリーポイント
-- ==========================================
local function main()
    -- GUI設定ダイアログ表示
    local settings = showSettingsDialog()

    if not settings then
        toast("❌ キャンセルされました", 2)
        return
    end

    -- アプリケーション初期化と実行
    local success, err = pcall(function()
        App:init(settings)
        App:run()
    end)

    if not success then
        if tostring(err):match("interrupted") then
            INTERRUPTED = true
            toast("⚠️ ユーザーによって中断されました", 2)
            log("スクリプトが正常に中断されました")
            error("interrupted")  -- 上位に伝播
        else
            toast("❌ エラー: " .. tostring(err), 3)
            log("❌ 実行エラー: " .. tostring(err))
        end
    end
end

-- スクリプト実行（最外側のエラーハンドリング）
local globalSuccess, globalErr = pcall(main)
if not globalSuccess then
    if tostring(globalErr):match("interrupted") then
        toast("🛑 強制終了しました", 2)
        print("🛑 スクリプトが強制終了されました")
    else
        toast("❌ エラー: " .. tostring(globalErr), 3)
        print("❌ 致命的エラー: " .. tostring(globalErr))
    end
end