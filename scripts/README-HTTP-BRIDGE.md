# smartgram HTTP Bridge Setup

## Problem
AutoTouch in this environment doesn't have HTTP functions (`httpPost`, `httpGet`) available, which prevents direct API communication with the smartgram server.

## Solution
Use an external HTTP bridge script that communicates with AutoTouch via files.

## Setup Instructions

### 1. Install Node.js (if not installed)
- Download from: https://nodejs.org/
- Or use package manager: `brew install node` (macOS) or `apt install nodejs` (Linux)

### 2. Start the HTTP Bridge
```bash
# Navigate to the scripts directory
cd /path/to/smartgram/scripts

# Run the HTTP bridge
node http-bridge.js

# Or test it first
node http-bridge.js --test
```

### 3. Run AutoTouch Script
- Run `main.lua` in AutoTouch
- The script will automatically detect missing HTTP functions
- It will create request files that the bridge processes
- The bridge makes actual HTTP requests and returns responses

## How It Works

```
AutoTouch (main.lua)
    ↓ Creates request file
    📄 /tmp/smartgram_request.json
    ↓ HTTP Bridge reads file
HTTP Bridge (http-bridge.js)
    ↓ Makes HTTP request
    🌐 smartgram API
    ↓ Writes response file
    📄 /tmp/smartgram_response.json
    ↓ AutoTouch reads response
AutoTouch (main.lua)
    ✅ Processes API response
```

## Files Created

- `/tmp/smartgram_request.json` - Request data from AutoTouch
- `/tmp/smartgram_response.json` - Response data from API
- `/tmp/smartgram_bridge.log` - Bridge activity log

## Troubleshooting

### Bridge Not Starting
```bash
# Check Node.js installation
node --version

# Check file permissions
ls -la /tmp/

# Run with verbose logging
node http-bridge.js --test
```

### AutoTouch Communication Issues
```bash
# Check if files are being created
ls -la /tmp/smartgram_*

# Check bridge logs
tail -f /tmp/smartgram_bridge.log

# Test file creation manually
echo '{"test": "data"}' > /tmp/smartgram_request.json
```

### API Connection Issues
```bash
# Test direct API access
curl -X POST https://smartgram.jp/api/license/verify \
  -H "Content-Type: application/json" \
  -d '{"device_hash":"TEST123456789"}'
```

## Alternative Methods

If the HTTP bridge doesn't work, the script will try:

1. **URL Scheme**: Opens browser with API URL (requires manual interaction)
2. **Pasteboard**: Copies request to clipboard for external processing
3. **Offline Mode**: Runs with simulated license data for testing

## Logs and Debugging

AutoTouch logs will show:
- HTTP function availability check
- Alternative method attempts
- File creation and response waiting
- Bridge communication status

Bridge logs (`/tmp/smartgram_bridge.log`) show:
- Request processing
- HTTP request/response details
- Error messages

## Production Deployment

For production use:
1. Run the bridge as a background service
2. Set up monitoring for the bridge process
3. Configure log rotation for bridge logs
4. Consider using a more robust file watching mechanism

## Security Notes

- The bridge only processes smartgram API requests
- Request/response files are cleaned up automatically
- No sensitive data is logged (device hashes are partially masked)
- Files are created in `/tmp` with standard permissions