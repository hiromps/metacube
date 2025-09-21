-- ================================
-- MetaCube Main Script with License Manager
-- Version: 2.0.0
-- ================================

local json = require("json")
local http = require("http")

-- Configuration
local API_BASE_URL = "https://metacube-el5.pages.dev/api"
local CACHE_FILE = "/var/mobile/Library/AutoTouch/Scripts/.metacube_cache"
local CACHE_DURATION = 24 * 60 * 60 -- 24 hours

-- 設定ファイルを読み込み
local config = require("config")

-- 必要なライブラリをロード
local timeline = require("functions.timeline")
local follow = require("functions.follow")
local active = require("functions.active")
local utils = require("functions.utils")

-- ================================
-- グローバル変数
-- ================================
local daily_counts = {
    likes = 0,
    follows = 0,
    unfollows = 0,
}

local start_time = os.time()
local errors_count = 0

-- ================================
-- ライセンス管理関数
-- ================================

-- デバイスハッシュ取得
function getDeviceHash()
    local udid = getDeviceID()
    if udid and udid ~= "" then
        return string.sub(udid, 1, 12):upper()
    end

    local mac = getMacAddress()
    if mac and mac ~= "" then
        return string.gsub(mac, ":", ""):sub(1, 12):upper()
    end

    math.randomseed(os.time())
    local hash = ""
    for i = 1, 12 do
        hash = hash .. string.format("%X", math.random(0, 15))
    end
    return hash
end

-- キャッシュ読み込み
function loadCache()
    local file = io.open(CACHE_FILE, "r")
    if not file then return nil end

    local content = file:read("*all")
    file:close()

    if not content or content == "" then return nil end

    local cache = json.decode(content)
    if not cache then return nil end

    -- キャッシュ有効期限チェック
    if cache.expires_at and cache.expires_at > os.time() then
        return cache
    end

    return nil
end

-- キャッシュ保存
function saveCache(data)
    data.cached_at = os.time()
    data.expires_at = os.time() + CACHE_DURATION

    local file = io.open(CACHE_FILE, "w")
    if file then
        file:write(json.encode(data))
        file:close()
    end
end

-- ライセンス検証（初回実行時は自動的に体験期間開始）
function verifyLicense(deviceHash)
    local url = API_BASE_URL .. "/license/verify"
    local headers = { ["Content-Type"] = "application/json" }
    local body = json.encode({ device_hash = deviceHash })

    local response, status = http.post(url, headers, body)

    if status ~= 200 then
        return nil, "サーバー接続エラー (Status: " .. tostring(status) .. ")"
    end

    local data = json.decode(response)
    if not data then
        return nil, "レスポンス解析エラー"
    end

    -- サーバーが初回実行時に自動的に体験期間を開始
    if data.is_valid then
        saveCache(data)
        return data, nil
    else
        return nil, data.message or "ライセンス無効"
    end
end

-- 登録画面表示
function showRegistrationScreen(deviceHash)
    dialog("デバイスハッシュ: " .. deviceHash .. "\n\n" ..
           "このデバイスは未登録です。\n" ..
           "以下のURLで登録してください:\n\n" ..
           "https://metacube-el5.pages.dev/register\n\n" ..
           "登録時にデバイスハッシュを入力してください。\n" ..
           "支払い完了後、このスクリプトを再実行すると\n" ..
           "自動的に3日間の体験期間が開始されます。", 0)
    return false
end

-- 期限切れ画面表示
function showExpiredScreen()
    dialog("体験期間が終了しました。\n\n" ..
           "継続利用するには有料プランへの\n" ..
           "アップグレードが必要です。\n\n" ..
           "https://metacube-el5.pages.dev/dashboard", 0)
    return false
end

