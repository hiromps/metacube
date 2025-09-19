-- Helper Functions and Views
-- SocialTouch MVP - Business logic functions

-- Function to create device and license after user registration
CREATE OR REPLACE FUNCTION create_device_and_license(
    p_user_id UUID,
    p_device_hash TEXT,
    p_email TEXT
)
RETURNS JSON AS $$
DECLARE
    v_device_id UUID;
    v_license_id UUID;
    v_trial_ends_at TIMESTAMPTZ;
BEGIN
    -- Calculate trial end date (3 days from now)
    v_trial_ends_at := NOW() + INTERVAL '3 days';

    -- Insert device
    INSERT INTO devices (user_id, device_hash, status, trial_ends_at)
    VALUES (p_user_id, p_device_hash, 'trial', v_trial_ends_at)
    RETURNING id INTO v_device_id;

    -- Insert user profile if not exists
    INSERT INTO users_profile (id, email)
    VALUES (p_user_id, p_email)
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        updated_at = NOW();

    -- Create license
    INSERT INTO licenses (device_id, is_valid, expires_at)
    VALUES (v_device_id, TRUE, v_trial_ends_at)
    RETURNING id INTO v_license_id;

    -- Create pending subscription
    INSERT INTO subscriptions (device_id, status)
    VALUES (v_device_id, 'pending');

    RETURN json_build_object(
        'success', TRUE,
        'device_id', v_device_id,
        'license_id', v_license_id,
        'trial_ends_at', v_trial_ends_at
    );

EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object(
        'success', FALSE,
        'error', SQLERRM
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to verify license status
CREATE OR REPLACE FUNCTION verify_license(p_device_hash TEXT)
RETURNS JSON AS $$
DECLARE
    v_device devices%ROWTYPE;
    v_license licenses%ROWTYPE;
    v_subscription subscriptions%ROWTYPE;
    v_is_valid BOOLEAN := FALSE;
    v_expires_at TIMESTAMPTZ;
    v_status TEXT := 'expired';
BEGIN
    -- Get device information
    SELECT * INTO v_device
    FROM devices
    WHERE device_hash = p_device_hash;

    IF NOT FOUND THEN
        RETURN json_build_object(
            'success', FALSE,
            'error', 'Device not found'
        );
    END IF;

    -- Get license and subscription info
    SELECT l.* INTO v_license
    FROM licenses l
    WHERE l.device_id = v_device.id;

    SELECT s.* INTO v_subscription
    FROM subscriptions s
    WHERE s.device_id = v_device.id;

    -- Determine license validity
    CASE v_device.status
        WHEN 'trial' THEN
            IF v_device.trial_ends_at > NOW() THEN
                v_is_valid := TRUE;
                v_expires_at := v_device.trial_ends_at;
                v_status := 'trial';
            END IF;
        WHEN 'active' THEN
            IF v_subscription.status = 'active' AND
               (v_subscription.next_billing_date IS NULL OR v_subscription.next_billing_date > NOW()) THEN
                v_is_valid := TRUE;
                v_expires_at := v_subscription.next_billing_date;
                v_status := 'active';
            END IF;
        WHEN 'expired', 'suspended' THEN
            v_is_valid := FALSE;
            v_status := v_device.status;
    END CASE;

    -- Update license verification
    UPDATE licenses
    SET
        last_verified_at = NOW(),
        verification_count = verification_count + 1,
        is_valid = v_is_valid,
        expires_at = v_expires_at
    WHERE device_id = v_device.id;

    -- Log API access
    INSERT INTO api_logs (device_hash, endpoint, method, status_code)
    VALUES (p_device_hash, '/api/license/verify', 'POST', 200);

    RETURN json_build_object(
        'success', TRUE,
        'is_valid', v_is_valid,
        'status', v_status,
        'expires_at', v_expires_at,
        'device_id', v_device.id
    );

EXCEPTION WHEN OTHERS THEN
    -- Log error
    INSERT INTO api_logs (device_hash, endpoint, method, status_code)
    VALUES (p_device_hash, '/api/license/verify', 'POST', 500);

    RETURN json_build_object(
        'success', FALSE,
        'error', SQLERRM
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to activate subscription after PayPal confirmation
CREATE OR REPLACE FUNCTION activate_subscription(
    p_device_hash TEXT,
    p_paypal_subscription_id TEXT,
    p_next_billing_date TIMESTAMPTZ
)
RETURNS JSON AS $$
DECLARE
    v_device_id UUID;
    v_subscription_id UUID;
BEGIN
    -- Get device ID
    SELECT id INTO v_device_id
    FROM devices
    WHERE device_hash = p_device_hash;

    IF NOT FOUND THEN
        RETURN json_build_object(
            'success', FALSE,
            'error', 'Device not found'
        );
    END IF;

    -- Update device status
    UPDATE devices
    SET status = 'active'
    WHERE id = v_device_id;

    -- Update subscription
    UPDATE subscriptions
    SET
        paypal_subscription_id = p_paypal_subscription_id,
        status = 'active',
        next_billing_date = p_next_billing_date
    WHERE device_id = v_device_id
    RETURNING id INTO v_subscription_id;

    -- Update license
    UPDATE licenses
    SET
        is_valid = TRUE,
        expires_at = p_next_billing_date
    WHERE device_id = v_device_id;

    -- Record payment
    INSERT INTO payment_history (subscription_id, amount_jpy, status, payment_method)
    VALUES (v_subscription_id, 2980, 'completed', 'paypal');

    RETURN json_build_object(
        'success', TRUE,
        'device_id', v_device_id,
        'subscription_id', v_subscription_id
    );

EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object(
        'success', FALSE,
        'error', SQLERRM
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to cancel subscription
CREATE OR REPLACE FUNCTION cancel_subscription(p_user_id UUID)
RETURNS JSON AS $$
DECLARE
    v_device_id UUID;
    v_subscription_id UUID;
BEGIN
    -- Get user's device
    SELECT id INTO v_device_id
    FROM devices
    WHERE user_id = p_user_id;

    IF NOT FOUND THEN
        RETURN json_build_object(
            'success', FALSE,
            'error', 'No device found for user'
        );
    END IF;

    -- Update subscription status
    UPDATE subscriptions
    SET
        status = 'cancelled',
        cancelled_at = NOW()
    WHERE device_id = v_device_id
    RETURNING id INTO v_subscription_id;

    -- Immediately expire device (no grace period in MVP)
    UPDATE devices
    SET status = 'expired'
    WHERE id = v_device_id;

    -- Invalidate license
    UPDATE licenses
    SET
        is_valid = FALSE,
        expires_at = NOW()
    WHERE device_id = v_device_id;

    RETURN json_build_object(
        'success', TRUE,
        'device_id', v_device_id,
        'subscription_id', v_subscription_id
    );

EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object(
        'success', FALSE,
        'error', SQLERRM
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- View for dashboard data
CREATE OR REPLACE VIEW user_dashboard AS
SELECT
    u.id as user_id,
    u.email,
    d.device_hash,
    d.status as device_status,
    d.trial_ends_at,
    s.status as subscription_status,
    s.paypal_subscription_id,
    s.next_billing_date,
    s.amount_jpy,
    l.is_valid as license_valid,
    l.expires_at as license_expires_at,
    l.last_verified_at,
    l.verification_count
FROM users_profile u
LEFT JOIN devices d ON u.id = d.user_id
LEFT JOIN subscriptions s ON d.id = s.device_id
LEFT JOIN licenses l ON d.id = l.device_id;

-- Grant permissions on functions and views
GRANT EXECUTE ON FUNCTION create_device_and_license TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION verify_license TO authenticated, service_role, anon;
GRANT EXECUTE ON FUNCTION activate_subscription TO service_role;
GRANT EXECUTE ON FUNCTION cancel_subscription TO authenticated, service_role;
GRANT SELECT ON user_dashboard TO authenticated;