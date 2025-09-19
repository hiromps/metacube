-- --------------------------------------
-- Instagram 自動アンフォローツール (フロー制御版)
-- 画像0001→0002の遷移とfollowdialog.png検出による分岐
-- --------------------------------------

-- Enable proper logging
print = log

-- ========================================
-- GUIダイアログ設定
-- ========================================
local function showSettingsDialog()
    local controls = {
        -- タイトルラベル
        {
            type = CONTROLLER_TYPE.LABEL,
            text = "📱 Instagram 自動アンフォロー 📱"
        },

        -- セパレーター
        {
            type = CONTROLLER_TYPE.LABEL,
            text = "━━━━━━━━━━━━━━━━━━━"
        },

        -- 繰り返し回数
        {
            type = CONTROLLER_TYPE.INPUT,
            title = "🔄 繰り返し回数:",
            key = "repeatCount",
            value = "10"
        },

        -- 待機時間
        {
            type = CONTROLLER_TYPE.INPUT,
            title = "⏱️ 待機時間(秒):",
            key = "waitTime",
            value = "3"
        },

        -- 実行速度
        {
            type = CONTROLLER_TYPE.PICKER,
            title = "⚡ 実行速度:",
            key = "speed",
            value = "通常",
            options = {"高速", "通常", "低速"}
        },

        -- デバッグモード
        {
            type = CONTROLLER_TYPE.SWITCH,
            title = "🔍 デバッグモード:",
            key = "debug",
            value = 1  -- 1=ON, 0=OFF
        },

        -- ダイアログスキップ
        {
            type = CONTROLLER_TYPE.SWITCH,
            title = "⏭️ ダイアログ自動スキップ:",
            key = "autoSkip",
            value = 1  -- 1=ON, 0=OFF
        },

        -- セパレーター
        {
            type = CONTROLLER_TYPE.LABEL,
            text = "━━━━━━━━━━━━━━━━━━━"
        },

        -- ボタン（緑色の開始ボタン）
        {
            type = CONTROLLER_TYPE.BUTTON,
            title = "🚀 開始",
            color = 0x68D391,
            width = 0.5,
            flag = 1,
            collectInputs = true
        },

        -- ボタン（赤色のキャンセルボタン）
        {
            type = CONTROLLER_TYPE.BUTTON,
            title = "❌ キャンセル",
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

    if result == 1 then  -- 開始ボタン
        -- 入力値を取得して設定に反映
        local settings = {
            repeatCount = tonumber(controls[3].value) or 10,
            waitTime = tonumber(controls[4].value) or 3,
            speed = controls[5].value,
            debug = controls[6].value == 1,
            autoSkip = controls[7].value == 1
        }

        -- 速度設定の変換
        local speedMultiplier = 1.0
        if settings.speed == "高速" then
            speedMultiplier = 0.5
        elseif settings.speed == "低速" then
            speedMultiplier = 1.5
        end

        return true, settings, speedMultiplier
    else
        return false, nil, nil
    end
end

-- ========================================
-- 設定
-- ========================================
local Config = {
    -- 座標定義
    UI = {
        -- 画像0001 (メニュー画面)
        MENU = {
            PROFILE_BUTTON = {x = 693.84, y = 103.28},  -- プロフィールボタン（最初にタップ）
            RESTRICT = {x = 375, y = 152},
            BLOCK = {x = 375, y = 262},
            UNFOLLOW = {x = 375, y = 800},
            CANCEL = {x = 375, y = 1250},
            BACK_BUTTON = {x = 26.68, y = 90.03}
        },

        -- 画像0002 (プロフィール画面)
        PROFILE = {
            BACK_BUTTON = {x = 35, y = 90},
            MORE_OPTIONS = {x = 700, y = 90},
            FOLLOWING_BUTTON = {x = 187, y = 628},
            MESSAGE_BUTTON = {x = 472, y = 628},
            POSTS_COUNT = {x = 256, y = 238},
            FOLLOWERS_COUNT = {x = 439, y = 238},
            FOLLOWING_COUNT = {x = 643, y = 238}
        }
    },

    -- 画像パス
    IMAGES = {
        FOLLOW_DIALOG = "image/followdialog.png",  -- フォローダイアログ検出用
        FOLLOW_STATE = "image/followstate.png"      -- フォロー状態画像
    },

    -- タイミング設定
    TIMING = {
        SCREEN_TRANSITION = 2000000,  -- 画面遷移待機: 2秒
        AFTER_TAP = 1500000,          -- タップ後待機: 1.5秒
        IMAGE_DETECTION = 1000000,     -- 画像検出待機: 1秒
        MENU_ANIMATION = 500000,       -- メニューアニメーション: 0.5秒
        TAP_DELAY = 50000             -- タップ間隔: 0.05秒
    },

    -- 処理設定
    PROCESS = {
        MAX_RETRIES = 3,              -- 最大リトライ回数
        BATCH_SIZE = 10,              -- バッチサイズ
        SKIP_CHANCE = 0.1,            -- スキップ確率
        DEBUG_MODE = true             -- デバッグモード
    }
}

-- ========================================
-- 状態管理
-- ========================================
local State = {
    currentScreen = "unknown",  -- unknown, menu, profile, dialog
    lastAction = nil,
    processedCount = 0,
    skippedCount = 0,
    errorCount = 0,
    followDialogDetected = false,
    retryCount = 0
}

-- ========================================
-- ヘルパー関数
-- ========================================

local function wait(microseconds)
    usleep(microseconds)
end

local function tap(x, y, description)
    touchDown(0, x, y)
    wait(Config.TIMING.TAP_DELAY)
    touchUp(0, x, y)

    if description then
        log(string.format("📍 %s をタップ (%.2f, %.2f)", description, x, y))
        toast(string.format("📍 %s", description), 1)
    end
end

local function debugLog(message)
    if Config.PROCESS.DEBUG_MODE then
        log(string.format("[DEBUG] %s", message))
    end
end

-- ========================================
-- 精密スクロール関数
-- ========================================
local function performPreciseScroll()
    log("📜 精密スクロールを実行中...")
    toast("📜 スクロール中...", 1)

    -- エラーハンドリングを追加
    local success, err = pcall(function()
        touchDown(5, 329.46, 902.51)
        usleep(66255.17)
        touchMove(5, 336.65, 892.33)
        usleep(16848.12)
        touchMove(5, 339.73, 887.24)
        usleep(16405.62)
        touchMove(5, 343.84, 883.17)
        usleep(16709.71)
        touchMove(5, 347.95, 878.08)
        usleep(16681.08)
        touchMove(5, 351.02, 874.01)
        usleep(16716.42)
        touchMove(5, 354.10, 870.96)
        usleep(16640.75)
        touchMove(5, 356.15, 867.89)
        usleep(16867.75)
        touchMove(5, 359.23, 864.83)
        usleep(16620.96)
        touchMove(5, 361.29, 861.78)
        usleep(16518.75)
        touchMove(5, 363.34, 858.73)
        usleep(16982.79)
        touchMove(5, 366.42, 854.65)
        usleep(16456.71)
        touchMove(5, 369.50, 850.58)
        usleep(16506.17)
        touchMove(5, 371.56, 847.53)
        usleep(16809.75)
        touchMove(5, 374.63, 844.48)
        usleep(16677.54)
        touchMove(5, 376.68, 841.42)
        usleep(16605.54)
        touchMove(5, 378.73, 839.39)
        usleep(16914.96)
        touchMove(5, 379.76, 837.35)
        usleep(16536.96)
        touchMove(5, 381.82, 834.30)
        usleep(16590.96)
        touchMove(5, 384.90, 831.25)
        usleep(16620.62)
        touchMove(5, 389.00, 827.18)
        usleep(16641.96)
        touchMove(5, 393.10, 824.12)
        usleep(16555.12)
        touchMove(5, 397.21, 821.07)
        usleep(17010.38)
        touchMove(5, 401.32, 817.00)
        usleep(16387.62)
        touchMove(5, 405.42, 813.92)
        usleep(16678.58)
        touchMove(5, 410.56, 810.87)
        usleep(16784.83)
        touchMove(5, 414.67, 807.82)
        usleep(16745.42)
        touchMove(5, 418.76, 804.76)
        usleep(16445.00)
        touchMove(5, 422.87, 801.71)
        usleep(16827.50)
        touchMove(5, 425.95, 798.66)
        usleep(16607.42)
        touchMove(5, 429.03, 795.60)
        usleep(16487.46)
        touchMove(5, 432.11, 792.55)
        usleep(16764.71)
        touchMove(5, 435.18, 788.48)
        usleep(16607.67)
        touchMove(5, 437.24, 785.43)
        usleep(16648.00)
        touchMove(5, 440.32, 782.37)
        usleep(16929.29)
        touchMove(5, 442.37, 780.34)
        usleep(16594.50)
        touchMove(5, 445.45, 777.28)
        usleep(16502.25)
        touchMove(5, 448.53, 775.25)
        usleep(16792.08)
        touchMove(5, 450.59, 772.20)
        usleep(16530.21)
        touchMove(5, 454.69, 769.14)
        usleep(16679.08)
        touchMove(5, 457.76, 766.09)
        usleep(16748.17)
        touchMove(5, 461.87, 764.05)
        usleep(16706.33)
        touchMove(5, 464.95, 762.02)
        usleep(16689.29)
        touchMove(5, 467.01, 759.98)
        usleep(16730.46)
        touchMove(5, 470.09, 757.93)
        usleep(16690.83)
        touchMove(5, 473.17, 756.91)
        usleep(16607.38)
        touchMove(5, 474.19, 754.87)
        usleep(17043.21)
        touchMove(5, 475.22, 754.87)
        usleep(16192.21)
        touchMove(5, 476.25, 753.86)
        usleep(16750.54)
        touchMove(5, 477.28, 752.84)
        usleep(16712.62)
        touchMove(5, 478.29, 752.84)
        usleep(16540.12)
        touchMove(5, 479.32, 751.82)
        usleep(33471.88)
        touchMove(5, 480.35, 750.80)
        usleep(33228.88)
        touchMove(5, 481.37, 750.80)
        usleep(16793.00)
        touchMove(5, 482.40, 749.78)
        usleep(16668.50)
        touchMove(5, 482.40, 748.77)
        usleep(16445.79)
        touchMove(5, 483.43, 748.77)
        usleep(50059.00)
        touchMove(5, 483.43, 747.75)
        usleep(16778.71)
        touchMove(5, 484.45, 747.75)
        usleep(16581.46)
        touchMove(5, 485.48, 746.73)
        usleep(16762.12)
        touchMove(5, 486.51, 745.71)
        usleep(16895.50)
        touchMove(5, 487.53, 744.70)
        usleep(33025.50)
        touchMove(5, 488.56, 743.68)
        usleep(16708.75)
        touchMove(5, 488.56, 742.66)
        usleep(16669.38)
        touchMove(5, 489.59, 742.66)
        usleep(33422.58)
        touchMove(5, 490.61, 741.64)
        usleep(16590.67)
        touchMove(5, 491.64, 740.62)
        usleep(16715.71)
        touchMove(5, 492.67, 739.61)
        usleep(33365.33)
        touchMove(5, 493.70, 738.59)
        usleep(33376.75)
        touchMove(5, 494.72, 738.59)
        usleep(16637.67)
        touchMove(5, 494.72, 737.57)
        usleep(49987.88)
        touchMove(5, 495.75, 737.57)
        usleep(16512.88)
        touchMove(5, 495.75, 736.55)
        usleep(33522.83)
        touchMove(5, 496.78, 735.54)
        usleep(16670.71)
        touchMove(5, 496.78, 734.52)
        usleep(33221.75)
        touchMove(5, 497.80, 733.50)
        usleep(50040.29)
        touchMove(5, 497.80, 732.48)
        usleep(367921.25)
        touchUp(5, 499.86, 731.46)
    end)

    if not success then
        log(string.format("⚠️ スクロール中断: %s", tostring(err)))
        toast("⚠️ スクロール中断", 1)
        return false
    end

    log("✅ スクロール完了: (329.46, 902.51) → (499.86, 731.46)")
    usleep(Config.TIMING.AFTER_TAP or 1500000)
    return true
end

-- ========================================
-- 画像検出関数
-- ========================================

local function detectImage(imagePath, threshold)
    threshold = threshold or 0.9
    debugLog(string.format("画像検出中: %s", imagePath))

    local result = findImage(imagePath, 1, threshold)

    if result then
        local x, y
        if type(result) == "table" and result[1] then
            if type(result[1]) == "table" then
                x, y = result[1][1], result[1][2]
            else
                x, y = result[1], result[2]
            end
        end

        if x and y then
            debugLog(string.format("画像検出成功: %s at (%.2f, %.2f)", imagePath, x, y))
            return true, x, y
        end
    end

    debugLog(string.format("画像検出失敗: %s", imagePath))
    return false, nil, nil
end

-- ========================================
-- 分岐処理 (先に定義)
-- ========================================

local function handleFollowDialogCase(x, y)
    log("📋 フォローダイアログ処理を実行...")
    toast("📋 ダイアログ処理モード", 2)

    -- フォローダイアログが検出されたら必ずキャンセルして戻る
    log("🔙 フォローダイアログを閉じて戻ります")

    -- 1. キャンセルボタンをタップ
    log("📍 キャンセルボタンをタップ")
    tap(Config.UI.MENU.CANCEL.x, Config.UI.MENU.CANCEL.y, "キャンセルボタン")
    wait(Config.TIMING.AFTER_TAP)

    -- 2. 戻るボタンをタップ
    log("📍 戻るボタンをタップ")
    tap(Config.UI.MENU.BACK_BUTTON.x, Config.UI.MENU.BACK_BUTTON.y, "戻るボタン")
    wait(Config.TIMING.SCREEN_TRANSITION)

    -- 3. 精密スクロールを実行
    log("📜 戻った後にスクロールを実行")
    performPreciseScroll()

    State.skippedCount = State.skippedCount + 1
    toast("✅ キャンセル→戻る→スクロール完了", 2)

    return "skipped_and_scrolled"
end

local function handleNoDialogCase()
    log("👤 通常のプロフィール処理を実行...")
    log("📍 followdialog.png が検出されなかったため、指定座標をタップします")
    toast("👤 検出なし → 特定処理実行", 2)

    -- 検出なしの場合の特定タップ処理
    log("🎯 座標 (394.13, 1242.56) をタップ ID:2")

    -- 指定された正確なタッチシーケンス
    touchDown(2, 394.13, 1242.56)
    usleep(84604.33)
    touchUp(2, 394.13, 1242.56)

    log("✅ タップ完了: (394.13, 1242.56) with ID:2, 待機時間: 84.6ms")
    toast("✅ 特定座標タップ完了", 2)

    -- タップ後の待機
    wait(Config.TIMING.AFTER_TAP)

    -- followstate.png を検出してタップ
    log("🔍 followstate.png を検出中...")
    local stateDetected, stateX, stateY = detectImage(Config.IMAGES.FOLLOW_STATE, 0.9)

    if stateDetected then
        log(string.format("✅ followstate.png を検出: (%.2f, %.2f)", stateX, stateY))
        toast("📍 followstate.png 検出", 2)

        -- followstate.png をタップ
        log(string.format("🎯 followstate.png をタップ: (%.2f, %.2f)", stateX, stateY))
        touchDown(0, stateX, stateY)
        wait(Config.TIMING.TAP_DELAY)
        touchUp(0, stateX, stateY)

        log("✅ followstate.png をタップしました")
        toast("✅ フォロー状態ボタンタップ完了", 2)

        -- タップ後の待機
        wait(Config.TIMING.AFTER_TAP)
        touchDown(2, 168.32, 1174.35);
        usleep(82754.29);
        touchUp(2, 168.32, 1174.35);
        log("🔙 一覧に戻る: (21.55, 88.00) with ID:1")
        wait(1500000);  -- 1.5秒待機
        touchDown(1, 21.55, 88.00);
        usleep(82886.25);
        touchUp(1, 21.55, 88.00);
        log("⏱ 待機時間: 82.9ms")
        wait(1500000);  -- 1.5秒待機

        -- 戻るボタンを押した後に精密スクロールを実行
        performPreciseScroll()

        State.processedCount = State.processedCount + 1
        return "unfollowed"
    else
        log("❌ followstate.png が見つかりません")
        toast("❌ followstate.png 未検出", 2)

        -- followstate.png が見つからない場合は別の処理
        log("⚠️ 代替処理: プロフィール画面の標準位置をタップ")

        -- フォロー中ボタンの推定位置をタップ
        tap(Config.UI.PROFILE.FOLLOWING_BUTTON.x, Config.UI.PROFILE.FOLLOWING_BUTTON.y, "フォロー中ボタン（推定位置）")
        wait(Config.TIMING.AFTER_TAP)

        State.skippedCount = State.skippedCount + 1
        return "skipped"
    end
end

-- ========================================
-- メインフロー: 0001 → 0002 遷移
-- ========================================

local function step0_tapInitialButton()
    log("=== ステップ0: 0000.PNGから開始 ===")
    log("初期画面の座標 (241.20, 1183.51) をタップします")
    toast("📱 初期画面から開始", 2)

    -- 0000.PNGの指定座標をタップ
    touchDown(1, 241.20, 1183.51)
    usleep(115987.29)
    touchUp(1, 241.20, 1183.51)

    log("✅ 初期座標をタップしました: (241.20, 1183.51)")

    -- 画面遷移を待つ
    wait(Config.TIMING.SCREEN_TRANSITION)

    return true
end

local function step1_tapProfileButton()
    log("=== ステップ1: プロフィールボタンをタップ ===")
    log("画像0001の座標 (693.84, 103.28) をタップします")

    -- プロフィールボタンをタップ
    tap(Config.UI.MENU.PROFILE_BUTTON.x, Config.UI.MENU.PROFILE_BUTTON.y, "プロフィールボタン")

    -- 画面遷移を待つ
    wait(Config.TIMING.SCREEN_TRANSITION)

    State.currentScreen = "transitioning"
    log("✅ プロフィールボタンをタップしました")
    toast("👤 プロフィール画面へ遷移中...", 2)

    return true
end

local function step2_detectFollowDialog()
    log("=== ステップ2: followdialog.png を検出 ===")
    log("画像0002が表示されたか確認中...")

    -- 少し待機してから検出
    wait(Config.TIMING.IMAGE_DETECTION)

    -- followdialog.png を検出
    local detected, x, y = detectImage(Config.IMAGES.FOLLOW_DIALOG, 0.9)

    if detected then
        State.followDialogDetected = true
        State.currentScreen = "dialog"
        log("✅ followdialog.png を検出しました")
        toast("📋 フォローダイアログ検出", 2)
        return true, x, y
    else
        State.followDialogDetected = false
        State.currentScreen = "profile"
        log("❌ followdialog.png が見つかりません")
        toast("👤 通常のプロフィール画面", 2)
        return false, nil, nil
    end
end

local function step3_branchByDialog(dialogDetected, x, y)
    log("=== ステップ3: 検出結果による分岐処理 ===")

    if dialogDetected then
        log("🔀 分岐A: フォローダイアログが検出された場合の処理")
        return handleFollowDialogCase(x, y)
    else
        log("🔀 分岐B: フォローダイアログが検出されなかった場合の処理")
        return handleNoDialogCase()
    end
end

-- ========================================
-- 完全なフロー実行
-- ========================================

local function executeFullFlow()
    log("=== 🚀 フロー実行開始 ===")
    toast("🚀 自動処理開始", 3)

    -- ステップ0: 0000.PNGから開始
    local step0Success = step0_tapInitialButton()

    if not step0Success then
        log("❌ ステップ0失敗")
        State.errorCount = State.errorCount + 1
        return false
    end

    -- ステップ1: プロフィールボタンをタップ (0001 → 0002)
    local step1Success = step1_tapProfileButton()

    if not step1Success then
        log("❌ ステップ1失敗")
        State.errorCount = State.errorCount + 1
        return false
    end

    -- ステップ2: followdialog.png を検出
    local dialogDetected, x, y = step2_detectFollowDialog()

    -- ステップ3: 検出結果による分岐処理
    local result = step3_branchByDialog(dialogDetected, x, y)

    log(string.format("=== フロー完了: %s ===", result))
    showStatistics()

    return result
end

-- ========================================
-- バッチ処理
-- ========================================

local function processBatch(count)
    log(string.format("=== 📦 バッチ処理開始 (%d件) ===", count))
    toast(string.format("📦 %d件処理", count), 2)

    for i = 1, count do
        log(string.format("--- 処理 %d/%d ---", i, count))

        -- フロー実行
        local result = executeFullFlow()

        -- エラーチェック
        if result == "error" then
            State.retryCount = State.retryCount + 1
            if State.retryCount >= Config.PROCESS.MAX_RETRIES then
                log("🚨 最大リトライ回数に達しました")
                break
            end
        else
            State.retryCount = 0
        end

        -- 次の処理への遷移
        if i < count then
            -- リストに戻るなどの処理
            tap(Config.UI.PROFILE.BACK_BUTTON.x, Config.UI.PROFILE.BACK_BUTTON.y, "戻る")
            wait(Config.TIMING.SCREEN_TRANSITION)

            -- 次のアイテムを選択
            local nextY = 200 + (i * 80)
            if nextY > 1000 then
                -- スクロール
                swipe(375, 900, 375, 400, 500000)
                wait(1000000)
                nextY = 200
            end
            tap(375, nextY, "次のプロフィール")
            wait(Config.TIMING.SCREEN_TRANSITION)
        end

        -- ランダム待機
        local delay = math.random(3000000, 6000000)
        wait(delay)
    end

    log("=== 📦 バッチ処理完了 ===")
end

-- ========================================
-- 統計表示
-- ========================================

function showStatistics()
    log("━━━━━━━━━━━━━━━━━━━━━━")
    log("📊 処理統計")
    log(string.format("✅ 処理済み: %d件", State.processedCount))
    log(string.format("⏭️ スキップ: %d件", State.skippedCount))
    log(string.format("❌ エラー: %d件", State.errorCount))
    log(string.format("📋 ダイアログ検出: %s", State.followDialogDetected and "あり" or "なし"))
    log("━━━━━━━━━━━━━━━━━━━━━━")
end

-- ========================================
-- メイン実行
-- ========================================

local function main()
    log("=== 🤖 Instagram 自動アンフォロー (GUI版) ===")
    toast("🤖 設定画面を表示します", 2)

    -- GUIダイアログを表示
    local dialogSuccess, settings, speedMultiplier = showSettingsDialog()

    if not dialogSuccess then
        log("❌ キャンセルされました")
        toast("❌ 処理をキャンセルしました", 3)
        return
    end

    -- 設定を反映
    Config.PROCESS.DEBUG_MODE = settings.debug

    -- タイミング設定に速度倍率を適用
    for key, value in pairs(Config.TIMING) do
        Config.TIMING[key] = math.floor(value * speedMultiplier)
    end

    log("=== 📋 設定内容 ===")
    log(string.format("繰り返し回数: %d回", settings.repeatCount))
    log(string.format("待機時間: %d秒", settings.waitTime))
    log(string.format("実行速度: %s", settings.speed))
    log(string.format("デバッグモード: %s", settings.debug and "ON" or "OFF"))
    log(string.format("ダイアログ自動スキップ: %s", settings.autoSkip and "ON" or "OFF"))
    log("==================")

    toast(string.format("🚀 %d回繰り返し実行します", settings.repeatCount), 3)

    -- 初期化
    math.randomseed(os.time())

    -- 繰り返し実行（中断対応）
    for i = 1, settings.repeatCount do
        -- 中断チェック用のpcall
        local loopSuccess, loopErr = pcall(function()
            log(string.format("=== 🔄 実行 %d/%d ===", i, settings.repeatCount))
            toast(string.format("🔄 実行中 %d/%d", i, settings.repeatCount), 2)

            -- フロー実行
            local result = executeFullFlow()

            -- エラーチェック
            if result == "error" then
                State.retryCount = State.retryCount + 1
                if State.retryCount >= Config.PROCESS.MAX_RETRIES then
                    log("🚨 最大リトライ回数に達しました")
                    toast("🚨 エラーが続いたため処理を中断します", 3)
                    return false  -- ループを抜ける
                end
            else
                State.retryCount = 0
            end

            -- 次の実行まで待機（最後の実行後は待機しない）
            if i < settings.repeatCount then
                log(string.format("⏱️ %d秒待機中...", settings.waitTime))
                toast(string.format("⏱️ 次の実行まで%d秒待機", settings.waitTime), settings.waitTime)

                -- 待機時間を小さく分割して中断可能にする
                local waitSteps = settings.waitTime * 10  -- 0.1秒ごとにチェック
                for j = 1, waitSteps do
                    usleep(100000)  -- 0.1秒
                end
            end

            -- 進捗表示
            if i % 5 == 0 then  -- 5回ごとに統計を表示
                showStatistics()
            end
        end)

        if not loopSuccess then
            log(string.format("⚠️ ループ %d で中断: %s", i, tostring(loopErr)))
            if string.find(tostring(loopErr), "interrupted") then
                log("🛑 ユーザーによる中断を検出しました")
                toast("🛑 処理を中断しました", 3)
                break
            end
        end

        if loopSuccess == false then  -- 最大リトライで抜けた場合
            break
        end
    end

    -- 最終統計
    log("=== 📊 最終結果 ===")
    showStatistics()

    log("=== 🏁 全処理完了 ===")
    toast(string.format("🏁 完了 (%d件処理)", State.processedCount), 5)

    -- 結果ダイアログ表示
    local resultMessage = string.format(
        "処理が完了しました\n\n" ..
        "✅ 処理済み: %d件\n" ..
        "⏭️ スキップ: %d件\n" ..
        "❌ エラー: %d件",
        State.processedCount,
        State.skippedCount,
        State.errorCount
    )

    alert(resultMessage)
end

-- ========================================
-- エラーハンドリング付き実行
-- ========================================

local success, err = pcall(main)

if not success then
    log(string.format("🚨 エラー発生: %s", tostring(err)))
    toast("🚨 エラーが発生しました", 5)

    -- スクリーンショット保存
    screenshot(string.format("error_%d.png", os.time()))

    -- 統計表示
    showStatistics()

    -- エラーダイアログ
    alert(string.format("エラーが発生しました\n\n%s", tostring(err)))
end

-- スタンドアロン実行用（エクスポートは削除）