-- is_activeカラムのエラーを診断するSQL
-- Supabase Dashboard > SQL Editorで実行してください

-- 1. 既存のテーブル構造を確認
SELECT
    table_name,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM
    information_schema.columns
WHERE
    table_schema = 'public'
    AND column_name = 'is_active'
ORDER BY
    table_name;

-- 2. plansテーブルの構造を確認
SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM
    information_schema.columns
WHERE
    table_schema = 'public'
    AND table_name = 'plans'
ORDER BY
    ordinal_position;

-- 3. guidesテーブルが存在するか確認
SELECT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'guides'
) as guides_exists;

-- 4. ate_templatesテーブルが存在するか確認
SELECT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'ate_templates'
) as ate_templates_exists;

-- 5. 関数queue_ate_generationが存在するか確認
SELECT
    proname as function_name,
    pg_get_functiondef(oid) as function_definition
FROM
    pg_proc
WHERE
    proname = 'queue_ate_generation'
    AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');