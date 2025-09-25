// Stripe Configuration for SMARTGRAM
// Manages Stripe integration and subscription sync

export const STRIPE_CONFIG = {
  // Product and Price IDs from Stripe Dashboard
  PRODUCTS: {
    STARTER: {
      productId: 'prod_T7To7yeLR4Pe8w',
      monthlyPriceId: 'price_1SBErJDE82UMk94OqPkVIJGc',
      amount: 2980,
      features: ['timeline.lua', 'hashtaglike.lua']
    },
    PRO: {
      productId: 'prod_T7Toy4bxQ8WJwh',
      monthlyPriceId: 'price_1SBEtHDE82UMk94Of4R27wlm',
      yearlyPriceId: 'price_1SBEtKDE82UMk94OZYcILvtc',
      monthlyAmount: 6980,
      yearlyAmount: 69800,
      features: ['timeline.lua', 'hashtaglike.lua', 'follow.lua', 'unfollow.lua']
    },
    MAX: {
      productId: 'prod_T7ToQoaY46ZKwc',
      monthlyPriceId: 'price_1SBEtMDE82UMk94OTYoYrc9U',
      amount: 15800,
      features: ['timeline.lua', 'hashtaglike.lua', 'follow.lua', 'unfollow.lua', 'activelike.lua']
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
  switch (planId.toLowerCase()) {
    case 'starter':
      return STRIPE_CONFIG.PRODUCTS.STARTER.monthlyPriceId
    case 'pro':
      return billingCycle === 'yearly'
        ? STRIPE_CONFIG.PRODUCTS.PRO.yearlyPriceId
        : STRIPE_CONFIG.PRODUCTS.PRO.monthlyPriceId
    case 'max':
      return STRIPE_CONFIG.PRODUCTS.MAX.monthlyPriceId
    default:
      return null
  }
}

// Stripe Product ID to Plan ID mapping
export function getPlanIdFromProductId(productId: string): string | null {
  for (const [planName, config] of Object.entries(STRIPE_CONFIG.PRODUCTS)) {
    if (config.productId === productId) {
      return planName.toLowerCase()
    }
  }
  return null
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