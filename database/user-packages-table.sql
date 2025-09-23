-- ユーザー専用パッケージ管理テーブル
CREATE TABLE user_packages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    device_hash VARCHAR(255) NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_content TEXT NOT NULL, -- base64エンコードされたファイル内容
    file_size INTEGER NOT NULL,
    uploaded_by VARCHAR(255) DEFAULT 'admin',
    upload_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_downloaded TIMESTAMP WITH TIME ZONE,
    download_count INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    version VARCHAR(50) DEFAULT '1.0',
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- インデックス追加
CREATE INDEX idx_user_packages_user_id ON user_packages(user_id);
CREATE INDEX idx_user_packages_device_hash ON user_packages(device_hash);
CREATE INDEX idx_user_packages_active ON user_packages(is_active);

-- RLS (Row Level Security) 設定
ALTER TABLE user_packages ENABLE ROW LEVEL SECURITY;

-- ユーザーは自分のパッケージのみ参照可能
CREATE POLICY "Users can view own packages" ON user_packages
    FOR SELECT USING (auth.uid() = user_id);

-- 管理者のみ挿入・更新・削除可能（実際の権限管理は別途実装）
CREATE POLICY "Admins can manage packages" ON user_packages
    FOR ALL USING (true); -- 実際の管理者権限チェックはアプリケーション層で実装

-- 自動更新トリガー
CREATE OR REPLACE FUNCTION update_user_packages_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_user_packages_updated_at
    BEFORE UPDATE ON user_packages
    FOR EACH ROW
    EXECUTE FUNCTION update_user_packages_updated_at();

-- コメント
COMMENT ON TABLE user_packages IS 'ユーザー専用パッケージファイル管理テーブル';
COMMENT ON COLUMN user_packages.file_content IS 'Base64エンコードされたファイル内容';
COMMENT ON COLUMN user_packages.uploaded_by IS 'アップロードした管理者名';
COMMENT ON COLUMN user_packages.download_count IS 'ダウンロード回数';