'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { Button } from '@/app/components/ui/Button';
import { Badge } from '@/app/components/ui/Badge';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/app/components/ui/Card';

const acronymMeanings = [
  { letter: 'S', word: 'Social', icon: '🌐', description: 'ソーシャルネットワーク解析AI' },
  { letter: 'M', word: 'Mobile', icon: '📱', description: 'モバイル最適化インターフェース' },
  { letter: 'A', word: 'Auto', icon: '🤖', description: '人間動作完全自動化エンジン' },
  { letter: 'R', word: 'Reach', icon: '🎯', description: 'エンゲージメント最大化システム' },
  { letter: 'T', word: 'Tool', icon: '⚡', description: 'プロフェッショナル仕様ツール' },
];

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
    name: '⚡ STARTER',
    price: '¥2,980',
    duration: '月額',
    badge: '14日間無料',
    badgeColor: 'from-blue-500 to-cyan-500',
    features: [
      '❤️ タイムライン自動いいね',
      '📄 PDFマニュアル（50ページ）',
      '📱 基本版スクリプト',
      '✉️ メールサポート14日間',
      '⏱️ 1日500いいねまで',
      '🎁 設定代行サービス進呈',
      '📊 Instagram分析レポート',
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
    badge: '創業記念特価',
    badgeColor: 'from-yellow-500 to-orange-500',
    features: [
      '❤️ タイムライン自動いいね',
      '➕ 自動フォロー・アンフォロー',
      '🎯 アクティブユーザーターゲット',
      '🎥 動画教材5時間（¥5,000相当）',
      '📄 PDFマニュアル（150ページ）',
      '💬 LINEサポート90日間',
      '⏱️ 1日3000アクション',
      '📊 成長分析レポート進呈',
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
    badge: '企業向け',
    badgeColor: 'from-purple-500 to-indigo-500',
    features: [
      '🏢 企業向け専用機能',
      '⚡ 制限なし（無制限自動化）',
      '👨‍💼 専任コンサルタント',
      '📊 詳細レポート＋分析',
      '🎯 複数アカウント対応',
      '📞 24時間電話サポート',
      '💎 VIP専用ツール',
      '🔒 セキュリティ強化版',
    ],
    timeSavings: '月160時間節約',
    costSavings: '手動運用費¥80,000/月が不要',
    popular: false,
  },
];

const stats = [
  { label: 'アクティブユーザー', value: '1,000+', subtitle: '企業から個人まで' },
  { label: '処理したアクション', value: '10M+', subtitle: '月間自動実行数' },
  { label: 'フォロワー成長率', value: '300%', subtitle: '平均3ヶ月での成果' },
  { label: '継続利用率', value: '95%', subtitle: 'プロも認める効果' },
];

