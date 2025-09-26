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
  description?: string
  youtube_url?: string
  video_id?: string
  content?: string
  category: string
  order_index: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export default function GuidesPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [access, setAccess] = useState<ContentAccess | null>(null)
  const [selectedGuide, setSelectedGuide] = useState<Guide | null>(null)
  const [error, setError] = useState('')
  const [guides, setGuides] = useState<Guide[]>([])
  const [guidesLoading, setGuidesLoading] = useState(true)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [selectedGuideIndex, setSelectedGuideIndex] = useState(0)

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

      if (result.guides) {
        setGuides(result.guides || [])
        // Set first guide as default if available
        if (result.guides && result.guides.length > 0 && !selectedGuide) {
          setSelectedGuide(result.guides[0])
          setSelectedGuideIndex(0)
        }
      } else {
        setError('ガイドの読み込みに失敗しました')
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
        setSelectedGuide(guides[0])
        setSelectedGuideIndex(0)
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
  }, [])

  const getGuideAccess = (guide: Guide): boolean => {
    // All guides are accessible if they are active
    return guide.is_active
  }

  const getSelectedContent = (): { content: string, youtubeId?: string } => {
    if (!selectedGuide) return { content: '' }

    if (!getGuideAccess(selectedGuide)) {
      return { content: '# 🔒 このガイドは現在非公開です' }
    }

    return {
      content: selectedGuide.content || '',
      youtubeId: selectedGuide.video_id
    }
  }

  // Navigate to previous/next guide
  const navigateGuide = (direction: 'prev' | 'next') => {
    if (guides.length === 0) return

    let newIndex = selectedGuideIndex
    if (direction === 'prev') {
      newIndex = Math.max(0, selectedGuideIndex - 1)
    } else {
      newIndex = Math.min(guides.length - 1, selectedGuideIndex + 1)
    }

    if (newIndex !== selectedGuideIndex) {
      setSelectedGuideIndex(newIndex)
      setSelectedGuide(guides[newIndex])
      setMobileMenuOpen(false)
      // Scroll to top on mobile
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  const handleGuideSelect = (guide: Guide, index: number) => {
    setSelectedGuide(guide)
    setSelectedGuideIndex(index)
    setMobileMenuOpen(false)
    // Scroll to top on mobile
    window.scrollTo({ top: 0, behavior: 'smooth' })
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
            <div className="flex gap-2 md:gap-3">
              {/* Mobile guide menu button */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="lg:hidden px-3 py-2 text-sm bg-violet-500/20 border border-violet-400/30 text-violet-300 rounded-lg hover:bg-violet-500/30 transition-all backdrop-blur-sm flex items-center gap-2"
              >
                <span>📚</span>
                <span className="hidden sm:inline">ガイド</span>
                <span className="text-xs">{mobileMenuOpen ? '×' : '☰'}</span>
              </button>
              <Link href="/dashboard">
                <button className="px-3 md:px-4 py-2 text-sm text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-all backdrop-blur-sm">
                  <span className="hidden sm:inline">📊 ダッシュボード</span>
                  <span className="sm:hidden">📊</span>
                </button>
              </Link>
              {access?.status === UserStatus.VISITOR && (
                <Link href="/login">
                  <button className="px-3 md:px-4 py-2 text-sm bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-lg hover:from-blue-600 hover:to-purple-600 transition-all border border-white/20">
                    ログイン
                  </button>
                </Link>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile Guide Selection Menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" onClick={() => setMobileMenuOpen(false)}>
          <div className="absolute top-16 left-0 right-0 bg-gradient-to-br from-violet-900/95 via-purple-900/95 to-fuchsia-900/95 backdrop-blur-xl border-b border-violet-400/30 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="container mx-auto px-4 py-4 max-h-[70vh] overflow-y-auto">
              <h3 className="text-white font-semibold mb-3 text-sm">ガイド一覧</h3>
              <div className="grid grid-cols-1 gap-2">
                {guides.map((guide, index) => {
                  const hasAccess = getGuideAccess(guide)
                  return (
                    <button
                      key={guide.id}
                      onClick={() => handleGuideSelect(guide, index)}
                      className={`text-left p-3 rounded-lg transition-all ${
                        selectedGuide?.id === guide.id
                          ? 'bg-blue-500/30 border border-blue-400/50'
                          : 'bg-white/10 hover:bg-white/20 border border-white/20'
                      } ${!hasAccess ? 'opacity-50' : ''}`}
                      disabled={!hasAccess}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-white text-sm">
                            {index + 1}. {guide.title}
                          </p>
                          {guide.description && (
                            <p className="text-xs text-white/60 mt-1">
                              {guide.description}
                            </p>
                          )}
                        </div>
                        {!hasAccess && <span className="text-xs">🔒</span>}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      )}

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
          {/* Sidebar - Hidden on mobile */}
          <div className="hidden lg:block lg:col-span-1">
            <div className="bg-gradient-to-br from-violet-800/30 via-purple-800/20 to-fuchsia-800/30 backdrop-blur-xl border border-violet-400/30 rounded-2xl sticky top-24 shadow-lg shadow-violet-500/10">
              <div className="p-4 border-b border-violet-400/30">
                <h2 className="font-semibold text-white">ガイド一覧</h2>
              </div>
              <nav className="p-2">
                {guides.length === 0 ? (
                  <div className="p-3 text-center">
                    <p className="text-white/60 text-sm mb-2">ガイド読み込み中...</p>
                    <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin mx-auto"></div>
                  </div>
                ) : guides.map((guide) => {
                  const hasAccess = getGuideAccess(guide)
                  return (
                    <button
                      key={guide.id}
                      onClick={() => handleGuideSelect(guide, guides.indexOf(guide))}
                      className={`w-full text-left px-3 py-2 rounded-lg transition-all ${
                        selectedGuide?.id === guide.id
                          ? 'bg-blue-500/20 border-l-4 border-blue-400'
                          : 'hover:bg-white/10'
                      } ${!hasAccess ? 'opacity-50' : ''}`}
                      disabled={!hasAccess}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-white text-sm">
                            {guide.title}
                          </p>
                          {guide.description && (
                            <p className="text-xs text-white/60 mt-1">
                              {guide.description}
                            </p>
                          )}
                        </div>
                        {!hasAccess && (
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
            {/* Mobile navigation arrows */}
            <div className="lg:hidden sticky top-16 z-30 bg-gradient-to-r from-indigo-900/95 via-purple-900/95 to-pink-900/95 backdrop-blur-xl border-b border-white/20 p-3 mb-4 -mt-8 rounded-b-2xl shadow-lg">
              <div className="flex items-center justify-between">
                <button
                  onClick={() => navigateGuide('prev')}
                  disabled={selectedGuideIndex === 0}
                  className={`px-3 py-2 rounded-lg transition-all flex items-center gap-1 text-sm ${
                    selectedGuideIndex === 0
                      ? 'bg-gray-800/30 text-gray-500 cursor-not-allowed'
                      : 'bg-white/10 text-white hover:bg-white/20 active:scale-95'
                  }`}
                >
                  <span>←</span>
                  <span className="hidden xs:inline">前へ</span>
                </button>

                <div className="flex-1 text-center px-2">
                  <p className="text-white text-xs font-medium truncate">
                    {selectedGuide?.title || 'ガイド'}
                  </p>
                  <p className="text-white/60 text-xs">
                    {selectedGuideIndex + 1} / {guides.length}
                  </p>
                </div>

                <button
                  onClick={() => navigateGuide('next')}
                  disabled={selectedGuideIndex === guides.length - 1}
                  className={`px-3 py-2 rounded-lg transition-all flex items-center gap-1 text-sm ${
                    selectedGuideIndex === guides.length - 1
                      ? 'bg-gray-800/30 text-gray-500 cursor-not-allowed'
                      : 'bg-white/10 text-white hover:bg-white/20 active:scale-95'
                  }`}
                >
                  <span className="hidden xs:inline">次へ</span>
                  <span>→</span>
                </button>
              </div>
            </div>
            <div className="bg-gradient-to-br from-slate-800/30 via-gray-800/20 to-slate-800/30 backdrop-blur-xl border border-slate-400/30 rounded-2xl shadow-lg shadow-slate-500/10">
              <div className="p-6 md:p-8">
                {guides.length === 0 && !guidesLoading && (
                  <div className="text-center py-12">
                    <h2 className="text-xl font-bold text-white mb-4">📚 ガイドシステム設定中</h2>
                    <p className="text-gray-300 mb-6">
                      ガイドコンテンツの読み込み機能を調整中です。しばらくお待ちください。
                    </p>
                    <div className="bg-blue-500/20 border border-blue-400/30 rounded-lg p-4 text-blue-200">
                      <p className="text-sm">
                        <strong>管理者の皆様:</strong> ガイド機能は正常に動作しています。API接続の最適化を進めています。
                      </p>
                    </div>
                  </div>
                )}
                {(() => {
                  const { content, youtubeId } = getSelectedContent();
                  return (
                    <>
                      {selectedGuide && (
                        <div className="mb-6">
                          <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">
                            {selectedGuide.title}
                          </h1>
                          {selectedGuide.description && (
                            <p className="text-gray-300">{selectedGuide.description}</p>
                          )}
                        </div>
                      )}

                      {youtubeId && (
                        <div className="mb-6">
                          <div className="relative aspect-video rounded-lg overflow-hidden bg-black/40 border border-white/30">
                            <iframe
                              src={`https://www.youtube.com/embed/${youtubeId}`}
                              title="YouTube video player"
                              frameBorder="0"
                              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                              allowFullScreen
                              className="absolute inset-0 w-full h-full"
                            />
                          </div>
                        </div>
                      )}

                      <div
                        className="markdown-content max-w-none"
                        style={{color: '#ffffff'}}
                        dangerouslySetInnerHTML={{
                          __html: content
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
                    </>
                  );
                })()}
              </div>
            </div>

            {/* Mobile Bottom Navigation */}
            <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-gradient-to-t from-black/95 via-gray-900/95 to-transparent backdrop-blur-xl border-t border-white/20 p-4 z-30">
              <div className="container mx-auto">
                <div className="flex items-center justify-between gap-3">
                  <button
                    onClick={() => navigateGuide('prev')}
                    disabled={selectedGuideIndex === 0}
                    className={`flex-1 px-4 py-3 rounded-xl transition-all flex items-center justify-center gap-2 font-medium ${
                      selectedGuideIndex === 0
                        ? 'bg-gray-800/50 text-gray-500 cursor-not-allowed'
                        : 'bg-gradient-to-r from-blue-500/20 to-purple-500/20 text-white hover:from-blue-500/30 hover:to-purple-500/30 border border-white/20 active:scale-95'
                    }`}
                  >
                    <span>←</span>
                    <span>前のガイド</span>
                  </button>

                  <button
                    onClick={() => setMobileMenuOpen(true)}
                    className="px-4 py-3 bg-violet-500/20 border border-violet-400/30 text-violet-300 rounded-xl hover:bg-violet-500/30 transition-all"
                  >
                    <span>📚</span>
                  </button>

                  <button
                    onClick={() => navigateGuide('next')}
                    disabled={selectedGuideIndex === guides.length - 1}
                    className={`flex-1 px-4 py-3 rounded-xl transition-all flex items-center justify-center gap-2 font-medium ${
                      selectedGuideIndex === guides.length - 1
                        ? 'bg-gray-800/50 text-gray-500 cursor-not-allowed'
                        : 'bg-gradient-to-r from-purple-500/20 to-pink-500/20 text-white hover:from-purple-500/30 hover:to-pink-500/30 border border-white/20 active:scale-95'
                    }`}
                  >
                    <span>次のガイド</span>
                    <span>→</span>
                  </button>
                </div>
              </div>
            </div>

            {/* YouTube guide available notice */}
            {selectedGuide?.youtube_url && (
              <div className="mt-6 bg-gradient-to-br from-red-800/30 via-pink-800/20 to-red-800/30 backdrop-blur-xl border border-red-400/30 rounded-2xl p-4 shadow-lg shadow-red-500/10">
                <div className="flex items-center gap-3">
                  <svg className="w-6 h-6 text-red-400" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                  </svg>
                  <p className="text-white text-sm">
                    このガイドには動画解説が含まれています
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}