-- Fix plans table schema inconsistencies
-- The existing table uses 'price_jpy' and 'tools' columns, but our new code expects 'price' and 'features'

-- First, let's check what columns exist and add missing ones
DO $$
BEGIN
    -- Add missing columns if they don't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'plans' AND column_name = 'price') THEN
        ALTER TABLE plans ADD COLUMN price INTEGER;
        RAISE NOTICE 'Added price column';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'plans' AND column_name = 'features') THEN
        ALTER TABLE plans ADD COLUMN features JSONB DEFAULT '{}';
        RAISE NOTICE 'Added features column';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'plans' AND column_name = 'limitations') THEN
        ALTER TABLE plans ADD COLUMN limitations JSONB DEFAULT '{}';
        RAISE NOTICE 'Added limitations column';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'plans' AND column_name = 'billing_cycle') THEN
        ALTER TABLE plans ADD COLUMN billing_cycle VARCHAR(20) DEFAULT 'monthly';
        RAISE NOTICE 'Added billing_cycle column';
    END IF;
END $$;

-- Update existing data and sync columns
UPDATE plans SET
    price = COALESCE(price, price_jpy),
    features = CASE
        WHEN name = 'starter' THEN '{
            "timeline_lua": true,
            "follow_lua": false,
            "unfollow_lua": false,
            "hashtaglike_lua": false,
            "activelike_lua": false,
            "max_daily_actions": 500,
            "support_level": "basic"
        }'::jsonb
        WHEN name = 'pro' THEN '{
            "timeline_lua": true,
            "follow_lua": true,
            "unfollow_lua": true,
            "hashtaglike_lua": false,
            "activelike_lua": false,
            "max_daily_actions": 2000,
            "support_level": "priority"
        }'::jsonb
        WHEN name = 'max' THEN '{
            "timeline_lua": true,
            "follow_lua": true,
            "unfollow_lua": true,
            "hashtaglike_lua": true,
            "activelike_lua": true,
            "max_daily_actions": 5000,
            "support_level": "premium"
        }'::jsonb
        ELSE features
    END,
    limitations = CASE
        WHEN name = 'starter' THEN '{"feature_count": 1, "advanced_features": false}'::jsonb
        WHEN name = 'pro' THEN '{"feature_count": 3, "advanced_features": true}'::jsonb
        WHEN name = 'max' THEN '{"feature_count": 5, "advanced_features": true}'::jsonb
        ELSE limitations
    END,
    billing_cycle = COALESCE(billing_cycle, 'monthly'),
    updated_at = NOW()
WHERE name IN ('starter', 'pro', 'max');

-- Insert our three main plans if they don't exist
INSERT INTO plans (name, display_name, price, price_jpy, billing_cycle, features, limitations, tools, is_active)
VALUES
('starter', 'STARTER', 2980, 2980, 'monthly',
 '{
   "timeline_lua": true,
   "follow_lua": false,
   "unfollow_lua": false,
   "hashtaglike_lua": false,
   "activelike_lua": false,
   "max_daily_actions": 500,
   "support_level": "basic"
 }'::jsonb,
 '{
   "feature_count": 1,
   "advanced_features": false
 }'::jsonb,
 '["timeline"]'::jsonb,
 true),

('pro', 'PRO', 8800, 8800, 'monthly',
 '{
   "timeline_lua": true,
   "follow_lua": true,
   "unfollow_lua": true,
   "hashtaglike_lua": false,
   "activelike_lua": false,
   "max_daily_actions": 2000,
   "support_level": "priority"
 }'::jsonb,
 '{
   "feature_count": 3,
   "advanced_features": true
 }'::jsonb,
 '["timeline", "follow", "unfollow"]'::jsonb,
 true),

('max', 'MAX', 15000, 15000, 'monthly',
 '{
   "timeline_lua": true,
   "follow_lua": true,
   "unfollow_lua": true,
   "hashtaglike_lua": true,
   "activelike_lua": true,
   "max_daily_actions": 5000,
   "support_level": "premium"
 }'::jsonb,
 '{
   "feature_count": 5,
   "advanced_features": true
 }'::jsonb,
 '["timeline", "follow", "unfollow", "hashtaglike", "activelike"]'::jsonb,
 true)
ON CONFLICT (name) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    price = EXCLUDED.price,
    price_jpy = EXCLUDED.price_jpy,
    billing_cycle = EXCLUDED.billing_cycle,
    features = EXCLUDED.features,
    limitations = EXCLUDED.limitations,
    tools = EXCLUDED.tools,
    is_active = EXCLUDED.is_active,
    updated_at = NOW();

