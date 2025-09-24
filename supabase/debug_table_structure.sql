-- Check all existing .ate file system tables and their structures

-- 1. Check ate_templates table structure
SELECT 'ate_templates' as table_name, column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'ate_templates' AND table_schema = 'public'
ORDER BY ordinal_position;

-- 2. Check ate_files table structure
SELECT 'ate_files' as table_name, column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'ate_files' AND table_schema = 'public'
ORDER BY ordinal_position;

-- 3. Check file_generation_queue table structure
SELECT 'file_generation_queue' as table_name, column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'file_generation_queue' AND table_schema = 'public'
ORDER BY ordinal_position;

-- 4. Check download_history table structure
SELECT 'download_history' as table_name, column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'download_history' AND table_schema = 'public'
ORDER BY ordinal_position;

-- 5. Check existing data in ate_templates (if any)
SELECT name, created_at FROM ate_templates LIMIT 5;