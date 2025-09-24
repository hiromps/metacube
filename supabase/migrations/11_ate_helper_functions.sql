-- Helper Functions for .ate File Generation System

-- Function to get user's current plan with tools
CREATE OR REPLACE FUNCTION get_device_plan_info(device_hash_param TEXT)
RETURNS TABLE (
    device_id UUID,
    plan_name TEXT,
    plan_tools JSONB,
    license_expires_at TIMESTAMPTZ,
    is_valid BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        d.id,
        p.name,
        p.tools,
        l.expires_at,
        CASE
            WHEN l.expires_at IS NULL THEN true
            WHEN l.expires_at > NOW() THEN true
            ELSE false
        END as is_valid
    FROM devices d
    LEFT JOIN subscriptions s ON d.id = s.device_id
    LEFT JOIN plans p ON s.plan_id = p.name
    LEFT JOIN licenses l ON d.id = l.device_id
    WHERE d.device_hash = device_hash_param
    AND d.status IN ('trial', 'active')
    LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to queue .ate file generation
CREATE OR REPLACE FUNCTION queue_ate_generation(
    device_hash_param TEXT,
    template_name_param TEXT DEFAULT 'smartgram',
    priority_param INTEGER DEFAULT 5
) RETURNS UUID AS $$
DECLARE
    device_record RECORD;
    template_record RECORD;
    plan_record RECORD;
    queue_id UUID;
BEGIN
    -- Get device info
    SELECT d.id, d.user_id, s.plan_id
    INTO device_record
    FROM devices d
    LEFT JOIN subscriptions s ON d.id = s.device_id
    WHERE d.device_hash = device_hash_param
    AND d.status IN ('trial', 'active');

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Device not found or inactive: %', device_hash_param;
    END IF;

    -- Get template info
    SELECT * INTO template_record
    FROM ate_templates
    WHERE name = template_name_param
    AND is_active = true;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Template not found: %', template_name_param;
    END IF;

    -- Get plan info (use starter if no subscription)
    SELECT * INTO plan_record
    FROM plans
    WHERE name = COALESCE(device_record.plan_id, 'starter')
    AND is_active = true;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Plan not found: %', COALESCE(device_record.plan_id, 'starter');
    END IF;

    -- Insert into generation queue
    INSERT INTO file_generation_queue (
        device_id,
        template_id,
        plan_id,
        priority,
        generation_params
    ) VALUES (
        device_record.id,
        template_record.id,
        plan_record.id,
        priority_param,
        jsonb_build_object(
            'device_hash', device_hash_param,
            'plan_name', plan_record.name,
            'template_name', template_name_param
        )
    )
    RETURNING id INTO queue_id;

    RETURN queue_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to mark .ate file generation as completed
CREATE OR REPLACE FUNCTION complete_ate_generation(
    queue_id_param UUID,
    file_path_param TEXT,
    file_size_param BIGINT,
    checksum_param TEXT,
    encryption_key_hash_param TEXT
) RETURNS UUID AS $$
DECLARE
    queue_record RECORD;
    ate_file_id UUID;
    device_info RECORD;
BEGIN
    -- Get queue record
    SELECT * INTO queue_record
    FROM file_generation_queue
    WHERE id = queue_id_param;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Queue item not found: %', queue_id_param;
    END IF;

    -- Get device and license info
    SELECT d.device_hash, l.expires_at
    INTO device_info
    FROM devices d
    LEFT JOIN licenses l ON d.id = l.device_id
    WHERE d.id = queue_record.device_id;

    -- Insert or update ate_files record
    INSERT INTO ate_files (
        device_id,
        template_id,
        plan_id,
        filename,
        file_path,
        file_size_bytes,
        checksum,
        encryption_key_hash,
        generated_variables,
        generation_status,
        expires_at
    ) VALUES (
        queue_record.device_id,
        queue_record.template_id,
        queue_record.plan_id,
        device_info.device_hash || '_' || extract(epoch from NOW())::bigint || '.ate',
        file_path_param,
        file_size_param,
        checksum_param,
        encryption_key_hash_param,
        queue_record.generation_params,
        'success',
        device_info.expires_at
    )
    ON CONFLICT (device_id, template_id) DO UPDATE SET
        filename = EXCLUDED.filename,
        file_path = EXCLUDED.file_path,
        file_size_bytes = EXCLUDED.file_size_bytes,
        checksum = EXCLUDED.checksum,
        encryption_key_hash = EXCLUDED.encryption_key_hash,
        generated_variables = EXCLUDED.generated_variables,
        generation_status = EXCLUDED.generation_status,
        expires_at = EXCLUDED.expires_at,
        updated_at = NOW()
    RETURNING id INTO ate_file_id;

    -- Update queue record
    UPDATE file_generation_queue
    SET
        status = 'completed',
        completed_at = NOW(),
        processing_time_ms = extract(epoch from (NOW() - started_at))::integer * 1000
    WHERE id = queue_id_param;

    RETURN ate_file_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to mark .ate file generation as failed
CREATE OR REPLACE FUNCTION fail_ate_generation(
    queue_id_param UUID,
    error_message_param TEXT
) RETURNS VOID AS $$
BEGIN
    UPDATE file_generation_queue
    SET
        status = 'failed',
        completed_at = NOW(),
        error_message = error_message_param,
        retry_count = retry_count + 1
    WHERE id = queue_id_param;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to log download event
CREATE OR REPLACE FUNCTION log_download(
    ate_file_id_param UUID,
    download_ip_param INET DEFAULT NULL,
    user_agent_param TEXT DEFAULT NULL,
    bytes_downloaded_param BIGINT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    download_id UUID;
    ate_file_record RECORD;
BEGIN
    -- Get ate_file record to get device_id
    SELECT device_id INTO ate_file_record
    FROM ate_files
    WHERE id = ate_file_id_param;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'ATE file not found: %', ate_file_id_param;
    END IF;

    -- Insert download record
    INSERT INTO download_history (
        ate_file_id,
        device_id,
        download_ip,
        user_agent,
        status,
        bytes_downloaded
    ) VALUES (
        ate_file_id_param,
        ate_file_record.device_id,
        download_ip_param,
        user_agent_param,
        'completed',
        bytes_downloaded_param
    )
    RETURNING id INTO download_id;

    -- Update ate_files download tracking
    UPDATE ate_files
    SET
        download_count = download_count + 1,
        first_downloaded_at = CASE WHEN first_downloaded_at IS NULL THEN NOW() ELSE first_downloaded_at END,
        last_downloaded_at = NOW()
    WHERE id = ate_file_id_param;

    RETURN download_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to clean up expired files
CREATE OR REPLACE FUNCTION cleanup_expired_ate_files()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    -- Update expired files to inactive
    UPDATE ate_files
    SET is_active = false
    WHERE expires_at < NOW()
    AND is_active = true;

    GET DIAGNOSTICS deleted_count = ROW_COUNT;

    -- Clean up old generation queue records (older than 7 days)
    DELETE FROM file_generation_queue
    WHERE status IN ('completed', 'failed')
    AND created_at < NOW() - INTERVAL '7 days';

    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get download link info
CREATE OR REPLACE FUNCTION get_download_info(device_hash_param TEXT)
RETURNS TABLE (
    ate_file_id UUID,
    filename TEXT,
    file_size_bytes BIGINT,
    expires_at TIMESTAMPTZ,
    download_count INTEGER,
    last_downloaded_at TIMESTAMPTZ,
    is_ready BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        af.id,
        af.filename,
        af.file_size_bytes,
        af.expires_at,
        af.download_count,
        af.last_downloaded_at,
        af.generation_status = 'success' AND af.is_active = true as is_ready
    FROM ate_files af
    JOIN devices d ON af.device_id = d.id
    WHERE d.device_hash = device_hash_param
    AND af.is_active = true
    ORDER BY af.updated_at DESC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_device_plan_info(TEXT) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION queue_ate_generation(TEXT, TEXT, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION complete_ate_generation(UUID, TEXT, BIGINT, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION fail_ate_generation(UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION log_download(UUID, INET, TEXT, BIGINT) TO authenticated;
GRANT EXECUTE ON FUNCTION cleanup_expired_ate_files() TO service_role;
GRANT EXECUTE ON FUNCTION get_download_info(TEXT) TO authenticated, anon;