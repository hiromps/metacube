-- Safe .ate File System Helper Functions (handles existing objects)
-- Run this instead of 11_ate_helper_functions.sql

-- 1. Queue .ate file generation
CREATE OR REPLACE FUNCTION queue_ate_generation(
    device_hash_param TEXT,
    template_name_param TEXT DEFAULT 'smartgram',
    priority_param INTEGER DEFAULT 5
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    device_record RECORD;
    queue_id UUID;
BEGIN
    -- Find device by hash
    SELECT d.*, u.email
    INTO device_record
    FROM devices d
    JOIN auth.users u ON d.user_id = u.id
    WHERE d.device_hash = UPPER(device_hash_param);

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Device not found: %', device_hash_param;
    END IF;

    -- Create queue entry
    INSERT INTO file_generation_queue (device_id, template_name, priority)
    VALUES (device_record.id, template_name_param, priority_param)
    RETURNING id INTO queue_id;

    RETURN queue_id;
END;
$$;

-- 2. Complete .ate generation
CREATE OR REPLACE FUNCTION complete_ate_generation(
    queue_id_param UUID,
    file_path_param TEXT,
    file_size_param BIGINT,
    checksum_param TEXT,
    encryption_key_hash_param TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    queue_record RECORD;
    template_record RECORD;
    new_filename TEXT;
    ate_file_id UUID;
BEGIN
    -- Get queue information
    SELECT * INTO queue_record
    FROM file_generation_queue
    WHERE id = queue_id_param AND status = 'processing';

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Queue item not found or not processing: %', queue_id_param;
    END IF;

    -- Get template information
    SELECT * INTO template_record
    FROM ate_templates
    WHERE name = queue_record.template_name AND is_active = true;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Template not found: %', queue_record.template_name;
    END IF;

    -- Generate filename
    new_filename := 'smartgram_' ||
                   EXTRACT(EPOCH FROM CURRENT_TIMESTAMP)::TEXT ||
                   '_' || SUBSTRING(queue_record.device_id::TEXT, 1, 8) ||
                   '.ate';

    -- Create .ate file record
    INSERT INTO ate_files (
        device_id,
        template_id,
        filename,
        file_path,
        file_size_bytes,
        checksum,
        encryption_key_hash,
        generation_status,
        expires_at
    ) VALUES (
        queue_record.device_id,
        template_record.id,
        new_filename,
        file_path_param,
        file_size_param,
        checksum_param,
        encryption_key_hash_param,
        'success',
        CURRENT_TIMESTAMP + INTERVAL '30 days'
    ) RETURNING id INTO ate_file_id;

    -- Mark queue as completed
    UPDATE file_generation_queue
    SET status = 'completed',
        completed_at = CURRENT_TIMESTAMP
    WHERE id = queue_id_param;

    RETURN true;
END;
$$;

-- 3. Fail .ate generation
CREATE OR REPLACE FUNCTION fail_ate_generation(
    queue_id_param UUID,
    error_message_param TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE file_generation_queue
    SET status = 'failed',
        error_message = error_message_param,
        completed_at = CURRENT_TIMESTAMP
    WHERE id = queue_id_param AND status = 'processing';

    RETURN FOUND;
END;
$$;

-- 4. Get download info for device
CREATE OR REPLACE FUNCTION get_download_info(device_hash_param TEXT)
RETURNS TABLE (
    ate_file_id UUID,
    filename TEXT,
    file_size_bytes BIGINT,
    expires_at TIMESTAMP WITH TIME ZONE,
    download_count INTEGER,
    last_downloaded_at TIMESTAMP WITH TIME ZONE,
    is_ready BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT
        af.id as ate_file_id,
        af.filename,
        af.file_size_bytes,
        af.expires_at,
        af.download_count,
        af.last_downloaded_at,
        (af.generation_status = 'success' AND af.is_active = true AND
         (af.expires_at IS NULL OR af.expires_at > CURRENT_TIMESTAMP)) as is_ready
    FROM ate_files af
    JOIN devices d ON af.device_id = d.id
    WHERE d.device_hash = UPPER(device_hash_param)
      AND af.is_active = true
    ORDER BY af.created_at DESC
    LIMIT 1;
END;
$$;

-- 5. Log download event
CREATE OR REPLACE FUNCTION log_download(
    ate_file_id_param UUID,
    download_ip_param TEXT DEFAULT NULL,
    user_agent_param TEXT DEFAULT NULL,
    bytes_downloaded_param BIGINT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Insert download log
    INSERT INTO download_history (
        ate_file_id,
        download_ip,
        user_agent,
        bytes_downloaded
    ) VALUES (
        ate_file_id_param,
        download_ip_param,
        user_agent_param,
        bytes_downloaded_param
    );

    -- Update file download count and last download time
    UPDATE ate_files
    SET download_count = download_count + 1,
        last_downloaded_at = CURRENT_TIMESTAMP
    WHERE id = ate_file_id_param;

    RETURN true;
END;
$$;

-- 6. Legacy plan mapping for existing subscriptions
CREATE OR REPLACE FUNCTION get_plan_by_legacy_name(legacy_name TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN CASE
        WHEN legacy_name LIKE '%2980%' OR legacy_name LIKE '%smartgram_monthly_2980%' THEN 'starter'
        WHEN legacy_name LIKE '%6980%' OR legacy_name LIKE '%smartgram_monthly_6980%' THEN 'pro'
        WHEN legacy_name LIKE '%15800%' OR legacy_name LIKE '%smartgram_monthly_15800%' THEN 'max'
        ELSE 'starter' -- Default fallback
    END;
END;
$$;

-- 7. Create view for device plan information
CREATE OR REPLACE VIEW device_plan_view AS
SELECT
    d.id as device_id,
    d.device_hash,
    d.user_id,
    d.status as device_status,
    COALESCE(p.name, 'starter') as plan_name,
    COALESCE(p.display_name, 'スタンダードプラン') as plan_display_name,
    COALESCE(p.price_jpy, 2980) as plan_price,
    COALESCE(p.features, '{"timeline_lua": true}'::jsonb) as plan_features,
    COALESCE(p.limitations, '{"daily_actions": 100}'::jsonb) as plan_limitations,
    s.paypal_subscription_id,
    s.status as subscription_status
FROM devices d
LEFT JOIN subscriptions s ON d.id = s.device_id AND s.status = 'active'
LEFT JOIN plans p ON p.id = COALESCE(
    s.plan_id,
    get_plan_by_legacy_name(COALESCE(s.plan_id, 'smartgram_monthly_2980'))
);

-- Grant permissions
GRANT EXECUTE ON FUNCTION queue_ate_generation TO authenticated;
GRANT EXECUTE ON FUNCTION complete_ate_generation TO authenticated;
GRANT EXECUTE ON FUNCTION fail_ate_generation TO authenticated;
GRANT EXECUTE ON FUNCTION get_download_info TO authenticated;
GRANT EXECUTE ON FUNCTION log_download TO authenticated;
GRANT EXECUTE ON FUNCTION get_plan_by_legacy_name TO authenticated;
GRANT SELECT ON device_plan_view TO authenticated;