import { supabase } from '@/lib/supabase/client'
import { User } from '@supabase/supabase-js'

export interface AuthUser {
  id: string
  email: string | undefined
  device_hash?: string
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return null

  return {
    id: user.id,
    email: user.email,
    device_hash: user.user_metadata?.device_hash
  }
}

export async function signIn(email: string, password: string) {
  console.log('🔑 Supabase認証開始:', { email })

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    })

    console.log('📊 Supabase認証レスポンス:', {
      user: data.user ? '✅ ユーザー情報あり' : '❌ ユーザー情報なし',
      session: data.session ? '✅ セッション情報あり' : '❌ セッション情報なし',
      error: error ? `❌ ${error.message}` : '✅ エラーなし'
    })

    if (error) {
      console.error('❌ Supabase認証エラー:', error)
      throw error
    }

    if (!data.user || !data.session) {
      console.error('❌ 認証成功だが、ユーザー情報またはセッションが不足')
      throw new Error('認証情報が不完全です')
    }

    console.log('✅ 認証完了:', {
      userId: data.user.id,
      email: data.user.email
    })

    return data
  } catch (error) {
    console.error('🚨 認証処理中にエラー:', error)
    throw error
  }
}

export async function signUp(email: string, password: string, deviceHash: string) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        device_hash: deviceHash
      }
    }
  })

  if (error) throw error
  return data
}

export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

export function onAuthStateChange(callback: (user: User | null) => void) {
  return supabase.auth.onAuthStateChange((event, session) => {
    callback(session?.user || null)
  })
}