# 管理者ユーザー選択機能の修正

## 問題
管理者のファイルアップロードセクションで、新規登録ユーザー（まだ契約していない）が選択できない問題がありました。

## 解決策

### 1. コード修正（実施済み）
`app/components/DashboardContent.tsx`の`loadAvailableUsers`関数を修正：
- `users`テーブルから全ユーザーを取得するように変更
- アクセス権限エラーの場合は`devices`テーブルからユーザーリストを構築
- デバイス未登録ユーザーも表示され、手動でデバイスハッシュを入力可能

### 2. データベースビューの作成（推奨）

Supabaseダッシュボードで以下のSQLを実行してください：

```sql
-- 管理者用のユーザービューを作成
CREATE OR REPLACE VIEW public.admin_users_view AS
SELECT
    au.id as user_id,
    au.email,
    au.created_at,
    au.email_confirmed_at,
    au.last_sign_in_at,
    d.device_hash,
    d.plan_id,
    d.status as device_status,
    d.created_at as device_created_at,
    p.display_name as plan_display_name
FROM auth.users au
LEFT JOIN public.devices d ON au.id = d.user_id
LEFT JOIN public.plans p ON d.plan_id = p.name
ORDER BY au.created_at DESC;

-- 認証済みユーザーにアクセス権限を付与
GRANT SELECT ON public.admin_users_view TO authenticated;

-- より簡単なビュー（devices テーブルベース）
CREATE OR REPLACE VIEW public.device_users_view AS
SELECT DISTINCT
    d.user_id,
    d.device_hash,
    d.plan_id,
    d.status,
    d.created_at,
    p.display_name as plan_display_name
FROM public.devices d
LEFT JOIN public.plans p ON d.plan_id = p.name
ORDER BY d.created_at DESC;

-- 認証済みユーザーにアクセス権限を付与
GRANT SELECT ON public.device_users_view TO authenticated;
```

## 機能改善点

1. **全ユーザー表示**
   - 新規登録ユーザー（契約なし）も選択可能
   - プラン状態を「未契約」と明確に表示

2. **デバイスハッシュの柔軟性**
   - デバイス登録済みユーザー：自動入力
   - デバイス未登録ユーザー：手動入力可能

3. **エラーハンドリング**
   - セッションエラーの適切な処理
   - users テーブルへのアクセス権限がない場合のフォールバック

## トラブルシューティング

### "Invalid Refresh Token" エラーが出る場合
1. ブラウザのキャッシュとクッキーをクリア
2. 再度ログイン
3. それでも解決しない場合は、上記のデータベースビューを作成

### ユーザーリストが表示されない場合
1. コンソールログを確認（F12 → Console）
2. `devices`テーブルに少なくとも1件のレコードがあることを確認
3. Supabaseダッシュボードでテーブルの権限を確認

## 今後の改善案

1. **管理者権限の実装**
   - 特定のメールアドレスまたはロールベースのアクセス制御
   - `user_metadata`に`role: 'admin'`を追加

2. **ユーザー検索機能**
   - メールアドレスやユーザーIDでの検索
   - ページネーション

3. **一括アップロード**
   - 複数ユーザーへの一括ファイル配布
   - CSVインポート機能