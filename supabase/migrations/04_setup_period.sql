-- Add setup period functionality to SocialTouch
-- Allows users to have setup time before trial starts

-- Add new columns to devices table
ALTER TABLE devices
ADD COLUMN IF NOT EXISTS status_history JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS setup_started_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS setup_expires_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS trial_activated_at TIMESTAMPTZ;

-- Update status check constraint to include new statuses
ALTER TABLE devices DROP CONSTRAINT IF EXISTS devices_status_check;
ALTER TABLE devices ADD CONSTRAINT devices_status_check
    CHECK (status IN ('registered', 'setup', 'trial', 'active', 'expired', 'suspended'));

-- Add new columns to subscriptions table
ALTER TABLE subscriptions
ADD COLUMN IF NOT EXISTS setup_period_days INTEGER DEFAULT 7,
ADD COLUMN IF NOT EXISTS trial_period_days INTEGER DEFAULT 3,
ADD COLUMN IF NOT EXISTS is_activated BOOLEAN DEFAULT FALSE;

-- Create user_status view for easier status management
CREATE OR REPLACE VIEW user_status AS
SELECT
    u.id as user_id,
    u.email,
    d.id as device_id,
    d.device_hash,
    d.status,
    d.setup_started_at,
    d.setup_expires_at,
    d.trial_activated_at,
    d.trial_ends_at,
    s.id as subscription_id,
    s.paypal_subscription_id,
    s.status as subscription_status,
    s.is_activated,
    CASE
        WHEN d.status = 'registered' THEN 'Registered - No subscription'
        WHEN d.status = 'setup' AND d.setup_expires_at > NOW() THEN 'Setup period - ' ||
            EXTRACT(DAY FROM d.setup_expires_at - NOW()) || ' days left'
        WHEN d.status = 'setup' AND d.setup_expires_at <= NOW() THEN 'Setup expired - Activation required'
        WHEN d.status = 'trial' AND d.trial_ends_at > NOW() THEN 'Trial - ' ||
            EXTRACT(DAY FROM d.trial_ends_at - NOW()) || ' days left'
        WHEN d.status = 'trial' AND d.trial_ends_at <= NOW() THEN 'Trial expired'
        WHEN d.status = 'active' THEN 'Active subscription'
        WHEN d.status = 'expired' THEN 'Subscription expired'
        WHEN d.status = 'suspended' THEN 'Account suspended'
        ELSE 'Unknown status'
    END as status_description,
    CASE
        WHEN d.status = 'setup' THEN TRUE
        WHEN d.status = 'trial' THEN TRUE
        WHEN d.status = 'active' THEN TRUE
        ELSE FALSE
    END as has_access_to_content,
    CASE
        WHEN d.status = 'trial' THEN TRUE
        WHEN d.status = 'active' THEN TRUE
        ELSE FALSE
    END as has_access_to_tools
FROM auth.users u
LEFT JOIN devices d ON d.user_id = u.id
LEFT JOIN subscriptions s ON s.device_id = d.id;

-- Function to handle device registration with setup period
CREATE OR REPLACE FUNCTION register_device_with_setup(
    p_user_id UUID,
    p_device_hash TEXT,
    p_email TEXT
) RETURNS JSON AS $$
DECLARE
    v_device_id UUID;
    v_existing_device devices%ROWTYPE;
