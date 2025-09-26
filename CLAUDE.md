# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 開発コマンド

```bash
# 開発
npm run dev          # 開発サーバーを起動（localhost:3000）
npm run build        # 本番用ビルド（/outへの静的エクスポート）
npm run start        # 本番サーバー起動（Cloudflareデプロイでは未使用）
npm run lint         # ESLintを実行

# デプロイメント
git push origin main # Cloudflare Pagesへ自動デプロイ
```

## 重要なアーキテクチャ: Cloudflare Pages + Functions ハイブリッド

**重要**: これは標準的なNext.jsデプロイメントではありません。ハイブリッドアーキテクチャを使用しています：

1. **フロントエンド**: Next.js 15.5.2 with `output: 'export'`（`/out`への静的HTML）
2. **API**: Cloudflare Functions（`functions/api/[[path]].ts`内）- Next.js APIルートではない
3. **ルーティング**: すべてのAPIリクエストはキャッチオールルートで処理、個別ファイルではない
4. **データベース**: Supabase PostgreSQL with Row Level Security (RLS)
5. **認証**: Supabase Auth + カスタムセッションストレージ
6. **決済**: デュアルシステム - Stripe（メイン）+ PayPal（レガシー）

### 主要な設定ファイル
- `next.config.mjs`: 静的生成のため`output: 'export'`が必須
- `wrangler.toml`: `pages_build_output_dir = "out"`を設定（`.next`ではない）
- `public/_redirects`: SPAルーティングを処理（ページはindex.htmlにフォールバック）
- `functions/api/[[path]].ts`: 単一のキャッチオールAPIハンドラー（全エンドポイント）

## API実装パターン

**絶対に`app/api/`にファイルを作成しない - Cloudflare Functionsのみを使用**

```typescript
// functions/api/[[path]].ts - すべてのAPIリクエストはここを通る
export async function onRequestPOST(context: EventContext) {
  const url = new URL(context.request.url);
  const path = url.pathname.replace('/api/', '').replace(/\/$/, '');

  // 適切なハンドラーへルーティング
  if (path === 'license/verify') {
    return handleLicenseVerify(context.request, env);
  } else if (path === 'dashboard/cancel') {
    return handleSubscriptionCancel(request, env);
  }
  // ... その他のルート
}
```

### APIルート構造
- `functions/api/[[path]].ts` - メインルーター
- `functions/api/dashboard-handlers.ts` - ユーザーダッシュボード操作
- `functions/api/stripe-handlers.ts` - Stripe決済処理
- `functions/api/download-package.ts` - ファイルダウンロード操作
- ハンドラー関数はメインルーターからインポートして呼び出す

## Cloudflare Workersの制限と解決策

### Buffer APIが利用不可

```typescript
// ❌ Workersでは失敗
const buffer = Buffer.from(data, 'base64');

// ✅ Web APIを代わりに使用
const binaryString = atob(data);
const bytes = new Uint8Array(binaryString.length);
for (let i = 0; i < binaryString.length; i++) {
  bytes[i] = binaryString.charCodeAt(i);
}
```

### SupabaseのPromise処理

```typescript
// ❌ WorkersでTypeScriptエラー
supabase.from('table').insert(data)
  .then(result => {})
  .catch(error => {});

// ✅ Promise.resolve()でラップ
Promise.resolve(supabase.from('table').insert(data))
  .then(result => {})
  .catch(error => {});
```

### UUID検証が必須
```typescript
// データベースクエリ前に常にUUIDを検証
function isValidUUID(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

if (!isValidUUID(id)) {
  return new Response(JSON.stringify({ error: 'IDフォーマットが無効' }), {
    status: 400
  });
}
```

## データベーススキーマ

### コアテーブル
- `users`: Supabase Authが管理
- `devices`: デバイス登録とトライアル追跡
- `subscriptions`: アクティブなサブスクリプション（PayPal/Stripe）
- `user_packages`: ユーザー用AutoTouchパッケージ
- `plans`: サブスクリプションプランと機能

