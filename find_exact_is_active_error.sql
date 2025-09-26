-- is_activeエラーの正確な場所を特定するSQL
-- 各クエリを個別に実行してエラーメッセージを確認してください

-- ===================================================
-- パート1: 各テーブルのis_activeカラムの存在を個別に確認
-- ===================================================

-- 1. devices テーブル
SELECT 'Checking devices table' as checking;
SELECT
    EXISTS(
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'devices'
        AND column_name = 'is_active'
    ) as has_is_active;

-- テスト: devicesテーブルからis_activeを選択
-- このクエリでエラーが出る場合、devicesにis_activeがない
SELECT COUNT(*) FROM devices WHERE is_active = true;

-- ===================================================

-- 2. subscriptions テーブル
SELECT 'Checking subscriptions table' as checking;
SELECT
    EXISTS(
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'subscriptions'
        AND column_name = 'is_active'
    ) as has_is_active;

-- テスト
SELECT COUNT(*) FROM subscriptions WHERE is_active = true;

-- ===================================================

-- 3. plans テーブル
SELECT 'Checking plans table' as checking;
SELECT
    EXISTS(
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'plans'
        AND column_name = 'is_active'
    ) as has_is_active;

-- テスト
SELECT COUNT(*) FROM plans WHERE is_active = true;

-- ===================================================

-- 4. user_packages テーブル
SELECT 'Checking user_packages table' as checking;
SELECT
    EXISTS(
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'user_packages'
        AND column_name = 'is_active'
    ) as has_is_active;

-- テスト
SELECT COUNT(*) FROM user_packages WHERE is_active = true;

-- ===================================================

-- 5. guides テーブル
SELECT 'Checking guides table' as checking;
SELECT
    EXISTS(
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'guides'
        AND column_name = 'is_active'
    ) as has_is_active;

-- テスト
SELECT COUNT(*) FROM guides WHERE is_active = true;

-- ===================================================

-- 6. licenses テーブル
SELECT 'Checking licenses table' as checking;
SELECT
    EXISTS(
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'licenses'
        AND column_name = 'is_active'
    ) as has_is_active;

-- テスト（エラーが予想される）
SELECT COUNT(*) FROM licenses WHERE is_active = true;

-- ===================================================

-- 7. payment_history テーブル
SELECT 'Checking payment_history table' as checking;
SELECT
    EXISTS(
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'payment_history'
        AND column_name = 'is_active'
    ) as has_is_active;

-- テスト（エラーが予想される）
SELECT COUNT(*) FROM payment_history WHERE is_active = true;

-- ===================================================

-- 8. api_logs テーブル
SELECT 'Checking api_logs table' as checking;
SELECT
    EXISTS(
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'api_logs'
        AND column_name = 'is_active'
    ) as has_is_active;

-- テスト（エラーが予想される）
SELECT COUNT(*) FROM api_logs WHERE is_active = true;

-- ===================================================

-- 9. users_profile テーブル
SELECT 'Checking users_profile table' as checking;
SELECT
    EXISTS(
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'users_profile'
        AND column_name = 'is_active'
    ) as has_is_active;

-- テスト（エラーが予想される）
SELECT COUNT(*) FROM users_profile WHERE is_active = true;

-- ===================================================

-- 10. stripe_webhook_events テーブル
SELECT 'Checking stripe_webhook_events table' as checking;
SELECT
    EXISTS(
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'stripe_webhook_events'
        AND column_name = 'is_active'
    ) as has_is_active;

-- テスト（エラーが予想される）
SELECT COUNT(*) FROM stripe_webhook_events WHERE is_active = true;

-- ===================================================
-- パート2: is_activeカラムが必要ないテーブルの一覧
-- ===================================================

SELECT 'Tables that do NOT need is_active column:' as info;
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_type = 'BASE TABLE'
AND table_name NOT IN ('plans', 'user_packages', 'guides', 'ate_templates', 'ate_files')
AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns c
    WHERE c.table_schema = 'public'
    AND c.table_name = tables.table_name
    AND c.column_name = 'is_active'
)
ORDER BY table_name;