-- Fix legacy plan references
-- Update existing subscriptions to use new plan names

-- Update subscriptions table to map legacy plan names to new names
UPDATE subscriptions
SET plan_id = CASE
    WHEN plan_id = 'smartgram_monthly_2980' THEN 'starter'
    WHEN plan_id = 'smartgram_monthly_8800' THEN 'pro'
    WHEN plan_id = 'smartgram_monthly_15000' THEN 'max'
    ELSE plan_id
END
WHERE plan_id IN ('smartgram_monthly_2980', 'smartgram_monthly_8800', 'smartgram_monthly_15000');

-- Update any other references in devices table if they exist
UPDATE devices
SET status = 'trial'  -- Ensure devices are in valid state
WHERE status NOT IN ('trial', 'active', 'expired', 'registered');

-- Drop and recreate the queue_ate_generation function with plan name mapping
DROP FUNCTION IF EXISTS queue_ate_generation(TEXT, TEXT, INTEGER);

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
    mapped_plan_name TEXT;
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

    -- Map legacy plan names to new names
    mapped_plan_name := CASE
        WHEN device_record.plan_id = 'smartgram_monthly_2980' THEN 'starter'
        WHEN device_record.plan_id = 'smartgram_monthly_8800' THEN 'pro'
        WHEN device_record.plan_id = 'smartgram_monthly_15000' THEN 'max'
        WHEN device_record.plan_id IS NULL THEN 'starter'
        ELSE COALESCE(device_record.plan_id, 'starter')
    END;

    SELECT * INTO plan_record
    FROM plans
    WHERE name = mapped_plan_name
    AND is_active = true;

    IF NOT FOUND THEN
        -- Try starter as fallback
        SELECT * INTO plan_record
        FROM plans
        WHERE name = 'starter'
        AND is_active = true;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Plan not found: % (mapped to: %)', device_record.plan_id, mapped_plan_name;
        END IF;
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

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION queue_ate_generation(TEXT, TEXT, INTEGER) TO authenticated;