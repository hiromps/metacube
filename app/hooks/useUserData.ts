import { useState, useEffect, useCallback } from 'react';
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

  const fetchUserData = useCallback(async () => {
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

      // Calculate trial days remaining - only if user has an active subscription
      let trialDaysRemaining = null;
      let isTrialActive = false;
      const isSubscriptionActive = subscription?.status === 'active';

      // 体験期間は有料契約が開始されたときのみ計算される
      if (subscription && subscription.status === 'active' && device && device.trial_ends_at) {
        const trialEndDate = new Date(device.trial_ends_at);
        const now = new Date();
        const diffTime = trialEndDate.getTime() - now.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays > 0) {
          trialDaysRemaining = diffDays;
          isTrialActive = true;
        }
      }

      // Get plan information if device exists
      let plan = null;
      if (device) {
        // Simplified plan info for now - use default SMARTGRAM plan
        plan = {
          id: 'smartgram-basic',
          name: 'smartgram',
          display_name: 'STARTER',
          price: 2980,
          billing_cycle: 'monthly',
          features: {
            timeline: true,
            dm: true,
            story: true,
            follow: true
          },
          limitations: {
            daily_actions: 1000,
            concurrent_sessions: 1
          }
        };
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
  }, []);

  useEffect(() => {
    fetchUserData();
  }, [fetchUserData]);

  const refetch = useCallback(() => {
    fetchUserData();
  }, [fetchUserData]);

  return {
    userData,
    loading,
    error,
    refetch
  };
}