'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/app/components/ui/Button'
import { Card, CardContent } from '@/app/components/ui/Card'
import { Badge } from '@/app/components/ui/Badge'

export default function TermsPage() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-5">
        <svg className="absolute inset-0 w-full h-full">
          <pattern id="termsGrid" x="0" y="0" width="50" height="50" patternUnits="userSpaceOnUse">
            <circle cx="25" cy="25" r="1" fill="#3b82f6" />
          </pattern>
          <rect width="100%" height="100%" fill="url(#termsGrid)" />
        </svg>
      </div>

      {/* Navigation */}
      <nav className="bg-gray-900/80 backdrop-blur-xl border-b border-white/10 relative z-10">
        <div className="container mx-auto px-4 py-3 md:py-4">
          <div className="flex justify-between items-center">
            <Link href="/">
              <div className="flex items-center space-x-1 md:space-x-2">
                <span className="text-lg md:text-2xl font-bold">
                  <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">SMART</span>
                  <span className="bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">GRAM</span>
                </span>
                <Badge className="bg-gradient-to-r from-blue-500/20 to-purple-500/20 text-blue-400 border-blue-400/30 text-xs md:text-sm" size="sm">v2.0</Badge>
              </div>
            </Link>

            {/* Desktop Navigation */}
            <div className="hidden md:flex space-x-4">
              <Link href="/login">
                <Button className="bg-white/10 border border-white/20 text-white hover:bg-white/20 backdrop-blur-sm" size="md">
                  ログイン
                </Button>
              </Link>
              <Link href="/register">
                <Button className="bg-gradient-to-r from-blue-500 to-purple-500 text-white hover:from-blue-600 hover:to-purple-600 shadow-xl border border-white/20" size="md">
                  新規登録
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
                <Link href="/login" onClick={() => setIsMenuOpen(false)}>
                  <Button className="bg-white/10 border border-white/20 text-white hover:bg-white/20 text-sm w-full" size="md">
                    ログイン
                  </Button>
                </Link>
                <Link href="/register" onClick={() => setIsMenuOpen(false)}>
                  <Button className="bg-gradient-to-r from-blue-500 to-purple-500 text-white hover:from-blue-600 hover:to-purple-600 text-sm w-full" size="md">
                    新規登録
                  </Button>
                </Link>
              </div>
            </div>
          )}
        </div>
      </nav>

      {/* Terms Content */}
      <div className="container mx-auto px-4 py-8 md:py-12 relative z-10">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8 md:mb-12">
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent mb-3 md:mb-4">
              利用規約
            </h1>
            <p className="text-gray-300 text-base md:text-lg px-2">
              SMARTGRAMサービスの利用に関する規約
            </p>
            <Badge className="bg-gradient-to-r from-blue-500/20 to-purple-500/20 text-blue-400 border-blue-400/30 mt-4" size="md">
              最終更新: 2024年1月1日
            </Badge>
          </div>

          <Card className="bg-white/10 backdrop-blur-md shadow-xl border border-white/20">
            <CardContent className="p-4 md:p-6 lg:p-8">
              <div className="prose prose-invert max-w-none text-gray-300">

                <section className="mb-6 md:mb-8">
                  <h2 className="text-xl md:text-2xl font-bold text-white mb-3 md:mb-4">第1条（目的）</h2>
                  <p className="mb-3 md:mb-4 text-sm md:text-base">
                    本利用規約（以下「本規約」といいます）は、SMARTGRAM（以下「当サービス」といいます）の利用条件を定めるものです。
                    ユーザーの皆様（以下「ユーザー」といいます）には、本規約に従って当サービスをご利用いただきます。
                  </p>
                </section>

                <section className="mb-6 md:mb-8">
                  <h2 className="text-xl md:text-2xl font-bold text-white mb-3 md:mb-4">第2条（利用登録）</h2>
                  <p className="mb-3 md:mb-4 text-sm md:text-base">
                    当サービスにおいて、登録希望者が当社の定める方法によって利用登録を申請し、当社がこれを承認することによって、利用登録が完了するものとします。
                  </p>
                  <p className="mb-4">
                    当社は、利用登録の申請者に以下の事由があると判断した場合、利用登録の申請を承認しないことがあり、その理由については一切の開示義務を負わないものとします。
                  </p>
                  <ul className="list-disc pl-6 mb-4 text-gray-400">
                    <li>利用登録の申請に際して虚偽の事項を届け出た場合</li>
                    <li>本規約に違反したことがある者からの申請である場合</li>
                    <li>その他、当社が利用登録を相当でないと判断した場合</li>
                  </ul>
                </section>

                <section className="mb-8">
                  <h2 className="text-2xl font-bold text-white mb-4">第3条（ユーザーIDおよびパスワードの管理）</h2>
                  <p className="mb-4">
                    ユーザーは、自己の責任において、当サービスのユーザーIDおよびパスワードを適切に管理するものとします。
                  </p>
                  <p className="mb-4">
                    ユーザーは、いかなる場合にも、ユーザーIDおよびパスワードを第三者に譲渡または貸与し、もしくは第三者と共用することはできません。
                  </p>
                </section>

                <section className="mb-8">
                  <h2 className="text-2xl font-bold text-white mb-4">第4条（料金および支払方法）</h2>
                  <p className="mb-4">
                    ユーザーは、当サービスの有料部分の対価として、当社が別途定め、本ウェブサイトに表示する料金を、当社が指定する方法により支払うものとします。
                  </p>
                  <p className="mb-4">
                    ユーザーが料金の支払を遅滞した場合には、ユーザーは年14.6％の割合による遅延損害金を支払うものとします。
                  </p>
                </section>

                <section className="mb-8">
                  <h2 className="text-2xl font-bold text-white mb-4">第5条（禁止事項）</h2>
                  <p className="mb-4">
                    ユーザーは、当サービスの利用にあたり、以下の行為をしてはなりません。
                  </p>
                  <ul className="list-disc pl-6 mb-4 text-gray-400">
                    <li>法令または公序良俗に違反する行為</li>
                    <li>犯罪行為に関連する行為</li>
                    <li>当社、当サービスの他のユーザー、または第三者のサーバーまたはネットワークの機能を破壊したり、妨害したりする行為</li>
                    <li>当サービスの運営を妨害するおそれのある行為</li>
                    <li>他のユーザーに関する個人情報等を収集または蓄積する行為</li>
                    <li>不正アクセスをし、またはこれを試みる行為</li>
                    <li>他のユーザーに成りすます行為</li>
                    <li>当サービスに関連して、反社会的勢力に対して直接または間接に利益を供与する行為</li>
                    <li>その他、当社が不適切と判断する行為</li>
                  </ul>
                </section>

                <section className="mb-8">
                  <h2 className="text-2xl font-bold text-white mb-4">第6条（本サービスの提供の停止等）</h2>
                  <p className="mb-4">
                    当社は、以下のいずれかの事由があると判断した場合、ユーザーに事前に通知することなく本サービスの全部または一部の提供を停止または中断することができるものとします。
                  </p>
                  <ul className="list-disc pl-6 mb-4 text-gray-400">
                    <li>本サービスにかかるコンピュータシステムの保守点検または更新を行う場合</li>
                    <li>地震、落雷、火災、停電または天災などの不可抗力により、本サービスの提供が困難となった場合</li>
                    <li>コンピュータまたは通信回線等が事故により停止した場合</li>
                    <li>その他、当社が本サービスの提供が困難と判断した場合</li>
                  </ul>
                </section>

                <section className="mb-8">
                  <h2 className="text-2xl font-bold text-white mb-4">第7条（免責事項）</h2>
                  <p className="mb-4">
                    当社は、本サービスに事実上または法律上の瑕疵（安全性、信頼性、正確性、完全性、有効性、特定の目的への適合性、セキュリティなどに関する欠陥、エラーやバグ、権利侵害などを含みます）がないことを明示的にも黙示的にも保証しておりません。
                  </p>
                  <p className="mb-4">
                    当社は、本サービスに起因してユーザーに生じたあらゆる損害について一切の責任を負いません。
                  </p>
                </section>

                <section className="mb-8">
                  <h2 className="text-2xl font-bold text-white mb-4">第8条（サービス内容の変更等）</h2>
                  <p className="mb-4">
                    当社は、ユーザーに通知することなく、本サービスの内容を変更しまたは本サービスの提供を中止することができるものとし、これによってユーザーに生じた損害について一切の責任を負いません。
                  </p>
                </section>

                <section className="mb-8">
                  <h2 className="text-2xl font-bold text-white mb-4">第9条（利用規約の変更）</h2>
                  <p className="mb-4">
                    当社は、必要と判断した場合には、ユーザーに通知することなくいつでも本規約を変更することができるものとします。なお、本規約の変更後、本サービスの利用を開始した場合には、当該ユーザーは変更後の規約に同意したものとみなします。
                  </p>
                </section>

                <section className="mb-6 md:mb-8">
                  <h2 className="text-xl md:text-2xl font-bold text-white mb-3 md:mb-4">第10条（準拠法・裁判管轄）</h2>
                  <p className="mb-3 md:mb-4 text-sm md:text-base">
                    本規約の解釈にあたっては、日本法を準拠法とします。
                  </p>
                  <p className="mb-3 md:mb-4 text-sm md:text-base">
                    本サービスに関して紛争が生じた場合には、当社の本店所在地を管轄する裁判所を専属的合意管轄とします。
                  </p>
                </section>

              </div>
            </CardContent>
          </Card>

          <div className="text-center mt-8">
            <Link href="/">
              <Button className="bg-gradient-to-r from-blue-500 to-purple-500 text-white hover:from-blue-600 hover:to-purple-600 shadow-xl border border-white/20" size="lg">
                ホームに戻る
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}