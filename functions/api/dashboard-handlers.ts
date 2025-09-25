// SMARTGRAM Dashboard API Handlers
// Production-ready dashboard functionality with new database structure

import { createClient } from '@supabase/supabase-js'

// Initialize Supabase client
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

// Get comprehensive user dashboard data
export async function handleUserDashboard(request: Request, env: any) {
  try {
    console.log('Dashboard handler called with method:', request.method)
    console.log('Dashboard request headers:', Object.fromEntries(request.headers.entries()))

    const requestText = await request.text()
    console.log('Dashboard request body:', requestText)

    const { device_hash, user_id } = requestText ? JSON.parse(requestText) : {}
    const supabase = getSupabaseClient(env)

    console.log('Dashboard data request:', { device_hash, user_id })

    // Get comprehensive data from device_plan_view
    const { data: dashboardData, error } = await supabase
      .from('device_plan_view')
      .select('*')
      .or(`device_hash.eq.${device_hash},user_id.eq.${user_id}`)
      .single()

    if (error) {
      console.error('Dashboard query error:', error)
      return new Response(JSON.stringify({
        success: false,
        error: 'データの取得に失敗しました',
        details: error.message
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Calculate additional metrics
    const currentTime = new Date()
    const trialEndsAt = new Date(dashboardData.trial_ends_at)
    const trialDaysRemaining = Math.max(0, Math.ceil((trialEndsAt.getTime() - currentTime.getTime()) / (1000 * 60 * 60 * 24)))

    // Next billing information
    const nextBillingDate = dashboardData.next_billing_date ? new Date(dashboardData.next_billing_date) : null
    const daysUntilBilling = nextBillingDate ? Math.ceil((nextBillingDate.getTime() - currentTime.getTime()) / (1000 * 60 * 60 * 24)) : null

    // Format response for frontend
    const response = {
      success: true,
      data: {
        // Device information
        device: {
          id: dashboardData.device_id,
          hash: dashboardData.device_hash,
          model: dashboardData.device_model,
          status: dashboardData.device_status,
          created_at: dashboardData.device_created_at
        },

        // Subscription information
        subscription: {
          id: dashboardData.subscription_id,
          status: dashboardData.subscription_status,
          plan_id: dashboardData.subscription_plan_id,
          amount: dashboardData.subscription_amount,
          billing_cycle: dashboardData.billing_cycle,
          next_billing_date: dashboardData.next_billing_date,
          cancelled_at: dashboardData.cancelled_at,
          paypal_subscription_id: dashboardData.paypal_subscription_id
        },

        // Plan information
        plan: {
          id: dashboardData.plan_id,
          name: dashboardData.plan_name,
          price: dashboardData.plan_price,
          features: dashboardData.plan_features || [],
          max_automation_hours: dashboardData.max_automation_hours,
          priority_support: dashboardData.priority_support
        },

        // Access information
        access: {
          has_access: dashboardData.has_access,
          access_level: dashboardData.access_level,
          is_trial_active: dashboardData.is_trial_active,
          trial_days_remaining: trialDaysRemaining,
          status_display: dashboardData.status_display
        },

        // Billing information
        billing: {
          next_billing_date: dashboardData.next_billing_date,
          days_until_billing: daysUntilBilling,
          current_amount: dashboardData.subscription_amount || dashboardData.plan_price
        },

        // Summary
        summary: {
          user_id: dashboardData.user_id,
          active_subscription: dashboardData.subscription_status === 'active',
          can_upgrade: dashboardData.plan_id !== 'max' && dashboardData.has_access,
          can_cancel: !!dashboardData.subscription_id && dashboardData.subscription_status === 'active'
        }
      }
    }

    console.log('Dashboard response prepared:', {
      device_hash: response.data.device.hash,
      plan: response.data.plan.id,
      access: response.data.access.has_access,
      status: response.data.access.status_display
    })

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Dashboard handler error:', error)
    return new Response(JSON.stringify({
      success: false,
      error: 'サーバーエラーが発生しました',
      details: error instanceof Error ? error.message : String(error)
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// Get available plans for upgrade/downgrade
export async function handleDashboardPlansList(request: Request, env: any) {
  try {
    const supabase = getSupabaseClient(env)

    const { data: plans, error } = await supabase
      .from('plans')
      .select('*')
      .eq('is_active', true)
      .order('sort_order')

    if (error) throw error

    return new Response(JSON.stringify({
      success: true,
      data: plans.map(plan => ({
        id: plan.id,
        name: plan.name,
        price_jpy: plan.price_jpy,
        features: plan.features || [],
        max_automation_hours: plan.max_automation_hours,
        priority_support: plan.priority_support,
        annual_discount_rate: plan.annual_discount_rate,
        stripe_product_id: plan.stripe_product_id,
        stripe_monthly_price_id: plan.stripe_monthly_price_id,
        stripe_annual_price_id: plan.stripe_annual_price_id
      }))
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Plans list error:', error)
    return new Response(JSON.stringify({
      success: false,
      error: 'プランの取得に失敗しました',
      details: error instanceof Error ? error.message : String(error)
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// Cancel subscription
export async function handleSubscriptionCancel(request: Request, env: any) {
  try {
    const { device_hash, user_id } = await request.json()
    const supabase = getSupabaseClient(env)

    console.log('Subscription cancel request:', { device_hash, user_id })

    // Find the device and subscription
    const { data: deviceData, error: deviceError } = await supabase
      .from('devices')
      .select('id')
      .or(`device_hash.eq.${device_hash},user_id.eq.${user_id}`)
      .single()

    if (deviceError || !deviceData) {
      return new Response(JSON.stringify({
        success: false,
        error: 'デバイスが見つかりません'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Update subscription to cancelled
    const { data: subscription, error: cancelError } = await supabase
      .from('subscriptions')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('device_id', deviceData.id)
      .select()
      .single()

    if (cancelError) {
      console.error('Subscription cancel error:', cancelError)
      return new Response(JSON.stringify({
        success: false,
        error: '解約処理に失敗しました',
        details: cancelError.message
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // TODO: Call Stripe/PayPal API to cancel external subscription
    // This should be implemented based on the provider

    console.log('Subscription cancelled:', subscription)

    return new Response(JSON.stringify({
      success: true,
      message: 'サブスクリプションを解約しました',
      data: {
        cancelled_at: subscription.cancelled_at,
        status: subscription.status
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Cancel subscription error:', error)
    return new Response(JSON.stringify({
      success: false,
      error: 'サーバーエラーが発生しました',
      details: error instanceof Error ? error.message : String(error)
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// Update device plan (for plan changes)
export async function handlePlanUpdate(request: Request, env: any) {
  try {
    const { device_hash, user_id, new_plan_id } = await request.json()
    const supabase = getSupabaseClient(env)

    console.log('Plan update request:', { device_hash, user_id, new_plan_id })

    // Validate the new plan exists
    const { data: plan, error: planError } = await supabase
      .from('plans')
      .select('*')
      .eq('id', new_plan_id)
      .eq('is_active', true)
      .single()

    if (planError || !plan) {
      return new Response(JSON.stringify({
        success: false,
        error: '指定されたプランが見つかりません'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Update device plan
    const { data: device, error: updateError } = await supabase
      .from('devices')
      .update({
        plan_id: new_plan_id,
        updated_at: new Date().toISOString()
      })
      .or(`device_hash.eq.${device_hash},user_id.eq.${user_id}`)
      .select()
      .single()

    if (updateError) {
      console.error('Plan update error:', updateError)
      return new Response(JSON.stringify({
        success: false,
        error: 'プラン変更に失敗しました',
        details: updateError.message
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    console.log('Plan updated successfully:', device)

    return new Response(JSON.stringify({
      success: true,
      message: `プランを${plan.name}に変更しました`,
      data: {
        device_id: device.id,
        new_plan_id: device.plan_id,
        plan_name: plan.name
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Plan update error:', error)
    return new Response(JSON.stringify({
      success: false,
      error: 'サーバーエラーが発生しました',
      details: error instanceof Error ? error.message : String(error)
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}