-- Follow Manager - Instagramフォロー管理ツール
-- Smartgram License Management System

print("🚀 Follow Manager START")

-- Smartgramライセンス確認
function checkSmartgramLicense()
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
        print("✅ Smartgramライセンス確認済み")
        return true
    else
        print("⚠️ ライセンス関数が見つかりません")
        return false
    end
end

-- フォロー管理機能
function startFollowManagement()
    print("📱 Instagramフォロー管理開始")

    local action = dialog({
        title = "⚙️ Follow Manager",
        message = "実行する操作を選択:",
        buttons = {"自動フォロー", "自動アンフォロー", "フォロー整理", "キャンセル"}
    })

    if not action or action == 4 then
        return false
    end

    if action == 1 then
        return autoFollow()
    elseif action == 2 then
        return autoUnfollow()
    elseif action == 3 then
        return followCleanup()
    end
end

-- 自動フォロー機能
function autoFollow()
    print("👥 自動フォロー開始")

    local count = dialog({
        title = "👥 自動フォロー設定",
        message = "フォロー数を選択:",
        buttons = {"5人", "10人", "20人", "キャンセル"}
    })

    if not count or count == 4 then
        return false
    end

    local amounts = {5, 10, 20}
    local followCount = amounts[count]

    local confirm = dialog({
        title = "▶️ 実行確認",
        message = "自動フォローを開始します。\n\n" ..
                  "予定フォロー数: " .. followCount .. "人\n\n" ..
                  "おすすめユーザー画面で\n実行してください。",
        buttons = {"実行", "キャンセル"}
    })

    if not confirm or confirm == 2 then
        return false
    end

    for i = 1, followCount do
        -- フォローボタンをタップ (座標調整必要)
        tap(300, 200 + (i * 80)) -- フォローボタン位置
        print("👥 フォロー " .. i .. "/" .. followCount)

        usleep(3000000) -- 3秒待機

        if i % 3 == 0 then
            showToast("フォロー進捗: " .. i .. "/" .. followCount)
        end
    end

    dialog({
        title = "✅ 完了",
        message = "自動フォロー完了!\n\n" ..
                  "フォロー数: " .. followCount .. "人",
        buttons = {"OK"}
    })

    return true
end

-- 自動アンフォロー機能
function autoUnfollow()
    print("👥 自動アンフォロー開始")

    local warning = dialog({
        title = "⚠️ 注意",
        message = "自動アンフォロー機能です。\n\n" ..
                  "フォロー中リストから\nランダムにアンフォローします。\n\n" ..
                  "実行しますか？",
        buttons = {"実行", "キャンセル"}
    })

    if not warning or warning == 2 then
        return false
    end

    -- アンフォロー処理 (簡易版)
    for i = 1, 5 do
        tap(300, 200 + (i * 80)) -- フォロー中ボタン
        usleep(1000000) -- 1秒
        tap(200, 300) -- アンフォロー確認
        usleep(2000000) -- 2秒

        print("👥 アンフォロー " .. i .. "/5")
        showToast("アンフォロー: " .. i .. "/5")
    end

    dialog({
        title = "✅ 完了",
        message = "自動アンフォロー完了!",
        buttons = {"OK"}
    })

    return true
end

-- フォロー整理機能
function followCleanup()
    dialog({
        title = "🔧 フォロー整理",
        message = "フォロー整理機能は\n開発中です。\n\n" ..
                  "現在利用できません。",
        buttons = {"OK"}
    })
    return true
end

-- メイン実行
function main()
    if not checkSmartgramLicense() then
        return
    end

    startFollowManagement()
end

main()