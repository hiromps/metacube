// Script to update trial_ends_at for FFMZ3GTSJC6J device
const targetDate = '2025-09-25T03:17:24.000Z';

async function updateTrialDate() {
  try {
    console.log('Updating trial_ends_at to:', targetDate);

    const response = await fetch('https://metacube-el5.pages.dev/api/admin/update-device', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        adminKey: 'meta2024admin',
        deviceHash: 'FFMZ3GTSJC6J',
        updates: {
          trial_ends_at: targetDate,
          status: 'trial'
        }
      })
    });

    const result = await response.json();
    console.log('Response:', result);

    if (result.success) {
      console.log('✅ Successfully updated trial_ends_at');

      // Verify the update
      const verifyResponse = await fetch('https://metacube-el5.pages.dev/api/license/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          device_hash: 'FFMZ3GTSJC6J'
        })
      });

      const verifyResult = await verifyResponse.json();
      console.log('Verification result:', verifyResult);
      console.log('New trial_ends_at:', verifyResult.trial_ends_at);
      console.log('Time remaining (seconds):', verifyResult.time_remaining_seconds);
      console.log('Time remaining (hours):', verifyResult.time_remaining_seconds / 3600);
      console.log('Time remaining (days):', verifyResult.time_remaining_seconds / 86400);
    } else {
      console.error('❌ Failed to update:', result.error);
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

updateTrialDate();