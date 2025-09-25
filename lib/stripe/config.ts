// SMARTGRAM Stripe Configuration
// Clean, unified configuration for SMARTGRAM subscription plans

export const STRIPE_CONFIG = {
  // SMARTGRAM Plan Configuration (matches database plans table)
  PLANS: {
    starter: {
      id: 'starter',
      name: 'SMARTGRAM STARTER',
      productId: 'prod_smartgram_starter',
      monthlyPriceId: 'price_smartgram_starter',
      monthlyAmount: 2980,
      features: ['timeline.lua', 'hashtaglike.lua'],
      maxHours: 6,
      support: false
    },
    pro: {
      id: 'pro',
      name: 'SMARTGRAM PRO',
      productId: 'prod_smartgram_pro',
      monthlyPriceId: 'price_smartgram_pro',
      annualPriceId: 'price_smartgram_pro_annual',
      monthlyAmount: 6980,
      annualAmount: 59332, // 15% discount
      features: ['timeline.lua', 'hashtaglike.lua', 'follow.lua', 'unfollow.lua'],
      maxHours: 12,
      support: true
    },
    max: {
      id: 'max',
      name: 'SMARTGRAM MAX',
      productId: 'prod_smartgram_max',
      monthlyPriceId: 'price_smartgram_max',
      annualPriceId: 'price_smartgram_max_annual',
      monthlyAmount: 15800,
      annualAmount: 126400, // 20% discount
      features: ['timeline.lua', 'hashtaglike.lua', 'follow.lua', 'unfollow.lua', 'activelike.lua'],
      maxHours: 24,
      support: true
    }
  },

  // Webhook Events to Handle
  WEBHOOK_EVENTS: [
    'checkout.session.completed',
    'customer.subscription.created',
    'customer.subscription.updated',
    'customer.subscription.deleted',
    'invoice.payment_succeeded',
    'invoice.payment_failed'
  ],

  // Trial Period Settings
  TRIAL_PERIOD_DAYS: 3,

  // Subscription Status Mapping
  STATUS_MAPPING: {
    'active': 'active',
    'trialing': 'active',
    'past_due': 'past_due',
    'canceled': 'cancelled',
    'unpaid': 'suspended',
    'incomplete': 'pending',
    'incomplete_expired': 'expired'
  }
}

// Plan ID to Stripe Price ID mapping
export function getPriceIdForPlan(planId: string, billingCycle: 'monthly' | 'yearly' = 'monthly'): string | null {
  const plan = STRIPE_CONFIG.PLANS[planId as keyof typeof STRIPE_CONFIG.PLANS]
  if (!plan) return null

  if (billingCycle === 'yearly' && plan.annualPriceId) {
    return plan.annualPriceId
  }
  return plan.monthlyPriceId
}

// Stripe Product ID to Plan ID mapping
export function getPlanIdFromProductId(productId: string): string | null {
  for (const [planId, config] of Object.entries(STRIPE_CONFIG.PLANS)) {
    if (config.productId === productId) {
      return planId
    }
  }
  return null
}

// Get plan configuration
export function getPlanConfig(planId: string) {
  return STRIPE_CONFIG.PLANS[planId as keyof typeof STRIPE_CONFIG.PLANS] || null
}

// Amount formatting for display
export function formatAmount(amountInJpy: number): string {
  return new Intl.NumberFormat('ja-JP', {
    style: 'currency',
    currency: 'JPY',
    minimumFractionDigits: 0
  }).format(amountInJpy)
}

// Subscription status validation
export function isValidSubscriptionStatus(status: string): boolean {
  return Object.keys(STRIPE_CONFIG.STATUS_MAPPING).includes(status)
}

// Map Stripe status to Supabase status
export function mapStripeStatusToSupabase(stripeStatus: string): string {
  return STRIPE_CONFIG.STATUS_MAPPING[stripeStatus as keyof typeof STRIPE_CONFIG.STATUS_MAPPING] || 'pending'
}