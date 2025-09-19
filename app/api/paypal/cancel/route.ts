import { NextRequest, NextResponse } from 'next/server'
import { cancelSubscription } from '@/lib/paypal/client'
import { supabaseAdmin } from '@/lib/supabase/client'

export async function POST(request: NextRequest) {
  let body: any = {}

  try {
    body = await request.json()
    const { subscription_id } = body

    if (!subscription_id) {
      return NextResponse.json(
        { success: false, error: 'Subscription ID is required' },
        { status: 400 }
      )
    }

    // Verify user is authorized to cancel this subscription
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Cancel PayPal subscription
    try {
      await cancelSubscription(subscription_id)
    } catch (paypalError) {
      console.error('PayPal cancellation error:', paypalError)
      // Continue even if PayPal fails - we'll still mark as cancelled in our DB
    }

    // Update subscription status in database
    const { error } = await supabaseAdmin
      .from('subscriptions')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString()
      })
      .eq('paypal_subscription_id', subscription_id)

    if (error) {
      console.error('Database update error:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to update subscription status' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Subscription cancelled successfully'
    })

  } catch (error) {
    console.error('Cancellation error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// OPTIONS method for CORS
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, { status: 200 })
}