-- ライセンスチェック
function checkLicense()
    toast("MetaCube License Manager", 1)

    -- デバイスハッシュ取得
    local deviceHash = getDeviceHash()
    toast("デバイスハッシュ: " .. deviceHash, 1)

    -- キャッシュチェック
    local cache = loadCache()
    if cache and cache.is_valid then
        toast("キャッシュからライセンス確認", 1)

        if cache.status == "trial" and cache.trial_ends_at then
            local trialEnd = tonumber(cache.trial_ends_at)
            if trialEnd and trialEnd > os.time() then
                toast("体験期間: 有効", 2)
                return true
            end
        elseif cache.status == "active" then
            toast("ライセンス: 有効", 2)
            return true
        end
    end

    -- サーバーで検証（初回実行時は自動的に体験期間開始）
    toast("サーバーでライセンス確認中...", 1)
    local result, error = verifyLicense(deviceHash)

    if error then
        if string.find(error, "not registered") or string.find(error, "not found") then
            return showRegistrationScreen(deviceHash)
        else
            dialog("エラー: " .. error, 0)
            return false
        end
    end

    if not result.is_valid then
        if result.status == "expired" then
            return showExpiredScreen()
        elseif result.status == "unregistered" then
            return showRegistrationScreen(deviceHash)
        else
            dialog("ライセンス無効\nステータス: " .. (result.status or "unknown"), 0)
            return false
        end
    end

    -- 体験期間開始メッセージ表示（初回のみ）
    if result.status == "trial" and result.message and string.find(result.message, "activated") then
        dialog("🎉 体験期間が開始されました！\n\n" ..
               "3日間すべての機能をご利用いただけます。\n" ..
               "期限: " .. (result.trial_ends_at or "不明"), 0)
    elseif result.status == "trial" then
        toast("体験期間: 有効", 2)
    elseif result.status == "active" then
        toast("ライセンス: 有効", 2)
    end

    return true
end

-- ================================
-- メイン処理
-- ================================
function main()
    -- ライセンスチェック
    if not checkLicense() then
        utils.log("error", "License verification failed")
        return
    end

    -- 初期化
    utils.log("info", "MetaCube Starting...")
    utils.log("info", "Plan: " .. config.plan)

    -- Instagramアプリを起動
    if not launchInstagram() then
        utils.log("error", "Failed to launch Instagram")
        return
    end

    -- プランに応じた処理を実行
    while true do
        -- 時間チェック
        if not isActiveHour() then
            utils.log("info", "Outside active hours. Sleeping...")
            sleep(3600) -- 1時間待機
            goto continue
        end

        -- 日付が変わったらカウントリセット
        checkDailyReset()

        -- プラン別の処理
        if config.plan == "basic" then
            executeBasicPlan()
        elseif config.plan == "standard" then
            executeStandardPlan()
        elseif config.plan == "premium" then
            executePremiumPlan()
        else
            utils.log("error", "Invalid plan: " .. config.plan)
            break
        end

        -- エラーチェック
        if errors_count >= config.safety.stop_on_errors then
            utils.log("error", "Too many errors. Stopping...")
            break
        end

        ::continue::
    end
end

-- ================================
-- プラン別処理
-- ================================

-- ベーシックプラン: タイムラインいいねのみ
function executeBasicPlan()
    utils.log("info", "Executing Basic Plan")

    -- デイリーリミットチェック
    if daily_counts.likes >= config.settings.daily_limits.likes then
        utils.log("info", "Daily like limit reached")
        sleep(3600) -- 1時間待機
        return
    end

    -- タイムラインいいね実行
    local success = timeline.performLike()

    if success then
        daily_counts.likes = daily_counts.likes + 1
        utils.log("info", "Likes today: " .. daily_counts.likes)
    else
        errors_count = errors_count + 1
    end

    -- インターバル
    local interval = utils.randomBetween(
        config.settings.intervals.like_min,
        config.settings.intervals.like_max
    )
    sleep(interval)
end

