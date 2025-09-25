-- Migration: Update SOCIALTOUCH branding to SMARTGRAM
-- This migration updates all references from socialtouch to smartgram
-- NOTE: This migration is replaced by 23_fix_plan_id_format.sql which handles UUID/TEXT inconsistency

-- Update any other tables that might have socialtouch references
UPDATE user_packages
SET name = REPLACE(name, 'socialtouch', 'smartgram')
WHERE name LIKE '%socialtouch%';

UPDATE user_packages
SET description = REPLACE(description, 'SOCIALTOUCH', 'SMARTGRAM')
WHERE description LIKE '%SOCIALTOUCH%';