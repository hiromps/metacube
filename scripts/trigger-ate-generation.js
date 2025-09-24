#!/usr/bin/env node

/**
 * Manual trigger script for .ate file generation
 * Usage: node scripts/trigger-ate-generation.js [device_hash]
 */

const https = require('https');

const BASE_URL = 'https://smartgram.jp';

// Helper function to make HTTP requests
function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      ...options
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve({ status: res.statusCode, data: json });
        } catch (e) {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });

    req.on('error', reject);

    if (options.body) {
      req.write(options.body);
    }

    req.end();
  });
}

// Generate .ate file for a device
async function generateAteFile(deviceHash) {
  console.log(`🚀 Generating .ate file for device: ${deviceHash}`);

  try {
    // Queue generation
    const generateResponse = await makeRequest(`${BASE_URL}/api/ate/generate`, {
      method: 'POST',
      body: JSON.stringify({
        device_hash: deviceHash,
        template: 'smartgram',
        priority: 1
      })
    });

    if (generateResponse.status !== 200) {
      throw new Error(`Generation failed: ${JSON.stringify(generateResponse.data)}`);
    }

    console.log('✅ Generation queued:', generateResponse.data.message);
    console.log(`Queue ID: ${generateResponse.data.queue_id}`);
    console.log(`Estimated time: ${generateResponse.data.estimated_time}`);

    // Trigger scheduler to process immediately
    console.log('🔄 Triggering scheduler...');

    const schedulerResponse = await makeRequest(`${BASE_URL}/api/ate-scheduler/run`, {
      method: 'POST'
    });

    if (schedulerResponse.status === 200) {
      console.log('✅ Scheduler triggered:', schedulerResponse.data.message);
      console.log(`Processed: ${schedulerResponse.data.processed}, Failed: ${schedulerResponse.data.failed}`);
    } else {
      console.warn('⚠️ Scheduler trigger failed:', schedulerResponse.data);
    }

    // Wait a moment then check status
    console.log('⏳ Waiting 5 seconds then checking status...');
    await new Promise(resolve => setTimeout(resolve, 5000));

    const statusResponse = await makeRequest(`${BASE_URL}/api/ate/status?device_hash=${deviceHash}`);

    if (statusResponse.status === 200) {
      const status = statusResponse.data;
      console.log('\n📊 Current Status:');
      console.log(`Ready: ${status.is_ready ? '✅' : '❌'}`);

      if (status.is_ready) {
        console.log(`Filename: ${status.filename}`);
        console.log(`Size: ${Math.round(status.file_size_bytes / 1024)} KB`);
        console.log(`Download URL: ${BASE_URL}${status.download_url}`);
        console.log(`Downloads: ${status.download_count}`);
      } else {
        console.log('File is still being generated...');
      }
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

// Check scheduler status
async function checkSchedulerStatus() {
  console.log('📊 Checking scheduler status...');

  try {
    const response = await makeRequest(`${BASE_URL}/api/ate-scheduler/status`);

    if (response.status === 200) {
      const stats = response.data.queue_stats;
      console.log('\n🎯 Queue Statistics:');
      console.log(`Queued: ${stats.queued}`);
      console.log(`Processing: ${stats.processing}`);
      console.log(`Failed: ${stats.failed}`);
      console.log(`Total Active: ${stats.total_active}`);
    } else {
      console.error('Failed to get scheduler status:', response.data);
    }

  } catch (error) {
    console.error('❌ Error checking status:', error.message);
  }
}

// Run manual scheduler
async function runScheduler() {
  console.log('🔄 Running scheduler manually...');

  try {
    const response = await makeRequest(`${BASE_URL}/api/ate-scheduler/run`, {
      method: 'POST'
    });

    if (response.status === 200) {
      const result = response.data;
      console.log('✅ Scheduler completed:');
      console.log(`Processed: ${result.processed}`);
      console.log(`Failed: ${result.failed}`);
      console.log(`Cleanup run: ${result.cleaned ? 'Yes' : 'No'}`);
    } else {
      console.error('Scheduler failed:', response.data);
    }

  } catch (error) {
    console.error('❌ Scheduler error:', error.message);
  }
}

// Main function
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  switch (command) {
    case 'generate':
      const deviceHash = args[1];
      if (!deviceHash) {
        console.error('Usage: node scripts/trigger-ate-generation.js generate <device_hash>');
        process.exit(1);
      }
      await generateAteFile(deviceHash);
      break;

    case 'status':
      await checkSchedulerStatus();
      break;

    case 'run':
      await runScheduler();
      break;

    default:
      console.log('SMARTGRAM .ate File Generation Tool');
      console.log('');
      console.log('Usage:');
      console.log('  node scripts/trigger-ate-generation.js generate <device_hash>  # Generate .ate file');
      console.log('  node scripts/trigger-ate-generation.js status                   # Check queue status');
      console.log('  node scripts/trigger-ate-generation.js run                     # Run scheduler manually');
      console.log('');
      console.log('Examples:');
      console.log('  node scripts/trigger-ate-generation.js generate FFMZ3GTSJC6J');
      console.log('  node scripts/trigger-ate-generation.js status');
      console.log('  node scripts/trigger-ate-generation.js run');
      break;
  }
}

// Run the script
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});