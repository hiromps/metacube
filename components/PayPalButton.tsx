'use client'

import { PayPalScriptProvider, PayPalButtons } from '@paypal/react-paypal-js'
import { useState } from 'react'
import { InlineLoadingSpinner } from '@/app/components/LoadingScreen'

interface PayPalButtonProps {
  deviceHash: string
  email: string
  planId?: string
  amount?: number
  onSuccess?: (data: any) => void
  onError?: (error: any) => void
  onCancel?: () => void
}

export default function PayPalButton({
  deviceHash,
  email,
  planId = process.env.NEXT_PUBLIC_PAYPAL_PLAN_ID || 'P-32M85658DU0635907NDGYXHI',
  amount = 2980,
  onSuccess,
  onError,
  onCancel
}: PayPalButtonProps) {
  const [loading, setLoading] = useState(false)

  const initialOptions = {
    clientId: process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID!,
    currency: 'JPY',
    intent: 'subscription',
    vault: true
  }

  const createSubscription = async (data: any, actions: any) => {
    // Create subscription on PayPal
    return actions.subscription.create({
      plan_id: planId,
      custom_id: deviceHash,
      subscriber: {
        email_address: email
      },
      application_context: {
        brand_name: 'SocialTouch',
        locale: 'ja-JP',
        shipping_preference: 'NO_SHIPPING',
        user_action: 'SUBSCRIBE_NOW'
      }
    })
  }

  const onApprove = async (data: any, actions: any) => {
    setLoading(true)

    try {
      // The subscription is created on PayPal side
      // Redirect to success page with subscription ID
      window.location.href = `/api/paypal/success?device_hash=${deviceHash}&subscription_id=${data.subscriptionID}`

      if (onSuccess) {
        onSuccess(data)
      }
    } catch (error) {
      console.error('PayPal approval error:', error)
      if (onError) {
        onError(error)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <PayPalScriptProvider options={initialOptions}>
      <div className="w-full">
        {loading && <InlineLoadingSpinner message="決済処理中..." />}

        <PayPalButtons
          style={{
            shape: 'rect',
            color: 'blue',
            layout: 'vertical',
            label: 'subscribe'
          }}
          createSubscription={createSubscription}
          onApprove={onApprove}
          onError={(error) => {
            console.error('PayPal error:', error)
            if (onError) onError(error)
          }}
          onCancel={() => {
            console.log('PayPal cancelled')
            if (onCancel) onCancel()
          }}
          disabled={loading}
        />

        <div className="mt-4 text-xs text-gray-500 text-center">
          <p>月額 {amount.toLocaleString()}円</p>
          <p>3日間の無料体験後に自動課金開始</p>
          <p>いつでも解約可能</p>
        </div>
      </div>
    </PayPalScriptProvider>
  )
}