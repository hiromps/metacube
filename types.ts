// Supabase types generated from the database schema

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          email: string
          created_at: string
        }
        Insert: {
          id?: string
          email: string
          created_at?: string
        }
        Update: {
          id?: string
          email?: string
          created_at?: string
        }
      }
      devices: {
        Row: {
          id: string
          user_id: string
          device_hash: string
          status: 'trial' | 'active' | 'expired' | 'registered'
          trial_ends_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          device_hash: string
          status?: 'trial' | 'active' | 'expired' | 'registered'
          trial_ends_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          device_hash?: string
          status?: 'trial' | 'active' | 'expired' | 'registered'
          trial_ends_at?: string | null
          created_at?: string
        }
      }
      subscriptions: {
        Row: {
          id: string
          device_id: string
          plan_id: string
          paypal_subscription_id: string | null
          status: 'active' | 'cancelled' | 'expired'
          created_at: string
        }
        Insert: {
          id?: string
          device_id: string
          plan_id: string
          paypal_subscription_id?: string | null
          status?: 'active' | 'cancelled' | 'expired'
          created_at?: string
        }
        Update: {
          id?: string
          device_id?: string
          plan_id?: string
          paypal_subscription_id?: string | null
          status?: 'active' | 'cancelled' | 'expired'
          created_at?: string
        }
      }
      plans: {
        Row: {
          id: string
          name: string
          display_name: string
          description: string | null
          price: number
          billing_cycle: string
          features: Record<string, boolean>
          limitations: Record<string, any>
          is_active: boolean
          sort_order: number
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          display_name: string
          description?: string | null
          price: number
          billing_cycle?: string
          features?: Record<string, boolean>
          limitations?: Record<string, any>
          is_active?: boolean
          sort_order?: number
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          display_name?: string
          description?: string | null
          price?: number
          billing_cycle?: string
          features?: Record<string, boolean>
          limitations?: Record<string, any>
          is_active?: boolean
          sort_order?: number
          created_at?: string
        }
      }
    }
  }
}