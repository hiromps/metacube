'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase/client'
import { Button } from '@/app/components/ui/Button'
import { Card, CardHeader, CardTitle, CardContent } from '@/app/components/ui/Card'

interface UserDevice {
  device_id: string
  user_id: string
  email: string
  device_hash: string
  plan_name: string
  plan_display_name: string
  expires_at: string
  subscription_status: string
  created_at: string
}

export default function UserManagementPage() {
  const [users, setUsers] = useState<UserDevice[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editingUser, setEditingUser] = useState<UserDevice | null>(null)
  const [uploadingFile, setUploadingFile] = useState<string | null>(null)
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({})

  useEffect(() => {
    loadUsers()
  }, [])

  const loadUsers = async () => {
    try {
      setLoading(true)
      // device_plan_viewから必要なカラムのみ取得し、devicesテーブルでソート
      const { data, error } = await supabase
        .from('device_plan_view')
        .select(`
          device_id,
          device_hash,
          user_id,
          plan_name,
          plan_display_name,
          plan_expires_at,
          subscription_status
        `)
        .order('device_id', { ascending: false })

      if (error) throw error

      // ユーザーのメールアドレスを取得するため、追加でusersテーブルからデータを取得
      const usersWithEmail = await Promise.all(
        (data || []).map(async (device) => {
          const { data: userData } = await supabase.auth.admin.getUserById(device.user_id)
          return {
            ...device,
            email: userData.user?.email || '不明',
            created_at: userData.user?.created_at || new Date().toISOString(),
            expires_at: device.plan_expires_at || '2025-12-31'
          }
        })
      )

      setUsers(usersWithEmail)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const updateUserPlan = async (userId: string, updates: {
    plan_name?: string
    expires_at?: string
    subscription_status?: string
  }) => {
    try {
      // デバイステーブルを更新（プラン情報はdevicesテーブルのplan_idで管理）
      const { error } = await supabase
        .from('devices')
        .update({
          // プラン名に基づいてplan_idを設定
          plan_id: getPlanIdByName(updates.plan_name),
          // 有効期限や状態を更新する場合は追加のロジックが必要
        })
        .eq('user_id', userId)

      if (error) throw error

      alert('ユーザー情報を更新しました')
      loadUsers()
      setEditingUser(null)
    } catch (err: any) {
      alert(`更新に失敗しました: ${err.message}`)
    }
  }

  const getPlanIdByName = (planName?: string) => {
    const planMap: Record<string, string> = {
      'trial': 'trial-plan-id',
      'starter': 'starter-plan-id',
      'pro': 'pro-plan-id',
      'max': 'max-plan-id'
    }
    return planName ? planMap[planName] : null
  }

  const regeneratePackage = async (deviceHash: string) => {
    try {
      // 管理者として特定ユーザーのパッケージを再生成
      const response = await fetch(`/api/admin/regenerate-package`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ device_hash: deviceHash })
      })

      if (!response.ok) throw new Error('パッケージ再生成に失敗')

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `smartgram_${deviceHash.substring(0, 8)}_admin.ate`
      a.click()
      window.URL.revokeObjectURL(url)

      alert('管理者用パッケージを生成しました')
    } catch (err: any) {
      alert(`パッケージ生成に失敗: ${err.message}`)
    }
  }

  const uploadCustomPackage = async (user: UserDevice, file: File) => {
    try {
      setUploadingFile(user.device_hash)
      setUploadProgress({ [user.device_hash]: 0 })

      // ファイルをBase64に変換
      const fileContent = await new Promise<string>((resolve) => {
        const reader = new FileReader()
        reader.onload = () => {
          const base64 = (reader.result as string).split(',')[1]
          resolve(base64)
        }
        reader.readAsDataURL(file)
      })

      setUploadProgress({ [user.device_hash]: 50 })

      // アップロードAPI呼び出し
      const response = await fetch('/api/admin/upload-package', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user.user_id,
          device_hash: user.device_hash,
          file_name: file.name,
          file_content: fileContent,
          file_size: file.size,
          notes: `管理者によりアップロード: ${new Date().toLocaleString()}`
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'アップロードに失敗しました')
      }

      setUploadProgress({ [user.device_hash]: 100 })

      setTimeout(() => {
        setUploadingFile(null)
        setUploadProgress({})
        alert('専用パッケージをアップロードしました！\nユーザーはダッシュボードからダウンロード可能です。')
      }, 1000)

    } catch (err: any) {
      setUploadingFile(null)
      setUploadProgress({})
      alert(`アップロードに失敗: ${err.message}`)
    }
  }

  const handleFileUpload = (user: UserDevice, event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      if (file.name.endsWith('.ate')) {
        uploadCustomPackage(user, file)
      } else {
        alert('セキュリティのため、.ateファイルのみアップロード可能です。\nLuaコードは事前にateファイルに変換してください。')
      }
    }
  }

  if (loading) return <div className="p-8">読み込み中...</div>
  if (error) return <div className="p-8 text-red-500">エラー: {error}</div>

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900 p-4">
      <div className="container mx-auto max-w-6xl">
        <h1 className="text-3xl font-bold text-white mb-8">👑 管理者 - ユーザー管理</h1>

        <div className="grid gap-6">
          {users.map(user => (
            <Card key={user.device_id} className="bg-black/40 backdrop-blur border border-white/10">
              <CardHeader>
                <CardTitle className="text-white flex justify-between items-center">
                  <span>{user.email}</span>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => setEditingUser(user)}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      編集
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => regeneratePackage(user.device_hash)}
                      className="bg-orange-600 hover:bg-orange-700"
                    >
                      📦 パッケージ生成
                    </Button>
                    <div className="relative inline-block">
                      <input
                        type="file"
                        accept=".ate"
                        onChange={(e) => handleFileUpload(user, e)}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                        disabled={uploadingFile === user.device_hash}
                        id={`file-upload-${user.device_hash}`}
                      />
                      <Button
                        size="sm"
                        className="bg-green-600 hover:bg-green-700 relative z-0"
                        disabled={uploadingFile === user.device_hash}
                        onClick={() => {
                          if (uploadingFile !== user.device_hash) {
                            document.getElementById(`file-upload-${user.device_hash}`)?.click();
                          }
                        }}
                      >
                        {uploadingFile === user.device_hash ? '📤 アップロード中...' : '📤 .ateファイル'}
                      </Button>
                    </div>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <p className="text-gray-400">デバイスハッシュ</p>
                    <p className="text-white font-mono">{user.device_hash}</p>
                  </div>
                  <div>
                    <p className="text-gray-400">プラン</p>
                    <p className="text-white">{user.plan_display_name}</p>
                  </div>
                  <div>
                    <p className="text-gray-400">有効期限</p>
                    <p className="text-white">{user.expires_at}</p>
                  </div>
                  <div>
                    <p className="text-gray-400">状態</p>
                    <p className="text-white">{user.subscription_status}</p>
                  </div>
                </div>

                {/* アップロード進捗表示 */}
                {uploadProgress[user.device_hash] !== undefined && (
                  <div className="mt-4 bg-gray-800 p-3 rounded-lg">
                    <div className="flex items-center justify-between text-sm text-white mb-2">
                      <span>アップロード進捗</span>
                      <span>{uploadProgress[user.device_hash]}%</span>
                    </div>
                    <div className="w-full bg-gray-700 rounded-full h-2">
                      <div
                        className="bg-green-500 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${uploadProgress[user.device_hash]}%` }}
                      />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* 編集モーダル */}
        {editingUser && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <Card className="bg-gray-900 border border-white/20 w-full max-w-md">
              <CardHeader>
                <CardTitle className="text-white">ユーザー情報編集</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="block text-white mb-2">プラン</label>
                  <select
                    className="w-full p-2 bg-gray-800 text-white border border-gray-600 rounded"
                    defaultValue={editingUser.plan_name}
                    onChange={(e) => setEditingUser({...editingUser, plan_name: e.target.value})}
                  >
                    <option value="trial">Trial</option>
                    <option value="starter">Starter</option>
                    <option value="pro">Pro</option>
                    <option value="max">Max</option>
                  </select>
                </div>
                <div>
                  <label className="block text-white mb-2">有効期限</label>
                  <input
                    type="datetime-local"
                    className="w-full p-2 bg-gray-800 text-white border border-gray-600 rounded"
                    defaultValue={editingUser.expires_at?.replace(' ', 'T')}
                    onChange={(e) => setEditingUser({...editingUser, expires_at: e.target.value.replace('T', ' ')})}
                  />
                </div>
                <div>
                  <label className="block text-white mb-2">状態</label>
                  <select
                    className="w-full p-2 bg-gray-800 text-white border border-gray-600 rounded"
                    defaultValue={editingUser.subscription_status}
                    onChange={(e) => setEditingUser({...editingUser, subscription_status: e.target.value})}
                  >
                    <option value="active">Active</option>
                    <option value="trial">Trial</option>
                    <option value="expired">Expired</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
                <div className="flex gap-2 pt-4">
                  <Button
                    onClick={() => updateUserPlan(editingUser.user_id, {
                      plan_name: editingUser.plan_name,
                      expires_at: editingUser.expires_at,
                      subscription_status: editingUser.subscription_status
                    })}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    保存
                  </Button>
                  <Button
                    onClick={() => setEditingUser(null)}
                    className="bg-gray-600 hover:bg-gray-700"
                  >
                    キャンセル
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}