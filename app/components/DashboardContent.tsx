'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase/client'
import { signOut } from '@/lib/auth/client'
import { Button } from '@/app/components/ui/Button'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/app/components/ui/Card'
import { Badge } from '@/app/components/ui/Badge'
import { UserStatus, UserProfile, getStatusColor, getStatusBadge } from '@/types/user'
import { LoadingScreen } from '@/app/components/LoadingScreen'
import { useUserData, UserData } from '@/app/hooks/useUserData'
import { isAdminEmail } from '@/lib/auth/admin'
import SubscriptionPlansCard from '@/app/components/SubscriptionPlansCard'
import PaymentStatusModal from '@/app/components/PaymentStatusModal'
import PlanFeatures from '@/app/components/PlanFeatures'
import { useSearchParams } from 'next/navigation'

// Dashboard sections
type DashboardSection = 'overview' | 'device' | 'subscription' | 'usage' | 'settings' | 'help'

interface SidebarItem {
  id: DashboardSection
  label: string
  icon: string
  description: string
}

const sidebarItems: SidebarItem[] = [
  {
    id: 'overview',
    label: 'ダッシュボード',
    icon: '📊',
    description: 'アカウント概要と現在の状況'
  },
  {
    id: 'device',
    label: 'デバイス管理',
    icon: '📱',
    description: 'デバイス情報と設定変更'
  },
  {
    id: 'subscription',
    label: 'プラン・契約',
    icon: '💳',
    description: 'サブスクリプションとお支払い'
  },
  {
    id: 'usage',
    label: '利用統計',
    icon: '📈',
    description: 'ツールの使用状況と実績'
  },
  {
    id: 'settings',
    label: '設定',
    icon: '⚙️',
    description: 'アカウント設定とセキュリティ'
  },
  {
    id: 'help',
    label: 'サポート',
    icon: '❓',
    description: 'ヘルプとお問い合わせ'
  }
]

interface DashboardContentProps {}

