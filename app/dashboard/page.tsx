'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase/client'
import { signOut } from '@/lib/auth/client'
import { Button } from '@/app/components/ui/Button'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/app/components/ui/Card'
import { Badge } from '@/app/components/ui/Badge'

interface DashboardData {
  email: string
  device_hash: string
  device_status: 'trial' | 'active' | 'expired' | 'suspended'
  trial_ends_at: string | null
  subscription_status: string | null
  paypal_subscription_id: string | null
  next_billing_date: string | null
  amount_jpy: number
  license_valid: boolean
  license_expires_at: string | null
  verification_count: number
}

export default function DashboardPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<DashboardData | null>(null)
  const [error, setError] = useState('')
  const [cancelling, setCancelling] = useState(false)
  const [changingDevice, setChangingDevice] = useState(false)
  const [newDeviceHash, setNewDeviceHash] = useState('')
  const [showDeviceChangeForm, setShowDeviceChangeForm] = useState(false)

  useEffect(() => {
    checkAuth()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const checkAuth = async () => {
    console.log('🔍 ダッシュボード: 認証状態確認開始')

    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser()

      console.log('👤 ユーザー情報:', {
        user: user ? '✅ ログイン済み' : '❌ 未ログイン',
        userId: user?.id,
        email: user?.email,
        authError: authError ? authError.message : 'なし'
      })

      if (authError) {
        console.error('❌ 認証エラー:', authError)
        router.push('/login')
        return
      }

      if (!user) {
        console.log('🔄 未ログインのためログインページへリダイレクト')
        router.push('/login')
        return
      }

      console.log('📊 ダッシュボードデータ取得開始')

      // Get dashboard data
      const { data: dashboardData, error: dbError } = await supabase
        .from('user_dashboard')
        .select('*')
        .eq('user_id', user.id)
        .single()

      console.log('💾 データベースレスポンス:', {
        data: dashboardData ? '✅ データあり' : '❌ データなし',
        error: dbError ? `❌ ${dbError.message}` : '✅ エラーなし'
      })

      if (dbError) {
        console.error('❌ ダッシュボードエラー:', dbError)
        setError(`データベースエラー: ${dbError.message}`)
        return
      }

      if (!dashboardData) {
        console.error('❌ ダッシュボードデータが見つかりません')
        setError('ユーザーデータが見つかりません')
        return
      }

      console.log('✅ ダッシュボードデータ設定完了')
      setData(dashboardData)
    } catch (error: any) {
      console.error('🚨 認証確認中にエラー:', error)
      setError(error.message)
    } finally {
      setLoading(false)
    }
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
      if (data?.paypal_subscription_id) {
        try {
          const response = await fetch('/api/paypal/cancel', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              subscription_id: data.paypal_subscription_id
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

    if (newDeviceHash === data?.device_hash) {
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
          old_device_hash: data?.device_hash,
          new_device_hash: newDeviceHash.trim(),
          email: data?.email
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

  const getStatusVariant = (status: string): 'success' | 'warning' | 'error' | 'matrix' | 'glass' => {
    const statusMap: { [key: string]: 'success' | 'warning' | 'error' | 'matrix' | 'glass' } = {
      trial: 'matrix',
      active: 'success',
      expired: 'error',
      suspended: 'warning',
      pending: 'glass',
      cancelled: 'glass'
    }
    return statusMap[status] || 'glass'
  }

  const getStatusLabel = (status: string): string => {
    const labelMap: { [key: string]: string } = {
      trial: '体験版',
      active: '有効',
      expired: '期限切れ',
      suspended: '停止中',
      pending: '処理中',
      cancelled: '解約済み'
    }
    return labelMap[status] || status
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-dark">
        <div className="text-gray-400 animate-pulse">読み込み中...</div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-dark">
        <Card variant="glass" className="max-w-md">
          <CardContent className="text-center py-8">
            <p className="text-error mb-4">{error || 'データが見つかりません'}</p>
            <Link href="/login">
              <Button variant="gradient" size="md">
                ログインページへ
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-dark py-8">
      {/* Navigation */}
      <nav className="bg-dark/50 backdrop-blur-xl border-b border-dark-border mb-8">
        <div className="container mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <Link href="/">
              <h1 className="text-2xl font-bold bg-gradient-matrix bg-clip-text text-transparent">
                MetaCube
              </h1>
            </Link>
            <Button
              onClick={handleLogout}
              variant="glass"
              size="md"
            >
              ログアウト
            </Button>
          </div>
        </div>
      </nav>

      <div className="container mx-auto px-4 max-w-6xl">
        {error && (
          <div className="mb-6 p-4 bg-error/10 border border-error/30 text-error rounded-lg animate-slide-down">
            {error}
          </div>
        )}

        {/* Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card variant="gradient" className="relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-matrix/20 rounded-full blur-3xl"></div>
            <CardContent className="relative z-10">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-gray-300">ライセンス状態</p>
                <Badge variant={getStatusVariant(data.device_status)} size="sm">
                  {getStatusLabel(data.device_status)}
                </Badge>
              </div>
              <div className="text-2xl font-bold text-white">
                {data.license_valid ? '✓ 有効' : '✗ 無効'}
              </div>
              <p className="text-sm text-gray-400 mt-1">
                期限: {formatDate(data.device_status === 'trial' ? data.trial_ends_at : data.license_expires_at)}
              </p>
            </CardContent>
          </Card>

          <Card variant="glass">
            <CardContent>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-gray-300">サブスクリプション</p>
                {data.subscription_status && (
                  <Badge variant={getStatusVariant(data.subscription_status)} size="sm">
                    {getStatusLabel(data.subscription_status)}
                  </Badge>
                )}
              </div>
              <div className="text-2xl font-bold text-white">
                ¥{data.amount_jpy?.toLocaleString() || '2,980'}
                <span className="text-sm font-normal text-gray-400">/月</span>
              </div>
              <p className="text-sm text-gray-400 mt-1">
                次回請求: {formatDate(data.next_billing_date)}
              </p>
            </CardContent>
          </Card>

          <Card variant="glass">
            <CardContent>
              <p className="text-sm text-gray-300 mb-2">認証回数</p>
              <div className="text-2xl font-bold text-white">
                {data.verification_count || 0}
                <span className="text-sm font-normal text-gray-400"> 回</span>
              </div>
              <p className="text-sm text-gray-400 mt-1">
                デバイス認証の累計
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Account Information */}
        <Card variant="glass" className="mb-6">
          <CardHeader>
            <CardTitle>アカウント情報</CardTitle>
            <CardDescription>登録情報と契約状態</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-gray-400 mb-1">メールアドレス</p>
                  <p className="text-white font-medium">{data.email}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-400 mb-1">現在のデバイス</p>
                  <p className="font-mono text-sm bg-dark-card p-2 rounded border border-dark-border text-matrix">
                    {data.device_hash}
                  </p>
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-gray-400 mb-1">PayPal サブスクリプションID</p>
                  <p className="font-mono text-xs text-gray-300">
                    {data.paypal_subscription_id || 'なし'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-400 mb-1">契約プラン</p>
                  <div className="flex items-center gap-2">
                    <Badge variant="matrix" size="md">
                      スタンダード
                    </Badge>
                    <span className="text-white">月額 ¥{data.amount_jpy?.toLocaleString() || '2,980'}</span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Device Management */}
        <Card variant="glass" className="mb-6">
          <CardHeader>
            <CardTitle>デバイス管理</CardTitle>
            <CardDescription>登録デバイスの変更</CardDescription>
          </CardHeader>
          <CardContent>
            {!showDeviceChangeForm ? (
              <div>
                <p className="text-gray-300 mb-4">
                  契約が有効な間は、別のデバイスに変更することができます。
                  デバイスハッシュは AutoTouch の main.lua 実行時に表示されます。
                </p>
                {(data.license_valid && (data.device_status === 'active' || data.device_status === 'trial')) ? (
                  <Button
                    onClick={() => setShowDeviceChangeForm(true)}
                    variant="gradient"
                    size="md"
                  >
                    デバイスを変更
                  </Button>
                ) : (
                  <div className="text-sm text-gray-500">
                    デバイス変更は契約有効期間中のみ利用できます
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    新しいデバイスハッシュ
                  </label>
                  <input
                    type="text"
                    value={newDeviceHash}
                    onChange={(e) => setNewDeviceHash(e.target.value)}
                    placeholder="新しいデバイスハッシュを入力"
                    className="w-full px-4 py-3 bg-white/10 backdrop-blur-md border border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-matrix focus:border-transparent text-white placeholder-gray-400 transition"
                    disabled={changingDevice}
                  />
                </div>
                <div className="bg-warning/10 border border-warning/30 p-4 rounded-lg">
                  <p className="font-medium text-warning mb-2">⚠️ 注意事項</p>
                  <ul className="space-y-1 text-sm text-gray-300">
                    <li>• デバイス変更後は新しいデバイスでのみご利用いただけます</li>
                    <li>• 現在のデバイスでは利用できなくなります</li>
                    <li>• デバイスハッシュは main.lua 実行時に表示されます</li>
                  </ul>
                </div>
                <div className="flex gap-3">
                  <Button
                    onClick={handleDeviceChange}
                    disabled={changingDevice || !newDeviceHash.trim()}
                    variant="glow"
                    size="md"
                    loading={changingDevice}
                  >
                    デバイス変更を実行
                  </Button>
                  <Button
                    onClick={() => {
                      setShowDeviceChangeForm(false)
                      setNewDeviceHash('')
                      setError('')
                    }}
                    disabled={changingDevice}
                    variant="outline"
                    size="md"
                  >
                    キャンセル
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Actions */}
        <Card variant="glass">
          <CardHeader>
            <CardTitle>アクション</CardTitle>
            <CardDescription>契約の管理</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
              <div className="space-y-3">
                {data.subscription_status === 'active' && (
                  <Button
                    onClick={handleCancelSubscription}
                    disabled={cancelling}
                    variant="outline"
                    size="md"
                    loading={cancelling}
                    className="border-error text-error hover:bg-error hover:text-white"
                  >
                    サブスクリプションを解約
                  </Button>
                )}
                {data.device_status === 'expired' && (
                  <Link href="/register">
                    <Button variant="gradient" size="md">
                      再登録して利用を再開
                    </Button>
                  </Link>
                )}
              </div>
              <div className="text-sm text-gray-400">
                <p className="mb-1">お困りの場合は</p>
                <a href="mailto:support@metacube.app" className="text-matrix hover:text-matrix-light">
                  support@metacube.app
                </a>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quick Links */}
        <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Link href="/">
            <Card variant="glass" hoverable className="text-center">
              <CardContent className="py-6">
                <div className="text-2xl mb-2">🏠</div>
                <p className="text-white">ホーム</p>
              </CardContent>
            </Card>
          </Link>
          <a href="#" onClick={(e) => { e.preventDefault(); alert('ヘルプセンターは準備中です') }}>
            <Card variant="glass" hoverable className="text-center">
              <CardContent className="py-6">
                <div className="text-2xl mb-2">❓</div>
                <p className="text-white">ヘルプセンター</p>
              </CardContent>
            </Card>
          </a>
          <a href="mailto:support@metacube.app">
            <Card variant="glass" hoverable className="text-center">
              <CardContent className="py-6">
                <div className="text-2xl mb-2">📧</div>
                <p className="text-white">サポート</p>
              </CardContent>
            </Card>
          </a>
        </div>
      </div>
    </div>
  )
}