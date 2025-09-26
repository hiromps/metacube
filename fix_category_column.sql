-- categoryカラムエラーを修正
-- Supabase Dashboard > SQL Editorで実行してください

-- ===================================================
-- ステップ1: guidesテーブルの構造を確認
-- ===================================================
SELECT 'Checking guides table structure...' as status;

-- guidesテーブルの現在のカラムを確認
SELECT
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'guides'
ORDER BY ordinal_position;

-- ===================================================
-- ステップ2: guidesテーブルにcategoryカラムを追加
-- ===================================================
SELECT 'Adding category column to guides table...' as status;

-- categoryカラムを追加（存在しない場合）
ALTER TABLE guides
ADD COLUMN IF NOT EXISTS category TEXT;

-- ===================================================
-- ステップ3: guidesテーブルのその他の必要なカラムも確認・追加
-- ===================================================
SELECT 'Adding other necessary columns...' as status;

ALTER TABLE guides
ADD COLUMN IF NOT EXISTS slug TEXT,
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS content TEXT,
ADD COLUMN IF NOT EXISTS youtube_url TEXT,
ADD COLUMN IF NOT EXISTS video_id TEXT,
ADD COLUMN IF NOT EXISTS order_index INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id);

-- slugにUNIQUE制約を追加（まだない場合）
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'guides_slug_key'
    ) THEN
        ALTER TABLE guides ADD CONSTRAINT guides_slug_key UNIQUE (slug);
    END IF;
END $$;

-- ===================================================
-- ステップ4: slugを自動生成（NULLの場合）
-- ===================================================
SELECT 'Generating slugs for existing records...' as status;

UPDATE guides
SET slug = LOWER(
    REGEXP_REPLACE(
        REGEXP_REPLACE(title, '[^a-zA-Z0-9\s-]', '', 'g'),
        '\s+', '-', 'g'
    )
)
WHERE slug IS NULL;

-- ===================================================
-- ステップ5: インデックスを作成（エラーを避けるため再作成）
-- ===================================================
SELECT 'Creating indexes...' as status;

-- 既存のインデックスを削除して再作成
DROP INDEX IF EXISTS idx_guides_is_active;
DROP INDEX IF EXISTS idx_guides_category;
DROP INDEX IF EXISTS idx_guides_order;
DROP INDEX IF EXISTS idx_guides_slug;
DROP INDEX IF EXISTS guides_is_active_idx;
DROP INDEX IF EXISTS guides_category_idx;
DROP INDEX IF EXISTS guides_order_idx;

-- 新しいインデックスを作成
CREATE INDEX idx_guides_is_active ON guides(is_active);
CREATE INDEX idx_guides_category ON guides(category);
CREATE INDEX idx_guides_order ON guides(order_index);
CREATE INDEX idx_guides_slug ON guides(slug);

-- ===================================================
-- ステップ6: RLSポリシーを再作成
-- ===================================================
SELECT 'Recreating RLS policies...' as status;

-- RLSを有効化
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
-- ステップ7: サンプルデータを挿入/更新
-- ===================================================
SELECT 'Inserting sample data...' as status;

-- 既存のデータがない場合、サンプルデータを挿入
INSERT INTO guides (
    title,
    slug,
    description,
    category,
    order_index,
    content,
    is_active
)
VALUES
    (
        'はじめに - SmartGramの基本設定',
        'getting-started',
        'SmartGramの初期設定方法を説明します',
        'beginner',
        1,
        E'# SmartGramへようこそ\n\nこのガイドでは基本的な設定方法を説明します。',
        true
    ),
    (
        'AutoTouchのインストール方法',
        'install-autotouch',
        'iPhoneにAutoTouchをインストールする手順',
        'beginner',
        2,
        E'# AutoTouchのインストール\n\n1. Cydia/Sileoを開く\n2. AutoTouchを検索\n3. インストール',
        true
    ),
    (
        'スクリプトの使い方',
        'how-to-use-scripts',
        'スクリプトの基本的な使い方を解説',
        'beginner',
        3,
        E'# スクリプトの使い方\n\n詳細な使用方法を説明します。',
        true
    ),
    (
        'トラブルシューティング',
        'troubleshooting',
        'よくある問題と解決方法',
        'troubleshooting',
        4,
        E'# トラブルシューティング\n\n## よくある問題\n\n### スクリプトが動作しない\n1. AutoTouchが最新版か確認\n2. デバイスを再起動\n3. スクリプトを再インストール',
        true
    ),
    (
        '高度な設定',
        'advanced-settings',
        '上級者向けの詳細設定',
        'advanced',
        5,
        E'# 高度な設定\n\n## カスタマイズ方法\n\n詳細なカスタマイズオプションについて説明します。',
        true
    )
ON CONFLICT (slug) DO UPDATE
SET
    title = EXCLUDED.title,
    description = EXCLUDED.description,
    category = EXCLUDED.category,
    order_index = EXCLUDED.order_index,
    content = EXCLUDED.content,
    is_active = EXCLUDED.is_active,
    updated_at = NOW();

-- 既存のレコードでcategoryがNULLの場合、デフォルト値を設定
UPDATE guides
SET category = 'general'
WHERE category IS NULL;

-- ===================================================
-- ステップ8: トリガーを作成
-- ===================================================
SELECT 'Creating triggers...' as status;

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
-- ステップ9: 最終確認
-- ===================================================
SELECT 'Final verification...' as status;

-- guidesテーブルの構造を確認
SELECT
    'Guides table columns:' as info,
    STRING_AGG(column_name, ', ' ORDER BY ordinal_position) as columns
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'guides';

-- guidesテーブルのデータを確認
SELECT
    id,
    title,
    slug,
    category,
    order_index,
    is_active
FROM guides
ORDER BY order_index;

-- インデックスの確認
SELECT
    indexname
FROM pg_indexes
WHERE tablename = 'guides'
ORDER BY indexname;

-- ポリシーの確認
SELECT
    policyname,
    cmd
FROM pg_policies
WHERE tablename = 'guides'
ORDER BY policyname;

SELECT '✅ Category column and guides table fixed!' as final_status;