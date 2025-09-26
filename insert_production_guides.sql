-- 本番用のガイドデータを挿入
-- Supabase Dashboard > SQL Editorで実行してください

-- ===================================================
-- 既存のテストデータをクリーンアップ（オプション）
-- ===================================================
SELECT 'Cleaning up test guides...' as status;

DELETE FROM guides
WHERE category = 'test';

-- ===================================================
-- 本番用ガイドデータを挿入/更新
-- ===================================================
SELECT 'Inserting production guides...' as status;

-- Beginnerカテゴリ
INSERT INTO guides (title, slug, description, category, order_index, content, is_active) VALUES
(
    'はじめに - SmartGramへようこそ',
    'welcome',
    'SmartGramの概要と基本的な使い方',
    'beginner',
    1,
    E'# SmartGramへようこそ\n\nSmartGramは、Instagramの自動化を効率的に行うためのツールです。\n\n## 主な機能\n\n- **タイムライン自動化**: フィードの自動いいね\n- **ハッシュタグいいね**: 特定のハッシュタグに基づく自動いいね\n- **フォロー/アンフォロー**: 戦略的なフォロワー管理\n- **アクティブいいね**: エンゲージメントの向上\n\n## 必要なもの\n\n1. 脱獄済みのiPhone\n2. AutoTouchアプリ\n3. SmartGramライセンス\n4. Instagram公式アプリ\n\n## サポート\n\n問題が発生した場合は、トラブルシューティングガイドをご確認ください。',
    true
),
(
    'AutoTouchのインストールと設定',
    'autotouch-setup',
    'AutoTouchの詳細なインストール手順',
    'beginner',
    2,
    E'# AutoTouchのインストールと設定\n\n## インストール手順\n\n### 1. リポジトリの追加\n\n1. Cydia/Sileo/Zebraを開く\n2. ソース/リポジトリに移動\n3. 以下のURLを追加: `https://autotouch.net/`\n\n### 2. AutoTouchのインストール\n\n1. 検索で「AutoTouch」を探す\n2. インストールボタンをタップ\n3. デバイスをリスプリング\n\n### 3. ライセンスの有効化\n\n1. AutoTouchを起動\n2. 設定 > ライセンスに移動\n3. ライセンスキーを入力\n\n### 4. 権限の設定\n\n- Instagramへのアクセスを許可\n- バックグラウンド実行を有効化\n\n## 注意事項\n\n- iOS 12-16に対応\n- 定期的にAutoTouchを更新してください',
    true
),
(
    'SmartGramスクリプトの初期設定',
    'smartgram-initial-setup',
    'SmartGramスクリプトの設定方法',
    'beginner',
    3,
    E'# SmartGramスクリプトの初期設定\n\n## 1. スクリプトのダウンロード\n\n1. ダッシュボードにログイン\n2. 「パッケージダウンロード」をクリック\n3. ZIPファイルをダウンロード\n\n## 2. スクリプトのインストール\n\n1. ダウンロードしたZIPを解凍\n2. AutoTouchを開く\n3. Scripts > Import からスクリプトをインポート\n\n## 3. 基本設定\n\n### デバイスハッシュの設定\n\n```lua\nDEVICE_HASH = "YOUR_DEVICE_HASH"\n```\n\n### 動作間隔の設定\n\n```lua\nMIN_DELAY = 3  -- 最小待機時間（秒）\nMAX_DELAY = 8  -- 最大待機時間（秒）\n```\n\n## 4. 初回実行\n\n1. Instagramアプリを開く\n2. AutoTouchでスクリプトを選択\n3. Playボタンをタップ\n\n## トラブルシューティング\n\nスクリプトが動作しない場合は、以下を確認：\n- デバイスハッシュが正しいか\n- AutoTouchの権限が適切か\n- Instagramが最新版か',
    true
)
ON CONFLICT (slug) DO UPDATE SET
    title = EXCLUDED.title,
    description = EXCLUDED.description,
    content = EXCLUDED.content,
    category = EXCLUDED.category,
    order_index = EXCLUDED.order_index,
    is_active = EXCLUDED.is_active,
    updated_at = NOW();

