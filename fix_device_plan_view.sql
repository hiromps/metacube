-- Direct SQL to fix device_plan_view column errors
-- Execute this in Supabase SQL Editor

-- Add missing columns to plans table safely
ALTER TABLE plans ADD COLUMN IF NOT EXISTS original_price_jpy INTEGER;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS stripe_product_id TEXT;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS stripe_price_id_monthly TEXT;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS stripe_price_id_yearly TEXT;

-- Add missing columns to subscriptions table safely
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS provider TEXT DEFAULT 'paypal';

-- Update existing plans with missing data
UPDATE plans SET
    original_price_jpy = 9980,
    stripe_product_id = 'prod_T7Toy4bxQ8WJwh',
    stripe_price_id_monthly = 'price_1SBEtHDE82UMk94Of4R27wlm'
WHERE name = 'pro' AND original_price_jpy IS NULL;

UPDATE plans SET
    original_price_jpy = 19800,
    stripe_product_id = 'prod_T7ToQoaY46ZKwc',
    stripe_price_id_monthly = 'price_1SBEtMDE82UMk94OTYoYrc9U'
WHERE name = 'max' AND original_price_jpy IS NULL;

UPDATE plans SET
    stripe_product_id = 'prod_T7To7yeLR4Pe8w',
    stripe_price_id_monthly = 'price_1SBErJDE82UMk94OqPkVIJGc'
WHERE name = 'starter' AND stripe_product_id IS NULL;

-- Recreate the view with safe column references
DROP VIEW IF EXISTS device_plan_view;
CREATE VIEW device_plan_view AS
SELECT
    d.id as device_id,
    d.user_id,
    d.device_hash,
    d.status as device_status,
    d.trial_ends_at,
    s.id as subscription_id,
    s.status as subscription_status,
    s.plan_id,
    COALESCE(s.provider, 'paypal') as provider,
    s.stripe_subscription_id,
    s.stripe_customer_id,
    s.paypal_subscription_id,
    COALESCE(p.display_name, UPPER(COALESCE(s.plan_id, 'starter'))) as plan_display_name,
    COALESCE(p.price_jpy,
        CASE COALESCE(s.plan_id, 'starter')
            WHEN 'starter' THEN 2980
            WHEN 'pro' THEN 6980
            WHEN 'max' THEN 15800
            ELSE 2980
        END
    ) as plan_price,
    COALESCE(p.original_price_jpy,
        CASE COALESCE(s.plan_id, 'starter')
            WHEN 'pro' THEN 9980
            WHEN 'max' THEN 19800
            ELSE NULL
        END
    ) as plan_original_price,
    COALESCE(p.features, '{}') as plan_features,
    COALESCE(p.limitations, '{}') as plan_limitations,
    p.stripe_product_id,
    p.stripe_price_id_monthly,
    p.stripe_price_id_yearly,
    CASE
        WHEN s.status = 'active' OR s.status = 'trialing' THEN true
        ELSE false
    END as is_subscription_active,
    CASE
        WHEN d.trial_ends_at > NOW() AND COALESCE(s.status, 'trial') != 'expired' THEN true
        ELSE false
    END as is_trial_active
FROM devices d
LEFT JOIN subscriptions s ON d.id = s.device_id
LEFT JOIN plans p ON COALESCE(s.plan_id, 'starter') = p.name;

-- Create webhook events table
CREATE TABLE IF NOT EXISTS stripe_webhook_events (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    stripe_event_id TEXT UNIQUE NOT NULL,
    event_type TEXT NOT NULL,
    processed BOOLEAN DEFAULT FALSE,
    data JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    processed_at TIMESTAMPTZ
);

-- Grant permissions
GRANT SELECT ON device_plan_view TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON stripe_webhook_events TO authenticated;