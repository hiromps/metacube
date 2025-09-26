-- is_activeエラーの詳細診断
-- Supabase Dashboard > SQL Editorで実行してください

-- 1. すべての関数でis_activeを参照しているものを探す
SELECT
    p.proname AS function_name,
    n.nspname AS schema_name
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE pg_get_functiondef(p.oid) LIKE '%is_active%'
AND n.nspname = 'public';

-- 2. すべてのビューでis_activeを参照しているものを探す
SELECT
    schemaname,
    viewname,
    definition
FROM pg_views
WHERE definition LIKE '%is_active%'
AND schemaname = 'public';

-- 3. すべてのトリガーでis_activeを参照しているものを探す
SELECT
    trigger_name,
    event_object_table,
    action_statement
FROM information_schema.triggers
WHERE trigger_schema = 'public'
AND action_statement LIKE '%is_active%';

-- 4. plansテーブルの完全な構造を確認
SELECT
    column_name,
    data_type,
    column_default,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'plans'
ORDER BY ordinal_position;

-- 5. file_generation_queueテーブルが存在するか確認
SELECT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'file_generation_queue'
) as file_generation_queue_exists;

-- 6. ate_templatesテーブルが存在するか確認
SELECT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'ate_templates'
) as ate_templates_exists;

-- 7. マイグレーション履歴を確認
SELECT
    version,
    name,
    executed_at
FROM supabase_migrations.schema_migrations
ORDER BY executed_at DESC
LIMIT 20;

-- 8. 最近実行されたクエリでエラーが発生したものを探す（PostgreSQLログが有効な場合）
-- この部分は権限によっては実行できない可能性があります
SELECT
    'Check Supabase Dashboard logs for detailed error messages' as note;