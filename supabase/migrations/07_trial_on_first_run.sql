-- Modify trial to start on first main.lua execution, not on registration

-- Add columns to track trial activation and exact timing
ALTER TABLE devices
ADD COLUMN IF NOT EXISTS trial_activated BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS trial_activated_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS first_execution_at TIMESTAMPTZ;

-- Create device events table for tracking all executions
CREATE TABLE IF NOT EXISTS device_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id UUID REFERENCES devices(id),
    event_type VARCHAR(50) NOT NULL,
    event_data JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_device_events_device_id ON device_events(device_id);
CREATE INDEX IF NOT EXISTS idx_device_events_created_at ON device_events(created_at);

-- Update device registration to NOT start trial immediately
CREATE OR REPLACE FUNCTION register_device_with_payment(
    p_user_id UUID,
    p_device_hash TEXT
) RETURNS JSON AS $$
DECLARE
    v_device_id UUID;
BEGIN
    -- Insert or update device with registered status (not trial yet)
    INSERT INTO devices (
        user_id,
        device_hash,
        status,
        trial_activated,
        created_at,
        updated_at
    ) VALUES (
        p_user_id,
        p_device_hash,
        'registered',  -- Start as registered, not trial
        false,
        NOW(),
        NOW()
    )
    ON CONFLICT (device_hash) DO UPDATE
    SET user_id = p_user_id,
        status = 'registered',
        updated_at = NOW()
    RETURNING id INTO v_device_id;

    -- Return success with device info
    RETURN json_build_object(
        'success', true,
        'device_id', v_device_id,
        'status', 'registered',
        'message', 'Device registered. Trial will start on first main.lua execution'
    );
EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object(
            'success', false,
            'error', SQLERRM
        );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to activate trial when main.lua is first run with exact time sync
CREATE OR REPLACE FUNCTION activate_trial_on_first_run(
    p_device_hash TEXT
) RETURNS JSON AS $$
DECLARE
    v_device RECORD;
    v_trial_ends_at TIMESTAMPTZ;
    v_activation_time TIMESTAMPTZ;
BEGIN
    -- Record exact activation time for synchronization
    v_activation_time := CURRENT_TIMESTAMP;

    -- Get device information with lock to prevent race conditions
    SELECT * INTO v_device
    FROM devices
    WHERE device_hash = p_device_hash
    FOR UPDATE;

    -- Check if device exists
    IF NOT FOUND THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Device not found. Please register first',
            'status', 'unregistered'
        );
    END IF;

    -- Check if already activated
    IF v_device.trial_activated = true THEN
        -- Already activated, return synchronized status
        RETURN json_build_object(
            'success', true,
            'status', v_device.status,
            'trial_activated_at', v_device.trial_activated_at,
            'trial_ends_at', v_device.trial_ends_at,
            'message', 'Trial already activated',
            'time_remaining_seconds', EXTRACT(EPOCH FROM (v_device.trial_ends_at - CURRENT_TIMESTAMP))::INTEGER
        );
    END IF;

    -- Check if device is in registered status
    IF v_device.status != 'registered' THEN
        RETURN json_build_object(
            'success', true,
            'status', v_device.status,
            'message', 'Device status: ' || v_device.status
        );
    END IF;

    -- Activate trial (exactly 72 hours from activation time)
    v_trial_ends_at := v_activation_time + INTERVAL '72 hours';

    UPDATE devices
    SET status = 'trial',
        trial_activated = true,
        trial_activated_at = v_activation_time,
        first_execution_at = v_activation_time,
        trial_ends_at = v_trial_ends_at,
        updated_at = v_activation_time
    WHERE id = v_device.id;

    -- Log the activation event
    INSERT INTO device_events (device_id, event_type, event_data, created_at)
    VALUES (
        v_device.id,
        'trial_activated',
        json_build_object(
            'activation_time', v_activation_time,
            'trial_ends_at', v_trial_ends_at,
            'device_hash', p_device_hash
        ),
        v_activation_time
    );

    -- Return success with synchronized timing info
    RETURN json_build_object(
        'success', true,
        'status', 'trial',
        'trial_activated_at', v_activation_time,
        'trial_ends_at', v_trial_ends_at,
        'message', 'Trial activated! Enjoy 72 hours of free access',
        'time_remaining_seconds', 259200  -- exactly 72 hours in seconds
    );
EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object(
            'success', false,
            'error', SQLERRM
        );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update license verification to handle pre-trial state
CREATE OR REPLACE FUNCTION verify_license(p_device_hash TEXT)
RETURNS JSON AS $$
DECLARE
    v_device RECORD;
    v_has_valid_license BOOLEAN;
    v_should_activate_trial BOOLEAN;
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
            'is_valid', false,
            'error', 'Device not registered',
            'status', 'unregistered'
        );
    END IF;

    -- Check if trial needs to be activated (first run)
    IF v_device.status = 'registered' AND v_device.trial_activated = false THEN
        -- Activate trial on first run
        PERFORM activate_trial_on_first_run(p_device_hash);

        -- Re-fetch device info after activation
        SELECT
            d.*,
            s.status as subscription_status,
            l.is_valid as license_valid
        INTO v_device
        FROM devices d
        LEFT JOIN subscriptions s ON s.device_id = d.id
        LEFT JOIN licenses l ON l.device_id = d.id
        WHERE d.device_hash = p_device_hash;
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

    -- Update license verification count
    IF v_has_valid_license THEN
        UPDATE licenses
        SET last_verified_at = NOW(),
            verification_count = COALESCE(verification_count, 0) + 1
        WHERE device_id = v_device.id;
    END IF;

    -- Return verification result
    RETURN json_build_object(
        'is_valid', v_has_valid_license,
        'status', v_device.status,
        'trial_ends_at', v_device.trial_ends_at,
        'subscription_status', v_device.subscription_status,
        'expires_at', COALESCE(v_device.license_expires_at, v_device.trial_ends_at),
        'message', CASE
            WHEN v_has_valid_license THEN 'License valid'
            WHEN v_device.status = 'expired' THEN 'Trial expired - Please subscribe'
            ELSE 'Invalid license'
        END
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update view to include trial activation status
CREATE OR REPLACE VIEW user_dashboard AS
SELECT
    u.id as user_id,
    u.email,
    d.id as device_id,
    d.device_hash,
    d.device_model,
    d.status as device_status,
    d.trial_activated,
    d.trial_activated_at,
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
        WHEN d.status = 'registered' AND d.trial_activated = false THEN
            'Registered - Trial will start on first use'
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
GRANT EXECUTE ON FUNCTION activate_trial_on_first_run TO anon, authenticated;
GRANT EXECUTE ON FUNCTION verify_license TO anon, authenticated;