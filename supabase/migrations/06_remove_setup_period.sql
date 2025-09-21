-- Remove setup period functionality and simplify to direct trial activation

-- Drop setup-related columns from devices table
ALTER TABLE devices
DROP COLUMN IF EXISTS setup_started_at,
DROP COLUMN IF EXISTS setup_expires_at,
DROP COLUMN IF EXISTS trial_activated_at,
DROP COLUMN IF EXISTS is_activated;

-- Update device status to remove 'setup' state
-- Ensure all 'setup' status devices are moved to 'trial'
UPDATE devices
SET status = 'trial',
    trial_ends_at = COALESCE(trial_ends_at, NOW() + INTERVAL '3 days')
WHERE status = 'setup';

-- Drop setup-related functions
DROP FUNCTION IF EXISTS start_setup_period CASCADE;
DROP FUNCTION IF EXISTS activate_trial CASCADE;
DROP FUNCTION IF EXISTS check_content_access CASCADE;

-- Recreate simplified register_device function
CREATE OR REPLACE FUNCTION register_device_with_trial(
    p_user_id UUID,
    p_device_hash TEXT
) RETURNS JSON AS $$
DECLARE
    v_device_id UUID;
    v_trial_ends_at TIMESTAMPTZ;
BEGIN
    -- Set trial end date (3 days from now)
    v_trial_ends_at := NOW() + INTERVAL '3 days';

    -- Insert or update device with trial status
    INSERT INTO devices (
        user_id,
        device_hash,
        status,
        trial_ends_at,
        created_at,
        updated_at
    ) VALUES (
        p_user_id,
        p_device_hash,
        'trial',
        v_trial_ends_at,
        NOW(),
        NOW()
    )
    ON CONFLICT (device_hash) DO UPDATE
    SET user_id = p_user_id,
        status = 'trial',
        trial_ends_at = v_trial_ends_at,
        updated_at = NOW()
    RETURNING id INTO v_device_id;

    -- Return success with device info
    RETURN json_build_object(
        'success', true,
        'device_id', v_device_id,
        'status', 'trial',
        'trial_ends_at', v_trial_ends_at,
        'message', 'Device registered with 3-day trial'
    );
EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object(
            'success', false,
            'error', SQLERRM
        );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update check_device_status function to remove setup logic
CREATE OR REPLACE FUNCTION check_device_status(p_device_hash TEXT)
RETURNS JSON AS $$
DECLARE
    v_device RECORD;
    v_has_valid_license BOOLEAN;
BEGIN
    -- Get device information
    SELECT
        d.*,
        s.status as subscription_status,
        s.next_billing_date,
        l.is_valid as license_valid,
        l.expires_at as license_expires_at
    INTO v_device
    FROM devices d
    LEFT JOIN subscriptions s ON s.device_id = d.id
    LEFT JOIN licenses l ON l.device_id = d.id
    WHERE d.device_hash = p_device_hash;

    -- Check if device exists
    IF NOT FOUND THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Device not found',
            'status', 'unregistered'
        );
    END IF;

    -- Update expired trials
    IF v_device.status = 'trial' AND v_device.trial_ends_at < NOW() THEN
        UPDATE devices
        SET status = 'expired',
            updated_at = NOW()
        WHERE id = v_device.id;

        v_device.status := 'expired';
    END IF;

    -- Check valid license
    v_has_valid_license := false;
    IF v_device.status = 'active' AND v_device.license_valid = true THEN
        v_has_valid_license := true;
    ELSIF v_device.status = 'trial' AND v_device.trial_ends_at > NOW() THEN
        v_has_valid_license := true;
    END IF;

    -- Return device status
    RETURN json_build_object(
        'success', true,
        'device_id', v_device.id,
        'status', v_device.status,
        'trial_ends_at', v_device.trial_ends_at,
        'subscription_status', v_device.subscription_status,
        'next_billing_date', v_device.next_billing_date,
        'has_valid_license', v_has_valid_license,
        'license_expires_at', COALESCE(v_device.license_expires_at, v_device.trial_ends_at)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Simplify user_dashboard view
CREATE OR REPLACE VIEW user_dashboard AS
SELECT
    u.id as user_id,
    u.email,
    d.id as device_id,
    d.device_hash,
    d.device_model,
    d.status as device_status,
    d.trial_ends_at,
    d.created_at as device_created_at,
    s.id as subscription_id,
    s.paypal_subscription_id,
    s.status as subscription_status,
    s.plan_id,
    s.amount_jpy,
    s.billing_cycle,
    s.next_billing_date,
    s.cancelled_at,
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

-- Grant permissions
GRANT SELECT ON user_dashboard TO authenticated;