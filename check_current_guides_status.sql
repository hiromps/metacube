-- guidesテーブルの現在の状態を確認
-- Supabase Dashboard > SQL Editorで実行してください

-- ===================================================
-- 1. guidesテーブルの存在確認
-- ===================================================
SELECT 'Checking if guides table exists...' as status;

SELECT
    CASE
        WHEN EXISTS (
            SELECT 1 FROM information_schema.tables
            WHERE table_schema = 'public'
            AND table_name = 'guides'
        )
        THEN 'guides table EXISTS ✅'
        ELSE 'guides table DOES NOT EXIST ❌'
    END as table_status;

-- ===================================================
-- 2. RLSの状態確認
-- ===================================================
SELECT 'Checking RLS status...' as status;

SELECT
    tablename,
    CASE
        WHEN rowsecurity THEN 'RLS is ENABLED'
        ELSE 'RLS is DISABLED'
    END as rls_status
FROM pg_tables
WHERE schemaname = 'public'
AND tablename = 'guides';

-- ===================================================
-- 3. 現在のポリシー一覧
-- ===================================================
SELECT 'Current policies on guides table:' as status;

SELECT
    policyname,
    cmd as operation,
    permissive,
    roles
FROM pg_policies
WHERE schemaname = 'public'
AND tablename = 'guides'
ORDER BY policyname;

-- ===================================================
-- 4. guidesテーブルのカラム構造
-- ===================================================
SELECT 'Columns in guides table:' as status;

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
-- 5. 現在のガイド数
-- ===================================================
SELECT 'Current guide count:' as status;

SELECT
    COUNT(*) as total_guides,
    COUNT(*) FILTER (WHERE is_active = true) as active_guides
FROM guides;

-- ===================================================
-- 6. 問題のあるポリシー名を特定
-- ===================================================
SELECT 'Checking for problematic policy names:' as status;

SELECT
    policyname,
    CASE
        WHEN policyname = 'Anyone can view active guides' THEN 'DUPLICATE FOUND - needs removal'
        ELSE 'OK'
    END as status
FROM pg_policies
WHERE schemaname = 'public'
AND tablename = 'guides'
AND policyname = 'Anyone can view active guides';