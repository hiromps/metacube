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
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="bg-white rounded-lg shadow-lg max-w-md p-8">
          <div className="text-center">
            <p className="text-red-600 mb-4">{error || dataError || 'データが見つかりません'}</p>
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
              <p className="text-gray-600">
                {userData.device ?
                  (userData.isTrialActive ? `体験期間中 - ${userData.trialDaysRemaining}日残り` :
                   userData.isSubscriptionActive ? '有料会員' :
                   '登録済み - 体験期間未開始') :
                  'デバイス未登録'}
              </p>
            </div>
            <div className={`px-4 py-2 rounded-lg font-medium ${
              userData.isTrialActive ? 'bg-blue-100 text-blue-700' :
              userData.isSubscriptionActive ? 'bg-green-100 text-green-700' :
              userData.device ? 'bg-yellow-100 text-yellow-700' :
              'bg-gray-100 text-gray-700'
            }`}>
              {!userData.device && '📦 デバイス未登録'}
              {userData.device && !userData.isTrialActive && !userData.isSubscriptionActive && '📦 登録済み - 未アクティベート'}
              {userData.isTrialActive && '🎯 体験期間'}
              {userData.isSubscriptionActive && '✨ 有料会員'}
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
        {userData.device && !userData.isTrialActive && !userData.isSubscriptionActive && (
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
        {userData.device && (
          <>
            {/* Overview Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm text-gray-600">ライセンス状態</p>
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    userData.isTrialActive ? 'bg-blue-100 text-blue-700' :
                    userData.isSubscriptionActive ? 'bg-green-100 text-green-700' :
                    'bg-yellow-100 text-yellow-700'
                  }`}>
                    {userData.isTrialActive ? '体験版' :
                     userData.isSubscriptionActive ? '有効' : '登録済み'}
                  </span>
                </div>
                <div className="text-2xl font-bold text-gray-800 mb-1">
                  {(userData.isTrialActive || userData.isSubscriptionActive) ? '✅ 有効' : '❌ 無効'}
                </div>
                <p className="text-sm text-gray-600">
                  期限: {userData.isTrialActive && userData.device?.trial_ends_at ? formatDate(userData.device.trial_ends_at) :
                         (!userData.isTrialActive && !userData.isSubscriptionActive) ? '未アクティベート' : '無制限'}
                </p>
              </div>

              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm text-gray-600">サブスクリプション</p>
                  {userData.subscription && (
                    <span className="text-sm">
                      {userData.subscription.status === 'active' ? '✅' : '⏳'}
                    </span>
                  )}
                </div>
                <div className="text-2xl font-bold text-blue-600 mb-1">
                  ¥2,980
                  <span className="text-sm font-normal text-gray-500">/月</span>
                </div>
                <p className="text-sm text-gray-600">
                  {userData.isTrialActive ? '🎯 体験期間中' : '🔄 自動更新'}
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
                    <p className="text-gray-800 font-medium">{userData.email}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 mb-1">現在のデバイス</p>
                    <p className="font-mono text-sm bg-gray-50 p-2 rounded border border-gray-200 text-gray-700">
                      {userData.device?.device_hash || '未設定'}
                    </p>
                  </div>
                </div>
                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">PayPal サブスクリプションID</p>
                    <p className="font-mono text-xs text-gray-500">
                      {userData.subscription?.paypal_subscription_id || 'なし'}
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
                      {userData.device?.device_hash || '未設定'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 mb-1">初回実行日時</p>
                    <p className="text-gray-800">
                      未実行
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 mb-1">デバイス登録日時</p>
                    <p className="text-gray-800">
                      {userData.device?.created_at ? formatDate(userData.device.created_at) : '未登録'}
                    </p>
                  </div>
                </div>
                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">スクリプト実行状態</p>
                    <div className="flex items-center gap-2">
                      <span className="px-3 py-1 rounded text-sm font-medium bg-yellow-100 text-yellow-700">
                        ⏳ 未実行
                      </span>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Trial開始状態</p>
                    <div className="flex items-center gap-2">
                      <span className={`px-3 py-1 rounded text-sm font-medium ${
                        userData.isTrialActive ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
                      }`}>
                        {userData.isTrialActive ? '🎯 開始済み' : '📦 未開始'}
                      </span>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 mb-1">利用可能ツール</p>
                    <div className="flex items-center gap-2">
                      <span className={`px-3 py-1 rounded text-sm font-medium ${
                        (userData.isTrialActive || userData.isSubscriptionActive) ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {(userData.isTrialActive || userData.isSubscriptionActive) ? '🛠️ 全ツール利用可能' : '🚫 ツール利用不可'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {!userData.isTrialActive && (
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
                  {(userData.isTrialActive || userData.isSubscriptionActive) ? (
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
                  {userData.subscription?.status === 'active' && (
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
        {(!userData.device || (!userData.isTrialActive && !userData.isSubscriptionActive && userData.trialDaysRemaining !== null && userData.trialDaysRemaining <= 0)) && (
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