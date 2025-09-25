import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://bsujceqmhvpltedjkvum.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJzdWpjZXFtaHZwbHRlZGprdnVtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjY3MTg0NDcsImV4cCI6MjA0MjI5NDQ0N30.eOjI7gqPHBIE7aWO1UfO4g3bxgNLZBBB_3xWLc8FU9M';

// Stripe価格ID設定
const STRIPE_PRICE_IDS = {
  'price_starter_monthly': 'price_1SB9w0DE82UMk94OidHeEg6K', // STARTER
  'price_pro_monthly': 'price_1SBA6mDE82UMk94Ocy7DLtQ2',     // PRO月額
  'price_max_monthly': 'price_1SBAB0DE82UMk94OMnNOgUFS'      // MAX
};

const PLAN_DETAILS = {
  'starter': { name: 'STARTER', price: 2980 },
  'pro': { name: 'PRO', price: 6980 },
  'max': { name: 'MAX', price: 15800 }
};

export async function onRequestPOST(context: any) {
  try {
    const { request } = context;
    const { priceId, planId } = await request.json();

    if (!priceId || !planId) {
      return new Response(JSON.stringify({ error: '必要なパラメータが不足しています' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 認証確認
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: '認証が必要です' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: authHeader
        }
      }
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'ユーザー認証に失敗しました' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // デバイス情報を取得
    const { data: device, error: deviceError } = await supabase
      .from('devices')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (deviceError || !device) {
      return new Response(JSON.stringify({ error: 'デバイス情報が見つかりません' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Stripe設定（環境変数から取得）
    const stripeSecretKey = context.env?.STRIPE_SECRET_KEY;
    if (!stripeSecretKey) {
      console.error('Stripe secret key not configured');
      return new Response(JSON.stringify({ error: 'Stripe設定エラー' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 実際のStripe価格ID
    const actualPriceId = STRIPE_PRICE_IDS[priceId as keyof typeof STRIPE_PRICE_IDS];
    if (!actualPriceId) {
      return new Response(JSON.stringify({ error: '無効なプランIDです' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const planDetails = PLAN_DETAILS[planId as keyof typeof PLAN_DETAILS];

    // Stripeチェックアウトセッション作成
    const checkoutSession = {
      payment_method_types: ['card'],
      mode: 'subscription',
      customer_email: user.email,
      line_items: [
        {
          price: actualPriceId,
          quantity: 1,
        },
      ],
      success_url: `${new URL(request.url).origin}/dashboard?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${new URL(request.url).origin}/dashboard?canceled=true`,
      metadata: {
        user_id: user.id,
        device_id: device.id,
        device_hash: device.device_hash,
        plan_id: planId,
        plan_name: planDetails.name
      },
      subscription_data: {
        metadata: {
          user_id: user.id,
          device_id: device.id,
          device_hash: device.device_hash,
          plan_id: planId
        }
      }
    };

    // Stripe API呼び出し
    const stripeResponse = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${stripeSecretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        'payment_method_types[0]': 'card',
        'mode': 'subscription',
        'customer_email': user.email || '',
        'line_items[0][price]': actualPriceId,
        'line_items[0][quantity]': '1',
        'success_url': `${new URL(request.url).origin}/dashboard?success=true&session_id={CHECKOUT_SESSION_ID}`,
        'cancel_url': `${new URL(request.url).origin}/dashboard?canceled=true`,
        'metadata[user_id]': user.id,
        'metadata[device_id]': device.id,
        'metadata[device_hash]': device.device_hash,
        'metadata[plan_id]': planId,
        'metadata[plan_name]': planDetails.name,
        'subscription_data[metadata][user_id]': user.id,
        'subscription_data[metadata][device_id]': device.id,
        'subscription_data[metadata][device_hash]': device.device_hash,
        'subscription_data[metadata][plan_id]': planId
      })
    });

    if (!stripeResponse.ok) {
      const errorText = await stripeResponse.text();
      console.error('Stripe API error:', errorText);
      return new Response(JSON.stringify({ error: 'Stripe決済セッション作成に失敗しました' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const session = await stripeResponse.json();

    return new Response(JSON.stringify({ sessionId: session.id }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('Checkout session creation error:', error);
    return new Response(JSON.stringify({ error: 'サーバーエラーが発生しました' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}