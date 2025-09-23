# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 📁 プロジェクトパス
`C:\Users\Public\Documents\myproject\AutoIGv2`

## 🎯 プロジェクト概要
AutoTouch iOS自動化フレームワーク用のInstagram自動化ツールコレクション。タイムライン自動いいね機能と自動アンフォロー機能を提供。画像認識とGUI制御により、Instagram上でのアクションを自動化。

## 🏗️ アーキテクチャ

### コア技術スタック
- **AutoTouch Framework**: iOS自動化 (Lua 5.3ベース)
- **画像認識**: `findImage()` による画面要素検出
- **タッチ制御**: `touchDown()`, `touchMove()`, `touchUp()` によるジェスチャー生成
- **GUI**: `dialog()` 関数による設定ダイアログ

### モジュール構成と責務

#### 完成版スクリプト
- `timeline.lua`: Instagram自動いいね完成版
  - タイムライン自動スクロール
  - ハート画像認識によるいいね実行
  - GUIダイアログによる設定
  - プログレス表示とログ機能
  - カラーチェッカーによる画面状態検出

- `unfollow.lua`: Instagram自動アンフォロー完成版
  - フロー制御による画面遷移管理
  - followdialog.png検出による条件分岐
  - 精密スクロール実装
  - エラーハンドリングと中断対応
  - GUIダイアログによる詳細設定

- `hashtaglike.lua`: Instagram ハッシュタグ自動いいね完成版
  - 検索ボタン画像認識による検索画面遷移
  - 任意キーワード入力機能
  - ランダム投稿選択（3段×3列グリッド）
  - ダブルタップによる確実ないいね実行
  - GUIダイアログによるキーワード・数量設定

- `activelike.lua`: Instagram アクティブユーザー自動いいね完成版
  - フォロー中タブから最新投稿へ遷移していいね実行
  - プロフィール統計のOCR認識によるフィルタリング機能
  - 時間ベースの処理済みユーザー管理システム
  - フォロー機能のオン/オフ切替対応
  - timeline.luaパターンの強制停止機能実装
  - 重複ユーザーの確実な回避と適切な再選択機能

### 処理フロー

#### timeline.lua（自動いいね）
```
[タイムライン画面]
    ↓ カラーチェッカーで画面状態監視
[ハート検出]
    ↓ findImage("image/heart_empty.png")
[いいね実行]
    ↓ tap(heart位置)
[スクロール]
    ↓ complexSwipePattern()で次の投稿へ
[繰り返し]
    → 設定回数まで継続
```

#### unfollow.lua（自動アンフォロー）
```
[初期画面 0000.png]
    ↓ tap(241.20, 1183.51)
[メニュー画面 0001.png]
    ↓ tap(693.84, 103.28) // プロフィールボタン
[プロフィール画面 0002.png]
    ↓ 画像認識分岐
    ├─ followdialog.png検出時
    │   → キャンセル → 戻る → スクロール
    └─ 未検出時
        → tap(394.13, 1242.56) → followstate.png検出 → アンフォロー実行
```

### follow.lua（自動フォロー）
```
[おすすめユーザー画面]
    ↓ 画像認識（followbtn.png + followbtn_v2.png）
[フォローボタン検出]
    ↓ 両方のボタンタイプを並行検出
    ├─ followbtn.png検出
    │   → タップ → フォロー実行
    ├─ followbtn_v2.png検出
    │   → タップ → フォロー実行
    └─ どちらも未検出
        → スクロール → 連続スクロールカウント
[連続スクロール判定]
    ├─ 10回以下
    │   → 続行
    └─ 10回超過
        → 自動停止（フォロー可能ユーザーなし）
```

### hashtaglike.lua（ハッシュタグ自動いいね）
```
[初期画面 0006.png]
    ↓ search.png検出 {x: 87.50, y: 63.89, width: 79.55, height: 42.08}
[検索画面]
    ↓ キーワード入力（inputText）
[検索確定]
    ↓ tap(657.92, 1287.37) 99826μs待機
[検索結果画面]
    ↓ 2秒待機
[ランダム投稿選択]
    ↓ 3段×3列のランダム座標選択
    ↓ x:{140, 400, 650} y:{350, 620, 870}
[投稿詳細画面]
    ↓ 2秒待機（画面読み込み）
[いいねループ]
    ↓ ダブルタップ（375, 667）
    ↓ 0.1秒間隔で2回タップ
[スクロール]
    ↓ complexSwipe(375, 800→375, 300)
[繰り返し]
    → 設定回数まで継続
```

### activelike.lua（アクティブユーザー自動いいね）
```
[フォロー中タブ]
    ↓ フォローボタン検出（followbtn.png + followbtn_v2.png）
[重複チェック]
    ↓ 処理済みユーザー管理（時間ベース：60秒）
[プロフィール遷移]
    ↓ フォロー中タブ位置計算（X軸-300pxオフセット）
[OCR統計チェック]
    ↓ 投稿数・フォロワー・フォロー中をOCR認識
    ├─ 条件未達成 → スキップして戻る（ステータス: skipped）
    └─ 条件達成 → 続行
[非公開チェック]
    ↓ complexSwipePattern()で1回スクロール
    ↓ lock.png検出で非公開判定
    ├─ 非公開 → スキップして戻る（ステータス: private）
    └─ 公開 → 投稿ボタンへ
[最新投稿移動]
    ↓ post.png検出してタップ
[いいね実行]
    ↓ heart_empty.png検出してタップ（最大5回スクロール）
[フォロー処理]
    ├─ フォロー有効 → フォロー実行（ステータス: followed）
    └─ フォロー無効 → スキップ（ステータス: not_followed）
[戻る処理]
    ↓ 戻るボタン2回タップ
[次のユーザー選択]
    ↓ 全ユーザー処理済みの場合
    ├─ 60秒経過ユーザーを部分クリア → 再選択
    └─ クリア対象なし → スクロール実行
[ループ継続]
    → 設定回数（ループ数×いいね数）まで継続
```

## 🔧 開発コマンド

### AutoTouch環境での実行
```lua
-- スクリプトをAutoTouchアプリの Scripts フォルダに配置
-- アプリ内でファイル選択 → 再生ボタンタップ
```

### テスト実行
```lua
-- デバッグモード有効化
Config.PROCESS.DEBUG_MODE = true

-- 単一実行テスト
executeFullFlow()
```

## 📊 重要な設定値

### timeline.lua 設定値
```lua
-- いいね検出設定
IMAGE_DETECTION = {
    path = "image/heart_empty.png",
    tolerance = 0.99,
    region = {21, 128, 62, 1115}
}

-- スクロール設定
SWIPE_STEPS = 38  -- complexSwipePatternのステップ数
SWIPE_DURATION = 500000  -- 0.5秒

-- パフォーマンス設定
Config = {
    colorTolerance = 20,         -- 色比較許容値
    maxLikeCount = 30,          -- デフォルト最大いいね数
    maxIterations = 500,        -- 最大イテレーション
    speedMultiplier = 1         -- 速度倍率
}
```

