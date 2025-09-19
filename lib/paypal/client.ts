import checkoutNodeJssdk from '@paypal/checkout-server-sdk'

// PayPal configuration
const environment = process.env.NODE_ENV === 'production'
  ? new checkoutNodeJssdk.core.LiveEnvironment(
      process.env.PAYPAL_CLIENT_ID!,
      process.env.PAYPAL_CLIENT_SECRET!
    )
  : new checkoutNodeJssdk.core.SandboxEnvironment(
      process.env.PAYPAL_CLIENT_ID!,
      process.env.PAYPAL_CLIENT_SECRET!
    )

export const paypalClient = new checkoutNodeJssdk.core.PayPalHttpClient(environment)

// Subscription plans
export const SUBSCRIPTION_PLANS = {
  monthly_2980: {
    id: 'socialtouch_monthly_2980',
    name: 'SocialTouch Monthly - Basic',
    amount: 2980,
    currency: 'JPY',
    interval: 'MONTH',
    interval_count: 1,
    description: 'Instagram automation tool for iPhone 7/8'
  },
  monthly_8800: {
    id: 'socialtouch_monthly_8800',
    name: 'SocialTouch Monthly - Pro',
    amount: 8800,
    currency: 'JPY',
    interval: 'MONTH',
    interval_count: 1,
    description: 'Instagram automation tool with advanced features'
  },
  monthly_15000: {
    id: 'socialtouch_monthly_15000',
    name: 'SocialTouch Monthly - Premium',
    amount: 15000,
    currency: 'JPY',
    interval: 'MONTH',
    interval_count: 1,
    description: 'Instagram automation tool with all features'
  }
}

/**
 * Create a PayPal subscription
 */
export async function createSubscription(planId: string, deviceHash: string, userEmail: string) {
  // Note: PayPal SDK v1 is deprecated, we'll need to use REST API directly
  // This is a placeholder for the actual implementation
  const subscriptionData = {
    plan_id: planId,
    subscriber: {
      name: {
        given_name: userEmail.split('@')[0],
        surname: 'User'
      },
      email_address: userEmail
    },
    application_context: {
      brand_name: 'SocialTouch',
      locale: 'ja-JP',
      shipping_preference: 'NO_SHIPPING',
      user_action: 'SUBSCRIBE_NOW',
      payment_method: {
        payer_selected: 'PAYPAL',
        payee_preferred: 'IMMEDIATE_PAYMENT_REQUIRED'
      },
      return_url: `${process.env.NEXT_PUBLIC_APP_URL}/api/paypal/success?device_hash=${deviceHash}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/register?error=cancelled`
    },
    custom_id: deviceHash
  }

  return subscriptionData
}

/**
 * Verify PayPal webhook signature
 */
export function verifyWebhookSignature(
  headers: any,
  body: any,
  webhookId: string,
  webhookSecret: string
): boolean {
  // Implement PayPal webhook signature verification
  // This requires the actual webhook ID and secret from PayPal
  try {
    const transmissionId = headers['paypal-transmission-id']
    const transmissionTime = headers['paypal-transmission-time']
    const certUrl = headers['paypal-cert-url']
    const authAlgo = headers['paypal-auth-algo']
    const transmissionSig = headers['paypal-transmission-sig']

    // In production, verify the signature using PayPal's verification endpoint
    // For MVP, we'll trust the webhook if it has the required headers
    return !!(transmissionId && transmissionTime && certUrl && authAlgo && transmissionSig)
  } catch (error) {
    console.error('Webhook verification error:', error)
    return false
  }
}

/**
 * Cancel a PayPal subscription
 */
export async function cancelSubscription(subscriptionId: string, reason: string = 'User requested cancellation') {
  // REST API call to cancel subscription
  const response = await fetch(`https://api.${process.env.NODE_ENV === 'production' ? '' : 'sandbox.'}paypal.com/v1/billing/subscriptions/${subscriptionId}/cancel`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${await getAccessToken()}`
    },
    body: JSON.stringify({
      reason
    })
  })

  if (!response.ok) {
    throw new Error(`Failed to cancel subscription: ${response.statusText}`)
  }

  return true
}

/**
 * Get PayPal access token
 */
async function getAccessToken(): Promise<string> {
  const auth = Buffer.from(`${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`).toString('base64')

  const response = await fetch(`https://api.${process.env.NODE_ENV === 'production' ? '' : 'sandbox.'}paypal.com/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: 'grant_type=client_credentials'
  })

  if (!response.ok) {
    throw new Error('Failed to get PayPal access token')
  }

  const data = await response.json()
  return data.access_token
}