import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';

export interface UserDevice {
  id: string;
  device_hash: string;
  status: 'trial' | 'active' | 'expired';
  trial_ends_at: string | null;
  created_at: string;
}

export interface UserSubscription {
  id: string;
  paypal_subscription_id: string | null;
  status: 'active' | 'cancelled' | 'expired';
  created_at: string;
}

export interface PlanInfo {
  id: string;
  name: string;
  display_name: string;
  price: number;
  billing_cycle: string;
  features: Record<string, boolean>;
  limitations: Record<string, any>;
}

export interface UserData {
  email: string;
  device: UserDevice | null;
  subscription: UserSubscription | null;
  plan: PlanInfo | null;
  trialDaysRemaining: number | null;
  isTrialActive: boolean;
  isSubscriptionActive: boolean;
}

export function useUserData() {
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchUserData() {
      try {
        setLoading(true);
        setError(null);

        // Get current user
        const { data: { user }, error: userError } = await supabase.auth.getUser();

        if (userError) {
          console.error('Auth error:', userError);
          throw new Error(`認証エラー: ${userError.message}`);
        }

        if (!user) {
          console.error('No user found in session');
          throw new Error('ユーザーが見つかりません');
        }

        console.log('User found:', user.email);

        // Get user's device
        console.log('Fetching device for user:', user.id);
        const { data: device, error: deviceError } = await supabase
          .from('devices')
          .select('*')
          .eq('user_id', user.id)
          .single();

        if (deviceError && deviceError.code !== 'PGRST116') { // PGRST116 = no rows returned
          console.error('Device fetch error:', deviceError);
          throw new Error(`デバイス情報の取得に失敗しました: ${deviceError.message}`);
        }

        console.log('Device data:', device);

        // Get subscription if device exists
        let subscription = null;
        if (device) {
          const { data: sub, error: subError } = await supabase
            .from('subscriptions')
            .select('*')
            .eq('device_id', device.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

          if (subError && subError.code !== 'PGRST116') {
            console.warn('サブスクリプション情報の取得に失敗:', subError);
          } else if (sub) {
            subscription = sub;
          }
        }

        // Calculate trial days remaining
        let trialDaysRemaining = null;
        let isTrialActive = false;
        if (device && device.trial_ends_at) {
          const trialEndDate = new Date(device.trial_ends_at);
          const now = new Date();
          const diffTime = trialEndDate.getTime() - now.getTime();
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

          if (diffDays > 0) {
            trialDaysRemaining = diffDays;
            isTrialActive = true;
          }
        }

        const isSubscriptionActive = subscription?.status === 'active';

        // Get plan information if device exists
        let plan = null;
        if (device) {
          const { data: devicePlan, error: planError } = await supabase
            .from('device_plan_view')
            .select('plan_id, plan_name, plan_display_name, plan_price, plan_features, plan_limitations')
            .eq('device_id', device.id)
            .single();

          if (planError && planError.code !== 'PGRST116') {
            console.warn('プラン情報の取得に失敗:', planError);
          } else if (devicePlan) {
            plan = {
              id: devicePlan.plan_id,
              name: devicePlan.plan_name,
              display_name: devicePlan.plan_display_name,
              price: devicePlan.plan_price,
              billing_cycle: 'monthly', // デフォルト値、後で拡張可能
              features: devicePlan.plan_features || {},
              limitations: devicePlan.plan_limitations || {}
            };
          }
        }

        setUserData({
          email: user.email || '',
          device,
          subscription,
          plan,
          trialDaysRemaining,
          isTrialActive,
          isSubscriptionActive
        });

      } catch (err) {
        console.error('ユーザーデータの取得エラー:', err);
        setError(err instanceof Error ? err.message : 'データの取得に失敗しました');
      } finally {
        setLoading(false);
      }
    }

    fetchUserData();
  }, []);

  const refetch = () => {
    setLoading(true);
    setError(null);
    // Re-trigger the useEffect
    setUserData(null);
  };

  return {
    userData,
    loading,
    error,
    refetch
  };
}