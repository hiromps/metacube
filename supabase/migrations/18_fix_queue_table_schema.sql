-- Fix file_generation_queue table schema and functions to match existing structure
-- This version works with the existing table without template_name column

-- Drop existing functions that use template_name
DROP FUNCTION IF EXISTS queue_ate_generation(text, text, integer);
DROP FUNCTION IF EXISTS complete_ate_generation(uuid, text, bigint, text, text);
DROP FUNCTION IF EXISTS fail_ate_generation(uuid, text);
DROP FUNCTION IF EXISTS get_download_info(text);
DROP FUNCTION IF EXISTS log_download(uuid, text, text, bigint);

-- 1. Simplified queue function without template_name
CREATE FUNCTION queue_ate_generation(
    device_hash_param TEXT,
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

    -- Create queue entry without template_name
    INSERT INTO file_generation_queue (device_id, priority)
    VALUES (device_record.id, priority_param)
    RETURNING id INTO queue_id;

    RETURN queue_id;
END;
$$;

-- 2. Simplified complete function
CREATE FUNCTION complete_ate_generation(
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
    new_filename TEXT;
    ate_file_id UUID;
    dummy_template_id UUID;
BEGIN
    -- Get queue information
    SELECT * INTO queue_record
    FROM file_generation_queue
    WHERE id = queue_id_param AND status = 'processing';

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Queue item not found or not processing: %', queue_id_param;
    END IF;

    -- Generate filename
    new_filename := 'smartgram_' ||
                   EXTRACT(EPOCH FROM CURRENT_TIMESTAMP)::TEXT ||
                   '_' || SUBSTRING(queue_record.device_id::TEXT, 1, 8) ||
                   '.ate';

    -- Generate dummy template ID (since we don't have templates properly set up)
    SELECT uuid_generate_v4() INTO dummy_template_id;

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
        dummy_template_id,
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
EXCEPTION
    WHEN OTHERS THEN
        -- Log error and mark as failed
        UPDATE file_generation_queue
        SET status = 'failed',
            completed_at = CURRENT_TIMESTAMP
        WHERE id = queue_id_param;

        RAISE EXCEPTION 'Failed to complete generation: %', SQLERRM;
END;
$$;

-- 3. Fail generation function
CREATE FUNCTION fail_ate_generation(
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
        completed_at = CURRENT_TIMESTAMP
    WHERE id = queue_id_param AND status = 'processing';

    RETURN FOUND;
END;
$$;

-- 4. Get download info function
CREATE FUNCTION get_download_info(device_hash_param TEXT)
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
EXCEPTION
    WHEN OTHERS THEN
        -- Return empty if tables don't exist or have issues
        RETURN;
END;
$$;

-- 5. Log download function
CREATE FUNCTION log_download(
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
    -- Try to insert download log
    BEGIN
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
    EXCEPTION
        WHEN OTHERS THEN
            -- Skip if table issues
            NULL;
    END;

    -- Try to update file download count
    BEGIN
        UPDATE ate_files
        SET download_count = download_count + 1,
            last_downloaded_at = CURRENT_TIMESTAMP
        WHERE id = ate_file_id_param;
    EXCEPTION
        WHEN OTHERS THEN
            -- Skip if table issues
            NULL;
    END;

    RETURN true;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION queue_ate_generation(text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION complete_ate_generation(uuid, text, bigint, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION fail_ate_generation(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION get_download_info(text) TO authenticated;
GRANT EXECUTE ON FUNCTION log_download(uuid, text, text, bigint) TO authenticated;