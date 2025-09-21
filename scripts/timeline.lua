-- Timeline Tool - Instagram自動いいねツール
-- MetaCube License Management System

print("🚀 Timeline Tool START")

-- MetaCubeライセンス確認
function checkMetaCubeLicense()
    -- main.luaのライセンス確認関数を利用
    if getLicenseDetails then
        local license = getLicenseDetails()
        if not license or not license.is_valid then
            dialog({
                title = "❌ ライセンスエラー",
                message = "有効なライセンスが必要です。\n\nmain.luaから実行してください。",
                buttons = {"OK"}
            })
            return false
        end
        print("✅ MetaCubeライセンス確認済み")
        return true
    else
        print("⚠️ ライセンス関数が見つかりません")
        return false
    end
end

-- Timeline自動いいね機能
function startTimelineLikes()
    print("📱 Instagramタイムライン自動いいね開始")

    -- 設定ダイアログ
    local settings = dialog({
        title = "⚙️ Timeline Tool 設定",
        message = "自動いいねの設定を選択してください:",
        buttons = {"ゆっくり (安全)", "標準", "高速", "キャンセル"}
    })

    if not settings or settings == 4 then
        print("❌ ユーザーがキャンセルしました")
        return false
    end

    local speeds = {
        {name = "ゆっくり", delay = 8000, count = 20},
        {name = "標準", delay = 5000, count = 30},
        {name = "高速", delay = 3000, count = 50}
    }

    local speed = speeds[settings]
    print("⚡ 速度設定: " .. speed.name)
    print("⏱️ 間隔: " .. (speed.delay/1000) .. "秒")
    print("📊 予定数: " .. speed.count .. "件")

    -- 実行確認
    local confirm = dialog({
        title = "▶️ 実行確認",
        message = "設定:\n" ..
                  "速度: " .. speed.name .. "\n" ..
                  "間隔: " .. (speed.delay/1000) .. "秒\n" ..
                  "予定数: " .. speed.count .. "件\n\n" ..
                  "Instagramのタイムライン画面で\n実行してください。",
        buttons = {"実行", "キャンセル"}
    })

    if not confirm or confirm == 2 then
        print("❌ 実行がキャンセルされました")
        return false
    end

    -- 自動いいね実行
    print("🎯 自動いいね実行開始...")

    for i = 1, speed.count do
        -- いいねボタンをタップ (位置は実際のInstagram画面に合わせて調整)
        local likeX = 100  -- いいねボタンのX座標 (調整必要)
        local likeY = 500  -- いいねボタンのY座標 (調整必要)

        tap(likeX, likeY)
        print("❤️ いいね " .. i .. "/" .. speed.count)

        -- 次の投稿へスワイプ
        swipe(200, 400, 200, 100, 0.5) -- 上スワイプ (調整必要)

        -- 待機
        usleep(speed.delay * 1000) -- ミリ秒をマイクロ秒に変換

        -- 5回ごとに進捗表示
        if i % 5 == 0 then
            showToast("進捗: " .. i .. "/" .. speed.count)
        end
    end

    -- 完了メッセージ
    dialog({
        title = "✅ 完了",
        message = "Timeline Tool完了!\n\n" ..
                  "実行数: " .. speed.count .. "件\n" ..
                  "お疲れ様でした！",
        buttons = {"OK"}
    })

    print("✅ Timeline Tool 完了")
    return true
end

-- メイン実行
function main()
    -- ライセンス確認
    if not checkMetaCubeLicense() then
        return
    end

    -- Instagram画面確認
    local appCheck = dialog({
        title = "📱 アプリ確認",
        message = "Instagramアプリのタイムライン画面で\n実行していますか？",
        buttons = {"はい", "いいえ"}
    })

    if not appCheck or appCheck == 2 then
        dialog({
            title = "⚠️ 注意",
            message = "Instagramアプリを開いて\nタイムライン画面に移動してから\n再度実行してください。",
            buttons = {"OK"}
        })
        return
    end

    -- Timeline自動いいね実行
    startTimelineLikes()
end

-- Timeline Tool実行
main()