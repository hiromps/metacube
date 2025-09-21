-- ================================
-- Timeline Functions
-- タイムラインいいね機能
-- ================================

local utils = require("functions.utils")

local timeline = {}

-- タイムラインで投稿にいいね
function timeline.performLike()
    utils.log("debug", "Performing timeline like...")

    -- 投稿を探す
    local post = findPost()
    if not post then
        utils.log("warning", "No post found to like")
        scrollFeed()
        return false
    end

    -- すでにいいね済みかチェック
    if isAlreadyLiked(post) then
        utils.log("debug", "Post already liked, skipping...")
        scrollFeed()
        return false
    end

    -- ダブルタップでいいね
    if doubleTapPost(post) then
        utils.log("info", "Successfully liked post")
        sleep(1) -- アニメーション待機
        scrollFeed()
        return true
    else
        utils.log("error", "Failed to like post")
        return false
    end
end

-- 投稿を探す
function findPost()
    -- 画面中央付近の投稿を探す
    local screen_width = getScreenResolution()
    local center_x = screen_width / 2
    local center_y = 400

    -- 投稿エリアの色をチェック（白背景を想定）
    local color = getColor(center_x, center_y)
    if color > 0xF0F0F0 then -- 白に近い色
        return {x = center_x, y = center_y}
    end

    return nil
end

-- すでにいいね済みかチェック
function isAlreadyLiked(post)
    -- いいねボタンの位置（投稿の下部左側）
    local like_button_x = 50
    local like_button_y = post.y + 200

    -- 赤色（いいね済み）かチェック
    local color = getColor(like_button_x, like_button_y)
    local red = bit32.band(bit32.rshift(color, 16), 0xFF)

    return red > 200 -- 赤っぽい色
end

-- ダブルタップでいいね
function doubleTapPost(post)
    -- 高速ダブルタップ
    tap(post.x, post.y)
    usleep(100000) -- 0.1秒
    tap(post.x, post.y)

    -- 成功確認（ハートアニメーション検出）
    sleep(0.5)
    return true -- 簡略化のため常に成功とする
end

-- フィードをスクロール
function scrollFeed()
    local screen_width = getScreenResolution()
    local start_y = 600
    local end_y = 200
    local duration = 0.5

    -- 上方向にスワイプ
    swipe(
        screen_width / 2, start_y,
        screen_width / 2, end_y,
        duration
    )

    -- ランダムな待機時間
    sleep(utils.randomBetween(1, 3))
end

return timeline