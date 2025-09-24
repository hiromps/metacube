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

interface Guide {
  id: string
  title: string
  slug: string
  description: string
  content: string
  requires_access: boolean
  sort_order: number
  is_published: boolean
  created_at: string
  updated_at: string
}

export default function GuidesPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [access, setAccess] = useState<ContentAccess | null>(null)
  const [selectedGuide, setSelectedGuide] = useState<string>('')
  const [error, setError] = useState('')
  const [guides, setGuides] = useState<Guide[]>([])
  const [guidesLoading, setGuidesLoading] = useState(true)

  // Fetch guides from database
  const fetchGuides = useCallback(async () => {
    try {
      setGuidesLoading(true)
      const apiUrl = typeof window !== 'undefined'
        ? `${window.location.origin}/api/guides/list`
        : '/api/guides/list'

      const response = await fetch(apiUrl)

      // Check if response is HTML (404 page) instead of JSON
      const contentType = response.headers.get('content-type')
      if (!response.ok) {
        const errorText = await response.text()

        if (contentType && contentType.includes('text/html')) {
          setGuides([])
          setError('ガイドAPIが見つかりません。システム管理者にお問い合わせください。')
          return
        } else {
          setError(`API エラー (${response.status}): ${errorText}`)
          return
        }
      }

      const result = await response.json()

      if (result.success) {
        setGuides(result.guides || [])
        // Set first guide as default if available
        if (result.guides && result.guides.length > 0 && !selectedGuide) {
          setSelectedGuide(result.guides[0].slug)
        }
      } else {
        setError('ガイドの読み込みに失敗しました: ' + (result.error || 'Unknown error'))
      }
    } catch (error: any) {
      // Handle JSON parse errors specifically
      if (error.message && error.message.includes('Unexpected token')) {
        setError('ガイドAPIからの応答が正しくありません。システム管理者にお問い合わせください。')
      } else {
        setError('ガイドの読み込みに失敗しました: ' + (error.message || 'Unknown error'))
      }
    } finally {
      setGuidesLoading(false)
    }
  }, [selectedGuide])

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

      // User is logged in - set registered status for guides access
      setAccess({
        hasAccess: true,
        canUseTools: true,
        status: UserStatus.REGISTERED,
        statusDescription: `登録済み - ${user.email}`,
        reason: ''
      })

      // Set default guide
      if (!selectedGuide && guides.length > 0) {
        setSelectedGuide(guides[0].slug)
      }

    } catch (error: any) {
      setError(error.message || 'アクセスチェックエラー')
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
  }, [guides, selectedGuide])

  useEffect(() => {
    checkAccess()
    fetchGuides()
  }, [checkAccess, fetchGuides])

  const getGuideAccess = (guide: Guide): boolean => {
    if (!guide.requires_access) return true
    // Allow access for any registered user (not just paid users)
    return access?.status !== UserStatus.VISITOR
  }

  const getSelectedContent = (): string => {
    const guide = guides.find(g => g.slug === selectedGuide)
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

  if (loading || guidesLoading) {
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
                  {access.status !== UserStatus.VISITOR ? '✅ フルアクセス（全ガイド閲覧可能）' : '🔒 制限付きアクセス'}
                </p>
              </div>
              <span className={`px-3 py-1 rounded-lg text-sm font-medium border ${
                access.status !== UserStatus.VISITOR ? 'bg-green-500/20 text-green-300 border-green-400/30' : 'bg-yellow-500/20 text-yellow-300 border-yellow-400/30'
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
                      onClick={() => setSelectedGuide(guide.slug)}
                      className={`w-full text-left px-3 py-2 rounded-lg transition-all ${
                        selectedGuide === guide.slug
                          ? 'bg-blue-500/20 border-l-4 border-blue-400'
                          : 'hover:bg-white/10'
                      } ${!hasAccess ? 'opacity-50' : ''}`}
                      disabled={!hasAccess && guide.requires_access}
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
                        {guide.requires_access && !hasAccess && (
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
            <div className="bg-gradient-to-br from-slate-800/30 via-gray-800/20 to-slate-800/30 backdrop-blur-xl border border-slate-400/30 rounded-2xl shadow-lg shadow-slate-500/10">
              <div className="p-6 md:p-8">
                {guides.length === 0 && !guidesLoading && (
                  <div className="text-center py-12">
                    <h2 className="text-xl font-bold text-white mb-4">📚 ガイドコンテンツ準備中</h2>
                    <p className="text-gray-300 mb-6">
                      管理者によるデータベース設定が完了次第、ガイドコンテンツが利用可能になります。
                    </p>
                    <div className="bg-blue-500/20 border border-blue-400/30 rounded-lg p-4 text-blue-200">
                      <p className="text-sm">
                        <strong>管理者向け:</strong> Supabaseダッシュボードで`22_create_guides_table.sql`マイグレーションを実行してください。
                      </p>
                    </div>
                  </div>
                )}
                <div
                  className="markdown-content max-w-none"
                  style={{color: '#ffffff'}}
                  dangerouslySetInnerHTML={{
                    __html: getSelectedContent()
                      .replace(/\n/g, '<br>')
                      .replace(/^# (.*?)$/gm, '<h1 class="text-2xl md:text-3xl font-bold mb-4 text-white border-b border-white/30 pb-2">$1</h1>')
                      .replace(/^## (.*?)$/gm, '<h2 class="text-xl md:text-2xl font-semibold mb-3 mt-6 text-white">$1</h2>')
                      .replace(/^### (.*?)$/gm, '<h3 class="text-lg md:text-xl font-medium mb-2 mt-4 text-white">$1</h3>')
                      .replace(/\`\`\`([\s\S]*?)\`\`\`/g, '<pre class="bg-black/40 border border-white/30 p-4 rounded-lg overflow-x-auto backdrop-blur-sm my-4"><code class="text-white text-sm">$1</code></pre>')
                      .replace(/\`([^\`]+)\`/g, '<code class="bg-blue-500/30 px-2 py-1 rounded text-blue-200 text-sm border border-blue-400/40">$1</code>')
                      .replace(/^(\d+)\. (.*)$/gm, '<div class="my-1"><span class="text-blue-400 font-medium">$1.</span> <span class="text-white">$2</span></div>')
                      .replace(/^- (.*)$/gm, '<div class="my-1 ml-4"><span class="text-blue-400 mr-2">•</span><span class="text-white">$1</span></div>')
                      .replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold text-white">$1</strong>')
                      .replace(/^([^#\-\d\`\<\*].*)$/gm, '<div class="text-white leading-relaxed my-2">$1</div>')
                  }}
                />
              </div>
            </div>

            {/* CTA for locked content */}
            {selectedGuide && guides.find(g => g.slug === selectedGuide)?.requires_access && access?.status === UserStatus.VISITOR && (
              <div className="mt-6 bg-gradient-to-br from-blue-800/30 via-purple-800/20 to-indigo-800/30 backdrop-blur-xl border border-blue-400/30 rounded-2xl p-6 md:p-8 shadow-lg shadow-blue-500/10">
                <div className="text-center">
                  <h3 className="text-xl md:text-2xl font-bold text-white mb-4">
                    完全版にアクセス
                  </h3>
                  <p className="text-gray-300 mb-6">
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