-- すべてのテーブル構造エラーを完全に修正
-- Supabase Dashboard > SQL Editorで実行してください

-- ===================================================
-- ステップ1: subscriptionsテーブルの構造を修正
-- ===================================================

SELECT 'Fixing subscriptions table...' as status;

-- 必要なカラムを追加
ALTER TABLE subscriptions
ADD COLUMN IF NOT EXISTS current_period_start TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS current_period_end TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS cancel_at_period_end BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS canceled_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS trial_start TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS trial_end TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- ===================================================
-- ステップ2: plansテーブルの完全修正
-- ===================================================

SELECT 'Fixing plans table...' as status;

-- 必要なカラムを追加
ALTER TABLE plans
ADD COLUMN IF NOT EXISTS display_name TEXT,
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS features TEXT[],
ADD COLUMN IF NOT EXISTS limitations TEXT[],
ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS stripe_price_id TEXT,
ADD COLUMN IF NOT EXISTS paypal_plan_id TEXT,
ADD COLUMN IF NOT EXISTS original_price_jpy INTEGER,
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- display_nameを設定
UPDATE plans
SET display_name = CASE
    WHEN name = 'trial' THEN 'トライアル'
    WHEN name = 'starter' THEN 'スターター'
    WHEN name = 'pro' THEN 'プロ'
    WHEN name = 'max' THEN 'マックス'
    ELSE COALESCE(display_name, UPPER(LEFT(name, 1)) || LOWER(SUBSTRING(name FROM 2)))
END
WHERE display_name IS NULL OR display_name = '';

-- featuresを設定
UPDATE plans
SET features = CASE
    WHEN name = 'trial' THEN ARRAY['3日間の無料トライアル', '基本機能へのアクセス', 'タイムライン自動化']::TEXT[]
    WHEN name = 'starter' THEN ARRAY['タイムライン自動化', 'ハッシュタグいいね', '基本サポート']::TEXT[]
    WHEN name = 'pro' THEN ARRAY['全Starter機能', 'フォロー自動化', 'アンフォロー自動化', '優先サポート']::TEXT[]
    WHEN name = 'max' THEN ARRAY['全Pro機能', 'アクティブいいね', '高度な自動化', 'プレミアムサポート']::TEXT[]
    ELSE COALESCE(features, ARRAY[]::TEXT[])
END
WHERE features IS NULL OR array_length(features, 1) IS NULL;

-- sort_orderを設定
UPDATE plans
SET sort_order = CASE
    WHEN name = 'trial' THEN 0
    WHEN name = 'starter' THEN 1
    WHEN name = 'pro' THEN 2
    WHEN name = 'max' THEN 3
    ELSE COALESCE(sort_order, 99)
END
WHERE sort_order IS NULL OR sort_order = 0;

-- original_price_jpyを設定
UPDATE plans
SET original_price_jpy = COALESCE(original_price_jpy, price_jpy)
WHERE original_price_jpy IS NULL;

-- ===================================================
-- ステップ3: devicesテーブルの確認と修正
-- ===================================================

SELECT 'Checking devices table...' as status;

-- 必要に応じてカラムを追加
ALTER TABLE devices
ADD COLUMN IF NOT EXISTS plan_id TEXT,
ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- ===================================================
-- ステップ4: user_packagesテーブルの修正
-- ===================================================

SELECT 'Fixing user_packages table...' as status;

ALTER TABLE user_packages
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

-- ===================================================
-- ステップ5: guidesテーブルの作成/修正
-- ===================================================

SELECT 'Creating/fixing guides table...' as status;

CREATE TABLE IF NOT EXISTS guides (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    slug TEXT UNIQUE,
    description TEXT,
    content TEXT,
    youtube_url TEXT,
    video_id TEXT,
    category TEXT,
    order_index INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id)
);

-- slugカラムを追加（既存テーブルの場合）
ALTER TABLE guides
ADD COLUMN IF NOT EXISTS slug TEXT UNIQUE;

-- slugを自動生成
UPDATE guides
SET slug = LOWER(REGEXP_REPLACE(REGEXP_REPLACE(title, '[^a-zA-Z0-9\s-]', '', 'g'), '\s+', '-', 'g'))
WHERE slug IS NULL;

-- ===================================================
-- ステップ6: ビューを削除して再作成
-- ===================================================

SELECT 'Recreating views...' as status;

-- 既存のビューを削除
DROP VIEW IF EXISTS device_plan_view CASCADE;
DROP VIEW IF EXISTS admin_users_view CASCADE;