export default function Home() {
  const [scrolled, setScrolled] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isYearly, setIsYearly] = useState(false);
  const [activeAcronym, setActiveAcronym] = useState<number | null>(null);
  const [typedText, setTypedText] = useState('');
  const fullText = '人間の動きを自動化する次世代のツール';
  const [showAcronymExpansion, setShowAcronymExpansion] = useState(true);
  const [isLiked, setIsLiked] = useState<number[]>([]);
  const [currentPost, setCurrentPost] = useState(0);
  const [scrollPosition, setScrollPosition] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    // タイピング効果
    const timer = setTimeout(() => {
      if (typedText.length < fullText.length) {
        setTypedText(fullText.slice(0, typedText.length + 1));
      } else {
        setShowAcronymExpansion(true);
      }
    }, 50);
    return () => clearTimeout(timer);
  }, [typedText]);

  useEffect(() => {
    // 頭文字アニメーション（より控えめに）
    const interval = setInterval(() => {
      setActiveAcronym((prev) => (prev === null ? 0 : (prev + 1) % 5));
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const runAnimation = () => {
      const sequence = [
        // 1番目の投稿
        { delay: 2000, action: 'like', postIndex: 0 },
        { delay: 4000, action: 'scroll', postIndex: 1 },
        // 2番目の投稿
        { delay: 6000, action: 'like', postIndex: 1 },
        { delay: 8000, action: 'scroll', postIndex: 2 },
        // 3番目の投稿
        { delay: 10000, action: 'like', postIndex: 2 },
        // 最初に戻る
        { delay: 13000, action: 'reset', postIndex: 0 }
      ];

      const timers = sequence.map(({ delay, action, postIndex }) => {
        return setTimeout(() => {
          if (action === 'like') {
            setIsLiked(prev => {
              if (!prev.includes(postIndex)) {
                return [...prev, postIndex];
              }
              return prev;
            });
          } else if (action === 'scroll') {
            setCurrentPost(postIndex);
            setScrollPosition(-400 * postIndex);
          } else if (action === 'reset') {
            setIsLiked([]);
            setCurrentPost(0);
            setScrollPosition(0);
            // 2秒後に次のサイクルを開始
            setTimeout(() => runAnimation(), 2000);
          }
        }, delay);
      });

      return timers;
    };

    const initialTimers = runAnimation();

    return () => {
      initialTimers.forEach(timer => clearTimeout(timer));
    };
  }, []);

  // 投稿データ
  const posts = [
    {
      id: 1,
      username: 'tokyo_style',
      location: '渋谷, 東京',
      type: 'cafe',
      likes: 5832,
      caption: '今日のラテアート☕ 渋谷の新しいカフェで一息 #cafe #coffee #tokyo #latte',
      time: '2時間前'
    },
    {
      id: 2,
      username: 'food_japan',
      location: '表参道, 東京',
      type: 'food',
      likes: 3421,
      caption: '今日のランチ🍱 特製オムライスが絶品！ #food #lunch #オムライス #表参道',
      time: '4時間前'
    },
    {
      id: 3,
      username: 'travel_tokyo',
      location: '浅草, 東京',
      type: 'travel',
      likes: 8756,
      caption: '浅草寺の夜景🏮 ライトアップが綺麗でした✨ #浅草 #東京観光 #夜景 #temple',
      time: '6時間前'
    }
  ];

  return (
    <>
      {/* Navigation */}
      <nav className={`fixed w-full top-0 z-50 transition-all duration-300 ${
        scrolled ? 'bg-gray-900/95 backdrop-blur-md shadow-lg border-b border-gray-700' : 'bg-gray-900/80 backdrop-blur-sm border-b border-gray-800'
      }`}>
        <div className="container mx-auto px-4 py-3 md:py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-2 md:space-x-3">
              {/* SMARTGRAM Logo SVG */}
              <div className="w-10 h-10 md:w-12 md:h-12">
                <svg
                  viewBox="0 0 120 120"
                  className="w-full h-full"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <defs>
                    <linearGradient id="logoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#e91e63" />
                      <stop offset="25%" stopColor="#9c27b0" />
                      <stop offset="50%" stopColor="#673ab7" />
                      <stop offset="75%" stopColor="#3f51b5" />
                      <stop offset="100%" stopColor="#ff5722" />
                    </linearGradient>
                  </defs>
                  <rect width="120" height="120" rx="26" fill="url(#logoGradient)" />
                  <text
                    x="60"
                    y="75"
                    textAnchor="middle"
                    fill="white"
                    fontSize="72"
                    fontWeight="900"
                    fontFamily="system-ui, -apple-system, sans-serif"
                  >
                    S
                  </text>
                  <text
                    x="60"
                    y="105"
                    textAnchor="middle"
                    fill="white"
                    fontSize="14"
                    fontWeight="700"
                    fontFamily="system-ui, -apple-system, sans-serif"
                  >
                    SMARTGRAM
                  </text>
                </svg>
              </div>
              <div className="flex items-center">
                <span className="text-lg md:text-xl lg:text-2xl font-black bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  SMART</span>
                <span className="text-lg md:text-xl lg:text-2xl font-black bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">GRAM</span>
              </div>
              <Badge className="bg-gradient-to-r from-blue-500 to-purple-500 text-white border-0 text-xs md:text-sm" size="sm">AI Powered</Badge>
            </div>

            {/* Desktop Navigation */}
            <div className="hidden md:flex space-x-4">
              <Link href="/login">
                <Button className="bg-transparent border-2 border-white/30 text-white hover:bg-white/10 text-sm md:text-base px-3 md:px-4" size="md">
                  ログイン
                </Button>
              </Link>
              <Link href="/register">
                <Button className="bg-gradient-to-r from-blue-500 to-purple-500 text-white hover:from-blue-600 hover:to-purple-600 text-sm md:text-base px-3 md:px-4" size="md">
                  無料で始める
                </Button>
              </Link>
            </div>

            {/* Mobile Hamburger Menu */}
            <div className="md:hidden">
              <button
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="text-white p-2 hover:bg-white/10 rounded-lg transition-colors"
                aria-label="メニューを開く"
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  {isMenuOpen ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  )}
                </svg>
              </button>
            </div>
          </div>

          {/* Mobile Menu Dropdown */}
          {isMenuOpen && (
            <div className="md:hidden mt-4 pb-4 border-t border-gray-700 pt-4">
              <div className="flex flex-col space-y-3">
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    setIsMenuOpen(false);
                    setTimeout(() => {
                      const demoElement = document.getElementById('demo');
                      if (demoElement) {
                        const yOffset = -60; // モバイル版ナビゲーションバーの高さ分オフセット
                        const y = demoElement.getBoundingClientRect().top + window.pageYOffset + yOffset;
                        window.scrollTo({ top: y, behavior: 'smooth' });
                      }
                    }, 100);
                  }}
                  className="bg-transparent border-2 border-white/30 text-white hover:bg-white/10 text-sm w-full px-4 py-3 rounded-lg font-semibold transition-all"
                >
                  デモを見る
                </button>
                <Link href="/login" onClick={() => setIsMenuOpen(false)}>
                  <Button className="bg-transparent border-2 border-white/30 text-white hover:bg-white/10 text-sm w-full" size="md">
                    ログイン
                  </Button>
                </Link>
                <Link href="/register" onClick={() => setIsMenuOpen(false)}>
                  <Button className="bg-gradient-to-r from-blue-500 to-purple-500 text-white hover:from-blue-600 hover:to-purple-600 text-sm w-full" size="md">
                    無料で始める
                  </Button>
                </Link>
              </div>
            </div>
          )}
        </div>
      </nav>

      {/* Hero Section - SMARTGRAM */}
      <section className="relative min-h-screen flex items-center pt-16 md:pt-20 bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900 overflow-hidden">
        {/* Dynamic Background Elements */}
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-black/20"></div>
          {/* Neural Network Pattern */}
          <svg className="absolute inset-0 w-full h-full opacity-10">
            <pattern id="neural" x="0" y="0" width="100" height="100" patternUnits="userSpaceOnUse">
              <circle cx="50" cy="50" r="1" fill="#3b82f6" />
              <line x1="50" y1="50" x2="100" y2="50" stroke="#3b82f6" strokeWidth="0.5" />
              <line x1="50" y1="50" x2="50" y2="100" stroke="#3b82f6" strokeWidth="0.5" />
            </pattern>
            <rect width="100%" height="100%" fill="url(#neural)" />
          </svg>
          {/* Floating Tech Elements */}
          <div className="absolute top-20 left-4 md:left-10 text-4xl md:text-6xl opacity-20 animate-float">🌐</div>
          <div className="absolute top-40 right-4 md:right-20 text-4xl md:text-6xl opacity-20 animate-float animation-delay-2000">📱</div>
          <div className="absolute bottom-20 left-4 md:left-20 text-4xl md:text-6xl opacity-20 animate-float animation-delay-4000">🤖</div>
          <div className="absolute bottom-40 right-4 md:right-10 text-4xl md:text-6xl opacity-20 animate-float animation-delay-1000">🎯</div>
          <div className="absolute top-60 left-1/2 text-4xl md:text-6xl opacity-20 animate-float animation-delay-3000">⚡</div>
        </div>

        <div className="container mx-auto px-4 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center">
            {/* Left Side - Message Area */}
            <div className="text-center lg:text-left space-y-4 md:space-y-6 py-6 md:py-8 pl-0 lg:pl-8">
              {/* Logo with Animation */}
              <div className="mb-6 md:mb-8 mt-4 md:mt-8">
                <div className="flex items-center justify-center lg:justify-start space-x-2 md:space-x-4 mb-3 md:mb-4">
                  <div className="text-3xl md:text-5xl lg:text-6xl xl:text-7xl font-black">
                    {['S', 'M', 'A', 'R', 'T', 'G', 'R', 'A', 'M'].map((letter, index) => (
                      <span
                        key={index}
                        className={`inline-block transition-all duration-700 ${
                          index < 5 && activeAcronym === index
                            ? 'text-yellow-400/90 scale-105'
                            : index < 5
                            ? 'bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent'
                            : 'bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent'
                        }`}
                        style={{ animationDelay: `${index * 50}ms` }}
                      >
                        {letter}
                      </span>
                    ))}
                  </div>
                </div>
                {/* Acronym Expansion - Subtle */}
                <div className="min-h-[2rem] mt-2">
                  {showAcronymExpansion && (
                    <div className="flex flex-wrap gap-2 animate-fade-in justify-center lg:justify-start">
                      {acronymMeanings.map((item, index) => (
                        <div
                          key={index}
                          className={`inline-flex items-center space-x-1 px-3 py-1 rounded-full bg-white/5 backdrop-blur-sm border border-white/10 transition-all duration-700 ${
                            activeAcronym === index ? 'bg-white/10 border-yellow-400/30 scale-105' : 'hover:bg-white/10'
                          }`}
                          style={{ animationDelay: `${index * 100}ms` }}
                        >
                          <span className="text-sm opacity-70">{item.icon}</span>
                          <span className="text-xs text-gray-300 font-medium">
                            <span className={`${activeAcronym === index ? 'text-yellow-400' : 'text-gray-400'}`}>{item.letter}</span>
                            <span className="text-gray-500 mx-1">:</span>
                            <span className="text-gray-400">{item.word}</span>
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Main Copy */}
              <div className="mt-8">
                <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white leading-none min-h-[4rem] md:min-h-[5rem] lg:min-h-[6rem]">
                  <span className="inline-block">
                    {typedText.split('').map((char, index) => {
                      // 「人間の動きを自動化する」で改行
                      if (index === 11) {
                        return <span key={index}><br/>{char}</span>;
                      }
                      return <span key={index}>{char}</span>;
                    })}
                    <span className="animate-pulse">|</span>
                  </span>
                </h1>
                <p className="text-base md:text-lg text-gray-300 opacity-90 mt-3">
                  Social Mobile Auto Reach Tool for Instagram
                </p>
                <p className="text-sm md:text-base text-gray-400 max-w-xl">
                  手作業でのInstagram運用はもう古い。<br/>
                  AIがあなたの代わりに完璧に動きます。
                </p>
              </div>

              {/* CTA Buttons */}
              <div className="flex flex-col sm:flex-row gap-3 md:gap-4 pt-6 md:pt-8 justify-center lg:justify-start">
                <Link href="/register">
                  <Button className="bg-gradient-to-r from-blue-500 to-purple-500 text-white hover:from-blue-600 hover:to-purple-600 shadow-lg hover:shadow-xl transition-all min-w-[180px] md:min-w-[200px] group text-sm md:text-base" size="xl">
                    <span className="group-hover:scale-105 inline-block transition-transform">
                      SMARTな自動化を体験
                    </span>
                  </Button>
                </Link>
                <Link href="#demo" className="md:hidden">
                  <Button
                    onClick={(e) => {
                      e.preventDefault();
                      const demoElement = document.getElementById('demo');
                      if (demoElement) {
                        const yOffset = -80; // ナビゲーションバーの高さ分オフセット
                        const y = demoElement.getBoundingClientRect().top + window.pageYOffset + yOffset;
                        window.scrollTo({ top: y, behavior: 'smooth' });
                      }
                    }}
                    className="bg-transparent border-2 border-white/30 text-white hover:bg-white/10 backdrop-blur-sm min-w-[180px] md:min-w-[200px] text-sm md:text-base"
                    size="xl"
                  >
                    デモを見る
                  </Button>
                </Link>
              </div>

              {/* Tech Badge */}
              <div className="flex flex-wrap gap-2 pt-4 justify-center lg:justify-start">
                <Badge className="bg-green-500/20 text-green-400 border-green-400/30 text-xs md:text-sm" size="md">
                  ✅ 5つの革新技術を統合
                </Badge>
                <Badge className="bg-blue-500/20 text-blue-400 border-blue-400/30 text-xs md:text-sm" size="md">
                  🔒 完全自動化
                </Badge>
                <Badge className="bg-purple-500/20 text-purple-400 border-purple-400/30 text-xs md:text-sm" size="md">
                  ⚡ 即日導入可能
                </Badge>
              </div>
            </div>

            {/* Right Side - Visual Area */}
            <div id="demo" className="relative mt-8 lg:mt-0">
              <div className="relative w-full max-w-[220px] md:max-w-[260px] mx-auto">
                {/* iPhone 8 Mockup */}
                <div className="relative">
                  {/* iPhone 8 Frame - Silver/White */}
                  <div className="relative bg-gradient-to-b from-gray-100 to-gray-200 rounded-[2.5rem] p-[2px] shadow-2xl">
                    <div className="bg-black rounded-[2.4rem] p-[2px]">
                      <div className="bg-gradient-to-b from-gray-100 to-white rounded-[2.3rem] px-3 py-4">
                        {/* Top Speaker Grill */}
                        <div className="flex justify-center mb-2">
                          <div className="w-16 h-1 bg-gray-800 rounded-full"></div>
                        </div>
                        {/* Screen */}
                        <div className="bg-white rounded-[1.5rem] h-[380px] relative overflow-hidden shadow-inner">
                          {/* iOS Status Bar */}
                          <div className="flex justify-between items-center px-4 py-1 text-xs bg-white">
                            <div className="flex items-center space-x-1">
                              <div className="flex space-x-[2px]">
                                <div className="w-1 h-1 bg-black rounded-full"></div>
                                <div className="w-1 h-1 bg-black rounded-full"></div>
                                <div className="w-1 h-1 bg-black rounded-full"></div>
                                <div className="w-1 h-1 bg-gray-400 rounded-full"></div>
                                <div className="w-1 h-1 bg-gray-400 rounded-full"></div>
                              </div>
                              <span className="ml-1 text-[11px]">Softbank</span>
                              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M1 9l2-2v8a2 2 0 002 2h14a2 2 0 002-2V7l2 2V2L12 7 1 2v7z"/>
                              </svg>
                            </div>
                            <span className="font-medium text-black">9:41</span>
                            <div className="flex items-center space-x-1">
                              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                              </svg>
                              <svg className="w-4 h-3" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M2 9h19v2H2zm0 4h15v2H2z"/>
                              </svg>
                              <div className="relative w-6 h-3 border border-black rounded-sm">
                                <div className="absolute inset-0 bg-green-500 rounded-sm" style={{width: '100%'}}></div>
                                <div className="absolute -right-[2px] top-1/2 -translate-y-1/2 w-[2px] h-[5px] bg-black rounded-r-full"></div>
                              </div>
                            </div>
                          </div>

                          {/* Instagram Header - Smaller */}
                          <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 bg-white">
                            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zM5.838 12a6.162 6.162 0 1112.324 0 6.162 6.162 0 01-12.324 0zM12 16a4 4 0 110-8 4 4 0 010 8zm4.965-10.405a1.44 1.44 0 112.881.001 1.44 1.44 0 01-2.881-.001z"/>
                            </svg>
                            <span className="text-sm font-semibold flex-1 text-center">Instagram</span>
                            <div className="flex items-center space-x-2">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                <path d="M12 4v16m8-8H4"/>
                              </svg>
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                <path d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m9.032 4.026a9.001 9.001 0 01-7.432 0m9.032-4.026A9.001 9.001 0 0112 3c-2.796 0-5.29 1.28-6.94 3.284M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                              </svg>
                            </div>
                          </div>
                          {/* Instagram Feed */}
                          <div className="relative h-[430px] overflow-hidden">
                            <div
                              className="transition-transform duration-2000 ease-in-out"
                              style={{ transform: `translateY(${scrollPosition}px)` }}
                            >
                            {posts.map((post, index) => (
                              <div key={post.id} className="bg-white mb-20 pb-4" style={{ height: '300px' }}>
                                <div className="flex items-center justify-between px-4 py-2">
                                  <div className="flex items-center">
                                    <div className="w-8 h-8 bg-gradient-to-br from-yellow-400 via-pink-500 to-purple-600 rounded-full p-[2px]">
                                      <div className="w-full h-full bg-white rounded-full p-[1px]">
                                        <div className="w-full h-full bg-gradient-to-br from-pink-400 to-purple-500 rounded-full"></div>
                                      </div>
                                    </div>
                                    <div className="ml-3">
                                      <p className="text-sm font-semibold">{post.username}</p>
                                      <p className="text-xs text-gray-500">{post.location}</p>
                                    </div>
                                  </div>
                                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                    <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z"/>
                                  </svg>
                                </div>
                                <div className="relative">
                                  {/* Post Image based on type */}
                                  <div className="h-[200px] relative overflow-hidden bg-gradient-to-br from-gray-100 to-gray-200">
                                    {post.type === 'cafe' && (
                                      <div className="absolute inset-0 bg-gradient-to-br from-amber-100 via-orange-100 to-brown-100">
                                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
                                          <div className="w-24 h-32 bg-white rounded-b-[1.5rem] shadow-xl">
                                            <div className="absolute inset-x-2 top-2 bottom-2 bg-gradient-to-b from-amber-600 to-amber-800 rounded-b-[1rem]">
                                              <div className="absolute inset-x-0 top-0 h-6 bg-gradient-to-b from-amber-100 to-amber-300 rounded-t">
                                                <div className="absolute inset-0 flex items-center justify-center">
                                                  <span className="text-amber-600 text-sm">♥</span>
                                                </div>
                                              </div>
                                            </div>
                                          </div>
                                        </div>
                                      </div>
                                    )}
                                    {post.type === 'food' && (
                                      <div className="absolute inset-0 bg-gradient-to-br from-yellow-100 via-orange-100 to-red-100">
                                        <div className="absolute inset-0 flex items-center justify-center">
                                          <div className="text-8xl">🍱</div>
                                        </div>
                                      </div>
                                    )}
                                    {post.type === 'travel' && (
                                      <div className="absolute inset-0 bg-gradient-to-b from-blue-900 via-purple-900 to-pink-900">
                                        <div className="absolute inset-0 flex items-center justify-center">
                                          <div className="text-8xl opacity-80">🏮</div>
                                        </div>
                                        <div className="absolute inset-0 bg-black/20">
                                          {/* Stars */}
                                          <div className="absolute top-10 left-10 w-1 h-1 bg-white rounded-full animate-pulse"></div>
                                          <div className="absolute top-20 right-20 w-1 h-1 bg-white rounded-full animate-pulse"></div>
                                          <div className="absolute top-16 left-1/2 w-1 h-1 bg-white rounded-full animate-pulse"></div>
                                        </div>
                                      </div>
                                    )}

                                    {/* AUTO Like Animation */}
                                    <div className={`absolute inset-0 flex items-center justify-center pointer-events-none transition-opacity duration-500 ${
                                      isLiked.includes(index) ? 'opacity-100' : 'opacity-0'
                                    }`}>
                                      <div className={`transform transition-all duration-700 ${
                                        isLiked.includes(index) ? 'scale-100 rotate-12' : 'scale-0'
                                      }`}>
                                        <svg className="w-24 h-24 text-red-500 drop-shadow-2xl" fill="currentColor" viewBox="0 0 24 24">
                                          <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                                        </svg>
                                        {/* Sparkles */}
                                        <div className="absolute inset-0 animate-ping">
                                          <span className="absolute top-0 left-1/2 text-yellow-400 text-lg">✨</span>
                                          <span className="absolute bottom-0 right-1/4 text-yellow-400 text-lg">✨</span>
                                        </div>
                                      </div>
                                    </div>
                                    {/* SMARTGRAM Badge - Always show on current post */}
                                    <div className={`absolute top-2 right-2 transition-opacity duration-300 ${
                                      Math.floor(-scrollPosition / 400) === index ? 'opacity-100' : 'opacity-0'
                                    }`}>
                                      <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white text-[10px] font-bold px-2 py-1 rounded-full shadow-lg animate-pulse">
                                        SMARTGRAM AUTO
                                      </div>
                                    </div>
                                  </div>
                                </div>
                                <div className="px-4 py-2">
                                  <div className="flex justify-between items-center mb-2">
                                    <div className="flex space-x-4">
                                      {/* Like Button with Animation */}
                                      <div className="relative">
                                        <svg className={`w-6 h-6 transition-all duration-500 ${
                                          isLiked.includes(index) ? 'scale-125 text-red-500' : 'scale-100'
                                        }`} viewBox="0 0 24 24">
                                          {isLiked.includes(index) ? (
                                            <path fill="#ef4444" d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                                          ) : (
                                            <path fill="none" stroke="currentColor" strokeWidth="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/>
                                          )}
                                        </svg>
                                        {/* Like Animation Burst */}
                                        {isLiked.includes(index) && (
                                          <div className="absolute inset-0 pointer-events-none">
                                            <div className="absolute inset-0 animate-ping">
                                              <svg className="w-6 h-6 text-red-400 opacity-75" fill="currentColor" viewBox="0 0 24 24">
                                                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                                              </svg>
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/>
                                    </svg>
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m9.032 4.026a9.001 9.001 0 01-7.432 0m9.032-4.026A9.001 9.001 0 0112 3c-2.796 0-5.29 1.28-6.94 3.284M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                                    </svg>
                                  </div>
                                  <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"/>
                                  </svg>
                                </div>
                                  {/* Likes count with proper spacing */}
                                  <p className="text-xs font-bold mb-2">
                                    <span className={`transition-all duration-300 ${
                                      isLiked.includes(index) ? 'text-red-500' : 'text-black'
                                    }`}>
                                      {isLiked.includes(index) ? post.likes + 1 : post.likes}件の「いいね！」
                                    </span>
                                  </p>

                                  {/* Caption and time with better spacing */}
                                  <div className="space-y-1">
                                    <p className="text-xs leading-relaxed">
                                      <span className="font-semibold">{post.username}</span> {post.caption}
                                    </p>
                                    <p className="text-[10px] text-gray-500">{post.time}</p>
                                  </div>
                                </div>
                              </div>
                            ))}
                            </div>
                          </div>
                          {/* Bottom Navigation Bar */}
                          <div className="absolute bottom-0 left-0 right-0 bg-white border-t border-gray-200">
                            <div className="flex justify-around items-center py-1.5">
                              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/>
                              </svg>
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
                              </svg>
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                                <line x1="9" y1="9" x2="15" y2="15"/>
                                <line x1="15" y1="9" x2="9" y2="15"/>
                              </svg>
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/>
                              </svg>
                              <div className="w-5 h-5 bg-gradient-to-br from-pink-400 to-purple-500 rounded-full"></div>
                            </div>
                          </div>
                        </div>
                        {/* Home Button */}
                        <div className="flex justify-center mt-2">
                          <div className="w-12 h-12 bg-white border-2 border-gray-300 rounded-full flex items-center justify-center shadow-inner">
                            <div className="w-8 h-8 border border-gray-400 rounded-full"></div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  {/* Floating Stats */}
                  <div className="absolute top-4 -right-8 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-xl px-3 py-2 shadow-2xl animate-float">
                    <div className="text-[10px] font-medium opacity-90">SMARTGRAM</div>
                    <div className="text-sm font-bold">AUTO ON</div>
                  </div>
                  <div className="absolute top-1/3 -left-8 bg-white rounded-lg px-3 py-2 shadow-xl animate-float animation-delay-1000">
                    <div className="text-[10px] text-gray-600">いいね獲得</div>
                    <div className="text-lg font-bold text-red-500">+1,248</div>
                    <div className="text-[10px] text-green-600 font-semibold">↑ 312%</div>
                  </div>
                  <div className="absolute bottom-1/4 -right-8 bg-white rounded-lg px-3 py-2 shadow-xl animate-float animation-delay-2000">
                    <div className="text-[10px] text-gray-600">新規フォロワー</div>
                    <div className="text-lg font-bold text-purple-600">+428</div>
                    <div className="text-[10px] text-green-600 font-semibold">今日</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Stats Bar - 社会証明と権威性 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-16 mb-20">
            {stats.map((stat, index) => (
              <div key={index} className="animate-slide-up" style={{ animationDelay: `${index * 100}ms` }}>
                <Card className="bg-white/10 backdrop-blur-md shadow-lg border border-white/20 text-center hover:bg-white/20 transition-all group">
                  <CardContent>
                    <div className="text-3xl font-bold text-white mb-2 group-hover:scale-110 transition-transform">{stat.value}</div>
                    <div className="text-sm text-gray-300 font-semibold">{stat.label}</div>
                    <div className="text-xs text-gray-400 mt-1">{stat.subtitle}</div>
                  </CardContent>
                </Card>
              </div>
            ))}
          </div>

          {/* 権威性・専門性アピール */}
          <div className="bg-gradient-to-r from-blue-600/20 to-purple-600/20 border border-blue-400/30 rounded-xl p-6 mb-12">
            <div className="text-center">
              <h3 className="text-xl font-bold text-blue-300 mb-3">🎓 開発チーム</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div className="bg-blue-500/10 rounded-lg p-3">
                  <div className="text-blue-300 font-semibold">👨‍💻 元Instagram社エンジニア</div>
                  <div className="text-gray-400">アルゴリズム最適化専門</div>
                </div>
                <div className="bg-purple-500/10 rounded-lg p-3">
                  <div className="text-purple-300 font-semibold">📊 SNSマーケティング専門家</div>
                  <div className="text-gray-400">10年以上の実績</div>
                </div>
                <div className="bg-green-500/10 rounded-lg p-3">
                  <div className="text-green-300 font-semibold">🔒 セキュリティエンジニア</div>
                  <div className="text-gray-400">安全性確保担当</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Revolutionary Value Proposition */}
      <section className="py-20 bg-gradient-to-b from-gray-900 to-gray-800">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <Badge className="bg-gradient-to-r from-yellow-400 to-orange-400 text-black font-bold" size="lg">
              🔥 世界初の統合ソリューション
            </Badge>
            <h2 className="text-4xl md:text-5xl font-bold mb-4 text-white mt-6">
              5つの革新を統合した唯一のツール
            </h2>
            <p className="text-xl text-gray-300 max-w-3xl mx-auto">
              他のツールは一部機能のみ。SMARTGRAMは全て。
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-16">
            {acronymMeanings.map((item, index) => (
              <div
                key={index}
                className="bg-gradient-to-br from-gray-800 to-gray-700 rounded-xl p-6 text-center hover:scale-105 transition-transform cursor-pointer border border-gray-600 hover:border-blue-500"
              >
                <div className="text-4xl mb-4">{item.icon}</div>
                <div className="text-2xl font-bold text-white mb-2">{item.letter}</div>
                <div className="text-lg text-blue-400 mb-2">{item.word}</div>
                <p className="text-sm text-gray-400">{item.description}</p>
              </div>
            ))}
          </div>

          <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl p-8 text-center">
            <h3 className="text-3xl font-bold text-white mb-4">
              Social × Mobile × Auto × Reach × Tool = SMARTGRAM
            </h3>
            <p className="text-lg text-white/90 mb-6">
              人間の限界を超えたInstagram成長エンジン
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-white">
              <div className="bg-white/20 backdrop-blur rounded-lg p-4">
                <div className="text-2xl mb-2">🎯</div>
                <div className="font-semibold">次世代技術</div>
                <div className="text-sm opacity-90">革新的でありながら実用的</div>
              </div>
              <div className="bg-white/20 backdrop-blur rounded-lg p-4">
                <div className="text-2xl mb-2">⚡</div>
                <div className="font-semibold">即日導入</div>
                <div className="text-sm opacity-90">未来のInstagram運用が今日始まる</div>
              </div>
              <div className="bg-white/20 backdrop-blur rounded-lg p-4">
                <div className="text-2xl mb-2">📊</div>
                <div className="font-semibold">実績保証</div>
                <div className="text-sm opacity-90">Instagram成長に必要な全て</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-gradient-to-b from-gray-900 to-gray-800 relative">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-5">
          <svg className="absolute inset-0 w-full h-full">
            <pattern id="featureGrid" x="0" y="0" width="50" height="50" patternUnits="userSpaceOnUse">
              <circle cx="25" cy="25" r="1" fill="#3b82f6" />
            </pattern>
            <rect width="100%" height="100%" fill="url(#featureGrid)" />
          </svg>
        </div>

        <div className="container mx-auto px-4 relative z-10">
          <div className="text-center mb-12">
            <Badge className="bg-gradient-to-r from-blue-500/20 to-purple-500/20 text-blue-400 border-blue-400/30 mb-4" size="md">
              🤖 主要機能
            </Badge>
            <h2 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
              人間の動作を完全自動化
            </h2>
            <p className="text-xl text-gray-300 max-w-2xl mx-auto">
              AIが学習した自然な動作パターンで、24時間365日働き続ける<br/>
              <span className="text-sm text-gray-400">※iPhone 7/8 専用最適化済み</span>
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, index) => (
              <div
                key={index}
                className="animate-slide-up"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <Card className="bg-white/10 backdrop-blur-md shadow-xl border border-white/20 hover:bg-white/20 hover:-translate-y-2 transition-all h-full group">
                  <CardHeader>
                    <div className="text-4xl mb-4 group-hover:scale-110 transition-transform">{feature.icon}</div>
                    <CardTitle className="text-xl text-white">{feature.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-gray-300">{feature.description}</p>
                    <div className="mt-4">
                      <span className="text-xs bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent font-semibold">🤖 AI自動実行</span>
                    </div>
                  </CardContent>
                </Card>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-20 bg-gradient-to-b from-gray-800 to-gray-900 relative">
        {/* Background Elements */}
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-black/10"></div>
          {/* Floating pricing icons */}
          <div className="absolute top-20 left-10 text-4xl opacity-10 animate-float">💰</div>
          <div className="absolute top-40 right-20 text-4xl opacity-10 animate-float animation-delay-2000">📊</div>
          <div className="absolute bottom-20 left-20 text-4xl opacity-10 animate-float animation-delay-4000">🎯</div>
          <div className="absolute bottom-40 right-10 text-4xl opacity-10 animate-float animation-delay-1000">⚡</div>
        </div>

        <div className="container mx-auto px-4 relative z-10">
          {/* 損失回避バイアス + 緊急性 */}
          <div className="text-center mb-8">
            <div className="bg-gradient-to-r from-red-500/20 to-orange-500/20 border border-red-400/30 rounded-xl p-4 mb-6 max-w-4xl mx-auto">
              <h3 className="text-xl font-bold text-orange-300 mb-2">⚠️ このチャンスを逃すと...</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-300">
                <div className="bg-red-500/10 rounded-lg p-3">
                  <div className="text-red-400 font-semibold">💸 月間5,000フォロワー獲得の機会を失う</div>
                </div>
                <div className="bg-red-500/10 rounded-lg p-3">
                  <div className="text-red-400 font-semibold">⏰ 手動作業で月40時間を浪費</div>
                </div>
                <div className="bg-red-500/10 rounded-lg p-3">
                  <div className="text-red-400 font-semibold">📉 競合他社に先を越される</div>
                </div>
              </div>
            </div>

            <Badge className="bg-gradient-to-r from-green-500/20 to-blue-500/20 text-green-400 border-green-400/30 mb-4" size="md">
              💎 創業記念特価プラン
            </Badge>
            <h2 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
              手動運用からの完全解放
            </h2>
            <p className="text-xl text-gray-300 max-w-2xl mx-auto mb-4">
              元Instagram社エンジニア監修・Instagram運用のプロが開発
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
                  className={`h-full relative flex flex-col transition-all hover:-translate-y-2 ${plan.popular ? 'bg-gradient-to-br from-blue-500/90 to-purple-600/90 text-white shadow-2xl border-2 border-yellow-400/50 backdrop-blur-md' : 'bg-white/10 backdrop-blur-md shadow-xl border border-white/20 text-white hover:bg-white/20'}`}
                >
                  {/* Badge - 希少性と権威性 */}
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <Badge className={`bg-gradient-to-r ${plan.badgeColor} text-white border-white/30 shadow-lg`} size="md">
                      {plan.popular ? '🚀 人気No.1' : plan.badge}
                    </Badge>
                  </div>

                  {/* 希少性インジケーター - 一時的にコメントアウト */}
                  {/* {plan.scarcity && (
                    <div className="absolute -top-2 right-2">
                      <div className="bg-red-500/90 text-white text-xs px-2 py-1 rounded-full font-bold animate-pulse">
                        {plan.scarcity}
                      </div>
                    </div>
                  )} */}

                  <CardHeader className="text-center pt-8">
                    {plan.popular && (
                      <div className="absolute top-2 right-2">
                        <div className="flex items-center bg-white/20 backdrop-blur-sm rounded-full p-1">
                          <button
                            onClick={() => setIsYearly(false)}
                            className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                              !isYearly ? 'bg-white text-blue-600' : 'text-white'
                            }`}
                          >
                            月額
                          </button>
                          <button
                            onClick={() => setIsYearly(true)}
                            className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                              isYearly ? 'bg-white text-blue-600' : 'text-white'
                            }`}
                          >
                            年額
                          </button>
                        </div>
                      </div>
                    )}

                    <CardTitle className="text-2xl mb-2 text-white">{plan.name}</CardTitle>

                    {/* 価格表示 - アンカリング効果 */}
                    <div className="flex flex-col items-center">
                      {plan.originalPrice && (
                        <div className="text-sm text-gray-400 line-through mb-1">
                          通常価格 {plan.originalPrice}
                        </div>
                      )}

                      {plan.popular && isYearly && plan.subPrice ? (
                        <>
                          <div className="flex items-baseline justify-center">
                            <span className="text-4xl font-bold text-white">{plan.subPrice}</span>
                            <span className="ml-2 text-gray-300">/ {plan.subDuration}</span>
                          </div>
                          <div className="mt-2">
                            <Badge className="bg-gradient-to-r from-green-500 to-emerald-500 text-white shadow-lg" size="sm">
                              ✨ {plan.discount}
                            </Badge>
                            <p className="text-xs text-green-400 mt-1 font-semibold">💰 月額換算 ¥4,950</p>
                          </div>
                        </>
                      ) : (
                        <div className="flex items-baseline justify-center">
                          <span className="text-4xl font-bold text-white">{plan.price}</span>
                          <span className="ml-2 text-gray-300">/ {plan.duration}</span>
                        </div>
                      )}

                      {/* 緊急性メッセージ - 一時的にコメントアウト */}
                      {/* {plan.urgency && (
                        <div className="bg-orange-500/20 border border-orange-400/30 rounded-lg p-2 mt-3">
                          <p className="text-orange-300 text-xs font-semibold">{plan.urgency}</p>
                        </div>
                      )} */}

                      {/* 権威性 - 一時的にコメントアウト */}
                      {/* {plan.authority && (
                        <div className="bg-blue-500/20 border border-blue-400/30 rounded-lg p-2 mt-2">
                          <p className="text-blue-300 text-xs font-semibold">✅ {plan.authority}</p>
                        </div>
                      )} */}
                    </div>
                  </CardHeader>
                  <CardContent className="flex-grow">
                    {/* 損失回避 - 時間とコスト節約 */}
                    <div className="bg-green-500/10 border border-green-400/30 rounded-lg p-3 mb-4">
                      <div className="text-green-300 text-sm font-semibold">💰 コスト削減効果</div>
                      <div className="text-green-200 text-xs">{plan.timeSavings}</div>
                      <div className="text-green-200 text-xs">{plan.costSavings}</div>
                    </div>

                    {/* 返報性 - 無料価値提供 - 一時的にコメントアウト */}
                    {/* {plan.freeValue && (
                      <div className="bg-blue-500/10 border border-blue-400/30 rounded-lg p-3 mb-4">
                        <div className="text-blue-300 text-sm font-semibold">🎁 無料特典</div>
                        <div className="text-blue-200 text-xs">{plan.freeValue}</div>
                      </div>
                    )} */}

                    <ul className="space-y-3">
                      {plan.features.map((feature, i) => (
                        <li key={i} className="flex items-center text-white">
                          <div className={`w-5 h-5 mr-3 rounded-full flex items-center justify-center text-xs font-bold ${plan.popular ? 'bg-gradient-to-r from-yellow-400 to-orange-500 text-white shadow-lg' : 'bg-gradient-to-r from-blue-400 to-purple-500 text-white'}`}>
                            ✓
                          </div>
                          <span className={plan.popular && (feature.includes('Zoom') || feature.includes('3ヶ月') || feature.includes('制限なし') || feature.includes('成長戦略') || feature.includes('¥5,000相当')) ? 'text-yellow-300 font-semibold' : ''}>{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                  <CardFooter className="mt-auto !border-t-0">
                    <Link href="/register" className="w-full">
                      <Button
                        className={plan.popular ? 'bg-gradient-to-r from-white to-gray-100 text-blue-600 hover:from-gray-100 hover:to-white shadow-xl border-2 border-yellow-400/30 font-bold animate-pulse' : 'bg-gradient-to-r from-blue-500 to-purple-500 text-white hover:from-blue-600 hover:to-purple-600 shadow-xl border border-white/20'}
                        size="lg"
                        fullWidth
                      >
                        {plan.name.includes('MAX') ? '💼 MAXプランで差をつける' :
                         plan.popular ? '🚀 特価で今すぐ始める' :
                         '⚡ 14日間無料で体験'}
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
      <section className="py-20 bg-gradient-to-r from-purple-600 via-blue-600 to-purple-600">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-4xl md:text-5xl font-bold mb-4 text-white">
            人間を超えたパフォーマンスを体験
          </h2>
          <p className="text-xl text-white/90 mb-8 max-w-2xl mx-auto">
            SMARTGRAMの5つの革新技術が、<br/>
            あなたのInstagramマーケティングを変革します。
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/register">
              <Button className="bg-white text-purple-600 hover:bg-purple-50 shadow-lg min-w-[200px] group" size="xl">
                <span className="group-hover:scale-105 inline-block transition-transform">
                  SMARTGRAMを始める
                </span>
              </Button>
            </Link>
            <Link href="/login">
              <Button className="bg-transparent border-2 border-white text-white hover:bg-white hover:text-purple-600 min-w-[200px]" size="xl">
                デモ動画を見る
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
              <h3 className="text-2xl font-bold mb-4">
                <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">SMART</span>
                <span className="bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">GRAM</span>
              </h3>
              <p className="text-gray-600">
                Social Mobile Auto Reach Tool<br/>
                人間の動きを自動化する革命的ツール
              </p>
            </div>
            <div>
              <h4 className="text-lg font-semibold mb-4 text-gray-800">製品</h4>
              <ul className="space-y-2 text-gray-600">
                <li><a href="#features" className="hover:text-blue-600 transition">機能</a></li>
                <li><a href="#pricing" className="hover:text-blue-600 transition">料金</a></li>
                <li><Link href="/terms" className="hover:text-blue-600 transition">利用規約</Link></li>
                <li><Link href="/privacy" className="hover:text-blue-600 transition">プライバシーポリシー</Link></li>
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
            <p>© 2024 SMARTGRAM. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </>
  );
}