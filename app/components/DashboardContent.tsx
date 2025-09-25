'use client'

import { useEffect, useState, useCallback } from 'react'
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
import { isAdminEmail } from '@/lib/auth/admin'
import SubscriptionPlansCard from '@/app/components/SubscriptionPlansCard'
import PaymentStatusModal from '@/app/components/PaymentStatusModal'
import { useSearchParams } from 'next/navigation'

interface DashboardContentProps {}

export default function DashboardContent({}: DashboardContentProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { userData, loading, error: dataError, refetch } = useUserData()
  const [error, setError] = useState('')
  const [cancelling, setCancelling] = useState(false)
  const [changingDevice, setChangingDevice] = useState(false)
  const [newDeviceHash, setNewDeviceHash] = useState('')
  const [showDeviceChangeForm, setShowDeviceChangeForm] = useState(false)
  const [timeLeft, setTimeLeft] = useState<string>('')
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [paymentStatus, setPaymentStatus] = useState<'success' | 'error' | 'cancel' | null>(null)

  const checkAuth = useCallback(async () => {
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser()

      if (authError || !user) {
        router.push('/login')
        return
      }
    } catch (error: any) {
      console.error('Auth check error:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      setError(errorMessage)
      router.push('/login')
    }
  }, [router])

  const updateTimeLeft = useCallback(() => {
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
  }, [userData?.device?.trial_ends_at, userData?.isTrialActive])

  useEffect(() => {
    checkAuth()
  }, [checkAuth])

  // Check for payment result query parameters and localStorage
  useEffect(() => {
    const success = searchParams.get('success')
    const canceled = searchParams.get('canceled')
    const error = searchParams.get('error')

    // Check URL parameters first
    if (success === 'true') {
      setPaymentStatus('success')
      // Clean up localStorage
      localStorage.removeItem('stripe_checkout_started')
      localStorage.removeItem('selected_plan_id')
      // Refresh user data to get updated subscription status
      setTimeout(() => {
        refetch()
      }, 1000)
    } else if (canceled === 'true') {
      setPaymentStatus('cancel')
      localStorage.removeItem('stripe_checkout_started')
      localStorage.removeItem('selected_plan_id')
    } else if (error === 'true') {
      setPaymentStatus('error')
      localStorage.removeItem('stripe_checkout_started')
      localStorage.removeItem('selected_plan_id')
    } else {
      // Check if user returned from Stripe Payment Link (no URL params)
      const checkoutStarted = localStorage.getItem('stripe_checkout_started')
      const planId = localStorage.getItem('selected_plan_id')

      if (checkoutStarted && planId) {
        const startTime = parseInt(checkoutStarted)
        const now = Date.now()
        const timeDiff = now - startTime

        // If user returns within 30 minutes, assume they might have completed payment
        // or cancelled - we need to check their subscription status
        if (timeDiff < 30 * 60 * 1000) { // 30 minutes
          console.log('User returned from potential Stripe checkout, checking subscription status...')

          // Wait a bit for webhook processing, then check subscription
          setTimeout(() => {
            refetch()

            // Check if subscription was activated
            setTimeout(() => {
              if (userData?.isSubscriptionActive) {
                setPaymentStatus('success')
                localStorage.removeItem('stripe_checkout_started')
                localStorage.removeItem('selected_plan_id')
              }
            }, 2000)
          }, 1000)
        } else {
          // Too much time passed, clean up
          localStorage.removeItem('stripe_checkout_started')
          localStorage.removeItem('selected_plan_id')
        }
      }
    }

    // Clean up URL parameters after showing modal
    if (success || canceled || error) {
      const newUrl = window.location.pathname
      window.history.replaceState({}, '', newUrl)
    }
  }, [searchParams, refetch, userData?.isSubscriptionActive])

  useEffect(() => {
    const interval = setInterval(() => {
      if (userData?.device?.trial_ends_at) {
        updateTimeLeft()
      }
    }, 1000)
    return () => clearInterval(interval)
  }, [userData, updateTimeLeft])

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
        throw new Error(cancelError.message)
      }

      // Refresh user data
      refetch()
      alert('サブスクリプションを解約しました')

    } catch (err: any) {
      console.error('Cancel subscription error:', err)
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      setError(`解約に失敗しました: ${errorMessage}`)
    } finally {
      setCancelling(false)
    }
  }

  const handleDeviceChange = async () => {
    if (!newDeviceHash.trim()) {
      setError('デバイスハッシュを入力してください')
      return
    }

    setChangingDevice(true)
    setError('')

    try {
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        throw new Error('ユーザー情報が取得できません')
      }

      // Update device hash via database function
      const { data: result, error: updateError } = await supabase.rpc('update_device_hash', {
        p_user_id: user.id,
        p_new_device_hash: newDeviceHash.trim()
      })

      if (updateError) {
        throw new Error(updateError.message)
      }

      // Refresh user data
      refetch()
      setShowDeviceChangeForm(false)
      setNewDeviceHash('')
      alert('デバイスハッシュを更新しました')

    } catch (err: any) {
      console.error('Device change error:', err)
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      setError(`デバイス変更に失敗しました: ${errorMessage}`)
    } finally {
      setChangingDevice(false)
    }
  }

  const handleSignOut = async () => {
    try {
      await signOut()
      router.push('/')
    } catch (error: any) {
      console.error('Sign out error:', error)
    }
  }

  if (loading) {
    return <LoadingScreen />
  }

  if (dataError) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-violet-900 flex items-center justify-center p-4">
        <Card className="w-full max-w-md bg-gradient-to-br from-red-900/40 via-pink-900/30 to-red-900/40 backdrop-blur-xl border border-red-400/20 shadow-xl">
          <CardHeader>
            <CardTitle className="text-white">エラー</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-white/80 mb-4">{dataError}</p>
            <Button
              onClick={() => window.location.reload()}
              className="w-full bg-gradient-to-r from-red-500 to-pink-500 text-white"
            >
              再読み込み
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-black p-4 md:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-gradient-to-br from-purple-900/40 via-pink-900/30 to-red-900/40 backdrop-blur-xl border border-purple-400/20 rounded-2xl p-4 md:p-6 shadow-xl shadow-purple-500/10 mb-6 md:mb-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold bg-gradient-to-r from-white to-purple-200 bg-clip-text text-transparent mb-2">
                ダッシュボード
              </h1>
              <p className="text-white/70 text-sm md:text-base">
                ようこそ、{userData?.email}さん
              </p>
            </div>

            {/* Mobile Menu Toggle */}
            <div className="md:hidden">
              <Button
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                variant="outline"
                size="sm"
                className="bg-white/10 border-white/20 text-white hover:bg-white/20"
              >
                {isMenuOpen ? '×' : '☰'}
              </Button>
            </div>

            {/* Desktop Actions */}
            <div className="hidden md:flex gap-2 lg:gap-3">
              {userData && isAdminEmail(userData.email) && (
                <Link href="/admin">
                  <Button
                    variant="outline"
                    size="sm"
                    className="bg-yellow-500/20 border-yellow-400/30 text-yellow-300 hover:bg-yellow-500/30 hover:border-yellow-400/50 backdrop-blur-sm"
                  >
                    👑 管理者
                  </Button>
                </Link>
              )}
              <Button
                onClick={handleSignOut}
                variant="outline"
                size="sm"
                className="bg-white/10 border-white/20 text-white hover:bg-white/20"
              >
                ログアウト
              </Button>
            </div>

            {/* Mobile Menu */}
            {isMenuOpen && (
              <div className="md:hidden bg-black/30 backdrop-blur-sm border border-white/20 rounded-xl p-4 space-y-3">
                {userData && isAdminEmail(userData.email) && (
                  <Link href="/admin">
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full bg-yellow-500/20 border-yellow-400/30 text-yellow-300 hover:bg-yellow-500/30 hover:border-yellow-400/50 backdrop-blur-sm"
                      onClick={() => setIsMenuOpen(false)}
                    >
                      👑 管理者
                    </Button>
                  </Link>
                )}
                <Button
                  onClick={() => {
                    setIsMenuOpen(false)
                    handleSignOut()
                  }}
                  variant="outline"
                  size="sm"
                  className="w-full bg-white/10 border-white/20 text-white hover:bg-white/20"
                >
                  ログアウト
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-gradient-to-br from-red-900/40 via-pink-900/30 to-red-900/40 backdrop-blur-xl border border-red-400/30 rounded-2xl p-4 md:p-6 mb-6 shadow-lg shadow-red-500/10">
            <p className="text-red-300 text-sm md:text-base">{error}</p>
          </div>
        )}

        {/* User Status Card */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8 mb-6 md:mb-8">
          <div className="lg:col-span-2">
            <div className="bg-gradient-to-br from-blue-800/30 via-indigo-800/20 to-purple-800/30 backdrop-blur-xl border border-blue-400/30 rounded-2xl p-6 md:p-8 shadow-lg shadow-blue-500/10">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <div>
                  <h2 className="text-lg md:text-xl lg:text-2xl font-semibold text-white mb-1">アカウントステータス</h2>
                  <p className="text-white/70 text-sm md:text-base">
                    {userData?.device ?
                      (userData.isSubscriptionActive && userData.isTrialActive ? '体験期間中（有料契約済み）' :
                        userData.isSubscriptionActive ? '有料会員' :
                        'デバイス登録済み - 契約待ち') :
                      'デバイス未登録'}
                  </p>
                </div>

                <div className="flex flex-col items-end gap-2">
                  <Badge
                    variant={userData?.isSubscriptionActive ? 'success' : userData?.device ? 'warning' : 'error'}
                    className={`${userData?.isSubscriptionActive
                      ? 'bg-gradient-to-r from-green-500/20 to-emerald-500/20 text-green-300 border-green-400/30'
                      : userData?.device
                        ? 'bg-gradient-to-r from-yellow-500/20 to-amber-500/20 text-yellow-300 border-yellow-400/30'
                        : 'bg-gradient-to-r from-red-500/20 to-pink-500/20 text-red-300 border-red-400/30'
                      } backdrop-blur-sm text-xs md:text-sm px-3 py-1`}
                  >
                    {userData?.isSubscriptionActive ? '✅ アクティブ' :
                      userData?.device ? '⏳ 未契約' : '❌ 未登録'}
                  </Badge>
                  {userData?.isTrialActive && userData?.trialDaysRemaining !== null && (
                    <Badge className="bg-gradient-to-r from-purple-500/20 to-pink-500/20 text-purple-300 border-purple-400/30 backdrop-blur-sm text-xs">
                      体験残り: {userData.trialDaysRemaining}日
                    </Badge>
                  )}
                </div>
              </div>

              {/* Trial Progress */}
              {userData?.isTrialActive && userData?.trialDaysRemaining !== null && (
                <div className="mb-6">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-white/70">体験期間進捗</span>
                    <span className="text-xs text-white/50">{timeLeft}</span>
                  </div>
                  <div className="relative w-full bg-white/20 rounded-full h-2 overflow-hidden">
                    <div
                      className="absolute top-0 left-0 h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full transition-all duration-300"
                      style={{ width: `${Math.max(0, Math.min(100, ((3 - userData.trialDaysRemaining) / 3) * 100))}%` }}
                    />
                  </div>
                  <div className="text-xs text-white/50 mt-1">
                    {Math.round(Math.max(0, Math.min(100, ((3 - userData.trialDaysRemaining) / 3) * 100)))}% 完了
                  </div>
                </div>
              )}

              {/* Device Information */}
              {userData?.device && (
                <div className="bg-white/10 border border-white/20 p-4 rounded-xl backdrop-blur-sm">
                  <h3 className="font-medium text-white mb-2 text-sm md:text-base">デバイス情報</h3>
                  <div className="space-y-2">
                    <div className="flex flex-col md:flex-row md:justify-between gap-2">
                      <span className="text-white/70 text-sm">デバイスハッシュ:</span>
                      <code className="text-blue-300 text-xs md:text-sm font-mono bg-black/20 px-2 py-1 rounded break-all">
                        {userData.device.device_hash}
                      </code>
                    </div>
                    <div className="flex flex-col md:flex-row md:justify-between gap-2">
                      <span className="text-white/70 text-sm">登録日:</span>
                      <span className="text-white/80 text-sm">
                        {new Date(userData.device.created_at).toLocaleDateString('ja-JP')}
                      </span>
                    </div>
                    <div className="flex flex-col md:flex-row md:justify-between gap-2">
                      <span className="text-white/70 text-sm">ステータス:</span>
                      <span className={`text-sm ${userData.device.status === 'active' ? 'text-green-400' :
                        userData.device.status === 'trial' ? 'text-yellow-400' :
                          'text-red-400'
                        }`}>
                        {userData.device.status === 'active' ? 'アクティブ' :
                          userData.device.status === 'trial' ? '体験中' :
                            '期限切れ'}
                      </span>
                    </div>
                  </div>

                  {/* Device Management Actions */}
                  <div className="mt-4 flex flex-col sm:flex-row gap-2">
                    <Button
                      onClick={() => setShowDeviceChangeForm(true)}
                      variant="outline"
                      size="sm"
                      className="flex-1 bg-white/10 border-white/30 text-white/80 hover:bg-white/20 hover:border-white/40 text-xs md:text-sm"
                    >
                      デバイス変更
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Quick Stats */}
          <div className="space-y-4 md:space-y-6">
            <div className="bg-gradient-to-br from-green-800/30 via-emerald-800/20 to-teal-800/30 backdrop-blur-xl border border-green-400/30 rounded-2xl p-4 md:p-6 text-center shadow-lg shadow-green-500/10">
              <div className="text-2xl md:text-3xl mb-2">📱</div>
              <h3 className="font-medium text-white mb-1 text-sm md:text-base">デバイス</h3>
              <p className="text-green-300 text-lg md:text-xl font-bold">
                {userData?.device ? '1台' : '0台'}
              </p>
              <p className="text-white/60 text-xs">登録済み</p>
            </div>

            <div className="bg-gradient-to-br from-purple-800/30 via-violet-800/20 to-indigo-800/30 backdrop-blur-xl border border-purple-400/30 rounded-2xl p-4 md:p-6 text-center shadow-lg shadow-purple-500/10">
              <div className="text-2xl md:text-3xl mb-2">🎯</div>
              <h3 className="font-medium text-white mb-1 text-sm md:text-base">プラン</h3>
              <p className="text-purple-300 text-lg md:text-xl font-bold">
                {userData?.plan?.display_name || 'なし'}
              </p>
              <p className="text-white/60 text-xs">現在のプラン</p>
            </div>

            <div className="bg-gradient-to-br from-orange-800/30 via-amber-800/20 to-yellow-800/30 backdrop-blur-xl border border-orange-400/30 rounded-2xl p-4 md:p-6 text-center shadow-lg shadow-orange-500/10">
              <div className="text-2xl md:text-3xl mb-2">⚡</div>
              <h3 className="font-medium text-white mb-1 text-sm md:text-base">ステータス</h3>
              <p className={`text-lg md:text-xl font-bold ${userData?.isSubscriptionActive ? 'text-green-400' : userData?.device ? 'text-yellow-400' : 'text-red-400'
                }`}>
                {userData?.isSubscriptionActive ? 'アクティブ' : userData?.device ? '準備中' : '未設定'}
              </p>
              <p className="text-white/60 text-xs">利用状況</p>
            </div>
          </div>
        </div>

        {/* Device Change Form */}
        {showDeviceChangeForm && (
          <div className="bg-gradient-to-br from-yellow-800/30 via-amber-800/20 to-orange-800/30 backdrop-blur-xl border border-yellow-400/30 rounded-2xl p-6 md:p-8 shadow-lg shadow-yellow-500/10 mb-6">
            <h3 className="text-lg md:text-xl font-semibold text-white mb-4">デバイス変更</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-white/80 text-sm mb-2">新しいデバイスハッシュ</label>
                <input
                  type="text"
                  value={newDeviceHash}
                  onChange={(e) => setNewDeviceHash(e.target.value)}
                  placeholder="新しいデバイスハッシュを入力"
                  className="w-full p-3 bg-black/20 border border-white/30 rounded-xl text-white placeholder-white/50 focus:border-white/50 focus:outline-none backdrop-blur-sm text-sm"
                />
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <Button
                  onClick={handleDeviceChange}
                  disabled={changingDevice}
                  className="flex-1 bg-gradient-to-r from-yellow-500 to-amber-500 text-white hover:from-yellow-600 hover:to-amber-600 shadow-xl"
                  size="sm"
                >
                  {changingDevice ? '変更中...' : 'デバイス変更'}
                </Button>
                <Button
                  onClick={() => {
                    setShowDeviceChangeForm(false)
                    setNewDeviceHash('')
                  }}
                  variant="outline"
                  size="sm"
                  className="flex-1 bg-white/10 border-white/30 text-white hover:bg-white/20"
                >
                  キャンセル
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Subscription Management - Show plans for users without active subscription */}
        {!userData?.isSubscriptionActive && (
          <div className="mb-6 md:mb-8">
            <SubscriptionPlansCard />
          </div>
        )}

        {/* Subscription Management - Active subscription controls */}
        {userData?.isSubscriptionActive && userData?.subscription && (
          <div className="bg-gradient-to-br from-green-800/30 via-emerald-800/20 to-teal-800/30 backdrop-blur-xl border border-green-400/30 rounded-2xl p-6 md:p-8 shadow-lg shadow-green-500/10 mb-6">
            <h3 className="text-lg md:text-xl font-semibold text-white mb-4">サブスクリプション管理</h3>

            <div className="bg-white/10 border border-white/20 p-4 rounded-xl mb-4 backdrop-blur-sm">
              <div className="space-y-2">
                <div className="flex flex-col md:flex-row md:justify-between gap-2">
                  <span className="text-white/70 text-sm">プラン:</span>
                  <span className="text-green-300 font-medium text-sm">{userData.plan?.display_name || 'SMARTGRAM'}</span>
                </div>
                <div className="flex flex-col md:flex-row md:justify-between gap-2">
                  <span className="text-white/70 text-sm">契約日:</span>
                  <span className="text-white/80 text-sm">
                    {new Date(userData.subscription.created_at).toLocaleDateString('ja-JP')}
                  </span>
                </div>
                <div className="flex flex-col md:flex-row md:justify-between gap-2">
                  <span className="text-white/70 text-sm">ステータス:</span>
                  <span className="text-green-400 text-sm">アクティブ</span>
                </div>
              </div>
            </div>

            <div className="text-center">
              <Button
                onClick={handleCancelSubscription}
                disabled={cancelling}
                variant="outline"
                size="sm"
                className="bg-red-500/20 border-red-400/30 text-red-300 hover:bg-red-500/30 hover:border-red-400/50 backdrop-blur-sm"
              >
                {cancelling ? '解約中...' : '🚫 サブスクリプション解約'}
              </Button>
              <p className="text-xs text-white/60 mt-2">
                解約すると即座にサービスが利用できなくなります
              </p>
            </div>
          </div>
        )}

        {/* Device Not Registered */}
        {!userData?.device && (
          <div className="bg-gradient-to-br from-blue-800/30 via-indigo-800/20 to-purple-800/30 backdrop-blur-xl border border-blue-400/30 rounded-2xl p-6 md:p-8 shadow-lg shadow-blue-500/10 mb-6">
            <h3 className="text-lg md:text-xl font-semibold text-white mb-2">🎉 アカウント作成完了！</h3>
            <p className="text-white/70 mb-4 md:mb-6 text-sm md:text-base">
              iPhone 7/8をお持ちの方は、デバイス登録を行ってSMARTGRAMをご利用ください。<br />
              デバイスをお持ちでない方は、後日ご準備いただいてからご利用いただけます。
            </p>

            <div className="bg-white/10 border border-white/20 p-4 rounded-xl mb-4 backdrop-blur-sm">
              <h4 className="font-medium text-white mb-2 text-sm md:text-base">📱 デバイス登録の手順</h4>
              <ol className="text-white/70 text-sm space-y-1 ml-4">
                <li>1. iPhone 7/8にJailbreak + AutoTouchをインストール</li>
                <li>2. SMARTGRAMスクリプト（smartgram.ate）を実行</li>
                <li>3. 表示されたデバイスハッシュをコピー</li>
                <li>4. 下記ボタンからデバイス登録ページで入力</li>
                <li>5. 登録完了後、再度スクリプトを実行して動作確認</li>
              </ol>
            </div>

            <div className="text-center space-y-3">
              <Link href="/device-register">
                <Button className="bg-gradient-to-r from-blue-500 to-purple-500 text-white hover:from-blue-600 hover:to-purple-600 shadow-xl border border-white/20" size="lg">
                  📱 今すぐデバイスを登録する
                </Button>
              </Link>
              <div className="space-y-2">
                <p className="text-xs text-white/60">
                  iPhone 7/8をお持ちの方向け
                </p>
                <p className="text-xs text-blue-400">
                  💡 デバイスをお持ちでない方は、ご購入後いつでも登録可能です
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Instructions */}
        <div className="bg-gradient-to-br from-purple-900/40 via-pink-900/30 to-red-900/40 backdrop-blur-xl border border-purple-400/20 rounded-2xl p-6 md:p-8 shadow-xl shadow-purple-500/10 mb-6">
          <h3 className="text-lg md:text-xl font-semibold text-white mb-4">📋 利用方法</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
            <div className="bg-white/10 border border-white/20 p-4 rounded-xl backdrop-blur-sm">
              <h4 className="font-medium text-white mb-2 text-sm md:text-base">1️⃣ 初期設定</h4>
              <ul className="text-white/70 text-sm space-y-1">
                <li>• iPhone 7/8を用意</li>
                <li>• Jailbreak実行</li>
                <li>• AutoTouchインストール</li>
                <li>• デバイスハッシュ登録</li>
              </ul>
            </div>

            <div className="bg-white/10 border border-white/20 p-4 rounded-xl backdrop-blur-sm">
              <h4 className="font-medium text-white mb-2 text-sm md:text-base">2️⃣ スクリプト実行</h4>
              <ul className="text-white/70 text-sm space-y-1">
                <li>• smartgram.ateを起動</li>
                <li>• 機能を選択</li>
                <li>• 自動実行開始</li>
                <li>• 結果を確認</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Support Links */}
        <div className="bg-gradient-to-br from-gray-800/30 via-slate-800/20 to-gray-800/30 backdrop-blur-xl border border-gray-400/20 rounded-2xl p-6 md:p-8 shadow-lg shadow-gray-500/10">
          <h3 className="text-lg md:text-xl font-semibold text-white mb-6 text-center">🤝 サポート・情報</h3>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <a href="mailto:support@smartgram.jp" className="block">
              <div className="bg-gradient-to-br from-blue-700/30 via-cyan-700/20 to-blue-700/30 backdrop-blur-xl border border-blue-400/30 rounded-2xl p-4 md:p-6 text-center hover:border-blue-400/50 hover:bg-gradient-to-br hover:from-blue-700/30 hover:via-cyan-700/30 hover:to-blue-700/30 transition-all cursor-pointer shadow-lg shadow-blue-500/10">
                <div className="text-xl md:text-2xl mb-1 md:mb-2">📧</div>
                <p className="text-white/80 font-medium text-sm md:text-base">メール</p>
              </div>
            </a>
            <Link href="/guide">
              <div className="bg-gradient-to-br from-green-700/30 via-emerald-700/20 to-green-700/30 backdrop-blur-xl border border-green-400/30 rounded-2xl p-4 md:p-6 text-center hover:border-green-400/50 hover:bg-gradient-to-br hover:from-green-700/30 hover:via-emerald-700/30 hover:to-green-700/30 transition-all cursor-pointer shadow-lg shadow-green-500/10">
                <div className="text-xl md:text-2xl mb-1 md:mb-2">📚</div>
                <p className="text-white/80 font-medium text-sm md:text-base">ガイド</p>
              </div>
            </Link>
            <a href="mailto:support@smartgram.jp" className="block">
              <div className="bg-gradient-to-br from-orange-700/30 via-amber-700/20 to-orange-700/30 backdrop-blur-xl border border-orange-400/30 rounded-2xl p-4 md:p-6 text-center hover:border-orange-400/50 hover:bg-gradient-to-br hover:from-orange-700/30 hover:via-amber-700/30 hover:to-orange-700/30 transition-all cursor-pointer shadow-lg shadow-orange-500/10">
                <div className="text-xl md:text-2xl mb-1 md:mb-2">🛠️</div>
                <p className="text-white/80 font-medium text-sm md:text-base">サポート</p>
              </div>
            </a>
            <Link href="/plans">
              <div className="bg-gradient-to-br from-purple-700/30 via-violet-700/20 to-indigo-700/30 backdrop-blur-xl border border-purple-400/30 rounded-2xl p-4 md:p-6 text-center hover:border-purple-400/50 hover:bg-gradient-to-br hover:from-purple-700/30 hover:via-violet-700/30 hover:to-indigo-700/30 transition-all cursor-pointer shadow-lg shadow-purple-500/10">
                <div className="text-xl md:text-2xl mb-1 md:mb-2">🎯</div>
                <p className="text-white/80 font-medium text-sm md:text-base">プラン</p>
              </div>
            </Link>
          </div>
        </div>
      </div>

      {/* Payment Status Modal */}
      <PaymentStatusModal
        status={paymentStatus}
        onClose={() => setPaymentStatus(null)}
      />
    </div>
  )
}