### unfollow.lua 設定値
```lua
-- 座標定義 (iPhone標準解像度 750x1334)
UI.MENU.PROFILE_BUTTON = {x = 693.84, y = 103.28}
UI.MENU.BACK_BUTTON = {x = 26.68, y = 90.03}
UI.PROFILE.FOLLOWING_BUTTON = {x = 187, y = 628}

-- 特定タップ座標
UNFOLLOW_TAP = {x = 394.13, y = 1242.56}  -- followdialog未検出時
BACK_TO_LIST = {x = 168.32, y = 1174.35}  -- 一覧に戻る
BACK_BUTTON = {x = 21.55, y = 88.00}      -- 戻るボタン

-- タイミング設定 (マイクロ秒)
SCREEN_TRANSITION = 2000000  -- 2秒
AFTER_TAP = 1500000          -- 1.5秒
IMAGE_DETECTION = 1000000    -- 1秒
```

### activelike.lua 設定値
```lua
-- プロフィールチェック設定
PROFILE_CHECK = {
    minPosts = 1,        -- 最小投稿数（0を除外）
    minFollowers = 100,  -- 最小フォロワー数
    minFollowing = 50    -- 最小フォロー中数
}

-- OCR座標定義（プロフィール統計情報）
COORDINATES = {
    POSTS_REGION = {x = 235.56, y = 220.22, width = 108.67, height = 40.27},
    FOLLOWERS_REGION = {x = 353.02, y = 220.00, width = 101.05, height = 40.00},
    FOLLOWING_REGION = {x = 542.90, y = 220.00, width = 136.93, height = 40.00},
    FOLLOW_TAB_OFFSET = -300,  -- フォローボタンからフォロー中タブへのオフセット
    BACK_BUTTON = {x = 39.00, y = 90.03}
}

-- タイミング設定 (マイクロ秒)
TIMING = {
    TAP_DURATION = 50000,         -- 0.05秒
    AFTER_TAP = 1500000,          -- 1.5秒
    SCREEN_TRANSITION = 2000000,  -- 2秒
    BETWEEN_LIKES = 2000000,      -- 2秒（いいね間隔）
    BACK_BUTTON = 114559          -- 戻るボタンタップ時間
}

-- 処理済みユーザー管理
USER_MANAGEMENT = {
    duplicateThreshold = 15,    -- 重複判定閾値（ピクセル）
    oldUserTimeout = 60,        -- 古いユーザークリア時間（秒）
    maxScrollAttempts = 10      -- 最大スクロール試行回数
}

-- デフォルト設定
DEFAULT = {
    likeCount = 1,              -- ループあたりいいね数
    loopCount = 30,             -- 全体ループ回数
    followEnabled = true,       -- フォロー機能の有効/無効
    debugMode = false
}
```

### GUI ダイアログ標準仕様
```lua
-- 必須: CONTROLLER_TYPE定数使用
-- 必須: 絵文字アイコン付き
-- 必須: 色指定 (開始=0x68D391, キャンセル=0xFF5733)
local controls = {
    {type = CONTROLLER_TYPE.LABEL, text = "📱 タイトル 📱"},
    {type = CONTROLLER_TYPE.INPUT, title = "🔄 項目:", key = "key", value = "default"},
    {type = CONTROLLER_TYPE.PICKER, title = "⚡ 選択:", key = "speed", value = "通常", options = {"高速", "通常", "低速"}},
    {type = CONTROLLER_TYPE.SWITCH, title = "🔍 スイッチ:", key = "debug", value = 1},
    {type = CONTROLLER_TYPE.BUTTON, title = "🚀 開始", color = 0x68D391, width = 0.5, flag = 1, collectInputs = true},
    {type = CONTROLLER_TYPE.BUTTON, title = "❌ キャンセル", color = 0xFF5733, width = 0.5, flag = 2, collectInputs = false}
}
```

## 🎨 完成版スクリプトの詳細仕様

### activelike.lua - アクティブユーザー自動いいね機能

#### 概要
フォロー中タブから最新投稿へ遷移してアクティブユーザーの投稿にいいねする高度な機能。プロフィール統計のOCR認識により条件に満たないユーザーを自動スキップ。

#### 時間ベース処理済みユーザー管理システム（最新版）
```lua
-- 処理済みユーザーの時間ベース管理
self.processedUsers = {}  -- {y, status, timestamp}

-- 重複チェック（15ピクセル閾値）
function App:isUserProcessed(y)
    for _, user in ipairs(self.processedUsers) do
        local distance = math.abs(y - user.y)
        if distance <= 15 then  -- 15ピクセル以内は同一ユーザー
            return true, user.status
        end
    end
    return false, nil
end

-- 60秒経過した古い処理済みユーザーの部分クリア
function App:clearOldProcessedUsers()
    local currentTime = os.time()
    local newProcessedUsers = {}
    local clearedCount = 0

    for _, user in ipairs(self.processedUsers) do
        local timeSinceProcessed = currentTime - user.timestamp
        if timeSinceProcessed < 60 then  -- 60秒以内は保持
            table.insert(newProcessedUsers, user)
        else
            clearedCount = clearedCount + 1
        end
    end

    if clearedCount > 0 then
        self.processedUsers = newProcessedUsers
        return true, clearedCount
    end
    return false, 0
end
```

#### 強制停止機能（timeline.luaパターン実装）
```lua
-- グローバル中断フラグ
local INTERRUPTED = false

-- Utils.wait関数の中断対応（0.1秒単位分割）
function Utils.wait(microseconds)
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

-- メインループの中断対応
function App:run()
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
    end
end
```

#### OCR実装（プロフィール統計認識）

##### OCR座標定義
```lua
COORDINATES = {
    POSTS_REGION = {x = 235.56, y = 220.22, width = 108.67, height = 40.27},      -- 投稿数
    FOLLOWERS_REGION = {x = 356.82, y = 219.34, width = 139.20, height = 39.03},  -- フォロワー数
    FOLLOWING_REGION = {x = 542.90, y = 215.75, width = 136.93, height = 42.19}   -- フォロー中数
}
```

