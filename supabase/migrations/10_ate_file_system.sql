-- .ate File Generation System Tables
-- For managing templates, generated files, and downloads

-- Plans table - Define available subscription plans with tool access
DROP TABLE IF EXISTS plans CASCADE;
CREATE TABLE plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(50) NOT NULL UNIQUE, -- 'starter', 'pro', 'max'
    display_name VARCHAR(100) NOT NULL, -- '⚡ STARTER', '🚀 PRO', '👑 MAX'
    price_jpy INTEGER NOT NULL,
    billing_cycle VARCHAR(20) NOT NULL DEFAULT 'monthly',
    tools JSONB NOT NULL DEFAULT '[]', -- ['timeline', 'follow'] - available tools
    max_devices INTEGER NOT NULL DEFAULT 1,
    trial_days INTEGER NOT NULL DEFAULT 3,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insert default plans
INSERT INTO plans (name, display_name, price_jpy, tools, max_devices, trial_days) VALUES
('starter', '⚡ STARTER', 2980, '["timeline", "basic_analysis"]', 1, 3),
('pro', '🚀 PRO', 6980, '["timeline", "follow", "unfollow", "target", "video_training", "advanced_analysis"]', 3, 3),
('max', '👑 MAX', 15800, '["timeline", "follow", "unfollow", "target", "video_training", "advanced_analysis", "unlimited", "consultant", "24h_support", "security"]', 10, 3)
ON CONFLICT (name) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    price_jpy = EXCLUDED.price_jpy,
    tools = EXCLUDED.tools,
    max_devices = EXCLUDED.max_devices,
    trial_days = EXCLUDED.trial_days;

-- .ate file templates - Store base template files
CREATE TABLE IF NOT EXISTS ate_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL UNIQUE, -- 'smartgram_v1.0'
    version VARCHAR(20) NOT NULL, -- '1.0.0'
    description TEXT,
    template_path VARCHAR(255) NOT NULL, -- 'templates/smartgram.at/' in Supabase Storage
    file_structure JSONB NOT NULL, -- JSON array of files in template
    required_variables JSONB NOT NULL DEFAULT '[]', -- ['device_hash', 'plan_tools', 'license_key']
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insert default template
INSERT INTO ate_templates (name, version, description, template_path, file_structure, required_variables) VALUES
('smartgram', '1.0.0', 'SMARTGRAM Instagram Automation Tools', 'templates/smartgram.at/',
 '[
   {"file": "main.lua", "type": "lua", "required": true},
   {"file": "timeline.lua", "type": "lua", "required": false},
   {"file": "story.lua", "type": "lua", "required": false},
   {"file": "follow.lua", "type": "lua", "required": false},
   {"file": "dm.lua", "type": "lua", "required": false},
   {"file": "analytics.lua", "type": "lua", "required": false},
   {"file": "config.json", "type": "json", "required": true}
 ]',
 '["device_hash", "plan_tools", "license_key", "expires_at", "app_version"]'
)
ON CONFLICT (name) DO UPDATE SET
    version = EXCLUDED.version,
    description = EXCLUDED.description,
    template_path = EXCLUDED.template_path,
    file_structure = EXCLUDED.file_structure,
    required_variables = EXCLUDED.required_variables;

-- Generated .ate files - Track generated files per device
CREATE TABLE IF NOT EXISTS ate_files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id UUID REFERENCES devices(id) ON DELETE CASCADE NOT NULL,
    template_id UUID REFERENCES ate_templates(id) NOT NULL,
    plan_id UUID REFERENCES plans(id) NOT NULL,

    -- File generation details
    filename VARCHAR(255) NOT NULL, -- 'device_hash_timestamp.ate'
    file_path VARCHAR(500) NOT NULL, -- 'generated/device_hash/smartgram_123456.ate'
    file_size_bytes BIGINT,
    checksum VARCHAR(64), -- SHA-256 hash for integrity

    -- Encryption details
    encryption_key_hash VARCHAR(64) NOT NULL, -- Hash of the AES key (for verification)
    encryption_algorithm VARCHAR(50) NOT NULL DEFAULT 'AES-256-GCM',

    -- Generation metadata
    generated_variables JSONB NOT NULL, -- Actual values used in generation
    generation_status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending, success, failed
    generation_error TEXT, -- Error message if failed

    -- Download tracking
    download_count INTEGER NOT NULL DEFAULT 0,
    first_downloaded_at TIMESTAMPTZ,
    last_downloaded_at TIMESTAMPTZ,

    -- Lifecycle
    expires_at TIMESTAMPTZ, -- When this file expires (matches license)
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(device_id, template_id) -- One generated file per device per template
);

