-- Migration: Update SOCIALTOUCH branding to SMARTGRAM
-- This migration updates all references from socialtouch to smartgram
-- NOTE: This migration is replaced by 23_fix_plan_id_format.sql which handles UUID/TEXT inconsistency

-- Update any other tables that might have socialtouch references
UPDATE user_packages
SET file_name = REPLACE(file_name, 'socialtouch', 'smartgram')
WHERE file_name LIKE '%socialtouch%';

UPDATE user_packages
SET notes = REPLACE(notes, 'socialtouch', 'smartgram')
WHERE notes LIKE '%socialtouch%';

UPDATE user_packages
SET notes = REPLACE(notes, 'SOCIALTOUCH', 'SMARTGRAM')
WHERE notes LIKE '%SOCIALTOUCH%';

UPDATE user_packages
SET version = REPLACE(version, 'socialtouch', 'smartgram')
WHERE version LIKE '%socialtouch%';