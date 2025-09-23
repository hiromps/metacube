import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { admin_key, device_hash = 'FFMZ3GTSJC6J', trial_days = 3 } = body;

    if (admin_key !== 'smartgram-admin-2024') {
      return NextResponse.json({ success: false, error: 'Invalid admin key' }, { status: 401 });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Create a test user
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: `test-${Date.now()}@example.com`,
      password: 'testpassword123',
      email_confirm: true
    });

    if (authError || !authData.user) {
      console.error('Auth error:', authError);
      return NextResponse.json({ success: false, error: authError?.message || 'Failed to create user' }, { status: 500 });
    }

    // Calculate trial end date
    const trialEndDate = new Date();
    trialEndDate.setDate(trialEndDate.getDate() + trial_days);

    // Create device record
    const { data: deviceData, error: deviceError } = await supabase
      .from('devices')
      .insert({
        user_id: authData.user.id,
        device_hash: device_hash,
        status: 'trial',
        trial_ends_at: trialEndDate.toISOString()
      })
      .select()
      .single();

    if (deviceError) {
      console.error('Device creation error:', deviceError);
      // Clean up the user if device creation fails
      await supabase.auth.admin.deleteUser(authData.user.id);
      return NextResponse.json({ success: false, error: deviceError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Test user created successfully',
      user_id: authData.user.id,
      email: authData.user.email,
      device_hash: device_hash,
      trial_ends_at: trialEndDate.toISOString(),
      device_id: deviceData.id
    });

  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}