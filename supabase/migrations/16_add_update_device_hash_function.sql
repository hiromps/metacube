-- Add update_device_hash function for device hash changes
-- SocialTouch MVP - Device hash update functionality

CREATE OR REPLACE FUNCTION update_device_hash(
    p_user_id UUID,
    p_new_device_hash TEXT
)
RETURNS JSON AS $$
DECLARE
    v_device_id UUID;
    v_old_device_hash TEXT;
    v_device_status TEXT;
BEGIN
    -- Validate input parameters
    IF p_user_id IS NULL OR p_new_device_hash IS NULL OR LENGTH(TRIM(p_new_device_hash)) = 0 THEN
        RETURN json_build_object(
            'success', FALSE,
            'error', 'Invalid parameters: user_id and new_device_hash are required'
        );
    END IF;

    -- Clean the new device hash
    p_new_device_hash := TRIM(p_new_device_hash);

    -- Check if new device hash is already in use by another user
    IF EXISTS (SELECT 1 FROM devices WHERE device_hash = p_new_device_hash) THEN
        RETURN json_build_object(
            'success', FALSE,
            'error', 'Device hash already in use by another user'
        );
    END IF;

    -- Get the user's current device information
    SELECT id, device_hash, status
    INTO v_device_id, v_old_device_hash, v_device_status
    FROM devices
    WHERE user_id = p_user_id;

    IF NOT FOUND THEN
        RETURN json_build_object(
            'success', FALSE,
            'error', 'No device found for this user'
        );
    END IF;

    -- Check if the new hash is the same as the current one
    IF v_old_device_hash = p_new_device_hash THEN
        RETURN json_build_object(
            'success', FALSE,
            'error', 'New device hash is the same as current device hash'
        );
    END IF;

    -- Update the device hash
    UPDATE devices
    SET
        device_hash = p_new_device_hash,
        updated_at = NOW()
    WHERE id = v_device_id;

    -- Log the device hash change in API logs for audit trail
    INSERT INTO api_logs (device_hash, endpoint, method, status_code)
    VALUES (p_new_device_hash, '/api/device/update-hash', 'POST', 200);

    RETURN json_build_object(
        'success', TRUE,
        'message', 'Device hash updated successfully',
        'device_id', v_device_id,
        'old_device_hash', v_old_device_hash,
        'new_device_hash', p_new_device_hash,
        'device_status', v_device_status
    );

EXCEPTION WHEN OTHERS THEN
    -- Log error
    INSERT INTO api_logs (device_hash, endpoint, method, status_code)
    VALUES (p_new_device_hash, '/api/device/update-hash', 'POST', 500);

    RETURN json_build_object(
        'success', FALSE,
        'error', SQLERRM,
        'error_code', SQLSTATE
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions on the function
GRANT EXECUTE ON FUNCTION update_device_hash TO authenticated, service_role;

-- Add comment for documentation
COMMENT ON FUNCTION update_device_hash IS 'Updates the device hash for a user. Validates uniqueness and logs changes.';