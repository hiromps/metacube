-- is_activeカラムエラーの徹底調査
-- Supabase Dashboard > SQL Editorで各セクションを個別に実行してエラーの発生箇所を特定してください

-- ===================================================
-- セクション1: 全テーブルのis_activeカラムの存在確認
-- ===================================================
SELECT '=== Section 1: Tables with is_active column ===' as section;
SELECT
    t.table_name,
    CASE
        WHEN c.column_name IS NOT NULL THEN 'EXISTS'
        ELSE 'MISSING'
    END as has_is_active
FROM information_schema.tables t
LEFT JOIN information_schema.columns c
    ON t.table_name = c.table_name
    AND t.table_schema = c.table_schema
    AND c.column_name = 'is_active'
WHERE t.table_schema = 'public'
    AND t.table_type = 'BASE TABLE'
ORDER BY t.table_name;

-- ===================================================
-- セクション2: is_activeを参照しているビューを探す
-- ===================================================
SELECT '=== Section 2: Views referencing is_active ===' as section;
SELECT
    schemaname,
    viewname,
    CASE
        WHEN definition LIKE '%is_active%' THEN 'USES is_active'
        ELSE 'NO is_active'
    END as uses_is_active,
    definition
FROM pg_views
WHERE schemaname = 'public'
ORDER BY viewname;

-- ===================================================
-- セクション3: is_activeを参照している関数を探す
-- ===================================================
SELECT '=== Section 3: Functions referencing is_active ===' as section;
SELECT
    p.proname AS function_name,
    CASE
        WHEN pg_get_functiondef(p.oid) LIKE '%is_active%' THEN 'USES is_active'
        ELSE 'NO is_active'
    END as uses_is_active,
    pg_get_functiondef(p.oid) as definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
ORDER BY p.proname;

-- ===================================================
-- セクション4: RLSポリシーでis_activeを使用しているものを探す
-- ===================================================
SELECT '=== Section 4: Policies using is_active ===' as section;
SELECT
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE schemaname = 'public'
    AND (qual LIKE '%is_active%' OR with_check LIKE '%is_active%')
ORDER BY tablename, policyname;

-- ===================================================
-- セクション5: トリガーでis_activeを参照しているものを探す
-- ===================================================
SELECT '=== Section 5: Triggers that might use is_active ===' as section;
SELECT
    trigger_name,
    event_object_table,
    action_statement,
    CASE
        WHEN action_statement LIKE '%is_active%' THEN 'USES is_active'
        ELSE 'NO is_active'
    END as uses_is_active
FROM information_schema.triggers
WHERE trigger_schema = 'public'
ORDER BY event_object_table, trigger_name;

-- ===================================================
-- セクション6: plansテーブルの完全な構造
-- ===================================================
SELECT '=== Section 6: Plans table structure ===' as section;
SELECT
    ordinal_position,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
    AND table_name = 'plans'
ORDER BY ordinal_position;

-- ===================================================
-- セクション7: guidesテーブルの完全な構造
-- ===================================================
SELECT '=== Section 7: Guides table structure ===' as section;
SELECT
    ordinal_position,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
    AND table_name = 'guides'
ORDER BY ordinal_position;

-- ===================================================
-- セクション8: ate_templatesテーブルの完全な構造
-- ===================================================
SELECT '=== Section 8: ate_templates table structure ===' as section;
SELECT
    ordinal_position,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
    AND table_name = 'ate_templates'
ORDER BY ordinal_position;

-- ===================================================
-- セクション9: マテリアライズドビューの確認
-- ===================================================
SELECT '=== Section 9: Materialized views ===' as section;
SELECT
    schemaname,
    matviewname,
    CASE
        WHEN definition LIKE '%is_active%' THEN 'USES is_active'
        ELSE 'NO is_active'
    END as uses_is_active
FROM pg_matviews
WHERE schemaname = 'public';

-- ===================================================
-- セクション10: デフォルト値でis_activeを参照している可能性
-- ===================================================
SELECT '=== Section 10: Column defaults referencing is_active ===' as section;
SELECT
    table_name,
    column_name,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
    AND column_default IS NOT NULL
    AND column_default LIKE '%is_active%';

-- ===================================================
-- セクション11: インデックスでis_activeを使用しているもの
-- ===================================================
SELECT '=== Section 11: Indexes using is_active ===' as section;
SELECT
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
    AND indexdef LIKE '%is_active%'
ORDER BY tablename, indexname;

-- ===================================================
-- セクション12: 外部キー制約の確認
-- ===================================================
SELECT '=== Section 12: Foreign key constraints ===' as section;
SELECT
    tc.table_name,
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
    AND tc.constraint_type = 'FOREIGN KEY'
ORDER BY tc.table_name, tc.constraint_name;

-- ===================================================
-- セクション13: ルールの確認
-- ===================================================
SELECT '=== Section 13: Rules that might use is_active ===' as section;
SELECT
    schemaname,
    tablename,
    rulename,
    definition
FROM pg_rules
WHERE schemaname = 'public'
    AND definition LIKE '%is_active%';

-- ===================================================
-- セクション14: 最近のエラーメッセージのヒント
-- ===================================================
SELECT '=== Section 14: Error context hint ===' as section;
SELECT
    'Check Supabase Dashboard > Logs for the exact SQL statement causing the error' as hint,
    'The error "column is_active does not exist" usually includes the table name' as note;