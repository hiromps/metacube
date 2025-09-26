-- array_aggエラーの発生源を特定
-- Supabase Dashboard > SQL Editorで各クエリを個別に実行してエラーの場所を特定してください

-- テスト1: plansテーブルの確認
SELECT 'Test 1: Plans table structure' as test;
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'plans';

-- テスト2: 既存のビューを確認
SELECT 'Test 2: Existing views' as test;
SELECT schemaname, viewname
FROM pg_views
WHERE schemaname = 'public';

-- テスト3: device_plan_viewが存在する場合、その定義を確認
SELECT 'Test 3: device_plan_view definition' as test;
SELECT definition
FROM pg_views
WHERE schemaname = 'public'
AND viewname = 'device_plan_view';

-- テスト4: admin_users_viewが存在する場合、その定義を確認
SELECT 'Test 4: admin_users_view definition' as test;
SELECT definition
FROM pg_views
WHERE schemaname = 'public'
AND viewname = 'admin_users_view';

-- テスト5: カスタム関数を確認
SELECT 'Test 5: Functions using aggregates' as test;
SELECT proname, prosrc
FROM pg_proc
WHERE pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
AND (prosrc LIKE '%array_agg%' OR prosrc LIKE '%string_agg%');

-- テスト6: トリガー定義を確認
SELECT 'Test 6: Triggers' as test;
SELECT
    trigger_name,
    event_object_table,
    action_statement
FROM information_schema.triggers
WHERE trigger_schema = 'public';

-- テスト7: マテリアライズドビューを確認
SELECT 'Test 7: Materialized views' as test;
SELECT schemaname, matviewname
FROM pg_matviews
WHERE schemaname = 'public';

-- テスト8: カラムのデフォルト値を確認（array_aggが使われている可能性）
SELECT 'Test 8: Column defaults with potential issues' as test;
SELECT
    table_name,
    column_name,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
AND column_default IS NOT NULL
AND (
    column_default LIKE '%array_agg%'
    OR column_default LIKE '%string_agg%'
    OR column_default LIKE '%array[%'
);

-- テスト9: チェック制約を確認
SELECT 'Test 9: Check constraints' as test;
SELECT
    tc.table_name,
    tc.constraint_name,
    cc.check_clause
FROM information_schema.table_constraints tc
JOIN information_schema.check_constraints cc
    ON tc.constraint_name = cc.constraint_name
    AND tc.constraint_schema = cc.constraint_schema
WHERE tc.table_schema = 'public'
AND tc.constraint_type = 'CHECK';