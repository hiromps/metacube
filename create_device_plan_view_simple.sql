-- Simple device_plan_view creation for user management
-- Execute this in Supabase SQL Editor if the view doesn't exist

-- Drop existing view if it exists
DROP VIEW IF EXISTS device_plan_view CASCADE;

-- Create simplified device_plan_view
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
    -- Plan display name with fallback
    CASE
        WHEN s.plan_id = 'starter' THEN 'STARTER'
        WHEN s.plan_id = 'pro' THEN 'PRO'
        WHEN s.plan_id = 'max' THEN 'MAX'
        WHEN s.plan_id = 'trial' THEN 'TRIAL'
        WHEN s.plan_id IS NOT NULL THEN UPPER(s.plan_id)
        ELSE '未契約'
    END as plan_display_name,
    -- Price with fallback
    CASE s.plan_id
        WHEN 'starter' THEN 2980
        WHEN 'pro' THEN 6980
        WHEN 'max' THEN 15800
        WHEN 'trial' THEN 0
        ELSE 0
    END as plan_price,
    -- Status display in Japanese
    CASE
        WHEN d.status = 'active' AND s.status = 'active' THEN 'アクティブ'
        WHEN d.status = 'trial' OR d.trial_ends_at > NOW() THEN 'トライアル'
        WHEN d.status = 'inactive' THEN '無効'
        WHEN s.status = 'canceled' THEN 'キャンセル済み'
        ELSE '未登録'
    END as status_display,
    -- Has access flag
    CASE
        WHEN (d.status = 'active' AND s.status = 'active') OR
             (d.status = 'trial' AND d.trial_ends_at > NOW()) THEN true
        ELSE false
    END as has_access
FROM devices d
LEFT JOIN subscriptions s ON d.user_id = s.user_id AND s.status IN ('active', 'canceled', 'past_due')
ORDER BY d.created_at DESC;

-- Grant permissions
GRANT SELECT ON device_plan_view TO anon, authenticated;

-- Add comment
COMMENT ON VIEW device_plan_view IS 'Simplified view combining device and subscription information for user management';

-- Test the view
SELECT * FROM device_plan_view LIMIT 5;