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

      // Prevent multiple simultaneous calls
      if (loading) {
        return;
      }

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

      // Get plan information from subscription with DB fallback
      let plan = null;
      if (device && subscription) {
        try {
          // Try to get plan from new plans table first
          const { data: planData, error: planError } = await supabase
            .from('plans')
            .select('*')
            .eq('name', subscription.plan_id)
            .eq('is_active', true)
            .single();

          if (planData && !planError) {
            // Use DB plan data
            plan = {
              id: planData.id,
              name: planData.name,
              display_name: planData.display_name,
              price: planData.price_jpy || planData.price,
              billing_cycle: planData.billing_cycle,
              features: planData.features || {},
              limitations: planData.limitations || {}
            };
          } else {
            // Fallback to hardcoded plan mapping
            const planMap = {
              'starter': { name: 'starter', display_name: 'STARTER', price: 2980 },
              'pro': { name: 'pro', display_name: 'PRO', price: 6980 },
              'max': { name: 'max', display_name: 'MAX', price: 15800 },
              'smartgram_monthly_2980': { name: 'starter', display_name: 'STARTER', price: 2980 },
              'smartgram_monthly_8800': { name: 'pro', display_name: 'PRO', price: 6980 },
              'smartgram_monthly_15000': { name: 'max', display_name: 'MAX', price: 15800 }
            };

            const fallbackPlan = planMap[subscription.plan_id as keyof typeof planMap] || planMap['starter'];
            plan = {
              id: subscription.plan_id,
              name: fallbackPlan.name,
              display_name: fallbackPlan.display_name,
              price: fallbackPlan.price,
              billing_cycle: 'monthly',
              features: {
                'timeline.lua': true,  // タイムライン自動いいね
                'hashtaglike.lua': true, // ハッシュタグいいね
                'follow.lua': fallbackPlan.name !== 'starter', // 自動フォロー
                'unfollow.lua': fallbackPlan.name !== 'starter', // 自動アンフォロー
                'activelike.lua': fallbackPlan.name === 'max' // アクティブユーザーいいね
              },
              limitations: {
                support: fallbackPlan.name === 'starter' ? 'LINEサポート30日間' :
                        fallbackPlan.name === 'pro' ? 'LINEサポート90日間' :
                        '24時間電話サポート',
                trial_days: 3
              }
            };
          }
        } catch (error) {
          console.warn('プラン情報の取得でエラー:', error);
          // エラー時はデフォルトのスターター
          plan = {
            id: 'starter',
            name: 'starter',
            display_name: 'STARTER',
            price: 2980,
            billing_cycle: 'monthly',
            features: { 'timeline.lua': true, 'hashtaglike.lua': true },
            limitations: { support: 'LINEサポート30日間', trial_days: 3 }
          };
        }

        console.log('Plan information loaded:', plan);
      } else if (device && !subscription) {
        // Device exists but no active subscription - show trial plan
        plan = {
          id: 'trial',
          name: 'trial',
          display_name: '無料体験',
          price: 0,
          billing_cycle: 'trial',
          features: {
            'timeline.lua': true,  // タイムライン自動いいね
            'hashtaglike.lua': true, // ハッシュタグいいね
            'follow.lua': false,
            'unfollow.lua': false,
            'activelike.lua': false
          },
          limitations: {
            trial_days: 3  // 3日間体験
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
      // Don't set error for plan-related failures, use fallback instead
      const errorMessage = err instanceof Error ? err.message : 'データの取得に失敗しました';
      if (!errorMessage.includes('プラン') && !errorMessage.includes('plans')) {
        setError(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty dependencies to prevent infinite re-renders

  useEffect(() => {
    // Only call once on mount
    let mounted = true;

    const loadData = async () => {
      if (mounted) {
        await fetchUserData();
      }
    };

    loadData();

    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty dependency array to prevent re-runs

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