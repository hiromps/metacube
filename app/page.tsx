'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/app/components/ui/Button';
import { Badge } from '@/app/components/ui/Badge';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/app/components/ui/Card';

const features = [
  {
    icon: '❤️',
    title: 'タイムライン自動いいね',
    description: 'フィード投稿に自動でいいねを付けて、エンゲージメントを向上',
  },
  {
    icon: '🔍',
    title: '発見タブ最適化',
    description: '発見タブから関連性の高いコンテンツを自動でいいね',
  },
  {
    icon: '#️⃣',
    title: 'ハッシュタグ戦略',
    description: '狙ったハッシュタグの投稿に自動アクション',
  },
  {
    icon: '👥',
    title: 'スマートフォロー',
    description: 'ターゲット層を自動フォロー＆アンフォロー管理',
  },
  {
    icon: '💬',
    title: 'DM自動送信',
    description: 'カスタマイズ可能なメッセージを自動送信',
  },
  {
    icon: '📊',
    title: '成長分析',
    description: 'フォロワー成長率とエンゲージメント分析',
  },
];

const pricingPlans = [
  {
    name: 'トライアル',
    price: '¥0',
    duration: '3日間',
    features: [
      '全機能アクセス',
      '1デバイス',
      'メールサポート',
      'いつでもキャンセル可能',
    ],
    popular: false,
  },
  {
    name: 'スタンダード',
    price: '¥2,980',
    duration: '月額',
    features: [
      '全機能アクセス',
      '1デバイス',
      '優先サポート',
      'いつでもキャンセル可能',
      '最新アップデート',
    ],
    popular: true,
  },
  {
    name: 'プロフェッショナル',
    price: '¥8,800',
    duration: '月額',
    features: [
      '全機能アクセス',
      '3デバイス',
      'VIPサポート',
      'カスタマイズ設定',
      '最新アップデート',
      '専用Discord',
    ],
    popular: false,
  },
];

const stats = [
  { label: 'アクティブユーザー', value: '1,000+' },
  { label: '処理したアクション', value: '10M+' },
  { label: 'フォロワー成長率', value: '300%' },
  { label: '満足度', value: '98%' },
];

