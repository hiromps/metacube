# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

```bash
# Development
npm run dev          # Start development server at localhost:3000
npm run build        # Build for production (static export)
npm run lint         # Run ESLint

# Deployment
git push origin main # Auto-deploys to Cloudflare Pages
```

## Architecture Overview

### SMARTGRAM - Instagram Automation Tool

This is a **SMARTGRAM** (Social Mobile Auto Reach Tool) web application with Instagram automation functionality, built as a license management system for AutoTouch-based iOS automation scripts.

### Deployment Architecture: Cloudflare Pages + Functions

This project uses a **hybrid architecture** specifically designed for Cloudflare Pages:

1. **Frontend**: Next.js 15.5.2 with static export (`output: 'export'`)
   - Static HTML pages served from `/out` directory
   - Client-side rendering with React 19
   - Pages: `/` (landing), `/login`, `/register`, `/dashboard`, `/terms`, `/privacy`, `/admin`
   - Dark theme with futuristic design and animated iPhone 8 mockup

2. **API Layer**: Cloudflare Functions (NOT Next.js API Routes)
   - All APIs handled by `functions/api/[[path]].ts` (catch-all route)
   - TypeScript-based Functions for dynamic processing
   - Endpoints:
     - `/api/license/verify` - License validation for AutoTouch scripts
     - `/api/device/register` - Device registration with trial period
     - `/api/paypal/success|cancel|webhook` - PayPal subscription callbacks

3. **Critical Configuration Files**:
   - `wrangler.toml`: Sets `pages_build_output_dir = "out"` (NOT `.next`)
   - `public/_redirects`: Handles SPA routing (pages fallback to index.html)
   - `next.config.mjs`: Must have `output: 'export'` for static generation

### Authentication & Session Management

- **Supabase Authentication**: Email/password with custom session storage
- **Remember Me Feature**: Uses localStorage (persistent) vs sessionStorage (temporary)
- **Session Restoration**: Custom logic in `lib/auth/client.ts` for cross-session persistence
- **Configuration Priority**: `lib/supabase/config.ts` over environment variables for Cloudflare Pages compatibility

### API Integration Pattern

**IMPORTANT**: This project uses Cloudflare Functions, not Next.js API routes.

```typescript
// functions/api/[[path]].ts handles all API requests
// Routes are determined by the path parameter
if (path === 'license/verify') {
  return handleLicenseVerify(request);
}
```

Frontend API calls:
```javascript
// Always use relative paths
fetch('/api/license/verify', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ device_hash: 'xyz' })
})
```

### AutoTouch Integration (iOS Automation)

- **Target Platform**: iPhone 7/8 with Jailbreak + AutoTouch
- **Lua Scripts**: Located in `scripts/` directory
  - `main.lua`: License verification and tool selection
  - Tool scripts: `timeline.lua`, etc. for Instagram automation
- **License Flow**: Device hash → Web registration → PayPal subscription → License validation

### Database & Authentication

- **Supabase**: PostgreSQL + Auth
  - Tables: `users`, `devices`, `subscriptions`, `licenses`
  - Row Level Security (RLS) enabled
  - Authentication via `@supabase/supabase-js`
  - Custom session management for remember me functionality

- **PayPal Integration**:
  - Monthly subscription: ¥2,980
  - 14-day free trial (simplified from device registration)
  - Webhook handlers in Cloudflare Functions

### UI/UX Design System

- **Theme**: Dark futuristic design with gradients and glassmorphism
- **Branding**: SMARTGRAM with animated acronym expansion
- **Mobile Mockup**: CSS-based iPhone 8 with realistic Instagram interface
- **Animations**: Auto-like, scroll, and user interaction demonstrations
- **Components**: Custom UI components in `app/components/ui/`

### Testing APIs

Use the built-in test page: https://smartgram.jp/api-test.html

## Deployment Process

1. **Local changes** → `git push` → GitHub
2. **GitHub** → Cloudflare Pages (auto-build)
3. **Build process**:
   - Runs `npm run build` (Next.js static export)
   - Outputs to `/out` directory
   - Deploys Functions from `/functions`
4. **Live in 2-5 minutes** at smartgram.jp

## Common Issues & Solutions

### API returns HTML instead of JSON
- Check `_redirects` file - should not redirect `/api/*`
- Ensure Functions are in `functions/api/` directory
- Verify `wrangler.toml` has correct `pages_build_output_dir`

### Page routing returns 404
- Confirm `output: 'export'` in `next.config.mjs`
- Check `_redirects` includes page routes
- Verify build outputs to `/out` directory

### Build failures on Cloudflare
- Remove any Next.js API routes (`app/api/` should not exist)
- Ensure no `export const dynamic = "force-dynamic"` in pages
- Check file sizes don't exceed 25MB limit

## SocialTouch MVP要件定義書

## 1. MVP概要

### 1.1 プロダクト名
**SocialTouch** - AutoTouchツール ライセンス管理システム

### 1.2 MVPの目的
iPhone 7/8でAutoTouchを使用するInstagram自動化ツールに対して、最小限のライセンス管理とサブスクリプション課金機能を提供する。

### 1.3 MVP期間
開発期間：2週間
検証期間：1ヶ月

---

## 2. MVP機能範囲

### 2.1 実装する機能（必須）

#### ユーザー機能
- **デバイス登録**
  - デバイスハッシュの生成と表示
  - Webでのデバイス登録
  - 3日間の無料体験開始

- **ライセンス認証**
  - main.luaでの認証
  - 24時間キャッシュ
  - オンライン検証

- **決済**
  - PayPal決済（月額2980円）
  - 体験期間後の自動課金
  - 解約機能

- **ダッシュボード（最小限）**
  - ログイン/ログアウト
  - 契約状態確認
  - 解約ボタン

