-- Safe .ate File System Setup (handles existing objects)
-- Run this instead of 10_ate_file_system.sql

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Plans table (if not exists)
CREATE TABLE IF NOT EXISTS plans (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    price_jpy INTEGER NOT NULL,
    features JSONB NOT NULL DEFAULT '{}',
    limitations JSONB NOT NULL DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. .ate Templates table (if not exists)
CREATE TABLE IF NOT EXISTS ate_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    template_content TEXT NOT NULL,
    variables JSONB NOT NULL DEFAULT '{}',
    target_plans TEXT[] NOT NULL DEFAULT '{}',
    version TEXT NOT NULL DEFAULT '1.0.0',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Generated .ate Files table (if not exists)
CREATE TABLE IF NOT EXISTS ate_files (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    template_id UUID NOT NULL REFERENCES ate_templates(id),
    filename TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_size_bytes BIGINT NOT NULL,
    checksum TEXT NOT NULL,
    encryption_key_hash TEXT NOT NULL,
    generation_status TEXT NOT NULL DEFAULT 'pending' CHECK (generation_status IN ('pending', 'processing', 'success', 'failed')),
    error_message TEXT,
    expires_at TIMESTAMP WITH TIME ZONE,
    download_count INTEGER DEFAULT 0,
    last_downloaded_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Download History table (if not exists)
CREATE TABLE IF NOT EXISTS download_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ate_file_id UUID NOT NULL REFERENCES ate_files(id) ON DELETE CASCADE,
    downloaded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    download_ip TEXT,
    user_agent TEXT,
    bytes_downloaded BIGINT,
    download_duration_ms INTEGER
);

-- 5. File Generation Queue table (if not exists)
CREATE TABLE IF NOT EXISTS file_generation_queue (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    template_name TEXT NOT NULL DEFAULT 'smartgram',
    priority INTEGER NOT NULL DEFAULT 5 CHECK (priority >= 1 AND priority <= 10),
    status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'completed', 'failed')),
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE
);

-- Indexes (if not exists)
CREATE INDEX IF NOT EXISTS idx_ate_files_device_id ON ate_files(device_id);
CREATE INDEX IF NOT EXISTS idx_ate_files_status ON ate_files(generation_status);
CREATE INDEX IF NOT EXISTS idx_ate_files_active ON ate_files(is_active);
CREATE INDEX IF NOT EXISTS idx_download_history_ate_file_id ON download_history(ate_file_id);
CREATE INDEX IF NOT EXISTS idx_download_history_downloaded_at ON download_history(downloaded_at);
CREATE INDEX IF NOT EXISTS idx_generation_queue_status ON file_generation_queue(status);
CREATE INDEX IF NOT EXISTS idx_generation_queue_priority ON file_generation_queue(priority);
CREATE INDEX IF NOT EXISTS idx_generation_queue_created_at ON file_generation_queue(created_at);

-- Triggers for updated_at (only if not exists)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop and recreate triggers to avoid conflicts
DROP TRIGGER IF EXISTS update_plans_updated_at ON plans;
DROP TRIGGER IF EXISTS update_ate_templates_updated_at ON ate_templates;
DROP TRIGGER IF EXISTS update_ate_files_updated_at ON ate_files;

