'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import PayPalButton from '@/components/PayPalButton'
import { Button } from '@/app/components/ui/Button'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/app/components/ui/Card'
import { Badge } from '@/app/components/ui/Badge'

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
      <div className="min-h-screen flex items-center justify-center bg-gradient-dark relative overflow-hidden">
        {/* Animated Background */}
        <div className="absolute inset-0">
          <div className="absolute top-0 -left-4 w-96 h-96 bg-matrix rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-float"></div>
          <div className="absolute bottom-0 right-0 w-96 h-96 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-float animation-delay-2000"></div>
        </div>

        <div className="relative z-10 w-full max-w-md px-4">
          <div className="text-center mb-8">
            <Link href="/">
              <h1 className="text-4xl font-bold mb-2 bg-gradient-matrix bg-clip-text text-transparent inline-block">
                MetaCube
              </h1>
            </Link>
            <Badge variant="glass" size="md">
              セキュア決済
            </Badge>
          </div>

          <Card variant="glass" className="backdrop-blur-xl bg-white/5">
            <CardHeader className="text-center">
              <CardTitle className="text-2xl text-white">決済情報の入力</CardTitle>
              <CardDescription>
                PayPalで安全にお支払い
              </CardDescription>
            </CardHeader>
            <CardContent>
              {error && (
                <div className="mb-4 p-4 bg-error/10 border border-error/30 text-error rounded-lg animate-slide-down">
                  {error}
                </div>
              )}

              <div className="mb-6 p-4 bg-white/5 rounded-lg border border-white/10">
                <p className="text-sm text-gray-400 mb-2">登録情報</p>
                <p className="text-white font-medium">{email}</p>
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
                variant="outline"
                size="md"
                fullWidth
                className="mt-4 border-white/20 text-gray-300 hover:bg-white/10"
              >
                戻る
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-dark relative overflow-hidden">
      {/* Animated Background */}
      <div className="absolute inset-0">
        <div className="absolute top-20 left-20 w-72 h-72 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-float"></div>
        <div className="absolute bottom-20 right-20 w-72 h-72 bg-matrix rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-float animation-delay-2000"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-72 bg-pink-500 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-float animation-delay-4000"></div>
      </div>

      <div className="relative z-10 w-full max-w-md px-4">
        <div className="text-center mb-8">
          <Link href="/">
            <h1 className="text-4xl font-bold mb-2 bg-gradient-matrix bg-clip-text text-transparent inline-block">
              MetaCube
            </h1>
          </Link>
          <Badge variant="glass" size="md">
            3日間無料トライアル
          </Badge>
        </div>

        <Card variant="glass" className="backdrop-blur-xl bg-white/5">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl text-white">アカウント作成</CardTitle>
            <CardDescription>
              今すぐ始めて、Instagram成長を加速させましょう
            </CardDescription>
          </CardHeader>
          <CardContent>
            {urlError && (
              <div className="mb-4 p-4 bg-warning/10 border border-warning/30 text-warning rounded-lg animate-slide-down">
                {urlError === 'cancelled' && '決済がキャンセルされました'}
                {urlError === 'missing_device' && 'デバイス情報が見つかりません'}
                {urlError === 'device_not_found' && 'デバイスが登録されていません'}
                {urlError === 'processing_failed' && '処理に失敗しました'}
              </div>
            )}

            {error && (
              <div className="mb-4 p-4 bg-error/10 border border-error/30 text-error rounded-lg animate-slide-down">
                {error}
              </div>
            )}

            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <label htmlFor="deviceHash" className="block text-sm font-medium text-gray-300 mb-2">
                  デバイスID
                </label>
                <input
                  type="text"
                  id="deviceHash"
                  value={deviceHash}
                  onChange={(e) => setDeviceHash(e.target.value)}
                  className="w-full px-4 py-3 bg-white/10 backdrop-blur-md border border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-matrix focus:border-transparent text-white placeholder-gray-400 transition"
                  placeholder="例: DEMO-DEVICE-001"
                  required
                  disabled={loading}
                />
                <p className="mt-1 text-xs text-gray-400">
                  AutoTouchのmain.luaで表示されるデバイスID
                </p>
              </div>

              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-2">
                  メールアドレス
                </label>
                <input
                  type="email"
                  id="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 bg-white/10 backdrop-blur-md border border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-matrix focus:border-transparent text-white placeholder-gray-400 transition"
                  placeholder="email@example.com"
                  required
                  disabled={loading}
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-2">
                  パスワード
                </label>
                <input
                  type="password"
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-white/10 backdrop-blur-md border border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-matrix focus:border-transparent text-white placeholder-gray-400 transition"
                  placeholder="6文字以上"
                  minLength={6}
                  required
                  disabled={loading}
                />
              </div>

              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-300 mb-2">
                  パスワード（確認）
                </label>
                <input
                  type="password"
                  id="confirmPassword"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-white/10 backdrop-blur-md border border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-matrix focus:border-transparent text-white placeholder-gray-400 transition"
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
                  className="w-4 h-4 bg-white/10 border-white/20 rounded text-matrix focus:ring-matrix focus:ring-offset-0 mt-1"
                />
                <label htmlFor="terms" className="ml-2 block text-sm text-gray-300">
                  <a href="#" className="text-matrix hover:text-matrix-light">利用規約</a>と
                  <a href="#" className="text-matrix hover:text-matrix-light">プライバシーポリシー</a>に同意します
                </label>
              </div>

              <Button
                type="submit"
                variant="glow"
                size="lg"
                fullWidth
                loading={loading}
              >
                {loading ? '処理中...' : '次へ（決済情報入力）'}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <p className="text-sm text-gray-400">
                既にアカウントをお持ちですか？{' '}
                <Link href="/login" className="text-matrix hover:text-matrix-light font-medium transition">
                  ログイン
                </Link>
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Pricing Info */}
        <Card variant="glass" className="mt-6 backdrop-blur-xl bg-white/5">
          <CardContent className="py-4">
            <h3 className="text-sm font-semibold mb-3 text-white flex items-center">
              <Badge variant="matrix" size="sm" className="mr-2">料金プラン</Badge>
              今なら特別価格
            </h3>
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div className="space-y-2">
                <div className="flex items-center text-gray-300">
                  <svg className="w-4 h-4 text-matrix mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  月額¥2,980（税込）
                </div>
                <div className="flex items-center text-gray-300">
                  <svg className="w-4 h-4 text-matrix mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  3日間無料体験
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center text-gray-300">
                  <svg className="w-4 h-4 text-matrix mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  いつでも解約可能
                </div>
                <div className="flex items-center text-gray-300">
                  <svg className="w-4 h-4 text-matrix mr-2" fill="currentColor" viewBox="0 0 20 20">
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
  )
}

export default function RegisterPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gradient-dark">
        <div className="text-gray-400 animate-pulse">Loading...</div>
      </div>
    }>
      <RegisterForm />
    </Suspense>
  )
}