-- Recreate the device_plan_view to work with both old and new column names
DROP VIEW IF EXISTS device_plan_view CASCADE;

CREATE VIEW device_plan_view AS
SELECT
    d.id as device_id,
    d.device_hash,
    d.user_id,
    d.status as device_status,
    d.trial_ends_at,
    CASE
        WHEN d.status = 'trial' THEN 'trial'
        WHEN s.plan_id IS NOT NULL AND EXISTS (SELECT 1 FROM plans WHERE name = s.plan_id AND is_active = true) THEN s.plan_id
        ELSE 'starter'
    END as plan_name,
    CASE
        WHEN d.status = 'trial' THEN 'TRIAL'
        WHEN p.display_name IS NOT NULL THEN p.display_name
        ELSE 'STARTER'
    END as plan_display_name,
    CASE
        WHEN d.status = 'trial' THEN '{
            "timeline_lua": true,
            "follow_lua": true,
            "unfollow_lua": true,
            "hashtaglike_lua": true,
            "activelike_lua": true,
            "max_daily_actions": 10000,
            "support_level": "trial"
        }'::jsonb
        WHEN p.features IS NOT NULL THEN p.features
        ELSE '{
            "timeline_lua": true,
            "follow_lua": false,
            "unfollow_lua": false,
            "hashtaglike_lua": false,
            "activelike_lua": false,
            "max_daily_actions": 500,
            "support_level": "basic"
        }'::jsonb
    END as plan_features,
    CASE
        WHEN d.status = 'trial' THEN '{}'::jsonb
        WHEN p.limitations IS NOT NULL THEN p.limitations
        ELSE '{"feature_count": 1, "advanced_features": false}'::jsonb
    END as plan_limitations,
    CASE
        WHEN d.status = 'trial' THEN 0
        WHEN p.price IS NOT NULL THEN p.price
        WHEN p.price_jpy IS NOT NULL THEN p.price_jpy
        ELSE 2980
    END as plan_price
FROM devices d
LEFT JOIN subscriptions s ON d.id = s.device_id AND s.status = 'active'
LEFT JOIN plans p ON s.plan_id = p.name AND p.is_active = true;

-- Recreate the check_script_access function
DROP FUNCTION IF EXISTS check_script_access(TEXT, TEXT);

CREATE OR REPLACE FUNCTION check_script_access(
    device_hash_param TEXT,
    script_name_param TEXT
) RETURNS BOOLEAN AS $$
DECLARE
    device_plan RECORD;
    has_access BOOLEAN := false;
BEGIN
    -- Get device plan info
    SELECT * INTO device_plan
    FROM device_plan_view
    WHERE device_hash = device_hash_param;

    IF NOT FOUND THEN
        RETURN false;
    END IF;

    -- Check if device has active license (trial or paid)
    IF device_plan.device_status NOT IN ('trial', 'active') THEN
        RETURN false;
    END IF;

    -- Check trial expiration
    IF device_plan.device_status = 'trial' AND
       device_plan.trial_ends_at IS NOT NULL AND
       device_plan.trial_ends_at < NOW() THEN
        RETURN false;
    END IF;

    -- Check specific script access based on plan features
    CASE script_name_param
        WHEN 'timeline.lua', 'timeline' THEN
            has_access := COALESCE((device_plan.plan_features->>'timeline_lua')::boolean, false);
        WHEN 'follow.lua', 'follow' THEN
            has_access := COALESCE((device_plan.plan_features->>'follow_lua')::boolean, false);
        WHEN 'unfollow.lua', 'unfollow' THEN
            has_access := COALESCE((device_plan.plan_features->>'unfollow_lua')::boolean, false);
        WHEN 'hashtaglike.lua', 'hashtaglike' THEN
            has_access := COALESCE((device_plan.plan_features->>'hashtaglike_lua')::boolean, false);
        WHEN 'activelike.lua', 'activelike' THEN
            has_access := COALESCE((device_plan.plan_features->>'activelike_lua')::boolean, false);
        ELSE
            has_access := false;
    END CASE;

    RETURN has_access;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION check_script_access(TEXT, TEXT) TO authenticated;
GRANT SELECT ON device_plan_view TO authenticated;

-- Create indexes for better performance if they don't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_subscriptions_device_plan') THEN
        CREATE INDEX idx_subscriptions_device_plan ON subscriptions(device_id, plan_id, status);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_devices_hash_status') THEN
        CREATE INDEX idx_devices_hash_status ON devices(device_hash, status);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_plans_name_active') THEN
        CREATE INDEX idx_plans_name_active ON plans(name, is_active);
    END IF;
END $$;