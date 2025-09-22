import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { admin_key } = body;

    if (admin_key !== 'metacube-admin-2024') {
      return NextResponse.json({ success: false, error: 'Invalid admin key' }, { status: 401 });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get all users with their devices
    const { data: users, error } = await supabase
      .from('devices')
      .select(`
        id,
        user_id,
        device_hash,
        status,
        trial_ends_at,
        created_at
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      users: users || []
    });

  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}