##### OCR精度向上のための複数座標実装
```lua
function App:performOCR(region, regionName)
    -- 複数の座標オフセットで精度向上
    local offsets = {
        {x = 0, y = 0},      -- 元の座標
        {x = -2, y = -2},    -- 左上に少しずらす
        {x = 2, y = 2},      -- 右下に少しずらす
        {x = 0, y = -2},     -- 上に少しずらす
        {x = 0, y = 2},      -- 下に少しずらす
    }

    local validResults = {}

    for i, offset in ipairs(offsets) do
        -- 座標計算（オフセット適用）
        local adjustedRegion = {
            x = region.x + offset.x,
            y = region.y + offset.y,
            width = region.width,
            height = region.height
        }

        -- 座標変換
        local coords = Utils.convertCoordinates(adjustedRegion.x, adjustedRegion.y)
        local x = math.floor(coords[1])
        local y = math.floor(coords[2])
        local width = math.floor(adjustedRegion.width)
        local height = math.floor(adjustedRegion.height)

        -- OCR実行（画面の指定領域を直接読み取り）
        local ocrRegion = {x, y, width, height}
        local success, ocrResult = pcall(function()
            return ocr({region = ocrRegion})  -- AutoTouch OCR API
        end)

        if success and ocrResult and ocrResult.text then
            local text = ocrResult.text
            -- 特殊文字チェック（÷、‡、†などを検出）
            local hasSpecialChars = string.match(text, "[÷‡†×±≠≈∞]")

            if hasSpecialChars then
                Utils.log(string.format("⚠️ 特殊文字を検出: %s (座標%d: x=%d, y=%d)",
                    text, i, offset.x, offset.y))
            else
                -- 数字のみを抽出（英文字は除外）
                text = string.gsub(text, "[^%d,%.KMkm]", "")
                if text ~= "" then
                    table.insert(validResults, {
                        text = text,
                        priority = (i == 1) and 1 or 2,  -- 元の座標を優先
                        hasSpecial = false
                    })
                    Utils.log(string.format("✅ 有効な結果: %s (座標%d)", text, i))
                end
            end
        end
    end

    -- 最も信頼できる結果を選択
    if #validResults > 0 then
        -- 特殊文字がない結果を優先
        table.sort(validResults, function(a, b)
            return a.priority < b.priority
        end)
        return true, validResults[1].text
    end

    return false, nil
end
```

##### 数値抽出の特殊処理
```lua
function App:extractNumber(ocrText)
    -- 1. 小数点をカンマとして認識（例: "2.675" → 2,675）
    if string.match(ocrText, "^%d+%.%d%d%d$") then
        local cleanedText = string.gsub(ocrText, "%.", "")
        return tonumber(cleanedText)  -- 2675として返す
    end

    -- 2. 単一数字は千の位として処理（例: "2" → 2,000）
    if string.match(ocrText, "^[1-9]$") then
        return tonumber(ocrText) * 1000
    end

    -- 3. K/M表記の処理
    if string.match(ocrText, "[Kk]$") then
        local num = string.gsub(ocrText, "[Kk]$", "")
        return tonumber(num) * 1000  -- 1.5K → 1500
    end

    -- 4. 通常の数値処理
    local cleanText = string.gsub(ocrText, "[,.]", "")
    return tonumber(cleanText)
end
```

##### OCRリトライ機能
```lua
-- 各統計項目を個別にリトライ（最大3回）
for i = 1, maxRetries do
    success, result = self:performOCR(region, regionName)
    if success and result then
        break
    elseif i < maxRetries then
        Utils.log(string.format("⚠️ OCRリトライ中... (%d/%d)", i, maxRetries))
        Utils.wait(500000)  -- 0.5秒待機
    end
end

-- OCR失敗時のフォールバック
if not followerCount then
    followerCount = 0  -- デフォルト値設定
    Utils.log("📝 フォロワー数をデフォルト値(0)に設定")
end
```

##### プロフィール統計チェック
```lua
function App:checkProfileStats()
    -- プロフィール画面を確実に読み込むため2秒待機
    Utils.wait(2000000)

    -- OCR実行（リトライ付き）
    local postCount = self:performOCRWithRetry("投稿数")
    local followerCount = self:performOCRWithRetry("フォロワー数")
    local followingCount = self:performOCRWithRetry("フォロー中数")

    -- 条件チェック（すべての条件を評価）
    local skipReasons = {}
    if postCount < Config.PROFILE_CHECK.minPosts then
        table.insert(skipReasons, "投稿数不足")
    end
    if followerCount < Config.PROFILE_CHECK.minFollowers then
        table.insert(skipReasons, "フォロワー不足")
    end
    if followingCount < Config.PROFILE_CHECK.minFollowing then
        table.insert(skipReasons, "フォロー中不足")
    end

    -- 結果表示
    if #skipReasons > 0 then
        toast(string.format("⏭️ スキップ: %s", skipReasons[1]), 1)
        return false
    else
        toast(string.format("✅ 条件クリア 📸%d 👥%d 📋%d",
            postCount, followerCount, followingCount), 2)
        return true
    end
end
```

##### OCR実装のポイント
1. **画面遷移後の待機**: プロフィール画面表示後2秒待機してからOCR実行
2. **数字のみ抽出**: 英文字を除外し、数字とK/M表記のみを処理
3. **カンマ認識問題の解決**:
   - OCRが「,」を「.」として認識する問題に対応
   - 1,000〜9,999の数値で千の位のみ読み取る問題に対応
4. **リトライ機能**: 各項目を個別に最大3回リトライ
5. **フォールバック**: OCR失敗時はデフォルト値（0）を設定して処理継続
6. **複数座標OCR**: 5つの異なる座標でOCR実行し、特殊文字のない結果を優先
7. **特殊文字対策**: ÷、‡、†などの特殊文字を検出した場合はその結果をスキップ
8. **🆕 代替座標システム（精度向上）**: メイン座標とALT座標の両方を試行して検出精度を向上

##### 既知のOCR問題と対策
- **問題1**: 「6」が「‡415」として認識される
  - 対策: 特殊文字‡を検出したらスキップ、別座標で再試行
- **問題2**: 「834」が「7÷0-c」として認識される
  - 対策: ÷記号を検出したらスキップ、複数座標OCRで正しい値を取得
- **問題3**: カンマが小数点として認識される（2,675 → 2.675）
  - 対策: パターンマッチで検出し、小数点を削除して処理

#### 🆕 代替座標システム実装（OCR精度向上）

##### 座標設定の拡張
```lua
-- メイン座標とALT座標のペア設定
COORDINATES = {
    -- 投稿数の複数座標
    POSTS_REGION = {x = 235.56, y = 220.22, width = 108.67, height = 40.27},      -- メイン座標
    POSTS_REGION_ALT = {x = 242.33, y = 234.97, width = 45.57, height = 40.66},   -- 代替座標

    -- フォロワー数の複数座標
    FOLLOWERS_REGION = {x = 353.02, y = 220.00, width = 101.05, height = 40.00},  -- メイン座標
    FOLLOWERS_REGION_ALT = {x = 355.31, y = 200.84, width = 87.90, height = 38.62}, -- 代替座標

    -- フォロー中数（今後追加予定）
    FOLLOWING_REGION = {x = 542.90, y = 220.00, width = 136.93, height = 40.00}   -- メイン座標のみ
}
```

