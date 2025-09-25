-- Clean SMARTGRAM Plan Structure
-- This migration completely rebuilds the plan structure for SMARTGRAM
-- Removes all legacy SOCIALTOUCH references and simplifies the schema

-- 1. Drop all existing plan-related views and tables
DROP VIEW IF EXISTS device_plan_view;
DROP TABLE IF EXISTS plans CASCADE;

-- 2. Create clean SMARTGRAM plans table
CREATE TABLE plans (
    id TEXT PRIMARY KEY,                    -- Plan ID like 'starter', 'pro', 'max'
    name TEXT UNIQUE NOT NULL,              -- Display name like 'SMARTGRAM STARTER'
    price_jpy INTEGER NOT NULL,             -- Monthly price in JPY
    annual_discount_rate DECIMAL(3,2),      -- Annual discount (e.g., 0.15 for 15% off)
    features TEXT[] NOT NULL DEFAULT '{}', -- Array of feature names
    max_automation_hours INTEGER DEFAULT 24, -- Daily automation limit
    priority_support BOOLEAN DEFAULT FALSE,  -- Premium support access
    stripe_product_id TEXT,                 -- Stripe product ID
    stripe_monthly_price_id TEXT,           -- Stripe monthly price ID
    stripe_annual_price_id TEXT,            -- Stripe annual price ID (if available)
    is_active BOOLEAN DEFAULT TRUE,         -- Available for new subscriptions
    sort_order INTEGER DEFAULT 0,          -- Display order
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Insert SMARTGRAM plans with clean structure
INSERT INTO plans (id, name, price_jpy, annual_discount_rate, features, max_automation_hours, priority_support, stripe_product_id, stripe_monthly_price_id, sort_order) VALUES
(
    'starter',
    'SMARTGRAM STARTER',
    2980,
    NULL,
    ARRAY['timeline.lua', 'hashtaglike.lua'],
    6,
    FALSE,
    'prod_smartgram_starter',
    'price_smartgram_starter',
    1
),
(
    'pro',
    'SMARTGRAM PRO',
    6980,
    0.15,
    ARRAY['timeline.lua', 'hashtaglike.lua', 'follow.lua', 'unfollow.lua'],
    12,
    TRUE,
    'prod_smartgram_pro',
    'price_smartgram_pro',
    2
),
(
    'max',
    'SMARTGRAM MAX',
    15800,
    0.20,
    ARRAY['timeline.lua', 'hashtaglike.lua', 'follow.lua', 'unfollow.lua', 'activelike.lua'],
    24,
    TRUE,
    'prod_smartgram_max',
    'price_smartgram_max',
    3
);

-- 4. Update devices table to use clean plan references
-- Set default to starter plan
ALTER TABLE devices
ADD COLUMN IF NOT EXISTS plan_id TEXT REFERENCES plans(id) DEFAULT 'starter';

-- Migrate existing plan_id values to clean format
UPDATE devices SET plan_id = 'starter'
WHERE plan_id LIKE '%2980%' OR plan_id LIKE '%starter%' OR plan_id IS NULL;

UPDATE devices SET plan_id = 'pro'
WHERE plan_id LIKE '%6980%' OR plan_id LIKE '%8800%' OR plan_id LIKE '%pro%';

UPDATE devices SET plan_id = 'max'
WHERE plan_id LIKE '%15800%' OR plan_id LIKE '%15000%' OR plan_id LIKE '%max%';

-- 5. Update subscriptions table to use clean plan references
UPDATE subscriptions SET plan_id = 'starter'
WHERE plan_id LIKE '%2980%' OR plan_id LIKE '%starter%' OR plan_id LIKE '%socialtouch%';

UPDATE subscriptions SET plan_id = 'pro'
WHERE plan_id LIKE '%6980%' OR plan_id LIKE '%8800%' OR plan_id LIKE '%pro%';

UPDATE subscriptions SET plan_id = 'max'
WHERE plan_id LIKE '%15800%' OR plan_id LIKE '%15000%' OR plan_id LIKE '%max%';

-- 6. Create simple, clean device_plan_view
CREATE VIEW device_plan_view AS
SELECT
    -- Device information
    d.id as device_id,
    d.user_id,
    d.device_hash,
    d.device_model,
    d.status as device_status,
    d.trial_ends_at,
    d.created_at as device_created_at,

    -- Subscription information
    s.id as subscription_id,
    s.status as subscription_status,
    s.stripe_subscription_id,
    s.stripe_customer_id,
    s.current_period_start,
    s.current_period_end,
    s.next_billing_date,

    -- Plan information
    d.plan_id,
    p.name as plan_name,
    p.price_jpy as plan_price,
    p.features as plan_features,
    p.max_automation_hours,
    p.priority_support,

    -- Calculated fields
    CASE
        WHEN s.status IN ('active', 'trialing') THEN TRUE
        WHEN d.trial_ends_at > NOW() AND s.status IS NULL THEN TRUE
        ELSE FALSE
    END as has_access,

    CASE
        WHEN s.status = 'active' THEN 'アクティブ'
        WHEN s.status = 'trialing' THEN 'トライアル中'
        WHEN d.trial_ends_at > NOW() AND s.status IS NULL THEN 'トライアル期間'
        WHEN s.status = 'past_due' THEN '支払い遅延'
        WHEN s.status = 'canceled' THEN '解約済み'
        WHEN d.status = 'expired' THEN '期限切れ'
        ELSE '未契約'
    END as status_display,

    -- Trial information
    CASE
        WHEN d.trial_ends_at > NOW() THEN TRUE
        ELSE FALSE
    END as is_trial_active,

    -- Access level
    CASE
        WHEN s.status IN ('active', 'trialing') THEN 'premium'
        WHEN d.trial_ends_at > NOW() THEN 'trial'
        ELSE 'none'
    END as access_level

FROM devices d
LEFT JOIN subscriptions s ON d.id = s.device_id
LEFT JOIN plans p ON d.plan_id = p.id;

-- 7. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_devices_plan_id ON devices(plan_id);
CREATE INDEX IF NOT EXISTS idx_devices_status_trial ON devices(status, trial_ends_at);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_plans_active ON plans(is_active, sort_order);

-- 8. Add updated_at trigger for plans
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

-- 9. Set permissions
GRANT SELECT ON plans TO anon, authenticated;
GRANT SELECT ON device_plan_view TO anon, authenticated;

-- 10. Add helpful comments
COMMENT ON TABLE plans IS 'SMARTGRAM subscription plans with clean structure';
COMMENT ON VIEW device_plan_view IS 'Unified view of device, subscription, and plan information for SMARTGRAM';
COMMENT ON COLUMN plans.features IS 'Array of available Lua script names';
COMMENT ON COLUMN plans.max_automation_hours IS 'Daily automation limit in hours';

-- 11. Update any remaining SOCIALTOUCH references in other tables
UPDATE user_packages
SET file_name = REPLACE(REPLACE(file_name, 'socialtouch', 'smartgram'), 'SOCIALTOUCH', 'SMARTGRAM')
WHERE file_name LIKE '%socialtouch%' OR file_name LIKE '%SOCIALTOUCH%';

UPDATE user_packages
SET notes = REPLACE(REPLACE(COALESCE(notes, ''), 'socialtouch', 'smartgram'), 'SOCIALTOUCH', 'SMARTGRAM')
WHERE notes LIKE '%socialtouch%' OR notes LIKE '%SOCIALTOUCH%';

-- 12. Clean up any orphaned data
DELETE FROM subscriptions WHERE plan_id NOT IN ('starter', 'pro', 'max');
UPDATE devices SET plan_id = 'starter' WHERE plan_id NOT IN ('starter', 'pro', 'max');