CREATE TRIGGER update_plans_updated_at
    BEFORE UPDATE ON plans
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ate_templates_updated_at
    BEFORE UPDATE ON ate_templates
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ate_files_updated_at
    BEFORE UPDATE ON ate_files
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Insert default plans (if not exists)
INSERT INTO plans (id, name, display_name, price_jpy, features, limitations) VALUES
(
    'starter',
    'starter',
    'スタンダードプラン',
    2980,
    '{"timeline_lua": true, "follow_lua": false, "unfollow_lua": false, "hashtaglike_lua": false, "activelike_lua": false}',
    '{"daily_actions": 100, "features": ["timeline_lua"]}'
),
(
    'pro',
    'pro',
    'プロプラン',
    6980,
    '{"timeline_lua": true, "follow_lua": true, "unfollow_lua": true, "hashtaglike_lua": false, "activelike_lua": false}',
    '{"daily_actions": 300, "features": ["timeline_lua", "follow_lua", "unfollow_lua"]}'
),
(
    'max',
    'max',
    'マックスプラン',
    15800,
    '{"timeline_lua": true, "follow_lua": true, "unfollow_lua": true, "hashtaglike_lua": true, "activelike_lua": true}',
    '{"daily_actions": 1000, "features": ["timeline_lua", "follow_lua", "unfollow_lua", "hashtaglike_lua", "activelike_lua"]}'
)
ON CONFLICT (id) DO NOTHING;

-- Insert default template (if not exists)
INSERT INTO ate_templates (name, display_name, template_content, variables, target_plans) VALUES
(
    'smartgram',
    'SMARTGRAM Standard Template',
    '-- SMARTGRAM main.lua template
-- Generated for device: {{DEVICE_HASH}}
-- Plan: {{PLAN_NAME}}
-- Generated: {{GENERATION_DATE}}

local config = {
    device_hash = "{{DEVICE_HASH}}",
    plan = "{{PLAN_NAME}}",
    features = {{PLAN_FEATURES}},
    api_endpoint = "{{API_ENDPOINT}}",
    version = "{{VERSION}}"
}

-- Feature availability based on plan
local features = {
    timeline_lua = {{FEATURE_TIMELINE}},
    follow_lua = {{FEATURE_FOLLOW}},
    unfollow_lua = {{FEATURE_UNFOLLOW}},
    hashtaglike_lua = {{FEATURE_HASHTAGLIKE}},
    activelike_lua = {{FEATURE_ACTIVELIKE}}
}

print("SMARTGRAM initialized for device: " .. config.device_hash)
print("Plan: " .. config.plan)
print("Available features:", features)

-- Main execution logic would go here
return config',
    '{"DEVICE_HASH": "string", "PLAN_NAME": "string", "PLAN_FEATURES": "json", "API_ENDPOINT": "string", "VERSION": "string", "FEATURE_TIMELINE": "boolean", "FEATURE_FOLLOW": "boolean", "FEATURE_UNFOLLOW": "boolean", "FEATURE_HASHTAGLIKE": "boolean", "FEATURE_ACTIVELIKE": "boolean", "GENERATION_DATE": "timestamp"}',
    '{"starter", "pro", "max"}'
)
ON CONFLICT (name) DO UPDATE SET
    template_content = EXCLUDED.template_content,
    variables = EXCLUDED.variables,
    target_plans = EXCLUDED.target_plans,
    updated_at = CURRENT_TIMESTAMP;

-- Enable RLS
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE ate_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE ate_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE download_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE file_generation_queue ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY IF NOT EXISTS "Plans are readable by everyone" ON plans
    FOR SELECT USING (true);

CREATE POLICY IF NOT EXISTS "Templates are readable by authenticated users" ON ate_templates
    FOR SELECT TO authenticated USING (true);

CREATE POLICY IF NOT EXISTS "Users can only see their own .ate files" ON ate_files
    FOR ALL TO authenticated USING (
        device_id IN (
            SELECT id FROM devices WHERE user_id = auth.uid()
        )
    );

CREATE POLICY IF NOT EXISTS "Users can only see their own download history" ON download_history
    FOR SELECT TO authenticated USING (
        ate_file_id IN (
            SELECT af.id FROM ate_files af
            JOIN devices d ON af.device_id = d.id
            WHERE d.user_id = auth.uid()
        )
    );

CREATE POLICY IF NOT EXISTS "Users can only see their own queue items" ON file_generation_queue
    FOR ALL TO authenticated USING (
        device_id IN (
            SELECT id FROM devices WHERE user_id = auth.uid()
        )
    );