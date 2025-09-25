'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/Card'
import { Button } from '@/app/components/ui/Button'
import { Badge } from '@/app/components/ui/Badge'
import { supabase } from '@/lib/supabase/client'

interface Plan {
  id: string
  name: string
  price: number
  originalPrice?: number
  features: string[]
  popular?: boolean
  stripePriceId: string
}

const plans: Plan[] = [
  {
    id: 'starter',
    name: 'STARTER',
    price: 2980,
    features: [
      'タイムライン自動いいね',
      'フォロー機能',
      'ハッシュタグいいね',
      '基本サポート'
    ],
    stripePriceId: 'price_starter_monthly'
  },
  {
    id: 'pro',
    name: 'PRO',
    price: 8800,
    originalPrice: 9800,
    features: [
      'STARTER機能すべて',
      'アクティブいいね',
      'より高速な実行',
      '優先サポート'
    ],
    popular: true,
    stripePriceId: 'price_pro_monthly'
  },
  {
    id: 'max',
    name: 'MAX',
    price: 15000,
    originalPrice: 18000,
    features: [
      'PRO機能すべて',
      'DM送信機能',
      '無制限実行',
      'カスタム設定',
      '24時間サポート'
    ],
    stripePriceId: 'price_max_monthly'
  }
]

interface SubscriptionPlansCardProps {
  onSelectPlan?: (planId: string, stripePriceId: string) => void
}

export default function SubscriptionPlansCard({ onSelectPlan }: SubscriptionPlansCardProps) {
  const [selectedPlan, setSelectedPlan] = useState<string>('pro')
  const [loading, setLoading] = useState<string | null>(null)

  const handleSelectPlan = async (planId: string, stripePriceId: string) => {
    if (loading) return

    setLoading(planId)

    try {
      // Supabaseから認証トークンを取得
      const { data: { session } } = await supabase.auth.getSession()

      if (!session?.access_token) {
        throw new Error('認証が必要です。再度ログインしてください。')
      }

      // Stripeチェックアウトセッション作成
      const response = await fetch('/api/stripe/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          priceId: stripePriceId,
          planId: planId
        })
      })

      const { sessionId, error } = await response.json()

      if (error) {
        throw new Error(error)
      }

      // Stripeチェックアウトにリダイレクト
      const stripe = (window as any).Stripe?.(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY)
      if (stripe) {
        await stripe.redirectToCheckout({ sessionId })
      } else {
        // Stripe.jsが読み込まれていない場合、直接URLにリダイレクト
        window.location.href = `https://checkout.stripe.com/pay/${sessionId}`
      }
    } catch (error: any) {
      console.error('Subscription error:', error)
      alert(`エラーが発生しました: ${error.message}`)
    } finally {
      setLoading(null)
    }

    if (onSelectPlan) {
      onSelectPlan(planId, stripePriceId)
    }
  }

  return (
    <Card className="bg-gradient-to-br from-purple-900/40 via-pink-900/30 to-red-900/40 backdrop-blur-xl border border-purple-400/20 shadow-xl shadow-purple-500/10">
      <CardHeader>
        <div className="text-center">
          <CardTitle className="text-xl md:text-2xl font-bold bg-gradient-to-r from-white to-purple-200 bg-clip-text text-transparent mb-2">
            🚀 有料プランで本格運用
          </CardTitle>
          <p className="text-white/70 text-sm md:text-base">
            3日間体験後は有料プランでSMARTGRAMをフル活用
          </p>
          <Badge className="bg-gradient-to-r from-purple-500/20 to-pink-500/20 text-purple-300 border-purple-400/30 mt-2">
            月額サブスクリプション
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="p-4 md:p-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className={`relative p-4 rounded-xl border transition-all cursor-pointer ${
                selectedPlan === plan.id
                  ? 'bg-gradient-to-br from-purple-500/20 to-pink-500/20 border-purple-400/50 shadow-lg shadow-purple-500/20'
                  : 'bg-white/5 border-white/20 hover:border-white/30'
              } ${plan.popular ? 'ring-2 ring-purple-400/30' : ''}`}
              onClick={() => setSelectedPlan(plan.id)}
            >
              {plan.popular && (
                <Badge className="absolute -top-2 left-1/2 transform -translate-x-1/2 bg-gradient-to-r from-purple-500 to-pink-500 text-white">
                  人気
                </Badge>
              )}

              <div className="text-center mb-4">
                <h3 className="font-bold text-white text-lg mb-1">{plan.name}</h3>
                <div className="flex items-center justify-center gap-2">
                  <span className="text-2xl font-bold text-white">¥{plan.price.toLocaleString()}</span>
                  {plan.originalPrice && (
                    <span className="text-sm text-white/50 line-through">¥{plan.originalPrice.toLocaleString()}</span>
                  )}
                </div>
                <p className="text-xs text-white/60">/ 月</p>
              </div>

              <ul className="space-y-2 mb-4">
                {plan.features.map((feature, index) => (
                  <li key={index} className="flex items-center text-sm text-white/80">
                    <span className="w-4 h-4 rounded-full bg-purple-500/30 flex items-center justify-center mr-2 flex-shrink-0">
                      <span className="w-1.5 h-1.5 rounded-full bg-purple-400"></span>
                    </span>
                    {feature}
                  </li>
                ))}
              </ul>

              <div className="text-center">
                <div className={`w-4 h-4 rounded-full border-2 mx-auto ${
                  selectedPlan === plan.id
                    ? 'border-purple-400 bg-purple-400'
                    : 'border-white/30'
                }`}>
                  {selectedPlan === plan.id && (
                    <div className="w-2 h-2 rounded-full bg-white m-0.5"></div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="text-center">
          <Button
            onClick={() => {
              const plan = plans.find(p => p.id === selectedPlan)
              if (plan) {
                handleSelectPlan(plan.id, plan.stripePriceId)
              }
            }}
            disabled={loading !== null}
            className="bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:from-purple-600 hover:to-pink-600 shadow-xl hover:shadow-2xl transition-all px-8 py-3 text-lg font-medium"
            size="lg"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                </svg>
                処理中...
              </span>
            ) : (
              `${plans.find(p => p.id === selectedPlan)?.name}プランで契約する`
            )}
          </Button>

          <p className="text-xs text-white/60 mt-4">
            💳 Stripe決済で安全にお支払い • いつでもキャンセル可能
          </p>
        </div>

        <div className="mt-6 p-4 bg-black/20 border border-white/10 rounded-xl backdrop-blur-sm">
          <h4 className="font-medium text-white mb-2 text-sm">💡 プラン選びのヒント</h4>
          <ul className="text-xs text-white/70 space-y-1">
            <li>• 初心者の方はSTARTERプランがおすすめ</li>
            <li>• より多くの機能が必要な場合はPROプランが人気</li>
            <li>• 本格運用・法人利用にはMAXプランが最適</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  )
}