### プラン構造
```typescript
// データベース内のプラン名（小文字）
'starter' | 'pro' | 'max' | 'trial'

// プラン機能のマッピング
const planFeatures = {
  'starter': ['timeline.lua', 'hashtaglike.lua'],
  'pro': ['timeline.lua', 'hashtaglike.lua', 'follow.lua', 'unfollow.lua'],
  'max': ['timeline.lua', 'hashtaglike.lua', 'follow.lua', 'unfollow.lua', 'activelike.lua']
};
```

## 認証とセッション管理

### Remember Me機能の実装
```typescript
// lib/auth/client.tsのカスタムセッションストレージロジック
if (rememberMe) {
  localStorage.setItem('supabase.auth.token', session);  // 永続的
} else {
  sessionStorage.setItem('supabase.auth.token', session); // 一時的
}
```

### よくある認証の問題
- 新規ユーザー登録: `signInWithPassword()`ではなく`supabase.auth.signUp()`を使用
- セッションの永続化: localStorageとsessionStorage両方をチェック
- メール確認: `'Email not confirmed'`エラーを明確なメッセージで処理

## 決済統合

### デュアル決済システム
1. **Stripe**（メイン）: Webhookハンドリング付きPayment Links
2. **PayPal**（レガシー）: IPNを使用したSubscription API

### Stripe統合
```typescript
// functions/api/stripe-handlers.ts
// サブスクリプション用Payment Links（直接Checkout Sessionではない）
// Webhookハンドラーでデバイスのplan_idを更新
await supabase.from('devices')
  .update({
    plan_id: planId,
    status: 'active'
  })
  .eq('user_id', userId);

// Stripe API経由でサブスクリプション解約
const cancelResponse = await fetch(`https://api.stripe.com/v1/subscriptions/${subscriptionId}`, {
  method: 'DELETE',
  headers: {
    'Authorization': `Bearer ${env.STRIPE_SECRET_KEY}`,
    'Content-Type': 'application/x-www-form-urlencoded'
  }
});
```

### サブスクリプション解約システム
**エンドポイント**: `/api/dashboard/cancel`

解約システムは統合的な操作を実行：
1. データベースのサブスクリプション状態を'cancelled'に更新
2. Stripe APIを呼び出して外部サブスクリプションを解約
3. デバイスをトライアルプランと期限切れ状態にリセット
4. 詳細な解約結果を返却

フロントエンドは完全なStripe統合のため、Supabase RPCの代わりにこれを使用。

## よくある開発タスク

### ダッシュボードの自動リロード問題の修正
useEffectの依存関係をチェック：
- `app/components/DashboardContent.tsx`: 依存関係から`refetch`を削除
- `app/hooks/useUserData.ts`: 空の依存関係でrefetchコールバックを安定化

### ファイルダウンロードの処理
```typescript
// ダウンロード用にbase64をバイナリに変換（Workers互換）
const binaryString = atob(packageData.file_content);
const bytes = new Uint8Array(binaryString.length);
for (let i = 0; i < binaryString.length; i++) {
  bytes[i] = binaryString.charCodeAt(i);
}
return new Response(bytes, {
  headers: {
    'Content-Type': 'application/zip',
    'Content-Disposition': 'attachment; filename="package.zip"'
  }
});
```

### APIルートのデバッグ
1. `functions/api/[[path]].ts`のルーティングロジックを確認
2. パスの正規化を確認（末尾のスラッシュを削除）
3. `npm run dev`でローカルテスト（開発環境でFunctionsが動作）
4. ブラウザDevToolsのNetworkタブでリクエストを検査

## デプロイチェックリスト

本番環境へプッシュする前に：
- [ ] `next.config.mjs`に`output: 'export'`がある
- [ ] `app/api/`ディレクトリにファイルがない
- [ ] すべてのAPIが`functions/api/[[path]].ts`内にある
- [ ] すべてのデータベースクエリにUUID検証がある
- [ ] Node.js固有のAPIを使用していない（Buffer、fs、path）
- [ ] APIルートで末尾スラッシュが処理されている
- [ ] エラーレスポンスに適切なステータスコードが含まれている

## 環境変数

Cloudflare Pagesダッシュボードで必須：
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
NEXT_PUBLIC_SITE_URL（デフォルト: https://smartgram.jp）
```

## テスト

