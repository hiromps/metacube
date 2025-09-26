-- ATE関連のテーブルと機能をすべて削除
-- Supabase Dashboard > SQL Editorで実行してください

-- 1. ATE関連のビューを削除（存在する場合）
DROP VIEW IF EXISTS ate_file_view CASCADE;
DROP VIEW IF EXISTS ate_queue_view CASCADE;
DROP VIEW IF EXISTS ate_download_view CASCADE;

-- 2. ATE関連の関数を削除
DROP FUNCTION IF EXISTS queue_ate_generation(TEXT, TEXT, INTEGER) CASCADE;
DROP FUNCTION IF EXISTS queue_ate_generation(TEXT, TEXT) CASCADE;
DROP FUNCTION IF EXISTS queue_ate_generation(TEXT) CASCADE;
DROP FUNCTION IF EXISTS generate_ate_file CASCADE;
DROP FUNCTION IF EXISTS process_ate_queue CASCADE;
DROP FUNCTION IF EXISTS cleanup_ate_files CASCADE;

-- 3. ATE関連のトリガーを削除（存在する場合）
DROP TRIGGER IF EXISTS update_ate_templates_updated_at ON ate_templates;
DROP TRIGGER IF EXISTS update_ate_files_updated_at ON ate_files;
DROP TRIGGER IF EXISTS update_file_generation_queue_updated_at ON file_generation_queue;
DROP TRIGGER IF EXISTS update_download_history_updated_at ON download_history;

-- 4. ATE関連のテーブルを削除（依存関係の順序で）
DROP TABLE IF EXISTS download_history CASCADE;
DROP TABLE IF EXISTS file_generation_queue CASCADE;
DROP TABLE IF EXISTS ate_files CASCADE;
DROP TABLE IF EXISTS ate_templates CASCADE;

-- 5. 12_fix_legacy_plans.sqlで作成した問題のある関数を削除して、シンプルなバージョンを作成
DROP FUNCTION IF EXISTS queue_ate_generation CASCADE;

-- 6. guidesテーブルが存在しない場合は作成
CREATE TABLE IF NOT EXISTS guides (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    description TEXT,
    content TEXT NOT NULL,
    youtube_url TEXT,
    video_id TEXT,
    category TEXT,
    order_index INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    created_by UUID REFERENCES auth.users(id)
);

-- 7. guidesテーブルのインデックスを作成
CREATE INDEX IF NOT EXISTS guides_is_active_idx ON guides(is_active);
CREATE INDEX IF NOT EXISTS guides_category_idx ON guides(category);
CREATE INDEX IF NOT EXISTS guides_order_idx ON guides(order_index);
CREATE INDEX IF NOT EXISTS guides_slug_idx ON guides(slug);

-- 8. guidesのRLSポリシー
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

-- 9. updated_atトリガー
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

-- 10. サンプルガイドデータを挿入（slugフィールドを追加）
INSERT INTO guides (title, slug, description, category, order_index, content)
VALUES
    ('はじめに - SmartGramの基本設定', 'getting-started', 'SmartGramの初期設定方法を説明します', 'beginner', 1, E'# SmartGramへようこそ\n\nこのガイドでは基本的な設定方法を説明します。'),
    ('AutoTouchのインストール方法', 'install-autotouch', 'iPhoneにAutoTouchをインストールする手順', 'beginner', 2, E'# AutoTouchのインストール\n\n1. Cydia/Sileoを開く\n2. AutoTouchを検索\n3. インストール'),
    ('スクリプトの使い方', 'how-to-use-scripts', 'スクリプトの基本的な使い方を解説', 'beginner', 3, E'# スクリプトの使い方\n\n詳細な使用方法を説明します。')
ON CONFLICT (slug) DO NOTHING;

-- 11. 結果を確認
SELECT 'ATE tables and functions removed successfully!' as status;

-- 削除されたことを確認
SELECT
    'Tables' as type,
    COUNT(*) as count
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name LIKE 'ate_%'
UNION ALL
SELECT
    'Functions' as type,
    COUNT(*) as count
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
AND p.proname LIKE '%ate%';

-- guidesテーブルが正常に作成されたか確認
SELECT COUNT(*) as guides_count FROM guides;