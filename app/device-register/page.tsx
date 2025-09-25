'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { getCurrentUser } from '@/lib/auth/client'
import { Button } from '@/app/components/ui/Button'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/app/components/ui/Card'
import { Badge } from '@/app/components/ui/Badge'

export default function DeviceRegisterPage() {
  const router = useRouter()
  const [deviceHash, setDeviceHash] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [user, setUser] = useState<any>(null)

  useEffect(() => {
    const checkAuth = async () => {
      const currentUser = await getCurrentUser()
      if (!currentUser) {
        router.push('/login?redirect=/device-register')
        return
      }
      setUser(currentUser)
    }
    checkAuth()
  }, [router])

  const validateDeviceHash = (hash: string): boolean => {
    // デバイスハッシュは通常32文字の英数字
    const hashRegex = /^[A-Fa-f0-9]{32,40}$/
    return hashRegex.test(hash)
  }

  const handleDeviceRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (!deviceHash.trim()) {
      setError('デバイスハッシュを入力してください')
      return
    }

    if (!validateDeviceHash(deviceHash.trim())) {
      setError('デバイスハッシュの形式が正しくありません（32-40文字の英数字）')
      return
    }

    setLoading(true)

    try {
      const response = await fetch('/api/device/register-hash', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          device_hash: deviceHash.trim().toUpperCase(),
          user_id: user.id
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'デバイス登録に失敗しました')
      }

      setSuccess('デバイスが正常に登録されました！3日間の無料体験が開始されました。')
      setDeviceHash('')

      // 3秒後にダッシュボードにリダイレクト
      setTimeout(() => {
        router.push('/dashboard?device_registered=true')
      }, 3000)

    } catch (error: any) {
      console.error('Device registration error:', error)
      setError(error.message || 'デバイス登録中にエラーが発生しました')
    } finally {
      setLoading(false)
    }
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center">
        <div className="text-white">認証を確認中...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-5">
        <svg className="absolute inset-0 w-full h-full">
          <pattern id="deviceGrid" x="0" y="0" width="50" height="50" patternUnits="userSpaceOnUse">
            <circle cx="25" cy="25" r="1" fill="#3b82f6" />
          </pattern>
          <rect width="100%" height="100%" fill="url(#deviceGrid)" />
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
            <Link href="/dashboard">
              <Button className="bg-white/10 border border-white/20 text-white hover:bg-white/20 backdrop-blur-sm text-sm md:text-base" size="md">
                ダッシュボード
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="flex items-center justify-center min-h-[calc(100vh-73px)] relative z-10 px-4 py-8">
        <div className="w-full max-w-2xl">
          <div className="text-center mb-8">
            <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent mb-4">
              デバイス登録
            </h1>
            <p className="text-lg text-gray-300 mb-2">
              iPhone 7/8 対応 - Instagram自動化ツール
            </p>
            <Badge className="bg-gradient-to-r from-green-500/20 to-emerald-500/20 text-green-400 border-green-400/30" size="lg">
              3日間無料体験
            </Badge>
          </div>

          {/* Device Registration Form */}
          <Card className="bg-white/10 backdrop-blur-md shadow-xl border border-white/20 mb-6">
            <CardHeader>
              <CardTitle className="text-white text-xl">デバイスハッシュ登録</CardTitle>
              <CardDescription className="text-gray-300">
                iPhone設定アプリから取得したデバイスハッシュを入力してください
              </CardDescription>
            </CardHeader>
            <CardContent>
              {error && (
                <div className="mb-4 p-3 bg-red-500/20 border border-red-400/30 text-red-300 rounded-lg text-sm">
                  {error}
                </div>
              )}

              {success && (
                <div className="mb-4 p-3 bg-green-500/20 border border-green-400/30 text-green-300 rounded-lg text-sm">
                  {success}
                </div>
              )}

              <form onSubmit={handleDeviceRegister} className="space-y-4">
                <div>
                  <label htmlFor="deviceHash" className="block text-sm font-medium text-white mb-2">
                    デバイスハッシュ（32-40文字の英数字）
                  </label>
                  <input
                    type="text"
                    id="deviceHash"
                    value={deviceHash}
                    onChange={(e) => setDeviceHash(e.target.value)}
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-white placeholder-gray-400 backdrop-blur-sm transition font-mono text-sm"
                    placeholder="例: A1B2C3D4E5F6789012345678901234AB"
                    required
                    disabled={loading}
                    maxLength={40}
                  />
                  <div className="mt-1 text-xs text-gray-400">
                    現在の文字数: {deviceHash.length}/40
                  </div>
                </div>

                <Button
                  type="submit"
                  className="bg-gradient-to-r from-blue-500 to-purple-500 text-white hover:from-blue-600 hover:to-purple-600 shadow-xl hover:shadow-2xl transition-all"
                  size="lg"
                  fullWidth
                  loading={loading}
                >
                  {loading ? 'デバイス登録中...' : '🚀 デバイスを登録'}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* iPhone Settings Instructions */}
          <Card className="bg-white/10 backdrop-blur-md shadow-xl border border-white/20 mb-6">
            <CardHeader>
              <CardTitle className="text-white text-xl flex items-center">
                📱 iPhone設定でのデバイスハッシュ確認方法
              </CardTitle>
              <CardDescription className="text-gray-300">
                iPhone 7/8 専用手順（システム導入予定端末）
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4 text-sm text-gray-300">
                <div className="flex items-start space-x-3">
                  <span className="bg-blue-500/20 text-blue-400 rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">1</span>
                  <div>
                    <p className="font-medium text-white mb-1">設定アプリを開く</p>
                    <p>ホーム画面から「設定」アプリをタップします</p>
                  </div>
                </div>

                <div className="flex items-start space-x-3">
                  <span className="bg-blue-500/20 text-blue-400 rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">2</span>
                  <div>
                    <p className="font-medium text-white mb-1">一般 → 情報を選択</p>
                    <p>「一般」→「情報」の順にタップします</p>
                  </div>
                </div>

                <div className="flex items-start space-x-3">
                  <span className="bg-blue-500/20 text-blue-400 rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">3</span>
                  <div>
                    <p className="font-medium text-white mb-1">デバイス識別子を確認</p>
                    <p>「シリアル番号」または「UDID」の値をコピーします<br />
                    ※機種により表示項目が異なります</p>
                  </div>
                </div>

                <div className="flex items-start space-x-3">
                  <span className="bg-green-500/20 text-green-400 rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">✓</span>
                  <div>
                    <p className="font-medium text-white mb-1">上記フォームに入力</p>
                    <p>取得した識別子を上のフォームに貼り付けて登録してください</p>
                  </div>
                </div>
              </div>

              <div className="mt-6 p-3 bg-yellow-500/20 border border-yellow-400/30 rounded-lg">
                <div className="flex items-start space-x-2">
                  <span className="text-yellow-400 text-lg">⚠️</span>
                  <div className="text-yellow-300 text-xs">
                    <p className="font-medium mb-1">重要な注意事項</p>
                    <ul className="list-disc list-inside space-y-1">
                      <li>本システムはiPhone 7/8専用です</li>
                      <li>AutoTouchアプリの事前インストールが必要です</li>
                      <li>デバイスハッシュは1アカウントにつき1台まで</li>
                      <li>登録後は3日間の無料体験が開始されます</li>
                    </ul>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Troubleshooting */}
          <Card className="bg-white/10 backdrop-blur-md shadow-xl border border-white/20">
            <CardHeader>
              <CardTitle className="text-white text-lg">🔧 トラブルシューティング</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 text-sm text-gray-300">
                <div>
                  <p className="font-medium text-white mb-1">Q. デバイスハッシュが見つからない</p>
                  <p>A. 設定 → プライバシーとセキュリティ → 解析とクラッシュ から確認できる場合があります</p>
                </div>

                <div>
                  <p className="font-medium text-white mb-1">Q. 登録エラーが発生する</p>
                  <p>A. デバイスハッシュが32-40文字の英数字であることを確認してください</p>
                </div>

                <div>
                  <p className="font-medium text-white mb-1">Q. 既に登録済みと表示される</p>
                  <p>A. 同じデバイスが他のアカウントで登録済みの可能性があります</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="text-center mt-8">
            <p className="text-sm text-gray-400">
              登録に関するお問い合わせは{' '}
              <Link href="/contact" className="text-blue-400 hover:text-blue-300">
                サポート
              </Link>{' '}
              までお気軽にどうぞ
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}