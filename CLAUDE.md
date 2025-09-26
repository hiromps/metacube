# CLAUDE.md

このファイルは、Claude Code（claude.ai/code）がこのリポジトリで作業する際のガイダンスを提供します。

## 開発コマンド

```bash
# 開発
npm run dev          # 開発サーバーを起動（localhost:3000）
npm run build        # 本番用ビルド（/outへの静的エクスポート）
npm run lint         # ESLintを実行

# デプロイメント
git push origin main # Cloudflare Pagesへ自動デプロイ
```

## 重要なアーキテクチャ: Cloudflare Pages + Functions

**重要**: これは標準的なNext.jsデプロイメントではありません。ハイブリッドアーキテクチャを使用しています：

1. **フロントエンド**: Next.js 15.5.2 with `output: 'export'`（`/out`への静的HTML）
2. **API**: Cloudflare Functions（`functions/api/[[path]].ts`内）- Next.js APIルートではない
3. **ルーティング**: すべてのAPIリクエストはキャッチオールルートで処理、個別ファイルではない

### 主要な設定ファイル
- `next.config.mjs`: 静的生成のため`output: 'export'`が必須
- `wrangler.toml`: `pages_build_output_dir = "out"`を設定（`.next`ではない）
- `public/_redirects`: SPAルーティングを処理（ページはindex.htmlにフォールバック）
- `functions/api/[[path]].ts`: 単一のキャッチオールAPIハンドラー

## API実装パターン

**絶対に`app/api/`にファイルを作成しない - Cloudflare Functionsのみを使用**

```typescript
// functions/api/[[path]].ts - すべてのAPIリクエストはここを通る
export async function onRequestPOST(context: EventContext) {
  const url = new URL(context.request.url);
  const path = url.pathname.replace('/api/', '').replace(/\/$/, '');

  // 適切なハンドラーへルーティング
  if (path === 'license/verify') {
    return handleLicenseVerify(context.request);
  }
  // ... その他のルート
}
```

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

### Stripe Webhook処理
```typescript
// functions/api/stripe-handlers.ts
// 重要: WebhookハンドラーでデバイスのPlan_idを更新
await supabase.from('devices')
  .update({
    plan_id: planId,
    status: 'active'
  })
  .eq('user_id', userId);
```

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