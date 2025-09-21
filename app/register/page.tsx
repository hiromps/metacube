'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import PayPalButton from '@/components/PayPalButton'
import { Button } from '@/app/components/ui/Button'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/app/components/ui/Card'
import { Badge } from '@/app/components/ui/Badge'
import { LoadingScreen } from '@/app/components/LoadingScreen'

function RegisterForm() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [deviceHash, setDeviceHash] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [step, setStep] = useState<'form' | 'payment'>('form')
  const [registrationData, setRegistrationData] = useState<any>(null)

  // Get error from URL params
  const urlError = searchParams.get('error')

  const validateForm = () => {
    if (!deviceHash || deviceHash.length < 3) {
      setError('デバイスIDを入力してください')
      return false
    }

    if (!email || !email.includes('@')) {
      setError('有効なメールアドレスを入力してください')
      return false
    }

    if (!password || password.length < 6) {
      setError('パスワードは6文字以上である必要があります')
      return false
    }

    if (password !== confirmPassword) {
      setError('パスワードが一致しません')
      return false
    }

    return true
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!validateForm()) {
      return
    }

    setLoading(true)

    try {
      const response = await fetch('/api/device/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          device_hash: deviceHash,
          email,
          password
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || '登録に失敗しました')
      }

      // Save registration data and proceed to payment
      setRegistrationData(data.data)
      setStep('payment')

    } catch (error: any) {
      console.error('Registration error:', error)
      setError(error.message || '登録中にエラーが発生しました')
    } finally {
      setLoading(false)
    }
  }

  const handlePaymentSuccess = (data: any) => {
    console.log('Payment successful:', data)
    router.push('/dashboard?success=true')
  }

  const handlePaymentError = (error: any) => {
    console.error('Payment error:', error)
    setError('決済処理に失敗しました。もう一度お試しください。')
    setStep('form')
  }

  const handlePaymentCancel = () => {
    setError('決済がキャンセルされました')
    setStep('form')
  }

  if (step === 'payment' && registrationData) {
    return (
      <div className="min-h-screen bg-white">
        {/* Navigation */}
        <nav className="bg-white shadow-sm border-b border-gray-100">
          <div className="container mx-auto px-4 py-4">
            <div className="flex justify-between items-center">
              <Link href="/">
                <div className="flex items-center space-x-2">
                  <span className="text-2xl font-bold text-blue-600">
                    MetaCube
                  </span>
                  <Badge className="bg-blue-100 text-blue-700 border-blue-200" size="sm">v2.0</Badge>
                </div>
              </Link>
              <Link href="/login">
                <Button className="bg-white border-2 border-blue-500 text-blue-600 hover:bg-blue-50" size="md">
                  ログイン
                </Button>
              </Link>
            </div>
          </div>
        </nav>

        {/* Payment Form */}
        <div className="flex items-center justify-center min-h-[calc(100vh-73px)]">
          <div className="w-full max-w-md px-4 py-8">
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold text-gray-800 mb-2">
                決済情報の入力
              </h1>
              <p className="text-gray-600">
                PayPalで安全にお支払い
              </p>
            </div>

            <Card className="bg-white shadow-lg border border-gray-100">
              <CardContent className="p-6">
                {error && (
                  <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-600 rounded-lg text-sm">
                    {error}
                  </div>
                )}

                <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <p className="text-sm text-gray-600 mb-2">登録情報</p>
                  <p className="text-gray-800 font-medium">{email}</p>
                  <p className="text-xs text-gray-500 mt-1">デバイス: {deviceHash}</p>
                </div>

                <PayPalButton
                  deviceHash={deviceHash}
                  email={email}
                  onSuccess={handlePaymentSuccess}
                  onError={handlePaymentError}
                  onCancel={handlePaymentCancel}
                />

                <Button
                  onClick={() => setStep('form')}
                  className="mt-4 bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"
                  size="md"
                  fullWidth
                >
                  戻る
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="bg-white shadow-sm border-b border-gray-100">
        <div className="container mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <Link href="/">
              <div className="flex items-center space-x-2">
                <span className="text-2xl font-bold text-blue-600">
                  MetaCube
                </span>
                <Badge className="bg-blue-100 text-blue-700 border-blue-200" size="sm">v2.0</Badge>
              </div>
            </Link>
            <Link href="/login">
              <Button className="bg-white border-2 border-blue-500 text-blue-600 hover:bg-blue-50" size="md">
                ログイン
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Registration Form */}
      <div className="flex items-center justify-center min-h-[calc(100vh-73px)]">
        <div className="w-full max-w-md px-4 py-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-800 mb-2">
              アカウント作成
            </h1>
            <p className="text-gray-600">
              今すぐ始めて、Instagram成長を加速させましょう
            </p>
            <Badge className="bg-green-100 text-green-700 border-green-200 mt-2" size="md">
              3日間無料トライアル
            </Badge>
          </div>

          <Card className="bg-white shadow-lg border border-gray-100">
            <CardContent className="p-6">
              {urlError && (
                <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 text-yellow-700 rounded-lg text-sm">
                  {urlError === 'cancelled' && '決済がキャンセルされました'}
                  {urlError === 'missing_device' && 'デバイス情報が見つかりません'}
                  {urlError === 'device_not_found' && 'デバイスが登録されていません'}
                  {urlError === 'processing_failed' && '処理に失敗しました'}
                </div>
              )}

              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-600 rounded-lg text-sm">
                  {error}
                </div>
              )}

              <form onSubmit={handleRegister} className="space-y-4">
                <div>
                  <label htmlFor="deviceHash" className="block text-sm font-medium text-gray-700 mb-2">
                    デバイスID
                  </label>
                  <input
                    type="text"
                    id="deviceHash"
                    value={deviceHash}
                    onChange={(e) => setDeviceHash(e.target.value)}
                    className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-800 placeholder-gray-400 transition"
                    placeholder="例: DEMO-DEVICE-001"
                    required
                    disabled={loading}
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    AutoTouchのmain.luaで表示されるデバイスID
                  </p>
                </div>

                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                    メールアドレス
                  </label>
                  <input
                    type="email"
                    id="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-800 placeholder-gray-400 transition"
                    placeholder="email@example.com"
                    required
                    disabled={loading}
                  />
                </div>

                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                    パスワード
                  </label>
                  <input
                    type="password"
                    id="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-800 placeholder-gray-400 transition"
                    placeholder="6文字以上"
                    minLength={6}
                    required
                    disabled={loading}
                  />
                </div>

                <div>
                  <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-2">
                    パスワード（確認）
                  </label>
                  <input
                    type="password"
                    id="confirmPassword"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-800 placeholder-gray-400 transition"
                    placeholder="パスワードを再入力"
                    minLength={6}
                    required
                    disabled={loading}
                  />
                </div>

                <div className="flex items-start mt-4">
                  <input
                    id="terms"
                    name="terms"
                    type="checkbox"
                    required
                    className="w-4 h-4 bg-white border-gray-300 rounded text-blue-600 focus:ring-blue-500 focus:ring-offset-0 mt-1"
                  />
                  <label htmlFor="terms" className="ml-2 block text-sm text-gray-600">
                    <a href="#" className="text-blue-600 hover:text-blue-700">利用規約</a>と
                    <a href="#" className="text-blue-600 hover:text-blue-700">プライバシーポリシー</a>に同意します
                  </label>
                </div>

                <Button
                  type="submit"
                  className="bg-blue-500 text-white hover:bg-blue-600 shadow-md hover:shadow-lg transition-all"
                  size="lg"
                  fullWidth
                  loading={loading}
                >
                  {loading ? '処理中...' : '次へ（決済情報入力）'}
                </Button>
              </form>

              <div className="mt-6 text-center">
                <p className="text-sm text-gray-600">
                  既にアカウントをお持ちですか？{' '}
                  <Link href="/login" className="text-blue-600 hover:text-blue-700 font-medium transition">
                    ログイン
                  </Link>
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Pricing Info */}
          <Card className="mt-6 bg-white shadow-md border border-gray-100">
            <CardContent className="py-4">
              <h3 className="text-sm font-semibold mb-3 text-gray-800 flex items-center">
                <Badge className="bg-blue-100 text-blue-700 border-blue-200 mr-2" size="sm">料金プラン</Badge>
                今なら特別価格
              </h3>
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div className="space-y-2">
                  <div className="flex items-center text-gray-700">
                    <svg className="w-4 h-4 text-blue-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    月額¥2,980〜
                  </div>
                  <div className="flex items-center text-gray-700">
                    <svg className="w-4 h-4 text-blue-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    3日間無料体験
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center text-gray-700">
                    <svg className="w-4 h-4 text-blue-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    いつでも解約可能
                  </div>
                  <div className="flex items-center text-gray-700">
                    <svg className="w-4 h-4 text-blue-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    iPhone 7/8専用
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<LoadingScreen message="登録ページを読み込み中..." />}>
      <RegisterForm />
    </Suspense>
  )
}