export default function Home() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <>
      {/* Navigation */}
      <nav className={`fixed w-full top-0 z-50 transition-all duration-300 ${
        scrolled ? 'bg-white/95 backdrop-blur-md shadow-lg' : 'bg-white'
      }`}>
        <div className="container mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-2">
              <span className="text-2xl font-bold text-blue-600">
                MetaCube
              </span>
              <Badge className="bg-blue-100 text-blue-600 border-blue-200" size="sm">v2.0</Badge>
            </div>
            <div className="flex space-x-4">
              <Link href="/login">
                <Button className="bg-white border-2 border-blue-500 text-blue-600 hover:bg-blue-50" size="md">
                  ログイン
                </Button>
              </Link>
              <Link href="/register">
                <Button className="bg-blue-500 text-white hover:bg-blue-600" size="md">
                  無料で始める
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-blue-50 overflow-hidden">
        {/* Animated Background */}
        <div className="absolute inset-0">
          <div className="absolute top-0 -left-4 w-72 h-72 bg-blue-400 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-float"></div>
          <div className="absolute top-0 -right-4 w-72 h-72 bg-cyan-400 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-float animation-delay-2000"></div>
          <div className="absolute -bottom-8 left-20 w-72 h-72 bg-indigo-400 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-float animation-delay-4000"></div>
        </div>

        <div className="container mx-auto px-4 text-center relative z-10">
          <div className="animate-slide-down">
            <Badge className="bg-blue-100 text-blue-700 border-blue-200 px-4 py-2" size="lg">
              Instagram成長の新時代へ
            </Badge>
            <h1 className="text-6xl md:text-7xl font-bold mb-6 bg-gradient-to-r from-blue-600 to-blue-400 bg-clip-text text-transparent">
              MetaCube
            </h1>
            <p className="text-xl md:text-2xl text-gray-600 mb-8 max-w-3xl mx-auto">
              AIを活用したInstagram自動化ツールで、
              あなたのアカウントを次のレベルへ
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
              <Link href="/register">
                <Button className="bg-blue-500 text-white hover:bg-blue-600 shadow-lg hover:shadow-xl transition-all min-w-[200px]" size="xl">
                  3日間無料で試す
                </Button>
              </Link>
              <Button className="bg-white border-2 border-blue-500 text-blue-600 hover:bg-blue-50 min-w-[200px]" size="xl">
                デモを見る
              </Button>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-16">
            {stats.map((stat, index) => (
              <div key={index} className="animate-slide-up" style={{ animationDelay: `${index * 100}ms` }}>
                <Card className="bg-white shadow-lg border border-gray-100 text-center hover:shadow-xl transition-shadow">
                  <CardContent>
                    <div className="text-3xl font-bold text-blue-600 mb-2">{stat.value}</div>
                    <div className="text-sm text-gray-600">{stat.label}</div>
                  </CardContent>
                </Card>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <Badge className="bg-blue-100 text-blue-700 border-blue-200" size="md">
              機能紹介
            </Badge>
            <h2 className="text-4xl md:text-5xl font-bold mb-4 text-gray-800">
              成長を加速する強力な機能
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              MetaCubeの高度な自動化機能で、Instagram運用の効率を最大化
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, index) => (
              <div
                key={index}
                className="animate-slide-up"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <Card className="bg-white shadow-lg border border-gray-100 hover:shadow-xl transition-shadow h-full">
                  <CardHeader>
                    <div className="text-4xl mb-4">{feature.icon}</div>
                    <CardTitle className="text-xl text-gray-800">{feature.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-gray-600">{feature.description}</p>
                  </CardContent>
                </Card>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="py-20 bg-white">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <Badge className="bg-blue-100 text-blue-700 border-blue-200" size="md">
              料金プラン
            </Badge>
            <h2 className="text-4xl md:text-5xl font-bold mb-4 text-gray-800">
              あなたに合ったプランを選択
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              すべてのプランで全機能が利用可能。まずは無料トライアルから
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {pricingPlans.map((plan, index) => (
              <div
                key={index}
                className="animate-slide-up"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <Card
                  className={`h-full relative ${plan.popular ? 'bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-2xl' : 'bg-white shadow-lg border border-gray-100'}`}
                >
                  {plan.popular && (
                    <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                      <Badge className="bg-orange-500 text-white border-orange-600" size="md">
                        人気No.1
                      </Badge>
                    </div>
                  )}
                  <CardHeader className="text-center pt-8">
                    <CardTitle className={`text-2xl mb-2 ${plan.popular ? 'text-white' : 'text-gray-800'}`}>{plan.name}</CardTitle>
                    <div className="flex items-baseline justify-center">
                      <span className={`text-4xl font-bold ${plan.popular ? 'text-white' : 'text-blue-600'}`}>{plan.price}</span>
                      <span className={`ml-2 ${plan.popular ? 'text-blue-100' : 'text-gray-500'}`}>/ {plan.duration}</span>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-3">
                      {plan.features.map((feature, i) => (
                        <li key={i} className={`flex items-center ${plan.popular ? 'text-white' : 'text-gray-700'}`}>
                          <svg className={`w-5 h-5 mr-3 ${plan.popular ? 'text-blue-200' : 'text-blue-500'}`} fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                          {feature}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                  <CardFooter>
                    <Link href="/register" className="w-full">
                      <Button
                        className={plan.popular ? 'bg-white text-blue-600 hover:bg-blue-50' : 'bg-blue-500 text-white hover:bg-blue-600'}
                        size="lg"
                        fullWidth
                      >
                        {plan.name === 'トライアル' ? '無料で始める' : '今すぐ始める'}
                      </Button>
                    </Link>
                  </CardFooter>
                </Card>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-r from-blue-500 to-blue-600">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-4xl md:text-5xl font-bold mb-4 text-white">
            今すぐ始めよう
          </h2>
          <p className="text-xl text-white/90 mb-8 max-w-2xl mx-auto">
            3日間の無料トライアルで、MetaCubeの全機能をお試しください。
            クレジットカード登録は不要です。
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/register">
              <Button className="bg-white text-blue-600 hover:bg-blue-50 shadow-lg min-w-[200px]" size="xl">
                無料トライアルを開始
              </Button>
            </Link>
            <Link href="/login">
              <Button className="bg-transparent border-2 border-white text-white hover:bg-white hover:text-blue-600 min-w-[200px]" size="xl">
                既存ユーザーログイン
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 bg-gray-50 border-t border-gray-200">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
            <div>
              <h3 className="text-xl font-bold mb-4 text-blue-600">
                MetaCube
              </h3>
              <p className="text-gray-600">
                Instagram成長を自動化する次世代ツール
              </p>
            </div>
            <div>
              <h4 className="text-lg font-semibold mb-4 text-gray-800">製品</h4>
              <ul className="space-y-2 text-gray-600">
                <li><a href="#" className="hover:text-blue-600 transition">機能</a></li>
                <li><a href="#" className="hover:text-blue-600 transition">料金</a></li>
                <li><a href="#" className="hover:text-blue-600 transition">FAQ</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-lg font-semibold mb-4 text-gray-800">サポート</h4>
              <ul className="space-y-2 text-gray-600">
                <li><a href="#" className="hover:text-blue-600 transition">ヘルプセンター</a></li>
                <li><a href="#" className="hover:text-blue-600 transition">お問い合わせ</a></li>
                <li><a href="#" className="hover:text-blue-600 transition">利用規約</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-lg font-semibold mb-4 text-gray-800">フォロー</h4>
              <ul className="space-y-2 text-gray-600">
                <li><a href="#" className="hover:text-blue-600 transition">Twitter</a></li>
                <li><a href="#" className="hover:text-blue-600 transition">Instagram</a></li>
                <li><a href="#" className="hover:text-blue-600 transition">Discord</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-200 pt-8 text-center text-gray-600">
            <p>© 2024 MetaCube. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </>
  );
}