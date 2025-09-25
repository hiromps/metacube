-- Stripe Integration and Subscription Sync Migration
-- Adds Stripe-specific columns and updates plan data to match Stripe products

-- Add Stripe-specific columns to plans table
ALTER TABLE plans
ADD COLUMN IF NOT EXISTS stripe_product_id TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS stripe_price_id_monthly TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS stripe_price_id_yearly TEXT UNIQUE;

-- Add Stripe-specific columns to subscriptions table
ALTER TABLE subscriptions
ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
ADD COLUMN IF NOT EXISTS stripe_payment_method_id TEXT,
ADD COLUMN IF NOT EXISTS provider TEXT DEFAULT 'paypal' CHECK (provider IN ('paypal', 'stripe'));

-- Update plans with Stripe product and price IDs
UPDATE plans SET
    stripe_product_id = 'prod_T7To7yeLR4Pe8w',
    stripe_price_id_monthly = 'price_1SBErJDE82UMk94OqPkVIJGc'
WHERE name = 'starter';

UPDATE plans SET
    stripe_product_id = 'prod_T7Toy4bxQ8WJwh',
    stripe_price_id_monthly = 'price_1SBEtHDE82UMk94Of4R27wlm',
    stripe_price_id_yearly = 'price_1SBEtKDE82UMk94OZYcILvtc'
WHERE name = 'pro';

UPDATE plans SET
    stripe_product_id = 'prod_T7ToQoaY46ZKwc',
    stripe_price_id_monthly = 'price_1SBEtMDE82UMk94OTYoYrc9U'
WHERE name = 'max';

-- Create table for Stripe webhook events
CREATE TABLE IF NOT EXISTS stripe_webhook_events (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    stripe_event_id TEXT UNIQUE NOT NULL,
    event_type TEXT NOT NULL,
    processed BOOLEAN DEFAULT FALSE,
    data JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    processed_at TIMESTAMPTZ
);

-- Create indexes for Stripe integration
CREATE INDEX IF NOT EXISTS idx_plans_stripe_product_id ON plans(stripe_product_id);
CREATE INDEX IF NOT EXISTS idx_plans_stripe_price_monthly ON plans(stripe_price_id_monthly);
CREATE INDEX IF NOT EXISTS idx_plans_stripe_price_yearly ON plans(stripe_price_id_yearly);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_subscription ON subscriptions(stripe_subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_customer ON subscriptions(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_provider ON subscriptions(provider);
CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_event_id ON stripe_webhook_events(stripe_event_id);
CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_type ON stripe_webhook_events(event_type);
CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_processed ON stripe_webhook_events(processed);

-- Note: device_plan_view will be created in migration 20_fix_device_plan_view_columns.sql
-- This avoids column reference errors and provides better error handling

-- Grant necessary permissions
GRANT SELECT ON stripe_webhook_events TO authenticated;
GRANT INSERT, UPDATE ON stripe_webhook_events TO authenticated;
GRANT SELECT ON device_plan_view TO anon, authenticated;

-- Add comments
COMMENT ON TABLE stripe_webhook_events IS 'Stripe webhook events for subscription synchronization';
COMMENT ON COLUMN plans.stripe_product_id IS 'Stripe product ID for integration';
COMMENT ON COLUMN subscriptions.provider IS 'Payment provider: paypal or stripe';
COMMENT ON VIEW device_plan_view IS 'Enhanced view with Stripe integration data';