-- Update plan pricing and structure to match latest plans/page.tsx
-- Correct pricing: STARTER ¥2,980, PRO ¥6,980, MAX ¥15,800

-- Create plans table if it doesn't exist for proper plan management
CREATE TABLE IF NOT EXISTS plans (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    display_name TEXT NOT NULL,
    description TEXT,
    price INTEGER NOT NULL,
    original_price INTEGER,
    billing_cycle TEXT DEFAULT 'monthly',
    features JSONB DEFAULT '{}',
    limitations JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT TRUE,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert correct plan data based on plans/page.tsx
INSERT INTO plans (name, display_name, description, price, original_price, features, limitations, sort_order)
VALUES
    (
        'starter',
        'STARTER',
        '3日間フルアクセス体験 + 基本自動化機能',
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
        1
    ),
    (
        'pro',
        'PRO',
        '3日間フルアクセス体験 + 高度な自動化機能',
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
        2
    ),
    (
        'max',
        'MAX',
        '3日間フルアクセス体験 + 全機能フルアクセス',
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
        3
    )
ON CONFLICT (name) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    price = EXCLUDED.price,
    original_price = EXCLUDED.original_price,
    features = EXCLUDED.features,
    limitations = EXCLUDED.limitations,
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

-- Create view for easy plan information access
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
    p.price as plan_price,
    p.original_price as plan_original_price,
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

-- Add RLS policies for plans table
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Plans are viewable by everyone" ON plans
    FOR SELECT USING (true);

CREATE POLICY "Plans are manageable by authenticated users" ON plans
    FOR ALL USING (auth.role() = 'authenticated');

-- Add updated_at trigger for plans table
CREATE TRIGGER update_plans_updated_at
    BEFORE UPDATE ON plans
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Grant necessary permissions
GRANT SELECT ON plans TO anon, authenticated;
GRANT SELECT ON device_plan_view TO anon, authenticated;

-- Add comment for future reference
COMMENT ON TABLE plans IS 'Master plan configuration table with pricing and features matching plans/page.tsx';
COMMENT ON VIEW device_plan_view IS 'Combined view of device, subscription, and plan information for easy access';