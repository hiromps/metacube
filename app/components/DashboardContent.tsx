'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase/client'
import { signOut } from '@/lib/auth/client'
import { Button } from '@/app/components/ui/Button'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/app/components/ui/Card'
import { Badge } from '@/app/components/ui/Badge'
import { LoadingScreen } from '@/app/components/LoadingScreen'
import { isAdminEmail } from '@/lib/auth/admin'
import { useSearchParams } from 'next/navigation'

// Types for the new database structure
interface DashboardData {
  device: {
    id: string
    hash: string
    model: string
    status: string
    created_at: string
  }
  subscription: {
    id: string | null
    status: string | null
    plan_id: string | null
    amount: number | null
    billing_cycle: string | null
    next_billing_date: string | null
    cancelled_at: string | null
    paypal_subscription_id: string | null
  }
  plan: {
    id: string
    name: string
    price: number
    features: string[]
    max_automation_hours: number
    priority_support: boolean
  }
  access: {
    has_access: boolean
    access_level: string
    is_trial_active: boolean
    trial_days_remaining: number
    status_display: string
  }
  billing: {
    next_billing_date: string | null
    days_until_billing: number | null
    current_amount: number
  }
  summary: {
    user_id: string
    active_subscription: boolean
    can_upgrade: boolean
    can_cancel: boolean
  }
}

interface Plan {
  id: string
  name: string
  price_jpy: number
  features: string[]
  max_automation_hours: number
  priority_support: boolean
  annual_discount_rate: number | null
}

