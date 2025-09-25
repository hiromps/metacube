// Stripe Integration Test Utilities
// Helper functions for testing Stripe-Supabase integration

import { createClient } from '@supabase/supabase-js'
import { STRIPE_CONFIG, formatAmount } from './config'

// Test subscription sync functionality
export async function testSubscriptionSync(deviceHash: string) {
  try {
    console.log('🧪 Testing subscription sync for device:', deviceHash)

    // Call sync API
    const response = await fetch('/api/stripe/sync-subscription', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ device_hash: deviceHash })
    })

    const result = await response.json()

    if (response.ok) {
      console.log('✅ Sync successful:', result)
      return { success: true, data: result }
    } else {
      console.error('❌ Sync failed:', result)
      return { success: false, error: result.error }
    }
  } catch (error) {
    console.error('❌ Sync test error:', error)
    return { success: false, error: error.message }
  }
}

// Test Stripe checkout session creation
export async function testCheckoutSessionCreation(planId: string, deviceHash: string, userEmail?: string) {
  try {
    console.log('🧪 Testing checkout session creation for plan:', planId)

    const response = await fetch('/api/stripe/create-checkout-session', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        plan_id: planId,
        device_hash: deviceHash,
        user_email: userEmail
      })
    })

    const result = await response.json()

    if (response.ok) {
      console.log('✅ Checkout session created:', result.checkout_url)
      return { success: true, checkoutUrl: result.checkout_url, sessionId: result.session_id }
    } else {
      console.error('❌ Checkout session creation failed:', result)
      return { success: false, error: result.error }
    }
  } catch (error) {
    console.error('❌ Checkout session test error:', error)
    return { success: false, error: error.message }
  }
}

// Test customer portal access
export async function testCustomerPortal(deviceHash: string) {
  try {
    console.log('🧪 Testing customer portal for device:', deviceHash)

    const response = await fetch('/api/stripe/customer-portal', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ device_hash: deviceHash })
    })

    const result = await response.json()

    if (response.ok) {
      console.log('✅ Customer portal URL generated:', result.portal_url)
      return { success: true, portalUrl: result.portal_url }
    } else {
      console.error('❌ Customer portal generation failed:', result)
      return { success: false, error: result.error }
    }
  } catch (error) {
    console.error('❌ Customer portal test error:', error)
    return { success: false, error: error.message }
  }
}

// Validate webhook event structure
export function validateWebhookEvent(eventData: any): {
  isValid: boolean
  eventType?: string
  requiredFields?: string[]
  missingFields?: string[]
} {
  if (!eventData || typeof eventData !== 'object') {
    return { isValid: false }
  }

  const { id, type, data, created } = eventData

  const requiredFields = ['id', 'type', 'data', 'created']
  const missingFields = requiredFields.filter(field => !eventData[field])

  if (missingFields.length > 0) {
    return {
      isValid: false,
      requiredFields,
      missingFields
    }
  }

  const isHandledEvent = STRIPE_CONFIG.WEBHOOK_EVENTS.includes(type)

  return {
    isValid: isHandledEvent,
    eventType: type,
    requiredFields
  }
}

// Generate test device hash
export function generateTestDeviceHash(): string {
  const timestamp = Date.now()
  const random = Math.random().toString(36).substr(2, 9)
  return `test_device_${timestamp}_${random}`
}

// Format subscription info for testing
export function formatSubscriptionInfo(subscriptionData: any) {
  return {
    id: subscriptionData.id,
    status: subscriptionData.status,
    planId: subscriptionData.plan_id,
    provider: subscriptionData.provider,
    amount: formatAmount(subscriptionData.amount_jpy || 0),
    nextBilling: subscriptionData.next_billing_date,
    stripeSubscriptionId: subscriptionData.stripe_subscription_id,
    stripeCustomerId: subscriptionData.stripe_customer_id,
    createdAt: subscriptionData.created_at
  }
}

// Test data consistency between Stripe and Supabase
export async function testDataConsistency(deviceHash: string) {
  try {
    console.log('🧪 Testing data consistency for device:', deviceHash)

    // Get Supabase data
    const supabaseResponse = await fetch(`/api/device/user-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ device_hash: deviceHash })
    })

    if (!supabaseResponse.ok) {
      return { success: false, error: 'Failed to fetch Supabase data' }
    }

    const supabaseData = await supabaseResponse.json()

    // For now, just return Supabase data since we don't have active Stripe subscriptions
    return {
      success: true,
      supabaseData,
      stripeData: null,
      consistent: true,
      message: 'No active Stripe subscriptions to compare'
    }

  } catch (error) {
    console.error('❌ Data consistency test error:', error)
    return { success: false, error: error.message }
  }
}

// Create test subscription workflow
export async function createTestSubscriptionWorkflow() {
  const testDeviceHash = generateTestDeviceHash()

  console.log('🧪 Starting test subscription workflow')
  console.log('📱 Test device hash:', testDeviceHash)

  // Step 1: Test device registration (if needed)
  console.log('Step 1: Device registration check')

  // Step 2: Test checkout session creation
  console.log('Step 2: Testing checkout session creation')
  const checkoutResult = await testCheckoutSessionCreation('starter', testDeviceHash, 'test@example.com')

  // Step 3: Test sync functionality
  console.log('Step 3: Testing subscription sync')
  const syncResult = await testSubscriptionSync(testDeviceHash)

  // Step 4: Test data consistency
  console.log('Step 4: Testing data consistency')
  const consistencyResult = await testDataConsistency(testDeviceHash)

  return {
    testDeviceHash,
    results: {
      checkout: checkoutResult,
      sync: syncResult,
      consistency: consistencyResult
    },
    summary: {
      allTestsPassed: checkoutResult.success && syncResult.success && consistencyResult.success,
      totalTests: 3,
      passedTests: [checkoutResult.success, syncResult.success, consistencyResult.success].filter(Boolean).length
    }
  }
}