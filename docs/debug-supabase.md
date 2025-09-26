# Supabase環境変数デバッグガイド

## 🔍 現在の状況
- サーバー: `http://localhost:3002`
- エラー: `supabaseKey is required`

## 🛠️ デバッグ手順

### 1. ブラウザでの確認
1. `http://localhost:3002/login` にアクセス
2. F12で開発者ツールを開く
3. コンソールタブを確認

### 2. 期待される出力
```
Supabase URL: https://bsujceqmhvpltedjkvum.supabase.co
Supabase Anon Key exists: true
```

### 3. 問題の原因候補

#### A. 環境変数が読み込まれていない
```bash
# .env.localの内容確認
cat .env.local | grep SUPABASE

# Next.jsサーバー再起動
npm run dev
```

#### B. キャッシュ問題
```bash
# Next.jsキャッシュクリア
rm -rf .next
npm run dev
```

#### C. 環境変数の重複
- `.env.local`に重複した`NEXT_PUBLIC_SUPABASE_ANON_KEY`がないか確認
- 他の環境設定ファイル（`.env`, `.env.development`）と競合していないか確認

### 4. 修正方法

#### パターン1: 環境変数が読み込まれていない場合
```typescript
// lib/supabase/client.ts で直接設定（一時的）
const supabaseUrl = "https://bsujceqmhvpltedjkvum.supabase.co"
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

#### パターン2: Next.js設定に問題がある場合
```javascript
// next.config.mjs に追加
const nextConfig = {
  env: {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  }
};
```

### 5. 最終確認手順

1. **環境変数確認**
   ```bash
   echo $NEXT_PUBLIC_SUPABASE_URL
   echo $NEXT_PUBLIC_SUPABASE_ANON_KEY
   ```

2. **ブラウザコンソール確認**
   ```javascript
   console.log(process.env.NEXT_PUBLIC_SUPABASE_URL)
   console.log(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
   ```

3. **Supabaseクライアント手動テスト**
   ```javascript
   import { createClient } from '@supabase/supabase-js'

   const supabase = createClient(
     "https://bsujceqmhvpltedjkvum.supabase.co",
     "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
   )

   console.log(supabase)
   ```

## 🚨 緊急対応

もし環境変数が全く読み込まれない場合は、以下のファイルを作成：

```typescript
// lib/supabase/config.ts
export const supabaseConfig = {
  url: "https://bsujceqmhvpltedjkvum.supabase.co",
  anonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJzdWpjZXFtaHZwbHRlZGprdnVtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgyODU1MDYsImV4cCI6MjA3Mzg2MTUwNn0._TrKjXMAQQWNmS2aIEV6oA7RMXJISSWaVMUQBESPnbQ"
}
```

```typescript
// lib/supabase/client.ts 修正版
import { createClient } from '@supabase/supabase-js'
import { supabaseConfig } from './config'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || supabaseConfig.url
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || supabaseConfig.anonKey

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
```

## 📝 チェックリスト

- [ ] `.env.local`ファイルが存在する
- [ ] `NEXT_PUBLIC_SUPABASE_URL`が設定されている
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY`が設定されている
- [ ] Next.jsサーバーが再起動されている
- [ ] ブラウザのキャッシュがクリアされている
- [ ] コンソールエラーが解決されている

このガイドに従って問題を特定・解決してください。