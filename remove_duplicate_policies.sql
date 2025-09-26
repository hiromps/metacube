-- 重複したポリシーを削除して、シンプルなポリシーを再作成
-- Supabase Dashboard > SQL Editorで実行してください

-- ===================================================
-- ステップ1: 現在のすべてのポリシーを表示
-- ===================================================
SELECT 'STEP 1: Current policies before cleanup' as status;

SELECT policyname, cmd
FROM pg_policies
WHERE tablename = 'guides'
ORDER BY policyname;

-- ===================================================
-- ステップ2: すべての既存ポリシーを削除
-- ===================================================
SELECT 'STEP 2: Removing all existing policies...' as status;

-- 個別に削除（エラーを回避するためIF EXISTSを使用）
DROP POLICY IF EXISTS "Anyone can view active guides" ON guides;
DROP POLICY IF EXISTS "Guides are viewable by everyone" ON guides;
DROP POLICY IF EXISTS "Guides are manageable by admins" ON guides;
DROP POLICY IF EXISTS "Users can manage their own guides" ON guides;
DROP POLICY IF EXISTS "Admins can manage all guides" ON guides;
DROP POLICY IF EXISTS "Authenticated users can manage guides" ON guides;
DROP POLICY IF EXISTS "public_read_guides" ON guides;
DROP POLICY IF EXISTS "authenticated_write_guides" ON guides;
DROP POLICY IF EXISTS "authenticated_update_guides" ON guides;
DROP POLICY IF EXISTS "authenticated_delete_guides" ON guides;
DROP POLICY IF EXISTS "allow_public_read" ON guides;
DROP POLICY IF EXISTS "allow_authenticated_insert" ON guides;
DROP POLICY IF EXISTS "allow_authenticated_update" ON guides;
DROP POLICY IF EXISTS "allow_authenticated_delete" ON guides;

SELECT 'All policies removed' as status;

-- ===================================================
-- ステップ3: 確認 - ポリシーが削除されたか
-- ===================================================
SELECT 'STEP 3: Verifying policies are removed' as status;

SELECT
    CASE
        WHEN COUNT(*) = 0 THEN 'Success: All policies removed ✅'
        ELSE 'Warning: ' || COUNT(*) || ' policies still exist ⚠️'
    END as cleanup_status
FROM pg_policies
WHERE tablename = 'guides';

-- 残っているポリシーがある場合は表示
SELECT policyname
FROM pg_policies
WHERE tablename = 'guides';

-- ===================================================
-- ステップ4: シンプルなポリシーを作成
-- ===================================================
SELECT 'STEP 4: Creating simple new policies...' as status;

-- 読み取り: 誰でも可能
CREATE POLICY "guides_select_policy" ON guides
    FOR SELECT
    USING (true);

-- 挿入: 認証済みユーザーまたはservice_role
CREATE POLICY "guides_insert_policy" ON guides
    FOR INSERT
    WITH CHECK (
        auth.role() IN ('authenticated', 'service_role') OR
        auth.uid() IS NOT NULL OR
        current_user = 'postgres'
    );

-- 更新: 認証済みユーザーまたはservice_role
CREATE POLICY "guides_update_policy" ON guides
    FOR UPDATE
    USING (
        auth.role() IN ('authenticated', 'service_role') OR
        auth.uid() IS NOT NULL OR
        current_user = 'postgres'
    )
    WITH CHECK (
        auth.role() IN ('authenticated', 'service_role') OR
        auth.uid() IS NOT NULL OR
        current_user = 'postgres'
    );

-- 削除: 認証済みユーザーまたはservice_role
CREATE POLICY "guides_delete_policy" ON guides
    FOR DELETE
    USING (
        auth.role() IN ('authenticated', 'service_role') OR
        auth.uid() IS NOT NULL OR
        current_user = 'postgres'
    );

SELECT 'New policies created' as status;

-- ===================================================
-- ステップ5: 最終確認
-- ===================================================
SELECT 'STEP 5: Final verification' as status;

-- 新しいポリシーの確認
SELECT
    policyname,
    cmd as operation,
    permissive
FROM pg_policies
WHERE tablename = 'guides'
ORDER BY policyname;

-- RLSが有効か確認
SELECT
    'RLS Status' as check_type,
    CASE
        WHEN rowsecurity THEN 'ENABLED ✅'
        ELSE 'DISABLED ❌ (Run: ALTER TABLE guides ENABLE ROW LEVEL SECURITY;)'
    END as status
FROM pg_tables
WHERE tablename = 'guides';

SELECT '✅ Policies have been reset successfully!' as final_status;