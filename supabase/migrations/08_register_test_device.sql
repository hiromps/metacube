-- Register test device FFMZ3GTSJC6J for akihiro0324mnr@gmail.com

-- First, create or update the user in auth.users (if using Supabase)
-- Note: In production, this would be handled by the registration process

-- Create a test user entry in devices table
INSERT INTO devices (
    id,
    user_id,
    device_hash,
    device_model,
    status,
    trial_activated,
    trial_activated_at,
    first_execution_at,
    trial_ends_at,
    created_at,
    updated_at
) VALUES (
    gen_random_uuid(),
    '2f1bbfdc-1ce7-4fac-9bf9-943afe80d6df', -- User ID from mock data
    'FFMZ3GTSJC6J',
    'iPhone 7/8',
    'registered', -- Ready for trial activation
    false,
    null,
    null,
    null,
    NOW(),
    NOW()
) ON CONFLICT (device_hash) DO UPDATE
SET user_id = '2f1bbfdc-1ce7-4fac-9bf9-943afe80d6df',
    status = 'registered',
    trial_activated = false,
    updated_at = NOW();

-- Create subscription entry for the device
INSERT INTO subscriptions (
    id,
    device_id,
    paypal_subscription_id,
    plan_id,
    status,
    amount_jpy,
    billing_cycle,
    next_billing_date,
    created_at,
    updated_at
) VALUES (
    gen_random_uuid(),
    (SELECT id FROM devices WHERE device_hash = 'FFMZ3GTSJC6J'),
    'I-TEST123456789',
    'monthly',
    'active',
    2980,
    'monthly',
    NOW() + INTERVAL '1 month',
    NOW(),
    NOW()
) ON CONFLICT (device_id) DO UPDATE
SET paypal_subscription_id = 'I-TEST123456789',
    status = 'active',
    updated_at = NOW();

-- Create license entry for the device
INSERT INTO licenses (
    id,
    device_id,
    license_key,
    is_valid,
    expires_at,
    created_at,
    updated_at
) VALUES (
    gen_random_uuid(),
    (SELECT id FROM devices WHERE device_hash = 'FFMZ3GTSJC6J'),
    'LICENSE-FFMZ3GTSJC6J-' || extract(epoch from now())::text,
    true,
    NOW() + INTERVAL '1 year',
    NOW(),
    NOW()
) ON CONFLICT (device_id) DO UPDATE
SET is_valid = true,
    expires_at = NOW() + INTERVAL '1 year',
    updated_at = NOW();

-- Log the registration event
INSERT INTO device_events (
    device_id,
    event_type,
    event_data,
    created_at
) VALUES (
    (SELECT id FROM devices WHERE device_hash = 'FFMZ3GTSJC6J'),
    'device_registered',
    json_build_object(
        'device_hash', 'FFMZ3GTSJC6J',
        'email', 'akihiro0324mnr@gmail.com',
        'registration_type', 'manual_test',
        'paypal_subscription_id', 'I-TEST123456789'
    ),
    NOW()
);