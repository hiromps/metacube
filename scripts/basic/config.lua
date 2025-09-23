-- ================================
-- smartgram ベーシックプラン設定
-- ================================

return {
    -- プラン
    plan = "basic",

    -- 動作設定
    settings = {
        daily_limits = {
            likes = 500,      -- 1日500いいねまで
            follows = 0,      -- フォロー機能なし
            unfollows = 0,    -- アンフォロー機能なし
        },

        intervals = {
            like_min = 20,    -- いいね最小間隔
            like_max = 40,    -- いいね最大間隔
            scroll_min = 5,
            scroll_max = 10,
        },

        active_hours = {
            start = 9,
            stop = 22,
        },
    },

    -- 安全設定
    safety = {
        max_retries = 3,
        stop_on_errors = 5,
        auto_restart = true,
        randomize = true,
    },

    -- ログ設定
    logging = {
        enabled = true,
        level = "info",
        file_path = "smartgram_log.txt",
    },

    notifications = {
        on_complete = true,
        on_error = true,
        on_limit_reached = true,
    },
}