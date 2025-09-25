# Stripe設定ガイド

## 1. Stripe Dashboardで商品作成

### STARTERプラン
- **商品名**: SMARTGRAM STARTER
- **価格**: ¥2,980
- **請求**: 月次
- **価格ID**: `price_xxxxx_starter_monthly`

### PROプラン
- **商品名**: SMARTGRAM PRO
- **価格**: ¥8,800
- **請求**: 月次
- **価格ID**: `price_xxxxx_pro_monthly`

### MAXプラン
- **商品名**: SMARTGRAM MAX
- **価格**: ¥15,000
- **請求**: 月次
- **価格ID**: `price_xxxxx_max_monthly`

## 2. Webhook設定

**Stripe Dashboard → Webhooks → Add endpoint**

- **URL**: `https://smartgram.jp/api/stripe/webhook`
- **Events to send**:
  - `checkout.session.completed`
  - `customer.subscription.created`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
  - `invoice.payment_succeeded`
  - `invoice.payment_failed`

## 3. 環境変数設定

**Cloudflare Dashboard → Pages → smartgram → Settings → Environment variables**

### 本番環境
```
STRIPE_SECRET_KEY=sk_live_xxxxxxxxxx
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_xxxxxxxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxx
```

### テスト環境
```
STRIPE_SECRET_KEY=sk_test_xxxxxxxxxx
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_xxxxxxxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxx
```

## 4. 価格ID更新

**ファイル**: `functions/api/stripe/create-checkout-session.ts`

```typescript
const STRIPE_PRICE_IDS = {
  'price_starter_monthly': 'price_xxxxxxxxxx_starter', // 実際の価格IDに更新
  'price_pro_monthly': 'price_xxxxxxxxxx_pro',         // 実際の価格IDに更新
  'price_max_monthly': 'price_xxxxxxxxxx_max'          // 実際の価格IDに更新
};
```

## 5. テスト手順

### 1. テストカード使用
```
カード番号: 4242 4242 4242 4242
期限: 任意の未来の日付
CVC: 任意の3桁
```

### 2. 決済フロー確認
1. ダッシュボードでプラン選択
2. Stripe Checkoutページ表示
3. テストカード入力
4. 決済完了後ダッシュボードに戻る
5. サブスクリプション状態確認

### 3. Webhook確認
1. Stripe Dashboard → Webhooks → 該当Endpoint
2. Recent events で処理状況確認
3. Supabase subscriptionsテーブル確認

## 6. 本番環境移行

1. テスト環境で十分にテスト
2. Stripeアカウントを本番モードに切り替え
3. 本番用API キーに更新
4. Cloudflare環境変数を本番用に更新
5. 実際のカードで最終テスト

## 7. サポートするカード

- Visa
- Mastercard
- American Express
- JCB
- Diners Club
- Discover

## 8. 返金・キャンセル処理

- **即時キャンセル**: Stripe Dashboardから可能
- **返金**: 部分返金・全額返金対応
- **自動キャンセル**: ユーザーが自分でキャンセル可能（実装済み）

## トラブルシューティング

### よくあるエラー

1. **Invalid price ID**: 価格IDが正しくない
2. **Webhook signature mismatch**: Webhook秘密鍵が間違っている
3. **Insufficient permissions**: APIキーの権限不足

### デバッグ

1. Cloudflare Functions ログ確認
2. Stripe Dashboard → Logs確認
3. Supabaseテーブル状態確認
4. ブラウザ開発者ツール Network タブ確認