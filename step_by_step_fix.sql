-- ステップバイステップで実行してエラーの場所を特定
-- 各セクションを個別に実行してください

-- ===================================================
-- セクション1: 現在のテーブル構造を確認
-- ===================================================
SELECT '=== SECTION 1: Check current table structures ===' as section;

-- plansテーブルの全カラム
SELECT
    'plans' as table_name,
    column_name,
    data_type
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'plans'
ORDER BY ordinal_position;

-- ===================================================
-- セクション2: is_activeカラムを安全に追加
-- ===================================================
SELECT '=== SECTION 2: Add is_active columns ===' as section;

-- plansテーブル
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'plans'
        AND column_name = 'is_active'
    ) THEN
        ALTER TABLE plans ADD COLUMN is_active BOOLEAN DEFAULT TRUE;
        RAISE NOTICE 'Added is_active to plans table';
    ELSE
        RAISE NOTICE 'is_active already exists in plans table';
    END IF;
END $$;

-- user_packagesテーブル（存在する場合）
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'user_packages'
    ) THEN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public'
            AND table_name = 'user_packages'
            AND column_name = 'is_active'
        ) THEN
            ALTER TABLE user_packages ADD COLUMN is_active BOOLEAN DEFAULT TRUE;
            RAISE NOTICE 'Added is_active to user_packages table';
        ELSE
            RAISE NOTICE 'is_active already exists in user_packages table';
        END IF;
    END IF;
END $$;

-- guidesテーブルの作成（存在しない場合）
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'guides'
    ) THEN
        CREATE TABLE guides (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            title TEXT NOT NULL,
            slug TEXT UNIQUE,
            description TEXT,
            content TEXT,
            youtube_url TEXT,
            video_id TEXT,
            category TEXT,
            order_index INTEGER DEFAULT 0,
            is_active BOOLEAN DEFAULT true,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            created_by UUID REFERENCES auth.users(id)
        );
        RAISE NOTICE 'Created guides table';
    ELSE
        -- テーブルが存在する場合、is_activeカラムを追加
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public'
            AND table_name = 'guides'
            AND column_name = 'is_active'
        ) THEN
            ALTER TABLE guides ADD COLUMN is_active BOOLEAN DEFAULT TRUE;
            RAISE NOTICE 'Added is_active to guides table';
        ELSE
            RAISE NOTICE 'is_active already exists in guides table';
        END IF;
    END IF;
END $$;

-- ===================================================
-- セクション3: 既存のポリシーを確認
-- ===================================================
SELECT '=== SECTION 3: Check existing policies ===' as section;

SELECT
    tablename,
    policyname,
    CASE
        WHEN qual LIKE '%is_active%' THEN 'USES is_active'
        ELSE 'NO is_active'
    END as uses_is_active,
    qual
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- ===================================================
-- セクション4: 問題のあるポリシーを削除
-- ===================================================
SELECT '=== SECTION 4: Drop problematic policies ===' as section;

-- guidesテーブルのポリシーを削除
DROP POLICY IF EXISTS "Guides are viewable by everyone" ON guides;
DROP POLICY IF EXISTS "Guides are manageable by admins" ON guides;

-- ===================================================
-- セクション5: guidesテーブルにis_activeカラムが存在することを確認
-- ===================================================
SELECT '=== SECTION 5: Verify guides.is_active exists ===' as section;

SELECT
    column_name,
    data_type
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'guides'
AND column_name = 'is_active';

-- ===================================================
-- セクション6: 安全にポリシーを再作成
-- ===================================================
SELECT '=== SECTION 6: Recreate policies safely ===' as section;

-- RLSを有効化
ALTER TABLE guides ENABLE ROW LEVEL SECURITY;

-- ポリシーを作成（is_activeカラムが確実に存在する場合のみ）
DO $$
BEGIN
    -- is_activeカラムが存在することを再確認
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'guides'
        AND column_name = 'is_active'
    ) THEN
        -- SELECTポリシー
        EXECUTE 'CREATE POLICY "Guides are viewable by everyone" ON guides
            FOR SELECT
            USING (is_active = true)';

        -- 管理者ポリシー
        EXECUTE 'CREATE POLICY "Guides are manageable by admins" ON guides
            FOR ALL
            USING (
                auth.jwt()->>''email'' = ''akihiro.tnk@gmail.com'' OR
                auth.jwt()->>''role'' = ''admin''
            )';

        RAISE NOTICE 'Policies created successfully';
    ELSE
        RAISE WARNING 'Cannot create policies: is_active column does not exist';
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Error creating policies: %', SQLERRM;
END $$;

-- ===================================================
-- セクション7: 他のテーブルのis_activeカラムを確認
-- ===================================================
SELECT '=== SECTION 7: Check all tables for is_active ===' as section;

SELECT
    t.table_name,
    CASE
        WHEN c.column_name IS NOT NULL THEN '✓ has is_active'
        ELSE '✗ missing is_active'
    END as status
FROM information_schema.tables t
LEFT JOIN information_schema.columns c
    ON t.table_name = c.table_name
    AND t.table_schema = c.table_schema
    AND c.column_name = 'is_active'
WHERE t.table_schema = 'public'
AND t.table_type = 'BASE TABLE'
AND t.table_name IN ('plans', 'user_packages', 'guides', 'devices', 'subscriptions')
ORDER BY t.table_name;

-- ===================================================
-- セクション8: ビューの定義を確認
-- ===================================================
SELECT '=== SECTION 8: Check view definitions ===' as section;

SELECT
    viewname,
    CASE
        WHEN definition LIKE '%is_active%' THEN 'USES is_active'
        ELSE 'NO is_active'
    END as uses_is_active
FROM pg_views
WHERE schemaname = 'public'
ORDER BY viewname;

-- ===================================================
-- セクション9: 関数の定義を確認
-- ===================================================
SELECT '=== SECTION 9: Check function definitions ===' as section;

SELECT
    proname as function_name,
    CASE
        WHEN prosrc LIKE '%is_active%' THEN 'USES is_active'
        ELSE 'NO is_active'
    END as uses_is_active
FROM pg_proc
WHERE pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
ORDER BY proname;

-- ===================================================
-- セクション10: 最終確認
-- ===================================================
SELECT '=== SECTION 10: Final verification ===' as section;

-- plansテーブルでis_activeを使用してみる
SELECT COUNT(*) as plans_with_is_active FROM plans WHERE is_active = true;

-- guidesテーブルでis_activeを使用してみる
SELECT COUNT(*) as guides_with_is_active FROM guides WHERE is_active = true;

SELECT 'Diagnostics complete!' as status;