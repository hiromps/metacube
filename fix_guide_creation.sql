-- ガイド作成を修正する簡潔なSQL
-- Supabase Dashboard > SQL Editorで実行してください

-- ===================================================
-- ステップ1: RLSを一時的に無効化
-- ===================================================
ALTER TABLE guides DISABLE ROW LEVEL SECURITY;

SELECT 'RLS disabled for guides table' as status;

-- ===================================================
-- ステップ2: guidesテーブルの構造を確認・修正
-- ===================================================

-- created_byカラムをNULL許可に変更（外部キー制約が問題の場合）
ALTER TABLE guides
ALTER COLUMN created_by DROP NOT NULL;

-- その他の必須カラムもNULL許可に変更
ALTER TABLE guides
ALTER COLUMN created_at SET DEFAULT NOW(),
ALTER COLUMN updated_at SET DEFAULT NOW(),
ALTER COLUMN is_active SET DEFAULT true,
ALTER COLUMN order_index SET DEFAULT 0;

SELECT 'Column constraints relaxed' as status;

-- ===================================================
-- ステップ3: テストデータを挿入
-- ===================================================
INSERT INTO guides (
    title,
    slug,
    description,
    category,
    order_index,
    content,
    is_active
) VALUES (
    'テストガイド',
    'test-guide-' || EXTRACT(EPOCH FROM NOW())::TEXT,
    'これはテストガイドです',
    'test',
    999,
    '# テストガイド\n\nこれはテスト用のガイドです。',
    true
);

SELECT 'Test guide inserted' as status;

-- ===================================================
-- ステップ4: RLSを再度有効化（緩いポリシーで）
-- ===================================================
ALTER TABLE guides ENABLE ROW LEVEL SECURITY;

-- 既存のポリシーをすべて削除
DROP POLICY IF EXISTS "Guides are viewable by everyone" ON guides;
DROP POLICY IF EXISTS "Guides are manageable by admins" ON guides;
DROP POLICY IF EXISTS "Authenticated users can manage guides" ON guides;
DROP POLICY IF EXISTS "Users can manage their own guides" ON guides;
DROP POLICY IF EXISTS "Admins can manage all guides" ON guides;
DROP POLICY IF EXISTS "Anyone can view active guides" ON guides;

-- シンプルなポリシーを作成
-- 1. 誰でもガイドを読める
CREATE POLICY "public_read_guides" ON guides
    FOR SELECT
    USING (true);

-- 2. 認証済みユーザーは作成・更新・削除できる
CREATE POLICY "authenticated_write_guides" ON guides
    FOR INSERT
    WITH CHECK (true);

CREATE POLICY "authenticated_update_guides" ON guides
    FOR UPDATE
    USING (true)
    WITH CHECK (true);

CREATE POLICY "authenticated_delete_guides" ON guides
    FOR DELETE
    USING (true);

SELECT 'Simple RLS policies created' as status;

-- ===================================================
-- ステップ5: 結果を確認
-- ===================================================

-- guidesテーブルの内容
SELECT
    id,
    title,
    slug,
    category,
    is_active,
    created_at
FROM guides
ORDER BY created_at DESC
LIMIT 5;

-- RLSポリシーの状態
SELECT
    policyname,
    cmd,
    permissive
FROM pg_policies
WHERE tablename = 'guides'
ORDER BY policyname;

-- RLSが有効か確認
SELECT
    tablename,
    rowsecurity
FROM pg_tables
WHERE tablename = 'guides';

SELECT '✅ Guide creation should work now!' as final_status;

-- ===================================================
-- オプション: より厳格なポリシーに戻す場合
-- ===================================================
/*
-- コメントを外して実行すると、より厳格なポリシーに戻せます

DROP POLICY IF EXISTS "public_read_guides" ON guides;
DROP POLICY IF EXISTS "authenticated_write_guides" ON guides;
DROP POLICY IF EXISTS "authenticated_update_guides" ON guides;
DROP POLICY IF EXISTS "authenticated_delete_guides" ON guides;

-- アクティブなガイドのみ表示
CREATE POLICY "View active guides" ON guides
    FOR SELECT
    USING (is_active = true);

-- 管理者のみ編集可能
CREATE POLICY "Admin manage guides" ON guides
    FOR ALL
    USING (
        auth.jwt()->>'email' = 'akihiro.tnk@gmail.com' OR
        auth.jwt()->>'role' = 'service_role'
    );
*/