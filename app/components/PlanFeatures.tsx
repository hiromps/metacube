'use client'

import { Badge } from '@/app/components/ui/Badge'
import { Card, CardContent } from '@/app/components/ui/Card'
import { PlanInfo } from '@/app/hooks/useUserData'

interface PlanFeaturesProps {
  plan: PlanInfo | null
  isActive?: boolean
}

// プランごとの機能定義
const planFeatures = {
  starter: [
    { key: 'timeline.lua', name: 'タイムライン自動いいね', available: true },
    { key: 'follow.lua', name: 'フォロー', available: true },
    { key: 'hashtaglike.lua', name: 'ハッシュタグいいね', available: true },
    { key: 'activelike.lua', name: 'アクティブいいね', available: false },
    { key: 'dm.lua', name: 'DM送信', available: false }
  ],
  pro: [
    { key: 'timeline.lua', name: 'タイムライン自動いいね', available: true },
    { key: 'follow.lua', name: 'フォロー', available: true },
    { key: 'hashtaglike.lua', name: 'ハッシュタグいいね', available: true },
    { key: 'activelike.lua', name: 'アクティブいいね', available: true },
    { key: 'dm.lua', name: 'DM送信', available: false }
  ],
  max: [
    { key: 'timeline.lua', name: 'タイムライン自動いいね', available: true },
    { key: 'follow.lua', name: 'フォロー', available: true },
    { key: 'hashtaglike.lua', name: 'ハッシュタグいいね', available: true },
    { key: 'activelike.lua', name: 'アクティブいいね', available: true },
    { key: 'dm.lua', name: 'DM送信', available: true }
  ],
  trial: [
    { key: 'timeline.lua', name: 'タイムライン自動いいね', available: true },
    { key: 'follow.lua', name: 'フォロー', available: true },
    { key: 'hashtaglike.lua', name: 'ハッシュタグいいね', available: false },
    { key: 'activelike.lua', name: 'アクティブいいね', available: false },
    { key: 'dm.lua', name: 'DM送信', available: false }
  ]
}

// プランごとの制限定義
const planLimitations = {
  starter: {
    daily_actions: 1000,
    concurrent_sessions: 1,
    advanced_features: false
  },
  pro: {
    daily_actions: 5000,
    concurrent_sessions: 2,
    advanced_features: true
  },
  max: {
    daily_actions: -1, // 無制限
    concurrent_sessions: 5,
    advanced_features: true
  },
  trial: {
    daily_actions: 100,
    concurrent_sessions: 1,
    advanced_features: false
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

          {/* Plan Limitations */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-white/10 border border-white/20 p-4 rounded-xl backdrop-blur-sm">
              <div className="text-sm text-white/70 mb-1">1日の実行回数</div>
              <div className="text-white font-bold text-lg">
                {limitations.daily_actions === -1 ? '無制限' : `${limitations.daily_actions}回`}
              </div>
            </div>
            <div className="bg-white/10 border border-white/20 p-4 rounded-xl backdrop-blur-sm">
              <div className="text-sm text-white/70 mb-1">同時実行セッション</div>
              <div className="text-white font-bold text-lg">{limitations.concurrent_sessions}セッション</div>
            </div>
            <div className="bg-white/10 border border-white/20 p-4 rounded-xl backdrop-blur-sm">
              <div className="text-sm text-white/70 mb-1">高度な機能</div>
              <div className={`font-bold text-lg ${limitations.advanced_features ? 'text-green-400' : 'text-red-400'}`}>
                {limitations.advanced_features ? '利用可能' : '制限あり'}
              </div>
            </div>
          </div>

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
                      上位プランで利用可能
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