export default function DashboardContent() {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null)
  const [availablePlans, setAvailablePlans] = useState<Plan[]>([])
  const [selectedSection, setSelectedSection] = useState('overview')
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [error, setError] = useState<string>('')
  const [success, setSuccess] = useState<string>('')
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()

  // Load user and dashboard data
  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      setError('')

      // Get current user
      const { data: { user: currentUser } } = await supabase.auth.getUser()
      if (!currentUser) {
        router.push('/login')
        return
      }

      setUser(currentUser)

      // Load dashboard data
      const dashboardResponse = await fetch('/api/user/dashboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: currentUser.id })
      })

      console.log('Dashboard response status:', dashboardResponse.status)
      console.log('Dashboard response headers:', Object.fromEntries(dashboardResponse.headers.entries()))

      if (!dashboardResponse.ok) {
        const errorText = await dashboardResponse.text()
        console.error('Dashboard API error:', errorText)
        throw new Error(`ダッシュボードデータの読み込みに失敗しました (${dashboardResponse.status})`)
      }

      const dashboardResult = await dashboardResponse.json()
      if (!dashboardResult.success) {
        throw new Error(dashboardResult.error || 'データの取得に失敗しました')
      }

      setDashboardData(dashboardResult.data)

      // Load available plans
      const plansResponse = await fetch('/api/dashboard/plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      })

      if (plansResponse.ok) {
        const plansResult = await plansResponse.json()
        if (plansResult.success) {
          setAvailablePlans(plansResult.data)
        }
      }

    } catch (error) {
      console.error('Data loading error:', error)
      setError(error instanceof Error ? error.message : 'データの読み込み中にエラーが発生しました')
    } finally {
      setLoading(false)
    }
  }, [router])

  // Initial load
  useEffect(() => {
    loadData()
  }, [loadData])

  // Handle plan change
  const handlePlanChange = async (newPlanId: string) => {
    if (!dashboardData) return

    try {
      setActionLoading(`plan-${newPlanId}`)
      setError('')

      const response = await fetch('/api/dashboard/plan-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user.id,
          device_hash: dashboardData.device.hash,
          new_plan_id: newPlanId
        })
      })

      const result = await response.json()
      if (!result.success) {
        throw new Error(result.error || 'プラン変更に失敗しました')
      }

      setSuccess(result.message)
      await loadData() // Reload data

    } catch (error) {
      setError(error instanceof Error ? error.message : 'プラン変更中にエラーが発生しました')
    } finally {
      setActionLoading(null)
    }
  }

  // Handle subscription cancellation
  const handleCancelSubscription = async () => {
    if (!dashboardData || !showCancelConfirm) return

    try {
      setActionLoading('cancel')
      setError('')

      const response = await fetch('/api/dashboard/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user.id,
          device_hash: dashboardData.device.hash
        })
      })

      const result = await response.json()
      if (!result.success) {
        throw new Error(result.error || '解約処理に失敗しました')
      }

      setSuccess('サブスクリプションを解約しました')
      setShowCancelConfirm(false)
      await loadData() // Reload data

    } catch (error) {
      setError(error instanceof Error ? error.message : '解約処理中にエラーが発生しました')
    } finally {
      setActionLoading(null)
    }
  }

  // Handle logout
  const handleLogout = async () => {
    try {
      await signOut()
      router.push('/')
    } catch (error) {
      console.error('Logout error:', error)
    }
  }

  // Format date for display
  const formatDate = (dateString: string | null) => {
    if (!dateString) return '未設定'
    return new Date(dateString).toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  // Get status badge variant
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'アクティブ':
        return 'default'
      case 'トライアル中':
      case 'トライアル期間':
        return 'secondary'
      case '解約済み':
      case '期限切れ':
        return 'destructive'
      case '支払い遅延':
        return 'warning'
      default:
        return 'secondary'
    }
  }

  if (loading) {
    return <LoadingScreen />
  }

  if (!dashboardData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center p-4">
        <Card className="w-full max-w-md bg-white/10 backdrop-blur-sm border-white/20">
          <CardContent className="p-6 text-center">
            <p className="text-white text-lg mb-4">データの読み込みに失敗しました</p>
            {error && (
              <p className="text-red-300 text-sm mb-4">{error}</p>
            )}
            <Button onClick={loadData} className="w-full">
              再試行
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const sidebarItems = [
    { id: 'overview', label: 'ダッシュボード', icon: '📊' },
    { id: 'plan', label: 'プラン・契約', icon: '💎' },
    { id: 'device', label: 'デバイス', icon: '📱' },
    { id: 'billing', label: '請求・支払い', icon: '💳' },
    { id: 'support', label: 'サポート', icon: '💬' }
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900">
      {/* Header */}
      <div className="bg-black/20 backdrop-blur-sm border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <h1 className="text-2xl font-bold text-white">SMARTGRAM Dashboard</h1>
              <Badge variant={getStatusBadge(dashboardData.access.status_display)}>
                {dashboardData.access.status_display}
              </Badge>
            </div>
            <div className="flex items-center space-x-4">
              {isAdminEmail(user?.email) && (
                <Link href="/admin" className="text-blue-300 hover:text-blue-200">
                  管理画面
                </Link>
              )}
              <Button variant="ghost" onClick={handleLogout} className="text-white">
                ログアウト
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Messages */}
        {error && (
          <div className="mb-6 p-4 bg-red-500/20 border border-red-500/30 rounded-lg text-red-100">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-6 p-4 bg-green-500/20 border border-green-500/30 rounded-lg text-green-100">
            {success}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar */}
          <div className="lg:col-span-1">
            <Card className="bg-white/10 backdrop-blur-sm border-white/20">
              <CardHeader>
                <CardTitle className="text-white text-lg">メニュー</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <nav className="space-y-1">
                  {sidebarItems.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => setSelectedSection(item.id)}
                      className={`w-full px-4 py-3 text-left flex items-center space-x-3 transition-colors ${
                        selectedSection === item.id
                          ? 'bg-white/20 text-white border-r-2 border-blue-400'
                          : 'text-white/70 hover:bg-white/10 hover:text-white'
                      }`}
                    >
                      <span className="text-lg">{item.icon}</span>
                      <span>{item.label}</span>
                    </button>
                  ))}
                </nav>
              </CardContent>
            </Card>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3">
            {selectedSection === 'overview' && (
              <div className="space-y-6">
                {/* Quick Status */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <Card className="bg-white/10 backdrop-blur-sm border-white/20">
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-white/70 text-sm">アクセス状況</p>
                          <p className="text-white text-xl font-semibold">
                            {dashboardData.access.has_access ? '利用可能' : '利用不可'}
                          </p>
                        </div>
                        <div className="text-3xl">
                          {dashboardData.access.has_access ? '✅' : '❌'}
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-white/10 backdrop-blur-sm border-white/20">
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-white/70 text-sm">現在のプラン</p>
                          <p className="text-white text-xl font-semibold">
                            {dashboardData.plan.name}
                          </p>
                        </div>
                        <div className="text-3xl">💎</div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-white/10 backdrop-blur-sm border-white/20">
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-white/70 text-sm">
                            {dashboardData.access.is_trial_active ? 'トライアル残り' : '月額料金'}
                          </p>
                          <p className="text-white text-xl font-semibold">
                            {dashboardData.access.is_trial_active
                              ? `${dashboardData.access.trial_days_remaining}日`
                              : `¥${dashboardData.plan.price.toLocaleString()}`
                            }
                          </p>
                        </div>
                        <div className="text-3xl">
                          {dashboardData.access.is_trial_active ? '⏰' : '💰'}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Features */}
                <Card className="bg-white/10 backdrop-blur-sm border-white/20">
                  <CardHeader>
                    <CardTitle className="text-white">利用可能機能</CardTitle>
                    <CardDescription className="text-white/70">
                      現在のプランで使用できる機能一覧
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {dashboardData.plan.features.map((feature) => (
                        <div
                          key={feature}
                          className="flex items-center space-x-3 p-3 bg-white/5 rounded-lg"
                        >
                          <span className="text-green-400">✓</span>
                          <span className="text-white">{feature}</span>
                        </div>
                      ))}
                    </div>
                    <div className="mt-4 p-4 bg-blue-500/20 rounded-lg">
                      <div className="flex items-center justify-between text-white">
                        <span>1日の自動化制限</span>
                        <span className="font-semibold">
                          {dashboardData.plan.max_automation_hours}時間
                        </span>
                      </div>
                    </div>
                    {dashboardData.plan.priority_support && (
                      <div className="mt-2 p-4 bg-purple-500/20 rounded-lg">
                        <div className="flex items-center space-x-2 text-white">
                          <span>⭐</span>
                          <span>優先サポート対象</span>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}

            {selectedSection === 'plan' && (
              <div className="space-y-6">
                {/* Current Plan */}
                <Card className="bg-white/10 backdrop-blur-sm border-white/20">
                  <CardHeader>
                    <CardTitle className="text-white">現在のプラン</CardTitle>
                    <CardDescription className="text-white/70">
                      {dashboardData.plan.name} - ¥{dashboardData.plan.price.toLocaleString()}/月
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <p className="text-white/70 text-sm">契約状況</p>
                        <Badge variant={getStatusBadge(dashboardData.access.status_display)}>
                          {dashboardData.access.status_display}
                        </Badge>
                      </div>
                      {dashboardData.billing.next_billing_date && (
                        <div>
                          <p className="text-white/70 text-sm">次回請求日</p>
                          <p className="text-white">
                            {formatDate(dashboardData.billing.next_billing_date)}
                          </p>
                        </div>
                      )}
                    </div>
                    {dashboardData.summary.can_cancel && (
                      <div className="pt-4 border-t border-white/10">
                        <Button
                          onClick={() => setShowCancelConfirm(true)}
                          variant="destructive"
                          disabled={actionLoading === 'cancel'}
                        >
                          {actionLoading === 'cancel' ? '解約処理中...' : 'サブスクリプション解約'}
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Available Plans */}
                {dashboardData.summary.can_upgrade && (
                  <Card className="bg-white/10 backdrop-blur-sm border-white/20">
                    <CardHeader>
                      <CardTitle className="text-white">プラン変更</CardTitle>
                      <CardDescription className="text-white/70">
                        より高機能なプランにアップグレードできます
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {availablePlans.map((plan) => (
                          <div
                            key={plan.id}
                            className={`p-4 rounded-lg border ${
                              plan.id === dashboardData.plan.id
                                ? 'bg-blue-500/20 border-blue-400'
                                : 'bg-white/5 border-white/20'
                            }`}
                          >
                            <div className="text-center space-y-3">
                              <h3 className="text-white font-semibold">{plan.name}</h3>
                              <p className="text-2xl text-white font-bold">
                                ¥{plan.price_jpy.toLocaleString()}
                              </p>
                              <p className="text-white/70 text-sm">
                                {plan.max_automation_hours}時間/日
                              </p>
                              {plan.id !== dashboardData.plan.id && (
                                <Button
                                  onClick={() => handlePlanChange(plan.id)}
                                  disabled={!!actionLoading}
                                  className="w-full"
                                  size="sm"
                                >
                                  {actionLoading === `plan-${plan.id}` ? '変更中...' : '変更'}
                                </Button>
                              )}
                              {plan.id === dashboardData.plan.id && (
                                <Badge variant="default" className="w-full py-1">
                                  現在のプラン
                                </Badge>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}

            {selectedSection === 'device' && (
              <Card className="bg-white/10 backdrop-blur-sm border-white/20">
                <CardHeader>
                  <CardTitle className="text-white">デバイス情報</CardTitle>
                  <CardDescription className="text-white/70">
                    登録されているデバイスの詳細情報
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <p className="text-white/70 text-sm mb-2">デバイスハッシュ</p>
                      <p className="text-white font-mono bg-white/10 p-3 rounded text-sm break-all">
                        {dashboardData.device.hash}
                      </p>
                    </div>
                    <div>
                      <p className="text-white/70 text-sm mb-2">デバイスモデル</p>
                      <p className="text-white">{dashboardData.device.model}</p>
                    </div>
                    <div>
                      <p className="text-white/70 text-sm mb-2">登録日</p>
                      <p className="text-white">{formatDate(dashboardData.device.created_at)}</p>
                    </div>
                    <div>
                      <p className="text-white/70 text-sm mb-2">ステータス</p>
                      <Badge variant={getStatusBadge(dashboardData.device.status)}>
                        {dashboardData.device.status}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {selectedSection === 'billing' && (
              <Card className="bg-white/10 backdrop-blur-sm border-white/20">
                <CardHeader>
                  <CardTitle className="text-white">請求・支払い情報</CardTitle>
                  <CardDescription className="text-white/70">
                    サブスクリプションの請求状況
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <p className="text-white/70 text-sm mb-2">現在の月額料金</p>
                      <p className="text-white text-2xl font-bold">
                        ¥{dashboardData.billing.current_amount.toLocaleString()}
                      </p>
                    </div>
                    {dashboardData.billing.next_billing_date && (
                      <div>
                        <p className="text-white/70 text-sm mb-2">次回請求日</p>
                        <p className="text-white text-lg">
                          {formatDate(dashboardData.billing.next_billing_date)}
                          {dashboardData.billing.days_until_billing !== null && (
                            <span className="text-white/70 text-sm ml-2">
                              ({dashboardData.billing.days_until_billing}日後)
                            </span>
                          )}
                        </p>
                      </div>
                    )}
                  </div>
                  {dashboardData.subscription.paypal_subscription_id && (
                    <div className="p-4 bg-white/5 rounded-lg">
                      <p className="text-white/70 text-sm">支払い方法</p>
                      <p className="text-white">PayPal</p>
                      <p className="text-white/50 text-xs mt-1 font-mono">
                        ID: {dashboardData.subscription.paypal_subscription_id}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {selectedSection === 'support' && (
              <Card className="bg-white/10 backdrop-blur-sm border-white/20">
                <CardHeader>
                  <CardTitle className="text-white">サポート情報</CardTitle>
                  <CardDescription className="text-white/70">
                    {dashboardData.plan.priority_support ? '優先サポート対象です' : '標準サポート'}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="p-4 bg-white/5 rounded-lg">
                    <h3 className="text-white font-semibold mb-2">サポート内容</h3>
                    <ul className="text-white/70 space-y-2">
                      <li>• メールサポート（24時間以内の回答）</li>
                      {dashboardData.plan.priority_support && (
                        <>
                          <li>• 優先対応（12時間以内の回答）</li>
                          <li>• 専用サポートライン</li>
                        </>
                      )}
                      <li>• FAQ・よくある質問集</li>
                      <li>• 使用方法のガイド</li>
                    </ul>
                  </div>
                  <div className="p-4 bg-blue-500/20 rounded-lg">
                    <h3 className="text-white font-semibold mb-2">お問い合わせ</h3>
                    <p className="text-white/70 mb-2">
                      サポートが必要な場合は、以下の方法でお気軽にお問い合わせください。
                    </p>
                    <div className="space-y-2">
                      <p className="text-white">📧 support@smartgram.jp</p>
                      {dashboardData.plan.priority_support && (
                        <p className="text-white">📞 優先サポート: 050-XXXX-XXXX</p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>

      {/* Cancel Confirmation Modal */}
      {showCancelConfirm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-md bg-white/10 backdrop-blur-sm border-white/20">
            <CardHeader>
              <CardTitle className="text-white">サブスクリプション解約</CardTitle>
              <CardDescription className="text-white/70">
                本当に解約しますか？解約すると即座に利用できなくなります。
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-red-500/20 rounded-lg">
                <p className="text-red-200 text-sm">
                  • 解約後は即座にサービスが利用できなくなります<br/>
                  • 既に支払い済みの料金は返金されません<br/>
                  • 再度利用するには新規契約が必要です
                </p>
              </div>
              <div className="flex space-x-3">
                <Button
                  onClick={() => setShowCancelConfirm(false)}
                  variant="ghost"
                  className="flex-1 text-white"
                  disabled={actionLoading === 'cancel'}
                >
                  キャンセル
                </Button>
                <Button
                  onClick={handleCancelSubscription}
                  variant="destructive"
                  className="flex-1"
                  disabled={actionLoading === 'cancel'}
                >
                  {actionLoading === 'cancel' ? '解約中...' : '解約する'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}