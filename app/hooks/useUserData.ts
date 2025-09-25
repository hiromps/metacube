import { useState, useEffect, useCallback, useRef } from 'react';
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
  const fetchingRef = useRef(false);

  const fetchUserData = useCallback(async (forceRefresh = false) => {
    try {
      console.log('🔄 fetchUserData: Starting data fetch, forceRefresh:', forceRefresh);

      // Prevent multiple simultaneous calls unless forcing refresh
      if (fetchingRef.current && !forceRefresh) {
        console.log('🔄 fetchUserData: Already fetching, skipping...');
        return;
      }

      fetchingRef.current = true;
      setLoading(true);
      setError(null);

      // Get current user
      console.log('🔄 fetchUserData: Getting current user from Supabase...');
      const { data: { user }, error: userError } = await supabase.auth.getUser();

      if (userError) {
        console.error('Auth error:', userError);
        throw new Error(`認証エラー: ${userError.message}`);
      }

      if (!user) {
        console.error('🚫 fetchUserData: No user found in session');
        throw new Error('ユーザーが見つかりません');
      }

      console.log('✅ fetchUserData: User found:', user.email, 'ID:', user.id);

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

      // Get plan information from subscription with DB query
      let plan = null;
      if (device && subscription) {
        try {
          // Map old plan IDs to new plan IDs
          const planIdMap: { [key: string]: string } = {
            'smartgram_monthly_2980': 'starter',
            'smartgram_monthly_8800': 'pro',
            'smartgram_monthly_15000': 'max',
            'starter': 'starter',
            'pro': 'pro',
            'max': 'max'
          };

          const mappedPlanId = planIdMap[subscription.plan_id] || 'starter';

          // Query plans table using the correct ID column
          const { data: planData, error: planError } = await supabase
            .from('plans')
            .select('*')
            .eq('id', mappedPlanId)
            .eq('is_active', true)
            .single();

          if (planData && !planError) {
            // Convert database plan to our interface format
            plan = {
              id: planData.id,
              name: planData.id,  // Use id as name for consistency
              display_name: planData.name, // Database 'name' field is display name
              price: planData.price_jpy,
              billing_cycle: 'monthly',
              features: planData.features ? planData.features.reduce((acc: Record<string, boolean>, feature: string) => {
                acc[feature] = true;
                return acc;
              }, {}) : {},
              limitations: {
                support: planData.priority_support ? '24時間電話サポート' : 'LINEサポート30日間',
                trial_days: 3,
                max_automation_hours: planData.max_automation_hours
              }
            };
          } else {
            console.warn('プラン情報の取得に失敗:', planError);
            // Fallback to basic plan structure
            const fallbackPlans = {
              'starter': { name: 'STARTER', price: 2980, features: ['timeline.lua', 'hashtaglike.lua'] },
              'pro': { name: 'PRO', price: 6980, features: ['timeline.lua', 'hashtaglike.lua', 'follow.lua', 'unfollow.lua'] },
              'max': { name: 'MAX', price: 15800, features: ['timeline.lua', 'hashtaglike.lua', 'follow.lua', 'unfollow.lua', 'activelike.lua'] }
            };

            const fallbackPlan = fallbackPlans[mappedPlanId as keyof typeof fallbackPlans] || fallbackPlans['starter'];
            plan = {
              id: mappedPlanId,
              name: mappedPlanId,
              display_name: fallbackPlan.name,
              price: fallbackPlan.price,
              billing_cycle: 'monthly',
              features: fallbackPlan.features.reduce((acc: Record<string, boolean>, feature: string) => {
                acc[feature] = true;
                return acc;
              }, {}),
              limitations: {
                support: mappedPlanId === 'starter' ? 'LINEサポート30日間' : '24時間電話サポート',
                trial_days: 3
              }
            };
          }
        } catch (error) {
          console.error('プラン情報の取得でエラー:', error);
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

      const finalUserData = {
        email: user.email || '',
        device,
        subscription,
        plan,
        trialDaysRemaining,
        isTrialActive,
        isSubscriptionActive
      };

      console.log('✅ fetchUserData: Setting user data:', {
        email: finalUserData.email,
        hasDevice: !!finalUserData.device,
        hasSubscription: !!finalUserData.subscription,
        hasPlan: !!finalUserData.plan,
        isTrialActive: finalUserData.isTrialActive,
        isSubscriptionActive: finalUserData.isSubscriptionActive
      });

      setUserData(finalUserData);

    } catch (err) {
      console.error('ユーザーデータの取得エラー:', err);
      const errorMessage = err instanceof Error ? err.message : 'データの取得に失敗しました';
      setError(errorMessage);
    } finally {
      fetchingRef.current = false;
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty dependencies to prevent infinite re-renders

  useEffect(() => {
    let mounted = true;
    let hasLoadedInitialData = false;

    const loadData = async () => {
      if (mounted && !hasLoadedInitialData) {
        console.log('🔄 useUserData: Loading initial user data...');
        await fetchUserData();
        hasLoadedInitialData = true;
      }
    };

    loadData();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('🔄 Auth state changed:', event, session ? 'Session exists' : 'No session');
      if (mounted) {
        // Only reload on meaningful auth changes, not on initial load
        if (event === 'SIGNED_IN' && hasLoadedInitialData) {
          console.log('🔄 User signed in, reloading data...');
          setTimeout(() => fetchUserData(true), 500); // Delay to ensure session is set
        } else if (event === 'TOKEN_REFRESHED' && hasLoadedInitialData) {
          // Don't reload on token refresh as data shouldn't change
          console.log('🔄 Token refreshed, skipping data reload');
        } else if (event === 'SIGNED_OUT') {
          console.log('🔄 User signed out, clearing data...');
          setUserData(null);
          setError(null);
          hasLoadedInitialData = false;
        }
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty dependency array to prevent re-runs

  const refetch = useCallback((forceRefresh = true) => {
    return fetchUserData(forceRefresh);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Keep refetch stable to prevent effect re-runs

  return {
    userData,
    loading,
    error,
    refetch
  };
}