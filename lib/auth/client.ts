import { supabase } from '@/lib/supabase/client'
import { User } from '@supabase/supabase-js'

export interface AuthUser {
  id: string
  email: string | undefined
  device_hash?: string
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  // まずSupabaseの現在のセッションを確認
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    return {
      id: user.id,
      email: user.email,
      device_hash: user.user_metadata?.device_hash
    }
  }

  // Supabaseセッションがない場合、カスタムストレージからセッションを復元
  if (typeof window !== 'undefined') {
    try {
      // remember meが有効だった場合のセッション復元
      const rememberMe = localStorage.getItem('smartgram_remember_me')
      if (rememberMe === 'true') {
        const savedSession = localStorage.getItem('smartgram_remember_session')
        if (savedSession) {
          const sessionData = JSON.parse(savedSession)
          // セッションの有効期限をチェック
          if (sessionData.expires_at && new Date(sessionData.expires_at * 1000) > new Date()) {
            // Supabaseセッションを復元
            await supabase.auth.setSession({
              access_token: sessionData.access_token,
              refresh_token: sessionData.refresh_token
            })

            return {
              id: sessionData.user.id,
              email: sessionData.user.email,
              device_hash: sessionData.user.user_metadata?.device_hash
            }
          } else {
            // 期限切れの場合はクリア
            localStorage.removeItem('smartgram_remember_session')
            localStorage.removeItem('smartgram_remember_me')
          }
        }
      }

      // 一時セッション（ブラウザセッション）の確認
      const tempSession = sessionStorage.getItem('smartgram_temp_session')
      if (tempSession) {
        const sessionData = JSON.parse(tempSession)
        if (sessionData.expires_at && new Date(sessionData.expires_at * 1000) > new Date()) {
          await supabase.auth.setSession({
            access_token: sessionData.access_token,
            refresh_token: sessionData.refresh_token
          })

          return {
            id: sessionData.user.id,
            email: sessionData.user.email,
            device_hash: sessionData.user.user_metadata?.device_hash
          }
        } else {
          sessionStorage.removeItem('smartgram_temp_session')
        }
      }
    } catch (error) {
      console.error('セッション復元エラー:', error)
      // エラーが発生した場合は保存されたセッション情報をクリア
      localStorage.removeItem('smartgram_remember_session')
      localStorage.removeItem('smartgram_remember_me')
      sessionStorage.removeItem('smartgram_temp_session')
    }
  }

  return null
}

export async function signIn(email: string, password: string, rememberMe: boolean = false) {
  console.log('🔑 Supabase認証開始:', { email, rememberMe })

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    })

    // 認証成功後、rememberMeの設定に基づいてセッション情報を管理
    if (data.session && typeof window !== 'undefined') {
      const sessionData = {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_at: data.session.expires_at,
        user: data.user
      }

      if (rememberMe) {
        // ログイン状態を保持する場合はlocalStorageに保存
        localStorage.setItem('smartgram_remember_session', JSON.stringify(sessionData))
        localStorage.setItem('smartgram_remember_me', 'true')
        // sessionStorageからは削除
        sessionStorage.removeItem('smartgram_temp_session')
      } else {
        // ログイン状態を保持しない場合はsessionStorageに保存
        sessionStorage.setItem('smartgram_temp_session', JSON.stringify(sessionData))
        // localStorageからrememberMe関連データを削除
        localStorage.removeItem('smartgram_remember_session')
        localStorage.removeItem('smartgram_remember_me')
      }
    }

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

export async function signInWithGoogle() {
  console.log('🔑 Googleログイン開始')
  console.log('🔗 リダイレクト先:', `${window.location.origin}/dashboard`)
  console.log('🌐 現在のURL:', window.location.href)

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/dashboard`
    }
  })

  if (error) {
    console.error('❌ Googleログインエラー:', error)
    console.error('❌ エラー詳細:', {
      message: error.message,
      status: error.status,
      statusCode: error.statusCode
    })
    throw error
  }

  console.log('✅ Googleログイン開始成功:', data)
  return data
}

export async function signOut() {
  // セッション情報をクリア
  if (typeof window !== 'undefined') {
    localStorage.removeItem('smartgram_remember_session')
    localStorage.removeItem('smartgram_remember_me')
    sessionStorage.removeItem('smartgram_temp_session')
  }

  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

export function onAuthStateChange(callback: (user: User | null) => void) {
  return supabase.auth.onAuthStateChange((event, session) => {
    callback(session?.user || null)
  })
}