-- is_activeエラーの即座の修正
-- Supabase Dashboard > SQL Editorで実行してください

-- 1. plansテーブルにis_activeカラムを追加（存在しない場合）
ALTER TABLE plans
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

-- 2. user_packagesテーブルにis_activeカラムを追加（存在しない場合）
ALTER TABLE user_packages
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

-- 3. ate_templatesテーブルが参照される場合のダミーテーブル作成
CREATE TABLE IF NOT EXISTS ate_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. guidesテーブルを作成（存在しない場合）
CREATE TABLE IF NOT EXISTS guides (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    youtube_url TEXT,
    video_id TEXT,
    content TEXT,
    category TEXT,
    order_index INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id)
);

-- 5. インデックスを作成（存在しない場合）
CREATE INDEX IF NOT EXISTS idx_plans_is_active ON plans(is_active);
CREATE INDEX IF NOT EXISTS idx_user_packages_is_active ON user_packages(is_active);
CREATE INDEX IF NOT EXISTS idx_guides_is_active ON guides(is_active);
CREATE INDEX IF NOT EXISTS idx_guides_category ON guides(category);
CREATE INDEX IF NOT EXISTS idx_guides_order ON guides(order_index);

-- 6. guidesのRLSを設定
ALTER TABLE guides ENABLE ROW LEVEL SECURITY;

-- 既存のポリシーを削除して再作成
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

-- 7. トリガー関数を作成（存在しない場合）
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 8. guidesテーブルのトリガーを作成
DROP TRIGGER IF EXISTS update_guides_updated_at ON guides;
CREATE TRIGGER update_guides_updated_at
    BEFORE UPDATE ON guides
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 9. サンプルデータをguidesに挿入
INSERT INTO guides (title, description, category, order_index, content)
VALUES
    ('はじめに - SmartGramの基本設定', 'SmartGramの初期設定方法を説明します', 'beginner', 1, E'# SmartGramへようこそ\n\nこのガイドでは基本的な設定方法を説明します。'),
    ('AutoTouchのインストール方法', 'iPhoneにAutoTouchをインストールする手順', 'beginner', 2, E'# AutoTouchのインストール\n\n1. Cydia/Sileoを開く\n2. AutoTouchを検索\n3. インストール'),
    ('スクリプトの使い方', 'スクリプトの基本的な使い方を解説', 'beginner', 3, E'# スクリプトの使い方\n\n詳細な使用方法を説明します。')
ON CONFLICT DO NOTHING;

-- 10. 結果を確認
SELECT 'All fixes applied!' as status;

-- 各テーブルのis_activeカラムの存在を確認
SELECT
    table_name,
    column_name,
    data_type
FROM information_schema.columns
WHERE table_schema = 'public'
AND column_name = 'is_active'
ORDER BY table_name;

-- guidesテーブルのデータ数を確認
SELECT COUNT(*) as guides_count FROM guides;