-- device_plan_viewを再作成（修正されたカラムを使用）
CREATE OR REPLACE VIEW device_plan_view AS
SELECT
    d.id,
    d.device_hash,
    d.user_id,
    d.status as device_status,
    d.trial_ends_at,
    d.created_at,
    d.updated_at,
    -- プランID（デバイスまたはサブスクリプションから）
    COALESCE(
        s.plan_id,
        d.plan_id,
        CASE WHEN d.status = 'trial' THEN 'trial' ELSE NULL END
    ) as plan_id,
    -- プラン情報
    p.name as plan_name,
    p.display_name as plan_display_name,
    p.price_jpy as plan_price,
    p.original_price_jpy as plan_original_price,
    p.features as plan_features,
    p.limitations as plan_limitations,
    -- サブスクリプション情報
    s.id as subscription_id,
    s.status as subscription_status,
    s.current_period_start as subscription_period_start,
    s.current_period_end as subscription_period_end,
    s.cancel_at_period_end as subscription_cancel_at_period_end,
    s.stripe_subscription_id,
    s.paypal_subscription_id,
    s.created_at as subscription_created_at,
    s.updated_at as subscription_updated_at
FROM devices d
LEFT JOIN subscriptions s ON d.id = s.device_id AND s.status IN ('active', 'trialing')
LEFT JOIN plans p ON COALESCE(s.plan_id, d.plan_id, CASE WHEN d.status = 'trial' THEN 'trial' ELSE NULL END) = p.name
WHERE d.status != 'suspended';

-- admin_users_viewを再作成
CREATE OR REPLACE VIEW admin_users_view AS
SELECT
    u.id,
    u.email,
    u.created_at as user_created_at,
    -- デバイス統計
    COUNT(DISTINCT d.id) as device_count,
    COUNT(DISTINCT d.id) FILTER (WHERE d.status = 'active') as active_device_count,
    COUNT(DISTINCT d.id) FILTER (WHERE d.status = 'trial') as trial_device_count,
    -- サブスクリプション統計
    COUNT(DISTINCT s.id) FILTER (WHERE s.status = 'active') as active_subscription_count,
    -- プラン情報
    STRING_AGG(
        DISTINCT p.display_name, ', ' ORDER BY p.display_name
    ) FILTER (WHERE s.status = 'active') as active_plans,
    -- 最新のアクティビティ
    MAX(d.created_at) as last_device_registration,
    MAX(d.last_active_at) as last_active_at,
    -- 収益
    COALESCE(
        SUM(DISTINCT p.price_jpy) FILTER (WHERE s.status = 'active'),
        0
    ) as total_monthly_revenue_jpy
FROM auth.users u
LEFT JOIN devices d ON u.id = d.user_id
LEFT JOIN subscriptions s ON d.id = s.device_id
LEFT JOIN plans p ON s.plan_id = p.name
GROUP BY u.id, u.email, u.created_at;

-- ===================================================
-- ステップ7: インデックスの作成
-- ===================================================

SELECT 'Creating indexes...' as status;

-- plans
CREATE INDEX IF NOT EXISTS idx_plans_is_active ON plans(is_active);
CREATE INDEX IF NOT EXISTS idx_plans_sort_order ON plans(sort_order);
CREATE INDEX IF NOT EXISTS idx_plans_name ON plans(name);

