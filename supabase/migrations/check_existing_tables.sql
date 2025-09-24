-- Check existing tables for .ate file system
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('plans', 'ate_templates', 'ate_files', 'download_history', 'file_generation_queue');

-- Check existing functions
SELECT routine_name
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name IN ('queue_ate_generation', 'complete_ate_generation', 'fail_ate_generation', 'get_download_info', 'log_download');

-- Check existing triggers
SELECT trigger_name, event_object_table
FROM information_schema.triggers
WHERE trigger_schema = 'public'
AND trigger_name LIKE '%ate%';