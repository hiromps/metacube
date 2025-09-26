-- ガイドテーブルの作成
-- このSQLをSupabase Dashboard > SQL Editorで実行してください

-- 既存のテーブルがある場合は削除（必要に応じてコメントアウト）
-- DROP TABLE IF EXISTS guides CASCADE;

-- ガイドテーブルの作成
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

-- インデックス作成
CREATE INDEX IF NOT EXISTS guides_is_active_idx ON guides(is_active);
CREATE INDEX IF NOT EXISTS guides_category_idx ON guides(category);
CREATE INDEX IF NOT EXISTS guides_order_idx ON guides(order_index);

-- RLS (Row Level Security) を有効化
ALTER TABLE guides ENABLE ROW LEVEL SECURITY;

-- 既存のポリシーを削除（エラーを避けるため）
DROP POLICY IF EXISTS "Guides are viewable by everyone" ON guides;
DROP POLICY IF EXISTS "Guides are manageable by admins" ON guides;

-- 新しいポリシーを作成
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

-- updated_atを自動更新する関数（既存の場合は上書き）
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- トリガー削除と再作成
DROP TRIGGER IF EXISTS update_guides_updated_at ON guides;
CREATE TRIGGER update_guides_updated_at
  BEFORE UPDATE ON guides
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- サンプルデータを挿入
INSERT INTO guides (title, description, category, order_index, content)
VALUES
  ('はじめに - SmartGramの基本設定', 'SmartGramの初期設定方法を説明します', 'beginner', 1, E'# SmartGramへようこそ\n\nこのガイドでは基本的な設定方法を説明します。'),
  ('AutoTouchのインストール方法', 'iPhoneにAutoTouchをインストールする手順', 'beginner', 2, E'# AutoTouchのインストール\n\n1. Cydia/Sileoを開く\n2. AutoTouchを検索\n3. インストール'),
  ('スクリプトの使い方', 'スクリプトの基本的な使い方を解説', 'beginner', 3, E'# スクリプトの使い方\n\n詳細な使用方法を説明します。')
ON CONFLICT DO NOTHING;

-- テーブルが正しく作成されたか確認
SELECT COUNT(*) as guide_count FROM guides;