-- Check current table structure and fix missing columns

-- First, let's see what columns exist in ate_templates
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'ate_templates'
AND table_schema = 'public'
ORDER BY ordinal_position;