'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { signOut } from '@/lib/auth/client'

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

  useEffect(() => {
    checkAuth()
  }, [])

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

  const getStatusBadge = (status: string) => {
    const statusMap: { [key: string]: { label: string; color: string } } = {
      trial: { label: '体験版', color: 'bg-blue-100 text-blue-800' },
      active: { label: '有効', color: 'bg-green-100 text-green-800' },
      expired: { label: '期限切れ', color: 'bg-red-100 text-red-800' },
      suspended: { label: '停止中', color: 'bg-yellow-100 text-yellow-800' },
      pending: { label: '処理中', color: 'bg-gray-100 text-gray-800' },
      cancelled: { label: '解約済み', color: 'bg-gray-100 text-gray-800' }
    }

    const config = statusMap[status] || { label: status, color: 'bg-gray-100 text-gray-800' }

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.color}`}>
        {config.label}
      </span>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-gray-500">読み込み中...</div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="bg-white p-8 rounded-lg shadow-md">
          <p className="text-red-600">{error || 'データが見つかりません'}</p>
          <button
            onClick={() => router.push('/login')}
            className="mt-4 text-blue-500 hover:underline"
          >
            ログインページへ
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="bg-white rounded-lg shadow-md p-6">
          {/* Header */}
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold">SocialTouch ダッシュボード</h1>
            <button
              onClick={handleLogout}
              className="text-gray-500 hover:text-gray-700"
            >
              ログアウト
            </button>
          </div>

          {error && (
            <div className="mb-6 p-3 bg-red-100 text-red-700 rounded">
              {error}
            </div>
          )}

          {/* Account Information */}
          <div className="mb-8">
            <h2 className="text-lg font-semibold mb-4">アカウント情報</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600">メールアドレス</p>
                <p className="font-medium">{data.email}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">デバイスハッシュ</p>
                <p className="font-mono text-sm">{data.device_hash}</p>
              </div>
            </div>
          </div>

          {/* License Status */}
          <div className="mb-8">
            <h2 className="text-lg font-semibold mb-4">ライセンス状態</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600">ライセンス状態</p>
                <div className="flex items-center gap-2">
                  {getStatusBadge(data.device_status)}
                  {data.license_valid ? (
                    <span className="text-green-600">✓ 有効</span>
                  ) : (
                    <span className="text-red-600">✗ 無効</span>
                  )}
                </div>
              </div>
              <div>
                <p className="text-sm text-gray-600">有効期限</p>
                <p className="font-medium">
                  {data.device_status === 'trial'
                    ? `体験版: ${formatDate(data.trial_ends_at)}`
                    : formatDate(data.license_expires_at)}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">認証回数</p>
                <p className="font-medium">{data.verification_count || 0} 回</p>
              </div>
            </div>
          </div>

          {/* Subscription Information */}
          <div className="mb-8">
            <h2 className="text-lg font-semibold mb-4">サブスクリプション情報</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600">契約状態</p>
                <div>{data.subscription_status ? getStatusBadge(data.subscription_status) : '-'}</div>
              </div>
              <div>
                <p className="text-sm text-gray-600">月額料金</p>
                <p className="font-medium">¥{data.amount_jpy?.toLocaleString() || '2,980'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">次回請求日</p>
                <p className="font-medium">{formatDate(data.next_billing_date)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">PayPal ID</p>
                <p className="font-mono text-xs">{data.paypal_subscription_id || '-'}</p>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="border-t pt-6">
            <div className="flex justify-between items-center">
              <div>
                {data.subscription_status === 'active' && (
                  <button
                    onClick={handleCancelSubscription}
                    disabled={cancelling}
                    className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600 disabled:bg-gray-400"
                  >
                    {cancelling ? '処理中...' : 'サブスクリプションを解約'}
                  </button>
                )}
                {data.device_status === 'expired' && (
                  <button
                    onClick={() => router.push('/register')}
                    className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
                  >
                    再登録
                  </button>
                )}
              </div>
              <div className="text-sm text-gray-500">
                <p>サポート: support@socialtouch.app</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}