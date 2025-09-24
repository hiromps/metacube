'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/app/components/ui/Button';
import { Badge } from '@/app/components/ui/Badge';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/app/components/ui/Card';

const pricingPlans = [
  {
    name: '⚡ STARTER',
    price: '¥2,980',
    duration: '月額',
    badge: '3日間無料体験',
    badgeColor: 'from-blue-500 to-cyan-500',
    features: [
      '🔥 3日間フルアクセス体験',
      '✅ タイムライン自動いいね',
      '✅ ハッシュタグいいね',
      '📱 基本版スクリプト',
      '🎁 無料セットアップサポート',
      '💬 LINEサポート30日間',
      'いつでもアップグレード可能',
      'いつでもキャンセル可能',
    ],
    timeSavings: '月10時間節約',
    costSavings: 'コンビニ弁当1回分で始められる',
    popular: false,
  },
  {
    name: '🚀 PRO',
    price: '¥6,980',
    originalPrice: '¥9,980',
    duration: '月額',
    subPrice: '¥69,800',
    subDuration: '年額',
    discount: '30%お得',
    badge: '3日間無料体験',
    badgeColor: 'from-yellow-500 to-orange-500',
    features: [
      '🔥 3日間フルアクセス体験',
      '✅ タイムライン自動いいね',
      '✅ ハッシュタグいいね',
      '✅ 自動フォロー',
      '✅ 自動アンフォロー',
      '🎁 無料セットアップサポート',
      '💬 LINEサポート90日間',
      'いつでもキャンセル可能',
    ],
    timeSavings: '月40時間節約',
    costSavings: '手動運用費¥20,000/月が不要',
    popular: true,
  },
  {
    name: '👑 MAX',
    price: '¥15,800',
    originalPrice: '¥19,800',
    duration: '月額',
    badge: '3日間無料体験',
    badgeColor: 'from-purple-500 to-indigo-500',
    features: [
      '🔥 3日間フルアクセス体験',
      '✅ タイムライン自動いいね',
      '✅ ハッシュタグいいね',
      '✅ 自動フォロー',
      '✅ 自動アンフォロー',
      '✅ アクティブユーザーいいね',
      '🎁 無料セットアップサポート',
      '📞 24時間電話サポート',
      'いつでもキャンセル可能',
    ],
    timeSavings: '月160時間節約',
    costSavings: '手動運用費¥80,000/月が不要',
    popular: false,
  },
];

