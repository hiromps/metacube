-- ガイドテーブルの作成（修正版）
CREATE TABLE IF NOT EXISTS guides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  youtube_url TEXT,
  video_id TEXT, -- YouTube video ID for embedding
  content TEXT, -- マークダウンコンテンツ
  category TEXT, -- 'beginner', 'advanced', 'troubleshooting', etc.
  order_index INTEGER DEFAULT 0, -- 表示順序
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- インデックス作成
CREATE INDEX IF NOT EXISTS guides_is_active_idx ON guides(is_active);
CREATE INDEX IF NOT EXISTS guides_category_idx ON guides(category);
CREATE INDEX IF NOT EXISTS guides_order_idx ON guides(order_index);

-- RLS (Row Level Security) を有効化
ALTER TABLE guides ENABLE ROW LEVEL SECURITY;

-- ポリシー作成
-- 誰でも読み取り可能（アクティブなガイドのみ）
CREATE POLICY "Guides are viewable by everyone" ON guides
  FOR SELECT
  USING (is_active = true);

-- 管理者のみ作成・更新・削除可能
CREATE POLICY "Guides are manageable by admins" ON guides
  FOR ALL
  USING (
    auth.jwt()->>'email' = 'akihiro.tnk@gmail.com' OR
    auth.jwt()->>'role' = 'admin'
  );

-- updated_atを自動更新するトリガー（存在しない場合のみ作成）
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- トリガー作成（既存の場合はスキップ）
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'update_guides_updated_at'
    AND tgrelid = 'guides'::regclass
  ) THEN
    CREATE TRIGGER update_guides_updated_at
    BEFORE UPDATE ON guides
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
  END IF;
END;
$$;

-- サンプルデータを挿入（存在しない場合のみ）
INSERT INTO guides (title, description, category, order_index, content)
SELECT * FROM (VALUES
  ('はじめに - SmartGramの基本設定', 'SmartGramの初期設定方法を説明します', 'beginner', 1, '# SmartGramへようこそ\n\nこのガイドでは基本的な設定方法を説明します。'),
  ('AutoTouchのインストール方法', 'iPhoneにAutoTouchをインストールする手順', 'beginner', 2, '# AutoTouchのインストール\n\n1. Cydia/Sileoを開く\n2. AutoTouchを検索\n3. インストール'),
  ('スクリプトの使い方', 'スクリプトの基本的な使い方を解説', 'beginner', 3, '# スクリプトの使い方\n\n詳細な使用方法を説明します。')
) AS v(title, description, category, order_index, content)
WHERE NOT EXISTS (
  SELECT 1 FROM guides WHERE title = v.title
);