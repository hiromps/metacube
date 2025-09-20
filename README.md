# SocialTouch License Management System

iPhone 7/8デバイス専用のInstagramオートメーションツール用ライセンス管理システム

## 🚀 機能

- **デバイス認証**: iPhone 7/8デバイス専用ライセンス
- **無料体験**: 3日間の無料トライアル
- **サブスクリプション**: PayPal月額課金（¥2,980）
- **AutoTouch統合**: Luaスクリプトでのライセンス検証
- **リアルタイム管理**: Webhook自動更新
- **ユーザーダッシュボード**: サブスクリプション管理

## 🛠 技術スタック

- **Frontend**: Next.js 14 (App Router)
- **Database**: Supabase (PostgreSQL + Auth)
- **Payment**: PayPal Subscriptions API
- **Hosting**: Cloudflare Pages
- **Automation**: AutoTouch (Lua)

## 📁 プロジェクト構造

```
autolicense/
├── app/                      # Next.js App Router
│   ├── api/                  # API Routes
│   │   ├── device/register/  # デバイス登録
│   │   ├── license/verify/   # ライセンス検証
│   │   └── paypal/          # PayPal関連API
│   ├── dashboard/           # ユーザーダッシュボード
│   ├── login/              # ログインページ
│   └── register/           # 登録ページ
├── components/             # Reactコンポーネント
├── lib/                   # ユーティリティ
│   ├── auth/             # 認証関連
│   ├── paypal/           # PayPal統合
│   └── supabase/         # Supabase設定
├── lua/                  # AutoTouch Luaスクリプト
└── supabase/            # データベーススキーマ
```

## 🚀 デプロイ

### Cloudflare Pages

詳細な手順は [CLOUDFLARE_DEPLOY.md](./CLOUDFLARE_DEPLOY.md) を参照

```bash
# 1. リポジトリをGitHubにプッシュ
git push origin main

# 2. Cloudflare Pagesでプロジェクト作成
# 3. 環境変数を設定
# 4. 自動デプロイ開始
```

### 環境変数

本番環境用のテンプレートは [.env.production.example](./.env.production.example) を参照

## 🔧 開発

### セットアップ

```bash
# 依存関係インストール
npm install

# 環境変数設定
cp .env.local.example .env.local
# .env.local を編集

# 開発サーバー起動
npm run dev
```

### データベース

```bash
# Supabaseマイグレーション
npx supabase migration up

# または直接実行
npx supabase db reset
```

### PayPal設定

```bash
# サンドボックス環境でプラン作成
node test-paypal-setup.js
```

## 📱 AutoTouch統合

### Luaスクリプト使用例

```lua
-- SocialTouchメインスクリプト
local auth = require("lua/main_v2")

-- ライセンス認証
if auth.authenticate() then
    -- ツール実行
    runInstagramAutomation()
else
    -- 認証失敗処理
    showTrialExpiredDialog()
end
```

## 🔒 セキュリティ

- Row Level Security (RLS) 有効
- PayPal Webhook署名検証
- レート制限実装
- HTTPS強制
- セキュリティヘッダー設定

## 📊 監視

### Cloudflare Analytics
- ページビュー
- パフォーマンス指標
- エラー率

### Supabase Insights
- データベース使用量
- API呼び出し数
- 認証ログ

### PayPal Dashboard
- トランザクション履歴
- Webhook配信状況
- 返金・チャージバック

## 🧪 テスト

```bash
# 全体テスト
npm test

# PayPal統合テスト
node test-paypal-payment.js

# Webhookテスト
node test-webhook.js
```

## 📝 API仕様

### デバイス登録
```
POST /api/device/register
Content-Type: application/json

{
  "device_hash": "16文字のhex",
  "email": "user@example.com",
  "password": "password123"
}
```

### ライセンス検証
```
POST /api/license/verify
Content-Type: application/json

{
  "device_hash": "16文字のhex"
}
```

## 🔄 ワークフロー

### ユーザー登録フロー
1. デバイスハッシュ生成
2. ユーザー登録（3日間体験版付与）
3. PayPal決済（月額サブスクリプション）
4. Webhook処理（サブスクリプション有効化）

### ライセンス検証フロー
1. AutoTouchからAPI呼び出し
2. デバイスハッシュ照合
3. ライセンス状態確認
4. 結果返却（24時間キャッシュ）

## 🆘 トラブルシューティング

### よくある問題

#### ビルドエラー
```bash
npm run build  # ローカルテスト
npm install --legacy-peer-deps  # 依存関係修正
```

#### 認証エラー
- Supabase RLS設定確認
- 環境変数設定確認

#### PayPal接続エラー
- Webhook URL確認（HTTPS必須）
- 本番/サンドボックス設定確認

## 📞 サポート

- **開発者**: support@socialtouch.app
- **ドキュメント**: [CLOUDFLARE_DEPLOY.md](./CLOUDFLARE_DEPLOY.md)
- **課金サポート**: PayPal決済履歴から問い合わせ

## 📄 ライセンス

Private - SocialTouch Project

---

## 📅 デプロイメント履歴

### v0.1.1 - 2025-09-20
- Cloudflare Pages最新デプロイメント
- パフォーマンス最適化
- セキュリティ強化

### v0.1.0 - 初回リリース
- 基本ライセンス管理機能
- PayPal決済統合
- AutoTouch Lua統合

---

**注意**: このシステムはiPhone 7/8デバイス専用です。他のデバイスでは動作しません。
