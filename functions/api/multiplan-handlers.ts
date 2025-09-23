// ================================
// SMARTGRAMマルチプラン対応APIハンドラー
// 新しいプラン管理と使用量管理機能
// ================================

import { createClient } from '@supabase/supabase-js'

// Supabaseクライアント取得（メインファイルから移植）
function getSupabaseClient(env: any) {
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase configuration')
  }

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })
}

// ================================
// プラン管理APIハンドラー
// ================================

// プラン一覧取得
export async function handlePlansList(request: Request, env: any) {
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      }
    });
  }

  if (request.method !== 'GET') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      {
        status: 405,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      }
    );
  }

  try {
    const supabase = getSupabaseClient(env);

    // アクティブなプランのみを取得
    const { data: plans, error } = await supabase
      .from('plans')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (error) {
      console.error('プラン取得エラー:', error);
      return new Response(
        JSON.stringify({
          success: false,
          error: 'プラン情報の取得に失敗しました'
        }),
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        plans: plans || []
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      }
    );
  } catch (error) {
    console.error('プラン一覧取得エラー:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: 'サーバーエラーが発生しました'
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      }
    );
  }
}

// プランアップグレード・ダウングレード
export async function handlePlanChange(request: Request, env: any) {
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      }
    });
  }

  if (request.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      {
        status: 405,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      }
    );
  }

  try {
    const supabase = getSupabaseClient(env);
    const body = await request.json();
    const { user_id, new_plan_name, paypal_subscription_id } = body;

    if (!user_id || !new_plan_name) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'ユーザーIDと新しいプラン名が必要です'
        }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        }
      );
    }

    // ユーザーのデバイスを取得
    const { data: device, error: deviceError } = await supabase
      .from('devices')
      .select('id')
      .eq('user_id', user_id)
      .single();

    if (deviceError || !device) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'デバイスが見つかりません'
        }),
        {
          status: 404,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        }
      );
    }

    // プラン変更関数を呼び出し
    const { data: result, error: changeError } = await supabase.rpc('change_device_plan', {
      p_device_id: device.id,
      p_new_plan_name: new_plan_name,
      p_paypal_subscription_id: paypal_subscription_id
    });

    if (changeError || !result?.[0]?.success) {
      return new Response(
        JSON.stringify({
          success: false,
          error: result?.[0]?.message || 'プラン変更に失敗しました'
        }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: result[0].message,
        new_plan_id: result[0].new_plan_id
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      }
    );
  } catch (error) {
    console.error('プラン変更エラー:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: 'サーバーエラーが発生しました'
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      }
    );
  }
}

// ================================
// 使用量管理APIハンドラー
// ================================

// 使用量チェック
export async function handleUsageCheck(request: Request, env: any) {
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      }
    });
  }

  if (request.method !== 'GET' && request.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      {
        status: 405,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      }
    );
  }

  try {
    const supabase = getSupabaseClient(env);
    let device_hash: string;
    let action_type: string = 'daily_actions';

    if (request.method === 'POST') {
      const body = await request.json();
      device_hash = body.device_hash;
      action_type = body.action_type || 'daily_actions';
    } else {
      const url = new URL(request.url);
      device_hash = url.searchParams.get('device_hash') || '';
      action_type = url.searchParams.get('action_type') || 'daily_actions';
    }

    if (!device_hash) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'デバイスハッシュが必要です'
        }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        }
      );
    }

    // デバイス情報を取得
    const { data: device, error: deviceError } = await supabase
      .from('devices')
      .select('id')
      .eq('device_hash', device_hash.toUpperCase())
      .single();

    if (deviceError || !device) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'デバイスが見つかりません'
        }),
        {
          status: 404,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        }
      );
    }

    // 使用量チェック関数を呼び出し
    const { data: usageResult, error: usageError } = await supabase.rpc('check_usage_limit', {
      p_device_id: device.id,
      p_action_type: action_type
    });

    if (usageError) {
      console.error('使用量チェックエラー:', usageError);
      return new Response(
        JSON.stringify({
          success: false,
          error: '使用量チェックに失敗しました'
        }),
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        }
      );
    }

    const usage = usageResult?.[0] || {
      can_execute: false,
      current_count: 0,
      limit_count: 0,
      plan_name: 'unknown'
    };

    return new Response(
      JSON.stringify({
        success: true,
        can_execute: usage.can_execute,
        current_usage: usage.current_count,
        limit: usage.limit_count === -1 ? null : usage.limit_count,
        plan_name: usage.plan_name,
        action_type: action_type
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      }
    );
  } catch (error) {
    console.error('使用量チェックエラー:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: 'サーバーエラーが発生しました'
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      }
    );
  }
}

