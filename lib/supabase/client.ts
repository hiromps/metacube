import { createClient } from '@supabase/supabase-js'
import { supabaseConfig } from './config'

// For static export, prioritize hardcoded config over environment variables
// This ensures the app works on Cloudflare Pages without needing environment variables
const supabaseUrl = supabaseConfig.url || process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = supabaseConfig.anonKey || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const supabaseServiceRoleKey = supabaseConfig.serviceRoleKey || process.env.SUPABASE_SERVICE_ROLE_KEY

// Debug environment variables
if (typeof window !== 'undefined') {
  console.log('Supabase URL:', supabaseUrl)
  console.log('Supabase Anon Key exists:', !!supabaseAnonKey)
  console.log('Config source:', supabaseConfig.url ? 'config.ts' : 'environment variables')
}

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase configuration')
  throw new Error('Missing Supabase configuration. Please check config.ts or environment variables.')
}

// Client for browser/frontend
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    // デフォルトはセッション持続、個別のログイン時に上書き可能
    storage: typeof window !== 'undefined' ? window.localStorage : undefined
  }
})

// Admin client for server-side operations (only create if service role key exists)
export const supabaseAdmin = supabaseServiceRoleKey
  ? createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })
  : null

// Database types
export interface Device {
  id: string
  user_id: string
  device_hash: string
  device_model: string
  status: 'trial' | 'active' | 'expired' | 'suspended'
  trial_ends_at: string
  created_at: string
  updated_at: string
}

export interface Subscription {
  id: string
  device_id: string
  paypal_subscription_id: string | null
  status: 'pending' | 'active' | 'cancelled' | 'expired' | 'suspended'
  plan_id: string
  amount_jpy: number
  billing_cycle: string
  next_billing_date: string | null
  cancelled_at: string | null
  created_at: string
  updated_at: string
}

export interface License {
  id: string
  device_id: string
  is_valid: boolean
  expires_at: string | null
  last_verified_at: string
  verification_count: number
  created_at: string
  updated_at: string
}