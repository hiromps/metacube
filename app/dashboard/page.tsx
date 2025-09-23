'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase/client'
import { signOut } from '@/lib/auth/client'
import { Button } from '@/app/components/ui/Button'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/app/components/ui/Card'
import { Badge } from '@/app/components/ui/Badge'
import { UserStatus, UserProfile, getStatusColor, getStatusBadge } from '@/types/user'
import { LoadingScreen } from '@/app/components/LoadingScreen'
import { useUserData, UserData } from '@/app/hooks/useUserData'


export default function DashboardPage() {
  const router = useRouter()
  const { userData, loading, error: dataError, refetch } = useUserData()
  const [error, setError] = useState('')
  const [cancelling, setCancelling] = useState(false)
  const [changingDevice, setChangingDevice] = useState(false)
  const [newDeviceHash, setNewDeviceHash] = useState('')
  const [showDeviceChangeForm, setShowDeviceChangeForm] = useState(false)
  const [timeLeft, setTimeLeft] = useState<string>('')
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  useEffect(() => {
    checkAuth()
  }, [])

  useEffect(() => {
    const interval = setInterval(() => {
      if (userData?.device?.trial_ends_at) {
        updateTimeLeft()
      }
    }, 1000)
    return () => clearInterval(interval)
  }, [userData])

  const checkAuth = async () => {
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser()

      if (authError || !user) {
        router.push('/login')
        return
      }
    } catch (error: any) {
      console.error('Auth check error:', error)
      setError(error.message)
      router.push('/login')
    }
  }

  const updateTimeLeft = () => {
    if (!userData?.device?.trial_ends_at || !userData.isTrialActive) {
      setTimeLeft('')
      return
    }

    const targetDate = new Date(userData.device.trial_ends_at)
    const now = new Date()
    const diff = targetDate.getTime() - now.getTime()

    if (diff <= 0) {
      setTimeLeft('体験期間: 期限切れ')
      return
    }

    // Calculate exact remaining time
    const totalSeconds = Math.floor(diff / 1000)
    const days = Math.floor(totalSeconds / 86400)
    const hours = Math.floor((totalSeconds % 86400) / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const seconds = totalSeconds % 60

    setTimeLeft(`体験期間残り: ${days}日 ${hours}時間 ${minutes}分 ${seconds}秒`)
  }


  const handleCancelSubscription = async () => {
    if (!confirm('本当に解約しますか？解約すると即座にサービスが利用できなくなります。')) {
      return
    }

    setCancelling(true)
    setError('')

    try {
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        throw new Error('ユーザー情報が取得できません')
      }

      // Cancel subscription via database function
      const { data: result, error: cancelError } = await supabase.rpc('cancel_subscription', {
        p_user_id: user.id
      })

      if (cancelError) {
        throw cancelError
      }

      // Cancel PayPal subscription
      if (userData?.subscription?.paypal_subscription_id) {
        try {
          const response = await fetch('/api/paypal/cancel', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              subscription_id: userData.subscription.paypal_subscription_id
            })
          })

          if (!response.ok) {
            console.error('PayPal cancellation failed')
          }
        } catch (paypalError) {
          console.error('PayPal cancellation error:', paypalError)
        }
      }

      alert('解約が完了しました')
      refetch() // Refresh data

    } catch (error: any) {
      console.error('Cancellation error:', error)
      setError('解約処理に失敗しました')
    } finally {
      setCancelling(false)
    }
  }

  const handleDeviceChange = async () => {
    if (!newDeviceHash.trim()) {
      setError('新しいデバイスハッシュを入力してください')
      return
    }

    if (newDeviceHash === userData?.device?.device_hash) {
      setError('新しいデバイスハッシュは現在のものと異なる必要があります')
      return
    }

    if (!confirm('デバイスを変更しますか？変更後は新しいデバイスでのみご利用いただけます。')) {
      return
    }

    setChangingDevice(true)
    setError('')

    try {
      const response = await fetch('/api/device/change', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          old_device_hash: userData?.device?.device_hash,
          new_device_hash: newDeviceHash.trim(),
          email: userData?.email
        })
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'デバイス変更に失敗しました')
      }

      if (result.success) {
        alert('デバイス変更が完了しました。新しいデバイスでご利用ください。')
        setNewDeviceHash('')
        setShowDeviceChangeForm(false)
        refetch() // Refresh data
      } else {
        throw new Error(result.error || 'デバイス変更に失敗しました')
      }

    } catch (error: any) {
      console.error('Device change error:', error)
      setError(error.message || 'デバイス変更に失敗しました')
    } finally {
      setChangingDevice(false)
    }
  }

  const handleLogout = async () => {
    try {
      await signOut()
      router.push('/login')
    } catch (error) {
      console.error('Logout error:', error)
    }
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-'
    const date = new Date(dateString)
    return date.toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  const getStatusVariant = (status: UserStatus): 'success' | 'warning' | 'error' | 'matrix' | 'glass' => {
    switch (status) {
      case UserStatus.ACTIVE:
        return 'success'
      case UserStatus.TRIAL:
        return 'matrix'
      case UserStatus.EXPIRED:
      case UserStatus.SUSPENDED:
        return 'error'
      default:
        return 'glass'
    }
  }

  if (loading) {
    return <LoadingScreen message="ダッシュボードを読み込み中..." />
  }

  if (dataError || !userData) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{background: '#1f2937'}}>
        <div className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl max-w-md p-8">
          <div className="text-center">
            <p className="text-red-400 mb-4">{error || dataError || 'データが見つかりません'}</p>
            <Link href="/login">
              <Button variant="gradient" size="md">
                ログインページへ
              </Button>
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen" style={{background: '#1f2937'}}>
      {/* Navigation */}
      <nav className="bg-black/20 backdrop-blur-xl border-b border-white/10 sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3 md:py-4">
          <div className="flex justify-between items-center">
            <Link href="/">
              <div className="flex items-center space-x-1 md:space-x-2">
                <span className="text-lg md:text-2xl font-bold">
                  <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">SMART</span>
                  <span className="bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">GRAM</span>
                </span>
                <Badge className="bg-gradient-to-r from-blue-500/20 to-purple-500/20 text-blue-400 border-blue-400/30 text-xs md:text-sm" size="sm">v2.0</Badge>
              </div>
            </Link>

            {/* Desktop Navigation */}
            <div className="hidden md:flex space-x-4">
              <Link href="/guides">
                <Button className="bg-white/10 border border-white/20 text-white hover:bg-white/20 backdrop-blur-sm" size="md">
                  📚 ガイド
                </Button>
              </Link>
              <Button
                onClick={handleLogout}
                className="bg-white/10 border border-white/20 text-white hover:bg-white/20 backdrop-blur-sm"
                size="md"
              >
                🚪 ログアウト
              </Button>
            </div>

            {/* Mobile Hamburger Menu */}
            <div className="md:hidden">
              <button
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="text-white p-2 hover:bg-white/10 rounded-lg transition-colors"
                aria-label="メニューを開く"
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  {isMenuOpen ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  )}
                </svg>
              </button>
            </div>
          </div>

          {/* Mobile Menu Dropdown */}
          {isMenuOpen && (
            <div className="md:hidden mt-4 pb-4 border-t border-gray-700 pt-4">
              <div className="flex flex-col space-y-3">
                <Link href="/guides" onClick={() => setIsMenuOpen(false)}>
                  <Button className="bg-white/10 border border-white/20 text-white hover:bg-white/20 text-sm w-full" size="md">
                    📚 ガイド
                  </Button>
                </Link>
                <Button
                  onClick={() => {
                    setIsMenuOpen(false)
                    handleLogout()
                  }}
                  className="bg-white/10 border border-white/20 text-white hover:bg-white/20 text-sm w-full"
                  size="md"
                >
                  🚪 ログアウト
                </Button>
              </div>
            </div>
          )}
        </div>
      </nav>

      {/* Hero Section */}
      <section className="bg-gradient-to-br from-black/50 via-blue-900/20 to-purple-900/20 py-6 md:py-8 lg:py-12">
        <div className="container mx-auto px-4">
          <div className="text-center">
            <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold bg-gradient-to-r from-white via-blue-100 to-cyan-100 bg-clip-text text-transparent mb-2">
              ダッシュボード
            </h1>
            <p className="text-white/60 text-sm md:text-base px-2">
              アカウントステータスとライセンス管理
            </p>
          </div>
        </div>
      </section>

      <div className="container mx-auto px-4 max-w-6xl py-8">
        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl backdrop-blur-sm">
            {error}
          </div>
        )}

        {/* Status Hero Card */}
        <div className="bg-gradient-to-br from-blue-900/40 via-purple-900/30 to-indigo-900/40 backdrop-blur-xl border border-blue-400/20 rounded-2xl p-4 md:p-6 mb-6 md:mb-8 shadow-xl shadow-blue-500/10">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 md:gap-4">
            <div>
              <h2 className="text-lg md:text-xl lg:text-2xl font-semibold text-white mb-1">アカウントステータス</h2>
              <p className="text-white/70 text-sm md:text-base">
                {userData.device ?
                  (userData.isTrialActive ? `体験期間中 - ${userData.trialDaysRemaining}日残り` :
                   userData.isSubscriptionActive ? '有料会員' :
                   '登録済み - 体験期間未開始') :
                  'デバイス未登録'}
              </p>
            </div>
            <div className={`px-3 md:px-4 py-2 rounded-lg font-medium border text-sm md:text-base ${
              userData.isTrialActive ? 'bg-blue-500/20 text-blue-300 border-blue-500/30' :
              userData.isSubscriptionActive ? 'bg-green-500/20 text-green-300 border-green-500/30' :
              userData.device ? 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30' :
              'bg-white/10 text-white/70 border-white/20'
            }`}>
              {!userData.device && '📦 デバイス未登録'}
              {userData.device && !userData.isTrialActive && !userData.isSubscriptionActive && '📦 登録済み - 未アクティベート'}
              {userData.isTrialActive && '🎯 体験期間'}
              {userData.isSubscriptionActive && '✨ 有料会員'}
            </div>
          </div>
          {timeLeft && (
            <div className="mt-4 p-3 md:p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl text-center backdrop-blur-sm">
              <p className="text-lg md:text-2xl font-bold text-blue-300">
                {timeLeft}
              </p>
            </div>
          )}
        </div>

        {/* Content for Registered (Pre-trial) Status */}
        {userData.device && !userData.isTrialActive && !userData.isSubscriptionActive && (
          <div className="bg-gradient-to-br from-yellow-500/10 via-orange-500/5 to-black/20 backdrop-blur-xl border border-yellow-500/20 rounded-2xl p-6 mb-8">
            <h3 className="text-lg font-semibold text-white mb-2">🚀 体験期間を開始する準備</h3>
            <p className="text-white/70 mb-4">
              支払い登録が完了しました。AutoTouchのmain.luaを実行すると、自動的に3日間の体験期間が開始されます。
            </p>

            <div className="bg-black/20 border border-white/10 p-4 rounded-xl mb-4 backdrop-blur-sm">
              <h4 className="font-medium text-white mb-3">📋 次のステップ</h4>
              <ol className="space-y-2 text-sm text-white/80">
                <li className="flex items-start gap-2">
                  <span className="text-blue-400 font-medium">1.</span>
                  <span>iPhone 7/8でAutoTouchを起動</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-400 font-medium">2.</span>
                  <span>main.luaスクリプトを実行</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-400 font-medium">3.</span>
                  <span>自動的に3日間の体験期間が開始されます</span>
                </li>
              </ol>
            </div>

            <div className="bg-blue-500/10 border border-blue-500/20 p-4 rounded-xl backdrop-blur-sm">
              <p className="text-sm text-blue-300">
                <strong>💡 ヒント:</strong> 体験期間は最初のmain.lua実行時に自動的に開始されます。
                準備が整ってから実行することをお勧めします。
              </p>
            </div>

            <div className="mt-6 text-center">
              <Link href="/guides">
                <button className="px-6 py-3 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-xl hover:from-blue-600 hover:to-cyan-600 transition-all font-medium border border-blue-400/30">
                  📖 セットアップガイドを見る →
                </button>
              </Link>
            </div>
          </div>
        )}

        {/* Dashboard Content for Registered/Trial/Active Status */}
        {userData.device && (
          <>
            {/* Overview Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4 mb-6 md:mb-8">
              <div className="bg-gradient-to-br from-blue-800/30 via-blue-700/20 to-cyan-800/30 backdrop-blur-xl border border-blue-400/30 rounded-2xl p-4 md:p-5 shadow-lg shadow-blue-500/10">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs md:text-sm text-white/60">ライセンス状態</p>
                  <span className={`px-2 py-1 rounded text-xs font-medium border ${
                    userData.isTrialActive ? 'bg-blue-500/20 text-blue-300 border-blue-500/30' :
                    userData.isSubscriptionActive ? 'bg-green-500/20 text-green-300 border-green-500/30' :
                    'bg-yellow-500/20 text-yellow-300 border-yellow-500/30'
                  }`}>
                    {userData.isTrialActive ? '体験版' :
                     userData.isSubscriptionActive ? '有効' : '登録済み'}
                  </span>
                </div>
                <div className="text-xl md:text-2xl font-bold text-white mb-1">
                  {(userData.isTrialActive || userData.isSubscriptionActive) ? '✅ 有効' : '❌ 無効'}
                </div>
                <p className="text-xs md:text-sm text-white/60">
                  期限: {userData.isTrialActive && userData.device?.trial_ends_at ? formatDate(userData.device.trial_ends_at) :
                         (!userData.isTrialActive && !userData.isSubscriptionActive) ? '未アクティベート' : '無制限'}
                </p>
              </div>

              <div className="bg-gradient-to-br from-purple-800/30 via-purple-700/20 to-indigo-800/30 backdrop-blur-xl border border-purple-400/30 rounded-2xl p-4 md:p-5 shadow-lg shadow-purple-500/10">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs md:text-sm text-white/60">サブスクリプション</p>
                  {userData.subscription && (
                    <span className="text-sm">
                      {userData.subscription.status === 'active' ? '✅' : '⏳'}
                    </span>
                  )}
                </div>
                <div className="text-xl md:text-2xl font-bold text-blue-400 mb-1">
                  ¥2,980
                  <span className="text-xs md:text-sm font-normal text-white/50">/月</span>
                </div>
                <p className="text-xs md:text-sm text-white/60">
                  {userData.isTrialActive ? '🎯 体験期間中' : '🔄 自動更新'}
                </p>
              </div>

              <div className="bg-gradient-to-br from-indigo-800/30 via-indigo-700/20 to-blue-800/30 backdrop-blur-xl border border-indigo-400/30 rounded-2xl p-4 md:p-5 shadow-lg shadow-indigo-500/10">
                <p className="text-xs md:text-sm text-white/60 mb-3">利用可能な機能</p>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-green-400">✅</span>
                    <span className="text-xs md:text-sm text-white/80">全ツール利用可能</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-green-400">✅</span>
                    <span className="text-xs md:text-sm text-white/80">全ガイド閲覧可能</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-green-400">✅</span>
                    <span className="text-xs md:text-sm text-white/80">サポート利用可能</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Account Information */}
            <div className="bg-gradient-to-br from-cyan-800/30 via-blue-800/20 to-teal-800/30 backdrop-blur-xl border border-cyan-400/30 rounded-2xl p-4 md:p-6 mb-4 md:mb-6 shadow-lg shadow-cyan-500/10">
              <h3 className="text-lg md:text-xl font-semibold text-white mb-3 md:mb-4">アカウント情報</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                <div className="space-y-3 md:space-y-4">
                  <div>
                    <p className="text-xs md:text-sm text-white/60 mb-1">メールアドレス</p>
                    <p className="text-white font-medium text-sm md:text-base">{userData.email}</p>
                  </div>
                  <div>
                    <p className="text-xs md:text-sm text-white/60 mb-1">現在のデバイス</p>
                    <p className="font-mono text-xs md:text-sm bg-white/10 p-2 md:p-3 rounded border border-white/20 text-white/80 break-all">
                      {userData.device?.device_hash || '未設定'}
                    </p>
                  </div>
                </div>
                <div className="space-y-3 md:space-y-4">
                  <div>
                    <p className="text-xs md:text-sm text-white/60 mb-1">PayPal サブスクリプションID</p>
                    <p className="font-mono text-xs text-white/50 break-all">
                      {userData.subscription?.paypal_subscription_id || 'なし'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs md:text-sm text-white/60 mb-1">契約プラン</p>
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
                      <span className="px-3 py-1 bg-blue-500/20 text-blue-300 border border-blue-400/30 rounded text-xs md:text-sm font-medium">
                        スタンダード
                      </span>
                      <span className="text-white/80 text-xs md:text-sm">月額 ¥2,980</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Main.lua Script Information */}
            <div className="bg-gradient-to-br from-violet-800/30 via-purple-800/20 to-fuchsia-800/30 backdrop-blur-xl border border-violet-400/30 rounded-2xl p-4 md:p-6 mb-4 md:mb-6 shadow-lg shadow-violet-500/10">
              <h3 className="text-lg md:text-xl font-semibold text-white mb-3 md:mb-4">📜 main.lua スクリプト情報</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                <div className="space-y-3 md:space-y-4">
                  <div>
                    <p className="text-xs md:text-sm text-white/60 mb-1">設定済みデバイスハッシュ</p>
                    <p className="font-mono text-xs md:text-sm bg-white/10 p-2 md:p-3 rounded border border-white/20 text-white/80 break-all">
                      {userData.device?.device_hash || '未設定'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs md:text-sm text-white/60 mb-1">初回実行日時</p>
                    <p className="text-white/80 text-sm md:text-base">
                      未実行
                    </p>
                  </div>
                  <div>
                    <p className="text-xs md:text-sm text-white/60 mb-1">デバイス登録日時</p>
                    <p className="text-white/80 text-sm md:text-base">
                      {userData.device?.created_at ? formatDate(userData.device.created_at) : '未登録'}
                    </p>
                  </div>
                </div>
                <div className="space-y-3 md:space-y-4">
                  <div>
                    <p className="text-xs md:text-sm text-white/60 mb-1">スクリプト実行状態</p>
                    <div className="flex items-center gap-2">
                      <span className="px-3 py-1 rounded text-xs md:text-sm font-medium bg-yellow-500/20 text-yellow-300 border border-yellow-400/30">
                        ⏳ 未実行
                      </span>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs md:text-sm text-white/60 mb-1">Trial開始状態</p>
                    <div className="flex items-center gap-2">
                      <span className={`px-3 py-1 rounded text-xs md:text-sm font-medium border ${
                        userData.isTrialActive ? 'bg-blue-500/20 text-blue-300 border-blue-400/30' : 'bg-white/10 text-white/60 border-white/20'
                      }`}>
                        {userData.isTrialActive ? '🎯 開始済み' : '📦 未開始'}
                      </span>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs md:text-sm text-white/60 mb-1">利用可能ツール</p>
                    <div className="flex items-center gap-2">
                      <span className={`px-3 py-1 rounded text-xs md:text-sm font-medium border ${
                        (userData.isTrialActive || userData.isSubscriptionActive) ? 'bg-green-500/20 text-green-300 border-green-400/30' : 'bg-red-500/20 text-red-300 border-red-400/30'
                      }`}>
                        {(userData.isTrialActive || userData.isSubscriptionActive) ? '🛠️ 全ツール利用可能' : '🚫 ツール利用不可'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {!userData.isTrialActive && (
                <div className="mt-4 bg-blue-500/10 border border-blue-400/30 p-3 md:p-4 rounded-xl backdrop-blur-sm">
                  <p className="text-xs md:text-sm text-blue-300">
                    <strong>💡 次のステップ:</strong> AutoTouchでmain.luaを実行すると、3日間の体験期間が自動的に開始されます。
                  </p>
                </div>
              )}
            </div>

            {/* Device Management */}
            <div className="bg-gradient-to-br from-emerald-800/30 via-teal-800/20 to-cyan-800/30 backdrop-blur-xl border border-emerald-400/30 rounded-2xl p-4 md:p-6 mb-4 md:mb-6 shadow-lg shadow-emerald-500/10">
              <h3 className="text-lg md:text-xl font-semibold text-white mb-2">デバイス管理</h3>
              <p className="text-xs md:text-sm text-white/60 mb-3 md:mb-4">登録デバイスの変更</p>
              {!showDeviceChangeForm ? (
                <div>
                  <p className="text-white/70 mb-3 md:mb-4 text-sm md:text-base">
                    契約が有効な間は、別のデバイスに変更することができます。
                    デバイスハッシュは AutoTouch の main.lua 実行時に表示されます。
                  </p>
                  {(userData.isTrialActive || userData.isSubscriptionActive) ? (
                    <Button
                      onClick={() => setShowDeviceChangeForm(true)}
                      className="bg-gradient-to-r from-blue-500 to-purple-500 text-white hover:from-blue-600 hover:to-purple-600 shadow-xl border border-white/20"
                      size="md"
                    >
                      デバイスを変更
                    </Button>
                  ) : (
                    <div className="text-xs md:text-sm text-white/50">
                      デバイス変更は契約有効期間中のみ利用できます
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs md:text-sm font-medium text-white mb-1 md:mb-2">
                      新しいデバイスハッシュ
                    </label>
                    <input
                      type="text"
                      value={newDeviceHash}
                      onChange={(e) => setNewDeviceHash(e.target.value)}
                      placeholder="新しいデバイスハッシュを入力"
                      className="w-full px-3 md:px-4 py-2 md:py-2.5 bg-white/10 border border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-white placeholder-gray-400 backdrop-blur-sm transition text-sm md:text-base"
                      disabled={changingDevice}
                    />
                  </div>
                  <div className="bg-yellow-500/10 border border-yellow-400/30 p-3 md:p-4 rounded-xl backdrop-blur-sm">
                    <p className="font-medium text-yellow-300 mb-2 text-sm md:text-base">⚠️ 注意事項</p>
                    <ul className="space-y-1 text-xs md:text-sm text-white/70">
                      <li>• デバイス変更後は新しいデバイスでのみご利用いただけます</li>
                      <li>• 現在のデバイスでは利用できなくなります</li>
                      <li>• デバイスハッシュは main.lua 実行時に表示されます</li>
                    </ul>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <Button
                      onClick={handleDeviceChange}
                      disabled={changingDevice || !newDeviceHash.trim()}
                      className="bg-gradient-to-r from-blue-500 to-purple-500 text-white hover:from-blue-600 hover:to-purple-600 shadow-xl border border-white/20 disabled:opacity-50"
                      size="md"
                    >
                      {changingDevice ? '変更中...' : 'デバイス変更を実行'}
                    </Button>
                    <Button
                      onClick={() => {
                        setShowDeviceChangeForm(false)
                        setNewDeviceHash('')
                        setError('')
                      }}
                      disabled={changingDevice}
                      className="bg-white/10 border border-white/20 text-white hover:bg-white/20 backdrop-blur-sm disabled:opacity-50"
                      size="md"
                    >
                      キャンセル
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="bg-gradient-to-br from-rose-800/30 via-pink-800/20 to-red-800/30 backdrop-blur-xl border border-rose-400/30 rounded-2xl p-4 md:p-6 shadow-lg shadow-rose-500/10">
              <h3 className="text-lg md:text-xl font-semibold text-white mb-2">アクション</h3>
              <p className="text-xs md:text-sm text-white/60 mb-3 md:mb-4">契約の管理</p>
              <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
                <div className="space-y-3">
                  {userData.subscription?.status === 'active' && (
                    <Button
                      onClick={handleCancelSubscription}
                      disabled={cancelling}
                      className="bg-red-500/20 border border-red-400/30 text-red-300 hover:bg-red-500/30 disabled:opacity-50 backdrop-blur-sm"
                      size="md"
                    >
                      {cancelling ? '解約中...' : 'サブスクリプションを解約'}
                    </Button>
                  )}
                </div>
                <div className="text-xs md:text-sm text-white/60">
                  <p className="mb-1">お困りの場合は</p>
                  <a href="mailto:support@metacube.app" className="text-blue-400 hover:text-blue-300 transition">
                    support@metacube.app
                  </a>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Expired Status */}
        {(!userData.device || (!userData.isTrialActive && !userData.isSubscriptionActive && userData.trialDaysRemaining !== null && userData.trialDaysRemaining <= 0)) && (
          <div className="bg-gradient-to-br from-orange-800/30 via-red-800/20 to-amber-800/30 backdrop-blur-xl border border-orange-400/30 rounded-2xl p-6 md:p-8 shadow-lg shadow-orange-500/10">
            <h3 className="text-lg md:text-xl font-semibold text-white mb-2">契約が期限切れです</h3>
            <p className="text-white/60 mb-4 md:mb-6 text-sm md:text-base">サービスを継続するには再登録が必要です</p>
            <div className="text-center">
              <p className="text-white/70 mb-4 md:mb-6 text-sm md:text-base">
                体験期間または契約期間が終了しました。
                サービスを継続利用するには、再度契約をお願いします。
              </p>
              <Link href="/register">
                <Button className="bg-gradient-to-r from-blue-500 to-purple-500 text-white hover:from-blue-600 hover:to-purple-600 shadow-xl border border-white/20" size="lg">
                  再登録して利用を再開
                </Button>
              </Link>
            </div>
          </div>
        )}

        {/* Quick Links */}
        <div className="mt-6 md:mt-8">
          <h2 className="text-lg md:text-xl font-semibold text-white mb-3 md:mb-4 text-center">クイックアクセス</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
            <Link href="/">
              <div className="bg-gradient-to-br from-slate-700/30 via-gray-700/20 to-zinc-700/30 backdrop-blur-xl border border-slate-400/30 rounded-2xl p-4 md:p-6 text-center hover:border-blue-400/50 hover:bg-gradient-to-br hover:from-blue-700/20 hover:via-slate-700/20 hover:to-gray-700/20 transition-all cursor-pointer shadow-lg shadow-slate-500/10">
                <div className="text-xl md:text-2xl mb-1 md:mb-2">🏠</div>
                <p className="text-white/80 font-medium text-sm md:text-base">ホーム</p>
              </div>
            </Link>
            <Link href="/guides">
              <div className="bg-gradient-to-br from-green-700/30 via-emerald-700/20 to-teal-700/30 backdrop-blur-xl border border-green-400/30 rounded-2xl p-4 md:p-6 text-center hover:border-green-400/50 hover:bg-gradient-to-br hover:from-green-700/30 hover:via-emerald-700/30 hover:to-teal-700/30 transition-all cursor-pointer shadow-lg shadow-green-500/10">
                <div className="text-xl md:text-2xl mb-1 md:mb-2">📚</div>
                <p className="text-white/80 font-medium text-sm md:text-base">ガイド</p>
              </div>
            </Link>
            <a href="mailto:support@metacube.app">
              <div className="bg-gradient-to-br from-amber-700/30 via-yellow-700/20 to-orange-700/30 backdrop-blur-xl border border-amber-400/30 rounded-2xl p-4 md:p-6 text-center hover:border-amber-400/50 hover:bg-gradient-to-br hover:from-amber-700/30 hover:via-yellow-700/30 hover:to-orange-700/30 transition-all cursor-pointer shadow-lg shadow-amber-500/10">
                <div className="text-xl md:text-2xl mb-1 md:mb-2">📧</div>
                <p className="text-white/80 font-medium text-sm md:text-base">サポート</p>
              </div>
            </a>
            <Link href="/register">
              <div className="bg-gradient-to-br from-purple-700/30 via-violet-700/20 to-indigo-700/30 backdrop-blur-xl border border-purple-400/30 rounded-2xl p-4 md:p-6 text-center hover:border-purple-400/50 hover:bg-gradient-to-br hover:from-purple-700/30 hover:via-violet-700/30 hover:to-indigo-700/30 transition-all cursor-pointer shadow-lg shadow-purple-500/10">
                <div className="text-xl md:text-2xl mb-1 md:mb-2">🎯</div>
                <p className="text-white/80 font-medium text-sm md:text-base">プラン</p>
              </div>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}