#!/usr/bin/env node

/**
 * HTTP Bridge for AutoTouch Smartgram Integration
 *
 * This Node.js script acts as a bridge between AutoTouch (which may not have HTTP functions)
 * and the Smartgram API. It monitors a request file and makes HTTP requests on behalf of AutoTouch.
 *
 * Usage:
 * 1. Install Node.js
 * 2. Run: node http-bridge.js
 * 3. AutoTouch will create request files that this script processes
 */

const fs = require('fs');
const https = require('https');
const path = require('path');

const REQUEST_FILE = '/tmp/smartgram_request.json';
const RESPONSE_FILE = '/tmp/smartgram_response.json';
const LOG_FILE = '/tmp/smartgram_bridge.log';

function log(message) {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ${message}\n`;
    console.log(logEntry.trim());

    // Append to log file
    try {
        fs.appendFileSync(LOG_FILE, logEntry);
    } catch (err) {
        console.error('Failed to write to log file:', err.message);
    }
}

function makeHttpRequest(requestData) {
    return new Promise((resolve, reject) => {
        const url = new URL(requestData.url);
        const postData = requestData.body;

        const options = {
            hostname: url.hostname,
            port: url.port || 443,
            path: url.pathname,
            method: requestData.method || 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData),
                'User-Agent': 'Smartgram-HTTP-Bridge/1.0',
                ...requestData.headers
            }
        };

        log(`Making ${options.method} request to ${requestData.url}`);
        log(`Request body: ${postData}`);

        const req = https.request(options, (res) => {
            let data = '';

            res.on('data', (chunk) => {
                data += chunk;
            });

            res.on('end', () => {
                log(`Response status: ${res.statusCode}`);
                log(`Response body: ${data}`);
                resolve({
                    statusCode: res.statusCode,
                    body: data,
                    headers: res.headers
                });
            });
        });

        req.on('error', (err) => {
            log(`Request error: ${err.message}`);
            reject(err);
        });

        req.write(postData);
        req.end();
    });
}

function processRequestFile() {
    try {
        if (!fs.existsSync(REQUEST_FILE)) {
            return false; // No request file found
        }

        log('Found request file, processing...');
        const requestData = JSON.parse(fs.readFileSync(REQUEST_FILE, 'utf8'));

        // Validate request data
        if (!requestData.url || !requestData.body) {
            log('Invalid request data - missing url or body');
            return false;
        }

        // Make HTTP request
        makeHttpRequest(requestData)
            .then(response => {
                // Write response file
                const responseData = {
                    success: true,
                    statusCode: response.statusCode,
                    body: response.body,
                    timestamp: Date.now(),
                    originalRequest: requestData
                };

                fs.writeFileSync(RESPONSE_FILE, JSON.stringify(responseData, null, 2));
                log('Response written to ' + RESPONSE_FILE);

                // Remove request file
                fs.unlinkSync(REQUEST_FILE);
                log('Request file processed and removed');

                return true;
            })
            .catch(error => {
                // Write error response
                const errorResponse = {
                    success: false,
                    error: error.message,
                    timestamp: Date.now(),
                    originalRequest: requestData
                };

                fs.writeFileSync(RESPONSE_FILE, JSON.stringify(errorResponse, null, 2));
                log('Error response written: ' + error.message);

                // Remove request file
                fs.unlinkSync(REQUEST_FILE);

                return false;
            });

    } catch (err) {
        log('Error processing request file: ' + err.message);
        return false;
    }
}

function cleanup() {
    // Remove any existing files on startup
    [REQUEST_FILE, RESPONSE_FILE].forEach(file => {
        try {
            if (fs.existsSync(file)) {
                fs.unlinkSync(file);
                log(`Cleaned up existing file: ${file}`);
            }
        } catch (err) {
            log(`Failed to cleanup ${file}: ${err.message}`);
        }
    });
}

function main() {
    log('Smartgram HTTP Bridge starting...');
    log('Monitoring request file: ' + REQUEST_FILE);
    log('Response file: ' + RESPONSE_FILE);
    log('Log file: ' + LOG_FILE);

    cleanup();

    // Monitor for request files
    let pollCount = 0;
    const pollInterval = setInterval(() => {
        pollCount++;

        if (pollCount % 60 === 0) { // Log every minute
            log(`HTTP Bridge active - poll count: ${pollCount}`);
        }

        const processed = processRequestFile();

        if (processed) {
            log('Request processed successfully');
        }
    }, 1000); // Check every second

    // Handle graceful shutdown
    process.on('SIGINT', () => {
        log('Received SIGINT, shutting down gracefully...');
        clearInterval(pollInterval);
        cleanup();
        process.exit(0);
    });

    process.on('SIGTERM', () => {
        log('Received SIGTERM, shutting down gracefully...');
        clearInterval(pollInterval);
        cleanup();
        process.exit(0);
    });

    log('HTTP Bridge started successfully');
}

// Test mode - make a direct API call
function testMode() {
    log('Running in test mode...');

    const testRequest = {
        url: 'https://smartgram-el5.pages.dev/api/license/verify',
        method: 'POST',
        body: '{"device_hash":"TEST123456789"}',
        headers: {
            'Content-Type': 'application/json'
        }
    };

    makeHttpRequest(testRequest)
        .then(response => {
            log('Test request successful!');
            log('Status: ' + response.statusCode);
            log('Body: ' + response.body);
        })
        .catch(error => {
            log('Test request failed: ' + error.message);
        });
}

// Check command line arguments
if (process.argv.includes('--test')) {
    testMode();
} else {
    main();
}