// 機能アクセスチェック
export async function handleFeatureCheck(request: Request, env: any) {
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      }
    });
  }

  if (request.method !== 'GET' && request.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      {
        status: 405,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      }
    );
  }

  try {
    const supabase = getSupabaseClient(env);
    let device_hash: string;
    let feature_name: string;

    if (request.method === 'POST') {
      const body = await request.json();
      device_hash = body.device_hash;
      feature_name = body.feature_name;
    } else {
      const url = new URL(request.url);
      device_hash = url.searchParams.get('device_hash') || '';
      feature_name = url.searchParams.get('feature_name') || '';
    }

    if (!device_hash || !feature_name) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'デバイスハッシュと機能名が必要です'
        }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        }
      );
    }

    // デバイスとプラン情報を統合ビューから取得
    const { data: devicePlan, error: deviceError } = await supabase
      .from('device_plan_view')
      .select('plan_name, plan_features, device_hash')
      .eq('device_hash', device_hash.toUpperCase())
      .single();

    if (deviceError || !devicePlan) {
      return new Response(
        JSON.stringify({
          success: false,
          has_access: false,
          error: 'デバイスまたはプランが見つかりません'
        }),
        {
          status: 404,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        }
      );
    }

    // 機能アクセス権限をチェック
    const features = devicePlan.plan_features || {};
    const hasAccess = features[feature_name] === true;

    return new Response(
      JSON.stringify({
        success: true,
        has_access: hasAccess,
        plan_name: devicePlan.plan_name,
        feature_name: feature_name,
        all_features: features
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      }
    );
  } catch (error) {
    console.error('機能チェックエラー:', error);
    return new Response(
      JSON.stringify({
        success: false,
        has_access: false,
        error: 'サーバーエラーが発生しました'
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      }
    );
  }
}

// 使用量インクリメント
export async function handleUsageIncrement(request: Request, env: any) {
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      }
    });
  }

  if (request.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      {
        status: 405,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      }
    );
  }

  try {
    const supabase = getSupabaseClient(env);
    const body = await request.json();
    const { device_hash, action_type = 'daily_actions', increment = 1 } = body;

    if (!device_hash) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'デバイスハッシュが必要です'
        }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        }
      );
    }

    // デバイス情報を取得
    const { data: device, error: deviceError } = await supabase
      .from('devices')
      .select('id')
      .eq('device_hash', device_hash.toUpperCase())
      .single();

    if (deviceError || !device) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'デバイスが見つかりません'
        }),
        {
          status: 404,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        }
      );
    }

    // 使用量インクリメント関数を呼び出し
    const { data: incrementResult, error: incrementError } = await supabase.rpc('increment_usage', {
      p_device_id: device.id,
      p_action_type: action_type,
      p_increment: increment
    });

    if (incrementError) {
      console.error('使用量インクリメントエラー:', incrementError);
      return new Response(
        JSON.stringify({
          success: false,
          error: '使用量更新に失敗しました'
        }),
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        }
      );
    }

    const result = incrementResult?.[0] || {
      success: false,
      new_count: 0,
      limit_count: 0,
      exceeded: false
    };

    return new Response(
      JSON.stringify({
        success: result.success,
        new_count: result.new_count,
        limit: result.limit_count === -1 ? null : result.limit_count,
        exceeded: result.exceeded,
        action_type: action_type
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      }
    );
  } catch (error) {
    console.error('使用量インクリメントエラー:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: 'サーバーエラーが発生しました'
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      }
    );
  }
}