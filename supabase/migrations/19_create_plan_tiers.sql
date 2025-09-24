-- Create comprehensive plan tier system for SMARTGRAM
-- STARTER: ¥2,980 - timeline.lua only
-- PRO: ¥8,800 - timeline.lua + follow.lua + unfollow.lua
-- MAX: ¥15,000 - All features

-- First, ensure plans table exists and has correct structure
CREATE TABLE IF NOT EXISTS plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT UNIQUE NOT NULL,
    display_name TEXT NOT NULL,
    price INTEGER NOT NULL, -- in JPY
    billing_cycle TEXT NOT NULL DEFAULT 'monthly',
    features JSONB NOT NULL DEFAULT '{}',
    limitations JSONB NOT NULL DEFAULT '{}',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Clear existing plans and insert new tier structure
DELETE FROM plans WHERE name IN ('starter', 'pro', 'max', 'basic');

-- Insert new plan tiers
INSERT INTO plans (name, display_name, price, billing_cycle, features, limitations, is_active) VALUES
('starter', 'STARTER', 2980, 'monthly',
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
 true),

('pro', 'PRO', 8800, 'monthly',
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
 true),

('max', 'MAX', 15000, 'monthly',
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
 true);

-- Create or update device_plan_view to handle plan information
DROP VIEW IF EXISTS device_plan_view;

CREATE VIEW device_plan_view AS
SELECT
    d.id as device_id,
    d.device_hash,
    d.user_id,
    d.status as device_status,
    d.trial_ends_at,
    CASE
        WHEN d.status = 'trial' THEN 'trial'
        WHEN s.plan_id IS NOT NULL THEN s.plan_id
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
        ELSE 2980
    END as plan_price
FROM devices d
LEFT JOIN subscriptions s ON d.id = s.device_id AND s.status = 'active'
LEFT JOIN plans p ON s.plan_id = p.name;

-- Update existing subscriptions to use new plan names
UPDATE subscriptions
SET plan_id = CASE
    WHEN plan_id = 'smartgram_monthly_2980' THEN 'starter'
    WHEN plan_id = 'smartgram_monthly_8800' THEN 'pro'
    WHEN plan_id = 'smartgram_monthly_15000' THEN 'max'
    WHEN plan_id = 'basic' THEN 'starter'
    ELSE COALESCE(plan_id, 'starter')
END
WHERE plan_id IS NULL OR plan_id IN ('smartgram_monthly_2980', 'smartgram_monthly_8800', 'smartgram_monthly_15000', 'basic');

-- Create function to check script access for AutoTouch
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
            has_access := (device_plan.plan_features->>'timeline_lua')::boolean;
        WHEN 'follow.lua', 'follow' THEN
            has_access := (device_plan.plan_features->>'follow_lua')::boolean;
        WHEN 'unfollow.lua', 'unfollow' THEN
            has_access := (device_plan.plan_features->>'unfollow_lua')::boolean;
        WHEN 'hashtaglike.lua', 'hashtaglike' THEN
            has_access := (device_plan.plan_features->>'hashtaglike_lua')::boolean;
        WHEN 'activelike.lua', 'activelike' THEN
            has_access := (device_plan.plan_features->>'activelike_lua')::boolean;
        ELSE
            has_access := false;
    END CASE;

    RETURN COALESCE(has_access, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION check_script_access(TEXT, TEXT) TO authenticated;
GRANT SELECT ON device_plan_view TO authenticated;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_subscriptions_device_plan ON subscriptions(device_id, plan_id, status);
CREATE INDEX IF NOT EXISTS idx_devices_hash_status ON devices(device_hash, status);
CREATE INDEX IF NOT EXISTS idx_plans_name_active ON plans(name, is_active);