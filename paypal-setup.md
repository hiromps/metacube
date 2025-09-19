# PayPal統合セットアップガイド

## 🔧 PayPal開発者アカウント設定

### 1. PayPal Developer Dashboard
1. [PayPal Developer](https://developer.paypal.com/) にアクセス
2. サンドボックスアカウントでログイン
3. 新しいアプリケーションを作成

### 2. アプリケーション設定
```
Application Name: SocialTouch MVP
Merchant: Business (for subscriptions)
Features: Accept payments, Subscriptions
```

### 3. 必要な認証情報
PayPal Dashboardから以下の情報を取得：

```env
# PayPal Configuration
NEXT_PUBLIC_PAYPAL_CLIENT_ID=your-sandbox-client-id
PAYPAL_CLIENT_SECRET=your-sandbox-client-secret
PAYPAL_WEBHOOK_ID=your-webhook-id
PAYPAL_WEBHOOK_SECRET=your-webhook-secret
```

## 📋 サブスクリプションプラン作成

### 1. PayPal API でプラン作成

```bash
# アクセストークン取得
curl -v POST https://api.sandbox.paypal.com/v1/oauth2/token \
  -H "Accept: application/json" \
  -H "Accept-Language: en_US" \
  -u "client-id:client-secret" \
  -d "grant_type=client_credentials"

# プロダクト作成
curl -v POST https://api.sandbox.paypal.com/v1/catalogs/products \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer access-token" \
  -d '{
    "id": "socialtouch-basic",
    "name": "SocialTouch Basic Plan",
    "description": "Instagram automation tool for iPhone 7/8",
    "type": "SERVICE",
    "category": "SOFTWARE"
  }'

# サブスクリプションプラン作成
curl -v POST https://api.sandbox.paypal.com/v1/billing/plans \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer access-token" \
  -d '{
    "product_id": "socialtouch-basic",
    "name": "SocialTouch Monthly Basic",
    "description": "Monthly subscription for SocialTouch",
    "status": "ACTIVE",
    "billing_cycles": [
      {
        "frequency": {
          "interval_unit": "MONTH",
          "interval_count": 1
        },
        "tenure_type": "REGULAR",
        "sequence": 1,
        "total_cycles": 0,
        "pricing_scheme": {
          "fixed_price": {
            "value": "2980",
            "currency_code": "JPY"
          }
        }
      }
    ],
    "payment_preferences": {
      "auto_bill_outstanding": true,
      "setup_fee": {
        "value": "0",
        "currency_code": "JPY"
      },
      "setup_fee_failure_action": "CONTINUE",
      "payment_failure_threshold": 3
    }
  }'
```

## 🌐 Webhook設定

### 1. Webhook URL
```
https://your-domain.com/api/paypal/webhook
```

### 2. 監視イベント
以下のイベントを選択：
- `BILLING.SUBSCRIPTION.CREATED`
- `BILLING.SUBSCRIPTION.ACTIVATED`
- `BILLING.SUBSCRIPTION.CANCELLED`
- `BILLING.SUBSCRIPTION.EXPIRED`
- `BILLING.SUBSCRIPTION.SUSPENDED`
- `PAYMENT.SALE.COMPLETED`
- `PAYMENT.SALE.REFUNDED`

## 🧪 テスト手順

### 1. 環境変数設定
`.env.local` に PayPal 認証情報を追加：

```env
# 追加
NEXT_PUBLIC_PAYPAL_CLIENT_ID=your-sandbox-client-id
PAYPAL_CLIENT_SECRET=your-sandbox-client-secret
PAYPAL_WEBHOOK_ID=your-webhook-id
PAYPAL_WEBHOOK_SECRET=your-webhook-secret
```

### 2. テスト用PayPalアカウント
PayPal Sandbox で以下のテストアカウントを作成：

**Personal Account (買い手)**
```
Email: buyer-test@example.com
Password: test123456
Balance: $1000 USD / ¥100,000 JPY
```

**Business Account (売り手)**
```
Email: seller-test@example.com
Password: test123456
```

### 3. 決済フローテスト

#### Step 1: 登録画面
1. `http://localhost:3001/register` にアクセス
2. デバイスハッシュ: `58ff07d6539b1b8c`
3. メール・パスワード入力
4. PayPalボタンクリック

#### Step 2: PayPal決済
1. テスト用Personal Accountでログイン
2. サブスクリプション承認
3. リダイレクト確認

#### Step 3: Webhook確認
1. PayPal Developer Dashboard でWebhook実行ログ確認
2. サーバーログでWebhook受信確認
3. データベースでサブスクリプション状態確認

### 4. 期待される結果

#### データベース変更
```sql
-- devices テーブル
UPDATE devices SET status = 'active' WHERE device_hash = '58ff07d6539b1b8c';

-- subscriptions テーブル
UPDATE subscriptions SET
  paypal_subscription_id = 'I-XXXXXXXXXX',
  status = 'active',
  next_billing_date = '2025-10-19T16:28:05Z'
WHERE device_id = (SELECT id FROM devices WHERE device_hash = '58ff07d6539b1b8c');

-- payment_history テーブル
INSERT INTO payment_history (subscription_id, amount_jpy, status, payment_method)
VALUES (subscription_id, 2980, 'completed', 'paypal');
```

#### ダッシュボード表示
- ライセンス状態: **有効**
- サブスクリプション状態: **有効**
- 次回請求日: **2025年10月19日**
- 解約ボタン表示

## 🚨 トラブルシューティング

### PayPal認証エラー
```bash
# 認証情報確認
curl -v POST https://api.sandbox.paypal.com/v1/oauth2/token \
  -u "client-id:client-secret" \
  -d "grant_type=client_credentials"
```

### Webhook未受信
1. PayPal Developer Dashboard でWebhook設定確認
2. HTTPS URL必須（ngrok等でトンネル作成）
3. Webhook署名検証確認

### サブスクリプション作成失敗
1. プロダクトIDの存在確認
2. プラン設定の妥当性確認
3. 通貨コード設定確認（JPY）

## 📝 本番環境への移行

### 1. 本番用アプリ作成
PayPal Developer Dashboard で本番用アプリケーション作成

### 2. 環境変数更新
```env
# 本番環境
NEXT_PUBLIC_PAYPAL_CLIENT_ID=live-client-id
PAYPAL_CLIENT_SECRET=live-client-secret
NODE_ENV=production
```

### 3. Webhook URL更新
```
https://socialtouch.app/api/paypal/webhook
```

### 4. プラン再作成
本番環境でプロダクト・プランを再作成