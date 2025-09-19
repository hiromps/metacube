-- Row Level Security Policies
-- SocialTouch MVP - Secure data access patterns

-- Enable RLS on all tables
ALTER TABLE users_profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE licenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_logs ENABLE ROW LEVEL SECURITY;

-- Users Profile Policies
-- Users can only see and modify their own profile
CREATE POLICY "Users can view their own profile"
ON users_profile FOR SELECT
USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
ON users_profile FOR UPDATE
USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile"
ON users_profile FOR INSERT
WITH CHECK (auth.uid() = id);

-- Devices Policies
-- Users can only see and manage their own devices
CREATE POLICY "Users can view their own devices"
ON devices FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own devices"
ON devices FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own devices"
ON devices FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- API can verify any device for license checking
CREATE POLICY "API can verify devices for licensing"
ON devices FOR SELECT
USING (
    -- Allow API access for license verification
    current_setting('app.current_user_id', true) IS NOT NULL
    OR
    -- Allow authenticated user access to their own devices
    auth.uid() = user_id
);

-- Subscriptions Policies
-- Users can only see their own subscriptions
CREATE POLICY "Users can view their own subscriptions"
ON subscriptions FOR SELECT
USING (
    auth.uid() IN (
        SELECT user_id FROM devices WHERE id = device_id
    )
);

CREATE POLICY "Users can update their own subscriptions"
ON subscriptions FOR UPDATE
USING (
    auth.uid() IN (
        SELECT user_id FROM devices WHERE id = device_id
    )
);

CREATE POLICY "Service can manage subscriptions"
ON subscriptions FOR ALL
USING (
    -- Allow service account to manage all subscriptions
    current_setting('app.service_role', true) = 'true'
);

-- Licenses Policies
-- Users can view their own licenses
CREATE POLICY "Users can view their own licenses"
ON licenses FOR SELECT
USING (
    auth.uid() IN (
        SELECT user_id FROM devices WHERE id = device_id
    )
);

-- API can verify any license
CREATE POLICY "API can verify licenses"
ON licenses FOR SELECT
USING (
    current_setting('app.current_user_id', true) IS NOT NULL
    OR
    auth.uid() IN (
        SELECT user_id FROM devices WHERE id = device_id
    )
);

-- Service can manage all licenses
CREATE POLICY "Service can manage licenses"
ON licenses FOR ALL
USING (
    current_setting('app.service_role', true) = 'true'
);

-- Payment History Policies
-- Users can view their own payment history
CREATE POLICY "Users can view their own payment history"
ON payment_history FOR SELECT
USING (
    auth.uid() IN (
        SELECT d.user_id
        FROM devices d
        JOIN subscriptions s ON d.id = s.device_id
        WHERE s.id = subscription_id
    )
);

-- Service can manage payment history
CREATE POLICY "Service can manage payment history"
ON payment_history FOR ALL
USING (
    current_setting('app.service_role', true) = 'true'
);

-- API Logs Policies
-- Only service role can access logs
CREATE POLICY "Service can manage API logs"
ON api_logs FOR ALL
USING (
    current_setting('app.service_role', true) = 'true'
);

-- Functions for RLS context
-- Set service role context for API operations
CREATE OR REPLACE FUNCTION set_service_role()
RETURNS void AS $$
BEGIN
    PERFORM set_config('app.service_role', 'true', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Set current user context for API operations
CREATE OR REPLACE FUNCTION set_api_user_context(user_id TEXT)
RETURNS void AS $$
BEGIN
    PERFORM set_config('app.current_user_id', user_id, true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO anon;

-- Grant permissions on tables
GRANT SELECT, INSERT, UPDATE ON users_profile TO authenticated;
GRANT SELECT, INSERT, UPDATE ON devices TO authenticated;
GRANT SELECT, UPDATE ON subscriptions TO authenticated;
GRANT SELECT ON licenses TO authenticated;
GRANT SELECT ON payment_history TO authenticated;

-- Service role permissions (for API access)
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;