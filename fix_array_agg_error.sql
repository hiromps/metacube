-- array_aggエラーの修正
-- Supabase Dashboard > SQL Editorで実行してください

-- 1. 問題のあるビューがある場合は削除して再作成
-- device_plan_viewが問題の可能性が高い
DROP VIEW IF EXISTS device_plan_view CASCADE;

-- 2. 正しい形式でdevice_plan_viewを再作成（必要な場合）
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
LEFT JOIN plans p ON COALESCE(s.plan_id, 'trial') = p.name;

-- 3. admin_users_viewが問題の可能性もある
DROP VIEW IF EXISTS admin_users_view CASCADE;

-- 4. 正しい形式でadmin_users_viewを再作成
CREATE OR REPLACE VIEW admin_users_view AS
SELECT
    u.id,
    u.email,
    u.created_at,
    COUNT(DISTINCT d.id) as device_count,
    COUNT(DISTINCT s.id) FILTER (WHERE s.status = 'active') as active_subscriptions,
    STRING_AGG(DISTINCT p.display_name, ', ' ORDER BY p.display_name) as active_plans,
    MAX(d.created_at) as last_device_registration,
    SUM(p.price_jpy) FILTER (WHERE s.status = 'active') as total_monthly_revenue
FROM auth.users u
LEFT JOIN devices d ON u.id = d.user_id
LEFT JOIN subscriptions s ON d.id = s.device_id
LEFT JOIN plans p ON s.plan_id = p.name
GROUP BY u.id, u.email, u.created_at;

-- 5. その他の可能性のあるビューも確認
-- dashboard_dataビューが存在する場合
DROP VIEW IF EXISTS dashboard_data CASCADE;

-- 6. plansテーブルのfeaturesカラムが配列型の場合の修正
-- featuresカラムがarray_aggを使用している可能性
DO $$
BEGIN
    -- featuresカラムの型を確認
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'plans'
        AND column_name = 'features'
        AND data_type = 'ARRAY'
    ) THEN
        -- 配列型の場合はそのまま
        NULL;
    ELSIF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'plans'
        AND column_name = 'features'
    ) THEN
        -- TEXT型をTEXT[]型に変更
        ALTER TABLE plans
        ALTER COLUMN features TYPE TEXT[]
        USING string_to_array(features, ',');
    ELSE
        -- featuresカラムが存在しない場合は追加
        ALTER TABLE plans
        ADD COLUMN features TEXT[];
    END IF;
END $$;

-- 7. limitationsカラムも同様に処理
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'plans'
        AND column_name = 'limitations'
    ) THEN
        ALTER TABLE plans
        ADD COLUMN limitations TEXT[];
    END IF;
END $$;

-- 8. プランデータを確認・更新
UPDATE plans
SET features = CASE
    WHEN name = 'trial' THEN ARRAY['3日間の無料トライアル', '基本機能へのアクセス', 'タイムライン自動化']
    WHEN name = 'starter' THEN ARRAY['タイムライン自動化', 'ハッシュタグいいね', '基本サポート']
    WHEN name = 'pro' THEN ARRAY['全Starter機能', 'フォロー自動化', 'アンフォロー自動化', '優先サポート']
    WHEN name = 'max' THEN ARRAY['全Pro機能', 'アクティブいいね', '高度な自動化', 'プレミアムサポート']
    ELSE features
END
WHERE features IS NULL OR array_length(features, 1) IS NULL;

-- 9. 結果を確認
SELECT 'Array aggregation errors fixed!' as status;

-- テーブル構造を確認
SELECT
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'plans'
ORDER BY ordinal_position;

-- ビューの一覧を確認
SELECT
    schemaname,
    viewname
FROM pg_views
WHERE schemaname = 'public'
ORDER BY viewname;