### APIテスト
組み込みテストページを使用: `https://smartgram.jp/api-test.html`

### ローカル開発
```bash
npm run dev  # Cloudflare Pages開発サーバーでFunctionsがローカル動作
```

### 一般的なテストシナリオ
- トライアル期間でのデバイス登録
- Stripe Payment Linkの完了
- パッケージのファイルアップロード/ダウンロード
- プラン機能のアクセス制御

## パッケージアップロード/ダウンロード実装

### 管理者パッケージアップロードシステム

特定ユーザー向けにAutoTouchパッケージをアップロードできる管理者用システムを実装しました。

#### データベーススキーマ
```sql
-- user_packagesテーブルは管理者がアップロードしたパッケージを保存
CREATE TABLE user_packages (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  device_hash TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_content TEXT NOT NULL, -- base64エンコード済み
  file_size INTEGER NOT NULL,
  uploaded_by TEXT DEFAULT 'admin',
  notes TEXT,
  version TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### バックエンド実装（Cloudflare Functions）

**`functions/api/[[path]].ts`のルートハンドラー:**
```typescript
// ルートマッピングを追加
else if (path === 'admin/upload-package') {
  return handleAdminUploadPackageInternal(request, env);
}

// 適切なエラーハンドリングを持つアップロードハンドラー
async function handleAdminUploadPackageInternal(request: Request, env: any) {
  // 重要: 環境変数が正しく渡される必要がある
  const supabase = getSupabaseClient(env);

  // 管理者キーの検証
  if (uploadData.admin_key !== 'smartgram-admin-2024') {
    return new Response(JSON.stringify({ error: '無効な管理者キー' }), {
      status: 401
    });
  }

  // 新しいパッケージを挿入する前に古いパッケージを無効化
  await supabase.from('user_packages')
    .update({ is_active: false })
    .eq('user_id', uploadData.user_id)
    .eq('device_hash', uploadData.device_hash);

  // 新しいパッケージを挿入
  const { data, error } = await supabase.from('user_packages')
    .insert({
      user_id: uploadData.user_id,
      device_hash: uploadData.device_hash,
      file_name: uploadData.file_name,
      file_content: uploadData.file_content, // base64
      file_size: uploadData.file_size,
      version: generateVersionString(),
      is_active: true
    });
}
```

#### フロントエンド実装

**管理者アップロードフォーム（`app/admin/page.tsx`）:**
```typescript
const handlePackageUpload = async () => {
  // ファイルをbase64に変換
  const fileContent = await new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = e.target?.result?.toString().split(',')[1];
      resolve(base64);
    };
    reader.readAsDataURL(uploadFile);
  });

  const response = await fetch('/api/admin/upload-package', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      admin_key: 'smartgram-admin-2024', // デフォルトとして設定
      user_id: uploadUserId,
      device_hash: uploadDeviceHash,
      file_name: uploadFile.name,
      file_content: fileContent,
      file_size: uploadFile.size
    })
  });
};
```

### ユーザーパッケージダウンロードシステム

**バックエンドダウンロードハンドラー:**
```typescript
async function handleUserPackageDownload(request: Request, env: any, packageId: string) {
  // データベースからパッケージを取得
  const { data: packageData } = await supabase
    .from('user_packages')
    .select('*')
    .eq('id', packageId)
    .single();

  // base64をバイナリに変換（Cloudflare Workers互換）
  const binaryString = atob(packageData.file_content);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  // ダウンロード可能なファイルとして返す
  return new Response(bytes, {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${packageData.file_name}"`
    }
  });
}
```

**フロントエンドダウンロードUI（`app/components/DashboardContent.tsx`）:**
```typescript
const handleDownloadPackage = async (packageId: string) => {
  const response = await fetch(`/api/user-packages/download/${packageId}`, {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });

  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  window.URL.revokeObjectURL(url);
};
```

### 主要な実装詳細

1. **Base64エンコーディング**: アップロード前にフロントエンドでファイルをbase64に変換
2. **バイナリ変換**: Cloudflare Workers互換性のため`atob()`と`Uint8Array`を使用（Buffer APIなし）
3. **管理者認証**: `smartgram-admin-2024`でシンプルなキーベース認証
4. **パッケージのバージョン管理**: タイムスタンプでバージョン文字列を自動生成
5. **アクティブパッケージ管理**: ユーザー/デバイスの組み合わせごとに1つのアクティブパッケージのみ

### トラブルシューティングのヒント

- **500エラー**: ハンドラーに環境変数が渡されているか確認
- **アップロード失敗**: admin_keyが正しく設定されているか確認（デフォルト: 'smartgram-admin-2024'）
- **ダウンロード問題**: 適切なbase64からバイナリへの変換を確認
- **CORSエラー**: すべてのレスポンスに`'Access-Control-Allow-Origin': '*'`を含める必要がある

## Supabaseデータベースエラーの解決方法

### よく発生するカラムエラーとその解決策

#### 1. `column "is_active" does not exist`
**原因**: テーブルに`is_active`カラムが存在しない、またはRLSポリシーが存在しないカラムを参照している
**解決方法**:
```sql
-- 必要なテーブルにis_activeカラムを追加
ALTER TABLE plans ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
ALTER TABLE user_packages ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
ALTER TABLE guides ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
```

#### 2. `column "display_name" does not exist`
**原因**: `plans`テーブルに`display_name`カラムが存在しない
**解決方法**:
```sql
ALTER TABLE plans ADD COLUMN IF NOT EXISTS display_name TEXT;
-- デフォルト値を設定
UPDATE plans SET display_name = CASE
  WHEN name = 'trial' THEN 'トライアル'
  WHEN name = 'starter' THEN 'スターター'
  WHEN name = 'pro' THEN 'プロ'
  WHEN name = 'max' THEN 'マックス'
