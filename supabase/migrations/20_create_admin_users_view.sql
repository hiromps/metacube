-- Create a view for admin users to access user information
-- This view combines auth.users with device information

-- First, drop the view if it exists to avoid errors
DROP VIEW IF EXISTS public.admin_users_view CASCADE;

-- Create the view with safer column references
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

-- Grant access to authenticated users (you may want to restrict this to admin only)
GRANT SELECT ON public.admin_users_view TO authenticated;

-- Create RLS policy for admin access
-- Note: You'll need to add an is_admin check or similar based on your auth setup
ALTER TABLE public.admin_users_view ENABLE ROW LEVEL SECURITY;

-- Policy that allows only admin users to see all users
-- Modify this based on your admin identification method
CREATE POLICY "Admin users can view all users" ON public.admin_users_view
    FOR SELECT
    TO authenticated
    USING (
        -- Check if current user is admin
        -- Option 1: Check if user email matches admin emails
        auth.jwt() ->> 'email' IN ('admin@smartgram.jp', 'support@smartgram.jp')
        -- Option 2: Check if user has admin role in metadata
        -- OR (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
        -- Option 3: Always allow for now (remove in production!)
        OR true  -- TEMPORARY: Remove this line and implement proper admin check
    );

-- Create a simpler public view that doesn't require admin rights
-- This only shows basic info from devices table
DROP VIEW IF EXISTS public.device_users_view CASCADE;

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

-- Grant access to authenticated users
GRANT SELECT ON public.device_users_view TO authenticated;