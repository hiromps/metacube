'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase/client'
// PayPalButton removed - using free registration
import { Button } from '@/app/components/ui/Button'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/app/components/ui/Card'
import { Badge } from '@/app/components/ui/Badge'
import { LoadingScreen } from '@/app/components/LoadingScreen'

function RegisterForm() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  // Removed payment step - going directly to free registration

  // Get error from URL params
  const urlError = searchParams.get('error')

  const validateForm = () => {
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
      // Authenticate with existing Supabase user
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (authError) {
        throw new Error('ログインに失敗しました。メールアドレスとパスワードを確認してください。')
      }

      if (!authData.user) {
        throw new Error('認証に失敗しました。')
      }

      // Registration successful - no device registration needed at this point
      // Device will be registered when the user first runs the AutoTouch script

      // Registration successful, proceed to free trial
      setError('')  // Clear any previous errors

      // Add a 2-second delay before completing free registration
      setTimeout(() => {
        setLoading(false)
        handleFreeRegistration()
      }, 2000)

    } catch (error: any) {
      console.error('Registration error:', error)
      setError(error.message || '登録中にエラーが発生しました')
      setLoading(false)
    }
  }

  const handleFreeRegistration = () => {
    console.log('Free registration completed')
    router.push('/dashboard?success=true&trial=true')
  }

  // Payment handlers removed - using free registration only

  // Payment step removed - going directly to free registration

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-5">
        <svg className="absolute inset-0 w-full h-full">
          <pattern id="registerGrid" x="0" y="0" width="50" height="50" patternUnits="userSpaceOnUse">
            <circle cx="25" cy="25" r="1" fill="#3b82f6" />
          </pattern>
          <rect width="100%" height="100%" fill="url(#registerGrid)" />
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
            <Link href="/login">
              <Button className="bg-white/10 border border-white/20 text-white hover:bg-white/20 backdrop-blur-sm text-sm md:text-base" size="md">
                ログイン
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Registration Form */}
      <div className="flex items-center justify-center min-h-[calc(100vh-73px)] relative z-10">
        <div className="w-full max-w-md px-4 py-6 md:py-8">
          <div className="text-center mb-6 md:mb-8">
            <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent mb-2">
              SMARTGRAMアカウント作成
            </h1>
            <p className="text-sm md:text-base text-gray-300 px-2">
              アカウント作成後、デバイス登録はAutoTouchスクリプト実行時に自動で行われます
            </p>
            <Badge className="bg-gradient-to-r from-green-500/20 to-emerald-500/20 text-green-400 border-green-400/30 mt-2" size="md">
              3日間無料体験
            </Badge>
          </div>

          <Card className="bg-white/10 backdrop-blur-md shadow-xl border border-white/20">
            <CardContent className="p-4 md:p-6">
              {urlError && (
                <div className="mb-4 p-3 bg-yellow-500/20 border border-yellow-400/30 text-yellow-300 rounded-lg text-sm">
                  {urlError === 'cancelled' && '決済がキャンセルされました'}
                  {urlError === 'missing_device' && 'デバイス情報が見つかりません'}
                  {urlError === 'device_not_found' && 'デバイスが登録されていません'}
                  {urlError === 'processing_failed' && '処理に失敗しました'}
                </div>
              )}

              {error && (
                <div className="mb-4 p-3 bg-red-500/20 border border-red-400/30 text-red-300 rounded-lg text-sm">
                  {error}
                </div>
              )}

              <form onSubmit={handleRegister} className="space-y-4">
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-white mb-1 md:mb-2">
                    メールアドレス
                  </label>
                  <input
                    type="email"
                    id="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3 md:px-4 py-2 md:py-2.5 bg-white/10 border border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-white placeholder-gray-400 backdrop-blur-sm transition text-sm md:text-base"
                    placeholder="email@example.com"
                    required
                    disabled={loading}
                  />
                </div>

                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-white mb-1 md:mb-2">
                    パスワード
                  </label>
                  <input
                    type="password"
                    id="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-3 md:px-4 py-2 md:py-2.5 bg-white/10 border border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-white placeholder-gray-400 backdrop-blur-sm transition text-sm md:text-base"
                    placeholder="6文字以上"
                    minLength={6}
                    required
                    disabled={loading}
                  />
                </div>

                <div>
                  <label htmlFor="confirmPassword" className="block text-sm font-medium text-white mb-1 md:mb-2">
                    パスワード（確認）
                  </label>
                  <input
                    type="password"
                    id="confirmPassword"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-3 md:px-4 py-2 md:py-2.5 bg-white/10 border border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-white placeholder-gray-400 backdrop-blur-sm transition text-sm md:text-base"
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
                    className="w-4 h-4 bg-white/10 border-white/20 rounded text-blue-600 focus:ring-blue-500 focus:ring-offset-0 mt-1"
                  />
                  <label htmlFor="terms" className="ml-2 block text-xs md:text-sm text-gray-300">
                    <Link href="/terms" className="text-blue-400 hover:text-blue-300">利用規約</Link>と
                    <Link href="/privacy" className="text-blue-400 hover:text-blue-300">プライバシーポリシー</Link>に同意します
                  </label>
                </div>

                <Button
                  type="submit"
                  className="bg-gradient-to-r from-blue-500 to-purple-500 text-white hover:from-blue-600 hover:to-purple-600 shadow-xl hover:shadow-2xl transition-all"
                  size="lg"
                  fullWidth
                  loading={loading}
                >
                  {loading ? '登録処理中...' : '🚀 SMARTGRAMを開始'}
                </Button>
              </form>

              <div className="mt-6 text-center">
                <p className="text-sm text-gray-300">
                  既にアカウントをお持ちですか？{' '}
                  <Link href="/login" className="text-blue-400 hover:text-blue-300 font-medium transition">
                    ログイン
                  </Link>
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Feature Info */}
          <Card className="mt-4 md:mt-6 bg-white/10 backdrop-blur-md shadow-xl border border-white/20">
            <CardContent className="py-3 md:py-4 px-4 md:px-6">
              <h3 className="text-xs md:text-sm font-semibold mb-2 md:mb-3 text-white flex items-center flex-wrap">
                <Badge className="bg-gradient-to-r from-green-500/20 to-emerald-500/20 text-green-400 border-green-400/30 mr-2 mb-1 text-xs" size="sm">簡単登録</Badge>
                アカウント作成後の流れ
              </h3>
              <div className="grid grid-cols-1 gap-2 md:gap-3 text-xs">
                <div className="flex items-start text-gray-300">
                  <span className="bg-blue-500/20 text-blue-400 rounded-full w-5 h-5 flex items-center justify-center text-[10px] md:text-xs font-bold mr-2 md:mr-3 mt-0.5 flex-shrink-0">1</span>
                  <span>アカウント作成完了</span>
                </div>
                <div className="flex items-start text-gray-300">
                  <span className="bg-blue-500/20 text-blue-400 rounded-full w-5 h-5 flex items-center justify-center text-[10px] md:text-xs font-bold mr-2 md:mr-3 mt-0.5 flex-shrink-0">2</span>
                  <span>AutoTouchスクリプトをダウンロード</span>
                </div>
                <div className="flex items-start text-gray-300">
                  <span className="bg-blue-500/20 text-blue-400 rounded-full w-5 h-5 flex items-center justify-center text-[10px] md:text-xs font-bold mr-2 md:mr-3 mt-0.5 flex-shrink-0">3</span>
                  <span>スクリプト実行時に自動でデバイス登録</span>
                </div>
                <div className="flex items-start text-gray-300">
                  <span className="bg-green-500/20 text-green-400 rounded-full w-5 h-5 flex items-center justify-center text-[10px] md:text-xs font-bold mr-2 md:mr-3 mt-0.5 flex-shrink-0">✓</span>
                  <span>Instagram自動化スタート！</span>
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