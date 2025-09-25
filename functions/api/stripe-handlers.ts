import { createClient } from '@supabase/supabase-js'

// Initialize Supabase client for Cloudflare Functions
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

// Stripe Checkout Session作成
export async function handleStripeCreateCheckoutSession(request: Request, env: any) {
  try {
    const { plan_id, device_hash, user_email } = await request.json()

    if (!plan_id || !device_hash) {
      return new Response(JSON.stringify({ error: 'プランIDとデバイスハッシュが必要です' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const supabase = getSupabaseClient(env)

    // プラン情報を取得
    const { data: plan, error: planError } = await supabase
      .from('plans')
      .select('*')
      .eq('name', plan_id)
      .single()

    if (planError || !plan) {
      return new Response(JSON.stringify({ error: 'プランが見つかりません' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // デバイス情報を取得
    const { data: device, error: deviceError } = await supabase
      .from('devices')
      .select('*')
      .eq('device_hash', device_hash)
      .single()

    if (deviceError || !device) {
      return new Response(JSON.stringify({ error: 'デバイスが見つかりません' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Stripe価格IDを取得
    const priceId = plan.stripe_price_id_monthly
    if (!priceId) {
      return new Response(JSON.stringify({ error: 'Stripe価格IDが設定されていません' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const stripeSecretKey = env.STRIPE_SECRET_KEY
    if (!stripeSecretKey) {
      return new Response(JSON.stringify({ error: 'Stripe設定エラー' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Stripe Checkout Session作成
    const checkoutData = {
      mode: 'subscription',
      line_items: [{
        price: priceId,
        quantity: 1
      }],
      success_url: `${env.NEXT_PUBLIC_SITE_URL || 'https://smartgram.jp'}/dashboard?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${env.NEXT_PUBLIC_SITE_URL || 'https://smartgram.jp'}/dashboard?canceled=true`,
      client_reference_id: device.id,
      customer_email: user_email || undefined,
      metadata: {
        device_id: device.id,
        device_hash: device_hash,
        plan_id: plan_id
      },
      subscription_data: {
        metadata: {
          device_id: device.id,
          device_hash: device_hash,
          plan_id: plan_id
        },
        trial_period_days: 3
      }
    }

    const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${stripeSecretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams(checkoutData as any).toString()
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Stripe API error:', errorText)
      return new Response(JSON.stringify({ error: 'Stripe決済セッション作成に失敗しました' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const session = await response.json()

    return new Response(JSON.stringify({
      success: true,
      checkout_url: session.url,
      session_id: session.id
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Checkout session creation error:', error)
    return new Response(JSON.stringify({ error: '決済セッション作成エラー' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// Stripe Webhook処理
export async function handleStripeWebhook(request: Request, env: any) {
  try {
    const body = await request.text()
    const signature = request.headers.get('stripe-signature')

    if (!signature) {
      return new Response('Missing stripe-signature header', { status: 400 })
    }

    // 実際の本番環境では署名検証を行う
    let event
    try {
      event = JSON.parse(body)
    } catch (error) {
      return new Response('Invalid JSON', { status: 400 })
    }

    const supabase = getSupabaseClient(env)

    // イベントをログに記録
    await supabase.from('stripe_webhook_events').insert({
      stripe_event_id: event.id,
      event_type: event.type,
      data: event.data,
      processed: false
    })

    console.log('Stripe webhook received:', event.type)

    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutSessionCompleted(event.data.object, supabase)
        break

      case 'customer.subscription.created':
        await handleSubscriptionCreated(event.data.object, supabase)
        break

      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object, supabase)
        break

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object, supabase)
        break

      case 'invoice.payment_succeeded':
        await handleInvoicePaymentSucceeded(event.data.object, supabase)
        break

      case 'invoice.payment_failed':
        await handleInvoicePaymentFailed(event.data.object, supabase)
        break

      default:
        console.log(`Unhandled event type: ${event.type}`)
    }

    // イベントを処理済みにマーク
    await supabase
      .from('stripe_webhook_events')
      .update({
        processed: true,
        processed_at: new Date().toISOString()
      })
      .eq('stripe_event_id', event.id)

    return new Response('OK', { status: 200 })

  } catch (error) {
    console.error('Webhook processing error:', error)
    return new Response('Webhook processing error', { status: 500 })
  }
}

// チェックアウトセッション完了処理
async function handleCheckoutSessionCompleted(session: any, supabase: any) {
  const deviceId = session.metadata?.device_id
  const planId = session.metadata?.plan_id

  if (!deviceId || !planId) {
    console.error('Missing metadata in checkout session')
    return
  }

  // サブスクリプション作成または更新
  const { error } = await supabase
    .from('subscriptions')
    .upsert({
      device_id: deviceId,
      stripe_subscription_id: session.subscription,
      stripe_customer_id: session.customer,
      plan_id: planId,
      status: 'active',
      provider: 'stripe',
      next_billing_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30日後
    }, {
      onConflict: 'device_id'
    })

  if (error) {
    console.error('Error creating subscription:', error)
    return
  }

  // デバイスステータスとプラン情報を更新
  await supabase
    .from('devices')
    .update({
      status: 'active',
      plan_id: planId  // 現在のプランIDを保存
    })
    .eq('id', deviceId)

  console.log('Checkout session completed for device:', deviceId)
}

// サブスクリプション作成処理
async function handleSubscriptionCreated(subscription: any, supabase: any) {
  const deviceId = subscription.metadata?.device_id
  const planId = subscription.metadata?.plan_id

  if (!deviceId) return

  // サブスクリプション情報を更新
  await supabase
    .from('subscriptions')
    .upsert({
      device_id: deviceId,
      stripe_subscription_id: subscription.id,
      stripe_customer_id: subscription.customer,
      plan_id: planId || 'starter',
      status: subscription.status,
      provider: 'stripe',
      next_billing_date: new Date(subscription.current_period_end * 1000).toISOString()
    }, {
      onConflict: 'device_id'
    })

  // デバイスのプラン情報も更新
  await supabase
    .from('devices')
    .update({
      status: 'active',
      plan_id: planId || 'starter'
    })
    .eq('id', deviceId)

  console.log('Subscription created for device:', deviceId)
}

// サブスクリプション更新処理
async function handleSubscriptionUpdated(subscription: any, supabase: any) {
  const planId = subscription.metadata?.plan_id

  // サブスクリプション情報を更新
  const { data: sub } = await supabase
    .from('subscriptions')
    .update({
      status: subscription.status,
      next_billing_date: new Date(subscription.current_period_end * 1000).toISOString(),
      plan_id: planId || undefined
    })
    .eq('stripe_subscription_id', subscription.id)
    .select('device_id')
    .single()

  // デバイスのステータスとプラン情報も更新
  if (sub?.device_id) {
    const deviceStatus = subscription.status === 'active' || subscription.status === 'trialing' ? 'active' : 'expired'
    await supabase
      .from('devices')
      .update({
        status: deviceStatus,
        plan_id: planId || undefined
      })
      .eq('id', sub.device_id)
  }

  console.log('Subscription updated:', subscription.id)
}

// サブスクリプション削除処理
async function handleSubscriptionDeleted(subscription: any, supabase: any) {
  // サブスクリプションを無効化
  const { data: sub } = await supabase
    .from('subscriptions')
    .update({ status: 'cancelled' })
    .eq('stripe_subscription_id', subscription.id)
    .select('device_id')
    .single()

  if (sub?.device_id) {
    // デバイスステータスを期限切れに変更し、プラン情報をクリア
    await supabase
      .from('devices')
      .update({
        status: 'expired',
        plan_id: null  // プラン情報をクリア
      })
      .eq('id', sub.device_id)
  }

  console.log('Subscription deleted:', subscription.id)
}

// 支払い成功処理
async function handleInvoicePaymentSucceeded(invoice: any, supabase: any) {
  if (!invoice.subscription) return

  // サブスクリプションをアクティブに更新
  const { data: sub } = await supabase
    .from('subscriptions')
    .update({
      status: 'active',
      next_billing_date: new Date(invoice.period_end * 1000).toISOString()
    })
    .eq('stripe_subscription_id', invoice.subscription)
    .select('device_id')
    .single()

  // デバイスステータスもアクティブに更新
  if (sub?.device_id) {
    await supabase
      .from('devices')
      .update({ status: 'active' })
      .eq('id', sub.device_id)
  }

  console.log('Invoice payment succeeded for subscription:', invoice.subscription)
}

// 支払い失敗処理
async function handleInvoicePaymentFailed(invoice: any, supabase: any) {
  if (!invoice.subscription) return

  await supabase
    .from('subscriptions')
    .update({ status: 'past_due' })
    .eq('stripe_subscription_id', invoice.subscription)

  console.log('Invoice payment failed for subscription:', invoice.subscription)
}

// サブスクリプション同期
export async function handleStripeSyncSubscription(request: Request, env: any) {
  try {
    const { device_hash } = await request.json()

    if (!device_hash) {
      return new Response(JSON.stringify({ error: 'デバイスハッシュが必要です' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const supabase = getSupabaseClient(env)

    // デバイス情報を取得
    const { data: deviceData, error } = await supabase
      .from('device_plan_view')
      .select('*')
      .eq('device_hash', device_hash)
      .single()

    if (error || !deviceData) {
      return new Response(JSON.stringify({ error: 'デバイスが見つかりません' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Stripeサブスクリプションがある場合は最新情報を取得
    if (deviceData.stripe_subscription_id && env.STRIPE_SECRET_KEY) {
      const stripeResponse = await fetch(`https://api.stripe.com/v1/subscriptions/${deviceData.stripe_subscription_id}`, {
        headers: {
          'Authorization': `Bearer ${env.STRIPE_SECRET_KEY}`
        }
      })

      if (stripeResponse.ok) {
        const subscription = await stripeResponse.json()

        // Supabaseの情報を更新
        await supabase
          .from('subscriptions')
          .update({
            status: subscription.status,
            next_billing_date: new Date(subscription.current_period_end * 1000).toISOString()
          })
          .eq('stripe_subscription_id', subscription.id)

        // デバイスステータスも更新
        const deviceStatus = subscription.status === 'active' ? 'active' : 'expired'
        await supabase
          .from('devices')
          .update({ status: deviceStatus })
          .eq('id', deviceData.device_id)
      }
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'サブスクリプション情報を同期しました'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Sync subscription error:', error)
    return new Response(JSON.stringify({ error: '同期エラー' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// Stripeカスタマーポータル
export async function handleStripeCustomerPortal(request: Request, env: any) {
  try {
    const { device_hash } = await request.json()

    if (!device_hash) {
      return new Response(JSON.stringify({ error: 'デバイスハッシュが必要です' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const supabase = getSupabaseClient(env)

    // デバイス情報を取得
    const { data: deviceData, error } = await supabase
      .from('device_plan_view')
      .select('stripe_customer_id')
      .eq('device_hash', device_hash)
      .single()

    if (error || !deviceData?.stripe_customer_id) {
      return new Response(JSON.stringify({ error: 'Stripe顧客情報が見つかりません' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const stripeSecretKey = env.STRIPE_SECRET_KEY
    if (!stripeSecretKey) {
      return new Response(JSON.stringify({ error: 'Stripe設定エラー' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // カスタマーポータルセッション作成
    const portalData = {
      customer: deviceData.stripe_customer_id,
      return_url: `${env.NEXT_PUBLIC_SITE_URL}/dashboard`
    }

    const response = await fetch('https://api.stripe.com/v1/billing_portal/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${stripeSecretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams(portalData).toString()
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Stripe Portal API error:', errorText)
      return new Response(JSON.stringify({ error: 'カスタマーポータル作成に失敗しました' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const session = await response.json()

    return new Response(JSON.stringify({
      success: true,
      portal_url: session.url
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Customer portal error:', error)
    return new Response(JSON.stringify({ error: 'カスタマーポータルエラー' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}