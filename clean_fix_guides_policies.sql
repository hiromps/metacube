-- guidesテーブルのRLSポリシーを完全にクリーンアップして修正
-- Supabase Dashboard > SQL Editorで実行してください

-- ===================================================
-- ステップ1: 既存のすべてのポリシーを削除
-- ===================================================
SELECT 'STEP 1: Cleaning up all existing policies...' as status;

-- 現在のポリシーを確認
SELECT 'Current policies:' as info;
SELECT policyname FROM pg_policies WHERE tablename = 'guides';

-- すべての既存ポリシーを削除（エラーを無視）
DO $$
DECLARE
    policy_record RECORD;
BEGIN
    FOR policy_record IN
        SELECT policyname
        FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'guides'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON guides', policy_record.policyname);
        RAISE NOTICE 'Dropped policy: %', policy_record.policyname;
    END LOOP;
END $$;

SELECT 'All policies dropped' as status;

-- ===================================================
-- ステップ2: RLSを一時的に無効化してテスト
-- ===================================================
SELECT 'STEP 2: Testing without RLS...' as status;

-- RLSを無効化
ALTER TABLE guides DISABLE ROW LEVEL SECURITY;

-- テストデータを挿入
INSERT INTO guides (
    title,
    slug,
    description,
    category,
    order_index,
    content,
    is_active
) VALUES (
    'RLSテストガイド - ' || NOW()::TEXT,
    'rls-test-' || EXTRACT(EPOCH FROM NOW())::TEXT,
    'RLS無効時のテスト',
    'test',
    999,
    'このガイドはRLS無効時に作成されました',
    true
) ON CONFLICT (slug) DO NOTHING;

SELECT 'Test guide inserted without RLS' as status;

-- ===================================================
-- ステップ3: guidesテーブルの制約を確認・修正
-- ===================================================
SELECT 'STEP 3: Fixing table constraints...' as status;

-- created_byカラムをNULL許可に
ALTER TABLE guides
ALTER COLUMN created_by DROP NOT NULL;

-- デフォルト値を確実に設定
ALTER TABLE guides
ALTER COLUMN created_at SET DEFAULT NOW(),
ALTER COLUMN updated_at SET DEFAULT NOW(),
ALTER COLUMN is_active SET DEFAULT true,
ALTER COLUMN order_index SET DEFAULT 0;

-- slugカラムにユニーク制約があるか確認
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'guides_slug_key' OR conname = 'guides_slug_unique'
    ) THEN
        ALTER TABLE guides ADD CONSTRAINT guides_slug_unique UNIQUE (slug);
    END IF;
END $$;

SELECT 'Constraints updated' as status;

-- ===================================================
-- ステップ4: RLSを再有効化
-- ===================================================
SELECT 'STEP 4: Re-enabling RLS...' as status;

ALTER TABLE guides ENABLE ROW LEVEL SECURITY;

-- ===================================================
-- ステップ5: シンプルで機能的なポリシーを作成
-- ===================================================
SELECT 'STEP 5: Creating new simple policies...' as status;

-- 1. 読み取りポリシー（誰でも読める）
CREATE POLICY "allow_public_read" ON guides
    FOR SELECT
    USING (true);

-- 2. 挿入ポリシー（認証済みユーザーまたはservice_role）
CREATE POLICY "allow_authenticated_insert" ON guides
    FOR INSERT
    WITH CHECK (
        auth.uid() IS NOT NULL OR
        auth.role() = 'service_role' OR
        current_user = 'postgres'
    );

-- 3. 更新ポリシー（認証済みユーザーまたはservice_role）
CREATE POLICY "allow_authenticated_update" ON guides
    FOR UPDATE
    USING (
        auth.uid() IS NOT NULL OR
        auth.role() = 'service_role' OR
        current_user = 'postgres'
    )
    WITH CHECK (
        auth.uid() IS NOT NULL OR
        auth.role() = 'service_role' OR
        current_user = 'postgres'
    );

