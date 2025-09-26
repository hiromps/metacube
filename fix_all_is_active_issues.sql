-- is_activeカラムエラーを完全に修正するSQL
-- Supabase Dashboard > SQL Editorで実行してください

-- ===================================================
-- ステップ1: すべての可能性のあるテーブルにis_activeカラムを追加
-- ===================================================

-- plansテーブル
ALTER TABLE plans
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

-- user_packagesテーブル
ALTER TABLE user_packages
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

-- guidesテーブルが存在しない場合は作成
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

-- devicesテーブル（念のため）
ALTER TABLE devices
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

-- subscriptionsテーブル（念のため）
ALTER TABLE subscriptions
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

-- ===================================================
-- ステップ2: ATE関連テーブルが存在する場合、is_activeカラムを追加
-- ===================================================

-- ate_templatesが存在する場合
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'ate_templates'
    ) THEN
        ALTER TABLE ate_templates
        ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
    END IF;
END $$;

-- ate_filesが存在する場合
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'ate_files'
    ) THEN
        ALTER TABLE ate_files
        ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
    END IF;
END $$;

-- file_generation_queueが存在する場合
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'file_generation_queue'
    ) THEN
        ALTER TABLE file_generation_queue
        ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
    END IF;
END $$;

-- ===================================================
-- ステップ3: 問題のある関数を修正
-- ===================================================

-- queue_ate_generation関数を削除して再作成
DROP FUNCTION IF EXISTS queue_ate_generation(TEXT, TEXT, INTEGER) CASCADE;
DROP FUNCTION IF EXISTS queue_ate_generation(TEXT, INTEGER) CASCADE;
DROP FUNCTION IF EXISTS queue_ate_generation(TEXT) CASCADE;

-- シンプルなバージョンを作成（is_activeを使用しない）
CREATE OR REPLACE FUNCTION queue_ate_generation(
    device_hash_param TEXT,
    priority_param INTEGER DEFAULT 5
) RETURNS UUID AS $$
DECLARE
    device_record RECORD;
    queue_id UUID;
BEGIN
    -- デバイスを検索
    SELECT d.*, u.email
    INTO device_record
    FROM devices d
    JOIN auth.users u ON d.user_id = u.id
    WHERE d.device_hash = UPPER(device_hash_param);

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Device not found: %', device_hash_param;
    END IF;

    -- キューIDを生成
    queue_id := gen_random_uuid();

    -- file_generation_queueが存在する場合のみ挿入
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'file_generation_queue'
    ) THEN
        INSERT INTO file_generation_queue (id, device_id, priority)
        VALUES (queue_id, device_record.id, priority_param);
    END IF;

    RETURN queue_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===================================================
-- ステップ4: ビューを再作成（is_activeを正しく参照）
-- ===================================================

-- device_plan_viewを削除して再作成
DROP VIEW IF EXISTS device_plan_view CASCADE;
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

-- admin_users_viewを削除して再作成
DROP VIEW IF EXISTS admin_users_view CASCADE;
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
-- ステップ5: guidesテーブルのインデックスとポリシー
-- ===================================================

-- インデックスを作成
CREATE INDEX IF NOT EXISTS idx_guides_is_active ON guides(is_active);
CREATE INDEX IF NOT EXISTS idx_guides_category ON guides(category);
CREATE INDEX IF NOT EXISTS idx_guides_order ON guides(order_index);

-- RLSを有効化
ALTER TABLE guides ENABLE ROW LEVEL SECURITY;

-- ポリシーを削除して再作成
DROP POLICY IF EXISTS "Guides are viewable by everyone" ON guides;
DROP POLICY IF EXISTS "Guides are manageable by admins" ON guides;

-- is_activeカラムが存在する場合のみポリシーを作成
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'guides'
        AND column_name = 'is_active'
    ) THEN
        CREATE POLICY "Guides are viewable by everyone" ON guides
            FOR SELECT
            USING (is_active = true);

        CREATE POLICY "Guides are manageable by admins" ON guides
            FOR ALL
            USING (
                auth.jwt()->>'email' = 'akihiro.tnk@gmail.com' OR
                auth.jwt()->>'role' = 'admin'
            );
    END IF;
END $$;

-- ===================================================
-- ステップ6: トリガーの作成
-- ===================================================

-- updated_at更新関数
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

-- ===================================================
-- ステップ7: サンプルデータの挿入
-- ===================================================

-- guidesテーブルにサンプルデータ
INSERT INTO guides (title, slug, description, category, order_index, content)
VALUES
    ('はじめに - SmartGramの基本設定', 'getting-started', 'SmartGramの初期設定方法を説明します', 'beginner', 1, E'# SmartGramへようこそ\n\nこのガイドでは基本的な設定方法を説明します。'),
    ('AutoTouchのインストール方法', 'install-autotouch', 'iPhoneにAutoTouchをインストールする手順', 'beginner', 2, E'# AutoTouchのインストール\n\n1. Cydia/Sileoを開く\n2. AutoTouchを検索\n3. インストール'),
    ('スクリプトの使い方', 'how-to-use-scripts', 'スクリプトの基本的な使い方を解説', 'beginner', 3, E'# スクリプトの使い方\n\n詳細な使用方法を説明します。')
ON CONFLICT DO NOTHING;

-- ===================================================
-- ステップ8: 結果の確認
-- ===================================================

-- is_activeカラムを持つテーブルの一覧
SELECT
    table_name,
    'has is_active' as status
FROM information_schema.columns
WHERE table_schema = 'public'
    AND column_name = 'is_active'
ORDER BY table_name;

-- 作成されたビューの確認
SELECT viewname FROM pg_views
WHERE schemaname = 'public'
ORDER BY viewname;

-- guidesテーブルのポリシー確認
SELECT policyname, cmd, qual
FROM pg_policies
WHERE tablename = 'guides';

-- 成功メッセージ
SELECT 'All is_active issues should be fixed!' as status;