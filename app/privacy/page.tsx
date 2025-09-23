'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/app/components/ui/Button'
import { Card, CardContent } from '@/app/components/ui/Card'
import { Badge } from '@/app/components/ui/Badge'

export default function PrivacyPage() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-5">
        <svg className="absolute inset-0 w-full h-full">
          <pattern id="privacyGrid" x="0" y="0" width="50" height="50" patternUnits="userSpaceOnUse">
            <circle cx="25" cy="25" r="1" fill="#3b82f6" />
          </pattern>
          <rect width="100%" height="100%" fill="url(#privacyGrid)" />
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

      {/* Privacy Content */}
      <div className="container mx-auto px-4 py-8 md:py-12 relative z-10">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8 md:mb-12">
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent mb-3 md:mb-4">
              プライバシーポリシー
            </h1>
            <p className="text-gray-300 text-base md:text-lg px-2">
              SMARTGRAMにおける個人情報の取り扱いについて
            </p>
            <Badge className="bg-gradient-to-r from-green-500/20 to-emerald-500/20 text-green-400 border-green-400/30 mt-4" size="md">
              最終更新: 2024年1月1日
            </Badge>
          </div>

          <Card className="bg-white/10 backdrop-blur-md shadow-xl border border-white/20">
            <CardContent className="p-4 md:p-6 lg:p-8">
              <div className="prose prose-invert max-w-none text-gray-300">

                <section className="mb-6 md:mb-8">
                  <h2 className="text-xl md:text-2xl font-bold text-white mb-3 md:mb-4">1. 基本方針</h2>
                  <p className="mb-3 md:mb-4 text-sm md:text-base">
                    SMARTGRAM（以下「当サービス」といいます）は、ユーザーの個人情報の重要性を認識し、個人情報の保護に関する法律（個人情報保護法）を遵守し、適切な取り扱いと保護に努めます。
                  </p>
                </section>

                <section className="mb-6 md:mb-8">
                  <h2 className="text-xl md:text-2xl font-bold text-white mb-3 md:mb-4">2. 個人情報の定義</h2>
                  <p className="mb-3 md:mb-4 text-sm md:text-base">
                    個人情報とは、個人情報保護法にいう「個人情報」を指すものとし、生存する個人に関する情報であって、当該情報に含まれる氏名、生年月日、住所、電話番号、連絡先その他の記述等により特定の個人を識別できる情報及び容貌、指紋、声紋にかかるデータ、及び健康保険証の保険者番号などの当該情報単体から特定の個人を識別できる情報（個人識別情報）を指します。
                  </p>
                </section>

                <section className="mb-6 md:mb-8">
                  <h2 className="text-xl md:text-2xl font-bold text-white mb-3 md:mb-4">3. 個人情報の収集方法</h2>
                  <p className="mb-3 md:mb-4 text-sm md:text-base">
                    当サービスは、ユーザーが利用登録をする際に氏名、生年月日、住所、電話番号、メールアドレス、銀行口座番号、クレジットカード番号、運転免許証番号などの個人情報をお尋ねすることがあります。また、ユーザーと提携先などとの間でなされたユーザーの個人情報を含む取引記録や決済に関する情報を、当サービスの提携先（情報提供元、広告主、広告配信先などを含みます。以下、「提携先」といいます）などから収集することがあります。
                  </p>
                </section>

                <section className="mb-6 md:mb-8">
                  <h2 className="text-xl md:text-2xl font-bold text-white mb-3 md:mb-4">4. 個人情報を収集・利用する目的</h2>
                  <p className="mb-3 md:mb-4 text-sm md:text-base">
                    当サービスが個人情報を収集・利用する目的は、以下のとおりです。
                  </p>
                  <ul className="list-disc pl-4 md:pl-6 mb-3 md:mb-4 text-gray-400 text-sm md:text-base">
                    <li>当サービスの提供・運営のため</li>
                    <li>ユーザーからのお問い合わせに回答するため（本人確認を行うことを含む）</li>
                    <li>ユーザーが利用中のサービスの新機能、更新情報、キャンペーン等及び当サービスが提供する他のサービスの案内のメールを送付するため</li>
                    <li>メンテナンス、重要なお知らせなど必要に応じたご連絡のため</li>
                    <li>利用規約に違反したユーザーや、不正・不当な目的でサービスを利用しようとするユーザーの特定をし、ご利用をお断りするため</li>
                    <li>ユーザーにご自身の登録情報の閲覧や変更、削除、ご利用状況の閲覧を行っていただくため</li>
                    <li>有料サービスにおいて、ユーザーに利用料金を請求するため</li>
                    <li>上記の利用目的に付随する目的</li>
                  </ul>
                </section>

                <section className="mb-6 md:mb-8">
                  <h2 className="text-xl md:text-2xl font-bold text-white mb-3 md:mb-4">5. 利用目的の変更</h2>
                  <p className="mb-3 md:mb-4 text-sm md:text-base">
                    当サービスは、利用目的が変更前と関連性を有すると合理的に認められる場合に限り、個人情報の利用目的を変更するものとします。
                  </p>
                  <p className="mb-3 md:mb-4 text-sm md:text-base">
                    利用目的の変更を行った場合には、変更後の目的について、当サービス所定の方法により、ユーザーに通知し、または本ウェブサイト上に公表するものとします。
                  </p>
                </section>

                <section className="mb-6 md:mb-8">
                  <h2 className="text-xl md:text-2xl font-bold text-white mb-3 md:mb-4">6. 個人情報の第三者提供</h2>
                  <p className="mb-3 md:mb-4 text-sm md:text-base">
                    当サービスは、次に掲げる場合を除いて、あらかじめユーザーの同意を得ることなく、第三者に個人情報を提供することはありません。ただし、個人情報保護法その他の法令で認められる場合を除きます。
                  </p>
                  <ul className="list-disc pl-4 md:pl-6 mb-3 md:mb-4 text-gray-400 text-sm md:text-base">
                    <li>人の生命、身体または財産の保護のために必要がある場合であって、本人の同意を得ることが困難であるとき</li>
                    <li>公衆衛生の向上または児童の健全な育成の推進のために特に必要がある場合であって、本人の同意を得ることが困難であるとき</li>
                    <li>国の機関もしくは地方公共団体またはその委託を受けた者が法令の定める事務を遂行することに対して協力する必要がある場合であって、本人の同意を得ることにより当該事務の遂行に支障を及ぼすおそれがあるとき</li>
                    <li>予め次の事項を告知あるいは公表し、かつ当サービスが個人情報保護委員会に届出をしたとき</li>
                  </ul>
                </section>

                <section className="mb-6 md:mb-8">
                  <h2 className="text-xl md:text-2xl font-bold text-white mb-3 md:mb-4">7. 個人情報の開示</h2>
                  <p className="mb-3 md:mb-4 text-sm md:text-base">
                    当サービスは、本人から個人情報の開示を求められたときは、本人に対し、遅滞なくこれを開示します。ただし、開示することにより次のいずれかに該当する場合は、その全部または一部を開示しないこともあり、開示しない決定をした場合には、その旨を遅滞なく通知します。
                  </p>
                  <ul className="list-disc pl-4 md:pl-6 mb-3 md:mb-4 text-gray-400 text-sm md:text-base">
                    <li>本人または第三者の生命、身体、財産その他の権利利益を害するおそれがある場合</li>
                    <li>当サービスの業務の適正な実施に著しい支障を及ぼすおそれがある場合</li>
                    <li>その他法令に違反することとなる場合</li>
                  </ul>
                </section>

                <section className="mb-6 md:mb-8">
                  <h2 className="text-xl md:text-2xl font-bold text-white mb-3 md:mb-4">8. 個人情報の訂正および削除</h2>
                  <p className="mb-3 md:mb-4 text-sm md:text-base">
                    ユーザーは、当サービスの保有する自己の個人情報が誤った情報である場合には、当サービスが定める手続きにより、当サービスに対して個人情報の訂正、追加または削除（以下、「訂正等」といいます）を請求することができます。
                  </p>
                  <p className="mb-3 md:mb-4 text-sm md:text-base">
                    当サービスは、ユーザーから前項の請求を受けてその請求に応じる必要があると判断した場合には、遅滞なく、当該個人情報の訂正等を行うものとします。
                  </p>
                </section>

                <section className="mb-6 md:mb-8">
                  <h2 className="text-xl md:text-2xl font-bold text-white mb-3 md:mb-4">9. 個人情報の利用停止等</h2>
                  <p className="mb-3 md:mb-4 text-sm md:text-base">
                    当サービスは、本人から、個人情報が、利用目的の範囲を超えて取り扱われているという理由、または不正の手段により取得されたものであるという理由により、その利用の停止または消去（以下、「利用停止等」といいます）を求められた場合には、遅滞なく必要な調査を行います。
                  </p>
                </section>

                <section className="mb-6 md:mb-8">
                  <h2 className="text-xl md:text-2xl font-bold text-white mb-3 md:mb-4">10. プライバシーポリシーの変更</h2>
                  <p className="mb-3 md:mb-4 text-sm md:text-base">
                    本ポリシーの内容は、法令その他本ポリシーに別段の定めのある事項を除いて、ユーザーに通知することなく、変更することができるものとします。
                  </p>
                  <p className="mb-3 md:mb-4 text-sm md:text-base">
                    当サービスが別途定める場合を除いて、変更後のプライバシーポリシーは、本ウェブサイトに掲載したときから効力を生じるものとします。
                  </p>
                </section>

                <section className="mb-6 md:mb-8">
                  <h2 className="text-xl md:text-2xl font-bold text-white mb-3 md:mb-4">11. お問い合わせ窓口</h2>
                  <p className="mb-3 md:mb-4 text-sm md:text-base">
                    本ポリシーに関するお問い合わせは、下記の窓口までお願いいたします。
                  </p>
                  <div className="bg-gray-800/50 rounded-lg p-3 md:p-4 text-gray-300">
                    <p className="mb-1 md:mb-2 text-sm md:text-base"><strong>SMARTGRAM サポート</strong></p>
                    <p className="mb-1 md:mb-2 text-sm md:text-base">メール: support@smartgram.jp</p>
                    <p className="text-sm md:text-base">受付時間: 平日 10:00-18:00</p>
                  </div>
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