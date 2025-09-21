-- Story Viewer - Instagram自動ストーリー視聴ツール
-- MetaCube License Management System

print("🚀 Story Viewer START")

-- MetaCubeライセンス確認
function checkMetaCubeLicense()
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

-- ストーリー自動視聴機能
function startStoryViewing()
    print("📱 Instagramストーリー自動視聴開始")

    local settings = dialog({
        title = "⚙️ Story Viewer 設定",
        message = "ストーリー視聴の設定を選択:",
        buttons = {"全て視聴", "5件まで", "10件まで", "キャンセル"}
    })

    if not settings or settings == 4 then
        print("❌ ユーザーがキャンセルしました")
        return false
    end

    local limits = {50, 5, 10}
    local limit = limits[settings]
    print("📊 視聴予定数: " .. limit .. "件")

    -- 実行確認
    local confirm = dialog({
        title = "▶️ 実行確認",
        message = "ストーリー視聴を開始します。\n\n" ..
                  "予定視聴数: " .. limit .. "件\n\n" ..
                  "Instagramのホーム画面で\n実行してください。",
        buttons = {"実行", "キャンセル"}
    })

    if not confirm or confirm == 2 then
        return false
    end

    print("🎯 ストーリー自動視聴開始...")

    for i = 1, limit do
        -- ストーリーをタップ (座標は調整必要)
        tap(100, 150) -- ストーリーアイコン位置
        print("👀 ストーリー視聴 " .. i .. "/" .. limit)

        -- ストーリー再生時間待機
        usleep(3000000) -- 3秒

        -- 次のストーリーへ (右タップ)
        tap(300, 400)
        usleep(1000000) -- 1秒

        if i % 3 == 0 then
            showToast("進捗: " .. i .. "/" .. limit)
        end
    end

    dialog({
        title = "✅ 完了",
        message = "Story Viewer完了!\n\n" ..
                  "視聴数: " .. limit .. "件",
        buttons = {"OK"}
    })

    print("✅ Story Viewer 完了")
    return true
end

-- メイン実行
function main()
    if not checkMetaCubeLicense() then
        return
    end

    startStoryViewing()
end

main()