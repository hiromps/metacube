#!/bin/bash

# Test script to verify the migration worked
# Run this AFTER executing the migration in Supabase

echo "🧪 Testing API endpoints after migration..."
echo "============================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

API_BASE="https://smartgram.jp/api"

echo -e "${YELLOW}1. Testing device registration endpoint...${NC}"
REGISTER_RESPONSE=$(curl -s -X POST "$API_BASE/device/register" \
  -H "Content-Type: application/json" \
  -d '{
    "device_hash": "TEST_MIGRATION_' $(date +%s) '",
    "email": "test-migration@example.com",
    "password": "testpass123"
  }')

echo "Response: $REGISTER_RESPONSE"

if echo "$REGISTER_RESPONSE" | grep -q '"success":true\|"device_id"'; then
    echo -e "${GREEN}✅ Device registration endpoint: WORKING${NC}"
else
    echo -e "${RED}❌ Device registration endpoint: FAILED${NC}"
    if echo "$REGISTER_RESPONSE" | grep -q "register_device_with_setup"; then
        echo -e "${RED}   Error: Function still not found - migration not executed${NC}"
    fi
fi

echo ""
echo -e "${YELLOW}2. Testing license verification endpoint...${NC}"
VERIFY_RESPONSE=$(curl -s -X POST "$API_BASE/license/verify" \
  -H "Content-Type: application/json" \
  -d '{
    "device_hash": "TEST_DEVICE_123"
  }')

echo "Response: $VERIFY_RESPONSE"

if echo "$VERIFY_RESPONSE" | grep -q '"valid":\|"device_id"'; then
    echo -e "${GREEN}✅ License verification endpoint: WORKING${NC}"
else
    echo -e "${RED}❌ License verification endpoint: FAILED${NC}"
fi

echo ""
echo -e "${YELLOW}3. Testing Supabase function directly...${NC}"
DIRECT_RESPONSE=$(curl -s -X POST "https://bsujceqmhvpltedjkvum.supabase.co/rest/v1/rpc/register_device_with_setup" \
  -H "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJzdWpjZXFtaHZwbHRlZGprdnVtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgyODU1MDYsImV4cCI6MjA3Mzg2MTUwNn0._TrKjXMAQQWNmS2aIEV6oA7RMXJISSWaVMUQBESPnbQ" \
  -H "Content-Type: application/json" \
  -d '{
    "p_user_id": "123e4567-e89b-12d3-a456-426614174000",
    "p_device_hash": "TEST_DIRECT_' $(date +%s) '",
    "p_email": "test-direct@example.com"
  }')

echo "Response: $DIRECT_RESPONSE"

if echo "$DIRECT_RESPONSE" | grep -q '"success":true\|device_id'; then
    echo -e "${GREEN}✅ Direct Supabase function: WORKING${NC}"
else
    echo -e "${RED}❌ Direct Supabase function: FAILED${NC}"
    if echo "$DIRECT_RESPONSE" | grep -q "Could not find the function"; then
        echo -e "${RED}   Error: Function not found - migration NOT executed yet${NC}"
    fi
fi

echo ""
echo "============================================"
echo -e "${YELLOW}Migration Status Summary:${NC}"

# Count successful tests
SUCCESS_COUNT=0
if echo "$REGISTER_RESPONSE" | grep -q '"success":true\|"device_id"'; then
    ((SUCCESS_COUNT++))
fi
if echo "$VERIFY_RESPONSE" | grep -q '"valid":\|"device_id"'; then
    ((SUCCESS_COUNT++))
fi
if echo "$DIRECT_RESPONSE" | grep -q '"success":true\|device_id'; then
    ((SUCCESS_COUNT++))
fi

if [ $SUCCESS_COUNT -eq 3 ]; then
    echo -e "${GREEN}🎉 ALL TESTS PASSED - Migration successful!${NC}"
elif [ $SUCCESS_COUNT -eq 0 ]; then
    echo -e "${RED}💥 ALL TESTS FAILED - Migration not executed or failed${NC}"
    echo -e "${YELLOW}👉 Please execute the migration in Supabase SQL Editor${NC}"
else
    echo -e "${YELLOW}⚠️  PARTIAL SUCCESS ($SUCCESS_COUNT/3) - Some issues remain${NC}"
fi

echo ""
echo "Next steps:"
echo "1. If tests failed: Execute migration in Supabase SQL Editor"
echo "2. If tests passed: API is working correctly"
echo "3. Check the web application at: https://smartgram.jp"