'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'

function AuthMobileContent() {
  const searchParams = useSearchParams()
  const [status, setStatus] = useState('認証中...')
  const [result, setResult] = useState<any>(null)

  useEffect(() => {
    const authenticateDevice = async () => {
      try {
        const deviceHash = searchParams.get('device_hash')
        const source = searchParams.get('source')

        if (!deviceHash) {
          throw new Error('デバイスハッシュが指定されていません')
        }

        // デバイスハッシュを統一形式にする（大文字）
        const normalizedDeviceHash = deviceHash.toUpperCase()

        setStatus('Smartgram APIに接続中...')

        // API接続
        const response = await fetch('/api/license/verify', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            device_hash: normalizedDeviceHash
          })
        })

        if (!response.ok) {
          throw new Error(`API Error: ${response.status}`)
        }

        const data = await response.json()
        setResult(data)

        if (data.is_valid) {
          setStatus('✅ 認証成功')

          // 結果をファイルに保存（AutoTouchが読み取る）
          await saveResultToFile(data)

          // URLスキーム経由でAutoTouchに結果を送信
          await notifyAutoTouch(data)
        } else if (data.status === 'unregistered') {
          // 未登録デバイスの場合、自動登録を試行
          setStatus('🔄 デバイス登録中...')
          await handleDeviceRegistration(normalizedDeviceHash)
        } else {
          setStatus('❌ 認証失敗')
          await saveResultToFile({ error: data.message || 'Authentication failed' })
        }

      } catch (error) {
        console.error('Authentication error:', error)
        setStatus('❌ エラー: ' + (error as Error).message)
        await saveResultToFile({ error: (error as Error).message })
      }
    }

    authenticateDevice()
  }, [searchParams])

  // デバイス登録処理
  const handleDeviceRegistration = async (deviceHash: string) => {
    try {
      // 有効なメールアドレス形式で生成（Supabase認証対応）
      const sanitizedHash = deviceHash.toLowerCase().replace(/[^a-z0-9]/g, '')
      const tempEmail = `auto.device.${sanitizedHash.substring(0, 12)}@smartgram.jp`
      const tempPassword = `SmartGram2024_${sanitizedHash.substring(0, 16)}`

      // デバイスハッシュは登録時と検索時で同じ形式にする（小文字統一）
      const normalizedDeviceHash = deviceHash.toUpperCase()

      const registerResponse = await fetch('/api/device/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: tempEmail,
          password: tempPassword, // バックエンドで自動的にuser_id生成
          device_hash: normalizedDeviceHash
        })
      })

      if (!registerResponse.ok) {
        const errorData = await registerResponse.json().catch(() => ({}))
        throw new Error(`Registration failed: ${registerResponse.status} - ${errorData.error || 'Unknown error'}`)
      }

      const registerData = await registerResponse.json()
      if (!registerData.success) {
        throw new Error(registerData.error || 'Registration failed')
      }

      console.log('Registration successful:', registerData)
      setStatus('✅ デバイス登録完了 - 再認証中...')

      // デバッグ: 登録されたメールアドレスを確認
      console.log('Registered email:', tempEmail)
      console.log('Device hash for re-auth:', normalizedDeviceHash)
      console.log('Original device hash:', deviceHash)

        // 登録完了後、再度認証を実行
        setTimeout(async () => {
          const reAuthResponse = await fetch('/api/license/verify', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              device_hash: normalizedDeviceHash
            })
          })

          if (reAuthResponse.ok) {
            const reAuthData = await reAuthResponse.json()
            console.log('Re-authentication response:', reAuthData)
            setResult(reAuthData)

            if (reAuthData.is_valid) {
              setStatus('✅ 認証成功 (登録完了)')
              await saveResultToFile(reAuthData)
              await notifyAutoTouch(reAuthData)
            } else {
              console.error('Re-authentication failed:', reAuthData)
              setStatus(`❌ 再認証失敗: ${reAuthData.status || 'unknown'}`)
              await saveResultToFile({
                error: 'Re-authentication failed after registration',
                details: reAuthData
              })
            }
          } else {
            console.error('Re-authentication request failed:', reAuthResponse.status)
            setStatus(`❌ 再認証リクエスト失敗: ${reAuthResponse.status}`)
          }
        }, 2000) // 2秒待機後に再認証
    } catch (error) {
      console.error('Device registration error:', error)
      setStatus('❌ 登録エラー: ' + (error as Error).message)
      await saveResultToFile({ error: (error as Error).message })
    }
  }

  // 結果をファイルに保存（AutoTouchが読み取り可能な場所）
  const saveResultToFile = async (data: any) => {
    try {
      // File System Access APIまたはダウンロード経由でファイル保存
      // (制限があるため、代替手段を使用)

      // クリップボードに結果をコピー
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(JSON.stringify(data))
        console.log('結果をクリップボードにコピーしました')
      }

      // LocalStorageに保存
      localStorage.setItem('smartgram_auth_result', JSON.stringify(data))

      // サーバー経由でファイル保存を試行
      await fetch('/api/save-auth-result', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data)
      }).catch(err => console.log('Server save failed:', err))

    } catch (error) {
      console.error('結果保存エラー:', error)
    }
  }

  // URLスキーム経由でAutoTouchに通知
  const notifyAutoTouch = async (data: any) => {
    try {
      // カスタムURLスキーム（AutoTouchアプリ用）
      const resultData = encodeURIComponent(JSON.stringify(data))
      const schemeURL = `autotools://auth-result?data=${resultData}`

      console.log('Attempting to open URL scheme:', schemeURL)

      // URLスキームを開く（エラーハンドリング付き）
      const openScheme = (url: string) => {
        return new Promise((resolve, reject) => {
          const iframe = document.createElement('iframe')
          iframe.style.display = 'none'
          iframe.src = url
          document.body.appendChild(iframe)

          // 成功/失敗の判定タイマー
          const timer = setTimeout(() => {
            document.body.removeChild(iframe)
            reject(new Error('URL scheme timeout'))
          }, 3000)

          iframe.onload = () => {
            clearTimeout(timer)
            document.body.removeChild(iframe)
            resolve(url)
          }

          iframe.onerror = () => {
            clearTimeout(timer)
            document.body.removeChild(iframe)
            reject(new Error('URL scheme failed'))
          }
        })
      }

      try {
        await openScheme(schemeURL)
        console.log('✅ URL scheme successfully opened')

        // 成功時のみAutoTouchアプリを開く
        setTimeout(async () => {
          try {
            // AutoTouchアプリの正確なスキーム
            await openScheme('autotools://open')
            console.log('✅ AutoTouch app opened via URL scheme')
          } catch (error) {
            // フォールバック: JavaScript経由でアプリ起動を試行
            try {
              if (window.webkit && window.webkit.messageHandlers) {
                // iOS WebView環境での代替方法
                console.log('Attempting app activation via WebKit')
                // Note: appActivate("me.autotouch.AutoTouch.ios8") はLua側で実行
              }
            } catch (webkitError) {
              console.log('⚠️ WebKit activation failed')
            }

            console.log('⚠️ AutoTouch app open failed (normal in browser)')
            setStatus('📋 結果をコピーしました - AutoTouchに戻ってください')
          }
        }, 2000)

      } catch (error) {
        console.log('⚠️ URL scheme not available (normal in browser)')

        // フォールバック: クリップボードに結果をコピー
        if (navigator.clipboard) {
          await navigator.clipboard.writeText(JSON.stringify(data, null, 2))
          setStatus('📋 結果をクリップボードにコピーしました')
          console.log('📋 Fallback: Result copied to clipboard')
        } else {
          setStatus('✅ 認証完了 - AutoTouchアプリに戻ってください')
        }
      }

    } catch (error) {
      console.error('URLスキーム通知エラー:', error)
      setStatus('⚠️ 通知エラー - 手動でAutoTouchに戻ってください')
    }
  }


  return (
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

      <div className="container mx-auto px-4 text-center relative z-10">
        <div className="max-w-2xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-4xl md:text-5xl font-bold mb-4 text-white">
              📱 SMARTGRAM 認証
            </h1>
            <p className="text-xl text-white/90 mb-6">
              デバイス認証システム
            </p>
          </div>

          {/* Status Card */}
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl border border-white/20 shadow-xl p-8 mb-6">
            <div className="mb-6">
              <div className="text-2xl font-semibold mb-4 text-white">{status}</div>

              {status.includes('認証中') && (
                <div className="flex justify-center mb-4">
                  <div className="animate-spin rounded-full h-12 w-12 border-4 border-white/20 border-t-white"></div>
                </div>
              )}
            </div>

            {result && (
              <div className="bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 p-6 mb-6">
                <h3 className="text-xl font-bold mb-4 text-white">認証結果</h3>
                <div className="space-y-3 text-left">
                  <div className="flex justify-between items-center">
                    <span className="text-white/80">ステータス:</span>
                    <span className="text-white font-semibold">{result.status}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-white/80">有効:</span>
                    <span className={`font-semibold ${result.is_valid ? 'text-green-400' : 'text-red-400'}`}>
                      {result.is_valid ? 'はい' : 'いいえ'}
                    </span>
                  </div>
                  {result.trial_ends_at && (
                    <div className="flex justify-between items-center">
                      <span className="text-white/80">体験期限:</span>
                      <span className="text-white font-semibold">
                        {new Date(result.trial_ends_at).toLocaleString('ja-JP')}
                      </span>
                    </div>
                  )}
                  {result.time_remaining_seconds && (
                    <div className="flex justify-between items-center">
                      <span className="text-white/80">残り時間:</span>
                      <span className="text-blue-400 font-semibold">
                        {Math.floor(result.time_remaining_seconds / 3600)}時間
                      </span>
                    </div>
                  )}
                  {result.message && (
                    <div className="border-t border-white/10 pt-3">
                      <span className="text-white/80">メッセージ:</span>
                      <p className="text-white mt-1">{result.message}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Instructions */}
            <div className="bg-blue-500/10 backdrop-blur-sm rounded-xl border border-blue-400/20 p-6 mb-6">
              <div className="text-white/90 space-y-2">
                <p className="font-medium">📝 次の手順:</p>
                <p>認証が完了したら、AutoTouchアプリに戻ってください。</p>
                <p>自動的にアプリが開かない場合は、下のボタンをタップしてください。</p>

                {/* デバッグ情報 */}
                <div className="mt-4 pt-4 border-t border-white/10 text-sm">
                  <p className="text-white/70">
                    💡 <strong>テスト環境の場合:</strong> URLスキームエラーは正常です。<br/>
                    実際のiPhone + AutoTouch環境でのみ動作します。
                  </p>
                </div>
              </div>
            </div>

            {/* Action Button */}
            <button
              onClick={async () => {
                try {
                  // Method 1: URL scheme で試行
                  const iframe = document.createElement('iframe')
                  iframe.style.display = 'none'
                  iframe.src = 'autotools://open'
                  document.body.appendChild(iframe)

                  setTimeout(() => {
                    document.body.removeChild(iframe)
                  }, 3000)

                  console.log('Attempting to open AutoTouch app via URL scheme')

                  // Method 2: ユーザーに手動起動を促す
                  setTimeout(() => {
                    setStatus('📱 AutoTouchアプリを手動で開いてmain.luaを実行してください')
                    console.log('💡 Tip: AutoTouchアプリでappActivate("me.autotouch.AutoTouch.ios8")が実行されます')
                  }, 2000)

                } catch (error) {
                  console.log('AutoTouch app not available (normal in browser)')
                  setStatus('📱 手動でAutoTouchアプリを開いてください')
                }
              }}
              className="w-full bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white font-semibold py-4 px-6 rounded-xl transition-all duration-200 transform hover:scale-105 shadow-lg"
            >
              📱 AutoTouchアプリを開く
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}

export default function AuthMobilePage() {
  return (
    <Suspense fallback={
      <section className="relative min-h-screen flex items-center pt-16 md:pt-20 bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900 overflow-hidden">
        {/* Dynamic Background Elements */}
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-black/20"></div>
          <svg className="absolute inset-0 w-full h-full opacity-10">
            <pattern id="neural-loading" x="0" y="0" width="100" height="100" patternUnits="userSpaceOnUse">
              <circle cx="50" cy="50" r="1" fill="#3b82f6" />
              <line x1="50" y1="50" x2="100" y2="50" stroke="#3b82f6" strokeWidth="0.5" />
              <line x1="50" y1="50" x2="50" y2="100" stroke="#3b82f6" strokeWidth="0.5" />
            </pattern>
            <rect width="100%" height="100%" fill="url(#neural-loading)" />
          </svg>
        </div>

        <div className="container mx-auto px-4 text-center relative z-10">
          <div className="max-w-2xl mx-auto">
            <div className="mb-8">
              <h1 className="text-4xl md:text-5xl font-bold mb-4 text-white">
                📱 SMARTGRAM 認証
              </h1>
              <p className="text-xl text-white/90 mb-6">
                デバイス認証システム
              </p>
            </div>

            <div className="bg-white/10 backdrop-blur-lg rounded-2xl border border-white/20 shadow-xl p-8">
              <div className="text-2xl font-semibold mb-4 text-white">読み込み中...</div>
              <div className="flex justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-white/20 border-t-white"></div>
              </div>
            </div>
          </div>
        </div>
      </section>
    }>
      <AuthMobileContent />
    </Suspense>
  )
}