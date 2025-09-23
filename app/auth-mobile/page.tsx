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

        setStatus('Smartgram APIに接続中...')

        // API接続
        const response = await fetch('/api/license/verify', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            device_hash: deviceHash
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
          await handleDeviceRegistration(deviceHash)
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

      const registerResponse = await fetch('/api/device/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: tempEmail,
          password: tempPassword, // バックエンドで自動的にuser_id生成
          device_hash: deviceHash
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

      setStatus('✅ デバイス登録完了 - 再認証中...')

        // 登録完了後、再度認証を実行
        setTimeout(async () => {
          const reAuthResponse = await fetch('/api/license/verify', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              device_hash: deviceHash
            })
          })

          if (reAuthResponse.ok) {
            const reAuthData = await reAuthResponse.json()
            setResult(reAuthData)

            if (reAuthData.is_valid) {
              setStatus('✅ 認証成功 (登録完了)')
              await saveResultToFile(reAuthData)
              await notifyAutoTouch(reAuthData)
            } else {
              setStatus('❌ 再認証失敗')
              await saveResultToFile({ error: 'Re-authentication failed after registration' })
            }
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

      // URLスキームを開く
      window.location.href = schemeURL

      // フォールバック: 5秒後にAutoTouchアプリを開く
      setTimeout(() => {
        window.location.href = 'autotools://open'
      }, 5000)

    } catch (error) {
      console.error('URLスキーム通知エラー:', error)
    }
  }

  const formatResult = (data: any) => {
    if (!data) return null

    return (
      <div className="mt-4 p-4 bg-gray-100 rounded-lg">
        <h3 className="font-bold mb-2">認証結果:</h3>
        <div className="space-y-1 text-sm">
          <div>ステータス: {data.status}</div>
          <div>有効: {data.is_valid ? 'はい' : 'いいえ'}</div>
          {data.trial_ends_at && (
            <div>体験期限: {new Date(data.trial_ends_at).toLocaleString('ja-JP')}</div>
          )}
          {data.time_remaining_seconds && (
            <div>残り時間: {Math.floor(data.time_remaining_seconds / 3600)}時間</div>
          )}
          {data.message && (
            <div>メッセージ: {data.message}</div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 to-purple-900 text-white">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-md mx-auto bg-white/10 backdrop-blur-md rounded-lg p-6">
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-4">📱 Smartgram 認証</h1>

            <div className="mb-6">
              <div className="text-lg mb-2">{status}</div>

              {status.includes('認証中') && (
                <div className="flex justify-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
                </div>
              )}
            </div>

            {result && formatResult(result)}

            <div className="mt-6 text-sm text-gray-300">
              <p>認証が完了したら、AutoTouchアプリに戻ってください。</p>
              <p className="mt-2">自動的にアプリが開かない場合は、手動でAutoTouchアプリを開いてください。</p>
            </div>

            <div className="mt-4">
              <button
                onClick={() => window.location.href = 'autotools://open'}
                className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg text-sm"
              >
                AutoTouchアプリを開く
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function AuthMobilePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-blue-900 to-purple-900 text-white flex items-center justify-center">
        <div className="bg-white/10 backdrop-blur-md rounded-lg p-6">
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-4">📱 Smartgram 認証</h1>
            <div className="text-lg mb-2">読み込み中...</div>
            <div className="flex justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
            </div>
          </div>
        </div>
      </div>
    }>
      <AuthMobileContent />
    </Suspense>
  )
}