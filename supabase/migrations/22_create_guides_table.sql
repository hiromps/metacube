-- Create guides table for dynamic content management
CREATE TABLE IF NOT EXISTS public.guides (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    description TEXT,
    content TEXT NOT NULL,
    requires_access BOOLEAN DEFAULT false,
    sort_order INTEGER DEFAULT 0,
    is_published BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    created_by UUID REFERENCES auth.users(id),
    updated_by UUID REFERENCES auth.users(id)
);

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_guides_slug ON public.guides(slug);
CREATE INDEX IF NOT EXISTS idx_guides_sort_order ON public.guides(sort_order);
CREATE INDEX IF NOT EXISTS idx_guides_published ON public.guides(is_published);

-- Insert default guides content
INSERT INTO public.guides (title, slug, description, content, requires_access, sort_order) VALUES
(
    '概要とシステム要件',
    'overview',
    'SMARTGRAMの基本情報と必要環境',
    '# SMARTGRAM 概要

SMARTGRAMは、iPhone 7/8専用のInstagram自動化ツールです。

## 必要環境
- iPhone 7/8（必須）
- iOS 15.x推奨
- Jailbreak環境
- AutoTouch（有料アプリ）
- 安定したインターネット接続

## 機能
- タイムライン自動スクロール
- 自動いいね
- フォロー/アンフォロー管理
- エンゲージメント分析

## 注意事項
- Instagramの利用規約をご確認ください
- 過度な使用はアカウント制限の原因となります
- 1日の操作回数には制限を設けてください',
    false,
    1
),
(
    'Jailbreak手順',
    'jailbreak',
    'iPhone 7/8のJailbreak詳細ガイド',
    '# iPhone 7/8 Jailbreak完全ガイド

## 対応ツール

### iOS 14.0 - 14.8.1
**checkra1n（推奨）**
1. checkra1n公式サイトからダウンロード
2. iPhoneをDFUモードで起動
3. checkra1nを実行
4. 画面の指示に従って進行

### iOS 15.0 - 15.7.1
**palera1n**
1. macOS/Linux環境を準備
2. palera1nをダウンロード
3. ターミナルから実行
4. rootless/rootful選択

## DFUモード進入方法

### iPhone 7
1. 電源ボタン + 音量下げボタンを10秒長押し
2. 電源ボタンを離し、音量下げボタンをさらに5秒
3. 画面が真っ黒のままならDFUモード成功

### iPhone 8
1. 音量上げボタンを押して離す
2. 音量下げボタンを押して離す
3. サイドボタンを10秒長押し
4. サイドボタンを押したまま音量下げボタンを5秒
5. サイドボタンを離し、音量下げボタンをさらに10秒

## Cydia/Sileo設定
1. リポジトリ追加
2. 必要なTweaksインストール
3. AutoTouchリポジトリ追加

## トラブルシューティング
- ブートループ: セーフモードで起動
- Cydiaクラッシュ: リフレッシュ実行
- リスプリング: UserSpace Reboot',
    true,
    2
),
(
    'AutoTouch導入',
    'autotouch',
    'AutoTouchのインストールと初期設定',
    '# AutoTouch インストールガイド

## 購入とインストール

### 1. ライセンス購入
- AutoTouch公式サイトでライセンス購入（$4.99）
- デバイスUDID登録
- アクティベーションキー受信

### 2. Cydiaからインストール
```
リポジトリURL: https://apt.autotouch.net/
パッケージ名: AutoTouch
```

### 3. アクティベーション
1. AutoTouchアプリを開く
2. Settings → License
3. アクティベーションキー入力

## 初期設定

### 基本設定
- Recording Quality: High
- Play Speed: 1.0x
- Coordinate System: Absolute
- Allow Remote Access: OFF（セキュリティ）

### スクリプトフォルダ
```
/var/mobile/Library/AutoTouch/Scripts/
```

### smartgram.ate配置
1. PCからiFunBoxやFilzaを使用
2. Scriptsフォルダにsmartgram.ate転送
3. 権限設定: 755

## 動作確認
1. AutoTouchアプリでScripts確認
2. smartgram.ate選択
3. Playボタンで実行
4. デバイスハッシュ表示確認

## よくある問題
- スクリプトが見えない: 権限確認
- 実行エラー: Lua構文確認
- タッチが効かない: Accessibility設定',
    true,
    3
),
(
    'スクリプト設定',
    'scripts',
    'smartgram.ateとツールスクリプトの設定',
    '# スクリプト設定ガイド

## ファイル構成
```
/var/mobile/Library/AutoTouch/Scripts/
├── smartgram.ate     # メインメニュー
├── timeline.lua      # タイムラインツール
├── like.lua         # いいねツール
├── follow.lua       # フォローツール
└── config.lua       # 設定ファイル
```

## smartgram.ate設定

### デバイスハッシュ取得
初回実行時に自動表示されます：
1. AutoTouchでsmartgram.ate実行
2. デバイスハッシュをメモ
3. Webサイトで登録

### ライセンス認証設定
```lua
-- config.lua内
LICENSE_SERVER = "https://smartgram.jp/api"
CACHE_DURATION = 86400  -- 24時間
```

## 各ツール設定

### timeline.lua
- スクロール速度: 調整可能
- いいね頻度: 3-5投稿に1回
- 休憩時間: 30分ごと

### like.lua
- 1日の上限: 200いいね
- 間隔: 15-30秒ランダム
- ハッシュタグ指定可能

### follow.lua
- 1日の上限: 50フォロー
- アンフォロー: 3日後
- ターゲット設定可能

## セキュリティ設定

### API通信
- HTTPS必須
- デバイスハッシュ暗号化
- キャッシュ期限管理

### Instagram対策
- ランダム遅延
- 人間らしい動作パターン
- 1日の操作制限

## デバッグ方法
1. AutoTouchコンソール確認
2. エラーログ: /var/mobile/Library/AutoTouch/Log/
3. alert()関数でデバッグ出力',
    true,
    4
),
(
    'アクティベーション',
    'activation',
    '体験期間の開始方法',
    '# アクティベーション手順

## セットアップ完了後の手順

### 1. デバイスハッシュ確認
1. AutoTouchでsmartgram.ate実行
2. 表示されるデバイスハッシュをコピー
3. 形式例: F2LXJ7XXHG7F

### 2. Webダッシュボード
1. https://smartgram.jp/dashboard にログイン
2. セットアップ期間中であることを確認
3. 「体験期間をアクティベート」セクションへ

### 3. アクティベート実行
1. デバイスハッシュを入力
2. 「体験期間を開始する」ボタンクリック
3. 確認ダイアログで「はい」選択

## アクティベート後

### 体験期間（3日間）
- 全機能利用可能
- 制限なし
- 自動更新設定済み

### 期間終了後
- 自動的に有料会員へ移行
- PayPal自動課金開始
- サービス継続利用可能

## 注意事項
- アクティベートは1回のみ
- 取り消し不可
- セットアップ期限内に実行必要

## トラブルシューティング

### デバイスハッシュが表示されない
- AutoTouch再インストール
- smartgram.ate権限確認
- iPhoneを再起動

### アクティベート失敗
- デバイスハッシュ確認
- ネットワーク接続確認
- セットアップ期限確認

### 体験期間が始まらない
- ダッシュボード更新
- ブラウザキャッシュクリア
- サポート連絡',
    true,
    5
);

-- Enable RLS
ALTER TABLE public.guides ENABLE ROW LEVEL SECURITY;

-- Create policy for public read access to published guides
CREATE POLICY "Public can read published guides" ON public.guides
    FOR SELECT USING (is_published = true);

-- Create policy for admin full access
CREATE POLICY "Admins can manage guides" ON public.guides
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM auth.users
            WHERE auth.users.id = auth.uid()
            AND auth.users.raw_app_meta_data->>'role' = 'admin'
        )
    );

-- Create function to automatically update updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ language plpgsql;

-- Create trigger for guides table
CREATE TRIGGER update_guides_updated_at
    BEFORE UPDATE ON public.guides
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();