-- Advancedカテゴリ
INSERT INTO guides (title, slug, description, category, order_index, content, is_active) VALUES
(
    'タイムライン自動化の詳細設定',
    'timeline-advanced',
    'タイムライン機能の高度な設定方法',
    'advanced',
    10,
    E'# タイムライン自動化の詳細設定\n\n## カスタマイズオプション\n\n### いいね速度の調整\n\n```lua\n-- 高速モード\nMIN_DELAY = 1\nMAX_DELAY = 3\n\n-- 安全モード\nMIN_DELAY = 5\nMAX_DELAY = 15\n```\n\n### スキップ条件\n\n```lua\n-- 広告をスキップ\nSKIP_ADS = true\n\n-- 既にいいねした投稿をスキップ\nSKIP_LIKED = true\n\n-- 特定のアカウントをスキップ\nSKIP_ACCOUNTS = {"account1", "account2"}\n```\n\n## パフォーマンス最適化\n\n### メモリ管理\n\n- 1時間ごとにスクリプトを再起動\n- キャッシュをクリア\n\n### バッテリー節約\n\n- 画面の明るさを下げる\n- WiFi接続を使用\n- 充電中に実行\n\n## 安全性の確保\n\n- 1日のいいね数を制限（600-800）\n- ランダムな休憩時間を設定\n- 人間らしい動作パターンを維持',
    true
),
(
    'フォロー/アンフォロー戦略',
    'follow-unfollow-strategy',
    '効果的なフォロワー管理方法',
    'advanced',
    11,
    E'# フォロー/アンフォロー戦略\n\n## フォロー戦略\n\n### ターゲット選定\n\n1. **競合アカウントのフォロワー**\n   - 類似アカウントを特定\n   - アクティブなフォロワーを選択\n\n2. **ハッシュタグベース**\n   - 関連ハッシュタグの投稿者\n   - エンゲージメント率の高いユーザー\n\n### フォロー設定\n\n```lua\n-- 1日のフォロー数上限\nMAX_FOLLOWS_PER_DAY = 150\n\n-- フォロー間隔\nFOLLOW_INTERVAL = {min = 30, max = 90}\n\n-- フォロワー/フォロー比率チェック\nCHECK_RATIO = true\nMAX_RATIO = 3.0  -- 3:1以上はスキップ\n```\n\n## アンフォロー戦略\n\n### タイミング\n\n- フォロー後48-72時間\n- フォローバックがない場合\n\n### 設定\n\n```lua\n-- アンフォロー待機期間\nUNFOLLOW_AFTER_DAYS = 3\n\n-- 1日のアンフォロー数\nMAX_UNFOLLOWS_PER_DAY = 100\n\n-- ホワイトリスト（アンフォローしない）\nWHITELIST = {"important_account1", "friend_account"}\n```\n\n## 注意事項\n\n- Instagramの制限を超えないように注意\n- 急激な変化は避ける\n- 定期的に戦略を見直す',
    true
)
ON CONFLICT (slug) DO UPDATE SET
    title = EXCLUDED.title,
    description = EXCLUDED.description,
    content = EXCLUDED.content,
    category = EXCLUDED.category,
    order_index = EXCLUDED.order_index,
    is_active = EXCLUDED.is_active,
    updated_at = NOW();

