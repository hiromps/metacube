-- SocialTouch MVP Database Schema
-- iPhone 7/8 AutoTouch License Management System

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table (extends Supabase Auth)
-- Additional user profile information
CREATE TABLE users_profile (
    id UUID REFERENCES auth.users(id) PRIMARY KEY,
    email TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Devices table
-- One device per user restriction
CREATE TABLE devices (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    device_hash TEXT UNIQUE NOT NULL,
    device_model TEXT DEFAULT 'iPhone 7/8',
    status TEXT CHECK (status IN ('trial', 'active', 'expired', 'suspended')) DEFAULT 'trial',
    trial_ends_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '3 days'),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Ensure one device per user
    CONSTRAINT one_device_per_user UNIQUE (user_id)
);

-- Subscriptions table
-- PayPal subscription management
CREATE TABLE subscriptions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    device_id UUID REFERENCES devices(id) ON DELETE CASCADE NOT NULL UNIQUE,
    paypal_subscription_id TEXT UNIQUE,
    status TEXT CHECK (status IN ('pending', 'active', 'cancelled', 'expired', 'suspended')) DEFAULT 'pending',
    plan_id TEXT DEFAULT 'socialtouch_monthly_2980',
    amount_jpy INTEGER DEFAULT 2980,
    billing_cycle TEXT DEFAULT 'monthly',
    next_billing_date TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Licenses table
-- License verification and caching
CREATE TABLE licenses (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    device_id UUID REFERENCES devices(id) ON DELETE CASCADE NOT NULL UNIQUE,
    is_valid BOOLEAN DEFAULT TRUE,
    expires_at TIMESTAMPTZ,
    last_verified_at TIMESTAMPTZ DEFAULT NOW(),
    verification_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Payment history table
-- Track all payment events
CREATE TABLE payment_history (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    subscription_id UUID REFERENCES subscriptions(id) ON DELETE CASCADE NOT NULL,
    paypal_payment_id TEXT,
    amount_jpy INTEGER NOT NULL,
    status TEXT CHECK (status IN ('completed', 'pending', 'failed', 'refunded')) NOT NULL,
    payment_method TEXT DEFAULT 'paypal',
    payment_date TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- API access logs (for debugging and monitoring)
CREATE TABLE api_logs (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    device_hash TEXT,
    endpoint TEXT NOT NULL,
    method TEXT NOT NULL,
    status_code INTEGER,
    response_time_ms INTEGER,
    user_agent TEXT,
    ip_address INET,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_devices_device_hash ON devices(device_hash);
CREATE INDEX idx_devices_user_id ON devices(user_id);
CREATE INDEX idx_devices_status ON devices(status);
CREATE INDEX idx_subscriptions_paypal_id ON subscriptions(paypal_subscription_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);
CREATE INDEX idx_licenses_device_id ON licenses(device_id);
CREATE INDEX idx_licenses_expires_at ON licenses(expires_at);
CREATE INDEX idx_payment_history_subscription_id ON payment_history(subscription_id);
CREATE INDEX idx_api_logs_device_hash ON api_logs(device_hash);
CREATE INDEX idx_api_logs_created_at ON api_logs(created_at);

-- Functions and triggers for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add updated_at triggers
CREATE TRIGGER update_users_profile_updated_at BEFORE UPDATE ON users_profile FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_devices_updated_at BEFORE UPDATE ON devices FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON subscriptions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_licenses_updated_at BEFORE UPDATE ON licenses FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();