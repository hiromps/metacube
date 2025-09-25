'use client'

import { Badge } from '@/app/components/ui/Badge'
import { Card, CardContent } from '@/app/components/ui/Card'
import { PlanInfo } from '@/app/hooks/useUserData'

interface PlanFeaturesProps {
  plan: PlanInfo | null
  isActive?: boolean
}

// プランごとの機能定義（plans/page.tsxに基づく）
const planFeatures = {
  starter: [
    { key: 'timeline.lua', name: 'タイムライン自動いいね', available: true },
    { key: 'hashtaglike.lua', name: 'ハッシュタグいいね', available: true },
    { key: 'follow.lua', name: '自動フォロー', available: false },
    { key: 'unfollow.lua', name: '自動アンフォロー', available: false },
    { key: 'activelike.lua', name: 'アクティブユーザーいいね', available: false }
  ],
  pro: [
    { key: 'timeline.lua', name: 'タイムライン自動いいね', available: true },
    { key: 'hashtaglike.lua', name: 'ハッシュタグいいね', available: true },
    { key: 'follow.lua', name: '自動フォロー', available: true },
    { key: 'unfollow.lua', name: '自動アンフォロー', available: true },
    { key: 'activelike.lua', name: 'アクティブユーザーいいね', available: false }
  ],
  max: [
    { key: 'timeline.lua', name: 'タイムライン自動いいね', available: true },
    { key: 'hashtaglike.lua', name: 'ハッシュタグいいね', available: true },
    { key: 'follow.lua', name: '自動フォロー', available: true },
    { key: 'unfollow.lua', name: '自動アンフォロー', available: true },
    { key: 'activelike.lua', name: 'アクティブユーザーいいね', available: true }
  ],
  trial: [
    { key: 'timeline.lua', name: 'タイムライン自動いいね', available: true },
    { key: 'hashtaglike.lua', name: 'ハッシュタグいいね', available: true },
    { key: 'follow.lua', name: '自動フォロー', available: false },
    { key: 'unfollow.lua', name: '自動アンフォロー', available: false },
    { key: 'activelike.lua', name: 'アクティブユーザーいいね', available: false }
  ]
}

// プランごとの制限定義（回数制限なし）
const planLimitations = {
  starter: {
    price: '¥2,980',
    support: 'LINEサポート30日間',
    trial_days: 3
  },
  pro: {
    price: '¥6,980',
    original_price: '¥9,980',
    support: 'LINEサポート90日間',
    trial_days: 3,
    time_savings: '月40時間節約'
  },
  max: {
    price: '¥15,800',
    original_price: '¥19,800',
    support: '24時間電話サポート',
    trial_days: 3,
    time_savings: '月160時間節約'
  },
  trial: {
    price: '無料',
    support: '基本サポート',
    trial_days: 3
  }
}