-- Troubleshootingカテゴリ
INSERT INTO guides (title, slug, description, category, order_index, content, is_active) VALUES
(
    'よくある問題と解決方法',
    'common-issues',
    '頻繁に発生する問題のトラブルシューティング',
    'troubleshooting',
    20,
    E'# よくある問題と解決方法\n\n## スクリプトが起動しない\n\n### 原因と対策\n\n1. **AutoTouchが無効**\n   - 設定 > AutoTouch > 有効化を確認\n   - デバイスを再起動\n\n2. **ライセンスエラー**\n   - ライセンスキーを再入力\n   - インターネット接続を確認\n\n3. **権限不足**\n   - Instagramへのアクセスを許可\n   - スクリーンタイムを無効化\n\n## いいねができない\n\n### チェックリスト\n\n- [ ] Instagramアプリは最新版か\n- [ ] アカウントは制限されていないか\n- [ ] スクリプトの座標は正しいか\n- [ ] デバイスの画面サイズは対応しているか\n\n### 解決方法\n\n1. 座標の再調整\n2. スクリプトの更新\n3. Instagramの再ログイン\n\n## 動作が遅い\n\n### パフォーマンス改善\n\n1. **不要なアプリを終了**\n2. **キャッシュをクリア**\n3. **デバイスを再起動**\n4. **遅延設定を調整**\n\n## アカウントが制限された\n\n### 対処法\n\n1. 24-48時間活動を停止\n2. 手動で通常使用を再開\n3. 設定を安全側に調整\n4. 段階的に自動化を再開',
    true
),
(
    'エラーコード一覧',
    'error-codes',
    'エラーコードの意味と対処法',
    'troubleshooting',
    21,
    E'# エラーコード一覧\n\n## AutoTouch関連\n\n### Error 100: Script not found\n**原因**: スクリプトファイルが見つからない\n**解決**: スクリプトを再インポート\n\n### Error 101: Permission denied\n**原因**: 実行権限がない\n**解決**: AutoTouchの権限を確認\n\n### Error 102: License invalid\n**原因**: ライセンスが無効\n**解決**: ライセンスを再認証\n\n## SmartGram関連\n\n### Error 200: Device hash mismatch\n**原因**: デバイスハッシュが一致しない\n**解決**: 正しいハッシュを設定\n\n### Error 201: API connection failed\n**原因**: サーバーに接続できない\n**解決**: インターネット接続を確認\n\n### Error 202: Rate limit exceeded\n**原因**: API制限に達した\n**解決**: 時間をおいて再試行\n\n## Instagram関連\n\n### Error 300: Element not found\n**原因**: UI要素が見つからない\n**解決**: \n- Instagramを更新\n- スクリプトを更新\n- 座標を再調整\n\n### Error 301: Action blocked\n**原因**: Instagramが動作をブロック\n**解決**: \n- 24時間待機\n- 設定を緩める\n\n### Error 302: Login required\n**原因**: ログインが必要\n**解決**: Instagramに再ログイン\n\n## 対処法まとめ\n\n1. エラーコードを確認\n2. 該当する解決方法を試す\n3. 解決しない場合はサポートに連絡',
    true
)
ON CONFLICT (slug) DO UPDATE SET
    title = EXCLUDED.title,
    description = EXCLUDED.description,
    content = EXCLUDED.content,
    category = EXCLUDED.category,
    order_index = EXCLUDED.order_index,
    is_active = EXCLUDED.is_active,
    updated_at = NOW();

-- ===================================================
-- 結果を確認
-- ===================================================
SELECT 'Checking inserted guides...' as status;

-- カテゴリ別のガイド数
SELECT
    category,
    COUNT(*) as guide_count,
    STRING_AGG(title, ' | ' ORDER BY order_index) as titles
FROM guides
WHERE is_active = true
GROUP BY category
ORDER BY
    CASE category
        WHEN 'beginner' THEN 1
        WHEN 'advanced' THEN 2
        WHEN 'troubleshooting' THEN 3
        ELSE 4
    END;

-- 合計ガイド数
SELECT
    COUNT(*) as total_guides,
    COUNT(DISTINCT category) as total_categories
FROM guides
WHERE is_active = true;

SELECT '✅ Production guides inserted successfully!' as final_status;