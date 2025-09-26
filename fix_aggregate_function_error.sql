-- array_agg集計関数エラーの完全修正
-- Supabase Dashboard > SQL Editorで実行してください

-- ステップ1: 問題のある全てのビューを一旦削除
DROP VIEW IF EXISTS admin_users_view CASCADE;
DROP VIEW IF EXISTS device_plan_view CASCADE;
DROP VIEW IF EXISTS dashboard_data CASCADE;
DROP VIEW IF EXISTS user_subscription_view CASCADE;

-- ステップ2: plansテーブルの構造を確認・修正
-- featuresカラムをTEXT配列型に変更（まだの場合）
DO $$
BEGIN
    -- featuresカラムが存在しない場合は追加
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'plans'
        AND column_name = 'features'
    ) THEN
        ALTER TABLE plans ADD COLUMN features TEXT[];
    -- TEXT型の場合は配列型に変換
    ELSIF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'plans'
        AND column_name = 'features'
        AND data_type = 'text'
    ) THEN
        -- 一時的にカラムをリネーム
        ALTER TABLE plans RENAME COLUMN features TO features_old;
        -- 新しい配列型カラムを追加
        ALTER TABLE plans ADD COLUMN features TEXT[];
        -- データを移行（カンマ区切りの文字列を配列に変換）
        UPDATE plans
        SET features = string_to_array(features_old, ',')
        WHERE features_old IS NOT NULL;
        -- 古いカラムを削除
        ALTER TABLE plans DROP COLUMN features_old;
    END IF;

    -- limitationsカラムも同様に処理
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'plans'
        AND column_name = 'limitations'
    ) THEN
        ALTER TABLE plans ADD COLUMN limitations TEXT[];
    END IF;
END $$;

-- ステップ3: plansテーブルのデータを整備
UPDATE plans SET
    features = CASE
        WHEN name = 'trial' THEN
            ARRAY['3日間の無料トライアル', '基本機能へのアクセス', 'タイムライン自動化']::TEXT[]
        WHEN name = 'starter' THEN
            ARRAY['タイムライン自動化', 'ハッシュタグいいね', '基本サポート']::TEXT[]
        WHEN name = 'pro' THEN
            ARRAY['全Starter機能', 'フォロー自動化', 'アンフォロー自動化', '優先サポート']::TEXT[]
        WHEN name = 'max' THEN
            ARRAY['全Pro機能', 'アクティブいいね', '高度な自動化', 'プレミアムサポート']::TEXT[]
        ELSE features
    END,
    limitations = CASE
        WHEN name = 'trial' THEN
            ARRAY['3日間の期限']::TEXT[]
        WHEN name = 'starter' THEN
            ARRAY[]::TEXT[]
        WHEN name = 'pro' THEN
            ARRAY[]::TEXT[]
        WHEN name = 'max' THEN
            ARRAY[]::TEXT[]
        ELSE limitations
    END
WHERE features IS NULL OR array_length(features, 1) IS NULL;

-- ステップ4: シンプルなdevice_plan_viewを作成（集計関数なし）
CREATE OR REPLACE VIEW device_plan_view AS
SELECT
    d.id,
    d.device_hash,
    d.user_id,
    d.status,
    d.trial_ends_at,
    d.created_at,
    d.updated_at,
    COALESCE(s.plan_id,
        CASE
            WHEN d.status = 'trial' THEN 'trial'
            ELSE NULL
        END
    ) as plan_id,
    p.display_name as plan_display_name,
    p.price_jpy as plan_price,
    p.features as plan_features,
    s.status as subscription_status,
    s.current_period_end as subscription_end,
    s.stripe_subscription_id,
    s.paypal_subscription_id
FROM devices d
LEFT JOIN subscriptions s ON d.id = s.device_id AND s.status = 'active'
LEFT JOIN plans p ON COALESCE(s.plan_id, CASE WHEN d.status = 'trial' THEN 'trial' ELSE NULL END) = p.name;

-- ステップ5: admin_users_viewを正しく作成（GROUP BYを適切に使用）
CREATE OR REPLACE VIEW admin_users_view AS
SELECT
    u.id,
    u.email,
    u.created_at,
    COUNT(DISTINCT d.id) as device_count,
    COUNT(DISTINCT s.id) FILTER (WHERE s.status = 'active') as active_subscriptions,
    COALESCE(
        STRING_AGG(
            DISTINCT p.display_name,
            ', '
            ORDER BY p.display_name
        ) FILTER (WHERE s.status = 'active'),
        'なし'
    ) as active_plans,
    MAX(d.created_at) as last_device_registration,
    COALESCE(
        SUM(p.price_jpy) FILTER (WHERE s.status = 'active'),
        0
    ) as total_monthly_revenue
FROM auth.users u
LEFT JOIN devices d ON u.id = d.user_id
LEFT JOIN subscriptions s ON d.id = s.device_id
LEFT JOIN plans p ON s.plan_id = p.name
GROUP BY u.id, u.email, u.created_at;

-- ステップ6: 結果を確認
SELECT 'Aggregate function errors fixed!' as status;

-- plansテーブルの構造確認
SELECT
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'plans'
ORDER BY ordinal_position;

-- ビューが正常に作成されたか確認
SELECT
    schemaname,
    viewname
FROM pg_views
WHERE schemaname = 'public'
AND viewname IN ('device_plan_view', 'admin_users_view')
ORDER BY viewname;

-- plansテーブルのデータを確認
SELECT name, display_name, features, limitations
FROM plans
ORDER BY sort_order;