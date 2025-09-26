-- plansテーブルとis_activeエラーを完全に修正
-- Supabase Dashboard > SQL Editorで実行してください

-- ===================================================
-- ステップ1: plansテーブルの構造を確認して修正
-- ===================================================

-- 現在のplansテーブルの構造を確認
SELECT 'Current plans table structure:' as info;
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'plans'
ORDER BY ordinal_position;

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
ADD COLUMN IF NOT EXISTS description TEXT;

-- display_nameを設定（NULLの場合）
UPDATE plans
SET display_name = CASE
    WHEN name = 'trial' THEN 'トライアル'
    WHEN name = 'starter' THEN 'スターター'
    WHEN name = 'pro' THEN 'プロ'
    WHEN name = 'max' THEN 'マックス'
    ELSE UPPER(LEFT(name, 1)) || LOWER(SUBSTRING(name FROM 2))
END
WHERE display_name IS NULL;

-- featuresを設定（NULLまたは空の場合）
UPDATE plans
SET features = CASE
    WHEN name = 'trial' THEN ARRAY['3日間の無料トライアル', '基本機能へのアクセス', 'タイムライン自動化']::TEXT[]
    WHEN name = 'starter' THEN ARRAY['タイムライン自動化', 'ハッシュタグいいね', '基本サポート']::TEXT[]
    WHEN name = 'pro' THEN ARRAY['全Starter機能', 'フォロー自動化', 'アンフォロー自動化', '優先サポート']::TEXT[]
    WHEN name = 'max' THEN ARRAY['全Pro機能', 'アクティブいいね', '高度な自動化', 'プレミアムサポート']::TEXT[]
    ELSE ARRAY[]::TEXT[]
END
WHERE features IS NULL OR array_length(features, 1) IS NULL;

-- sort_orderを設定
UPDATE plans
SET sort_order = CASE
    WHEN name = 'trial' THEN 0
    WHEN name = 'starter' THEN 1
    WHEN name = 'pro' THEN 2
    WHEN name = 'max' THEN 3
    ELSE 99
END
WHERE sort_order IS NULL OR sort_order = 0;

-- ===================================================
-- ステップ2: user_packagesテーブルの修正
-- ===================================================

ALTER TABLE user_packages
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

-- ===================================================
-- ステップ3: guidesテーブルの作成/修正
-- ===================================================

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

-- ===================================================
-- ステップ4: ビューを削除して再作成
-- ===================================================

-- 既存のビューを削除
DROP VIEW IF EXISTS device_plan_view CASCADE;
DROP VIEW IF EXISTS admin_users_view CASCADE;

-- device_plan_viewを再作成（display_nameカラムを使用）
CREATE VIEW device_plan_view AS
SELECT
    d.id,
    d.device_hash,
    d.user_id,
    d.status,
    d.trial_ends_at,
    d.created_at,
    d.updated_at,
    COALESCE(s.plan_id,
        CASE WHEN d.status = 'trial' THEN 'trial' ELSE NULL END
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

-- admin_users_viewを再作成
CREATE VIEW admin_users_view AS
SELECT
    u.id,
    u.email,
    u.created_at,
    COUNT(DISTINCT d.id) as device_count,
    COUNT(DISTINCT s.id) FILTER (WHERE s.status = 'active') as active_subscriptions,
    COALESCE(
        STRING_AGG(
            DISTINCT p.display_name, ', ' ORDER BY p.display_name
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

-- ===================================================
-- ステップ5: インデックスの作成
-- ===================================================

CREATE INDEX IF NOT EXISTS idx_plans_is_active ON plans(is_active);
CREATE INDEX IF NOT EXISTS idx_plans_sort_order ON plans(sort_order);
CREATE INDEX IF NOT EXISTS idx_user_packages_is_active ON user_packages(is_active);
CREATE INDEX IF NOT EXISTS idx_guides_is_active ON guides(is_active);
CREATE INDEX IF NOT EXISTS idx_guides_category ON guides(category);
CREATE INDEX IF NOT EXISTS idx_guides_order ON guides(order_index);

-- ===================================================
-- ステップ6: guidesのRLSポリシー
-- ===================================================

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
-- ステップ7: トリガー
-- ===================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_guides_updated_at ON guides;
CREATE TRIGGER update_guides_updated_at
    BEFORE UPDATE ON guides
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ===================================================
-- ステップ8: プランデータの確認と挿入
-- ===================================================

-- 基本プランが存在しない場合は挿入
INSERT INTO plans (name, display_name, price_jpy, original_price_jpy, features, limitations, sort_order, is_active)
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
    features = EXCLUDED.features,
    limitations = EXCLUDED.limitations,
    sort_order = EXCLUDED.sort_order,
    is_active = EXCLUDED.is_active;

-- ===================================================
-- ステップ9: guidesサンプルデータ
-- ===================================================

INSERT INTO guides (title, slug, description, category, order_index, content, is_active)
VALUES
    ('はじめに - SmartGramの基本設定', 'getting-started', 'SmartGramの初期設定方法を説明します', 'beginner', 1, E'# SmartGramへようこそ\n\nこのガイドでは基本的な設定方法を説明します。', true),
    ('AutoTouchのインストール方法', 'install-autotouch', 'iPhoneにAutoTouchをインストールする手順', 'beginner', 2, E'# AutoTouchのインストール\n\n1. Cydia/Sileoを開く\n2. AutoTouchを検索\n3. インストール', true),
    ('スクリプトの使い方', 'how-to-use-scripts', 'スクリプトの基本的な使い方を解説', 'beginner', 3, E'# スクリプトの使い方\n\n詳細な使用方法を説明します。', true)
ON CONFLICT (slug) DO NOTHING;

-- ===================================================
-- ステップ10: 最終確認
-- ===================================================

-- plansテーブルの構造確認
SELECT 'Plans table after fixes:' as info;
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'plans'
ORDER BY ordinal_position;

-- plansテーブルのデータ確認
SELECT name, display_name, price_jpy, is_active, sort_order
FROM plans
ORDER BY sort_order;

-- ビューの確認
SELECT 'Created views:' as info;
SELECT viewname FROM pg_views WHERE schemaname = 'public' ORDER BY viewname;

-- guidesテーブルの確認
SELECT COUNT(*) as guides_count FROM guides WHERE is_active = true;

-- 成功メッセージ
SELECT 'All errors should be fixed now!' as status;