export default function PlanFeatures({ plan, isActive = true }: PlanFeaturesProps) {
  if (!plan) {
    return (
      <div className="space-y-4 md:space-y-6">
        <div className="bg-gradient-to-br from-gray-800/30 via-slate-800/20 to-zinc-800/30 backdrop-blur-xl border border-white/20 shadow-lg rounded-2xl p-4 md:p-6">
          <div className="text-center py-8">
            <div className="text-4xl mb-4">⏳</div>
            <h3 className="text-lg text-white mb-2">プラン情報を読み込み中...</h3>
            <p className="text-white/70 text-sm">しばらくお待ちください</p>
          </div>
        </div>
      </div>
    )
  }

  const planName = plan.name || 'trial'
  const features = planFeatures[planName as keyof typeof planFeatures] || planFeatures.trial
  const limitations = planLimitations[planName as keyof typeof planLimitations] || planLimitations.trial

  const getPlanColor = (planName: string) => {
    switch (planName) {
      case 'starter':
        return 'from-blue-800/30 via-indigo-800/20 to-purple-800/30'
      case 'pro':
        return 'from-purple-800/30 via-violet-800/20 to-indigo-800/30'
      case 'max':
        return 'from-orange-800/30 via-amber-800/20 to-yellow-800/30'
      case 'trial':
        return 'from-gray-800/30 via-slate-800/20 to-zinc-800/30'
      default:
        return 'from-gray-800/30 via-slate-800/20 to-zinc-800/30'
    }
  }

  const getPlanIcon = (planName: string) => {
    switch (planName) {
      case 'starter': return '📱'
      case 'pro': return '🚀'
      case 'max': return '👑'
      case 'trial': return '🎯'
      default: return '📋'
    }
  }

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Plan Overview */}
      <Card className={`bg-gradient-to-br ${getPlanColor(planName)} backdrop-blur-xl border border-white/20 shadow-lg`}>
        <CardContent className="p-4 md:p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <span className="text-3xl">{getPlanIcon(planName)}</span>
              <div>
                <h3 className="text-lg md:text-xl font-semibold text-white">
                  {plan?.display_name || '無料体験'}プランの機能
                </h3>
                <p className="text-white/70 text-sm">
                  利用可能な機能と制限について
                </p>
              </div>
            </div>
            <Badge
              variant={isActive ? "success" : "warning"}
              className={isActive
                ? "bg-green-500/20 text-green-300 border-green-400/30"
                : "bg-yellow-500/20 text-yellow-300 border-yellow-400/30"
              }
            >
              {isActive ? 'アクティブ' : '体験中'}
            </Badge>
          </div>

          {/* Plan Information */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-white/10 border border-white/20 p-4 rounded-xl backdrop-blur-sm">
              <div className="text-sm text-white/70 mb-1">料金</div>
              <div className="text-white font-bold text-lg">
                {('original_price' in limitations) && limitations.original_price && (
                  <span className="text-sm text-gray-400 line-through mr-2">{limitations.original_price}</span>
                )}
                {limitations.price}
                {planName !== 'trial' && <span className="text-sm text-white/70">/月</span>}
              </div>
            </div>
            <div className="bg-white/10 border border-white/20 p-4 rounded-xl backdrop-blur-sm">
              <div className="text-sm text-white/70 mb-1">サポート</div>
              <div className="text-white font-bold text-sm leading-tight">{limitations.support}</div>
            </div>
            <div className="bg-white/10 border border-white/20 p-4 rounded-xl backdrop-blur-sm">
              <div className="text-sm text-white/70 mb-1">体験期間</div>
              <div className="text-white font-bold text-lg">
                {limitations.trial_days}日間無料
              </div>
            </div>
          </div>

          {('time_savings' in limitations) && limitations.time_savings && (
            <div className="bg-gradient-to-r from-green-500/20 to-emerald-500/20 border border-green-400/30 rounded-xl p-4 mb-6">
              <div className="flex items-center gap-3">
                <span className="text-2xl">⏱️</span>
                <div>
                  <div className="text-white font-semibold">{limitations.time_savings}</div>
                  <div className="text-green-300 text-sm">手動運用と比較した時間節約効果</div>
                </div>
              </div>
            </div>
          )}

          {/* Feature List */}
          <div>
            <h4 className="text-white font-medium mb-3">利用可能な機能</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {features.map((feature) => (
                <div
                  key={feature.key}
                  className={`flex items-center justify-between p-3 rounded-xl border ${
                    feature.available
                      ? 'bg-green-500/10 border-green-400/20'
                      : 'bg-red-500/10 border-red-400/20'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-lg">
                      {feature.available ? '✅' : '❌'}
                    </span>
                    <span className={`text-sm ${feature.available ? 'text-white' : 'text-white/60'}`}>
                      {feature.name}
                    </span>
                  </div>
                  {!feature.available && (
                    <Badge variant="error" className="bg-red-500/20 text-red-300 border-red-400/30 text-xs">
                      {planName === 'starter' ? 'PROプランで利用可能' : 'MAXプランで利用可能'}
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}