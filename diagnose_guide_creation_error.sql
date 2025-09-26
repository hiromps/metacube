-- ガイド作成失敗の原因を診断
-- 各セクションを個別に実行してエラーの原因を特定してください

-- ===================================================
-- セクション1: guidesテーブルの存在と構造を確認
-- ===================================================
SELECT '=== SECTION 1: Check guides table ===' as section;

-- テーブルが存在するか
SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'guides'
) as guides_table_exists;

-- guidesテーブルのすべてのカラム
SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'guides'
ORDER BY ordinal_position;

-- ===================================================
-- セクション2: RLSポリシーを確認
-- ===================================================
SELECT '=== SECTION 2: Check RLS policies ===' as section;

-- RLSが有効か確認
SELECT
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
AND tablename = 'guides';

-- guidesテーブルのポリシー
SELECT
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE schemaname = 'public'
AND tablename = 'guides'
ORDER BY policyname;

-- ===================================================
-- セクション3: 現在のユーザーと権限を確認
-- ===================================================
SELECT '=== SECTION 3: Check current user and permissions ===' as section;

-- 現在のユーザー
SELECT current_user, session_user;

-- 現在のユーザーのメールアドレス（Supabase Auth経由）
SELECT auth.jwt()->>'email' as current_user_email,
       auth.jwt()->>'role' as current_user_role;

-- guidesテーブルへの権限
SELECT
    privilege_type
FROM information_schema.table_privileges
WHERE table_schema = 'public'
AND table_name = 'guides'
AND grantee IN (current_user, 'authenticated', 'anon', 'PUBLIC');

-- ===================================================
-- セクション4: INSERT権限をテスト（RLSなし）
-- ===================================================
SELECT '=== SECTION 4: Test INSERT without RLS ===' as section;

-- RLSを一時的に無効化してINSERTをテスト
DO $$
DECLARE
    test_id UUID;
BEGIN
    -- テストデータを挿入
    INSERT INTO guides (
        title,
        slug,
        description,
        category,
        content,
        is_active
    ) VALUES (
        'テストガイド - ' || NOW()::TEXT,
        'test-guide-' || EXTRACT(EPOCH FROM NOW())::TEXT,
        'これはテストガイドです',
        'test',
        'テストコンテンツ',
        true
    )
    RETURNING id INTO test_id;

    RAISE NOTICE 'Test guide created with ID: %', test_id;

    -- テストデータを削除
    DELETE FROM guides WHERE id = test_id;
    RAISE NOTICE 'Test guide deleted';

EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Error during test insert: %', SQLERRM;
END $$;

-- ===================================================
-- セクション5: RLSポリシーの問題を修正
-- ===================================================
SELECT '=== SECTION 5: Fix RLS policies ===' as section;

-- 既存のポリシーを削除
DROP POLICY IF EXISTS "Guides are viewable by everyone" ON guides;
DROP POLICY IF EXISTS "Guides are manageable by admins" ON guides;

-- より緩いポリシーを作成（デバッグ用）
-- 誰でも読み取り可能
CREATE POLICY "Guides are viewable by everyone" ON guides
    FOR SELECT
    USING (true);  -- すべてのガイドを表示（is_activeの条件を一時的に削除）

-- 認証済みユーザーは作成・更新・削除可能
CREATE POLICY "Authenticated users can manage guides" ON guides
    FOR ALL
    USING (auth.role() = 'authenticated')
    WITH CHECK (auth.role() = 'authenticated');

SELECT 'Policies updated to be more permissive' as status;

-- ===================================================
-- セクション6: created_byカラムの制約を確認
-- ===================================================
SELECT '=== SECTION 6: Check created_by constraint ===' as section;

-- created_byカラムの外部キー制約
SELECT
    tc.constraint_name,
    tc.constraint_type,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
LEFT JOIN information_schema.constraint_column_usage ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
WHERE tc.table_schema = 'public'
AND tc.table_name = 'guides'
AND kcu.column_name = 'created_by';

-- ===================================================
-- セクション7: API経由でのINSERTをシミュレート
-- ===================================================
SELECT '=== SECTION 7: Simulate API INSERT ===' as section;

-- Supabase API経由でのINSERTに必要なフィールドを確認
SELECT
    column_name,
    is_nullable,
    column_default,
    CASE
        WHEN is_nullable = 'NO' AND column_default IS NULL THEN 'REQUIRED'
        WHEN column_default IS NOT NULL THEN 'HAS DEFAULT'
        ELSE 'OPTIONAL'
    END as field_status
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'guides'
ORDER BY
    CASE
        WHEN is_nullable = 'NO' AND column_default IS NULL THEN 1
        ELSE 2
    END,
    ordinal_position;

-- ===================================================
-- セクション8: トリガーを確認
-- ===================================================
SELECT '=== SECTION 8: Check triggers ===' as section;

SELECT
    trigger_name,
    event_manipulation,
    event_object_table,
    action_orientation,
    action_timing,
    action_statement
FROM information_schema.triggers
WHERE event_object_schema = 'public'
AND event_object_table = 'guides'
ORDER BY trigger_name;

-- ===================================================
-- セクション9: 修正版のポリシーを作成
-- ===================================================
SELECT '=== SECTION 9: Create fixed policies ===' as section;

-- 既存のポリシーを削除
DROP POLICY IF EXISTS "Guides are viewable by everyone" ON guides;
DROP POLICY IF EXISTS "Authenticated users can manage guides" ON guides;

-- 新しいポリシー（より具体的）
-- 誰でも有効なガイドを読み取り可能
CREATE POLICY "Anyone can view active guides" ON guides
    FOR SELECT
    USING (is_active = true);

-- 認証済みユーザーは自分のガイドを管理可能
CREATE POLICY "Users can manage their own guides" ON guides
    FOR ALL
    USING (
        auth.uid() IS NOT NULL
    )
    WITH CHECK (
        auth.uid() IS NOT NULL
    );

-- 管理者は全てのガイドを管理可能
CREATE POLICY "Admins can manage all guides" ON guides
    FOR ALL
    USING (
        auth.jwt()->>'email' = 'akihiro.tnk@gmail.com' OR
        (auth.jwt()->>'role')::text = 'service_role'
    );

SELECT 'Fixed policies created' as status;

-- ===================================================
-- セクション10: 最終テスト
-- ===================================================
SELECT '=== SECTION 10: Final test ===' as section;

-- guidesテーブルの現在のデータ
SELECT COUNT(*) as total_guides FROM guides;

-- アクティブなガイドの数
SELECT COUNT(*) as active_guides FROM guides WHERE is_active = true;

-- ポリシーの最終状態
SELECT policyname, cmd FROM pg_policies
WHERE tablename = 'guides'
ORDER BY policyname;

SELECT '診断完了 - 上記の結果を確認してください' as status;