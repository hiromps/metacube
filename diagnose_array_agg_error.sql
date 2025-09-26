-- array_aggエラーの診断
-- Supabase Dashboard > SQL Editorで実行してください

-- 1. array_aggを使用している関数を探す
SELECT
    p.proname AS function_name,
    n.nspname AS schema_name,
    pg_get_functiondef(p.oid) AS function_definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE pg_get_functiondef(p.oid) LIKE '%array_agg%'
AND n.nspname IN ('public', 'auth', 'storage');

-- 2. array_aggを使用しているビューを探す
SELECT
    schemaname,
    viewname,
    definition
FROM pg_views
WHERE definition LIKE '%array_agg%'
AND schemaname IN ('public', 'auth', 'storage');

-- 3. array_aggを使用しているマテリアライズドビューを探す
SELECT
    schemaname,
    matviewname,
    definition
FROM pg_matviews
WHERE definition LIKE '%array_agg%'
AND schemaname IN ('public', 'auth', 'storage');

-- 4. plans、guides、devicesなど主要テーブルの構造を確認
SELECT
    table_name,
    column_name,
    data_type,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name IN ('plans', 'guides', 'devices', 'subscriptions', 'user_packages')
ORDER BY table_name, ordinal_position;

-- 5. 最近のエラーログを確認するためのヒント
SELECT 'Check Supabase Dashboard > Logs for the full error context' as hint;