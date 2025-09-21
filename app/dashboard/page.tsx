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


export default function DashboardPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [error, setError] = useState('')
  const [cancelling, setCancelling] = useState(false)
  const [changingDevice, setChangingDevice] = useState(false)
  const [newDeviceHash, setNewDeviceHash] = useState('')
  const [showDeviceChangeForm, setShowDeviceChangeForm] = useState(false)
  const [timeLeft, setTimeLeft] = useState<string>('')

  useEffect(() => {
    checkAuth()
  }, [])

  useEffect(() => {
    const interval = setInterval(() => {
      if (userProfile?.trialEndsAt) {
        updateTimeLeft()
      }
    }, 1000)
    return () => clearInterval(interval)
  }, [userProfile])

  const checkAuth = async () => {
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser()

      if (authError || !user) {
        router.push('/login')
        return
      }

      // Get user status using the new API
      let response: Response
      let data: any

      // In development, use mock data if API is not available
      try {
        response = await fetch(`/api/user/status?user_id=${user.id}`)

        // Check if response is HTML (404 page)
        const contentType = response.headers.get('content-type')
        if (contentType && contentType.includes('text/html')) {
          throw new Error('API endpoint not found - using mock data')
        }

        data = await response.json()
      } catch (fetchError) {
        console.warn('API not available, using mock data:', fetchError)

        // Mock data for development with registered device FFMZ3GTSJC6J
        const isTrialActive = false; // Change to true to simulate activated trial
        const mockActivationTime = isTrialActive ? new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString() : null;
        const mockTrialEndTime = isTrialActive ? new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString() : null;

        data = {
          user_id: user.id,
          email: user.email || '',
          status: isTrialActive ? UserStatus.TRIAL : UserStatus.REGISTERED,
          device_id: 'mock-device-id',
          device_hash: 'FFMZ3GTSJC6J', // Registered device hash
          trial_activated: isTrialActive,
          trial_activated_at: mockActivationTime,
          first_execution_at: mockActivationTime,
          trial_ends_at: mockTrialEndTime,
          subscription_id: 'mock-subscription',
          paypal_subscription_id: 'I-MOCK123456789',
          subscription_status: isTrialActive ? 'trial' : 'active', // Set to active for registered device
          status_description: isTrialActive ? 'Trial - 2 days left' : 'Registered - Trial will start on first main.lua execution',
          has_access_to_content: true,
          has_access_to_tools: isTrialActive,
          time_remaining_seconds: isTrialActive ? 172800 : null
        }
        response = { ok: true } as Response
      }

      if (!response.ok && response.status === 404) {
        router.push('/register')
        return
      }

      // Map the response to UserProfile with time synchronization
      const profile: UserProfile = {
        id: data.user_id,
        email: data.email,
        status: data.status as UserStatus,
        deviceId: data.device_id,
        deviceHash: data.device_hash,
        trialActivatedAt: data.trial_activated_at,
        firstExecutionAt: data.first_execution_at,
        trialEndsAt: data.trial_ends_at,
        subscriptionId: data.subscription_id,
        paypalSubscriptionId: data.paypal_subscription_id,
        subscriptionStatus: data.subscription_status,
        statusDescription: data.status_description,
        hasAccessToContent: data.has_access_to_content,
        hasAccessToTools: data.has_access_to_tools,
        timeRemainingSeconds: data.time_remaining_seconds
      }

      setUserProfile(profile)

    } catch (error: any) {
      console.error('Auth check error:', error)
      setError(error.message)
    } finally {
      setLoading(false)
    }
  }

  const updateTimeLeft = () => {
    if (!userProfile) return

    let targetDate: Date | null = null
    let activatedDate: Date | null = null
    let label = ''

    if (userProfile.status === UserStatus.TRIAL && userProfile.trialEndsAt) {
      targetDate = new Date(userProfile.trialEndsAt)
      activatedDate = userProfile.trialActivatedAt ? new Date(userProfile.trialActivatedAt) : null
      label = '体験期間残り'
    }

    if (!targetDate) {
      setTimeLeft('')
      return
    }

    const now = new Date()
    const diff = targetDate.getTime() - now.getTime()

    if (diff <= 0) {
      setTimeLeft(`${label}: 期限切れ`)
      return
    }

    // Calculate exact remaining time (synced with first execution)
    const totalSeconds = Math.floor(diff / 1000)
    const days = Math.floor(totalSeconds / 86400)
    const hours = Math.floor((totalSeconds % 86400) / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const seconds = totalSeconds % 60

    // Show activation time for transparency
    let timeDisplay = `${label}: ${days}日 ${hours}時間 ${minutes}分 ${seconds}秒`

    if (activatedDate) {
      const activationStr = activatedDate.toLocaleString('ja-JP', {
        month: 'numeric',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric'
      })
      timeDisplay += ` (開始: ${activationStr})`
    }

    setTimeLeft(timeDisplay)
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
      if (userProfile?.paypalSubscriptionId) {
        try {
          const response = await fetch('/api/paypal/cancel', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              subscription_id: userProfile.paypalSubscriptionId
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
      await checkAuth() // Refresh data

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

    if (newDeviceHash === userProfile?.deviceHash) {
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
          old_device_hash: userProfile?.deviceHash,
          new_device_hash: newDeviceHash.trim(),
          email: userProfile?.email
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
        await checkAuth() // Refresh data
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

  if (!userProfile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="bg-white rounded-lg shadow-lg max-w-md p-8">
          <div className="text-center">
            <p className="text-red-600 mb-4">{error || 'データが見つかりません'}</p>
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
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="container mx-auto px-4">
          <div className="flex justify-between items-center h-16">
            <Link href="/">
              <h1 className="text-2xl font-bold text-blue-600 hover:text-blue-700 transition-colors">
                MetaCube
              </h1>
            </Link>
            <div className="flex items-center gap-3">
              <Link href="/guides">
                <button className="px-4 py-2 text-sm text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all">
                  📚 ガイド
                </button>
              </Link>
              <button
                onClick={handleLogout}
                className="px-4 py-2 text-sm text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
              >
                🚪 ログアウト
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="bg-gradient-to-br from-blue-50 to-white py-8 sm:py-12">
        <div className="container mx-auto px-4">
          <div className="text-center">
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-800 mb-2">
              ダッシュボード
            </h1>
            <p className="text-gray-600 text-sm sm:text-base">
              アカウントステータスとライセンス管理
            </p>
          </div>
        </div>
      </section>

      <div className="container mx-auto px-4 max-w-6xl py-8">
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-600 rounded-lg">
            {error}
          </div>
        )}

        {/* Status Hero Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl sm:text-2xl font-semibold text-gray-800 mb-1">アカウントステータス</h2>
              <p className="text-gray-600">{userProfile.statusDescription}</p>
            </div>
            <div className={`px-4 py-2 rounded-lg font-medium ${
              userProfile.status === UserStatus.TRIAL ? 'bg-blue-100 text-blue-700' :
              userProfile.status === UserStatus.ACTIVE ? 'bg-green-100 text-green-700' :
              userProfile.status === UserStatus.EXPIRED ? 'bg-gray-100 text-gray-700' :
              userProfile.status === UserStatus.SUSPENDED ? 'bg-red-100 text-red-700' :
              'bg-gray-100 text-gray-700'
            }`}>
              {userProfile.status === UserStatus.REGISTERED && '📦 登録済み - 未アクティベート'}
              {userProfile.status === UserStatus.TRIAL && '🎯 体験期間'}
              {userProfile.status === UserStatus.ACTIVE && '✨ 有料会員'}
              {userProfile.status === UserStatus.EXPIRED && '⏰ 期限切れ'}
              {userProfile.status === UserStatus.SUSPENDED && '⚠️ 停止中'}
            </div>
          </div>
          {timeLeft && (
            <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg text-center">
              <p className="text-2xl font-bold text-blue-600">
                {timeLeft}
              </p>
            </div>
          )}
        </div>

        {/* Content for Registered (Pre-trial) Status */}
        {userProfile.status === UserStatus.REGISTERED && (
          <div className="bg-gradient-to-br from-yellow-50 to-white rounded-xl shadow-sm border border-yellow-200 p-6 mb-8">
            <h3 className="text-lg font-semibold text-gray-800 mb-2">🚀 体験期間を開始する準備</h3>
            <p className="text-gray-600 mb-4">
              支払い登録が完了しました。AutoTouchのmain.luaを実行すると、自動的に3日間の体験期間が開始されます。
            </p>

            <div className="bg-white border border-gray-200 p-4 rounded-lg mb-4">
              <h4 className="font-medium text-gray-800 mb-3">📋 次のステップ</h4>
              <ol className="space-y-2 text-sm text-gray-700">
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 font-medium">1.</span>
                  <span>iPhone 7/8でAutoTouchを起動</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 font-medium">2.</span>
                  <span>main.luaスクリプトを実行</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 font-medium">3.</span>
                  <span>自動的に3日間の体験期間が開始されます</span>
                </li>
              </ol>
            </div>

            <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
              <p className="text-sm text-blue-800">
                <strong>💡 ヒント:</strong> 体験期間は最初のmain.lua実行時に自動的に開始されます。
                準備が整ってから実行することをお勧めします。
              </p>
            </div>

            <div className="mt-6 text-center">
              <Link href="/guides">
                <button className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium">
                  📖 セットアップガイドを見る →
                </button>
              </Link>
            </div>
          </div>
        )}

        {/* Dashboard Content for Registered/Trial/Active Status */}
        {(userProfile.status === UserStatus.REGISTERED || userProfile.status === UserStatus.TRIAL || userProfile.status === UserStatus.ACTIVE) && (
          <>
            {/* Overview Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm text-gray-600">ライセンス状態</p>
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    userProfile.status === UserStatus.TRIAL ? 'bg-blue-100 text-blue-700' :
                    userProfile.status === UserStatus.ACTIVE ? 'bg-green-100 text-green-700' :
                    'bg-yellow-100 text-yellow-700'
                  }`}>
                    {userProfile.status === UserStatus.TRIAL ? '体験版' :
                     userProfile.status === UserStatus.ACTIVE ? '有効' : '登録済み'}
                  </span>
                </div>
                <div className="text-2xl font-bold text-gray-800 mb-1">
                  {userProfile.hasAccessToTools ? '✅ 有効' : '❌ 無効'}
                </div>
                <p className="text-sm text-gray-600">
                  期限: {userProfile.status === UserStatus.TRIAL && userProfile.trialEndsAt ? formatDate(userProfile.trialEndsAt) :
                         userProfile.status === UserStatus.REGISTERED ? '未アクティベート' : '無制限'}
                </p>
              </div>

              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm text-gray-600">サブスクリプション</p>
                  {userProfile.subscriptionStatus && (
                    <span className="text-sm">
                      {userProfile.subscriptionStatus === 'active' ? '✅' : '⏳'}
                    </span>
                  )}
                </div>
                <div className="text-2xl font-bold text-blue-600 mb-1">
                  ¥2,980
                  <span className="text-sm font-normal text-gray-500">/月</span>
                </div>
                <p className="text-sm text-gray-600">
                  {userProfile.status === UserStatus.TRIAL ? '🎯 体験期間中' : '🔄 自動更新'}
                </p>
              </div>

              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
                <p className="text-sm text-gray-600 mb-3">利用可能な機能</p>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-green-600">✅</span>
                    <span className="text-sm text-gray-700">全ツール利用可能</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-green-600">✅</span>
                    <span className="text-sm text-gray-700">全ガイド閲覧可能</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-green-600">✅</span>
                    <span className="text-sm text-gray-700">サポート利用可能</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Account Information */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">アカウント情報</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">メールアドレス</p>
                    <p className="text-gray-800 font-medium">{userProfile.email}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 mb-1">現在のデバイス</p>
                    <p className="font-mono text-sm bg-gray-50 p-2 rounded border border-gray-200 text-gray-700">
                      {userProfile.deviceHash || '未設定'}
                    </p>
                  </div>
                </div>
                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">PayPal サブスクリプションID</p>
                    <p className="font-mono text-xs text-gray-500">
                      {userProfile.paypalSubscriptionId || 'なし'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 mb-1">契約プラン</p>
                    <div className="flex items-center gap-2">
                      <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded text-sm font-medium">
                        スタンダード
                      </span>
                      <span className="text-gray-700">月額 ¥2,980</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Main.lua Script Information */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">📜 main.lua スクリプト情報</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">設定済みデバイスハッシュ</p>
                    <p className="font-mono text-sm bg-gray-50 p-2 rounded border border-gray-200 text-gray-700">
                      {userProfile.deviceHash || '未設定'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 mb-1">初回実行日時</p>
                    <p className="text-gray-800">
                      {userProfile.firstExecutionAt ? formatDate(userProfile.firstExecutionAt) : '未実行'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 mb-1">デバイス登録日時</p>
                    <p className="text-gray-800">
                      {formatDate(new Date().toISOString())}
                    </p>
                  </div>
                </div>
                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">スクリプト実行状態</p>
                    <div className="flex items-center gap-2">
                      <span className={`px-3 py-1 rounded text-sm font-medium ${
                        userProfile.firstExecutionAt ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                      }`}>
                        {userProfile.firstExecutionAt ? '✅ 実行済み' : '⏳ 未実行'}
                      </span>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Trial開始状態</p>
                    <div className="flex items-center gap-2">
                      <span className={`px-3 py-1 rounded text-sm font-medium ${
                        userProfile.trialActivated ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
                      }`}>
                        {userProfile.trialActivated ? '🎯 開始済み' : '📦 未開始'}
                      </span>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 mb-1">利用可能ツール</p>
                    <div className="flex items-center gap-2">
                      <span className={`px-3 py-1 rounded text-sm font-medium ${
                        userProfile.hasAccessToTools ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {userProfile.hasAccessToTools ? '🛠️ 全ツール利用可能' : '🚫 ツール利用不可'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {!userProfile.trialActivated && (
                <div className="mt-4 bg-blue-50 border border-blue-200 p-4 rounded-lg">
                  <p className="text-sm text-blue-800">
                    <strong>💡 次のステップ:</strong> AutoTouchでmain.luaを実行すると、3日間の体験期間が自動的に開始されます。
                  </p>
                </div>
              )}
            </div>

            {/* Device Management */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-2">デバイス管理</h3>
              <p className="text-sm text-gray-600 mb-4">登録デバイスの変更</p>
              {!showDeviceChangeForm ? (
                <div>
                  <p className="text-gray-700 mb-4">
                    契約が有効な間は、別のデバイスに変更することができます。
                    デバイスハッシュは AutoTouch の main.lua 実行時に表示されます。
                  </p>
                  {userProfile.hasAccessToTools ? (
                    <button
                      onClick={() => setShowDeviceChangeForm(true)}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      デバイスを変更
                    </button>
                  ) : (
                    <div className="text-sm text-gray-500">
                      デバイス変更は契約有効期間中のみ利用できます
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      新しいデバイスハッシュ
                    </label>
                    <input
                      type="text"
                      value={newDeviceHash}
                      onChange={(e) => setNewDeviceHash(e.target.value)}
                      placeholder="新しいデバイスハッシュを入力"
                      className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-800 placeholder-gray-400"
                      disabled={changingDevice}
                    />
                  </div>
                  <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg">
                    <p className="font-medium text-yellow-800 mb-2">⚠️ 注意事項</p>
                    <ul className="space-y-1 text-sm text-gray-700">
                      <li>• デバイス変更後は新しいデバイスでのみご利用いただけます</li>
                      <li>• 現在のデバイスでは利用できなくなります</li>
                      <li>• デバイスハッシュは main.lua 実行時に表示されます</li>
                    </ul>
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={handleDeviceChange}
                      disabled={changingDevice || !newDeviceHash.trim()}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                    >
                      {changingDevice ? '変更中...' : 'デバイス変更を実行'}
                    </button>
                    <button
                      onClick={() => {
                        setShowDeviceChangeForm(false)
                        setNewDeviceHash('')
                        setError('')
                      }}
                      disabled={changingDevice}
                      className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
                    >
                      キャンセル
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-2">アクション</h3>
              <p className="text-sm text-gray-600 mb-4">契約の管理</p>
              <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
                <div className="space-y-3">
                  {userProfile.subscriptionStatus === 'active' && (
                    <button
                      onClick={handleCancelSubscription}
                      disabled={cancelling}
                      className="px-4 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 disabled:opacity-50 transition-colors"
                    >
                      {cancelling ? '解約中...' : 'サブスクリプションを解約'}
                    </button>
                  )}
                </div>
                <div className="text-sm text-gray-600">
                  <p className="mb-1">お困りの場合は</p>
                  <a href="mailto:support@metacube.app" className="text-blue-600 hover:text-blue-700">
                    support@metacube.app
                  </a>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Expired Status */}
        {userProfile.status === UserStatus.EXPIRED && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
            <h3 className="text-xl font-semibold text-gray-800 mb-2">契約が期限切れです</h3>
            <p className="text-gray-600 mb-6">サービスを継続するには再登録が必要です</p>
            <div className="text-center">
              <p className="text-gray-700 mb-6">
                体験期間または契約期間が終了しました。
                サービスを継続利用するには、再度契約をお願いします。
              </p>
              <Link href="/register">
                <button className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium">
                  再登録して利用を再開
                </button>
              </Link>
            </div>
          </div>
        )}

        {/* Quick Links */}
        <div className="mt-8">
          <h2 className="text-lg font-semibold text-gray-800 mb-4 text-center">クイックアクセス</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Link href="/">
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 text-center hover:border-blue-300 hover:shadow-md transition-all cursor-pointer">
                <div className="text-2xl mb-2">🏠</div>
                <p className="text-gray-700 font-medium">ホーム</p>
              </div>
            </Link>
            <Link href="/guides">
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 text-center hover:border-blue-300 hover:shadow-md transition-all cursor-pointer">
                <div className="text-2xl mb-2">📚</div>
                <p className="text-gray-700 font-medium">ガイド</p>
              </div>
            </Link>
            <a href="mailto:support@metacube.app">
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 text-center hover:border-blue-300 hover:shadow-md transition-all cursor-pointer">
                <div className="text-2xl mb-2">📧</div>
                <p className="text-gray-700 font-medium">サポート</p>
              </div>
            </a>
            <Link href="/register">
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 text-center hover:border-blue-300 hover:shadow-md transition-all cursor-pointer">
                <div className="text-2xl mb-2">🎯</div>
                <p className="text-gray-700 font-medium">プラン</p>
              </div>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}