export default function PlansPage() {
  const [isYearly, setIsYearly] = useState(false);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-5">
        <svg className="absolute inset-0 w-full h-full">
          <pattern id="plansGrid" x="0" y="0" width="50" height="50" patternUnits="userSpaceOnUse">
            <circle cx="25" cy="25" r="1" fill="#3b82f6" />
          </pattern>
          <rect width="100%" height="100%" fill="url(#plansGrid)" />
        </svg>
      </div>

      {/* Navigation */}
      <nav className="bg-gray-900/80 backdrop-blur-xl border-b border-white/10 relative z-10">
        <div className="container mx-auto px-4 py-3 md:py-4">
          <div className="flex justify-between items-center">
            <Link href="/dashboard">
              <div className="flex items-center space-x-1 md:space-x-2">
                <span className="text-lg md:text-2xl font-bold">
                  <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">SMART</span>
                  <span className="bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">GRAM</span>
                </span>
                <Badge className="bg-gradient-to-r from-blue-500/20 to-purple-500/20 text-blue-400 border-blue-400/30 text-xs md:text-sm" size="sm">v2.0</Badge>
              </div>
            </Link>
            <Link href="/dashboard">
              <Button className="bg-white/10 border border-white/20 text-white hover:bg-white/20 backdrop-blur-sm text-sm md:text-base" size="md">
                ダッシュボードに戻る
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Header */}
      <div className="relative z-10 pt-16 pb-8">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-3xl md:text-5xl font-bold bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent mb-4">
            プラン比較
          </h1>
          <p className="text-lg md:text-xl text-gray-300 mb-8">
            あなたに最適なプランをお選びください
          </p>
        </div>
      </div>

      {/* Pricing Toggle */}
      <div className="relative z-10 flex justify-center mb-12">
        <div className="bg-white/10 backdrop-blur-md rounded-full p-1 border border-white/20">
          <div className="flex">
            <button
              onClick={() => setIsYearly(false)}
              className={`px-6 py-2 rounded-full text-sm font-medium transition-all ${
                !isYearly
                  ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-lg'
                  : 'text-gray-300 hover:text-white'
              }`}
            >
              月額
            </button>
            <button
              onClick={() => setIsYearly(true)}
              className={`px-6 py-2 rounded-full text-sm font-medium transition-all ${
                isYearly
                  ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-lg'
                  : 'text-gray-300 hover:text-white'
              }`}
            >
              年額 <span className="text-xs ml-1">30%お得</span>
            </button>
          </div>
        </div>
      </div>

      {/* Pricing Cards */}
      <div className="relative z-10 container mx-auto px-4 pb-20">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 max-w-7xl mx-auto">
          {pricingPlans.map((plan, index) => (
            <Card
              key={index}
              className={`relative overflow-hidden backdrop-blur-md shadow-2xl border transition-all duration-300 hover:scale-105 hover:shadow-3xl ${
                plan.popular
                  ? 'bg-gradient-to-br from-yellow-500/10 to-orange-500/10 border-yellow-400/30 transform scale-105'
                  : 'bg-white/10 border-white/20 hover:bg-white/15'
              }`}
            >
              {plan.popular && (
                <div className="absolute top-0 left-0 right-0 bg-gradient-to-r from-yellow-500 to-orange-500 text-black text-center text-sm font-bold py-2">
                  🔥 最も人気
                </div>
              )}

              <CardHeader className={`pb-4 ${plan.popular ? 'pt-12' : 'pt-6'}`}>
                <div className="flex items-center justify-between mb-4">
                  <CardTitle className="text-2xl font-bold text-white">
                    {plan.name}
                  </CardTitle>
                  {plan.badge && (
                    <Badge className={`bg-gradient-to-r ${plan.badgeColor} text-white border-0 text-xs px-2 py-1`}>
                      {plan.badge}
                    </Badge>
                  )}
                </div>

                <div className="mb-4">
                  <div className="flex items-baseline">
                    {plan.originalPrice && (
                      <span className="text-lg text-gray-400 line-through mr-2">
                        {isYearly && plan.subPrice ? plan.subPrice : plan.originalPrice}
                      </span>
                    )}
                    <span className="text-4xl font-bold text-white">
                      {isYearly && plan.subPrice ? plan.subPrice : plan.price}
                    </span>
                    <span className="text-gray-300 ml-2">
                      /{isYearly && plan.subDuration ? plan.subDuration : plan.duration}
                    </span>
                  </div>
                  {plan.discount && isYearly && (
                    <Badge className="bg-gradient-to-r from-green-500 to-emerald-500 text-white border-0 text-xs mt-2">
                      {plan.discount}
                    </Badge>
                  )}
                </div>

                <div className="space-y-2">
                  <div className="flex items-center text-sm">
                    <span className="text-blue-400 mr-2">⏱️</span>
                    <span className="text-gray-300">{plan.timeSavings}</span>
                  </div>
                  <div className="flex items-center text-sm">
                    <span className="text-green-400 mr-2">💰</span>
                    <span className="text-gray-300">{plan.costSavings}</span>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-3">
                {plan.features.map((feature, featureIndex) => (
                  <div key={featureIndex} className="flex items-start space-x-3">
                    <span className="text-green-400 mt-0.5 text-sm">✓</span>
                    <span className="text-gray-300 text-sm leading-relaxed">{feature}</span>
                  </div>
                ))}
              </CardContent>

              <CardFooter className="pt-6">
                <Link href="/register" className="w-full">
                  <Button
                    className={`w-full font-semibold text-base py-3 transition-all duration-300 ${
                      plan.popular
                        ? 'bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-black shadow-xl hover:shadow-2xl'
                        : plan.name.includes('MAX')
                        ? 'bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 text-white shadow-xl hover:shadow-2xl'
                        : 'bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white shadow-xl hover:shadow-2xl'
                    }`}
                    size="lg"
                  >
                    {plan.badge ? '3日間無料で始める' : '今すぐ始める'}
                  </Button>
                </Link>
              </CardFooter>
            </Card>
          ))}
        </div>

        {/* Additional Info */}
        <div className="mt-16 text-center">
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8 border border-white/20 max-w-4xl mx-auto">
            <h3 className="text-2xl font-bold text-white mb-6">よくある質問</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left">
              <div>
                <h4 className="font-semibold text-white mb-2">プラン変更は可能ですか？</h4>
                <p className="text-gray-300 text-sm">はい、いつでもアップグレード・ダウングレードが可能です。変更は次回請求日から適用されます。</p>
              </div>
              <div>
                <h4 className="font-semibold text-white mb-2">解約はいつでもできますか？</h4>
                <p className="text-gray-300 text-sm">はい、いつでも解約できます。解約後も現在の請求期間終了まではサービスをご利用いただけます。</p>
              </div>
              <div>
                <h4 className="font-semibold text-white mb-2">無料体験期間中に解約した場合の料金は？</h4>
                <p className="text-gray-300 text-sm">無料体験期間中に解約した場合、料金は一切かかりません。</p>
              </div>
              <div>
                <h4 className="font-semibold text-white mb-2">複数デバイスで利用できますか？</h4>
                <p className="text-gray-300 text-sm">現在は1アカウント1デバイスでの利用となっております。複数デバイス対応は今後のアップデートで予定しています。</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}