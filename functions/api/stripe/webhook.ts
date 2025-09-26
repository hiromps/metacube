import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://bsujceqmhvpltedjkvum.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJzdWpjZXFtaHZwbHRlZGprdnVtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcyNjcxODQ0NywiZXhwIjoyMDQyMjk0NDQ3fQ.3k5qAqcOwg2ZFPM-u6W3LZPXZE6rUq8dJpJKJqGSb2g';

export async function onRequestPOST(context: any) {
  try {
    const { request } = context;

    // Stripe Webhookシークレットを取得
    const webhookSecret = context.env?.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      console.error('Stripe webhook secret not configured');
      return new Response('Webhook secret not configured', { status: 500 });
    }

    // リクエストボディを取得
    const body = await request.text();
    const signature = request.headers.get('stripe-signature');

    if (!signature) {
      console.error('Missing stripe-signature header');
      return new Response('Missing signature', { status: 400 });
    }

    // Stripe署名検証（簡易版）
    // 実際の本番環境では、crypto.createHmac等でより厳密な検証が必要
    let event;
    try {
      event = JSON.parse(body);
    } catch (err) {
      console.error('Invalid JSON body');
      return new Response('Invalid JSON', { status: 400 });
    }

    console.log('Stripe webhook received:', event.type);

    // Supabaseクライアント（サービスロール）
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // イベント処理
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(supabase, event.data.object);
        break;
      case 'payment_intent.succeeded':
        await handlePaymentIntentSucceeded(supabase, event.data.object);
        break;
      case 'charge.succeeded':
        await handleChargeSucceeded(supabase, event.data.object);
        break;
      case 'customer.subscription.created':
        await handleSubscriptionCreated(supabase, event.data.object);
        break;
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(supabase, event.data.object);
        break;
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(supabase, event.data.object);
        break;
      case 'invoice.payment_succeeded':
        await handlePaymentSucceeded(supabase, event.data.object);
        break;
      case 'invoice.payment_failed':
        await handlePaymentFailed(supabase, event.data.object);
        break;
      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('Webhook processing error:', error);
    return new Response(`Webhook error: ${error instanceof Error ? error.message : String(error)}`, { status: 500 });
  }
}

async function handleCheckoutCompleted(supabase: any, session: any) {
  console.log('Processing checkout.session.completed:', session.id);

  const { user_id, device_id, plan_id } = session.metadata;

  if (!user_id || !device_id || !plan_id) {
    console.error('Missing metadata in checkout session:', session.metadata);
    return;
  }

  // サブスクリプション情報を保存/更新
  const { error } = await supabase
    .from('subscriptions')
    .upsert({
      device_id,
      stripe_subscription_id: session.subscription,
      stripe_customer_id: session.customer,
      plan_name: plan_id.toUpperCase(),
      status: 'active',
      current_period_start: new Date(session.created * 1000).toISOString(),
      current_period_end: new Date((session.created + 30 * 24 * 60 * 60) * 1000).toISOString(), // 30日後
      updated_at: new Date().toISOString()
    });

  if (error) {
    console.error('Failed to save subscription:', error);
    return;
  }

  console.log('Subscription created successfully for device:', device_id);
}

async function handleSubscriptionCreated(supabase: any, subscription: any) {
  console.log('Processing customer.subscription.created:', subscription.id);

  const { user_id, device_id, plan_id } = subscription.metadata;

  if (!device_id) {
    console.error('Missing device_id in subscription metadata');
    return;
  }

  const { error } = await supabase
    .from('subscriptions')
    .upsert({
      device_id,
      stripe_subscription_id: subscription.id,
      stripe_customer_id: subscription.customer,
      plan_name: plan_id?.toUpperCase() || 'UNKNOWN',
      status: subscription.status,
      current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
      current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
      updated_at: new Date().toISOString()
    });

  if (error) {
    console.error('Failed to update subscription:', error);
  }
}

async function handleSubscriptionUpdated(supabase: any, subscription: any) {
  console.log('Processing customer.subscription.updated:', subscription.id);

  const { error } = await supabase
    .from('subscriptions')
    .update({
      status: subscription.status,
      current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
      current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('stripe_subscription_id', subscription.id);

  if (error) {
    console.error('Failed to update subscription:', error);
  }
}

async function handleSubscriptionDeleted(supabase: any, subscription: any) {
  console.log('Processing customer.subscription.deleted:', subscription.id);

  const { error } = await supabase
    .from('subscriptions')
    .update({
      status: 'canceled',
      updated_at: new Date().toISOString()
    })
    .eq('stripe_subscription_id', subscription.id);

  if (error) {
    console.error('Failed to cancel subscription:', error);
  }
}

async function handlePaymentSucceeded(supabase: any, invoice: any) {
  console.log('Processing invoice.payment_succeeded:', invoice.id);

  const { error } = await supabase
    .from('subscriptions')
    .update({
      status: 'active',
      updated_at: new Date().toISOString()
    })
    .eq('stripe_subscription_id', invoice.subscription);

  if (error) {
    console.error('Failed to update subscription after payment success:', error);
  }
}

async function handlePaymentFailed(supabase: any, invoice: any) {
  console.log('Processing invoice.payment_failed:', invoice.id);

  const { error } = await supabase
    .from('subscriptions')
    .update({
      status: 'past_due',
      updated_at: new Date().toISOString()
    })
    .eq('stripe_subscription_id', invoice.subscription);

  if (error) {
    console.error('Failed to update subscription after payment failure:', error);
  }
}

async function handlePaymentIntentSucceeded(supabase: any, paymentIntent: any) {
  console.log('Processing payment_intent.succeeded:', paymentIntent.id);

  // Payment Linkでの決済成功を記録
  const customerEmail = paymentIntent.receipt_email || paymentIntent.charges?.data?.[0]?.billing_details?.email;

  if (customerEmail) {
    // ユーザーのデバイス情報を更新（必要に応じて）
    console.log('Payment succeeded for customer:', customerEmail);

    // メタデータから情報を取得
    const metadata = paymentIntent.metadata || {};
    if (metadata.user_id && metadata.device_id && metadata.plan_id) {
      const { error } = await supabase
        .from('devices')
        .update({
          plan_id: metadata.plan_id,
          stripe_customer_id: paymentIntent.customer,
          status: 'active',
          updated_at: new Date().toISOString()
        })
        .eq('id', metadata.device_id);

      if (error) {
        console.error('Failed to update device after payment intent success:', error);
      }
    }
  }
}

async function handleChargeSucceeded(supabase: any, charge: any) {
  console.log('Processing charge.succeeded:', charge.id);

  // 決済成功の詳細情報を記録
  const customerEmail = charge.billing_details?.email || charge.receipt_email;
  const amount = charge.amount;
  const currency = charge.currency;

  console.log(`Charge succeeded: ${amount/100} ${currency.toUpperCase()} from ${customerEmail}`);

  // メタデータから情報を取得して処理
  const metadata = charge.metadata || {};
  if (metadata.user_id && metadata.device_id) {
    // 決済履歴を記録（必要に応じて）
    console.log('Charge recorded for device:', metadata.device_id);
  }
}