export default function DashboardContent({}: DashboardContentProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { userData, loading, error: dataError, refetch } = useUserData()
  const [error, setError] = useState('')
  const [retryCount, setRetryCount] = useState(0)
  const MAX_RETRIES = 3
  const [cancelling, setCancelling] = useState(false)
  const [changingDevice, setChangingDevice] = useState(false)
  const [newDeviceHash, setNewDeviceHash] = useState('')
  const [showDeviceChangeForm, setShowDeviceChangeForm] = useState(false)
  const [timeLeft, setTimeLeft] = useState<string>('')
  const [paymentStatus, setPaymentStatus] = useState<'success' | 'error' | 'cancel' | null>(null)
  const [activeSection, setActiveSection] = useState<DashboardSection>('overview')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [downloadProgress, setDownloadProgress] = useState(0)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [showUploadForm, setShowUploadForm] = useState(false)
  const [uploadTargetUser, setUploadTargetUser] = useState('')
  const [uploadTargetDevice, setUploadTargetDevice] = useState('')
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [userDevices, setUserDevices] = useState<any[]>([])
  const [uploadNotes, setUploadNotes] = useState('')
  const [hasPackage, setHasPackage] = useState(false)
  const [packageInfo, setPackageInfo] = useState<any>(null)
  const [checkingPackage, setCheckingPackage] = useState(false)

  // State for user selection functionality
  const [availableUsers, setAvailableUsers] = useState<any[]>([])
  const [loadingUsers, setLoadingUsers] = useState(false)

  // Check if user has uploaded package
  const checkUserPackage = useCallback(async () => {
    if (!userData?.device) return

    setCheckingPackage(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) return

      const response = await fetch('/api/check/package', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        }
      })

      if (response.ok) {
        const data = await response.json()
        setHasPackage(data.hasPackage)
        setPackageInfo(data.package)
        console.log('📦 Package check:', data)
      }
    } catch (error) {
      console.error('Package check error:', error)
    } finally {
      setCheckingPackage(false)
    }
  }, [userData?.device])

  // Check for package when user data loads
  useEffect(() => {
    if (userData?.device) {
      checkUserPackage()
    }
  }, [userData?.device, checkUserPackage])

  // Auto-collapse sidebar on mobile
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1024) { // lg breakpoint
        setSidebarCollapsed(true)
        setMobileMenuOpen(false)
      } else {
        setSidebarCollapsed(false)
      }
    }

    handleResize() // Check on mount
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const checkAuth = useCallback(async () => {
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser()

      if (authError) {
        console.error('Auth error:', authError)
        if (authError.message !== 'Invalid JWT') {
          setError(`認証エラー: ${authError.message}`)
        }
        router.push('/login')
        return
      }

      if (!user) {
        console.log('No user found, redirecting to login')
        router.push('/login')
        return
      }
    } catch (error: any) {
      console.error('Auth check error:', error)
      // Don't show auth errors to user unless critical
      if (error?.status !== 406) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        setError(errorMessage)
      }
      router.push('/login')
    }
  }, [router])

  const updateTimeLeft = useCallback(() => {
    if (!userData?.device?.trial_ends_at || !userData.isTrialActive) {
      setTimeLeft('')
      return
    }

    const targetDate = new Date(userData.device.trial_ends_at)
    const now = new Date()
    const diff = targetDate.getTime() - now.getTime()

    if (diff <= 0) {
      setTimeLeft('体験期間: 期限切れ')
      return
    }

    const totalSeconds = Math.floor(diff / 1000)
    const days = Math.floor(totalSeconds / 86400)
    const hours = Math.floor((totalSeconds % 86400) / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const seconds = totalSeconds % 60

    setTimeLeft(`体験期間残り: ${days}日 ${hours}時間 ${minutes}分 ${seconds}秒`)
  }, [userData?.device?.trial_ends_at, userData?.isTrialActive])

  useEffect(() => {
    let mounted = true

    const initAuth = async () => {
      if (mounted) {
        await checkAuth()
      }
    }

    initAuth()

    return () => {
      mounted = false
    }
  }, [checkAuth])

  // Check for payment result query parameters and localStorage
  useEffect(() => {
    const success = searchParams.get('success')
    const canceled = searchParams.get('canceled')
    const error = searchParams.get('error')
    const device_registered = searchParams.get('device_registered')

    // Force refetch user data when device was just registered (only once)
    if (device_registered === 'true' && retryCount === 0) {
      console.log('Device registration detected, forcing data refresh...')
      const timer = setTimeout(() => {
        refetch()
        setRetryCount(1)
      }, 500) // Wait 500ms to ensure API update is complete

      // Clean up URL immediately
      const newUrl = window.location.pathname
      window.history.replaceState({}, '', newUrl)
      return () => clearTimeout(timer)
    }

    if (success === 'true' && paymentStatus !== 'success') {
      setPaymentStatus('success')
      localStorage.removeItem('stripe_checkout_started')
      localStorage.removeItem('selected_plan_id')
      // Single refetch after successful payment
      if (retryCount === 0) {
        const timer = setTimeout(() => {
          refetch()
          setRetryCount(1)
        }, 2000)

        // Clean up URL
        const newUrl = window.location.pathname
        window.history.replaceState({}, '', newUrl)
        return () => clearTimeout(timer)
      }
    } else if (canceled === 'true' && paymentStatus !== 'cancel') {
      setPaymentStatus('cancel')
      localStorage.removeItem('stripe_checkout_started')
      localStorage.removeItem('selected_plan_id')

      // Clean up URL
      const newUrl = window.location.pathname
      window.history.replaceState({}, '', newUrl)
    } else if (error === 'true' && paymentStatus !== 'error') {
      setPaymentStatus('error')
      localStorage.removeItem('stripe_checkout_started')
      localStorage.removeItem('selected_plan_id')

      // Clean up URL
      const newUrl = window.location.pathname
      window.history.replaceState({}, '', newUrl)
    } else if (!success && !canceled && !error && !device_registered) {
      // Only check for pending checkout if no other parameters are present
      const checkoutStarted = localStorage.getItem('stripe_checkout_started')
      const planId = localStorage.getItem('selected_plan_id')

      if (checkoutStarted && planId && retryCount === 0) {
        const startTime = parseInt(checkoutStarted)
        const now = Date.now()
        const timeDiff = now - startTime

        if (timeDiff < 30 * 60 * 1000) { // 30 minutes
          console.log('User returned from potential Stripe checkout, checking subscription status...')

          const timer = setTimeout(() => {
            refetch()
            setRetryCount(1)

            // Check result after refetch
            const checkTimer = setTimeout(() => {
              if (userData?.isSubscriptionActive) {
                setPaymentStatus('success')
                localStorage.removeItem('stripe_checkout_started')
                localStorage.removeItem('selected_plan_id')
              }
            }, 3000)
            return () => clearTimeout(checkTimer)
          }, 1000)
          return () => clearTimeout(timer)
        } else {
          // Cleanup expired checkout data
          localStorage.removeItem('stripe_checkout_started')
          localStorage.removeItem('selected_plan_id')
        }
      }
    }
  }, [searchParams, paymentStatus, retryCount]) // Removed refetch and userData dependencies to prevent loops

  useEffect(() => {
    const interval = setInterval(() => {
      if (userData?.device?.trial_ends_at) {
        updateTimeLeft()
      }
    }, 1000)
    return () => clearInterval(interval)
  }, [userData, updateTimeLeft])

  const handleCancelSubscription = async () => {
    if (!confirm('本当に解約しますか？解約すると即座にサービスが利用できなくなります。')) {
      return
    }

    setCancelling(true)
    setError('')

    try {
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        throw new Error('ユーザー情報が取得できません')
      }

      const { data: result, error: cancelError } = await supabase.rpc('cancel_subscription', {
        p_user_id: user.id
      })

      if (cancelError) {
        throw new Error(cancelError.message)
      }

      refetch()
      alert('サブスクリプションを解約しました')

    } catch (err: any) {
      console.error('Cancel subscription error:', err)
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      setError(`解約に失敗しました: ${errorMessage}`)
    } finally {
      setCancelling(false)
    }
  }

  const handleDeviceChange = async () => {
    if (!newDeviceHash.trim()) {
      setError('デバイスハッシュを入力してください')
      return
    }

    setChangingDevice(true)
    setError('')

    try {
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        throw new Error('ユーザー情報が取得できません')
      }

      // Check if the new device hash already exists
      const { data: existingDevice, error: checkError } = await supabase
        .from('devices')
        .select('id')
        .eq('device_hash', newDeviceHash.trim())
        .single()

      if (checkError && checkError.code !== 'PGRST116') { // PGRST116 means no rows found, which is what we want
        throw new Error(`デバイスハッシュの確認エラー: ${checkError.message}`)
      }

      if (existingDevice) {
        throw new Error('このデバイスハッシュは既に他のユーザーによって使用されています')
      }

      // Update the device hash directly
      const { error: updateError } = await supabase
        .from('devices')
        .update({ device_hash: newDeviceHash.trim() })
        .eq('user_id', user.id)

      if (updateError) {
        throw new Error(updateError.message)
      }

      refetch()
      setShowDeviceChangeForm(false)
      setNewDeviceHash('')
      alert('デバイスハッシュを更新しました')

    } catch (err: any) {
      console.error('Device change error:', err)
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      setError(`デバイス変更に失敗しました: ${errorMessage}`)
    } finally {
      setChangingDevice(false)
    }
  }

  const handleDownloadATE = async () => {
    setDownloading(true)
    setDownloadProgress(0)
    setError('')

    try {
      // プログレスバー: 認証開始
      setDownloadProgress(10)

      const { data: { session } } = await supabase.auth.getSession()

      if (!session?.access_token) {
        throw new Error('認証が必要です')
      }

      // プログレスバー: ダウンロード要求送信
      setDownloadProgress(30)

      const response = await fetch('/api/download/package', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        }
      })

      // プログレスバー: レスポンス受信
      setDownloadProgress(60)

      if (!response.ok) {
        const errorData = await response.text()
        throw new Error(`ダウンロードに失敗しました (${response.status}): ${errorData}`)
      }

      // プログレスバー: ファイル名取得
      setDownloadProgress(70)

      // Get filename from response headers or use default
      const contentDisposition = response.headers.get('content-disposition')
      let filename = 'smartgram.ate'
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="([^"]+)"/)
        if (filenameMatch) {
          filename = filenameMatch[1]
        }
      }

      // プログレスバー: ファイル生成中
      setDownloadProgress(85)

      // Create blob and download
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      // プログレスバー: 完了
      setDownloadProgress(100)

      // Show success message
      setTimeout(() => {
        alert('✅ ファイルのダウンロードが完了しました！\n\nAutoTouchアプリで開いてご利用ください。')
      }, 500)

    } catch (err: any) {
      console.error('ATE download error:', err)
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      setError(`ダウンロードに失敗しました: ${errorMessage}`)
    } finally {
      // プログレスバーをリセット
      setTimeout(() => {
        setDownloadProgress(0)
        setDownloading(false)
      }, 1000)
    }
  }

  const handleAdminUpload = async () => {
    if (!uploadFile || !uploadTargetUser || !uploadTargetDevice) {
      setError('すべての必須フィールドを入力してください')
      return
    }

    setUploading(true)
    setUploadProgress(0)
    setError('')

    try {
      // プログレスバー: ファイル読み込み開始
      setUploadProgress(10)

      // Convert file to base64
      const fileBuffer = await uploadFile.arrayBuffer()
      const uint8Array = new Uint8Array(fileBuffer)

      // プログレスバー: ファイル変換中
      setUploadProgress(30)

      let binaryString = ''
      for (let i = 0; i < uint8Array.length; i++) {
        binaryString += String.fromCharCode(uint8Array[i])
      }
      const base64Content = btoa(binaryString)

      // プログレスバー: データ準備完了
      setUploadProgress(50)

      const uploadData = {
        user_id: uploadTargetUser,
        device_hash: uploadTargetDevice,
        file_name: uploadFile.name,
        file_content: base64Content,
        file_size: uploadFile.size,
        notes: uploadNotes.trim() || '管理者によりアップロード',
        admin_key: 'smartgram-admin-2024'
      }

      // プログレスバー: アップロード開始
      setUploadProgress(70)

      const response = await fetch('/api/admin/upload-package', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(uploadData)
      })

      // プログレスバー: レスポンス処理中
      setUploadProgress(90)

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'アップロードに失敗しました')
      }

      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error || 'アップロードに失敗しました')
      }

      // プログレスバー: 完了
      setUploadProgress(100)

      // Reset form
      setShowUploadForm(false)
      setUploadTargetUser('')
      setUploadTargetDevice('')
      setUploadFile(null)
      setUploadNotes('')

      // 少し遅延してアラート表示
      setTimeout(() => {
        alert(`✅ アップロード完了！\n\nユーザー: ${result.user_email}\nバージョン: ${result.version}`)
        // 自分のパッケージ状態を再チェック
        checkUserPackage()
      }, 500)

    } catch (err: any) {
      console.error('Admin upload error:', err)
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      setError(`アップロードに失敗しました: ${errorMessage}`)
    } finally {
      // プログレスバーをリセット
      setTimeout(() => {
        setUploadProgress(0)
        setUploading(false)
      }, 1000)
    }
  }

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      // Validate file type (.ate files)
      if (!file.name.toLowerCase().endsWith('.ate') && !file.name.toLowerCase().endsWith('.lua')) {
        setError('ファイル形式は .ate または .lua である必要があります')
        return
      }

      // No file size limit for admin uploads

      setUploadFile(file)
      setError('')
    }
  }

  // Load available users for admin selection
  const loadAvailableUsers = async () => {
    try {
      console.log('👥 loadAvailableUsers: Starting to load users...')
      setLoadingUsers(true)

      // Try to use admin API endpoint first (bypasses RLS)
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.access_token) {
        try {
          const response = await fetch('/api/admin/devices', {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${session.access_token}`,
              'Content-Type': 'application/json'
            }
          })

          if (response.ok) {
            const result = await response.json()
            console.log(`✅ loadAvailableUsers: Admin API returned ${result.total} devices`)

            if (result.devices && result.devices.length > 0) {
              // Process admin API results
              const userMap = new Map()

              // Get unique users from devices
              result.devices.forEach((device: any) => {
                if (!userMap.has(device.user_id)) {
                  userMap.set(device.user_id, {
                    ...device,
                    email: device.user_email
                  })
                }
              })

              const processedUsers = Array.from(userMap.values()).map((device: any) => ({
                device_id: device.id,
                device_hash: device.device_hash || '',
                user_id: device.user_id,
                plan_id: device.plan_id || 'none',
                plan_name: device.plan_id || 'none',
                plan_display_name: device.plan_id ? device.plan_id.toUpperCase() : '未契約',
                subscription_status: device.status || 'unknown',
                email: device.email || `User ${device.user_id.slice(0, 8)}...`,
                created_at: device.created_at
              }))

              // Add manual entry option
              processedUsers.unshift({
                device_id: null,
                device_hash: '',
                user_id: 'manual-entry',
                plan_name: 'none',
                plan_display_name: '手動入力',
                subscription_status: 'no_device',
                email: '【手動入力】ユーザーIDを下に直接入力',
                created_at: new Date().toISOString()
              })

              setAvailableUsers(processedUsers)
              console.log(`✅ loadAvailableUsers: Loaded ${processedUsers.length} users from admin API`)
              return
            }
          }
        } catch (apiError) {
          console.warn('⚠️ Admin API failed, falling back to client query:', apiError)
        }
      }

      // Fallback to client-side query (with RLS)
      console.log('👥 loadAvailableUsers: Using fallback to devices table...')
      const { data: devicesData, error: devicesError } = await supabase
        .from('devices')
        .select('id, user_id, device_hash, plan_id, status, created_at')
        .order('created_at', { ascending: false })

        if (devicesError) {
          console.error('❌ loadAvailableUsers: Devices table error:', devicesError)
          // Last resort: just provide manual entry option
          setAvailableUsers([{
            device_id: null,
            device_hash: '',
            user_id: 'manual-entry',
            plan_name: 'none',
            plan_display_name: '手動入力',
            subscription_status: 'no_device',
            email: '【エラー】ユーザーIDを下に直接入力してください',
            created_at: new Date().toISOString()
          }])
          return
        }

        if (devicesData && devicesData.length > 0) {
          console.log(`✅ loadAvailableUsers: Found ${devicesData.length} devices in fallback`)
          const userMap = new Map()

          // Get unique users from devices
          devicesData.forEach(device => {
            if (!userMap.has(device.user_id)) {
              userMap.set(device.user_id, device)
            }
          })

          console.log(`✅ loadAvailableUsers: Identified ${userMap.size} unique users`)

          // Get current user email if available
          const { data: { user: currentUser } } = await supabase.auth.getUser()

          const processedUsers = Array.from(userMap.values()).map(device => ({
            device_id: device.id,
            device_hash: device.device_hash || '',
            user_id: device.user_id,
            plan_name: device.plan_id || 'none',
            plan_display_name: device.plan_id ? device.plan_id.toUpperCase() : '未契約',
            subscription_status: device.status || 'no_device',
            email: (currentUser && currentUser.id === device.user_id && currentUser.email)
              ? currentUser.email
              : `ユーザー${device.user_id.substring(0, 8)}`,
            created_at: device.created_at || new Date().toISOString()
          }))

          // Add manual entry option
          processedUsers.unshift({
            device_id: null,
            device_hash: '',
            user_id: 'manual-entry',
            plan_name: 'none',
            plan_display_name: '手動入力',
            subscription_status: 'no_device',
            email: '【新規ユーザー用】下にユーザーIDを直接入力してください',
            created_at: new Date().toISOString()
          })

          console.log('✅ loadAvailableUsers: Loaded from devices table:', processedUsers.length)
          setAvailableUsers(processedUsers)
          return
        } else {
          // No devices found, just provide manual entry
          setAvailableUsers([{
            device_id: null,
            device_hash: '',
            user_id: 'manual-entry',
            plan_name: 'none',
            plan_display_name: '手動入力',
            subscription_status: 'no_device',
            email: '【新規ユーザー用】下にユーザーIDを直接入力してください',
            created_at: new Date().toISOString()
          }])
          return
        }
    } catch (err: any) {
      console.error('❌ loadAvailableUsers: Error:', err)
      setError(`ユーザー一覧の取得に失敗しました: ${err.message}`)
    } finally {
      setLoadingUsers(false)
    }
  }


  const handleSignOut = async () => {
    try {
      await signOut()
      router.push('/')
    } catch (error: any) {
      console.error('Sign out error:', error)
    }
  }

  const handleSectionChange = (section: DashboardSection) => {
    setActiveSection(section)
    // Close mobile menu after selection
    if (window.innerWidth < 1024) {
      setMobileMenuOpen(false)
    }
  }

  // Render different sections based on activeSection
  const renderSectionContent = () => {
    switch (activeSection) {
      case 'overview':
        return renderOverviewSection()
      case 'device':
        return renderDeviceSection()
      case 'subscription':
        return renderSubscriptionSection()
      case 'usage':
        return renderUsageSection()
      case 'settings':
        return renderSettingsSection()
      case 'help':
        return renderHelpSection()
      default:
        return renderOverviewSection()
    }
  }

  const renderOverviewSection = () => (
    <div className="space-y-4 md:space-y-6">
      {/* User Status Card */}
      <div className="bg-gradient-to-br from-blue-800/30 via-indigo-800/20 to-purple-800/30 backdrop-blur-xl border border-blue-400/30 rounded-2xl p-4 md:p-6 lg:p-8 shadow-lg shadow-blue-500/10">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4 md:mb-6">
          <div>
            <h2 className="text-lg md:text-xl lg:text-2xl font-semibold text-white mb-1">アカウントステータス</h2>
            <p className="text-white/70 text-sm md:text-base">
              {userData?.device ?
                (userData.isSubscriptionActive && userData.isTrialActive ? '体験期間中（有料契約済み）' :
                  userData.isSubscriptionActive ? '有料会員' :
                  'デバイス登録済み - 契約待ち') :
                'デバイス未登録'}
            </p>
          </div>

          <div className="flex flex-col items-start md:items-end gap-2">
            <Badge
              variant={userData?.isSubscriptionActive ? 'success' : userData?.device ? 'warning' : 'error'}
              className={`${userData?.isSubscriptionActive
                ? 'bg-gradient-to-r from-green-500/20 to-emerald-500/20 text-green-300 border-green-400/30'
                : userData?.device
                  ? 'bg-gradient-to-r from-yellow-500/20 to-amber-500/20 text-yellow-300 border-yellow-400/30'
                  : 'bg-gradient-to-r from-red-500/20 to-pink-500/20 text-red-300 border-red-400/30'
                } backdrop-blur-sm text-xs md:text-sm px-3 py-1`}
            >
              {userData?.isSubscriptionActive ? '✅ アクティブ' :
                userData?.device ? '⏳ 未契約' : '❌ 未登録'}
            </Badge>
            {userData?.isTrialActive && userData?.trialDaysRemaining !== null && (
              <Badge className="bg-gradient-to-r from-purple-500/20 to-pink-500/20 text-purple-300 border-purple-400/30 backdrop-blur-sm text-xs">
                体験残り: {userData.trialDaysRemaining}日
              </Badge>
            )}
          </div>
        </div>

        {/* Trial Progress */}
        {userData?.isTrialActive && userData?.trialDaysRemaining !== null && (
          <div className="mb-4 md:mb-6">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-white/70">体験期間進捗</span>
              <span className="text-xs text-white/50">{timeLeft}</span>
            </div>
            <div className="relative w-full bg-white/20 rounded-full h-2 overflow-hidden">
              <div
                className="absolute top-0 left-0 h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full transition-all duration-300"
                style={{ width: `${Math.max(0, Math.min(100, ((3 - userData.trialDaysRemaining) / 3) * 100))}%` }}
              />
            </div>
            <div className="text-xs text-white/50 mt-1">
              {Math.round(Math.max(0, Math.min(100, ((3 - userData.trialDaysRemaining) / 3) * 100)))}% 完了
            </div>
          </div>
        )}
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-green-800/30 via-emerald-800/20 to-teal-800/30 backdrop-blur-xl border border-green-400/30 rounded-2xl p-4 md:p-6 text-center shadow-lg shadow-green-500/10">
          <div className="text-2xl md:text-3xl mb-2">📱</div>
          <h3 className="font-medium text-white mb-1 text-sm md:text-base">デバイス</h3>
          <p className="text-green-300 text-lg md:text-xl font-bold">
            {userData?.device ? '1台' : '0台'}
          </p>
          <p className="text-white/60 text-xs">登録済み</p>
        </div>

        <div className="bg-gradient-to-br from-purple-800/30 via-violet-800/20 to-indigo-800/30 backdrop-blur-xl border border-purple-400/30 rounded-2xl p-4 md:p-6 text-center shadow-lg shadow-purple-500/10">
          <div className="text-2xl md:text-3xl mb-2">🎯</div>
          <h3 className="font-medium text-white mb-1 text-sm md:text-base">プラン</h3>
          <p className="text-purple-300 text-lg md:text-xl font-bold">
            {userData?.plan?.display_name || 'なし'}
          </p>
          <p className="text-white/60 text-xs">現在のプラン</p>
        </div>

        <div className="bg-gradient-to-br from-orange-800/30 via-amber-800/20 to-yellow-800/30 backdrop-blur-xl border border-orange-400/30 rounded-2xl p-4 md:p-6 text-center shadow-lg shadow-orange-500/10 sm:col-span-2 lg:col-span-1">
          <div className="text-2xl md:text-3xl mb-2">⚡</div>
          <h3 className="font-medium text-white mb-1 text-sm md:text-base">ステータス</h3>
          <p className={`text-lg md:text-xl font-bold ${userData?.isSubscriptionActive ? 'text-green-400' : userData?.device ? 'text-yellow-400' : 'text-red-400'
            }`}>
            {userData?.isSubscriptionActive ? 'アクティブ' : userData?.device ? '準備中' : '未設定'}
          </p>
          <p className="text-white/60 text-xs">利用状況</p>
        </div>
      </div>
    </div>
  )

  const renderDeviceSection = () => (
    <div className="space-y-4 md:space-y-6">
      {userData?.device ? (
        <div className="bg-gradient-to-br from-blue-800/30 via-indigo-800/20 to-purple-800/30 backdrop-blur-xl border border-blue-400/30 rounded-2xl p-4 md:p-6 lg:p-8 shadow-lg shadow-blue-500/10">
          <h2 className="text-lg md:text-xl font-semibold text-white mb-4">📱 デバイス情報</h2>
          <div className="space-y-4">
            <div className="bg-white/10 border border-white/20 p-4 rounded-xl backdrop-blur-sm">
              <div className="space-y-3">
                <div className="flex flex-col gap-2">
                  <span className="text-white/70 text-sm">デバイスハッシュ:</span>
                  <code className="text-blue-300 text-xs md:text-sm font-mono bg-black/20 px-2 py-1 rounded break-all">
                    {userData.device.device_hash}
                  </code>
                </div>
                <div className="flex flex-col md:flex-row md:justify-between gap-2">
                  <span className="text-white/70 text-sm">登録日:</span>
                  <span className="text-white/80 text-sm">
                    {new Date(userData.device.created_at).toLocaleDateString('ja-JP')}
                  </span>
                </div>
                <div className="flex flex-col md:flex-row md:justify-between gap-2">
                  <span className="text-white/70 text-sm">ステータス:</span>
                  <span className={`text-sm ${userData.device.status === 'active' ? 'text-green-400' :
                    userData.device.status === 'trial' ? 'text-yellow-400' :
                      'text-red-400'
                    }`}>
                    {userData.device.status === 'active' ? 'アクティブ' :
                      userData.device.status === 'trial' ? '体験中' :
                        '期限切れ'}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                onClick={() => setShowDeviceChangeForm(true)}
                variant="outline"
                size="sm"
                className="flex-1 bg-white/10 border-white/30 text-white/80 hover:bg-white/20 hover:border-white/40"
              >
                デバイス変更
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-gradient-to-br from-blue-800/30 via-indigo-800/20 to-purple-800/30 backdrop-blur-xl border border-blue-400/30 rounded-2xl p-4 md:p-6 lg:p-8 shadow-lg shadow-blue-500/10">
          <h3 className="text-lg md:text-xl font-semibold text-white mb-2">🎉 デバイス登録</h3>
          <p className="text-white/70 mb-4 md:mb-6 text-sm md:text-base">
            iPhone 7/8をお持ちの方は、デバイス登録を行ってSMARTGRAMをご利用ください。
          </p>
          <div className="text-center">
            <Link href="/device-register">
              <Button className="bg-gradient-to-r from-blue-500 to-purple-500 text-white hover:from-blue-600 hover:to-purple-600 shadow-xl border border-white/20 w-full sm:w-auto" size="lg">
                📱 今すぐデバイスを登録する
              </Button>
            </Link>
          </div>
        </div>
      )}

      {/* ATE File Download Section - show for registered devices with uploaded packages */}
      {userData?.device && hasPackage ? (
        <div className="bg-gradient-to-br from-purple-800/30 via-violet-800/20 to-indigo-800/30 backdrop-blur-xl border border-purple-400/30 rounded-2xl p-4 md:p-6 lg:p-8 shadow-lg shadow-purple-500/10">
          <h3 className="text-lg md:text-xl font-semibold text-white mb-4">📦 ツールファイルダウンロード</h3>
          <div className="space-y-4">
            <div className="bg-white/10 border border-white/20 p-4 rounded-xl backdrop-blur-sm">
              <div className="space-y-3">
                <div>
                  <h4 className="text-white font-medium mb-2">🎯 SMARTGRAM.ate</h4>
                  <p className="text-white/70 text-sm mb-3">
                    あなた専用のSMARTGRAM.ateファイルをダウンロードできます。このファイルをAutoTouchで実行してInstagram自動化を開始してください。
                  </p>
                </div>
                <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                  <div>
                    <p className="text-white text-sm font-medium">{packageInfo?.fileName || 'SMARTGRAM.ate'}</p>
                    <p className="text-white/60 text-xs">
                      プラン: {userData.plan?.display_name || 'なし'} • {packageInfo?.version ? `v${packageInfo.version} • ` : ''}デバイス: {userData.device.device_hash.substring(0, 8)}...
                    </p>
                  </div>
                  <div className="relative">
                    <Button
                      onClick={handleDownloadATE}
                      disabled={downloading}
                      className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:from-purple-600 hover:to-pink-600 shadow-xl"
                      size="sm"
                    >
                      {downloading ? '📥 ダウンロード中...' : '📥 ダウンロード'}
                    </Button>
                    {downloading && (
                      <div className="mt-2">
                        <div className="flex justify-between text-xs text-white/70 mb-1">
                          <span>ダウンロード進行中</span>
                          <span>{downloadProgress}%</span>
                        </div>
                        <div className="w-full bg-white/20 rounded-full h-2">
                          <div
                            className="bg-gradient-to-r from-purple-400 to-pink-400 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${downloadProgress}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                <div className="text-xs text-white/50 space-y-1">
                  <p>• ファイルはあなたのデバイス専用にカスタマイズされています</p>
                  <p>• AutoTouchアプリで開いてご利用ください</p>
                  <p>• 最新の機能とプラン制限が適用されます</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* Admin Upload Section - show only for admin users */}
      {userData && isAdminEmail(userData.email) && (
        <div className="bg-gradient-to-br from-amber-800/30 via-orange-800/20 to-yellow-800/30 backdrop-blur-xl border border-amber-400/30 rounded-2xl p-4 md:p-6 lg:p-8 shadow-lg shadow-amber-500/10">
          <h3 className="text-lg md:text-xl font-semibold text-white mb-4">👑 管理者専用: ユーザーファイルアップロード</h3>

          {!showUploadForm ? (
            <div className="text-center">
              <p className="text-white/70 text-sm mb-4">
                特定のユーザー・デバイスに対してカスタム.ateファイルをアップロードできます
              </p>
              <Button
                onClick={() => {
                  setShowUploadForm(true)
                  // Load users when opening upload form
                  if (availableUsers.length === 0) {
                    loadAvailableUsers()
                  }
                }}
                className="bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:from-amber-600 hover:to-orange-600 shadow-xl"
                size="sm"
              >
                📤 ファイルアップロード
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-white/10 border border-white/20 p-4 rounded-xl backdrop-blur-sm">
                <div className="space-y-4">
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-white/80 text-sm mb-2">対象ユーザー *</label>
                        <div className="space-y-2">
                          <select
                            value={uploadTargetUser}
                            onChange={(e) => {
                              const selectedUserId = e.target.value;

                              // Skip if manual entry option is selected
                              if (selectedUserId === 'manual-entry') {
                                setUploadTargetUser('');
                                setUploadTargetDevice('');
                                return;
                              }

                              setUploadTargetUser(selectedUserId);

                              // Find selected user and auto-fill device hash
                              const selectedUser = availableUsers.find(user => user.user_id === selectedUserId);
                              if (selectedUser && selectedUser.device_hash) {
                                setUploadTargetDevice(selectedUser.device_hash);
                              } else {
                                setUploadTargetDevice('');
                              }
                            }}
                            className="w-full p-3 bg-black/20 border border-white/30 rounded-xl text-white focus:border-white/50 focus:outline-none backdrop-blur-sm text-sm"
                            onFocus={() => {
                              if (availableUsers.length === 0) {
                                loadAvailableUsers();
                              }
                            }}
                          >
                            <option value="">ユーザーを選択 または 下に直接入力</option>
                            {availableUsers.map((user) => (
                              <option key={user.user_id} value={user.user_id} className="bg-gray-800">
                                {user.email} - {user.plan_display_name} {user.device_hash ? `(${user.device_hash.substring(0, 8)}...)` : '(デバイス未登録)'}
                              </option>
                            ))}
                          </select>
                          <input
                            type="text"
                            value={uploadTargetUser}
                            onChange={async (e) => {
                              const userId = e.target.value.trim();
                              setUploadTargetUser(userId);

                              // Clear device info if user ID is cleared
                              if (!userId) {
                                setUploadTargetDevice('');
                                setUserDevices([]);
                                return;
                              }

                              // Auto-detect device hash if valid UUID is entered
                              if (userId && userId.length === 36 && userId.includes('-')) {
                                try {
                                  // Always query database for most up-to-date information
                                  console.log('🔍 Looking up devices for user:', userId);

                                  // Try admin API first to bypass RLS
                                  const { data: { session } } = await supabase.auth.getSession();
                                  let devicesData = null;
                                  let queryError = null;

                                  if (session?.access_token) {
                                    try {
                                      const response = await fetch('/api/admin/devices', {
                                        method: 'GET',
                                        headers: {
                                          'Authorization': `Bearer ${session.access_token}`,
                                          'Content-Type': 'application/json'
                                        }
                                      });

                                      if (response.ok) {
                                        const result = await response.json();
                                        // Filter devices for this specific user
                                        devicesData = result.devices?.filter((d: any) => d.user_id === userId) || [];
                                        console.log(`✅ Admin API: Found ${devicesData.length} devices for user ${userId}`);
                                      }
                                    } catch (apiErr) {
                                      console.warn('Admin API lookup failed:', apiErr);
                                    }
                                  }

                                  // Fallback to regular query if admin API didn't work
                                  if (!devicesData) {
                                    const query = await supabase
                                      .from('devices')
                                      .select('id, device_hash, status, plan_id, created_at, user_id')
                                      .eq('user_id', userId)
                                      .order('created_at', { ascending: false });

                                    devicesData = query.data;
                                    queryError = query.error;
                                  }

                                  console.log('🔍 Devices query result:', {
                                    count: devicesData?.length || 0,
                                    data: devicesData,
                                    error: queryError
                                  });

                                  if (queryError) {
                                    console.error('❌ Query error:', queryError);
                                    // Still try to set empty device to allow manual input
                                    setUploadTargetDevice('');
                                    setUserDevices([]);
                                    return;
                                  }

                                  if (devicesData && devicesData.length > 0) {
                                    console.log(`✅ Found ${devicesData.length} device(s) for user ${userId}`);
                                    setUserDevices(devicesData);

                                    // Auto-select the first (most recent) device
                                    const selectedDevice = devicesData[0];
                                    setUploadTargetDevice(selectedDevice.device_hash);
                                    console.log('✅ Auto-selected device:', selectedDevice.device_hash);

                                    if (devicesData.length > 1) {
                                      console.log('ℹ️ Multiple devices available for selection');
                                    }
                                  } else {
                                    console.log('⚠️ No devices found for user:', userId);
                                    setUploadTargetDevice('');
                                    setUserDevices([]);

                                    // Double-check with a broader query
                                    console.log('🔍 Double-checking with broader query...');
                                    const { data: allDevices } = await supabase
                                      .from('devices')
                                      .select('*')  // Select all fields to see data structure
                                      .order('created_at', { ascending: false })
                                      .limit(200);

                                    console.log(`📊 Total devices in database: ${allDevices?.length || 0}`);

                                    // Check if WMDAAPWMDAGTW exists
                                    const targetDeviceHash = 'WMDAAPWMDAGTW';
                                    const deviceWithHash = allDevices?.find(d => d.device_hash === targetDeviceHash);
                                    if (deviceWithHash) {
                                      console.log('🎯 Found device with hash WMDAAPWMDAGTW:', deviceWithHash);
                                      console.log('Associated user_id:', deviceWithHash.user_id);

                                      // If this device belongs to a different user_id format
                                      if (deviceWithHash.user_id !== userId) {
                                        console.log('⚠️ Device hash exists but with different user_id format!');
                                        console.log('Expected:', userId);
                                        console.log('Actual:', deviceWithHash.user_id);

                                        // Use this device anyway
                                        setUploadTargetDevice(targetDeviceHash);
                                        setUserDevices([deviceWithHash]);
                                        console.log('✅ Using device hash WMDAAPWMDAGTW despite user_id mismatch');
                                        return;
                                      }
                                    } else {
                                      console.log('❌ Device hash WMDAAPWMDAGTW not found in database');
                                    }

                                    // Log all unique user IDs for debugging
                                    if (allDevices && allDevices.length > 0) {
                                      const uniqueUserIds = [...new Set(allDevices.map(d => d.user_id))];
                                      console.log('📋 Unique user IDs in devices table:', uniqueUserIds);
                                      console.log('🔍 Searching for:', userId);

                                      // Try different matching approaches
                                      const exactMatch = allDevices.find(d => d.user_id === userId);
                                      const lowerMatch = allDevices.find(d => d.user_id?.toLowerCase() === userId.toLowerCase());
                                      const trimMatch = allDevices.find(d => d.user_id?.trim() === userId.trim());

                                      if (exactMatch) {
                                        console.log('✅ Found device with exact match:', exactMatch.device_hash);
                                        setUploadTargetDevice(exactMatch.device_hash);
                                        setUserDevices([exactMatch]);
                                      } else if (lowerMatch) {
                                        console.log('✅ Found device with case-insensitive match:', lowerMatch.device_hash);
                                        setUploadTargetDevice(lowerMatch.device_hash);
                                        setUserDevices([lowerMatch]);
                                      } else if (trimMatch) {
                                        console.log('✅ Found device with trimmed match:', trimMatch.device_hash);
                                        setUploadTargetDevice(trimMatch.device_hash);
                                        setUserDevices([trimMatch]);
                                      } else {
                                        console.log('⚠️ No match found. User ID might not exist in devices table.');
                                        console.log('💡 This user might be registered but has no device yet.');
                                      }
                                    }
                                  }
                                } catch (err) {
                                  console.log('⚠️ Could not auto-detect device hash:', err);
                                  setUploadTargetDevice('');
                                  setUserDevices([]);
                                }
                              }
                            }}
                            onBlur={async (e) => {
                              // Also check on blur for better UX
                              const userId = e.target.value.trim();
                              if (userId && userId.length === 36 && userId.includes('-') && !uploadTargetDevice) {
                                try {
                                  // Don't use .single() to avoid 406 error
                                  const { data: devicesData } = await supabase
                                    .from('devices')
                                    .select('device_hash')
                                    .eq('user_id', userId);

                                  if (devicesData && devicesData.length > 0) {
                                    setUploadTargetDevice(devicesData[0].device_hash);
                                    setSuccess('デバイスハッシュを自動検出しました');
                                    setTimeout(() => setSuccess(''), 3000);
                                  }
                                } catch (err) {
                                  console.log('Device not found for user');
                                }
                              }
                            }}
                            placeholder="または、ユーザーIDを直接入力（UUID形式）"
                            className="w-full p-3 bg-black/20 border border-white/30 rounded-xl text-white placeholder-white/50 focus:border-white/50 focus:outline-none backdrop-blur-sm text-sm font-mono"
                          />
                        </div>
                        {loadingUsers && (
                          <p className="text-white/60 text-xs mt-1">ユーザー一覧を読み込み中...</p>
                        )}
                      </div>
                      <div>
                        <label className="block text-white/80 text-sm mb-2">
                          対象デバイスハッシュ *
                          {uploadTargetDevice && (
                            <span className="text-green-400 text-xs ml-2">
                              ✅ 検出済み
                            </span>
                          )}
                        </label>
                        <input
                          type="text"
                          value={uploadTargetDevice}
                          onChange={async (e) => {
                            const deviceHash = e.target.value.trim();
                            setUploadTargetDevice(deviceHash);

                            // If a device hash like WMDAAPWMDAGTW is entered, find the associated user
                            if (deviceHash && deviceHash.length > 10 && !deviceHash.includes('-')) {
                              console.log('🔍 Looking up user for device hash:', deviceHash);
                              try {
                                // Try admin API first to bypass RLS
                                const { data: { session } } = await supabase.auth.getSession();
                                let device = null;

                                if (session?.access_token) {
                                  try {
                                    const response = await fetch('/api/admin/devices', {
                                      method: 'GET',
                                      headers: {
                                        'Authorization': `Bearer ${session.access_token}`,
                                        'Content-Type': 'application/json'
                                      }
                                    });

                                    if (response.ok) {
                                      const result = await response.json();
                                      // Find device by hash
                                      device = result.devices?.find((d: any) => d.device_hash === deviceHash);
                                      if (device) {
                                        console.log('✅ Admin API: Found device with hash:', deviceHash);
                                      }
                                    }
                                  } catch (apiErr) {
                                    console.warn('Admin API device lookup failed:', apiErr);
                                  }
                                }

                                // Fallback to regular query if admin API didn't work
                                if (!device) {
                                  const { data, error } = await supabase
                                    .from('devices')
                                    .select('user_id, device_hash, plan_id, status')
                                    .eq('device_hash', deviceHash)
                                    .maybeSingle();
                                  device = data;
                                }

                                if (device) {
                                  console.log('✅ Found user for device hash:', device.user_id);
                                  setUploadTargetUser(device.user_id);
                                  setSuccess('ユーザーIDを自動検出しました');
                                  setTimeout(() => setSuccess(''), 3000);
                                } else {
                                  console.log('⚠️ No user found for device hash:', deviceHash);
                                }
                              } catch (err) {
                                console.error('Error looking up device:', err);
                              }
                            }
                          }}
                          placeholder={uploadTargetDevice ? uploadTargetDevice : "デバイスハッシュを手動入力（例: WMDAAPWMDAGTW）"}
                          className={`w-full p-3 bg-black/20 border ${
                            uploadTargetDevice ? 'border-green-400/50' : 'border-white/30'
                          } rounded-xl text-white placeholder-white/50 focus:border-white/50 focus:outline-none backdrop-blur-sm text-sm font-mono transition-colors`}
                          readOnly={false}  // Always allow manual input
                        />
                        {!uploadTargetDevice && uploadTargetUser && uploadTargetUser.length === 36 && (
                          <p className="text-yellow-400 text-xs mt-1">
                            ⚠️ このユーザーにはデバイスが登録されていません。手動で入力してください。
                          </p>
                        )}
                        {userDevices.length > 1 && (
                          <div className="mt-2 p-2 bg-blue-500/10 border border-blue-400/30 rounded-lg">
                            <p className="text-blue-400 text-xs mb-1">複数のデバイスが見つかりました:</p>
                            <select
                              value={uploadTargetDevice}
                              onChange={(e) => setUploadTargetDevice(e.target.value)}
                              className="w-full p-2 bg-black/20 border border-blue-400/30 rounded text-white text-sm"
                            >
                              {userDevices.map((device, idx) => (
                                <option key={idx} value={device.device_hash} className="bg-gray-800">
                                  {device.device_hash.substring(0, 12)}... - {device.plan_id || '未契約'} - {device.status}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-white/80 text-sm mb-2">アップロードファイル (.ate または .lua) *</label>
                    <input
                      type="file"
                      accept=".ate,.lua"
                      onChange={handleFileChange}
                      className="w-full p-3 bg-black/20 border border-white/30 rounded-xl text-white file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-white/20 file:text-white hover:file:bg-white/30 backdrop-blur-sm text-sm"
                    />
                    {uploadFile && (
                      <p className="text-green-300 text-xs mt-2">
                        選択済み: {uploadFile.name} ({Math.round(uploadFile.size / 1024)}KB)
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-white/80 text-sm mb-2">メモ (任意)</label>
                    <textarea
                      value={uploadNotes}
                      onChange={(e) => setUploadNotes(e.target.value)}
                      placeholder="アップロードに関するメモを入力"
                      rows={3}
                      className="w-full p-3 bg-black/20 border border-white/30 rounded-xl text-white placeholder-white/50 focus:border-white/50 focus:outline-none backdrop-blur-sm text-sm resize-none"
                    />
                  </div>

                  <div className="space-y-3 pt-4">
                    {uploading && (
                      <div>
                        <div className="flex justify-between text-xs text-white/70 mb-1">
                          <span>アップロード進行中</span>
                          <span>{uploadProgress}%</span>
                        </div>
                        <div className="w-full bg-white/20 rounded-full h-2">
                          <div
                            className="bg-gradient-to-r from-amber-400 to-orange-400 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${uploadProgress}%` }}
                          />
                        </div>
                      </div>
                    )}

                    <div className="flex flex-col sm:flex-row gap-3">
                      <Button
                        onClick={handleAdminUpload}
                        disabled={uploading || !uploadFile || !uploadTargetUser || !uploadTargetDevice}
                        className="flex-1 bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:from-amber-600 hover:to-orange-600 shadow-xl"
                        size="sm"
                      >
                        {uploading ? '📤 アップロード中...' : '📤 アップロード実行'}
                      </Button>
                      <Button
                        onClick={() => {
                          setShowUploadForm(false)
                          setUploadTargetUser('')
                          setUploadTargetDevice('')
                          setUploadFile(null)
                          setUploadNotes('')
                          setError('')
                        }}
                        variant="outline"
                        size="sm"
                        className="flex-1 bg-white/10 border-white/30 text-white hover:bg-white/20"
                      >
                      キャンセル
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="text-xs text-white/50 space-y-1 bg-white/5 p-3 rounded-lg">
                <p>• 対象ユーザーのUUIDとデバイスハッシュを正確に入力してください</p>
                <p>• アップロードしたファイルは既存のファイルを上書きします</p>
                <p>• ファイル形式は .ate または .lua のみサポートしています</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Device Change Form */}
      {showDeviceChangeForm && (
        <div className="bg-gradient-to-br from-yellow-800/30 via-amber-800/20 to-orange-800/30 backdrop-blur-xl border border-yellow-400/30 rounded-2xl p-4 md:p-6 lg:p-8 shadow-lg shadow-yellow-500/10">
          <h3 className="text-lg md:text-xl font-semibold text-white mb-4">デバイス変更</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-white/80 text-sm mb-2">新しいデバイスハッシュ</label>
              <input
                type="text"
                value={newDeviceHash}
                onChange={(e) => setNewDeviceHash(e.target.value)}
                placeholder="新しいデバイスハッシュを入力"
                className="w-full p-3 bg-black/20 border border-white/30 rounded-xl text-white placeholder-white/50 focus:border-white/50 focus:outline-none backdrop-blur-sm text-sm"
              />
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                onClick={handleDeviceChange}
                disabled={changingDevice}
                className="flex-1 bg-gradient-to-r from-yellow-500 to-amber-500 text-white hover:from-yellow-600 hover:to-amber-600 shadow-xl"
                size="sm"
              >
                {changingDevice ? '変更中...' : 'デバイス変更'}
              </Button>
              <Button
                onClick={() => {
                  setShowDeviceChangeForm(false)
                  setNewDeviceHash('')
                }}
                variant="outline"
                size="sm"
                className="flex-1 bg-white/10 border-white/30 text-white hover:bg-white/20"
              >
                キャンセル
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )

  const renderSubscriptionSection = () => (
    <div className="space-y-4 md:space-y-6">
      {userData?.isSubscriptionActive && userData?.subscription ? (
        <div className="bg-gradient-to-br from-green-800/30 via-emerald-800/20 to-teal-800/30 backdrop-blur-xl border border-green-400/30 rounded-2xl p-4 md:p-6 lg:p-8 shadow-lg shadow-green-500/10">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4 md:mb-6">
            <div>
              <h3 className="text-lg md:text-xl font-semibold text-white mb-2">✅ 現在のプラン</h3>
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-xl md:text-2xl lg:text-3xl font-bold bg-gradient-to-r from-green-300 to-emerald-300 bg-clip-text text-transparent">
                  {userData.plan?.name === 'starter' ? '📱' :
                   userData.plan?.name === 'pro' ? '🚀' :
                   userData.plan?.name === 'max' ? '👑' : '🎯'} {userData.plan?.display_name || 'PRO'}
                </span>
                <Badge
                  variant={userData.isSubscriptionActive ? "success" : "warning"}
                  className={userData.isSubscriptionActive ?
                    "bg-green-500/20 text-green-300 border-green-400/30" :
                    "bg-yellow-500/20 text-yellow-300 border-yellow-400/30"
                  }
                >
                  {userData.isSubscriptionActive ? 'アクティブ' : '体験中'}
                </Badge>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4 md:mb-6">
            <div className="bg-white/10 border border-white/20 p-4 rounded-xl backdrop-blur-sm">
              <div className="text-sm text-white/70 mb-1">契約日</div>
              <div className="text-white font-medium">
                {new Date(userData.subscription.created_at).toLocaleDateString('ja-JP')}
              </div>
            </div>

            <div className="bg-white/10 border border-white/20 p-4 rounded-xl backdrop-blur-sm">
              <div className="text-sm text-white/70 mb-1">料金</div>
              <div className="text-white font-medium">
                {userData.plan?.price ? `¥${userData.plan.price.toLocaleString()}/月` : '月額制'}
              </div>
            </div>

            <div className="bg-white/10 border border-white/20 p-4 rounded-xl backdrop-blur-sm md:col-span-2 lg:col-span-1">
              <div className="text-sm text-white/70 mb-1">次回更新</div>
              <div className="text-white font-medium">自動更新</div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button
              onClick={handleCancelSubscription}
              disabled={cancelling}
              variant="outline"
              size="sm"
              className="bg-red-500/20 border-red-400/30 text-red-300 hover:bg-red-500/30 hover:border-red-400/50 backdrop-blur-sm"
            >
              {cancelling ? '解約中...' : '🚫 解約する'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="bg-blue-500/20 border-blue-400/30 text-blue-300 hover:bg-blue-500/30 hover:border-blue-400/50 backdrop-blur-sm"
              onClick={() => window.open('https://billing.stripe.com', '_blank')}
            >
              💳 請求書を確認
            </Button>
          </div>
        </div>
      ) : (
        <SubscriptionPlansCard />
      )}
    </div>
  )

  const renderUsageSection = () => (
    <div className="space-y-4 md:space-y-6">
      <div className="bg-gradient-to-br from-purple-800/30 via-violet-800/20 to-indigo-800/30 backdrop-blur-xl border border-purple-400/30 rounded-2xl p-4 md:p-6 lg:p-8 shadow-lg shadow-purple-500/10">
        <h2 className="text-lg md:text-xl font-semibold text-white mb-4">📈 利用統計</h2>
        {/* Plan Features Display */}
        <PlanFeatures plan={userData?.plan || null} isActive={userData?.isSubscriptionActive} />

        <div className="text-center py-8 mt-6">
          <div className="text-4xl mb-4">📊</div>
          <p className="text-white/70 text-sm md:text-base mb-4">
            利用統計機能は現在開発中です
          </p>
          <p className="text-white/50 text-xs">
            今後のアップデートで詳細な利用統計を確認できるようになります
          </p>
        </div>
      </div>
    </div>
  )

  const renderSettingsSection = () => (
    <div className="space-y-4 md:space-y-6">
      <div className="bg-gradient-to-br from-gray-800/30 via-slate-800/20 to-zinc-800/30 backdrop-blur-xl border border-gray-400/30 rounded-2xl p-4 md:p-6 lg:p-8 shadow-lg shadow-gray-500/10">
        <h2 className="text-lg md:text-xl font-semibold text-white mb-4">⚙️ 設定</h2>

        <div className="space-y-4">
          <div className="bg-white/10 border border-white/20 p-4 rounded-xl backdrop-blur-sm">
            <h3 className="font-medium text-white mb-2">アカウント情報</h3>
            <div className="space-y-2">
              <div className="flex flex-col sm:flex-row sm:justify-between gap-2">
                <span className="text-white/70 text-sm">メールアドレス</span>
                <span className="text-white/80 text-sm break-all">{userData?.email}</span>
              </div>
            </div>
          </div>

          <div className="bg-white/10 border border-white/20 p-4 rounded-xl backdrop-blur-sm">
            <h3 className="font-medium text-white mb-2">セキュリティ</h3>
            <div className="text-center py-4">
              <div className="text-2xl mb-2">🔒</div>
              <p className="text-white/70 text-sm">
                セキュリティ設定は現在開発中です
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )

  const renderHelpSection = () => (
    <div className="space-y-4 md:space-y-6">
      <div className="bg-gradient-to-br from-blue-800/30 via-cyan-800/20 to-teal-800/30 backdrop-blur-xl border border-blue-400/30 rounded-2xl p-4 md:p-6 lg:p-8 shadow-lg shadow-blue-500/10">
        <h2 className="text-lg md:text-xl font-semibold text-white mb-4">❓ サポート・ヘルプ</h2>

        <div className="space-y-4">
          <div className="bg-white/10 border border-white/20 p-4 rounded-xl backdrop-blur-sm">
            <h3 className="font-medium text-white mb-2">📋 利用方法</h3>
            <div className="space-y-3 text-sm text-white/80">
              <div>
                <strong>1️⃣ 初期設定:</strong>
                <ul className="ml-4 mt-1 space-y-1">
                  <li>• iPhone 7/8にJailbreak + AutoTouchをインストール</li>
                  <li>• SMARTGRAMスクリプト（smartgram.ate）をダウンロード</li>
                  <li>• デバイス登録を完了</li>
                </ul>
              </div>

              <div>
                <strong>2️⃣ 日常利用:</strong>
                <ul className="ml-4 mt-1 space-y-1">
                  <li>• smartgram.ateを実行してツール選択</li>
                  <li>• 各種自動化ツールを実行</li>
                  <li>• 結果をダッシュボードで確認</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="bg-white/10 border border-white/20 p-4 rounded-xl backdrop-blur-sm">
            <h3 className="font-medium text-white mb-2">🆘 よくある質問</h3>
            <div className="space-y-3 text-sm text-white/80">
              <div>
                <strong>Q: デバイスハッシュが取得できません</strong>
                <p className="mt-1">A: AutoTouchが正しくインストールされているか確認してください。</p>
              </div>

              <div>
                <strong>Q: ツールが動作しません</strong>
                <p className="mt-1">A: Instagramアプリが最新版か、デバイスがサポート対象（iPhone 7/8）か確認してください。</p>
              </div>
            </div>
          </div>

          <div className="bg-white/10 border border-white/20 p-4 rounded-xl backdrop-blur-sm">
            <h3 className="font-medium text-white mb-2">📞 お問い合わせ</h3>
            <p className="text-sm text-white/70 mb-3">
              技術的な問題やご質問がございましたら、以下からお気軽にお問い合わせください。
            </p>
            <div className="text-center">
              <Button
                variant="outline"
                size="sm"
                className="bg-blue-500/20 border-blue-400/30 text-blue-300 hover:bg-blue-500/30 hover:border-blue-400/50 w-full sm:w-auto"
                onClick={() => window.open('mailto:support@smartgram.jp', '_blank')}
              >
                📧 サポートに連絡
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )

  if (loading) {
    return <LoadingScreen />
  }

  if (dataError) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-violet-900 flex items-center justify-center p-4">
        <Card className="w-full max-w-md bg-gradient-to-br from-red-900/40 via-pink-900/30 to-red-900/40 backdrop-blur-xl border border-red-400/20 shadow-xl">
          <CardHeader>
            <CardTitle className="text-white">エラー</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-white/80 mb-4">{dataError}</p>
            <Button
              onClick={() => window.location.reload()}
              className="w-full bg-gradient-to-r from-red-500 to-pink-500 text-white"
            >
              再読み込み
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-black">
      {/* Mobile Header with Menu Button */}
      <div className="lg:hidden bg-gradient-to-r from-purple-900/40 via-pink-900/30 to-red-900/40 backdrop-blur-xl border-b border-purple-400/20 p-4">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-bold bg-gradient-to-r from-white to-purple-200 bg-clip-text text-transparent">
            SMARTGRAM
          </h1>
          <Button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            variant="outline"
            size="sm"
            className="bg-white/10 border-white/20 text-white hover:bg-white/20"
          >
            {mobileMenuOpen ? '×' : '☰'}
          </Button>
        </div>

        {/* Mobile Navigation Menu */}
        {mobileMenuOpen && (
          <div className="mt-4 space-y-1">
            {sidebarItems.map((item) => (
              <button
                key={item.id}
                onClick={() => handleSectionChange(item.id)}
                className={`w-full text-left p-3 rounded-xl transition-all ${
                  activeSection === item.id
                    ? 'bg-gradient-to-r from-purple-500/30 to-pink-500/30 border border-purple-400/50 text-white shadow-lg'
                    : 'text-white/70 hover:bg-white/10 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-lg">{item.icon}</span>
                  <div className="flex-1">
                    <div className="font-medium text-sm">{item.label}</div>
                    <div className="text-xs text-white/50 mt-0.5">{item.description}</div>
                  </div>
                </div>
              </button>
            ))}

            {/* Mobile Menu Admin Link */}
            {userData && isAdminEmail(userData.email) && (
              <Link href="/admin" className="block">
                <button className="w-full text-left p-3 rounded-xl transition-all text-white/70 hover:bg-yellow-500/20 hover:text-yellow-300 border border-yellow-400/20">
                  <div className="flex items-center gap-3">
                    <span className="text-lg">👑</span>
                    <div className="flex-1">
                      <div className="font-medium text-sm">管理者</div>
                      <div className="text-xs text-white/50 mt-0.5">管理者メニュー</div>
                    </div>
                  </div>
                </button>
              </Link>
            )}

            {/* Mobile Menu Logout Button */}
            <button
              onClick={() => {
                handleSignOut()
                setMobileMenuOpen(false)
              }}
              className="w-full text-left p-3 rounded-xl transition-all text-white/70 hover:bg-red-500/20 hover:text-red-300 border border-red-400/20"
            >
              <div className="flex items-center gap-3">
                <span className="text-lg">🚪</span>
                <div className="flex-1">
                  <div className="font-medium text-sm">ログアウト</div>
                  <div className="text-xs text-white/50 mt-0.5">アカウントからサインアウト</div>
                </div>
              </div>
            </button>
          </div>
        )}
      </div>

      <div className="flex">
        {/* Desktop Sidebar */}
        <div className={`${sidebarCollapsed ? 'w-16' : 'w-64'} min-h-screen transition-all duration-300 bg-gradient-to-b from-purple-900/40 via-pink-900/30 to-red-900/40 backdrop-blur-xl border-r border-purple-400/20 shadow-xl flex-col hidden lg:flex`}>
          {/* Sidebar Header */}
          <div className="p-4 border-b border-white/20">
            <div className="flex items-center justify-between">
              {!sidebarCollapsed && (
                <h1 className="text-lg font-bold bg-gradient-to-r from-white to-purple-200 bg-clip-text text-transparent">
                  SMARTGRAM
                </h1>
              )}
              <Button
                onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                variant="outline"
                size="sm"
                className="bg-white/10 border-white/20 text-white hover:bg-white/20 p-2"
              >
                {sidebarCollapsed ? '→' : '←'}
              </Button>
            </div>
          </div>

          {/* Navigation Items */}
          <nav className="flex-1 p-2">
            {sidebarItems.map((item) => (
              <button
                key={item.id}
                onClick={() => handleSectionChange(item.id)}
                className={`w-full text-left p-3 rounded-xl mb-2 transition-all ${
                  activeSection === item.id
                    ? 'bg-gradient-to-r from-purple-500/30 to-pink-500/30 border border-purple-400/50 text-white shadow-lg'
                    : 'text-white/70 hover:bg-white/10 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-lg">{item.icon}</span>
                  {!sidebarCollapsed && (
                    <div className="flex-1">
                      <div className="font-medium text-sm">{item.label}</div>
                      <div className="text-xs text-white/50 mt-0.5">{item.description}</div>
                    </div>
                  )}
                </div>
              </button>
            ))}
          </nav>

          {/* Sidebar Footer */}
          <div className="p-4 border-t border-white/20">
            <div className="flex flex-col gap-2">
              {userData && isAdminEmail(userData.email) && (
                <Link href="/admin" className="w-full">
                  <Button
                    variant="outline"
                    size="sm"
                    className={`${sidebarCollapsed ? 'px-2' : 'w-full'} bg-yellow-500/20 border-yellow-400/30 text-yellow-300 hover:bg-yellow-500/30 hover:border-yellow-400/50 backdrop-blur-sm`}
                  >
                    {sidebarCollapsed ? '👑' : '👑 管理者'}
                  </Button>
                </Link>
              )}
              <Button
                onClick={handleSignOut}
                variant="outline"
                size="sm"
                className={`${sidebarCollapsed ? 'px-2' : 'w-full'} bg-white/10 border-white/20 text-white hover:bg-white/20`}
              >
                {sidebarCollapsed ? '🚪' : 'ログアウト'}
              </Button>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 p-4 md:p-6 lg:p-8">
          {/* Header */}
          <div className="bg-gradient-to-br from-purple-900/40 via-pink-900/30 to-red-900/40 backdrop-blur-xl border border-purple-400/20 rounded-2xl p-4 md:p-6 shadow-xl shadow-purple-500/10 mb-4 md:mb-6 lg:mb-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl md:text-2xl lg:text-3xl xl:text-4xl font-bold bg-gradient-to-r from-white to-purple-200 bg-clip-text text-transparent mb-2">
                  {sidebarItems.find(item => item.id === activeSection)?.label || 'ダッシュボード'}
                </h2>
                <p className="text-white/70 text-sm md:text-base">
                  ようこそ、{userData?.email}さん
                </p>
              </div>
            </div>
          </div>

          {/* Error Display */}
          {error && (
            <div className="bg-gradient-to-br from-red-900/40 via-pink-900/30 to-red-900/40 backdrop-blur-xl border border-red-400/30 rounded-2xl p-4 md:p-6 mb-4 md:mb-6 shadow-lg shadow-red-500/10">
              <p className="text-red-300 text-sm md:text-base">{error}</p>
            </div>
          )}

          {/* Section Content */}
          <div>
            {renderSectionContent()}
          </div>


          {/* Payment Status Modal */}
          {paymentStatus && (
            <PaymentStatusModal
              status={paymentStatus}
              onClose={() => setPaymentStatus(null)}
            />
          )}
        </div>
      </div>
    </div>
  )
}