BEGIN
    -- Check if user already has a device
    SELECT * INTO v_existing_device FROM devices WHERE user_id = p_user_id;

    IF v_existing_device.id IS NOT NULL THEN
        RETURN json_build_object(
            'success', false,
            'error', 'User already has a registered device'
        );
    END IF;

    -- Create new device with registered status
    INSERT INTO devices (
        user_id,
        device_hash,
        status,
        trial_ends_at  -- Will be updated when activated
    )
    VALUES (
        p_user_id,
        p_device_hash,
        'registered',
        NULL  -- No trial end date yet
    )
    RETURNING id INTO v_device_id;

    -- Update user profile
    INSERT INTO users_profile (id, email)
    VALUES (p_user_id, p_email)
    ON CONFLICT (id) DO UPDATE SET email = p_email;

    RETURN json_build_object(
        'success', true,
        'device_id', v_device_id,
        'status', 'registered',
        'message', 'Device registered successfully. Please subscribe to continue.'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to start setup period after payment
CREATE OR REPLACE FUNCTION start_setup_period(
    p_device_id UUID,
    p_paypal_subscription_id TEXT
) RETURNS JSON AS $$
DECLARE
    v_setup_expires_at TIMESTAMPTZ;
    v_subscription_id UUID;
BEGIN
    -- Calculate setup expiry (7 days from now)
    v_setup_expires_at := NOW() + INTERVAL '7 days';

    -- Update device status to setup
    UPDATE devices
    SET
        status = 'setup',
        setup_started_at = NOW(),
        setup_expires_at = v_setup_expires_at,
        status_history = status_history || jsonb_build_object(
            'status', 'setup',
            'timestamp', NOW(),
            'action', 'payment_completed'
        )
    WHERE id = p_device_id;

    -- Create subscription record
    INSERT INTO subscriptions (
        device_id,
        paypal_subscription_id,
        status,
        is_activated
    )
    VALUES (
        p_device_id,
        p_paypal_subscription_id,
        'active',
        false
    )
    RETURNING id INTO v_subscription_id;

    -- Create initial license record (not yet valid for tools)
    INSERT INTO licenses (
        device_id,
        is_valid,
        expires_at
    )
    VALUES (
        p_device_id,
        false,  -- Not valid until activated
        NULL
    );

    RETURN json_build_object(
        'success', true,
        'subscription_id', v_subscription_id,
        'setup_expires_at', v_setup_expires_at,
        'message', 'Setup period started. You have 7 days to prepare before activating your trial.'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to activate trial after setup
CREATE OR REPLACE FUNCTION activate_trial(
    p_device_hash TEXT
) RETURNS JSON AS $$
DECLARE
    v_device devices%ROWTYPE;
    v_subscription subscriptions%ROWTYPE;
    v_trial_ends_at TIMESTAMPTZ;
BEGIN
    -- Get device
    SELECT * INTO v_device FROM devices WHERE device_hash = p_device_hash;

    IF v_device.id IS NULL THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Device not found'
        );
    END IF;

    -- Check if already activated
    IF v_device.status IN ('trial', 'active') THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Already activated'
        );
    END IF;

    -- Check if in setup period
    IF v_device.status != 'setup' THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Not in setup period. Please subscribe first.'
        );
    END IF;

    -- Check if setup period expired
    IF v_device.setup_expires_at < NOW() THEN
        -- Update status to expired
        UPDATE devices SET status = 'expired' WHERE id = v_device.id;
        RETURN json_build_object(
            'success', false,
            'error', 'Setup period expired. Please contact support.'
        );
    END IF;

    -- Calculate trial end date (3 days from activation)
    v_trial_ends_at := NOW() + INTERVAL '3 days';

    -- Update device to trial status
    UPDATE devices
    SET
        status = 'trial',
        trial_activated_at = NOW(),
        trial_ends_at = v_trial_ends_at,
        status_history = status_history || jsonb_build_object(
            'status', 'trial',
            'timestamp', NOW(),
            'action', 'user_activated'
        )
    WHERE id = v_device.id;

    -- Update subscription
    UPDATE subscriptions
    SET is_activated = true
    WHERE device_id = v_device.id;

    -- Update license to valid
    UPDATE licenses
    SET
        is_valid = true,
        expires_at = v_trial_ends_at
    WHERE device_id = v_device.id;

    RETURN json_build_object(
        'success', true,
        'status', 'trial',
        'trial_ends_at', v_trial_ends_at,
        'message', '3-day trial activated successfully!'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check content access
CREATE OR REPLACE FUNCTION check_content_access(
    p_user_id UUID
) RETURNS JSON AS $$
DECLARE
    v_status user_status%ROWTYPE;
BEGIN
    SELECT * INTO v_status
    FROM user_status
    WHERE user_id = p_user_id;

    IF v_status.user_id IS NULL THEN
        RETURN json_build_object(
            'has_access', false,
            'reason', 'User not found'
        );
    END IF;

    RETURN json_build_object(
        'has_access', v_status.has_access_to_content,
        'can_use_tools', v_status.has_access_to_tools,
        'status', v_status.status,
        'status_description', v_status.status_description,
        'setup_expires_at', v_status.setup_expires_at,
        'trial_ends_at', v_status.trial_ends_at
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to handle status transitions
CREATE OR REPLACE FUNCTION update_expired_statuses() RETURNS void AS $$
BEGIN
    -- Update expired setup periods
    UPDATE devices
    SET
        status = 'expired',
        status_history = status_history || jsonb_build_object(
            'status', 'expired',
            'timestamp', NOW(),
            'action', 'setup_period_expired'
        )
    WHERE status = 'setup'
    AND setup_expires_at < NOW();

    -- Update expired trials
    UPDATE devices
    SET
        status = 'active',
        status_history = status_history || jsonb_build_object(
            'status', 'active',
            'timestamp', NOW(),
            'action', 'trial_converted'
        )
    WHERE status = 'trial'
    AND trial_ends_at < NOW()
    AND EXISTS (
        SELECT 1 FROM subscriptions
        WHERE device_id = devices.id
        AND status = 'active'
    );

    -- Update expired trials without active subscription
    UPDATE devices
    SET
        status = 'expired',
        status_history = status_history || jsonb_build_object(
            'status', 'expired',
            'timestamp', NOW(),
            'action', 'trial_expired_no_payment'
        )
    WHERE status = 'trial'
    AND trial_ends_at < NOW()
    AND NOT EXISTS (
        SELECT 1 FROM subscriptions
        WHERE device_id = devices.id
        AND status = 'active'
    );

    -- Update licenses accordingly
    UPDATE licenses l
    SET is_valid = false
    FROM devices d
    WHERE l.device_id = d.id
    AND d.status = 'expired';
END;
$$ LANGUAGE plpgsql;

-- Create a scheduled job to update expired statuses (requires pg_cron extension)
-- This would run every hour in production
-- SELECT cron.schedule('update-expired-statuses', '0 * * * *', 'SELECT update_expired_statuses();');