-- スタンダードプラン: いいね＋フォロー/アンフォロー
function executeStandardPlan()
    utils.log("info", "Executing Standard Plan")

    -- アクション選択（ランダム）
    local action = math.random(1, 100)

    if action <= 60 then
        -- 60%: いいね
        if daily_counts.likes < config.settings.daily_limits.likes then
            if timeline.performLike() then
                daily_counts.likes = daily_counts.likes + 1
            else
                errors_count = errors_count + 1
            end
        end
    elseif action <= 80 then
        -- 20%: フォロー
        if daily_counts.follows < config.settings.daily_limits.follows then
            if follow.performFollow() then
                daily_counts.follows = daily_counts.follows + 1
            else
                errors_count = errors_count + 1
            end
        end
    else
        -- 20%: アンフォロー
        if daily_counts.unfollows < config.settings.daily_limits.unfollows then
            if follow.performUnfollow() then
                daily_counts.unfollows = daily_counts.unfollows + 1
            else
                errors_count = errors_count + 1
            end
        end
    end

    -- ステータス表示
    utils.log("info", string.format(
        "Today: Likes=%d, Follows=%d, Unfollows=%d",
        daily_counts.likes,
        daily_counts.follows,
        daily_counts.unfollows
    ))

    -- インターバル
    local interval = utils.randomBetween(
        config.settings.intervals.like_min,
        config.settings.intervals.follow_max
    )
    sleep(interval)
end

-- プレミアムプラン: 全機能（アクティブユーザーいいね含む）
function executePremiumPlan()
    utils.log("info", "Executing Premium Plan")

    -- アクション選択（高度な戦略）
    local action = math.random(1, 100)

    if action <= 40 then
        -- 40%: タイムラインいいね
        if timeline.performLike() then
            daily_counts.likes = daily_counts.likes + 1
        else
            errors_count = errors_count + 1
        end
    elseif action <= 60 then
        -- 20%: アクティブユーザーいいね
        local hashtag = config.targets.hashtags[math.random(#config.targets.hashtags)]
        if active.likeByHashtag(hashtag) then
            daily_counts.likes = daily_counts.likes + 1
        else
            errors_count = errors_count + 1
        end
    elseif action <= 75 then
        -- 15%: ターゲットフォロー
        if active.followTargetUsers() then
            daily_counts.follows = daily_counts.follows + 1
        else
            errors_count = errors_count + 1
        end
    elseif action <= 90 then
        -- 15%: スマートアンフォロー
        if follow.smartUnfollow() then
            daily_counts.unfollows = daily_counts.unfollows + 1
        else
            errors_count = errors_count + 1
        end
    else
        -- 10%: 探索タブ巡回
        active.exploreAndEngage()
    end

    -- ステータス表示
    utils.log("info", string.format(
        "Premium Stats: L=%d, F=%d, U=%d, Errors=%d",
        daily_counts.likes,
        daily_counts.follows,
        daily_counts.unfollows,
        errors_count
    ))

    -- インターバル（よりランダムに）
    local interval = utils.randomBetween(
        config.settings.intervals.like_min,
        config.settings.intervals.follow_max
    )
    if config.safety.randomize then
        interval = interval + math.random(-5, 10)
    end
    sleep(interval)
end

-- ================================
-- ヘルパー関数
-- ================================

-- Instagramアプリを起動
function launchInstagram()
    utils.log("info", "Launching Instagram...")
    appRun("com.instagram.ios")
    sleep(5)

    -- ホーム画面に戻っているか確認
    if not utils.findElement("feed_tab") then
        utils.log("warning", "Not on home feed, attempting to navigate...")
        tap(50, 800) -- ホームタブをタップ
        sleep(2)
    end

    return true
end

-- アクティブ時間かチェック
function isActiveHour()
    local hour = tonumber(os.date("%H"))
    return hour >= config.settings.active_hours.start and
           hour < config.settings.active_hours.stop
end

-- 日付変更チェック
function checkDailyReset()
    local current_date = os.date("%Y-%m-%d")
    local saved_date = utils.loadData("last_date")

    if current_date ~= saved_date then
        utils.log("info", "New day detected. Resetting counters...")
        daily_counts.likes = 0
        daily_counts.follows = 0
        daily_counts.unfollows = 0
        errors_count = 0
        utils.saveData("last_date", current_date)
    end
end

-- ================================
-- エラーハンドリング
-- ================================
local status, err = pcall(main)
if not status then
    utils.log("error", "Fatal error: " .. tostring(err))

    if config.safety.auto_restart then
        utils.log("info", "Auto-restarting in 30 seconds...")
        sleep(30)
        restart()
    end
end

-- ================================
-- 終了処理
-- ================================
utils.log("info", "MetaCube stopped")
if config.notifications.on_complete then
    alert("MetaCube: 処理が完了しました")
end