'use client'

import { useState } from 'react'
import { Button } from '@/app/components/ui/Button'
import { Card, CardHeader, CardTitle, CardContent } from '@/app/components/ui/Card'
import { Badge } from '@/app/components/ui/Badge'

interface PlanFeatures {
  timeline_lua?: boolean
  follow_lua?: boolean
  unfollow_lua?: boolean
  hashtaglike_lua?: boolean
  activelike_lua?: boolean
  priority_support?: boolean
  early_access?: boolean
  dedicated_support?: boolean
}

interface PlanInfo {
  name: string
  display_name: string
  price: number
  features: PlanFeatures
  limitations?: {
    daily_actions?: number | null
    total_actions?: number | null
    duration_days?: number | null
  }
}

interface PlanInfoCardProps {
  planInfo: PlanInfo | null
  onUpgrade?: () => void
  onDowngrade?: () => void
  isLoading?: boolean
}

const featureLabels: Record<string, string> = {
  timeline_lua: 'timeline.lua（タイムライン自動いいね）',
  follow_lua: 'follow.lua（自動フォロー）',
  unfollow_lua: 'unfollow.lua（自動アンフォロー）',
  hashtaglike_lua: 'hashtaglike.lua（ハッシュタグ自動いいね）',
  activelike_lua: 'activelike.lua（アクティブユーザー自動いいね）',
  priority_support: '優先サポート',
  early_access: '新機能早期アクセス',
  dedicated_support: '専用サポート'
}

const planColors: Record<string, string> = {
  trial: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  starter: 'bg-green-500/20 text-green-300 border-green-500/30',
  pro: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  pro_yearly: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  max: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30'
}

export function PlanInfoCard({ planInfo, onUpgrade, onDowngrade, isLoading }: PlanInfoCardProps) {
  const [showAllFeatures, setShowAllFeatures] = useState(false)

  if (!planInfo) {
    return (
      <Card className="bg-gradient-to-br from-gray-800/30 via-gray-700/20 to-slate-800/30 backdrop-blur-xl border border-gray-400/30 rounded-2xl shadow-lg shadow-gray-500/10">
        <CardHeader>
          <CardTitle className="text-lg md:text-xl text-white">プラン情報</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-white/60">プラン情報を読み込み中...</p>
        </CardContent>
      </Card>
    )
  }

  const colorClass = planColors[planInfo.name] || 'bg-white/10 text-white/70 border-white/20'
  const enabledFeatures = Object.entries(planInfo.features).filter(([_, enabled]) => enabled)
  const disabledFeatures = Object.entries(planInfo.features).filter(([_, enabled]) => !enabled)

  return (
    <Card className="bg-gradient-to-br from-indigo-800/30 via-blue-800/20 to-purple-800/30 backdrop-blur-xl border border-indigo-400/30 rounded-2xl shadow-lg shadow-indigo-500/10">
      <CardHeader>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <CardTitle className="text-lg md:text-xl text-white mb-2">
              📋 プラン情報
            </CardTitle>
            <div className="flex items-center gap-3">
              <Badge className={`${colorClass} text-sm md:text-base font-medium`}>
                {planInfo.display_name}
              </Badge>
              {planInfo.price > 0 && (
                <span className="text-white/80 text-sm md:text-base">
                  ¥{planInfo.price.toLocaleString()}
                  {planInfo.name.includes('yearly') ? '/年' : '/月'}
                </span>
              )}
            </div>
          </div>
          {(onUpgrade || onDowngrade) && (
            <div className="flex gap-2">
              {onUpgrade && (
                <Button
                  onClick={onUpgrade}
                  disabled={isLoading}
                  className="bg-gradient-to-r from-blue-500 to-purple-500 text-white hover:from-blue-600 hover:to-purple-600 shadow-xl border border-white/20 text-sm"
                  size="sm"
                >
                  プラン変更
                </Button>
              )}
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* 使用制限情報 */}
        {planInfo.limitations && (
          <div className="bg-white/10 rounded-xl p-4 border border-white/20">
            <h4 className="text-sm font-medium text-white mb-3">📊 利用制限</h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
              {planInfo.limitations.daily_actions !== null && (
                <div>
                  <span className="text-white/60">1日の実行回数</span>
                  <p className="text-white font-medium">
                    {planInfo.limitations.daily_actions || '無制限'}
                  </p>
                </div>
              )}
              {planInfo.limitations.duration_days && (
                <div>
                  <span className="text-white/60">利用期間</span>
                  <p className="text-white font-medium">
                    {planInfo.limitations.duration_days}日間
                  </p>
                </div>
              )}
              {planInfo.limitations.total_actions && (
                <div>
                  <span className="text-white/60">総実行回数</span>
                  <p className="text-white font-medium">
                    {planInfo.limitations.total_actions}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 利用可能機能 */}
        <div className="bg-green-500/10 rounded-xl p-4 border border-green-500/20">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-medium text-green-300">✅ 利用可能な機能</h4>
            {enabledFeatures.length > 3 && (
              <button
                onClick={() => setShowAllFeatures(!showAllFeatures)}
                className="text-xs text-green-400 hover:text-green-300 transition"
              >
                {showAllFeatures ? '折りたたむ' : `他${enabledFeatures.length - 3}個`}
              </button>
            )}
          </div>
          <div className="space-y-2">
            {(showAllFeatures ? enabledFeatures : enabledFeatures.slice(0, 3)).map(([feature, _]) => (
              <div key={feature} className="flex items-center gap-2">
                <span className="text-green-400">✅</span>
                <span className="text-sm text-white/80">
                  {featureLabels[feature] || feature}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* 制限されている機能 */}
        {disabledFeatures.length > 0 && (
          <div className="bg-red-500/10 rounded-xl p-4 border border-red-500/20">
            <h4 className="text-sm font-medium text-red-300 mb-3">❌ 制限されている機能</h4>
            <div className="space-y-2">
              {disabledFeatures.slice(0, 3).map(([feature, _]) => (
                <div key={feature} className="flex items-center gap-2">
                  <span className="text-red-400">❌</span>
                  <span className="text-sm text-white/60">
                    {featureLabels[feature] || feature}
                  </span>
                </div>
              ))}
              {disabledFeatures.length > 3 && (
                <p className="text-xs text-white/50 mt-2">
                  他{disabledFeatures.length - 3}個の機能が制限されています
                </p>
              )}
            </div>
          </div>
        )}

        {/* プラン変更の案内 */}
        {planInfo.name !== 'max' && (
          <div className="bg-blue-500/10 rounded-xl p-4 border border-blue-500/20">
            <h4 className="text-sm font-medium text-blue-300 mb-2">💡 プランアップグレード</h4>
            <p className="text-xs text-white/70 mb-3">
              上位プランでより多くの機能をご利用いただけます
            </p>
            {onUpgrade && (
              <Button
                onClick={onUpgrade}
                disabled={isLoading}
                className="bg-gradient-to-r from-blue-500 to-purple-500 text-white hover:from-blue-600 hover:to-purple-600 text-xs w-full"
                size="sm"
              >
                プランを変更する
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}