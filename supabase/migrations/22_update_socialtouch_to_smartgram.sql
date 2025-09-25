-- Migration: Update SOCIALTOUCH branding to SMARTGRAM
-- This migration updates all references from socialtouch to smartgram

-- Update default plan_id in devices table
ALTER TABLE devices ALTER COLUMN plan_id SET DEFAULT 'smartgram_monthly_2980';

-- Update existing socialtouch plan_ids to smartgram equivalents
UPDATE devices
SET plan_id = 'smartgram_monthly_2980'
WHERE plan_id = 'socialtouch_monthly_2980';

UPDATE devices
SET plan_id = 'smartgram_monthly_8800'
WHERE plan_id = 'socialtouch_monthly_8800';

UPDATE devices
SET plan_id = 'smartgram_monthly_15000'
WHERE plan_id = 'socialtouch_monthly_15000';

-- Update subscriptions table plan_id references
UPDATE subscriptions
SET plan_id = 'smartgram_monthly_2980'
WHERE plan_id = 'socialtouch_monthly_2980';

UPDATE subscriptions
SET plan_id = 'smartgram_monthly_8800'
WHERE plan_id = 'socialtouch_monthly_8800';

UPDATE subscriptions
SET plan_id = 'smartgram_monthly_15000'
WHERE plan_id = 'socialtouch_monthly_15000';

-- Update any other tables that might have socialtouch references
UPDATE user_packages
SET name = REPLACE(name, 'socialtouch', 'smartgram')
WHERE name LIKE '%socialtouch%';

UPDATE user_packages
SET description = REPLACE(description, 'SOCIALTOUCH', 'SMARTGRAM')
WHERE description LIKE '%SOCIALTOUCH%';

-- Insert/Update plans table with SMARTGRAM branding
INSERT INTO plans (id, name, price_jpy, features, stripe_product_id, stripe_price_id)
VALUES
  ('smartgram_monthly_2980', 'SMARTGRAM_MONTHLY_2980', 2980,
   '["timeline.lua", "hashtaglike.lua"]', 'prod_smartgram_starter', 'price_smartgram_starter'),
  ('smartgram_monthly_6980', 'SMARTGRAM_MONTHLY_6980', 6980,
   '["timeline.lua", "hashtaglike.lua", "follow.lua", "unfollow.lua"]', 'prod_smartgram_pro', 'price_smartgram_pro'),
  ('smartgram_monthly_15800', 'SMARTGRAM_MONTHLY_15800', 15800,
   '["timeline.lua", "hashtaglike.lua", "follow.lua", "unfollow.lua", "activelike.lua"]', 'prod_smartgram_max', 'price_smartgram_max')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  price_jpy = EXCLUDED.price_jpy,
  features = EXCLUDED.features,
  stripe_product_id = EXCLUDED.stripe_product_id,
  stripe_price_id = EXCLUDED.stripe_price_id;

-- Remove old socialtouch plans if they exist
DELETE FROM plans WHERE id LIKE 'socialtouch_%';