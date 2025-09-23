const { createClient } = require('@supabase/supabase-js');

// Supabase configuration
const supabaseUrl = 'https://bsujceqmhvpltedjkvum.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJzdWpjZXFtaHZwbHRlZGprdnVtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1ODI4NTUwNiwiZXhwIjoyMDczODYxNTA2fQ.24rZzpq0fO-TZyCrdsgqtLrQ6HzfLZf-adqyoO8i3pg';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function updateTrialDate() {
  console.log('Updating trial_ends_at for FFMZ3GTSJC6J...');

  // Correct target date: 2 days and 14 hours from initial time
  const targetDate = '2025-09-25T03:17:24.000Z';

  try {
    // First, find the device
    const { data: devices, error: selectError } = await supabase
      .from('devices')
      .select('*')
      .eq('device_hash', 'FFMZ3GTSJC6J');

    if (selectError) {
      console.error('Error finding device:', selectError);
      return;
    }

    if (!devices || devices.length === 0) {
      console.error('Device not found');
      return;
    }

    console.log('Current device data:', devices[0]);
    console.log('Current trial_ends_at:', devices[0].trial_ends_at);

    // Update the device (only update existing columns)
    const { data: updateData, error: updateError } = await supabase
      .from('devices')
      .update({
        trial_ends_at: targetDate,
        status: 'trial',
        updated_at: new Date().toISOString()
      })
      .eq('device_hash', 'FFMZ3GTSJC6J')
      .select();

    if (updateError) {
      console.error('Error updating device:', updateError);
      return;
    }

    console.log('✅ Successfully updated!');
    console.log('New device data:', updateData[0]);
    console.log('New trial_ends_at:', updateData[0].trial_ends_at);

    // Calculate remaining time
    const now = new Date();
    const endDate = new Date(targetDate);
    const diffMs = endDate - now;
    const diffHours = diffMs / (1000 * 60 * 60);
    const diffDays = diffMs / (1000 * 60 * 60 * 24);

    console.log('');
    console.log('Time remaining:');
    console.log('- Hours:', diffHours.toFixed(1));
    console.log('- Days:', diffDays.toFixed(2));

  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

updateTrialDate();