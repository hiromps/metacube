-- Fix device_plan_view column reference errors
-- Handles cases where original_price_jpy column may not exist

-- First ensure the original_price_jpy column exists
ALTER TABLE plans ADD COLUMN IF NOT EXISTS original_price_jpy INTEGER;

-- Update existing plans with original_price_jpy values if they're null
UPDATE plans SET original_price_jpy = CASE
    WHEN name = 'pro' AND original_price_jpy IS NULL THEN 9980
    WHEN name = 'max' AND original_price_jpy IS NULL THEN 19800
    ELSE original_price_jpy
END WHERE original_price_jpy IS NULL;

-- Drop the existing view to avoid conflicts
DROP VIEW IF EXISTS device_plan_view;

-- Recreate the view with proper column references and error handling
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
    COALESCE(p.display_name, UPPER(s.plan_id)) as plan_display_name,
    COALESCE(p.price_jpy,
        CASE s.plan_id
            WHEN 'starter' THEN 2980
            WHEN 'pro' THEN 6980
            WHEN 'max' THEN 15800
            ELSE 2980
        END
    ) as plan_price,
    COALESCE(p.original_price_jpy,
        CASE s.plan_id
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
        WHEN s.status = 'active' THEN true
        WHEN s.status = 'trialing' THEN true
        ELSE false
    END as is_subscription_active,
    CASE
        WHEN d.trial_ends_at > NOW() AND s.status != 'expired' THEN true
        WHEN d.trial_ends_at > NOW() AND s.status IS NULL THEN true
        ELSE false
    END as is_trial_active,
    -- Additional useful fields
    CASE
        WHEN s.status = 'active' OR s.status = 'trialing' THEN true
        WHEN d.trial_ends_at > NOW() THEN true
        ELSE false
    END as has_access,
    CASE
        WHEN s.status = 'active' THEN 'サブスクリプション有効'
        WHEN s.status = 'trialing' THEN 'トライアル中'
        WHEN d.trial_ends_at > NOW() THEN 'トライアル期間中'
        WHEN s.status = 'past_due' THEN '支払い期限超過'
        WHEN s.status = 'cancelled' THEN '解約済み'
        WHEN s.status = 'expired' THEN '期限切れ'
        ELSE '未契約'
    END as status_display
FROM devices d
LEFT JOIN subscriptions s ON d.id = s.device_id
LEFT JOIN plans p ON s.plan_id = p.name;

-- Update permissions
GRANT SELECT ON device_plan_view TO anon, authenticated;

-- Add helpful comments
COMMENT ON VIEW device_plan_view IS 'Enhanced device plan view with safe column references and fallback values';
COMMENT ON COLUMN device_plan_view.has_access IS 'Boolean indicating if device has access to features';
COMMENT ON COLUMN device_plan_view.status_display IS 'Human readable status in Japanese';

-- Create helpful indexes on the underlying tables if they don't exist
CREATE INDEX IF NOT EXISTS idx_subscriptions_device_id ON subscriptions(device_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_plan_id ON subscriptions(plan_id);
CREATE INDEX IF NOT EXISTS idx_plans_name ON plans(name);
CREATE INDEX IF NOT EXISTS idx_devices_status ON devices(status);
CREATE INDEX IF NOT EXISTS idx_devices_trial_ends_at ON devices(trial_ends_at);

-- Insert default plans if they don't exist (safety measure)
INSERT INTO plans (name, display_name, price_jpy, original_price_jpy, features, limitations, sort_order, is_active)
VALUES
    (
        'starter',
        'STARTER',
        2980,
        NULL,
        '{"timeline.lua": true, "hashtaglike.lua": true}',
        '{"support": "LINEサポート30日間", "trial_days": 3}',
        1,
        true
    ),
    (
        'pro',
        'PRO',
        6980,
        9980,
        '{"timeline.lua": true, "hashtaglike.lua": true, "follow.lua": true, "unfollow.lua": true}',
        '{"support": "LINEサポート90日間", "trial_days": 3}',
        2,
        true
    ),
    (
        'max',
        'MAX',
        15800,
        19800,
        '{"timeline.lua": true, "hashtaglike.lua": true, "follow.lua": true, "unfollow.lua": true, "activelike.lua": true}',
        '{"support": "24時間電話サポート", "trial_days": 3}',
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