-- subscriptions
CREATE INDEX IF NOT EXISTS idx_subscriptions_device_id ON subscriptions(device_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_plan_id ON subscriptions(plan_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_period_end ON subscriptions(current_period_end);

-- devices
CREATE INDEX IF NOT EXISTS idx_devices_user_id ON devices(user_id);
CREATE INDEX IF NOT EXISTS idx_devices_status ON devices(status);
CREATE INDEX IF NOT EXISTS idx_devices_trial_ends ON devices(trial_ends_at);

-- user_packages
CREATE INDEX IF NOT EXISTS idx_user_packages_is_active ON user_packages(is_active);
CREATE INDEX IF NOT EXISTS idx_user_packages_user_device ON user_packages(user_id, device_hash);

-- guides
CREATE INDEX IF NOT EXISTS idx_guides_is_active ON guides(is_active);
CREATE INDEX IF NOT EXISTS idx_guides_category ON guides(category);
CREATE INDEX IF NOT EXISTS idx_guides_order ON guides(order_index);
CREATE INDEX IF NOT EXISTS idx_guides_slug ON guides(slug);

-- ===================================================
-- ステップ8: guidesのRLSポリシー
-- ===================================================

SELECT 'Setting up RLS policies...' as status;

ALTER TABLE guides ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Guides are viewable by everyone" ON guides;
DROP POLICY IF EXISTS "Guides are manageable by admins" ON guides;

CREATE POLICY "Guides are viewable by everyone" ON guides
    FOR SELECT
    USING (is_active = true);

CREATE POLICY "Guides are manageable by admins" ON guides
    FOR ALL
    USING (
        auth.jwt()->>'email' = 'akihiro.tnk@gmail.com' OR
        auth.jwt()->>'role' = 'admin'
    );

-- ===================================================
-- ステップ9: トリガー関数
-- ===================================================

SELECT 'Creating triggers...' as status;

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- guidesテーブルのトリガー
DROP TRIGGER IF EXISTS update_guides_updated_at ON guides;
CREATE TRIGGER update_guides_updated_at
    BEFORE UPDATE ON guides
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- plansテーブルのトリガー
DROP TRIGGER IF EXISTS update_plans_updated_at ON plans;
CREATE TRIGGER update_plans_updated_at
    BEFORE UPDATE ON plans
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ===================================================
-- ステップ10: 基本データの挿入/更新
-- ===================================================

SELECT 'Inserting/updating base data...' as status;

-- プランデータ
INSERT INTO plans (
    name, display_name, price_jpy, original_price_jpy,
    features, limitations, sort_order, is_active
)
VALUES
    ('trial', 'トライアル', 0, 0,
     ARRAY['3日間の無料トライアル', '基本機能へのアクセス', 'タイムライン自動化']::TEXT[],
     ARRAY['3日間の期限']::TEXT[], 0, true),
    ('starter', 'スターター', 2980, 2980,
     ARRAY['タイムライン自動化', 'ハッシュタグいいね', '基本サポート']::TEXT[],
     ARRAY[]::TEXT[], 1, true),
    ('pro', 'プロ', 8800, 8800,
     ARRAY['全Starter機能', 'フォロー自動化', 'アンフォロー自動化', '優先サポート']::TEXT[],
     ARRAY[]::TEXT[], 2, true),
    ('max', 'マックス', 15000, 15000,
     ARRAY['全Pro機能', 'アクティブいいね', '高度な自動化', 'プレミアムサポート']::TEXT[],
     ARRAY[]::TEXT[], 3, true)
ON CONFLICT (name) DO UPDATE
SET
    display_name = EXCLUDED.display_name,
    price_jpy = EXCLUDED.price_jpy,
    original_price_jpy = EXCLUDED.original_price_jpy,
    features = EXCLUDED.features,
    limitations = EXCLUDED.limitations,
    sort_order = EXCLUDED.sort_order,
    is_active = EXCLUDED.is_active,
    updated_at = NOW();

-- ガイドデータ
INSERT INTO guides (
    title, slug, description, category,
    order_index, content, is_active
)
VALUES
    ('はじめに - SmartGramの基本設定', 'getting-started',
     'SmartGramの初期設定方法を説明します', 'beginner',
     1, E'# SmartGramへようこそ\n\nこのガイドでは基本的な設定方法を説明します。', true),
    ('AutoTouchのインストール方法', 'install-autotouch',
     'iPhoneにAutoTouchをインストールする手順', 'beginner',
     2, E'# AutoTouchのインストール\n\n1. Cydia/Sileoを開く\n2. AutoTouchを検索\n3. インストール', true),
    ('スクリプトの使い方', 'how-to-use-scripts',
     'スクリプトの基本的な使い方を解説', 'beginner',
     3, E'# スクリプトの使い方\n\n詳細な使用方法を説明します。', true)
ON CONFLICT (slug) DO UPDATE
SET
    title = EXCLUDED.title,
    description = EXCLUDED.description,
    category = EXCLUDED.category,
    order_index = EXCLUDED.order_index,
    content = EXCLUDED.content,
    is_active = EXCLUDED.is_active,
    updated_at = NOW();

-- ===================================================
-- ステップ11: 最終確認
-- ===================================================

SELECT 'Final verification...' as status;

-- テーブル構造の確認
SELECT 'Table structures:' as info;
SELECT
    t.table_name,
    COUNT(c.column_name) as column_count,
    STRING_AGG(
        CASE
            WHEN c.column_name IN ('is_active', 'display_name', 'current_period_end')
            THEN c.column_name || '✓'
            ELSE c.column_name
        END,
        ', ' ORDER BY c.ordinal_position
    ) as columns
FROM information_schema.tables t
JOIN information_schema.columns c
    ON t.table_name = c.table_name
    AND t.table_schema = c.table_schema
WHERE t.table_schema = 'public'
    AND t.table_type = 'BASE TABLE'
    AND t.table_name IN ('plans', 'subscriptions', 'devices', 'user_packages', 'guides')
GROUP BY t.table_name
ORDER BY t.table_name;

-- ビューの確認
SELECT 'Views created:' as info;
SELECT viewname FROM pg_views
WHERE schemaname = 'public'
AND viewname IN ('device_plan_view', 'admin_users_view')
ORDER BY viewname;

-- プランデータの確認
SELECT 'Plans data:' as info;
SELECT name, display_name, price_jpy, is_active, sort_order
FROM plans
ORDER BY sort_order;

-- 成功メッセージ
SELECT '✅ All table structures fixed successfully!' as status;