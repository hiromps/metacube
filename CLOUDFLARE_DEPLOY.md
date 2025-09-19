# Cloudflare Pages デプロイガイド

## SocialTouch License Management System

このガイドではNext.jsアプリケーションをCloudflare Pagesにデプロイする手順を説明します。

## 前提条件

- Cloudflareアカウント
- GitHubリポジトリ（このプロジェクトをpush済み）
- Supabaseプロジェクト（本番用）
- PayPal本番アカウント

## 1. GitHubにプッシュ

```bash
git add .
git commit -m "Prepare for Cloudflare Pages deployment"
git push origin main
```

## 2. Cloudflare Pagesセットアップ

### 2.1 Cloudflare Dashboardにログイン
1. https://dash.cloudflare.com/ にアクセス
2. "Pages" セクションに移動
3. "Create a project" をクリック

### 2.2 リポジトリ接続
1. "Connect to Git" を選択
2. GitHubアカウントを連携
3. このプロジェクトのリポジトリを選択

### 2.3 ビルド設定
```
Framework preset: Next.js
Build command: npm run build
Build output directory: .next
Root directory: (空白のまま)
```

## 3. 環境変数設定

Cloudflare Pages設定画面で以下の環境変数を追加：

### 3.1 Supabase設定
```
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY
```

### 3.2 PayPal設定（本番環境）
```
PAYPAL_CLIENT_ID=YOUR_PRODUCTION_CLIENT_ID
PAYPAL_CLIENT_SECRET=YOUR_PRODUCTION_CLIENT_SECRET
NEXT_PUBLIC_PAYPAL_PLAN_ID=YOUR_PRODUCTION_PLAN_ID
PAYPAL_WEBHOOK_ID=YOUR_WEBHOOK_ID
PAYPAL_WEBHOOK_SECRET=YOUR_WEBHOOK_SECRET
```

### 3.3 アプリケーション設定
```
NEXT_PUBLIC_APP_URL=https://yourapp.pages.dev
NODE_ENV=production
```

## 4. 本番PayPal設定

### 4.1 PayPal Developer Console
1. https://developer.paypal.com/ にアクセス
2. 本番環境用アプリケーションを作成
3. プロダクトとサブスクリプションプランを作成

### 4.2 プロダクト作成（本番環境）
```javascript
// 本番環境でtest-paypal-setup.jsを実行
// PAYPAL_BASE_URL を https://api.paypal.com に変更
// 本番クライアントID/シークレットを使用
```

### 4.3 Webhook設定
```
Webhook URL: https://yourapp.pages.dev/api/paypal/webhook
Event types:
- BILLING.SUBSCRIPTION.ACTIVATED
- BILLING.SUBSCRIPTION.CANCELLED
- BILLING.SUBSCRIPTION.EXPIRED
- PAYMENT.SALE.COMPLETED
- PAYMENT.SALE.REFUNDED
```

## 5. カスタムドメイン設定（オプション）

### 5.1 ドメイン追加
1. Cloudflare Pages設定で "Custom domains" に移動
2. "Set up a custom domain" をクリック
3. ドメイン名を入力（例：socialtouch.app）

### 5.2 DNS設定
```
Type: CNAME
Name: @ (またはサブドメイン)
Target: yourapp.pages.dev
```

## 6. SSL/TLS設定

Cloudflareで以下を設定：
1. SSL/TLS暗号化モードを "Full (strict)" に設定
2. "Always Use HTTPS" を有効化
3. "Automatic HTTPS Rewrites" を有効化

## 7. デプロイとテスト

### 7.1 自動デプロイ
- GitHubにプッシュすると自動的にデプロイされます
- "Deployments" タブでステータス確認

### 7.2 テスト項目
- [ ] ホームページの表示
- [ ] ユーザー登録機能
- [ ] ログイン機能
- [ ] ダッシュボード表示
- [ ] PayPal決済フロー
- [ ] ライセンス検証API
- [ ] Webhook処理

## 8. 監視と運用

### 8.1 Cloudflare Analytics
- ページビュー数
- パフォーマンス指標
- エラー率

### 8.2 Supabase監視
- データベースパフォーマンス
- API使用量
- 認証ログ

### 8.3 PayPal監視
- トランザクション履歴
- Webhook配信ログ
- 返金・チャージバック

## トラブルシューティング

### よくある問題

#### 1. ビルドエラー
```bash
# ローカルでビルドテスト
npm run build

# 依存関係の問題
npm install --legacy-peer-deps
```

#### 2. 環境変数エラー
- Cloudflare Pages設定画面で値を再確認
- 本番/プレビュー環境の設定を分ける

#### 3. PayPal接続エラー
- 本番環境URLが正しいか確認
- Webhook URLのHTTPS確認

#### 4. Supabase接続エラー
- RLS（Row Level Security）ポリシー確認
- サービスロールキーの権限確認

## セキュリティチェックリスト

- [ ] 環境変数にシークレット情報を適切に設定
- [ ] PayPal Webhook署名検証を有効化
- [ ] Supabase RLSポリシーが正しく設定
- [ ] HTTPS強制リダイレクト設定
- [ ] セキュリティヘッダー設定
- [ ] Rate limiting設定（推奨）

## パフォーマンス最適化

- [ ] Cloudflare CDNキャッシュ設定
- [ ] 画像最適化設定
- [ ] Gzip圧縮有効化
- [ ] ミニフィケーション有効化

---

## サポート

デプロイ中に問題が発生した場合：
1. Cloudflare Pages "Functions" ログを確認
2. Supabase "Logs & Insights" を確認
3. PayPal Developer Console "Webhook Delivery" を確認