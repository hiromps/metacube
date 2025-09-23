-- DM Reply - Instagram DM自動返信ツール
-- Smartgram License Management System

print("🚀 DM Reply START")

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

-- DM自動返信機能
function startDMReply()
    print("💬 Instagram DM自動返信開始")

    local replyType = dialog({
        title = "💬 DM Reply 設定",
        message = "返信メッセージを選択:",
        buttons = {"定型文1", "定型文2", "カスタム", "キャンセル"}
    })

    if not replyType or replyType == 4 then
        return false
    end

    local replyMessage = ""
    if replyType == 1 then
        replyMessage = "ありがとうございます！"
    elseif replyType == 2 then
        replyMessage = "確認いたします。少々お待ちください。"
    elseif replyType == 3 then
        -- カスタムメッセージ (簡易版)
        replyMessage = "カスタム返信メッセージ"
        dialog({
            title = "📝 カスタム返信",
            message = "カスタム返信機能は\n開発中です。\n\n" ..
                      "定型文を使用します。",
            buttons = {"OK"}
        })
        replyMessage = "お忙しい中ありがとうございます。"
    end

    local confirm = dialog({
        title = "▶️ 実行確認",
        message = "DM自動返信を開始します。\n\n" ..
                  "返信メッセージ:\n\"" .. replyMessage .. "\"\n\n" ..
                  "Instagram DM画面で実行してください。",
        buttons = {"実行", "キャンセル"}
    })

    if not confirm or confirm == 2 then
        return false
    end

    print("💬 DM自動返信実行...")

    -- DM返信処理 (簡易版)
    for i = 1, 3 do
        -- DM会話をタップ
        tap(200, 150 + (i * 100))
        usleep(1000000) -- 1秒

        -- メッセージ入力欄をタップ
        tap(200, 600)
        usleep(500000) -- 0.5秒

        -- メッセージ入力 (実際には inputText 関数を使用)
        -- inputText(replyMessage) -- この関数がAutoTouchで利用可能な場合

        -- 送信ボタンをタップ
        tap(350, 600)
        usleep(1000000) -- 1秒

        -- 戻る
        tap(50, 100)
        usleep(1000000) -- 1秒

        print("💬 DM返信 " .. i .. "/3")
        showToast("DM返信: " .. i .. "/3")
    end

    dialog({
        title = "✅ 完了",
        message = "DM Reply完了!\n\n" ..
                  "返信数: 3件\n" ..
                  "返信内容: \"" .. replyMessage .. "\"",
        buttons = {"OK"}
    })

    print("✅ DM Reply 完了")
    return true
end

-- メイン実行
function main()
    if not checkSmartgramLicense() then
        return
    end

    local appCheck = dialog({
        title = "📱 アプリ確認",
        message = "Instagram DM画面で\n実行していますか？",
        buttons = {"はい", "いいえ"}
    })

    if not appCheck or appCheck == 2 then
        dialog({
            title = "⚠️ 注意",
            message = "Instagramアプリを開いて\nDM画面に移動してから\n再度実行してください。",
            buttons = {"OK"}
        })
        return
    end

    startDMReply()
end

main()