##### OCR実行の改良パターン
```lua
-- 代替座標システムの標準実装
for i = 1, maxRetries do
    -- メイン座標で試行
    success, result = self:performOCR(Config.COORDINATES.TARGET_REGION, "項目名")
    if success and result then
        Utils.log("✅ 項目名OCR成功 (メイン座標)")
        break
    end

    -- 代替座標で試行
    success, result = self:performOCR(Config.COORDINATES.TARGET_REGION_ALT, "項目名ALT")
    if success and result then
        Utils.log("✅ 項目名OCR成功 (代替座標)")
        break
    end

    if i < maxRetries then
        Utils.log(string.format("⚠️ 項目名OCRリトライ中... (%d/%d)", i, maxRetries))
        Utils.wait(500000)  -- 0.5秒待機
    end
end
```

##### 実装ガイドライン
1. **座標命名規則**: `REGION_NAME` + `_ALT` で代替座標を命名
2. **優先順位**: 必ずメイン座標を先に試行、失敗時のみ代替座標を使用
3. **ログ出力**: どちらの座標で成功したかを明確にログに記録
4. **リトライ統合**: 両座標とも失敗した場合のみリトライカウントを増加
5. **拡張性**: 将来的に3つ目の座標（_ALT2）も追加可能な設計

##### 効果と利点
- **検出精度向上**: 異なる画面レイアウトや表示状態への対応
- **ロバスト性**: 画面解像度や文字サイズの違いに対する耐性
- **デバッグ支援**: どの座標で成功したかの詳細ログ
- **保守性**: 座標追加時の統一されたパターン

#### フォローボタン検出と選択
- 複数ボタン同時検出（followbtn.png + followbtn_v2.png）
- 既にタップした座標を永続的に記憶
- 最大6個の最近の履歴で画面内管理
- スクロール時に最近の履歴のみリセット

#### 処理フロー（改良版）
```
[初期画面]
    ↓ フォローボタン複数検出
[履歴チェック]
    ↓ 全体履歴と比較（重複防止）
[新規ボタン選択]
    ↓ X軸オフセット（-300px）でフォロー中タブ位置計算
[タップ実行]
    ↓ 履歴に追加（全体+最近）
[プロフィール遷移]
    ↓ 2秒待機（画面読み込み）
[OCR統計チェック]
    ↓ 投稿数・フォロワー・フォロー中を取得
    ├─ 条件未達成 → スキップして戻る
    └─ 条件達成 → 続行
[スクロールして非公開チェック]
    ↓ complexSwipePattern()で1回スクロール
    ↓ lock.png検出で非公開判定
    ├─ 非公開 → スキップして戻る（1回のみ）
    └─ 公開 → 投稿ボタンへ
[最新投稿へ移動]
    ↓ post.png検出してタップ
    ↓ いいね実行
[戻る処理]
    ↓ 戻るボタン2回タップ（公開アカウント）
    ↓ 戻るボタン1回タップ（非公開アカウント）
[次のユーザー選択]
    → 履歴に基づき異なるユーザーを選択
```

#### エラー画像処理
```lua
-- エラー画像検出時の自動スキップ
local errorImages = {
    "image/noimage.png",    -- 画像なし
    "image/nopost.png",     -- 投稿なし
    "image/new.png",        -- 新規アカウント
    "image/private.png",    -- 非公開アカウント
    "image/lock.png"        -- ロックされたアカウント
}
```

### timeline.lua - 自動いいね機能

#### カラーチェッカーシステム
```lua
-- ColorChecker クラスによる画面状態管理
ColorChecker:new()
ColorChecker:addData(dataString)  -- 色データ追加
ColorChecker:findColors()          -- 画面色取得
ColorChecker:check(beforeCallback, afterCallback)  -- 状態チェック実行
```

#### 複雑なスワイプパターン
- 38ステップの精密なタッチ座標記録
- 各ステップごとのタイミング制御（16-50ms）
- 自然な指の動きをシミュレート

#### ログシステム
```lua
Logger.init()              -- ログファイル初期化
Logger.write(message)      -- メッセージ記録
Logger.writeSummary()      -- 統計サマリー出力
```

### unfollow.lua - 自動アンフォロー機能

#### フロー制御システム
```lua
step0_tapInitialButton()    -- 初期画面タップ
step1_tapProfileButton()    -- プロフィールへ遷移
step2_detectFollowDialog()  -- ダイアログ検出
step3_branchByDialog()      -- 条件分岐処理
```

#### 精密スクロール実装
- 79ステップの詳細なタッチ移動
- エラーハンドリング付きpcall実装
- 中断時の適切な処理

#### 状態管理
```lua
State = {
    currentScreen = "unknown",
    processedCount = 0,
    skippedCount = 0,
    errorCount = 0,
    followDialogDetected = false
}
```

### follow.lua - 自動フォロー機能

#### 複数ボタン画像対応
```lua
-- 2種類のフォローボタンを並行検出
IMAGE_DETECTION = {
    followbtn = {path = "image/followbtn.png"},      -- メインボタン
    followbtn_v2 = {path = "image/followbtn_v2.png"}, -- バリエーション
    followedbtn = {path = "image/followedbtn.png"}    -- フォロー中
}
```

#### 連続スクロール自動停止
```lua
-- 連続スクロールカウンター
consecutiveScrolls = 0
maxConsecutiveScrolls = 10  -- GUI設定可能

-- フォロー可能ユーザーがいない判定
if consecutiveScrolls >= maxConsecutiveScrolls then
    log("⚠️ フォロー可能なユーザーが見つかりません")
    self.isRunning = false
end
```

#### 強制終了処理（完全対応）
```lua
-- グローバル中断フラグと伝播
INTERRUPTED = false
error("interrupted")  -- 上位への確実な伝播

-- タッチ解放の保証
pcall(touchUp, 0, x, y)

-- 最外側でのキャッチ
local globalSuccess, globalErr = pcall(main)
if tostring(globalErr):match("interrupted") then
    toast("🛑 強制終了しました", 2)
end
```

#### フォロー確認ダイアログ処理
```lua
-- ダイアログ検出設定
follow_dialog = {
    path = "image/follow_dialog.png",  -- 「フォローする」ボタンの画像
    tolerance = 0.95,
    region = nil  -- 全画面検索
}

-- 処理フロー
1. メインループで予期せぬダイアログをチェック
2. follow_dialog.png検出時は検出位置をタップ
3. handleFollowDialog()関数で処理
4. result[1][1], result[1][2]の座標を使用

-- 実装
local dialogX = result[1][1]  -- 検出されたX座標
local dialogY = result[1][2]  -- 検出されたY座標
Touch.tap(dialogX, dialogY, 101398)  -- 検出位置をタップ
```

