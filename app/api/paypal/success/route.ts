import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/client'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const deviceHash = searchParams.get('device_hash')
    const subscriptionId = searchParams.get('subscription_id')

    if (!deviceHash) {
      return NextResponse.redirect(new URL('/register?error=missing_device', request.url))
    }

    // Verify the device exists
    const { data: device } = await supabaseAdmin
      .from('devices')
      .select('id, status')
      .eq('device_hash', deviceHash)
      .single()

    if (!device) {
      return NextResponse.redirect(new URL('/register?error=device_not_found', request.url))
    }

    // If subscription ID is provided, update it
    if (subscriptionId) {
      await supabaseAdmin
        .from('subscriptions')
        .update({
          paypal_subscription_id: subscriptionId,
          status: 'pending' // Will be activated via webhook
        })
        .eq('device_id', device.id)
    }

    // Redirect to success page
    return NextResponse.redirect(new URL('/dashboard?success=subscription_created', request.url))

  } catch (error) {
    console.error('PayPal success handler error:', error)
    return NextResponse.redirect(new URL('/register?error=processing_failed', request.url))
  }
}