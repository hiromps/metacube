import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/client'
import { verifyWebhookSignature } from '@/lib/paypal/client'

// PayPal webhook event types we care about
const RELEVANT_EVENTS = [
  'BILLING.SUBSCRIPTION.CREATED',
  'BILLING.SUBSCRIPTION.ACTIVATED',
  'BILLING.SUBSCRIPTION.CANCELLED',
  'BILLING.SUBSCRIPTION.EXPIRED',
  'BILLING.SUBSCRIPTION.SUSPENDED',
  'PAYMENT.SALE.COMPLETED',
  'PAYMENT.SALE.REFUNDED'
]

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const headers = Object.fromEntries(request.headers.entries())

    // Verify webhook signature (if configured)
    if (process.env.PAYPAL_WEBHOOK_ID && process.env.PAYPAL_WEBHOOK_SECRET) {
      const isValid = verifyWebhookSignature(
        headers,
        body,
        process.env.PAYPAL_WEBHOOK_ID,
        process.env.PAYPAL_WEBHOOK_SECRET
      )

      if (!isValid) {
        console.error('Invalid PayPal webhook signature')
        return NextResponse.json(
          { success: false, error: 'Invalid signature' },
          { status: 401 }
        )
      }
    }

    const { event_type, resource } = body

    // Only process relevant events
    if (!RELEVANT_EVENTS.includes(event_type)) {
      return NextResponse.json({ success: true, message: 'Event ignored' })
    }

    console.log(`Processing PayPal webhook: ${event_type}`, resource)

    // Extract device hash from custom_id
    const deviceHash = resource.custom_id || resource.custom || null

    if (!deviceHash) {
      console.error('No device hash in webhook payload')
      return NextResponse.json(
        { success: false, error: 'Missing device hash' },
        { status: 400 }
      )
    }

    // Handle different event types
    switch (event_type) {
      case 'BILLING.SUBSCRIPTION.ACTIVATED':
        await handleSubscriptionActivated(deviceHash, resource)
        break

      case 'BILLING.SUBSCRIPTION.CANCELLED':
        await handleSubscriptionCancelled(deviceHash, resource)
        break

      case 'BILLING.SUBSCRIPTION.EXPIRED':
      case 'BILLING.SUBSCRIPTION.SUSPENDED':
        await handleSubscriptionExpired(deviceHash, resource)
        break

      case 'PAYMENT.SALE.COMPLETED':
        await handlePaymentCompleted(deviceHash, resource)
        break

      case 'PAYMENT.SALE.REFUNDED':
        await handlePaymentRefunded(deviceHash, resource)
        break

      default:
        console.log(`Unhandled event type: ${event_type}`)
    }

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Webhook processing error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

async function handleSubscriptionActivated(deviceHash: string, resource: any) {
  const subscriptionId = resource.id
  const nextBillingDate = resource.billing_info?.next_billing_time

  // Call database function to activate subscription
  const { data, error } = await supabaseAdmin.rpc('activate_subscription', {
    p_device_hash: deviceHash,
    p_paypal_subscription_id: subscriptionId,
    p_next_billing_date: nextBillingDate
  })

  if (error) {
    console.error('Failed to activate subscription:', error)
    throw error
  }

  console.log(`Subscription activated for device: ${deviceHash}`)
}

async function handleSubscriptionCancelled(deviceHash: string, resource: any) {
  // Get device and user information
  const { data: device } = await supabaseAdmin
    .from('devices')
    .select('id, user_id')
    .eq('device_hash', deviceHash)
    .single()

  if (!device) {
    console.error(`Device not found: ${deviceHash}`)
    return
  }

  // Call database function to cancel subscription
  const { data, error } = await supabaseAdmin.rpc('cancel_subscription', {
    p_user_id: device.user_id
  })

  if (error) {
    console.error('Failed to cancel subscription:', error)
    throw error
  }

  console.log(`Subscription cancelled for device: ${deviceHash}`)
}

async function handleSubscriptionExpired(deviceHash: string, resource: any) {
  // Update device status to expired
  const { error } = await supabaseAdmin
    .from('devices')
    .update({ status: 'expired' })
    .eq('device_hash', deviceHash)

  if (error) {
    console.error('Failed to expire device:', error)
    throw error
  }

  // Invalidate license
  const { data: device } = await supabaseAdmin
    .from('devices')
    .select('id')
    .eq('device_hash', deviceHash)
    .single()

  if (device) {
    await supabaseAdmin
      .from('licenses')
      .update({
        is_valid: false,
        expires_at: new Date().toISOString()
      })
      .eq('device_id', device.id)
  }

  console.log(`Subscription expired for device: ${deviceHash}`)
}

async function handlePaymentCompleted(deviceHash: string, resource: any) {
  const amount = Math.round(parseFloat(resource.amount?.total || 0))
  const paymentId = resource.id

  // Get subscription for this device
  const { data: device } = await supabaseAdmin
    .from('devices')
    .select('id')
    .eq('device_hash', deviceHash)
    .single()

  if (!device) {
    console.error(`Device not found for payment: ${deviceHash}`)
    return
  }

  const { data: subscription } = await supabaseAdmin
    .from('subscriptions')
    .select('id')
    .eq('device_id', device.id)
    .single()

  if (!subscription) {
    console.error(`Subscription not found for device: ${deviceHash}`)
    return
  }

  // Record payment
  const { error } = await supabaseAdmin
    .from('payment_history')
    .insert({
      subscription_id: subscription.id,
      paypal_payment_id: paymentId,
      amount_jpy: amount,
      status: 'completed',
      payment_method: 'paypal'
    })

  if (error) {
    console.error('Failed to record payment:', error)
    throw error
  }

  console.log(`Payment completed for device: ${deviceHash}, amount: ${amount} JPY`)
}

async function handlePaymentRefunded(deviceHash: string, resource: any) {
  const amount = Math.round(parseFloat(resource.amount?.total || 0))
  const paymentId = resource.id

  // Get subscription for this device
  const { data: device } = await supabaseAdmin
    .from('devices')
    .select('id')
    .eq('device_hash', deviceHash)
    .single()

  if (!device) {
    console.error(`Device not found for refund: ${deviceHash}`)
    return
  }

  const { data: subscription } = await supabaseAdmin
    .from('subscriptions')
    .select('id')
    .eq('device_id', device.id)
    .single()

  if (!subscription) {
    console.error(`Subscription not found for device: ${deviceHash}`)
    return
  }

  // Record refund
  const { error } = await supabaseAdmin
    .from('payment_history')
    .insert({
      subscription_id: subscription.id,
      paypal_payment_id: paymentId,
      amount_jpy: -amount, // Negative amount for refund
      status: 'refunded',
      payment_method: 'paypal'
    })

  if (error) {
    console.error('Failed to record refund:', error)
    throw error
  }

  // Suspend the device
  await supabaseAdmin
    .from('devices')
    .update({ status: 'suspended' })
    .eq('id', device.id)

  console.log(`Payment refunded for device: ${deviceHash}, amount: ${amount} JPY`)
}

// OPTIONS method for CORS
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, { status: 200 })
}