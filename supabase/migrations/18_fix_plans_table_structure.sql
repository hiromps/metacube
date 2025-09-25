-- Fix plans table structure and populate with correct data
-- This migration handles the case where plans table may exist without description column

-- First, ensure the plans table has the correct structure
ALTER TABLE IF EXISTS plans
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS price_jpy INTEGER,
ADD COLUMN IF NOT EXISTS original_price_jpy INTEGER,
ADD COLUMN IF NOT EXISTS billing_cycle TEXT DEFAULT 'monthly',
ADD COLUMN IF NOT EXISTS features JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS limitations JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Update existing price_jpy column to match our structure if it exists but is null
UPDATE plans SET price_jpy = price WHERE price_jpy IS NULL AND price IS NOT NULL;

-- Create plans table if it doesn't exist
CREATE TABLE IF NOT EXISTS plans (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    display_name TEXT NOT NULL,
    description TEXT,
    price_jpy INTEGER NOT NULL,
    original_price_jpy INTEGER,
    billing_cycle TEXT DEFAULT 'monthly',
    features JSONB DEFAULT '{}',
    limitations JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT TRUE,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert or update plan data with correct pricing from plans/page.tsx
INSERT INTO plans (name, display_name, price_jpy, original_price_jpy, features, limitations, sort_order, is_active)
VALUES
    (
        'starter',
        'STARTER',
        2980,
        NULL,
        '{
            "timeline.lua": true,
            "hashtaglike.lua": true,
            "follow.lua": false,
            "unfollow.lua": false,
            "activelike.lua": false
        }',
        '{
            "support": "LINEサポート30日間",
            "trial_days": 3,
            "time_savings": "月10時間節約"
        }',
        1,
        true
    ),
    (
        'pro',
        'PRO',
        6980,
        9980,
        '{
            "timeline.lua": true,
            "hashtaglike.lua": true,
            "follow.lua": true,
            "unfollow.lua": true,
            "activelike.lua": false
        }',
        '{
            "support": "LINEサポート90日間",
            "trial_days": 3,
            "time_savings": "月40時間節約",
            "cost_savings": "手動運用費¥20,000/月が不要"
        }',
        2,
        true
    ),
    (
        'max',
        'MAX',
        15800,
        19800,
        '{
            "timeline.lua": true,
            "hashtaglike.lua": true,
            "follow.lua": true,
            "unfollow.lua": true,
            "activelike.lua": true
        }',
        '{
            "support": "24時間電話サポート",
            "trial_days": 3,
            "time_savings": "月160時間節約",
            "cost_savings": "手動運用費¥80,000/月が不要"
        }',
        3,
        true
    )
ON CONFLICT (name) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    price_jpy = EXCLUDED.price_jpy,
    original_price_jpy = EXCLUDED.original_price_jpy,
    features = EXCLUDED.features,
    limitations = EXCLUDED.limitations,
    sort_order = EXCLUDED.sort_order,
    is_active = EXCLUDED.is_active,
    updated_at = NOW();

-- Update existing subscriptions to use correct plan IDs and pricing
UPDATE subscriptions
SET
    plan_id = CASE
        WHEN plan_id IN ('socialtouch_monthly_2980', 'smartgram_monthly_2980') THEN 'starter'
        WHEN plan_id IN ('socialtouch_monthly_8800', 'smartgram_monthly_8800') THEN 'pro'
        WHEN plan_id IN ('socialtouch_monthly_15000', 'smartgram_monthly_15000') THEN 'max'
        WHEN amount_jpy = 2980 THEN 'starter'
        WHEN amount_jpy = 8800 OR amount_jpy = 6980 THEN 'pro'
        WHEN amount_jpy = 15000 OR amount_jpy = 15800 THEN 'max'
        ELSE 'starter'
    END,
    amount_jpy = CASE
        WHEN plan_id IN ('socialtouch_monthly_2980', 'smartgram_monthly_2980') OR amount_jpy = 2980 THEN 2980
        WHEN plan_id IN ('socialtouch_monthly_8800', 'smartgram_monthly_8800') OR amount_jpy = 8800 OR amount_jpy = 6980 THEN 6980
        WHEN plan_id IN ('socialtouch_monthly_15000', 'smartgram_monthly_15000') OR amount_jpy = 15000 OR amount_jpy = 15800 THEN 15800
        ELSE 2980
    END,
    updated_at = NOW()
WHERE
    plan_id NOT IN ('starter', 'pro', 'max')
    OR amount_jpy NOT IN (2980, 6980, 15800);

-- Update trial period to 3 days for consistency
UPDATE devices
SET trial_ends_at = created_at + INTERVAL '3 days'
WHERE trial_ends_at IS NULL OR trial_ends_at < created_at + INTERVAL '3 days';

-- Create or replace view for easy plan information access
CREATE OR REPLACE VIEW device_plan_view AS
SELECT
    d.id as device_id,
    d.user_id,
    d.device_hash,
    d.status as device_status,
    d.trial_ends_at,
    s.id as subscription_id,
    s.status as subscription_status,
    s.plan_id,
    p.display_name as plan_display_name,
    p.price_jpy as plan_price,
    p.original_price_jpy as plan_original_price,
    p.features as plan_features,
    p.limitations as plan_limitations,
    CASE
        WHEN s.status = 'active' THEN true
        ELSE false
    END as is_subscription_active,
    CASE
        WHEN d.trial_ends_at > NOW() AND s.status = 'active' THEN true
        ELSE false
    END as is_trial_active
FROM devices d
LEFT JOIN subscriptions s ON d.id = s.device_id
LEFT JOIN plans p ON s.plan_id = p.name;

-- Enable RLS if not already enabled
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_class c
        JOIN pg_namespace n ON c.relnamespace = n.oid
        WHERE c.relname = 'plans' AND n.nspname = 'public' AND c.relrowsecurity = true
    ) THEN
        ALTER TABLE plans ENABLE ROW LEVEL SECURITY;
    END IF;
END $$;

-- Create policies if they don't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'plans' AND policyname = 'Plans are viewable by everyone') THEN
        CREATE POLICY "Plans are viewable by everyone" ON plans FOR SELECT USING (true);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'plans' AND policyname = 'Plans are manageable by authenticated users') THEN
        CREATE POLICY "Plans are manageable by authenticated users" ON plans FOR ALL USING (auth.role() = 'authenticated');
    END IF;
END $$;

-- Create updated_at trigger if update_updated_at_column function exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at_column') THEN
        DROP TRIGGER IF EXISTS update_plans_updated_at ON plans;
        CREATE TRIGGER update_plans_updated_at
            BEFORE UPDATE ON plans
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

-- Grant necessary permissions
GRANT SELECT ON plans TO anon, authenticated;
GRANT SELECT ON device_plan_view TO anon, authenticated;

-- Add comments for documentation
COMMENT ON TABLE plans IS 'Master plan configuration table with pricing and features matching plans/page.tsx';
COMMENT ON VIEW device_plan_view IS 'Combined view of device, subscription, and plan information for easy access';