-- is_activeエラーの正確な発生箇所を特定
-- 各クエリを個別に実行してエラーが発生するものを見つけてください

-- ===================================================
-- テスト1: plansテーブルにis_activeカラムが存在するか
-- ===================================================
SELECT 'TEST 1: Check if plans.is_active exists' as test;
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'plans'
AND column_name = 'is_active';

-- もし存在しない場合、追加する
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'plans'
        AND column_name = 'is_active'
    ) THEN
        RAISE NOTICE 'Adding is_active column to plans table';
        ALTER TABLE plans ADD COLUMN is_active BOOLEAN DEFAULT TRUE;
    ELSE
        RAISE NOTICE 'is_active column already exists in plans table';
    END IF;
END $$;

-- ===================================================
-- テスト2: user_packagesテーブルにis_activeカラムが存在するか
-- ===================================================
SELECT 'TEST 2: Check if user_packages.is_active exists' as test;
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'user_packages'
AND column_name = 'is_active';

-- もし存在しない場合、追加する
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'user_packages'
        AND column_name = 'is_active'
    ) THEN
        RAISE NOTICE 'Adding is_active column to user_packages table';
        ALTER TABLE user_packages ADD COLUMN is_active BOOLEAN DEFAULT TRUE;
    ELSE
        RAISE NOTICE 'is_active column already exists in user_packages table';
    END IF;
END $$;

-- ===================================================
-- テスト3: ate_templatesテーブルが存在し、is_activeを持っているか
-- ===================================================
SELECT 'TEST 3: Check ate_templates table and is_active column' as test;
SELECT
    CASE
        WHEN EXISTS (
            SELECT 1 FROM information_schema.tables
            WHERE table_schema = 'public'
            AND table_name = 'ate_templates'
        ) THEN 'ate_templates EXISTS'
        ELSE 'ate_templates DOES NOT EXIST'
    END as table_status,
    CASE
        WHEN EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public'
            AND table_name = 'ate_templates'
            AND column_name = 'is_active'
        ) THEN 'has is_active'
        ELSE 'no is_active'
    END as column_status;

-- ===================================================
-- テスト4: guidesテーブルのRLSポリシーをテスト
-- ===================================================
SELECT 'TEST 4: Test guides RLS policies' as test;

-- 既存のポリシーを確認
SELECT policyname, permissive, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
AND tablename = 'guides';

-- ポリシーを再作成（エラーが発生する可能性）
DO $$
BEGIN
    -- guidesテーブルが存在し、is_activeカラムがある場合のみ
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'guides'
        AND column_name = 'is_active'
    ) THEN
        -- 既存のポリシーを削除
        DROP POLICY IF EXISTS "Guides are viewable by everyone" ON guides;
        DROP POLICY IF EXISTS "Guides are manageable by admins" ON guides;

        -- 新しいポリシーを作成
        EXECUTE 'CREATE POLICY "Guides are viewable by everyone" ON guides
            FOR SELECT USING (is_active = true)';

        EXECUTE 'CREATE POLICY "Guides are manageable by admins" ON guides
            FOR ALL USING (
                auth.jwt()->>''email'' = ''akihiro.tnk@gmail.com'' OR
                auth.jwt()->>''role'' = ''admin''
            )';

        RAISE NOTICE 'Guides policies recreated successfully';
    ELSE
        RAISE NOTICE 'guides table or is_active column does not exist';
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Error creating guides policies: %', SQLERRM;
END $$;

-- ===================================================
-- テスト5: 関数でis_activeを参照しているものを特定
-- ===================================================
SELECT 'TEST 5: Functions that reference is_active' as test;

-- queue_ate_generation関数の定義を確認
SELECT
    proname,
    CASE
        WHEN prosrc LIKE '%is_active%' THEN 'USES is_active'
        ELSE 'NO is_active reference'
    END as uses_is_active
FROM pg_proc
WHERE pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
AND proname LIKE '%queue%' OR proname LIKE '%ate%';

-- ===================================================
-- テスト6: ビューでis_activeエラーが発生する可能性
-- ===================================================
SELECT 'TEST 6: Views that might cause is_active error' as test;

-- admin_users_viewの定義を確認
SELECT definition
FROM pg_views
WHERE schemaname = 'public'
AND viewname = 'admin_users_view';

-- device_plan_viewの定義を確認
SELECT definition
FROM pg_views
WHERE schemaname = 'public'
AND viewname = 'device_plan_view';

-- ===================================================
-- テスト7: インデックスのテスト
-- ===================================================
SELECT 'TEST 7: Test indexes on is_active columns' as test;

-- is_activeを使用しているインデックスを一覧表示
SELECT
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
AND indexdef LIKE '%is_active%';

-- ===================================================
-- テスト8: 実際にSELECTを実行してエラーを確認
-- ===================================================
SELECT 'TEST 8: Execute SELECT statements to trigger error' as test;

-- 各テーブルから is_active を選択してみる
DO $$
DECLARE
    tbl RECORD;
    sql_query TEXT;
BEGIN
    FOR tbl IN
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
    LOOP
        sql_query := format('SELECT COUNT(*) FROM %I WHERE is_active = true', tbl.table_name);
        BEGIN
            EXECUTE sql_query;
            RAISE NOTICE 'Table % has is_active column and query succeeded', tbl.table_name;
        EXCEPTION
            WHEN undefined_column THEN
                RAISE NOTICE 'ERROR: Table % does not have is_active column', tbl.table_name;
            WHEN OTHERS THEN
                RAISE NOTICE 'Other error in table %: %', tbl.table_name, SQLERRM;
        END;
    END LOOP;
END $$;