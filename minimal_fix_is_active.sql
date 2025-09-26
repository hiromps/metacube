-- is_activeエラーの最小限の修正
-- 本当に必要なテーブルにのみis_activeカラムを追加
-- Supabase Dashboard > SQL Editorで実行してください

-- ===================================================
-- ステップ1: 必要なテーブルにのみis_activeカラムを追加
-- ===================================================

-- plansテーブル（必須）
ALTER TABLE plans
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

-- user_packagesテーブル（必須）
ALTER TABLE user_packages
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

-- guidesテーブルを作成（存在しない場合）
CREATE TABLE IF NOT EXISTS guides (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
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

-- slugカラムを追加（存在しない場合）
ALTER TABLE guides
ADD COLUMN IF NOT EXISTS slug TEXT UNIQUE;

-- slugを自動生成（NULLの場合）
UPDATE guides
SET slug = LOWER(REPLACE(REPLACE(title, ' ', '-'), '　', '-'))
WHERE slug IS NULL;

-- ===================================================
-- ステップ2: ATE関連の処理（存在する場合のみ）
-- ===================================================

-- ate_templatesテーブルが存在する場合、is_activeを追加
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

-- ate_filesテーブルが存在する場合、is_activeを追加
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

-- ===================================================
-- ステップ3: インデックスの作成
-- ===================================================

CREATE INDEX IF NOT EXISTS idx_plans_is_active ON plans(is_active);
CREATE INDEX IF NOT EXISTS idx_user_packages_is_active ON user_packages(is_active);
CREATE INDEX IF NOT EXISTS idx_guides_is_active ON guides(is_active);
CREATE INDEX IF NOT EXISTS idx_guides_category ON guides(category);
CREATE INDEX IF NOT EXISTS idx_guides_order ON guides(order_index);

-- ===================================================
-- ステップ4: guidesテーブルのRLSポリシー
-- ===================================================

ALTER TABLE guides ENABLE ROW LEVEL SECURITY;

-- 既存のポリシーを削除
DROP POLICY IF EXISTS "Guides are viewable by everyone" ON guides;
DROP POLICY IF EXISTS "Guides are manageable by admins" ON guides;

-- 新しいポリシーを作成
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
-- ステップ5: updated_atトリガー
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
-- ステップ6: サンプルデータ（存在しない場合のみ）
-- ===================================================

INSERT INTO guides (title, slug, description, category, order_index, content, is_active)
VALUES
    ('はじめに - SmartGramの基本設定', 'getting-started', 'SmartGramの初期設定方法を説明します', 'beginner', 1, E'# SmartGramへようこそ\n\nこのガイドでは基本的な設定方法を説明します。', true),
    ('AutoTouchのインストール方法', 'install-autotouch', 'iPhoneにAutoTouchをインストールする手順', 'beginner', 2, E'# AutoTouchのインストール\n\n1. Cydia/Sileoを開く\n2. AutoTouchを検索\n3. インストール', true),
    ('スクリプトの使い方', 'how-to-use-scripts', 'スクリプトの基本的な使い方を解説', 'beginner', 3, E'# スクリプトの使い方\n\n詳細な使用方法を説明します。', true)
ON CONFLICT (slug) DO NOTHING;

-- ===================================================
-- ステップ7: 確認
-- ===================================================

-- is_activeカラムを持つテーブルの確認
SELECT
    table_name,
    CASE
        WHEN column_name IS NOT NULL THEN '✓ has is_active'
        ELSE '✗ missing is_active'
    END as status
FROM information_schema.tables t
LEFT JOIN information_schema.columns c
    ON t.table_name = c.table_name
    AND t.table_schema = c.table_schema
    AND c.column_name = 'is_active'
WHERE t.table_schema = 'public'
AND t.table_type = 'BASE TABLE'
AND t.table_name IN ('plans', 'user_packages', 'guides', 'ate_templates', 'ate_files')
ORDER BY t.table_name;

-- guidesテーブルのデータ確認
SELECT id, title, slug, category, is_active FROM guides ORDER BY order_index;

-- 成功メッセージ
SELECT 'is_active columns added to necessary tables only!' as status;