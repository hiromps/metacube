-- Fix admin users view with proper error handling
-- This script creates views for admin user management

-- First, ensure plans table exists with correct structure
CREATE TABLE IF NOT EXISTS plans (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    display_name TEXT NOT NULL,
    description TEXT,
    price_jpy INTEGER,
    original_price_jpy INTEGER,
    billing_cycle TEXT DEFAULT 'monthly',
    features JSONB DEFAULT '{}',
    limitations JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT TRUE,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default plans if they don't exist
INSERT INTO plans (name, display_name, price_jpy, features, limitations, sort_order)
VALUES
    ('starter', 'STARTER', 2980,
     '{"timeline.lua": true, "hashtaglike.lua": true}',
     '{"support": "LINEサポート30日間"}', 1),
    ('pro', 'PRO', 6980,
     '{"timeline.lua": true, "hashtaglike.lua": true, "follow.lua": true, "unfollow.lua": true}',
     '{"support": "LINEサポート30日間"}', 2),
    ('max', 'MAX', 15800,
     '{"timeline.lua": true, "hashtaglike.lua": true, "follow.lua": true, "unfollow.lua": true, "activelike.lua": true}',
     '{"support": "LINEサポート30日間"}', 3),
    ('trial', 'TRIAL', 0,
     '{"timeline.lua": true, "hashtaglike.lua": true}',
     '{"support": "なし", "duration": "3日間"}', 0)
ON CONFLICT (name) DO NOTHING;

-- Drop existing views if they exist
DROP VIEW IF EXISTS public.admin_users_view CASCADE;
DROP VIEW IF EXISTS public.device_users_view CASCADE;

-- Create admin users view (combines auth.users with devices)
CREATE VIEW public.admin_users_view AS
SELECT
    au.id as user_id,
    au.email,
    au.created_at,
    au.email_confirmed_at,
    au.last_sign_in_at,
    d.device_hash,
    d.plan_id,
    d.status as device_status,
    d.created_at as device_created_at,
    COALESCE(
        p.display_name,
        CASE d.plan_id
            WHEN 'starter' THEN 'STARTER'
            WHEN 'pro' THEN 'PRO'
            WHEN 'max' THEN 'MAX'
            WHEN 'trial' THEN 'TRIAL'
            ELSE '未契約'
        END
    ) as plan_display_name
FROM auth.users au
LEFT JOIN public.devices d ON au.id = d.user_id
LEFT JOIN public.plans p ON d.plan_id = p.name
ORDER BY au.created_at DESC;

-- Create simpler device users view (devices table only)
CREATE VIEW public.device_users_view AS
SELECT DISTINCT
    d.user_id,
    d.device_hash,
    d.plan_id,
    d.status,
    d.created_at,
    COALESCE(
        p.display_name,
        CASE d.plan_id
            WHEN 'starter' THEN 'STARTER'
            WHEN 'pro' THEN 'PRO'
            WHEN 'max' THEN 'MAX'
            WHEN 'trial' THEN 'TRIAL'
            ELSE '未契約'
        END
    ) as plan_display_name
FROM public.devices d
LEFT JOIN public.plans p ON d.plan_id = p.name
ORDER BY d.created_at DESC;

-- Grant permissions
GRANT SELECT ON public.admin_users_view TO authenticated;
GRANT SELECT ON public.device_users_view TO authenticated;

-- Optional: Create RLS policies for admin users only
-- Uncomment and modify based on your admin identification method

-- ALTER TABLE public.admin_users_view ENABLE ROW LEVEL SECURITY;
--
-- CREATE POLICY "Admin users can view all users" ON public.admin_users_view
--     FOR SELECT
--     TO authenticated
--     USING (
--         auth.jwt() ->> 'email' IN ('admin@smartgram.jp', 'support@smartgram.jp')
--     );

-- Verify the views were created successfully
SELECT 'admin_users_view created' AS status
WHERE EXISTS (
    SELECT FROM information_schema.views
    WHERE table_schema = 'public'
    AND table_name = 'admin_users_view'
)
UNION ALL
SELECT 'device_users_view created' AS status
WHERE EXISTS (
    SELECT FROM information_schema.views
    WHERE table_schema = 'public'
    AND table_name = 'device_users_view'
);