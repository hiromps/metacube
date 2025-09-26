-- is_activeエラーの発生源を特定
-- 各クエリを個別に実行してエラーが発生する箇所を見つけてください

-- ===================================================
-- テスト1: ATE関連のテーブルが原因か確認
-- ===================================================
SELECT 'TEST 1: Check ATE tables' as test;

-- ate_templatesテーブルが存在するか
SELECT
    CASE
        WHEN EXISTS (
            SELECT 1 FROM information_schema.tables
            WHERE table_schema = 'public'
            AND table_name = 'ate_templates'
        ) THEN 'ate_templates EXISTS - might be the problem!'
        ELSE 'ate_templates does not exist'
    END as ate_templates_status;

-- ate_filesテーブルが存在するか
SELECT
    CASE
        WHEN EXISTS (
            SELECT 1 FROM information_schema.tables
            WHERE table_schema = 'public'
            AND table_name = 'ate_files'
        ) THEN 'ate_files EXISTS - might be the problem!'
        ELSE 'ate_files does not exist'
    END as ate_files_status;

-- file_generation_queueテーブルが存在するか
SELECT
    CASE
        WHEN EXISTS (
            SELECT 1 FROM information_schema.tables
            WHERE table_schema = 'public'
            AND table_name = 'file_generation_queue'
        ) THEN 'file_generation_queue EXISTS - might be the problem!'
        ELSE 'file_generation_queue does not exist'
    END as queue_status;

-- ===================================================
-- テスト2: 関数queue_ate_generationが原因か確認
-- ===================================================
SELECT 'TEST 2: Check queue_ate_generation function' as test;

-- queue_ate_generation関数の存在を確認
SELECT
    proname,
    pronargs as arg_count,
    CASE
        WHEN prosrc LIKE '%is_active%' THEN 'USES is_active - PROBLEM!'
        WHEN prosrc LIKE '%ate_templates%' THEN 'References ate_templates'
        WHEN prosrc LIKE '%plans%' THEN 'References plans table'
        ELSE 'Clean'
    END as status
FROM pg_proc
WHERE proname = 'queue_ate_generation';

-- ===================================================
-- テスト3: 12_fix_legacy_plans.sqlの関数が原因か
-- ===================================================
SELECT 'TEST 3: Check if old migration function exists' as test;

-- 関数の内容を確認（存在する場合）
SELECT
    proname,
    pg_get_functiondef(oid) as definition
FROM pg_proc
WHERE proname = 'queue_ate_generation'
AND prosrc LIKE '%is_active%';

-- ===================================================
-- テスト4: ate_templatesテーブルのis_activeカラム
-- ===================================================
SELECT 'TEST 4: If ate_templates exists, check its columns' as test;

-- ate_templatesが存在する場合、is_activeカラムがあるか確認
SELECT
    table_name,
    column_name,
    data_type
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'ate_templates'
AND column_name = 'is_active';

-- ===================================================
-- テスト5: ATE関連を完全に削除
-- ===================================================
SELECT 'TEST 5: Commands to remove ATE-related objects' as test;

-- 以下のコマンドを実行して、ATE関連のオブジェクトを削除
SELECT 'Execute these commands to remove ATE objects:' as instruction;
SELECT 'DROP FUNCTION IF EXISTS queue_ate_generation CASCADE;' as command_1;
SELECT 'DROP TABLE IF EXISTS download_history CASCADE;' as command_2;
SELECT 'DROP TABLE IF EXISTS file_generation_queue CASCADE;' as command_3;
SELECT 'DROP TABLE IF EXISTS ate_files CASCADE;' as command_4;
SELECT 'DROP TABLE IF EXISTS ate_templates CASCADE;' as command_5;

-- ===================================================
-- テスト6: エラーを引き起こす可能性のあるトリガー
-- ===================================================
SELECT 'TEST 6: Check triggers that might cause the error' as test;

SELECT
    trigger_name,
    event_object_table,
    action_statement
FROM information_schema.triggers
WHERE trigger_schema = 'public'
AND action_statement LIKE '%is_active%';

-- ===================================================
-- テスト7: チェック制約の確認
-- ===================================================
SELECT 'TEST 7: Check constraints referencing is_active' as test;

SELECT
    tc.table_name,
    tc.constraint_name,
    cc.check_clause
FROM information_schema.table_constraints tc
JOIN information_schema.check_constraints cc
    ON tc.constraint_name = cc.constraint_name
    AND tc.constraint_schema = cc.constraint_schema
WHERE tc.table_schema = 'public'
AND cc.check_clause LIKE '%is_active%';

-- ===================================================
-- テスト8: マイグレーション履歴の確認
-- ===================================================
SELECT 'TEST 8: Check migration history' as test;

SELECT
    version,
    name,
    executed_at
FROM supabase_migrations.schema_migrations
WHERE name LIKE '%ate%' OR name LIKE '%legacy%'
ORDER BY executed_at DESC
LIMIT 10;