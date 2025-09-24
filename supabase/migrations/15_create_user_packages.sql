-- Create user_packages table for admin-managed package uploads
CREATE TABLE IF NOT EXISTS user_packages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_hash TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_content TEXT NOT NULL, -- base64 encoded file content
  file_size INTEGER NOT NULL,
  uploaded_by TEXT DEFAULT 'admin',
  notes TEXT,
  version TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  download_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_user_packages_user_device
ON user_packages(user_id, device_hash) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_user_packages_active
ON user_packages(is_active, created_at DESC);

-- Enable RLS
ALTER TABLE user_packages ENABLE ROW LEVEL SECURITY;

-- Add RLS policies
CREATE POLICY "Users can view their own packages" ON user_packages
  FOR SELECT USING (auth.uid() = user_id);

-- Admins can manage all packages (will be handled by service role)
CREATE POLICY "Service role can manage all packages" ON user_packages
  FOR ALL USING (auth.role() = 'service_role');

-- Add trigger to update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_user_packages_updated_at
    BEFORE UPDATE ON user_packages
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- Comments
COMMENT ON TABLE user_packages IS 'Stores admin-uploaded packages for specific users and devices';
COMMENT ON COLUMN user_packages.file_content IS 'Base64 encoded file content';
COMMENT ON COLUMN user_packages.is_active IS 'Only one active package per user/device combination';