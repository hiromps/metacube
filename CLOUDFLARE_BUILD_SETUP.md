# Cloudflare Pages ビルド設定

## Cloudflare Pages ダッシュボード設定

### ビルド設定

**Build command:**
```bash
npx @cloudflare/next-on-pages
```

**Build output directory:**
```
.vercel/output/static
```

**Root directory (optional):**
```
(空白のまま)
```

### 環境変数

以下の環境変数をCloudflare Pagesダッシュボードで設定してください：

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# PayPal
PAYPAL_CLIENT_ID=your_paypal_client_id
PAYPAL_CLIENT_SECRET=your_paypal_client_secret
NEXT_PUBLIC_PAYPAL_PLAN_ID=your_paypal_plan_id
PAYPAL_WEBHOOK_ID=your_webhook_id
PAYPAL_WEBHOOK_SECRET=your_webhook_secret

# App Configuration
NEXT_PUBLIC_APP_URL=https://your-domain.pages.dev
JWT_SECRET=your_jwt_secret_key
```

### Node.js バージョン

**Node.js version:**
```
20
```

### 注意事項

1. `npx @cloudflare/next-on-pages` コマンドで以下が実行されます：
   - 内部的に `next build` を実行
   - Cloudflare Pages用の変換を実行
   - `.vercel/output/static` に出力

2. 出力ディレクトリ `.vercel/output/static` にAPIルートも含まれます

3. 初回デプロイ後、カスタムドメインを設定する場合は `NEXT_PUBLIC_APP_URL` を更新してください

## トラブルシューティング

### ビルドエラーが発生する場合

1. **Node.js バージョン確認**: 20.x を使用
2. **依存関係の問題**: `npm install` でパッケージ再インストール
3. **環境変数**: すべての必須環境変数が設定されているか確認

### デプロイ後にAPIが動作しない場合

1. **環境変数**: Cloudflare Pagesダッシュボードで環境変数が正しく設定されているか確認
2. **ドメイン設定**: `NEXT_PUBLIC_APP_URL` が正しいドメインに設定されているか確認
3. **PayPal Webhook**: Webhook URLがCloudflare PagesのドメインHOGE指している確認

## 手動デプロイ

ローカルから手動でデプロイする場合：

```bash
# 1. ビルド
npx @cloudflare/next-on-pages

# 2. デプロイ
npx wrangler pages deploy .vercel/output/static --project-name socialtouch-license
```