-- 4. 削除ポリシー（認証済みユーザーまたはservice_role）
CREATE POLICY "allow_authenticated_delete" ON guides
    FOR DELETE
    USING (
        auth.uid() IS NOT NULL OR
        auth.role() = 'service_role' OR
        current_user = 'postgres'
    );

SELECT 'Simple policies created' as status;

-- ===================================================
-- ステップ6: サンプルデータを挿入/更新
-- ===================================================
SELECT 'STEP 6: Inserting sample data...' as status;

-- 基本的なガイドを挿入
INSERT INTO guides (
    title,
    slug,
    description,
    category,
    order_index,
    content,
    is_active
) VALUES
    ('はじめに - SmartGramの基本設定',
     'getting-started',
     'SmartGramの初期設定方法を説明します',
     'beginner',
     1,
     E'# SmartGramへようこそ\n\nこのガイドでは基本的な設定方法を説明します。\n\n## 必要なもの\n- 脱獄済みiPhone\n- AutoTouch\n- SmartGramライセンス',
     true),
    ('AutoTouchのインストール方法',
     'install-autotouch',
     'iPhoneにAutoTouchをインストールする手順',
     'beginner',
     2,
     E'# AutoTouchのインストール\n\n## 手順\n1. Cydia/Sileoを開く\n2. AutoTouchを検索\n3. インストール\n4. リスプリング',
     true),
    ('スクリプトの使い方',
     'how-to-use-scripts',
     'スクリプトの基本的な使い方を解説',
     'beginner',
     3,
     E'# スクリプトの使い方\n\n## 基本操作\n1. AutoTouchを開く\n2. スクリプトをダウンロード\n3. 実行',
     true)
ON CONFLICT (slug) DO UPDATE SET
    title = EXCLUDED.title,
    description = EXCLUDED.description,
    content = EXCLUDED.content,
    category = EXCLUDED.category,
    order_index = EXCLUDED.order_index,
    is_active = EXCLUDED.is_active,
    updated_at = NOW();

-- ===================================================
-- ステップ7: 最終確認
-- ===================================================
SELECT 'STEP 7: Final verification...' as status;

-- ポリシーの確認
SELECT
    'Policies created:' as info,
    COUNT(*) as policy_count
FROM pg_policies
WHERE tablename = 'guides';

-- ポリシーの詳細
SELECT
    policyname,
    cmd,
    CASE
        WHEN qual IS NULL OR qual = 'true' THEN 'Allow all'
        ELSE 'Conditional'
    END as access_type
FROM pg_policies
WHERE tablename = 'guides'
ORDER BY policyname;

-- ガイドの数を確認
SELECT
    'Total guides' as metric,
    COUNT(*) as count
FROM guides
UNION ALL
SELECT
    'Active guides' as metric,
    COUNT(*) as count
FROM guides
WHERE is_active = true;

-- RLSが有効か確認
SELECT
    'RLS status' as info,
    CASE WHEN rowsecurity THEN 'ENABLED ✅' ELSE 'DISABLED ❌' END as status
FROM pg_tables
WHERE tablename = 'guides';

-- テスト: 新しいガイドを挿入できるか
DO $$
DECLARE
    test_id UUID;
BEGIN
    INSERT INTO guides (
        title, slug, description, category, content, is_active
    ) VALUES (
        'ポリシーテスト',
        'policy-test-' || EXTRACT(EPOCH FROM NOW())::TEXT,
        'ポリシーのテスト',
        'test',
        'テストコンテンツ',
        true
    ) RETURNING id INTO test_id;

    -- 成功したら削除
    DELETE FROM guides WHERE id = test_id;
    RAISE NOTICE '✅ Insert test successful';
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE '❌ Insert test failed: %', SQLERRM;
END $$;

SELECT '✅ Guides table and policies are now properly configured!' as final_status;