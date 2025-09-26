-- is_activeエラーを修正するSQL
-- Supabase Dashboard > SQL Editorで実行してください

-- 1. まずplansテーブルにis_activeカラムがあるか確認し、なければ追加
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'plans'
        AND column_name = 'is_active'
    ) THEN
        ALTER TABLE plans ADD COLUMN is_active BOOLEAN DEFAULT TRUE;
        COMMENT ON COLUMN plans.is_active IS 'Whether the plan is available for new subscriptions';
    END IF;
END $$;

-- 2. queue_ate_generation関数を削除（存在する場合）
DROP FUNCTION IF EXISTS queue_ate_generation(TEXT, TEXT, INTEGER);
DROP FUNCTION IF EXISTS queue_ate_generation(TEXT, TEXT);
DROP FUNCTION IF EXISTS queue_ate_generation(TEXT);

-- 3. シンプルなバージョンの関数を作成（ate_templatesテーブルへの参照なし）
CREATE OR REPLACE FUNCTION queue_ate_generation(
    device_hash_param TEXT,
    template_name_param TEXT DEFAULT 'smartgram',
    priority_param INTEGER DEFAULT 5
) RETURNS UUID AS $$
DECLARE
    device_record RECORD;
    plan_record RECORD;
    queue_id UUID;
    mapped_plan_name TEXT;
BEGIN
    -- Get device info
    SELECT d.id, d.user_id,
           COALESCE(s.plan_id, 'starter') as plan_id
    INTO device_record
    FROM devices d
    LEFT JOIN subscriptions s ON d.id = s.device_id
    WHERE d.device_hash = device_hash_param
    AND d.status IN ('trial', 'active');

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Device not found or inactive: %', device_hash_param;
    END IF;

    -- Map legacy plan names to new names
    mapped_plan_name := CASE
        WHEN device_record.plan_id = 'smartgram_monthly_2980' THEN 'starter'
        WHEN device_record.plan_id = 'smartgram_monthly_8800' THEN 'pro'
        WHEN device_record.plan_id = 'smartgram_monthly_15000' THEN 'max'
        WHEN device_record.plan_id IS NULL THEN 'starter'
        ELSE COALESCE(device_record.plan_id, 'starter')
    END;

    -- Get plan info (with is_active check only if column exists)
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'plans'
        AND column_name = 'is_active'
    ) THEN
        EXECUTE format('
            SELECT * FROM plans
            WHERE name = %L
            AND is_active = true
            LIMIT 1',
            mapped_plan_name
        ) INTO plan_record;
    ELSE
        SELECT * INTO plan_record
        FROM plans
        WHERE name = mapped_plan_name
        LIMIT 1;
    END IF;

    IF NOT FOUND THEN
        -- Try starter as fallback
        IF EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
            AND table_name = 'plans'
            AND column_name = 'is_active'
        ) THEN
            EXECUTE format('
                SELECT * FROM plans
                WHERE name = %L
                AND is_active = true
                LIMIT 1',
                'starter'
            ) INTO plan_record;
        ELSE
            SELECT * INTO plan_record
            FROM plans
            WHERE name = 'starter'
            LIMIT 1;
        END IF;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Plan not found: % (mapped to: %)', device_record.plan_id, mapped_plan_name;
        END IF;
    END IF;

    -- Create a simple queue entry (assuming file_generation_queue doesn't exist, just return a UUID)
    queue_id := gen_random_uuid();

    -- If file_generation_queue table exists, insert into it
    IF EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'file_generation_queue'
    ) THEN
        EXECUTE format('
            INSERT INTO file_generation_queue (
                id, device_id, user_id, status, priority, created_at
            ) VALUES (
                %L, %L, %L, %L, %L, NOW()
            )',
            queue_id,
            device_record.id,
            device_record.user_id,
            'pending',
            priority_param
        );
    END IF;

    RETURN queue_id;
END;
$$ LANGUAGE plpgsql;

-- 4. 既存のplansデータを確認して修正
UPDATE plans
SET is_active = TRUE
WHERE is_active IS NULL;

-- 5. guidesテーブルを作成（存在しない場合）
CREATE TABLE IF NOT EXISTS guides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  youtube_url TEXT,
  video_id TEXT,
  content TEXT,
  category TEXT,
  order_index INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- 6. guidesテーブルのインデックスを作成
CREATE INDEX IF NOT EXISTS guides_is_active_idx ON guides(is_active);
CREATE INDEX IF NOT EXISTS guides_category_idx ON guides(category);
CREATE INDEX IF NOT EXISTS guides_order_idx ON guides(order_index);

-- 7. RLSを有効化
ALTER TABLE guides ENABLE ROW LEVEL SECURITY;

-- 8. ポリシーを作成（既存のものは削除）
DROP POLICY IF EXISTS "Guides are viewable by everyone" ON guides;
DROP POLICY IF EXISTS "Guides are manageable by admins" ON guides;

CREATE POLICY "Guides are viewable by everyone" ON guides
  FOR SELECT
  USING (is_active = true);

CREATE POLICY "Guides are manageable by admins" ON guides
  FOR ALL
  USING (
    auth.jwt()->>'email' = 'akihiro.tnk@gmail.com' OR
    auth.jwt()->>'role' = 'admin'
  );

-- 9. updated_atトリガーを作成
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_guides_updated_at ON guides;
CREATE TRIGGER update_guides_updated_at
  BEFORE UPDATE ON guides
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 10. サンプルデータを挿入
INSERT INTO guides (title, description, category, order_index, content)
VALUES
  ('はじめに - SmartGramの基本設定', 'SmartGramの初期設定方法を説明します', 'beginner', 1, E'# SmartGramへようこそ\n\nこのガイドでは基本的な設定方法を説明します。'),
  ('AutoTouchのインストール方法', 'iPhoneにAutoTouchをインストールする手順', 'beginner', 2, E'# AutoTouchのインストール\n\n1. Cydia/Sileoを開く\n2. AutoTouchを検索\n3. インストール'),
  ('スクリプトの使い方', 'スクリプトの基本的な使い方を解説', 'beginner', 3, E'# スクリプトの使い方\n\n詳細な使用方法を説明します。')
ON CONFLICT DO NOTHING;

-- 11. 結果を確認
SELECT 'Fixes applied successfully!' as status;
SELECT COUNT(*) as guides_count FROM guides;
SELECT name, is_active FROM plans LIMIT 5;