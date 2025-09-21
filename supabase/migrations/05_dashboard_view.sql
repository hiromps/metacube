-- Create user_dashboard view for backward compatibility
-- This view provides all necessary data for the dashboard page

CREATE OR REPLACE VIEW user_dashboard AS
SELECT
    u.id as user_id,
    u.email,
    d.id as device_id,
    d.device_hash,
    d.device_model,
    d.status as device_status,
    d.trial_ends_at,
    d.setup_started_at,
    d.setup_expires_at,
    d.trial_activated_at,
    d.created_at as device_created_at,
    s.id as subscription_id,
    s.paypal_subscription_id,
    s.status as subscription_status,
    s.plan_id,
    s.amount_jpy,
    s.billing_cycle,
    s.next_billing_date,
    s.cancelled_at,
    s.is_activated,
    l.id as license_id,
    l.is_valid as license_valid,
    l.expires_at as license_expires_at,
    l.last_verified_at,
    l.verification_count,
    -- Computed fields
    CASE
        WHEN d.status = 'active' AND l.is_valid = true THEN true
        WHEN d.status = 'trial' AND d.trial_ends_at > NOW() THEN true
        ELSE false
    END as has_valid_license,
    CASE
        WHEN d.status = 'registered' THEN 'Registered - No subscription'
        WHEN d.status = 'setup' AND d.setup_expires_at > NOW() THEN
            'Setup period - ' || EXTRACT(DAY FROM d.setup_expires_at - NOW()) || ' days left'
        WHEN d.status = 'setup' AND d.setup_expires_at <= NOW() THEN
            'Setup expired - Activation required'
        WHEN d.status = 'trial' AND d.trial_ends_at > NOW() THEN
            'Trial - ' || EXTRACT(DAY FROM d.trial_ends_at - NOW()) || ' days left'
        WHEN d.status = 'trial' AND d.trial_ends_at <= NOW() THEN
            'Trial expired'
        WHEN d.status = 'active' THEN 'Active subscription'
        WHEN d.status = 'expired' THEN 'Subscription expired'
        WHEN d.status = 'suspended' THEN 'Account suspended'
        ELSE 'Unknown status'
    END as status_description
FROM auth.users u
LEFT JOIN devices d ON d.user_id = u.id
LEFT JOIN subscriptions s ON s.device_id = d.id
LEFT JOIN licenses l ON l.device_id = d.id;

-- Grant appropriate permissions
GRANT SELECT ON user_dashboard TO authenticated;

-- Add RLS policy for user_dashboard view
-- Note: Views inherit RLS from their base tables, but we can add explicit checks
-- The view will automatically filter based on the underlying table policies