#### 管理者機能
- **ユーザー管理**
  - アクティブユーザー数確認
  - ライセンス状態確認

### 2.2 実装しない機能（後回し）

- 複数デバイス管理
- デバイス変更機能
- 返金処理
- 詳細な利用統計
- メール通知（最小限のみ）
- 管理者向け分析ダッシュボード
- 年額プラン
- プロモーションコード
- 2段階認証
- 日本語化

---

## 3. 技術仕様

### 3.1 システム構成

```
クライアント側：
- AutoTouch (Lua Scripts)
  - main.lua（認証モジュール）
  - 各ツール（timeline.lua等）

サーバー側：
- Frontend: Next.js（既存のページ）
- API: Cloudflare Workers（2エンドポイント）
- Database: Supabase（3テーブル）
- Payment: PayPal Subscriptions
```

### 3.2 データベース設計（最小限）

```
users（Supabase Auth使用）
- id
- email
- created_at

devices
- id
- user_id
- device_hash
- status (trial/active/expired)
- trial_ends_at
- created_at

subscriptions
- id
- device_id
- paypal_subscription_id
- status
- created_at
```

### 3.3 API仕様（最小限）

```
POST /api/device/register
- Input: device_hash, email, password
- Output: success, trial_ends_at

POST /api/license/verify
- Input: device_hash
- Output: is_valid, expires_at
```

---

## 4. ユーザーフロー

### 4.1 初回登録フロー

```
1. main.lua実行
   ↓
2. デバイスハッシュ表示
   ↓
3. Webサイトで登録
   - メールアドレス
   - パスワード
   - デバイスハッシュ入力
   - PayPal情報（カード）
   ↓
4. 3日間体験開始
   ↓
5. main.lua再実行で認証成功
```

### 4.2 日常利用フロー

```
1. main.lua実行
   ↓
2. キャッシュ確認（24時間有効）
   ↓
3. API認証（キャッシュ期限切れ時）
   ↓
4. ツール選択画面
   ↓
5. 選択したツール実行
```

### 4.3 解約フロー

```
1. Webダッシュボードログイン
   ↓
2. 解約ボタンクリック
   ↓
3. 確認画面
   ↓
4. PayPal解約処理
   ↓
5. 即座に利用停止
```

---

## 5. 画面設計

### 5.1 Web画面（3画面のみ）

#### 登録画面（/register）
- メールアドレス入力
- パスワード入力
- デバイスハッシュ入力
- PayPal決済ボタン

#### ログイン画面（/login）
- メールアドレス
- パスワード
- ログインボタン

#### ダッシュボード（/dashboard）
- 契約状態表示
- 有効期限表示
- 解約ボタン

### 5.2 Lua側画面
luaファイルを参照

#### 認証エラー画面
- デバイスハッシュ表示
- 登録URL案内
- 終了ボタン

#### ツール選択画面
- 利用可能ツールリスト
- 実行ボタン
- 終了ボタン

---

## 6. 制約事項

### 6.1 動作環境
- **機種**: iPhone 7/8のみ
- **OS**: iOS 15推奨
- **必須**: Jailbreak + AutoTouch

### 6.2 制限事項
- 1アカウント1デバイスのみ
- 日本語化

---

## 7. 成功指標

### 7.1 技術的指標
- ライセンス認証成功率：95%以上
- API応答時間：500ms以下
- システム稼働率：99%以上

### 7.2 ビジネス指標
- 体験→有料転換率：20%以上
- 初月解約率：30%以下
- ユーザー獲得数：10人（MVP期間）

---

## 8. リスクと対策

### 8.1 技術的リスク

| リスク | 影響 | 対策 |
|--------|------|------|
| PayPal API障害 | 高 | エラーハンドリング実装 |
| デバイスID取得失敗 | 高 | 3段階フォールバック |
| Supabase障害 | 中 | 24時間キャッシュで緩和 |

### 8.2 ビジネスリスク

| リスク | 影響 | 対策 |
|--------|------|------|
| 低い転換率 | 高 | 価格調整（2980円・8800円・15000円） |
| 高い解約率 | 高 | 体験期間延長（7日検討） |
| サポート負荷 | 中 | FAQ充実、自動化 |

---

## 9. 開発スケジュール

### Week 1（基盤構築）
- Day 1-2: Supabase + DB設計
- Day 3-4: API実装（2エンドポイント）
- Day 5: PayPal基本統合

### Week 2（統合・テスト）
- Day 6-7: Web画面実装（3画面）
- Day 8-9: Lua認証モジュール
- Day 10: 統合テスト・修正

---

## 10. MVP後の拡張計画

### Phase 2（1ヶ月後）
- 複数デバイス対応
- デバイス変更機能

### Phase 3（3ヶ月後）
- 日本語化
- 年額プラン
- 詳細分析機能

### Phase 4（6ヶ月後）
- チームプラン

---

## 11. 意思決定が必要な項目

### 即決が必要
1. **価格設定**: 2980円・8800円・15000円
2. **体験期間**: 7日
3. **解約時**: 期間満了まで

### MVP期間中に決定
1. デバイス変更ポリシー
2. 返金対応
3. サポート体制

---

## 12. 完了基準

### MVP完了の定義
- [ ] 10人のユーザーが登録
- [ ] 5人が有料課金に転換
- [ ] 重大なバグゼロで1週間稼働
- [ ] 基本的な決済フロー完走

### 成功の定義
- 転換率20%達成
- 技術的な致命的問題なし
- ユーザーからの肯定的フィードバック

---

この要件定義書に基づいて、2週間でMVPを構築し、実際のユーザーで検証を行います。スコープは意図的に最小限に抑え、コア機能の動作確認を優先します。