END WHERE display_name IS NULL;
```

#### 3. `column "current_period_end" does not exist`
**原因**: `subscriptions`テーブルにStripe互換のカラムが存在しない
**解決方法**:
```sql
ALTER TABLE subscriptions
ADD COLUMN IF NOT EXISTS current_period_start TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS current_period_end TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS cancel_at_period_end BOOLEAN DEFAULT false;
```

#### 4. `column "category" does not exist`
**原因**: `guides`テーブルに`category`カラムが存在しない
**解決方法**:
```sql
ALTER TABLE guides
ADD COLUMN IF NOT EXISTS category TEXT,
ADD COLUMN IF NOT EXISTS slug TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS order_index INTEGER DEFAULT 0;
```

#### 5. `array_agg is an aggregate function`
**原因**: 集計関数が不適切に使用されている、またはGROUP BY句が不足している
**解決方法**:
- ビューを再作成して適切なGROUP BY句を含める
- STRING_AGGを使用する際は必ずGROUP BYと共に使用する

#### 6. RLSポリシーの重複エラー
**原因**: 同名のポリシーが既に存在する
**解決方法**:
```sql
-- すべての既存ポリシーを削除してから再作成
DROP POLICY IF EXISTS "policy_name" ON table_name;
-- または動的に削除
DO $$
DECLARE
  policy_record RECORD;
BEGIN
  FOR policy_record IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'guides'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON guides', policy_record.policyname);
  END LOOP;
END $$;
```

### ATE関連テーブルの削除
不要なATE（AutoTouch Enterprise）関連のテーブルと関数を削除：
```sql
-- 関数を削除
DROP FUNCTION IF EXISTS queue_ate_generation CASCADE;
-- テーブルを削除
DROP TABLE IF EXISTS download_history CASCADE;
DROP TABLE IF EXISTS file_generation_queue CASCADE;
DROP TABLE IF EXISTS ate_files CASCADE;
DROP TABLE IF EXISTS ate_templates CASCADE;
```

### マイグレーションエラーの対処法
1. **既存のトリガーエラー**: `IF NOT EXISTS`を使用するか、既存のものを先に削除
2. **カラムの型変更**: 一時カラムを作成してデータを移行してから削除
3. **外部キー制約**: `CASCADE`オプションを使用して依存関係を処理

### デバッグのヒント
- Supabase DashboardのLogsでエラーの詳細を確認
- 各SQLを個別に実行してエラーの発生箇所を特定
- `information_schema`を使用してテーブル構造を確認