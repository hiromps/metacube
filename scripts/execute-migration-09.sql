-- Execute this SQL in your Supabase SQL Editor
-- URL: https://bsujceqmhvpltedjkvum.supabase.co

-- Restore missing database functions required by the API
-- This migration creates the functions that the API is expecting but were removed in previous migrations

-- Function to handle device registration with setup (called by API)
-- This function signature matches what the API is calling
CREATE OR REPLACE FUNCTION register_device_with_setup(
    p_user_id UUID,
    p_device_hash TEXT,
    p_email TEXT
) RETURNS JSON AS $$
DECLARE
    v_device_id UUID;
    v_existing_device devices%ROWTYPE;
BEGIN
    -- Check if device already exists
    SELECT * INTO v_existing_device FROM devices WHERE device_hash = p_device_hash;

    IF v_existing_device.id IS NOT NULL THEN
        -- Update existing device with new user_id if needed
        IF v_existing_device.user_id != p_user_id THEN
            UPDATE devices
            SET user_id = p_user_id, updated_at = NOW()
            WHERE device_hash = p_device_hash;
        END IF;

        RETURN json_build_object(
            'success', true,
            'device_id', v_existing_device.id,
            'status', v_existing_device.status,
            'message', 'Device already registered'
        );
    END IF;

    -- Check if user already has a different device
    SELECT * INTO v_existing_device FROM devices WHERE user_id = p_user_id;

    IF v_existing_device.id IS NOT NULL THEN
        RETURN json_build_object(
            'success', false,
            'error', 'User already has a registered device'
        );
    END IF;

    -- Create new device with registered status (trial will start on first execution)
    INSERT INTO devices (
        user_id,
        device_hash,
        status,
        trial_activated,
        trial_activated_at,
        first_execution_at,
        trial_ends_at,
        created_at,
        updated_at
    )
    VALUES (
        p_user_id,
        p_device_hash,
        'registered',
        false,
        NULL,
        NULL,
        NULL,
        NOW(),
        NOW()
    )
    RETURNING id INTO v_device_id;

    -- Create initial license record (not yet valid for tools)
    INSERT INTO licenses (
        device_id,
        license_key,
        is_valid,
        expires_at,
        created_at,
        updated_at
    )
    VALUES (
        v_device_id,
        'LICENSE-' || p_device_hash || '-' || extract(epoch from now())::text,
        false,  -- Not valid until trial is activated
        NULL,
        NOW(),
        NOW()
    );

    -- Log the registration event
    INSERT INTO device_events (
        device_id,
        event_type,
        event_data,
        created_at
    )
    VALUES (
        v_device_id,
        'device_registered',
        json_build_object(
            'device_hash', p_device_hash,
            'email', p_email,
            'registration_type', 'api_registration'
        ),
        NOW()
    );

    RETURN json_build_object(
        'success', true,
        'device_id', v_device_id,
        'status', 'registered',
        'message', 'Device registered successfully. Trial will start on first main.lua execution.'
    );
EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object(
            'success', false,
            'error', SQLERRM
        );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get comprehensive user status (for dashboard and API calls)
CREATE OR REPLACE FUNCTION get_user_status(
    p_user_id UUID
) RETURNS JSON AS $$
DECLARE
    v_user_data RECORD;
    v_time_remaining_seconds INTEGER;
    v_status_description TEXT;
    v_has_access_to_tools BOOLEAN;
BEGIN
    -- Get comprehensive user data from the view
    SELECT * INTO v_user_data
    FROM user_dashboard
    WHERE user_id = p_user_id;

    -- Check if user exists
    IF v_user_data.user_id IS NULL THEN
        RETURN json_build_object(
            'success', false,
            'error', 'User not found'
        );
    END IF;

    -- Calculate time remaining for trial users
    v_time_remaining_seconds := NULL;
    IF v_user_data.device_status = 'trial' AND v_user_data.trial_ends_at IS NOT NULL AND v_user_data.trial_ends_at > NOW() THEN
        v_time_remaining_seconds := EXTRACT(EPOCH FROM (v_user_data.trial_ends_at - NOW()))::INTEGER;
    END IF;

    -- Determine access to tools
    v_has_access_to_tools := v_user_data.has_valid_license;

    -- Get status description
    v_status_description := v_user_data.status_description;

    -- Return comprehensive user status
    RETURN json_build_object(
        'success', true,
        'user_id', v_user_data.user_id,
        'email', v_user_data.email,
        'device_id', v_user_data.device_id,
        'device_hash', v_user_data.device_hash,
        'device_model', v_user_data.device_model,
        'status', v_user_data.device_status,
        'trial_activated', v_user_data.trial_activated,
        'trial_activated_at', v_user_data.trial_activated_at,
        'trial_ends_at', v_user_data.trial_ends_at,
        'subscription_id', v_user_data.subscription_id,
        'paypal_subscription_id', v_user_data.paypal_subscription_id,
        'subscription_status', v_user_data.subscription_status,
        'status_description', v_status_description,
        'has_access_to_content', true, -- All registered users have content access
        'has_access_to_tools', v_has_access_to_tools,
        'has_valid_license', v_user_data.has_valid_license,
        'time_remaining_seconds', v_time_remaining_seconds,
        'license_expires_at', v_user_data.license_expires_at,
        'next_billing_date', v_user_data.next_billing_date
    );
EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object(
            'success', false,
            'error', SQLERRM
        );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions to authenticated and anonymous users
GRANT EXECUTE ON FUNCTION register_device_with_setup TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_user_status TO anon, authenticated;

-- Add helpful comment
COMMENT ON FUNCTION register_device_with_setup IS 'Handles device registration from API with email and user_id parameters';
COMMENT ON FUNCTION get_user_status IS 'Returns comprehensive user status information for dashboard and API calls';

-- Verification queries (run these after the main script)
-- Test the functions:
-- SELECT register_device_with_setup('TEST123456789', 'test@example.com', '2f1bbfdc-1ce7-4fac-9bf9-943afe80d6df');
-- SELECT get_user_status('2f1bbfdc-1ce7-4fac-9bf9-943afe80d6df');
-- SELECT proname, prorettype::regtype FROM pg_proc WHERE proname IN ('register_device_with_setup', 'get_user_status');