#### 動作確認済みの挙動
- おすすめユーザー画面での確実なフォロー実行
- 「フォローする」ボタンのタップ
- フォロー確認ダイアログ表示時の適切な処理
- ダイアログの「フォローする」ボタン自動タップ
- 画面内の全フォローボタン処理後のスクロール
- フォロー可能ユーザー枯渇時の自動停止

## 🐛 トラブルシューティング

### 中断処理の実装パターン（完全版）

#### 基本構造
```lua
-- 1. グローバル中断フラグ（必須）
local INTERRUPTED = false

-- 2. 待機関数の中断対応
function Utils.wait(milliseconds)
    local totalWait = milliseconds * 1000 * Config.speedMultiplier
    local chunkSize = 100000  -- 0.1秒単位に分割

    while totalWait > 0 do
        if INTERRUPTED then
            error("interrupted")  -- 中断を伝播
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

-- 3. API呼び出しの保護
function GameActions.findAndTapHeart()
    local success, result = pcall(findImage, "image/heart.png", 1, 0.99)
    if not success then
        if tostring(result):match("interrupted") then
            INTERRUPTED = true
            error("interrupted")  -- 中断を伝播（握りつぶさない）
        end
        log("❌ エラー: " .. tostring(result))
        return false
    end
    -- 正常処理...
end

-- 4. タッチ操作の保護
function Touch.tap(x, y, duration)
    local coords = Utils.convertCoordinates(x, y)
    local success, err = pcall(touchDown, 0, coords[1], coords[2])
    if not success then
        if tostring(err):match("interrupted") then
            INTERRUPTED = true
            error("interrupted")  -- 中断を伝播
        end
        log("⚠️ タップエラー: " .. tostring(err))
        return
    end
    Utils.wait(duration or 50)
    pcall(touchUp, 0, coords[1], coords[2])  -- touchUpは失敗してもOK
end

-- 5. メインループでの中断チェック
function App:run()
    while self.isRunning do
        -- 明示的な中断チェック
        if INTERRUPTED then
            log("⚠️ ユーザーによる中断を検出")
            break
        end

        local success, err = pcall(function()
            -- メイン処理
            self:processMain()
        end)

        if not success then
            if tostring(err):match("interrupted") then
                log("⚠️ 処理が中断されました")
                break
            end
            log("❌ エラー: " .. tostring(err))
        end

        Utils.wait(1000)
    end
end

-- 6. エントリーポイントでの最終キャッチ
local success, err = pcall(function()
    App:run()
end)

if not success and tostring(err):match("interrupted") then
    toast("⚠️ ユーザーによって中断されました", 2)
    log("スクリプトが正常に中断されました")
elseif not success then
    log("❌ 実行エラー: " .. tostring(err))
end
```

#### 中断状態の追跡と分析
```lua
-- 拡張版：中断状態の詳細追跡
local InterruptTracker = {
    interrupted = false,
    interruptTime = nil,
    interruptLocation = nil,
    interruptCount = 0,
    processedBeforeInterrupt = 0
}

function InterruptTracker:setInterrupted(location)
    self.interrupted = true
    self.interruptTime = os.time()
    self.interruptLocation = location
    self.interruptCount = self.interruptCount + 1

    -- ログに記録
    log(string.format("🛑 中断検出 #%d at %s", self.interruptCount, location))

    -- 統計情報を保存（次回実行の参考用）
    local stats = string.format(
        "中断時刻: %s\n位置: %s\n処理済み: %d件",
        os.date("%Y-%m-%d %H:%M:%S", self.interruptTime),
        self.interruptLocation,
        self.processedBeforeInterrupt
    )

    -- ファイルに保存（オプション）
    local file = io.open("/tmp/interrupt_stats.txt", "w")
    if file then
        file:write(stats)
        file:close()
    end
end

-- 使用例
function GameActions.complexOperation()
    local success, result = pcall(someRiskyOperation)
    if not success then
        if tostring(result):match("interrupted") then
            InterruptTracker:setInterrupted("GameActions.complexOperation")
            error("interrupted")
        end
    end
end
```

#### 重要なポイント
1. **エラーを握りつぶさない** - `error("interrupted")`で必ず上位に伝播
2. **グローバルフラグ使用** - 全モジュールで中断状態を共有
3. **pcallでラップ** - AutoTouch APIは全てpcallで保護
4. **段階的な中断** - 長い処理は小分割して中断ポイントを設ける
5. **ユーザーフレンドリー** - エラーではなく正常な中断として処理

### interrupted エラーの予防
```lua
-- ❌ 悪い例：長時間の待機
usleep(5000000)  -- 5秒間中断不可

-- ✅ 良い例：中断可能な待機
for i = 1, 50 do
    if INTERRUPTED then break end
    usleep(100000)  -- 0.1秒ずつ
end
```

### 画像が見つからない
```lua
-- tolerance を調整 (推奨: 0.9-0.99)
findImage("image/followdialog.png", 1, 0.9)
findImage("image/heart_empty.png", 1, 0.99)
```

### スクロール問題
```lua
-- 精密スクロール関数使用 (performPreciseScroll)
-- timeline.lua: complexSwipePattern()
-- unfollow.lua: performPreciseScroll()
```

## 📂 ファイル構成

```
AutoIGv2/
├── 【完成版】
│   ├── timeline.lua             # 自動いいね完成版
│   ├── unfollow.lua            # 自動アンフォロー完成版
│   ├── follow.lua              # 自動フォロー完成版
│   └── activelike.lua          # アクティブユーザー自動いいね完成版
├── 【開発中】
│   ├── auto_unfollow_color.lua # 旧バージョン
│   ├── auto_unfollow_gui*.lua  # GUI各種バリエーション
│   ├── menu_handler.lua        # メニュー制御モジュール
│   ├── profile_manager.lua     # プロフィール画面制御
│   ├── scenario_controller.lua # シナリオ管理
│   └── scroll_function.lua     # スクロール処理
├── image/                       # 画像認識用ファイル
│   ├── 0000.png                # 初期画面
│   ├── 0001.png                # メニュー画面
│   ├── 0002.png                # プロフィール画面
│   ├── heart_empty.png         # 空ハートアイコン
│   ├── followdialog.png        # フォローダイアログ
│   ├── followstate.png         # フォロー状態ボタン
│   ├── followbtn.png           # フォローボタン（メイン）
│   ├── followbtn_v2.png        # フォローボタン（バリエーション）
│   ├── followedbtn.png         # フォロー中ボタン
│   └── follow_dialog.png       # フォロー確認ダイアログ
└── sample/                      # サンプルコード
```

