-- ガイド作成機能をテスト
-- Supabase Dashboard > SQL Editorで実行してください

-- ===================================================
-- テスト1: 現在の状態を確認
-- ===================================================
SELECT 'TEST 1: Current status check' as test;

-- RLSの状態
SELECT
    'RLS Status' as info,
    CASE WHEN rowsecurity THEN 'ENABLED ✅' ELSE 'DISABLED ❌' END as status
FROM pg_tables
WHERE tablename = 'guides';

-- ポリシーの数
SELECT
    'Total Policies' as info,
    COUNT(*)::TEXT || ' policies' as status
FROM pg_policies
WHERE tablename = 'guides';

-- 現在のガイド数
SELECT
    'Current Guides' as info,
    COUNT(*)::TEXT || ' guides exist' as status
FROM guides;

-- ===================================================
-- テスト2: ガイドの挿入テスト
-- ===================================================
SELECT 'TEST 2: Testing guide insertion' as test;

-- テストガイドを挿入
DO $$
DECLARE
    test_id UUID;
    test_slug TEXT := 'test-guide-' || EXTRACT(EPOCH FROM NOW())::TEXT;
BEGIN
    -- 挿入を試みる
    INSERT INTO guides (
        title,
        slug,
        description,
        category,
        order_index,
        content,
        is_active
    ) VALUES (
        'テストガイド - ' || TO_CHAR(NOW(), 'YYYY-MM-DD HH24:MI:SS'),
        test_slug,
        'このガイドは作成テスト用です',
        'test',
        999,
        E'# テストガイド\n\nこれはガイド作成機能のテストです。\n\n## テスト項目\n- 作成できるか\n- 読み取れるか\n- 更新できるか\n- 削除できるか',
        true
    )
    RETURNING id INTO test_id;

    RAISE NOTICE '✅ SUCCESS: Test guide created with ID: %', test_id;
    RAISE NOTICE 'Slug: %', test_slug;

EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE '❌ ERROR: Failed to create guide - %', SQLERRM;
END $$;

-- ===================================================
-- テスト3: 作成されたガイドを確認
-- ===================================================
SELECT 'TEST 3: Verify created guides' as test;

-- 最新のガイドを表示
SELECT
    id,
    title,
    slug,
    category,
    is_active,
    created_at
FROM guides
WHERE category = 'test'
ORDER BY created_at DESC
LIMIT 3;

-- ===================================================
-- テスト4: 更新テスト
-- ===================================================
SELECT 'TEST 4: Testing guide update' as test;

DO $$
DECLARE
    test_id UUID;
BEGIN
    -- 最新のテストガイドを取得
    SELECT id INTO test_id
    FROM guides
    WHERE category = 'test'
    ORDER BY created_at DESC
    LIMIT 1;

    IF test_id IS NOT NULL THEN
        -- 更新を試みる
        UPDATE guides
        SET
            description = description || ' (更新済み)',
            updated_at = NOW()
        WHERE id = test_id;

        RAISE NOTICE '✅ SUCCESS: Guide updated';
    ELSE
        RAISE NOTICE '⚠️ No test guide found to update';
    END IF;

EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE '❌ ERROR: Failed to update guide - %', SQLERRM;
END $$;

-- ===================================================
-- テスト5: 読み取りテスト
-- ===================================================
SELECT 'TEST 5: Testing guide selection' as test;

-- カテゴリ別のガイド数
SELECT
    category,
    COUNT(*) as count,
    STRING_AGG(title, ', ' ORDER BY order_index) as titles
FROM guides
WHERE is_active = true
GROUP BY category
ORDER BY category;

-- ===================================================
-- テスト6: サンプルガイドの確認
-- ===================================================
SELECT 'TEST 6: Checking sample guides' as test;

-- 基本的なガイドが存在するか確認
SELECT
    title,
    slug,
    category,
    CASE
        WHEN content IS NOT NULL AND LENGTH(content) > 0 THEN 'Has content ✅'
        ELSE 'No content ❌'
    END as content_status
FROM guides
WHERE category = 'beginner'
ORDER BY order_index
LIMIT 5;

-- ===================================================
-- 最終結果
-- ===================================================
SELECT 'FINAL RESULTS' as test;

SELECT
    'Guide Creation Test Complete' as status,
    'Check the results above. If all tests show ✅, the guide system is working correctly.' as message;

-- テストガイドをクリーンアップしたい場合は、以下のコメントを外して実行
/*
DELETE FROM guides
WHERE category = 'test'
AND created_at > NOW() - INTERVAL '1 hour';

SELECT 'Test guides cleaned up' as cleanup_status;
*/