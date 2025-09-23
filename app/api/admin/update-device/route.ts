import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { admin_key, user_id, new_device_hash } = body;

    if (admin_key !== 'smartgram-admin-2024') {
      return NextResponse.json({ success: false, error: 'Invalid admin key' }, { status: 401 });
    }

    if (!user_id || !new_device_hash) {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Update device hash for the user
    const { data, error } = await supabase
      .from('devices')
      .update({ device_hash: new_device_hash })
      .eq('user_id', user_id)
      .select();

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    if (!data || data.length === 0) {
      return NextResponse.json({ success: false, error: 'User not found or no device to update' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: `Device hash updated to ${new_device_hash}`,
      updated_device: data[0]
    });

  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}