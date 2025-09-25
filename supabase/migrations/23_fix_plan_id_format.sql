-- Fix plan_id format inconsistency
-- The plans table uses UUID primary key, but devices/subscriptions use TEXT plan_id
-- This migration corrects the approach to use TEXT plan names consistently

-- Drop the existing plans table that uses UUID
DROP TABLE IF EXISTS plans;

-- Recreate plans table with TEXT id to match plan_id references
CREATE TABLE plans (
    id TEXT PRIMARY KEY,                    -- Use TEXT to match plan_id in other tables
    name TEXT UNIQUE NOT NULL,              -- Display name like 'SMARTGRAM_MONTHLY_2980'
    price_jpy INTEGER NOT NULL,             -- Price in Japanese Yen
    features JSONB DEFAULT '[]',            -- Array of available features
    stripe_product_id TEXT,                 -- Stripe product ID
    stripe_price_id TEXT,                   -- Stripe price ID for subscriptions
    is_active BOOLEAN DEFAULT TRUE,         -- Whether plan is available for new subscriptions
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert SMARTGRAM plans with TEXT IDs
INSERT INTO plans (id, name, price_jpy, features, stripe_product_id, stripe_price_id) VALUES
(
    'smartgram_monthly_2980',
    'SMARTGRAM_MONTHLY_2980',
    2980,
    '["timeline.lua", "hashtaglike.lua"]',
    'prod_smartgram_starter',
    'price_smartgram_starter'
),
(
    'smartgram_monthly_6980',
    'SMARTGRAM_MONTHLY_6980',
    6980,
    '["timeline.lua", "hashtaglike.lua", "follow.lua", "unfollow.lua"]',
    'prod_smartgram_pro',
    'price_smartgram_pro'
),
(
    'smartgram_monthly_15800',
    'SMARTGRAM_MONTHLY_15800',
    15800,
    '["timeline.lua", "hashtaglike.lua", "follow.lua", "unfollow.lua", "activelike.lua"]',
    'prod_smartgram_max',
    'price_smartgram_max'
);

-- Update devices table default
ALTER TABLE devices ALTER COLUMN plan_id SET DEFAULT 'smartgram_monthly_2980';

-- Update existing socialtouch references in devices table
UPDATE devices
SET plan_id = 'smartgram_monthly_2980'
WHERE plan_id = 'socialtouch_monthly_2980';

UPDATE devices
SET plan_id = 'smartgram_monthly_6980'
WHERE plan_id IN ('socialtouch_monthly_8800', 'socialtouch_monthly_6980');

UPDATE devices
SET plan_id = 'smartgram_monthly_15800'
WHERE plan_id IN ('socialtouch_monthly_15000', 'socialtouch_monthly_15800');

-- Update existing socialtouch references in subscriptions table
UPDATE subscriptions
SET plan_id = 'smartgram_monthly_2980'
WHERE plan_id = 'socialtouch_monthly_2980';

UPDATE subscriptions
SET plan_id = 'smartgram_monthly_6980'
WHERE plan_id IN ('socialtouch_monthly_8800', 'socialtouch_monthly_6980');

UPDATE subscriptions
SET plan_id = 'smartgram_monthly_15800'
WHERE plan_id IN ('socialtouch_monthly_15000', 'socialtouch_monthly_15800');

-- Create updated_at trigger for plans table
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_plans_updated_at
BEFORE UPDATE ON plans
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();