-- Safe Stripe Integration Migration
-- Only applies changes that don't conflict with existing schema

-- Add Stripe columns to plans table if they don't exist
DO $$
BEGIN
    -- Add stripe_product_id if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'plans' AND column_name = 'stripe_product_id') THEN
        ALTER TABLE plans ADD COLUMN stripe_product_id TEXT UNIQUE;
    END IF;

    -- Add stripe_price_id_monthly if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'plans' AND column_name = 'stripe_price_id_monthly') THEN
        ALTER TABLE plans ADD COLUMN stripe_price_id_monthly TEXT UNIQUE;
    END IF;

    -- Add stripe_price_id_yearly if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'plans' AND column_name = 'stripe_price_id_yearly') THEN
        ALTER TABLE plans ADD COLUMN stripe_price_id_yearly TEXT UNIQUE;
    END IF;

    -- Add original_price_jpy if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'plans' AND column_name = 'original_price_jpy') THEN
        ALTER TABLE plans ADD COLUMN original_price_jpy INTEGER;
    END IF;
END
$$;

-- Add Stripe columns to subscriptions table if they don't exist
DO $$
BEGIN
    -- Add stripe_subscription_id if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'subscriptions' AND column_name = 'stripe_subscription_id') THEN
        ALTER TABLE subscriptions ADD COLUMN stripe_subscription_id TEXT UNIQUE;
    END IF;

    -- Add stripe_customer_id if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'subscriptions' AND column_name = 'stripe_customer_id') THEN
        ALTER TABLE subscriptions ADD COLUMN stripe_customer_id TEXT;
    END IF;

    -- Add stripe_payment_method_id if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'subscriptions' AND column_name = 'stripe_payment_method_id') THEN
        ALTER TABLE subscriptions ADD COLUMN stripe_payment_method_id TEXT;
    END IF;

    -- Add provider if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'subscriptions' AND column_name = 'provider') THEN
        ALTER TABLE subscriptions ADD COLUMN provider TEXT DEFAULT 'paypal' CHECK (provider IN ('paypal', 'stripe'));
    END IF;
END
$$;

-- Create stripe_webhook_events table if not exists
CREATE TABLE IF NOT EXISTS stripe_webhook_events (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    stripe_event_id TEXT UNIQUE NOT NULL,
    event_type TEXT NOT NULL,
    processed BOOLEAN DEFAULT FALSE,
    data JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    processed_at TIMESTAMPTZ
);

-- Update plans with Stripe product and price IDs (safe update)
UPDATE plans SET
    stripe_product_id = 'prod_T7To7yeLR4Pe8w',
    stripe_price_id_monthly = 'price_1SBErJDE82UMk94OqPkVIJGc'
WHERE name = 'starter' AND stripe_product_id IS NULL;

UPDATE plans SET
    stripe_product_id = 'prod_T7Toy4bxQ8WJwh',
    stripe_price_id_monthly = 'price_1SBEtHDE82UMk94Of4R27wlm',
    stripe_price_id_yearly = 'price_1SBEtKDE82UMk94OZYcILvtc',
    original_price_jpy = 9980
WHERE name = 'pro' AND stripe_product_id IS NULL;

UPDATE plans SET
    stripe_product_id = 'prod_T7ToQoaY46ZKwc',
    stripe_price_id_monthly = 'price_1SBEtMDE82UMk94OTYoYrc9U',
    original_price_jpy = 19800
WHERE name = 'max' AND stripe_product_id IS NULL;

-- Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_plans_stripe_product_id ON plans(stripe_product_id);
CREATE INDEX IF NOT EXISTS idx_plans_stripe_price_monthly ON plans(stripe_price_id_monthly);
CREATE INDEX IF NOT EXISTS idx_plans_stripe_price_yearly ON plans(stripe_price_id_yearly);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_subscription ON subscriptions(stripe_subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_customer ON subscriptions(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_provider ON subscriptions(provider);
CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_event_id ON stripe_webhook_events(stripe_event_id);
CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_type ON stripe_webhook_events(event_type);
CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_processed ON stripe_webhook_events(processed);

-- Recreate device_plan_view with safe column references
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
    END as is_trial_active,
    CASE
        WHEN s.status = 'active' OR s.status = 'trialing' THEN true
        WHEN d.trial_ends_at > NOW() THEN true
        ELSE false
    END as has_access
FROM devices d
LEFT JOIN subscriptions s ON d.id = s.device_id
LEFT JOIN plans p ON COALESCE(s.plan_id, 'starter') = p.name;

-- Grant permissions
GRANT SELECT ON stripe_webhook_events TO authenticated;
GRANT INSERT, UPDATE ON stripe_webhook_events TO authenticated;
GRANT SELECT ON device_plan_view TO anon, authenticated;

-- Comments
COMMENT ON TABLE stripe_webhook_events IS 'Stripe webhook events for subscription synchronization';
COMMENT ON VIEW device_plan_view IS 'Enhanced device plan view with Stripe integration and safe column references';