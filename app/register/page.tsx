'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import PayPalButton from '@/components/PayPalButton'

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
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md">
          <h1 className="text-2xl font-bold mb-6 text-center">SocialTouch</h1>
          <h2 className="text-lg mb-6 text-center text-gray-600">決済情報の入力</h2>

          {error && (
            <div className="mb-4 p-3 bg-red-100 text-red-700 rounded">
              {error}
            </div>
          )}

          <div className="mb-6 p-4 bg-gray-50 rounded">
            <p className="text-sm text-gray-600 mb-2">登録情報</p>
            <p className="text-sm font-medium">{email}</p>
            <p className="text-xs text-gray-500 mt-1">デバイス: {deviceHash}</p>
          </div>

          <PayPalButton
            deviceHash={deviceHash}
            email={email}
            onSuccess={handlePaymentSuccess}
            onError={handlePaymentError}
            onCancel={handlePaymentCancel}
          />

          <button
            onClick={() => setStep('form')}
            className="w-full mt-4 text-sm text-gray-500 hover:text-gray-700"
          >
            戻る
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md">
        <h1 className="text-2xl font-bold mb-6 text-center">SocialTouch</h1>
        <h2 className="text-lg mb-6 text-center text-gray-600">デバイス登録</h2>

        {urlError && (
          <div className="mb-4 p-3 bg-yellow-100 text-yellow-700 rounded">
            {urlError === 'cancelled' && '決済がキャンセルされました'}
            {urlError === 'missing_device' && 'デバイス情報が見つかりません'}
            {urlError === 'device_not_found' && 'デバイスが登録されていません'}
            {urlError === 'processing_failed' && '処理に失敗しました'}
          </div>
        )}

        {error && (
          <div className="mb-4 p-3 bg-red-100 text-red-700 rounded">
            {error}
          </div>
        )}

        <form onSubmit={handleRegister}>
          <div className="mb-4">
            <label htmlFor="deviceHash" className="block text-sm font-medium text-gray-700 mb-2">
              デバイスID
            </label>
            <input
              type="text"
              id="deviceHash"
              value={deviceHash}
              onChange={(e) => setDeviceHash(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="例: DEMO-DEVICE-001"
              required
              disabled={loading}
            />
            <p className="mt-1 text-xs text-gray-500">
              AutoTouchのmain.luaで表示されるデバイスID
            </p>
          </div>

          <div className="mb-4">
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
              メールアドレス
            </label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="email@example.com"
              required
              disabled={loading}
            />
          </div>

          <div className="mb-4">
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
              パスワード
            </label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="6文字以上"
              minLength={6}
              required
              disabled={loading}
            />
          </div>

          <div className="mb-6">
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-2">
              パスワード（確認）
            </label>
            <input
              type="password"
              id="confirmPassword"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="パスワードを再入力"
              minLength={6}
              required
              disabled={loading}
            />
          </div>

          <button
            type="submit"
            className="w-full bg-blue-500 text-white py-2 rounded-md hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition"
            disabled={loading}
          >
            {loading ? '処理中...' : '次へ（決済情報入力）'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-sm text-gray-600">
            既にアカウントをお持ちですか？{' '}
            <a href="/login" className="text-blue-500 hover:underline">
              ログイン
            </a>
          </p>
        </div>

        <div className="mt-6 p-4 bg-gray-50 rounded">
          <h3 className="text-sm font-semibold mb-2">料金プラン</h3>
          <ul className="text-xs text-gray-600 space-y-1">
            <li>• 月額2,980円（税込）</li>
            <li>• 3日間の無料体験付き</li>
            <li>• いつでも解約可能</li>
            <li>• iPhone 7/8専用</li>
          </ul>
        </div>
      </div>
    </div>
  )
}

export default function RegisterPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-500">Loading...</div>
      </div>
    }>
      <RegisterForm />
    </Suspense>
  )
}