## 🔒 実装上の注意点

### AutoTouch API 制約
- `vibrator()` 関数は使用不可
- `usleep()` はマイクロ秒単位
- `findImage()` の region パラメータは `{x1, y1, x2, y2}` 形式
- `touchDown()`, `touchMove()`, `touchUp()` でタッチID管理必須
- **HTTP関数は利用不可**: `httpsGet`, `httpGet`, `httpsPost`, `httpPost` すべて利用できない
- **ネットワーク通信不可**: AutoTouch環境ではHTTPリクエストができないため、オフライン認証システムを使用

### Instagram API 制限対策
- ランダム待機時間導入
- プログレッシブ速度調整
- バッチサイズ制限 (デフォルト10)
- 自然なスクロールパターン実装

### エラーハンドリング
- 全処理を pcall でラップ
- 最大リトライ回数: 3回
- エラー時スクリーンショット保存
- 詳細ログ出力 (`print = log` で有効化)

## 📈 パフォーマンス最適化

### timeline.lua
- カラーチェッカーによる効率的な状態検出
- 画像認識領域の限定による高速化
- プログレッシブな速度調整機能

### unfollow.lua
- フロー制御による確実な画面遷移
- 条件分岐による最適化された処理
- 中断可能な待機時間実装

## 🔐 ライセンス認証実装パターン

### デバイス認証システム
```lua
-- セキュリティモジュール実装
local Security = {}

-- 認証済みデバイスリスト（ハッシュ化）
Security.authorizedDevices = {
    "aac62cabf60fd77aab722285f60c0a67",  -- 例: 購入者1
    "d788852180c20fafb5234778b327d5dc",  -- 例: テスト用
}

-- 簡易ハッシュ関数（SHA-256代替）
function Security.simpleHash(str)
    local hash = 0
    for i = 1, #str do
        local char = string.byte(str, i)
        hash = ((hash * 31) + char) % 2147483647
    end
    -- 複雑化処理
    local result = ""
    local seed = hash
    for i = 1, 16 do
        seed = (seed * 1103515245 + 12345) % 2147483647
        result = result .. string.format("%02x", seed % 256)
    end
    return result
end

-- デバイス認証実装
function Security.authenticateDevice()
    local deviceId = nil

    -- 複数の方法でデバイスID取得を試行
    if getSN then
        deviceId = getSN()
    end
    if not deviceId and getDeviceID then
        deviceId = getDeviceID()
    end
    if not deviceId then
        local screenWidth, screenHeight = getScreenResolution()
        deviceId = string.format("%d_%d", screenWidth, screenHeight)
    end

    if not deviceId or deviceId == "" then
        return false, "デバイスIDを取得できません"
    end

    -- ハッシュ化と照合
    local hashedId = Security.simpleHash(deviceId)
    for _, authorizedHash in ipairs(Security.authorizedDevices) do
        if hashedId == authorizedHash then
            return true, "認証成功"
        end
    end

    return false, "未認証デバイス: " .. string.sub(hashedId, 1, 8) .. "..."
end
```

### エントリーポイントでの認証チェック
```lua
-- アプリケーション開始前に認証を実行
local isAuthenticated, authMessage = Security.authenticateDevice()

if not isAuthenticated then
    -- 未認証時の処理
    local deviceId, hashedId, infoMessage = Security.showDeviceInfo()

    -- エラーダイアログ表示
    local errorControls = {
        {type = CONTROLLER_TYPE.LABEL, text = "🔒 ライセンス認証が必要です 🔒"},
        {type = CONTROLLER_TYPE.LABEL, text = "このデバイスは認証されていません"},
        {type = CONTROLLER_TYPE.INPUT,
         title = "ライセンスキー:",
         key = "licenseKey",
         value = hashedId or "エラー"},
        {type = CONTROLLER_TYPE.LABEL, text = "【対処方法】"},
        {type = CONTROLLER_TYPE.LABEL, text = "1. このキーを販売者に送信"},
        {type = CONTROLLER_TYPE.LABEL, text = "2. 認証版の提供を待つ"},
        {type = CONTROLLER_TYPE.BUTTON, title = "閉じる", color = 0xFF5733, flag = 1}
    }
    dialog(errorControls, {ORIENTATION_TYPE.PORTRAIT})

    -- ログファイルに記録
    local file = io.open("device_registration_request.txt", "w")
    if file then
        file:write("=== デバイス登録リクエスト ===\n")
        file:write("日時: " .. os.date("%Y-%m-%d %H:%M:%S") .. "\n")
        file:write("ライセンスキー: " .. hashedId .. "\n")
        file:close()
    end

    stop()  -- スクリプト終了
else
    -- 認証成功時
    toast("✅ ライセンス認証成功", 2)
    -- メインアプリケーション実行
    App:run()
end
```

### デバイス情報表示（購入者登録用）
```lua
function Security.showDeviceInfo()
    local deviceId = nil

    -- デバイスID取得（複数方法）
    if getSN then deviceId = getSN() end
    if not deviceId and getDeviceID then deviceId = getDeviceID() end
    if not deviceId then
        local w, h = getScreenResolution()
        deviceId = string.format("%d_%d", w, h)
    end

    if not deviceId then
        return nil, nil, "デバイスIDを取得できません"
    end

    local hashedId = Security.simpleHash(deviceId)

    local message = "=== デバイス情報 ===\n"
    message = message .. "デバイスID: " .. string.sub(deviceId, 1, 12) .. "...\n"
    message = message .. "ライセンスキー: " .. hashedId .. "\n"
    message = message .. "この情報を開発者に送信してください"

    return deviceId, hashedId, message
end
```

### ライセンス認証付きGUIダイアログ
```lua
-- 認証成功後のみ表示される設定ダイアログ
local function showSettingsDialog()
    local controls = {
        {type = CONTROLLER_TYPE.LABEL, text = "🔒 Instagram自動化 [認証版] 🔒"},
        {type = CONTROLLER_TYPE.LABEL, text = "✅ ライセンス認証済み"},
        {type = CONTROLLER_TYPE.INPUT, title = "設定値:", key = "value", value = "30"},
        {type = CONTROLLER_TYPE.PICKER, title = "速度:", key = "speed", value = "通常",
         options = {"高速", "通常"}},
        {type = CONTROLLER_TYPE.SWITCH, title = "デバッグ:", key = "debug", value = 0},
        {type = CONTROLLER_TYPE.BUTTON, title = "🚀 開始", color = 0x68D391,
         width = 0.5, flag = 1, collectInputs = true},
        {type = CONTROLLER_TYPE.BUTTON, title = "❌ キャンセル", color = 0xFF5733,
         width = 0.5, flag = 2, collectInputs = false}
    }

    local result = dialog(controls, {ORIENTATION_TYPE.PORTRAIT})

    if result == 1 then
        -- 設定値を返す
        return {
            value = tonumber(controls[3].value),
            speedMode = controls[4].value,
            debugMode = (controls[5].value == 1)
        }
    end
    return nil
end
```

