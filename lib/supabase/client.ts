import { createClient } from '@supabase/supabase-js'
import { supabaseConfig } from './config'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || supabaseConfig.url
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || supabaseConfig.anonKey
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || supabaseConfig.serviceRoleKey

// Debug environment variables
if (typeof window !== 'undefined') {
  console.log('Supabase URL:', supabaseUrl)
  console.log('Supabase Anon Key exists:', !!supabaseAnonKey)
  console.log('Using fallback config:', !process.env.NEXT_PUBLIC_SUPABASE_URL)
}

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Please check your .env.local file.')
}

// Client for browser/frontend
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Admin client for server-side operations
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

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