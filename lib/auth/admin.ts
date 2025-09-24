// 管理者認証ユーティリティ

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase/client'

// 管理者メールアドレスのリスト
const ADMIN_EMAILS = [
  'akihiro0324mnr@gmail.com'
]

/**
 * 現在のユーザーが管理者かどうかをチェック
 */
export async function isCurrentUserAdmin(): Promise<boolean> {
  try {
    const { data: { user } } = await supabase.auth.getUser()

    if (!user?.email) {
      return false
    }

    return ADMIN_EMAILS.includes(user.email)
  } catch (error) {
    console.error('Admin check error:', error)
    return false
  }
}

/**
 * 指定されたメールアドレスが管理者かどうかをチェック
 */
export function isAdminEmail(email: string): boolean {
  return ADMIN_EMAILS.includes(email)
}

/**
 * 管理者認証を要求するコンポーネント用のホック
 */
export function useAdminAuth() {
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    checkAdminStatus()
  }, [])

  const checkAdminStatus = async () => {
    try {
      const adminStatus = await isCurrentUserAdmin()
      setIsAdmin(adminStatus)
    } catch (error) {
      console.error('Admin status check failed:', error)
      setIsAdmin(false)
    } finally {
      setLoading(false)
    }
  }

  return { isAdmin, loading, checkAdminStatus }
}