### 重要な実装ポイント

1. **デバイスID取得の複数方法**
   - `getSN()` → `getDeviceID()` → 画面解像度ベース
   - フォールバック実装で確実性向上

2. **ハッシュ化によるセキュリティ**
   - デバイスIDを直接保存せずハッシュ化
   - 32文字の16進数文字列として管理

3. **購入者登録フロー**
   - 未認証時にライセンスキー表示
   - ファイル保存で確実な記録
   - 販売者への送信を促す明確な指示

4. **認証状態の視覚的表示**
   - 認証成功: ✅ マーク表示
   - 未認証: 🔒 エラーダイアログ
   - バージョン識別子で管理

### ライセンス認証の完全な実装フロー

#### 1. 購入者のデバイス登録プロセス
```lua
-- device_register_final.lua - 購入者が実行するスクリプト
local function registerDevice()
    local deviceId, hashedId, message = Security.showDeviceInfo()

    -- 登録情報をファイルに保存
    local file = io.open("my_device_info.txt", "w")
    if file then
        file:write("=== あなたのデバイス情報 ===\n")
        file:write("ライセンスキー: " .. hashedId .. "\n")
        file:write("登録日時: " .. os.date("%Y-%m-%d %H:%M:%S") .. "\n")
        file:write("\n【次の手順】\n")
        file:write("1. このライセンスキーを販売者に送信\n")
        file:write("2. 認証済みバージョンを受け取る\n")
        file:write("3. 新しいスクリプトを実行\n")
        file:close()
    end

    -- ダイアログで表示
    local controls = {
        {type = CONTROLLER_TYPE.LABEL, text = "📱 デバイス登録情報 📱"},
        {type = CONTROLLER_TYPE.LABEL, text = "━━━━━━━━━━━━━━━━━━━"},
        {type = CONTROLLER_TYPE.INPUT,
         title = "ライセンスキー:",
         key = "key",
         value = hashedId,
         prompt = "このキーをコピーしてください"},
        {type = CONTROLLER_TYPE.LABEL, text = ""},
        {type = CONTROLLER_TYPE.LABEL, text = "📋 このキーを販売者に送信してください"},
        {type = CONTROLLER_TYPE.LABEL, text = "📧 送信後、認証版が提供されます"},
        {type = CONTROLLER_TYPE.BUTTON, title = "OK", color = 0x68D391, flag = 1}
    }

    dialog(controls, {ORIENTATION_TYPE.PORTRAIT})
    toast("✅ デバイス情報をmy_device_info.txtに保存しました", 3)
end

registerDevice()
```

#### 2. 販売者側のデバイス追加手順
```lua
-- 販売者が新規購入者のデバイスを追加する方法
-- 1. 購入者からライセンスキーを受け取る
-- 2. Security.authorizedDevicesに追加
-- 3. 更新版を購入者に送信

Security.authorizedDevices = {
    "aac62cabf60fd77aab722285f60c0a67",  -- 購入者1 (2024-01-15追加)
    "bbc72dabg71ge88bbc833396g71d1b78",  -- 購入者2 (2024-01-16追加)
    "ccd83ebch82hf99ccd944407h82e2c89",  -- 購入者3 (2024-01-17追加)
    -- 新規購入者のハッシュをここに追加
}
```

#### 3. エラーハンドリングとログ記録
```lua
-- 認証エラーの詳細ログ
function Security.logAuthenticationAttempt(success, deviceId, hashedId)
    local logFile = "authentication_log.txt"
    local file = io.open(logFile, "a")

    if file then
        file:write(string.format(
            "[%s] %s - Device: %s, Hash: %s\n",
            os.date("%Y-%m-%d %H:%M:%S"),
            success and "SUCCESS" or "FAILED",
            string.sub(deviceId or "unknown", 1, 8) .. "...",
            string.sub(hashedId or "unknown", 1, 16) .. "..."
        ))
        file:close()
    end
end

-- 認証試行時のログ記録
function Security.authenticateDeviceWithLogging()
    local deviceId = getDeviceId()  -- 実装済みの関数
    local hashedId = Security.simpleHash(deviceId)
    local isAuthenticated = false

    for _, authorizedHash in ipairs(Security.authorizedDevices) do
        if hashedId == authorizedHash then
            isAuthenticated = true
            break
        end
    end

    -- ログ記録
    Security.logAuthenticationAttempt(isAuthenticated, deviceId, hashedId)

    return isAuthenticated, hashedId
end
```

#### 4. バージョン管理と有効期限
```lua
-- 拡張版: 有効期限付きライセンス
Security.authorizedDevicesWithExpiry = {
    {hash = "aac62cabf60fd77aab722285f60c0a67", expiry = "2025-12-31"},
    {hash = "bbc72dabg71ge88bbc833396g71d1b78", expiry = "2024-06-30"},
}

function Security.checkLicenseExpiry(hashedId)
    for _, device in ipairs(Security.authorizedDevicesWithExpiry) do
        if device.hash == hashedId then
            local currentDate = os.date("%Y-%m-%d")
            if currentDate <= device.expiry then
                return true, "有効なライセンス"
            else
                return false, "ライセンス期限切れ: " .. device.expiry
            end
        end
    end
    return false, "未登録デバイス"
end
```

#### 5. 複数スクリプトへの統合
```lua
-- 共通認証モジュール (auth_common.lua)
local AuthCommon = {}

-- 認証を必要とする全スクリプトで使用
function AuthCommon.requireAuthentication(scriptName)
    local isAuth, message = Security.authenticateDevice()

    if not isAuth then
        -- 共通エラー処理
        toast("❌ " .. scriptName .. " - ライセンス認証が必要です", 3)

        -- エラーダイアログ
        local controls = {
            {type = CONTROLLER_TYPE.LABEL, text = "🔒 認証エラー: " .. scriptName},
            {type = CONTROLLER_TYPE.LABEL, text = message},
            {type = CONTROLLER_TYPE.BUTTON, title = "終了", color = 0xFF5733, flag = 1}
        }
        dialog(controls, {ORIENTATION_TYPE.PORTRAIT})

        stop()
        return false
    end

    toast("✅ " .. scriptName .. " - 認証成功", 2)
    return true
end

-- 使用例: timeline.lua
if not AuthCommon.requireAuthentication("Instagram自動いいね") then
    return
end

-- 使用例: unfollow.lua
if not AuthCommon.requireAuthentication("Instagram自動アンフォロー") then
    return
end
```

### ライセンス認証のベストプラクティス

