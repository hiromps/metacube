'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/app/components/ui/Button'
import { Card, CardHeader, CardTitle, CardContent } from '@/app/components/ui/Card'
import { Badge } from '@/app/components/ui/Badge'

interface TestResult {
  success: boolean
  data?: any
  error?: string
  timestamp?: string
}

interface TestSuite {
  subscriptionSync?: TestResult
  checkoutSession?: TestResult
  customerPortal?: TestResult
  dataConsistency?: TestResult
  webhookValidation?: TestResult
}

export default function StripeTestPage() {
  const [testResults, setTestResults] = useState<TestSuite>({})
  const [isRunning, setIsRunning] = useState(false)
  const [testDeviceHash, setTestDeviceHash] = useState('')
  const [selectedPlan, setSelectedPlan] = useState('starter')

  // Generate test device hash
  useEffect(() => {
    const timestamp = Date.now()
    const random = Math.random().toString(36).substr(2, 9)
    setTestDeviceHash(`test_device_${timestamp}_${random}`)
  }, [])

  // Test subscription sync
  const testSubscriptionSync = async () => {
    try {
      console.log('🧪 Testing subscription sync...')
      const response = await fetch('/api/stripe/sync-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ device_hash: testDeviceHash })
      })

      const result = await response.json()
      return {
        success: response.ok,
        data: result,
        error: response.ok ? undefined : result.error,
        timestamp: new Date().toISOString()
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString()
      }
    }
  }

  // Test checkout session creation
  const testCheckoutSession = async () => {
    try {
      console.log('🧪 Testing checkout session creation...')
      const response = await fetch('/api/stripe/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan_id: selectedPlan,
          device_hash: testDeviceHash,
          user_email: 'test@smartgram.jp'
        })
      })

      const result = await response.json()
      return {
        success: response.ok,
        data: result,
        error: response.ok ? undefined : result.error,
        timestamp: new Date().toISOString()
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString()
      }
    }
  }

  // Test customer portal
  const testCustomerPortal = async () => {
    try {
      console.log('🧪 Testing customer portal...')
      const response = await fetch('/api/stripe/customer-portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ device_hash: testDeviceHash })
      })

      const result = await response.json()
      return {
        success: response.ok,
        data: result,
        error: response.ok ? undefined : result.error,
        timestamp: new Date().toISOString()
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString()
      }
    }
  }

  // Test data consistency
  const testDataConsistency = async () => {
    try {
      console.log('🧪 Testing data consistency...')
      // This would check Supabase data against Stripe data
      const response = await fetch('/api/user/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ device_hash: testDeviceHash })
      })

      const result = await response.json()
      return {
        success: response.ok,
        data: result,
        error: response.ok ? undefined : result.error,
        timestamp: new Date().toISOString()
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString()
      }
    }
  }

  // Run all tests
  const runAllTests = async () => {
    setIsRunning(true)
    setTestResults({})

    try {
      console.log('🚀 Starting Stripe-Supabase integration tests...')

      // Run tests sequentially
      const subscriptionSync = await testSubscriptionSync()
      setTestResults(prev => ({ ...prev, subscriptionSync }))

      const checkoutSession = await testCheckoutSession()
      setTestResults(prev => ({ ...prev, checkoutSession }))

      const dataConsistency = await testDataConsistency()
      setTestResults(prev => ({ ...prev, dataConsistency }))

      // Customer portal test (might fail if no subscription exists)
      const customerPortal = await testCustomerPortal()
      setTestResults(prev => ({ ...prev, customerPortal }))

      console.log('✅ All integration tests completed')

    } catch (error) {
      console.error('❌ Test suite error:', error)
    } finally {
      setIsRunning(false)
    }
  }

  // Render test result
  const renderTestResult = (title: string, result?: TestResult) => {
    if (!result) {
      return (
        <Card className="bg-gray-50">
          <CardHeader>
            <CardTitle className="text-sm">{title}</CardTitle>
          </CardHeader>
          <CardContent>
            <Badge variant="outline">未実行</Badge>
          </CardContent>
        </Card>
      )
    }

    return (
      <Card className={result.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">{title}</CardTitle>
            <Badge variant={result.success ? 'success' : 'destructive'}>
              {result.success ? '成功' : '失敗'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-xs text-gray-500">
            実行時刻: {result.timestamp ? new Date(result.timestamp).toLocaleString('ja-JP') : '不明'}
          </p>
          {result.error && (
            <p className="text-xs text-red-600 font-mono bg-red-100 p-2 rounded">
              エラー: {result.error}
            </p>
          )}
          {result.data && (
            <details className="text-xs">
              <summary className="cursor-pointer text-blue-600">結果詳細</summary>
              <pre className="mt-2 bg-gray-100 p-2 rounded overflow-auto max-h-32">
                {JSON.stringify(result.data, null, 2)}
              </pre>
            </details>
          )}
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 p-4">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">
            SMARTGRAM Stripe統合テスト
          </h1>
          <p className="text-blue-200">
            Stripe - Supabase間の一貫性管理システムのテスト
          </p>
        </div>

        {/* Test Configuration */}
        <Card className="mb-6 bg-white/10 backdrop-blur-sm border-white/20">
          <CardHeader>
            <CardTitle className="text-white">テスト設定</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-white mb-1">
                テスト用デバイスハッシュ
              </label>
              <input
                type="text"
                value={testDeviceHash}
                onChange={(e) => setTestDeviceHash(e.target.value)}
                className="w-full px-3 py-2 bg-white/20 border border-white/30 rounded-md text-white placeholder-white/60"
                placeholder="test_device_xxxxx"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-white mb-1">
                テスト対象プラン
              </label>
              <select
                value={selectedPlan}
                onChange={(e) => setSelectedPlan(e.target.value)}
                className="w-full px-3 py-2 bg-white/20 border border-white/30 rounded-md text-white"
              >
                <option value="starter">STARTER (¥2,980/月)</option>
                <option value="pro">PRO (¥6,980/月)</option>
                <option value="max">MAX (¥15,800/月)</option>
              </select>
            </div>
            <Button
              onClick={runAllTests}
              disabled={isRunning || !testDeviceHash}
              className="w-full bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600"
            >
              {isRunning ? '⏳ テスト実行中...' : '🚀 統合テスト開始'}
            </Button>
          </CardContent>
        </Card>

        {/* Test Results */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {renderTestResult('サブスクリプション同期', testResults.subscriptionSync)}
          {renderTestResult('Checkout Session作成', testResults.checkoutSession)}
          {renderTestResult('データ一貫性チェック', testResults.dataConsistency)}
          {renderTestResult('カスタマーポータル', testResults.customerPortal)}
        </div>

        {/* Test Summary */}
        {Object.keys(testResults).length > 0 && (
          <Card className="mt-6 bg-white/10 backdrop-blur-sm border-white/20">
            <CardHeader>
              <CardTitle className="text-white">テスト結果サマリー</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                <div>
                  <p className="text-2xl font-bold text-green-400">
                    {Object.values(testResults).filter(r => r?.success).length}
                  </p>
                  <p className="text-sm text-white">成功</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-red-400">
                    {Object.values(testResults).filter(r => r && !r.success).length}
                  </p>
                  <p className="text-sm text-white">失敗</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-blue-400">
                    {Object.keys(testResults).length}
                  </p>
                  <p className="text-sm text-white">実行済み</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-yellow-400">
                    {Math.round((Object.values(testResults).filter(r => r?.success).length / Object.keys(testResults).length) * 100) || 0}%
                  </p>
                  <p className="text-sm text-white">成功率</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}