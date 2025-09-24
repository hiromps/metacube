'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase/client'
import { Button } from '@/app/components/ui/Button'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/app/components/ui/Card'
import { Badge } from '@/app/components/ui/Badge'
import { UserStatus, ContentAccess, getAccessLevel } from '@/types/user'
import { LoadingScreen } from '@/app/components/LoadingScreen'

interface GuideSection {
  id: string
  title: string
  description: string
  requiresAccess: boolean
  content: string
  locked?: boolean
}

export default function GuidesPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [access, setAccess] = useState<ContentAccess | null>(null)
  const [selectedGuide, setSelectedGuide] = useState<string>('')
  const [error, setError] = useState('')

  const guides: GuideSection[] = [
    {
      id: 'overview',
      title: '概要とシステム要件',
      description: 'SocialTouchの基本情報と必要環境',
      requiresAccess: false,
      content: `
# SocialTouch 概要

SocialTouchは、iPhone 7/8専用のInstagram自動化ツールです。

## 必要環境
- iPhone 7/8（必須）
- iOS 15.x推奨
- Jailbreak環境
- AutoTouch（有料アプリ）
- 安定したインターネット接続

## 機能
- タイムライン自動スクロール
- 自動いいね
- フォロー/アンフォロー管理
- エンゲージメント分析

## 注意事項
- Instagramの利用規約をご確認ください
- 過度な使用はアカウント制限の原因となります
- 1日の操作回数には制限を設けてください
      `
    },
    {
      id: 'jailbreak',
      title: 'Jailbreak手順',
      description: 'iPhone 7/8のJailbreak詳細ガイド',
      requiresAccess: true,
      content: `
# iPhone 7/8 Jailbreak完全ガイド

## 対応ツール

### iOS 14.0 - 14.8.1
**checkra1n（推奨）**
1. checkra1n公式サイトからダウンロード
2. iPhoneをDFUモードで起動
3. checkra1nを実行
4. 画面の指示に従って進行

### iOS 15.0 - 15.7.1
**palera1n**
1. macOS/Linux環境を準備
2. palera1nをダウンロード
3. ターミナルから実行
4. rootless/rootful選択

## DFUモード進入方法

### iPhone 7
1. 電源ボタン + 音量下げボタンを10秒長押し
2. 電源ボタンを離し、音量下げボタンをさらに5秒
3. 画面が真っ黒のままならDFUモード成功

### iPhone 8
1. 音量上げボタンを押して離す
2. 音量下げボタンを押して離す
3. サイドボタンを10秒長押し
4. サイドボタンを押したまま音量下げボタンを5秒
5. サイドボタンを離し、音量下げボタンをさらに10秒

## Cydia/Sileo設定
1. リポジトリ追加
2. 必要なTweaksインストール
3. AutoTouchリポジトリ追加

## トラブルシューティング
- ブートループ: セーフモードで起動
- Cydiaクラッシュ: リフレッシュ実行
- リスプリング: UserSpace Reboot
      `
    },
    {
      id: 'autotouch',
      title: 'AutoTouch導入',
      description: 'AutoTouchのインストールと初期設定',
      requiresAccess: true,
      content: `
# AutoTouch インストールガイド

## 購入とインストール

### 1. ライセンス購入
- AutoTouch公式サイトでライセンス購入（$4.99）
- デバイスUDID登録
- アクティベーションキー受信

### 2. Cydiaからインストール
\`\`\`
リポジトリURL: https://apt.autotouch.net/
パッケージ名: AutoTouch
\`\`\`

### 3. アクティベーション
1. AutoTouchアプリを開く
2. Settings → License
3. アクティベーションキー入力

## 初期設定

### 基本設定
- Recording Quality: High
- Play Speed: 1.0x
- Coordinate System: Absolute
- Allow Remote Access: OFF（セキュリティ）

### スクリプトフォルダ
\`\`\`
/var/mobile/Library/AutoTouch/Scripts/
\`\`\`

### main.lua配置
1. PCからiFunBoxやFilzaを使用
2. Scriptsフォルダにmain.lua転送
3. 権限設定: 755

## 動作確認
1. AutoTouchアプリでScripts確認
2. main.lua選択
3. Playボタンで実行
4. デバイスハッシュ表示確認

## よくある問題
- スクリプトが見えない: 権限確認
- 実行エラー: Lua構文確認
- タッチが効かない: Accessibility設定
      `
    },
    {
      id: 'scripts',
      title: 'スクリプト設定',
      description: 'main.luaとツールスクリプトの設定',
      requiresAccess: true,
      content: `
# スクリプト設定ガイド

## ファイル構成
\`\`\`
/var/mobile/Library/AutoTouch/Scripts/
├── main.lua          # メインメニュー
├── timeline.lua      # タイムラインツール
├── like.lua         # いいねツール
├── follow.lua       # フォローツール
└── config.lua       # 設定ファイル
\`\`\`

## main.lua設定

### デバイスハッシュ取得
初回実行時に自動表示されます：
1. AutoTouchでmain.lua実行
2. デバイスハッシュをメモ
3. Webサイトで登録

### ライセンス認証設定
\`\`\`lua
-- config.lua内
LICENSE_SERVER = "https://smartgram.jp/api"
CACHE_DURATION = 86400  -- 24時間
\`\`\`

## 各ツール設定

### timeline.lua
- スクロール速度: 調整可能
- いいね頻度: 3-5投稿に1回
- 休憩時間: 30分ごと

### like.lua
- 1日の上限: 200いいね
- 間隔: 15-30秒ランダム
- ハッシュタグ指定可能

### follow.lua
- 1日の上限: 50フォロー
- アンフォロー: 3日後
- ターゲット設定可能

## セキュリティ設定

### API通信
- HTTPS必須
- デバイスハッシュ暗号化
- キャッシュ期限管理

### Instagram対策
- ランダム遅延
- 人間らしい動作パターン
- 1日の操作制限

## デバッグ方法
1. AutoTouchコンソール確認
2. エラーログ: /var/mobile/Library/AutoTouch/Log/
3. alert()関数でデバッグ出力
      `
    },
    {
      id: 'activation',
      title: 'アクティベーション',
      description: '体験期間の開始方法',
      requiresAccess: true,
      content: `
# アクティベーション手順

## セットアップ完了後の手順

### 1. デバイスハッシュ確認
1. AutoTouchでmain.lua実行
2. 表示されるデバイスハッシュをコピー
3. 形式例: F2LXJ7XXHG7F

### 2. Webダッシュボード
1. https://smartgram.app/dashboard にログイン
2. セットアップ期間中であることを確認
3. 「体験期間をアクティベート」セクションへ

### 3. アクティベート実行
1. デバイスハッシュを入力
2. 「体験期間を開始する」ボタンクリック
3. 確認ダイアログで「はい」選択

## アクティベート後

### 体験期間（3日間）
- 全機能利用可能
- 制限なし
- 自動更新設定済み

### 期間終了後
- 自動的に有料会員へ移行
- PayPal自動課金開始
- サービス継続利用可能

## 注意事項
- アクティベートは1回のみ
- 取り消し不可
- セットアップ期限内に実行必要

## トラブルシューティング

### デバイスハッシュが表示されない
- AutoTouch再インストール
- main.lua権限確認
- iPhoneを再起動

### アクティベート失敗
- デバイスハッシュ確認
- ネットワーク接続確認
- セットアップ期限確認

### 体験期間が始まらない
- ダッシュボード更新
- ブラウザキャッシュクリア
- サポート連絡
      `
    }
  ]

  const checkAccess = useCallback(async () => {
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser()

      if (authError || !user) {
        // Not logged in - show overview only
        setAccess({
          hasAccess: false,
          canUseTools: false,
          status: UserStatus.VISITOR,
          statusDescription: '未ログイン',
          reason: 'ログインが必要です'
        })
        setLoading(false)
        return
      }

      // Check content access
      let response: Response
      let data: any

      try {
        response = await fetch(`/api/content/access?user_id=${user.id}`)

        // Check if response is HTML (404 page)
        const contentType = response.headers.get('content-type')
        if (contentType && contentType.includes('text/html')) {
          throw new Error('API endpoint not found - using mock data')
        }

        data = await response.json()
      } catch (fetchError) {
        console.warn('API not available, using mock data for content access')
        // Mock data - default to registered status (pre-trial)
        data = {
          has_access: true,
          can_use_tools: false,
          status: UserStatus.REGISTERED,
          status_description: '登録済み - main.lua初回実行時に体験開始',
          trial_activated_at: null,
          trial_ends_at: null
        }
      }

      setAccess({
        hasAccess: data.has_access || false,
        canUseTools: data.can_use_tools || false,
        status: data.status as UserStatus || UserStatus.VISITOR,
        statusDescription: data.status_description || '',
        trialEndsAt: data.trial_ends_at,
        reason: data.reason
      })

      // Set default guide
      if (!selectedGuide) {
        setSelectedGuide('overview')
      }

    } catch (error: any) {
      console.error('Access check error:', error)
      setError(error.message)
      setAccess({
        hasAccess: false,
        canUseTools: false,
        status: UserStatus.VISITOR,
        statusDescription: 'エラー',
        reason: 'アクセス確認に失敗しました'
      })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    checkAccess()
  }, [checkAccess])

  const getGuideAccess = (guide: GuideSection): boolean => {
    if (!guide.requiresAccess) return true
    return access?.hasAccess || false
  }

  const getSelectedContent = (): string => {
    const guide = guides.find(g => g.id === selectedGuide)
    if (!guide) return ''

    if (!getGuideAccess(guide)) {
      return `
# 🔒 アクセス制限

このコンテンツは**契約ユーザー限定**です。

---

## 📈 現在のステータス

**${access?.statusDescription || '未ログイン'}**

---

## ✅ アクセス可能になる条件

1. **契約を開始** - 7日間のセットアップ期間を取得
2. **体験期間をアクティベート** - 3日間の無料体験
3. **有料会員にアップグレード** - 全機能を利用可能

---

## 🎯 今すぐアクセスを取得

[🚀 契約を開始する](/register)
      `
    }

    return guide.content
  }

  if (loading) {
    return <LoadingScreen message="ガイドを読み込み中..." />
  }

  return (
    <div className="min-h-screen" style={{background: '#1f2937'}}>
      {/* Navigation */}
      <nav className="bg-black/20 backdrop-blur-xl border-b border-white/10 sticky top-0 z-50">
        <div className="container mx-auto px-4">
          <div className="flex justify-between items-center h-16">
            <Link href="/">
              <div className="flex items-center space-x-1 md:space-x-2">
                <span className="text-lg md:text-2xl font-bold">
                  <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">SMART</span>
                  <span className="bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">GRAM</span>
                </span>
              </div>
            </Link>
            <div className="flex gap-3">
              <Link href="/dashboard">
                <button className="px-4 py-2 text-sm text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-all backdrop-blur-sm">
                  📊 ダッシュボード
                </button>
              </Link>
              {access?.status === UserStatus.VISITOR && (
                <Link href="/login">
                  <button className="px-4 py-2 text-sm bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-lg hover:from-blue-600 hover:to-purple-600 transition-all border border-white/20">
                    ログイン
                  </button>
                </Link>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="bg-gradient-to-br from-blue-900/40 via-purple-900/30 to-indigo-900/40 backdrop-blur-xl py-8 sm:py-12">
        <div className="container mx-auto px-4">
          <div className="text-center">
            <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent mb-2">
              セットアップガイド
            </h1>
            <p className="text-gray-300 text-sm sm:text-base">
              SMARTGRAMの導入から活用まで完全サポート
            </p>
          </div>
        </div>
      </section>

      <div className="container mx-auto px-4 max-w-7xl py-8">
        {error && (
          <div className="mb-6 p-4 bg-red-500/20 border border-red-400/30 text-red-300 rounded-lg backdrop-blur-sm">
            {error}
          </div>
        )}

        {/* Status Banner */}
        {access && (
          <div className="bg-gradient-to-br from-cyan-800/30 via-blue-800/20 to-teal-800/30 backdrop-blur-xl border border-cyan-400/30 rounded-2xl p-4 mb-6 shadow-lg shadow-cyan-500/10">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-white/60">現在のアクセスレベル</p>
                <p className="text-lg font-semibold text-white">
                  {access.hasAccess ? '✅ フルアクセス' : '🔒 制限付きアクセス'}
                </p>
              </div>
              <span className={`px-3 py-1 rounded-lg text-sm font-medium border ${
                access.hasAccess ? 'bg-green-500/20 text-green-300 border-green-400/30' : 'bg-yellow-500/20 text-yellow-300 border-yellow-400/30'
              }`}>
                {access.statusDescription}
              </span>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-gradient-to-br from-violet-800/30 via-purple-800/20 to-fuchsia-800/30 backdrop-blur-xl border border-violet-400/30 rounded-2xl sticky top-24 shadow-lg shadow-violet-500/10">
              <div className="p-4 border-b border-violet-400/30">
                <h2 className="font-semibold text-white">ガイド一覧</h2>
              </div>
              <nav className="p-2">
                {guides.map((guide) => {
                  const hasAccess = getGuideAccess(guide)
                  return (
                    <button
                      key={guide.id}
                      onClick={() => setSelectedGuide(guide.id)}
                      className={`w-full text-left px-3 py-2 rounded-lg transition-all ${
                        selectedGuide === guide.id
                          ? 'bg-blue-500/20 border-l-4 border-blue-400'
                          : 'hover:bg-white/10'
                      } ${!hasAccess ? 'opacity-50' : ''}`}
                      disabled={!hasAccess && guide.requiresAccess}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-white text-sm">
                            {guide.title}
                          </p>
                          <p className="text-xs text-white/60 mt-1">
                            {guide.description}
                          </p>
                        </div>
                        {guide.requiresAccess && !hasAccess && (
                          <span className="text-xs">🔒</span>
                        )}
                      </div>
                    </button>
                  )
                })}
              </nav>
            </div>
          </div>

          {/* Content */}
          <div className="lg:col-span-3">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="p-8">
                <div
                  className="markdown-content prose prose-blue max-w-none"
                  dangerouslySetInnerHTML={{
                    __html: getSelectedContent().replace(/\n/g, '<br>')
                      .replace(/^# (.*?)$/gm, '<h1 class="text-3xl font-bold mb-4 text-gray-800 border-b border-gray-200 pb-2">$1</h1>')
                      .replace(/^## (.*?)$/gm, '<h2 class="text-2xl font-semibold mb-3 mt-6 text-gray-800">$1</h2>')
                      .replace(/^### (.*?)$/gm, '<h3 class="text-xl font-medium mb-2 mt-4 text-gray-700">$1</h3>')
                      .replace(/\`\`\`[\s\S]*?\`\`\`/g, '<pre class="bg-gray-50 border border-gray-200 p-4 rounded-lg overflow-x-auto"><code class="text-gray-700 text-sm">$1</code></pre>')
                      .replace(/\`([^\`]+)\`/g, '<code class="bg-blue-50 px-2 py-1 rounded text-blue-700 text-sm">$1</code>')
                      .replace(/^- (.*?)$/gm, '<li class="ml-4 text-gray-700">$1</li>')
                      .replace(/^\d+\. (.*?)$/gm, '<li class="ml-4 text-gray-700">$1</li>')
                      .replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold text-gray-900">$1</strong>')
                  }}
                />
              </div>
            </div>

            {/* CTA for locked content */}
            {selectedGuide && guides.find(g => g.id === selectedGuide)?.requiresAccess && !access?.hasAccess && (
              <div className="mt-6 bg-gradient-to-br from-blue-50 to-white rounded-lg shadow-sm border border-blue-200 p-8">
                <div className="text-center">
                  <h3 className="text-2xl font-bold text-gray-800 mb-4">
                    完全版にアクセス
                  </h3>
                  <p className="text-gray-600 mb-6">
                    契約を開始して、全てのガイドとツールにアクセスしましょう
                  </p>
                  <Link href="/register">
                    <button className="px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-lg hover:from-blue-600 hover:to-purple-600 transition-all font-medium border border-white/20 shadow-xl">
                      今すぐ始める（7日間セットアップ + 3日間体験）
                    </button>
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}