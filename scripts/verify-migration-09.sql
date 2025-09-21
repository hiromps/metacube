-- Verification script to run AFTER executing the migration
-- This checks if the functions were created successfully

-- 1. Check if the functions exist
SELECT
    proname as function_name,
    prorettype::regtype as return_type,
    pronargs as argument_count,
    proargnames as argument_names
FROM pg_proc
WHERE proname IN ('register_device_with_setup', 'get_user_status')
ORDER BY proname;

-- 2. Check function permissions
SELECT
    p.proname as function_name,
    r.rolname as granted_to
FROM pg_proc p
JOIN pg_depend d ON p.oid = d.objid
JOIN pg_authid r ON d.refobjid = r.oid
WHERE p.proname IN ('register_device_with_setup', 'get_user_status')
AND d.deptype = 'a'
ORDER BY p.proname, r.rolname;

-- 3. Test register_device_with_setup function (safe test)
DO $$
DECLARE
    test_result JSON;
    test_user_id UUID := gen_random_uuid();
BEGIN
    -- Test the function exists and can be called
    SELECT register_device_with_setup(
        test_user_id,
        'TEST_DEVICE_' || extract(epoch from now())::text,
        'test@migration-verify.com'
    ) INTO test_result;

    RAISE NOTICE 'register_device_with_setup test result: %', test_result;

    -- Clean up test data
    DELETE FROM devices WHERE user_id = test_user_id;
    DELETE FROM auth.users WHERE id = test_user_id;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'register_device_with_setup test failed: %', SQLERRM;
END $$;

-- 4. Test get_user_status function
DO $$
DECLARE
    test_result JSON;
    test_user_id UUID := gen_random_uuid();
BEGIN
    -- Test the function exists and can be called
    SELECT get_user_status(test_user_id) INTO test_result;

    RAISE NOTICE 'get_user_status test result: %', test_result;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'get_user_status test failed: %', SQLERRM;
END $$;

-- 5. Check if required tables exist
SELECT
    table_name,
    table_type
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('devices', 'licenses', 'subscriptions', 'device_events')
ORDER BY table_name;

-- 6. Check if user_dashboard view exists
SELECT
    table_name,
    table_type
FROM information_schema.views
WHERE table_schema = 'public'
AND table_name = 'user_dashboard';

-- Expected Results:
-- 1. Should show 2 functions: register_device_with_setup, get_user_status
-- 2. Should show permissions granted to 'anon' and 'authenticated' roles
-- 3. Test functions should execute without errors
-- 4. Should show all required tables exist
-- 5. Should show user_dashboard view exists