1. **セキュリティ強化**
   - デバイスIDは必ずハッシュ化して保存
   - 複数のID取得方法でフォールバック対応
   - 認証ログで不正アクセスを監視

2. **ユーザビリティ**
   - 明確なエラーメッセージ表示
   - ライセンスキーのコピー機能
   - 登録手順の視覚的ガイド

3. **メンテナンス性**
   - 共通認証モジュールで一元管理
   - バージョン識別子で更新管理
   - 有効期限機能で柔軟な運用

4. **トラブルシューティング**
   - 詳細なログファイル生成
   - デバイスID取得失敗時の代替手段
   - 認証状態の可視化

## 🚀 AutoTouch ランチャー実装（main.lua）

### オフライン認証システム

AutoTouch環境ではHTTP関数が利用できないため、オフライン認証システムを実装：

```lua
-- 認証済みデバイスリスト
local authorizedDevices = {
    "FFMZ3GTSJC6J",  -- 認証済みデバイス
    "TEST123ABCD",   -- テスト用デバイス
}

-- オフライン認証（サーバー不要）
function tryOfflineAuthentication(deviceHash)
    for _, authorizedDevice in ipairs(authorizedDevices) do
        if deviceHash == authorizedDevice then
            return jsonAuthResponse  -- 認証成功
        end
    end
    return nil  -- 認証失敗
end
```

### 認証フロー
1. `main.lua`実行 → デバイスハッシュ取得
2. オフライン認証 → 認証済みデバイスリストと照合
3. 認証成功 → ツール選択ダイアログ表示
4. ツール選択 → 選択したツールを実行

### 完成版の仕様と実装方法

#### ディレクトリ構造（Jailbreak環境）
```
/var/jb/var/mobile/Library/AutoTouch/Scripts/AutoTouchScripts/test/
├── main.lua        # ランチャースクリプト
├── test1.lua       # 実行対象スクリプト
├── test2.lua       # 実行対象スクリプト
├── timeline.lua    # Instagram自動いいね
└── unfollow.lua    # Instagram自動アンフォロー
```

#### 重要な実装ポイント

### 1. パス取得には`rootDir()`を使用
```lua
-- AutoTouchのrootDir()関数で実際のパスを取得
local rootPath = rootDir and rootDir() or "/var/jb/var/mobile/Library/AutoTouch/Scripts"
local absolutePath = rootPath .. "/AutoTouchScripts/test/" .. scriptFileName
```

### 2. 絶対パスのみ使用（相対パスは失敗する）
```lua
-- ❌ 相対パスは使用しない（エラーになる）
-- dofile(scriptFileName)
-- dofile("./timeline.lua")

-- ✅ 絶対パスを使用
dofile(absolutePath)
```

### 3. ファイル検出は事前定義リスト方式
```lua
-- io.openやlfsでのスキャンは失敗するため、事前定義リストを使用
local defaultFiles = {"test1.lua", "test2.lua", "timeline.lua", "unfollow.lua"}
for _, filename in ipairs(defaultFiles) do
    if filename ~= "main.lua" then
        table.insert(files, {
            filename = filename,
            displayName = description .. " (" .. filename .. ")"
        })
    end
end
```

### 4. ダイアログによるスクリプト選択
```lua
local controls = {
    {type = CONTROLLER_TYPE.LABEL, text = "🚀 タイトル 🚀"},
    {type = CONTROLLER_TYPE.PICKER,
     title = "📋 選択:",
     key = "script",
     value = fileOptions[1],
     options = fileOptions},
    {type = CONTROLLER_TYPE.BUTTON,
     title = "▶️ 実行",
     color = 0x68D391,
     width = 0.5,
     flag = 1,
     collectInputs = true},
    {type = CONTROLLER_TYPE.BUTTON,
     title = "❌ 終了",
     color = 0xFF5733,
     width = 0.5,
     flag = 2,
     collectInputs = false}
}
local result = dialog(controls, orientations)
```

### 5. AutoTouchの注意点
- `alert()`関数の戻り値が期待通りに動作しない場合がある → トースト通知を活用
- ファイルシステムアクセスは絶対パスで行う
- Jailbreak環境では`/var/jb/`プレフィックスが必要
- `io.open()`でのディレクトリスキャンは動作しない

### 実装テンプレート（今後の参考用）
```lua
-- メインランチャーのテンプレート
local function executeScript(scriptFileName)
    -- rootDir()で実際のパスを取得
    local rootPath = rootDir and rootDir() or "/var/jb/var/mobile/Library/AutoTouch/Scripts"
    local absolutePath = rootPath .. "/AutoTouchScripts/test/" .. scriptFileName

    -- ファイル存在確認（絶対パスで）
    local checkFile = io.open(absolutePath, "r")
    if not checkFile then
        log("❌ ファイルが見つかりません: " .. absolutePath)
        toast("❌ ファイルが見つかりません", 3)
        return false
    end
    checkFile:close()

    -- 実行（エラーハンドリング付き）
    local success, err = pcall(function()
        log("🎯 実行中: dofile('" .. absolutePath .. "')")
        dofile(absolutePath)
    end)

    if success then
        log("✅ 正常に実行しました")
    else
        log("❌ エラー: " .. tostring(err))
    end

    return success
end

-- ファイルリストの作成（スキャンではなく事前定義）
local function getLuaFiles()
    local files = {}
    local fileDescriptions = {
        ["test1.lua"] = "テストスクリプト1",
        ["test2.lua"] = "テストスクリプト2",
        ["timeline.lua"] = "タイムライン自動いいね",
        ["unfollow.lua"] = "自動アンフォロー",
        ["hashtaglike.lua"] = "ハッシュタグ自動いいね"
    }

    -- 事前定義リストから作成
    local defaultFiles = {"test1.lua", "test2.lua", "timeline.lua", "unfollow.lua", "hashtaglike.lua"}
    for _, filename in ipairs(defaultFiles) do
        local description = fileDescriptions[filename] or filename:gsub("%.lua$", "")
        table.insert(files, {
            filename = filename,
            displayName = description .. " (" .. filename .. ")"
        })
    end

    return files
end
```

### 実装時のログ例（正常動作）
```
📋 利用可能なスクリプトリスト
✅ 利用可能: test1.lua
✅ 利用可能: test2.lua
✅ 利用可能: timeline.lua
✅ 利用可能: unfollow.lua
📊 合計 4 個のスクリプトを検出
📂 スクリプトを読み込み中: timeline.lua
📍 実行パス: /var/jb/var/mobile/Library/AutoTouch/Scripts/AutoTouchScripts/test/timeline.lua
✅ ファイルを発見
🎯 実行中: dofile('/var/jb/var/mobile/Library/AutoTouch/Scripts/AutoTouchScripts/test/timeline.lua')
✅ timeline.lua を正常に実行しました
```