-- Download history - Track all download events
CREATE TABLE IF NOT EXISTS download_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ate_file_id UUID REFERENCES ate_files(id) ON DELETE CASCADE NOT NULL,
    device_id UUID REFERENCES devices(id) ON DELETE CASCADE NOT NULL,

    -- Download details
    download_ip INET,
    user_agent TEXT,
    download_method VARCHAR(20) NOT NULL DEFAULT 'web', -- web, api

    -- Status
    status VARCHAR(20) NOT NULL DEFAULT 'completed', -- completed, failed, cancelled
    bytes_downloaded BIGINT,
    download_time_ms INTEGER,
    error_message TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- File generation queue - For async processing
CREATE TABLE IF NOT EXISTS file_generation_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id UUID REFERENCES devices(id) ON DELETE CASCADE NOT NULL,
    template_id UUID REFERENCES ate_templates(id) NOT NULL,
    plan_id UUID REFERENCES plans(id) NOT NULL,

    -- Queue details
    priority INTEGER NOT NULL DEFAULT 5, -- 1=highest, 10=lowest
    status VARCHAR(20) NOT NULL DEFAULT 'queued', -- queued, processing, completed, failed

    -- Processing details
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    processing_time_ms INTEGER,
    error_message TEXT,
    retry_count INTEGER NOT NULL DEFAULT 0,
    max_retries INTEGER NOT NULL DEFAULT 3,

    -- Generation parameters
    generation_params JSONB NOT NULL DEFAULT '{}',

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_plans_name ON plans(name);
CREATE INDEX IF NOT EXISTS idx_plans_is_active ON plans(is_active);
CREATE INDEX IF NOT EXISTS idx_ate_templates_name ON ate_templates(name);
CREATE INDEX IF NOT EXISTS idx_ate_templates_is_active ON ate_templates(is_active);
CREATE INDEX IF NOT EXISTS idx_ate_files_device_id ON ate_files(device_id);
CREATE INDEX IF NOT EXISTS idx_ate_files_status ON ate_files(generation_status);
CREATE INDEX IF NOT EXISTS idx_ate_files_expires_at ON ate_files(expires_at);
CREATE INDEX IF NOT EXISTS idx_download_history_ate_file_id ON download_history(ate_file_id);
CREATE INDEX IF NOT EXISTS idx_download_history_created_at ON download_history(created_at);
CREATE INDEX IF NOT EXISTS idx_generation_queue_status ON file_generation_queue(status);
CREATE INDEX IF NOT EXISTS idx_generation_queue_priority ON file_generation_queue(priority);

-- Add updated_at triggers
CREATE TRIGGER update_plans_updated_at BEFORE UPDATE ON plans
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ate_templates_updated_at BEFORE UPDATE ON ate_templates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ate_files_updated_at BEFORE UPDATE ON ate_files
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_generation_queue_updated_at BEFORE UPDATE ON file_generation_queue
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE ate_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE ate_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE download_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE file_generation_queue ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Plans - readable by all authenticated users
CREATE POLICY "Anyone can view active plans" ON plans
    FOR SELECT USING (is_active = true);

-- Templates - readable by all authenticated users
CREATE POLICY "Anyone can view active templates" ON ate_templates
    FOR SELECT USING (is_active = true);

-- ATE Files - users can only see their own files
CREATE POLICY "Users can view own ate files" ON ate_files
    FOR SELECT USING (
        device_id IN (
            SELECT id FROM devices WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update own ate files" ON ate_files
    FOR UPDATE USING (
        device_id IN (
            SELECT id FROM devices WHERE user_id = auth.uid()
        )
    );

-- Download History - users can only see their own downloads
CREATE POLICY "Users can view own download history" ON download_history
    FOR SELECT USING (
        device_id IN (
            SELECT id FROM devices WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert own download history" ON download_history
    FOR INSERT WITH CHECK (
        device_id IN (
            SELECT id FROM devices WHERE user_id = auth.uid()
        )
    );

-- Generation Queue - users can only see their own queue items
CREATE POLICY "Users can view own generation queue" ON file_generation_queue
    FOR SELECT USING (
        device_id IN (
            SELECT id FROM devices WHERE user_id = auth.uid()
        )
    );

-- Grant permissions
GRANT SELECT ON plans TO authenticated, anon;
GRANT SELECT ON ate_templates TO authenticated, anon;
GRANT ALL ON ate_files TO authenticated;
GRANT ALL ON download_history TO authenticated;
GRANT SELECT ON file_generation_queue TO authenticated;

-- Admin permissions (for service role)
GRANT ALL ON plans TO service_role;
GRANT ALL ON ate_templates TO service_role;
GRANT ALL ON ate_files TO service_role;
GRANT ALL ON download_history TO service_role;
GRANT ALL ON file_generation_queue TO service_role;