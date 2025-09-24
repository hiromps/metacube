# 管理者パッケージアップロード機能セットアップ手順

## 概要
この文書では、管理者がダッシュボードから直接パッケージファイル（.ate）をアップロードできる機能のセットアップ方法を説明します。

## 前提条件
- Supabaseプロジェクトへのアクセス権限
- SQL Editorの使用権限
- 管理者メールアドレス: `akihiro0324mnr@gmail.com`

## 1. データベースセットアップ

### Step 1: user_packagesテーブルの作成
1. Supabaseダッシュボードにアクセス
2. SQL Editorを開く
3. `setup_user_packages.sql`の内容を実行

```sql
-- または直接以下のSQLを実行:
CREATE TABLE IF NOT EXISTS user_packages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_hash TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_content TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  uploaded_by TEXT DEFAULT 'admin',
  notes TEXT,
  version TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  download_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- インデックスとRLSポリシーも忘れずに作成
```

### Step 2: テーブル作成の確認
以下のクエリでテーブルが正しく作成されたか確認:

```sql
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_name = 'user_packages'
ORDER BY ordinal_position;
```

## 2. 管理者機能の使用方法

### 管理者ログイン
1. `akihiro0324mnr@gmail.com`でログイン
2. ダッシュボードにアクセス
3. 「👑 管理者専用 - パッケージアップロード」セクションが表示されることを確認

### パッケージアップロード手順
1. **対象ユーザーID**: アップロード先のユーザーIDを入力
2. **デバイスハッシュ**: 対象デバイスのハッシュを入力
3. **パッケージファイル**: .ateファイルを選択
4. **メモ**: バージョン情報などを入力（任意）
5. 「📤 パッケージをアップロード」ボタンをクリック

### ユーザー側での確認
1. 対象ユーザーがダッシュボードにログイン
2. 「📦 専用パッケージダウンロード」セクションで状態確認
3. 「🔄 状態更新」ボタンでリフレッシュ
4. パッケージ準備完了後、ダウンロード可能

## 3. エラー対処

### よくあるエラー

#### 1. "Unexpected token '<'"エラー
**原因**: APIエンドポイントがHTMLを返している
**対処**:
- Cloudflare Functionsが正常にデプロイされているか確認
- `_redirects`ファイルの設定確認

#### 2. "データベーステーブルが見つかりません"
**原因**: `user_packages`テーブルが作成されていない
**対処**:
- `setup_user_packages.sql`を実行
- Supabaseの権限設定を確認

#### 3. "管理者権限がありません"
**原因**: 管理者メールアドレスの設定ミス
**対処**:
- `lib/auth/admin.ts`で`ADMIN_EMAILS`配列を確認
- 正しいメールアドレスでログインしているか確認

## 4. API エンドポイント

### パッケージ状態確認
```
GET /api/user-packages/status?user_id={userId}&device_hash={deviceHash}
```

### パッケージダウンロード
```
GET /api/user-packages/download/{packageId}
```

### 管理者アップロード
```
POST /api/admin/upload-package
{
  "admin_key": "smartgram-admin-2024",
  "user_id": "uuid",
  "device_hash": "hash",
  "file_name": "package.ate",
  "file_content": "base64string",
  "file_size": 12345,
  "notes": "version info"
}
```

## 5. セキュリティ設定

### 管理者キー
現在の管理者キー: `smartgram-admin-2024`
- プロダクション環境では環境変数に設定することを推奨
- 定期的な変更を推奨

### アクセス制限
- 管理者機能は`akihiro0324mnr@gmail.com`のみアクセス可能
- 追加の管理者は`lib/auth/admin.ts`で設定

## 6. 運用注意事項

1. **ファイルサイズ制限**: 現在特に制限なし（要検討）
2. **バージョン管理**: 自動的に日時ベースのバージョン番号を生成
3. **古いパッケージ**: 新しいアップロード時に自動的に無効化
4. **ダウンロード統計**: 各パッケージのダウンロード回数を記録

## トラブルシューティング

### ログ確認
1. Cloudflare Functions のログを確認
2. Supabase ログを確認
3. ブラウザ開発者ツールのNetworkタブで API レスポンスを確認

### サポート連絡先
- 技術的問題: システム管理者
- 機能要望: プロダクトチーム