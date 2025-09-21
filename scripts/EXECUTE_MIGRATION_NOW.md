# 🚨 URGENT: Execute Migration 09 Now

This migration fixes the critical error: **"Could not find the function public.register_device_with_setup"**

## Step-by-Step Execution

### Step 1: Open Supabase Dashboard
1. **Click this link**: https://bsujceqmhvpltedjkvum.supabase.co
2. **Login** to your Supabase account
3. **Navigate to "SQL Editor"** in the left sidebar

### Step 2: Create New Query
1. **Click "New Query"** button
2. **Copy ALL the SQL content** from the file:
   ```
   C:\Users\Public\Documents\myproject\MetaCube\scripts\execute-migration-09.sql
   ```
3. **Paste it into the SQL Editor**
4. **Click "Run"** (the green play button)

### Step 3: Verify Success
1. **Copy and run** the verification SQL from:
   ```
   C:\Users\Public\Documents\myproject\MetaCube\scripts\verify-migration-09.sql
   ```
2. **Check the results:**
   - Should see 2 functions listed
   - Test functions should execute successfully
   - No error messages

### Step 4: Test API Endpoints
After the migration, test that the API works:

```bash
# Test the live API endpoint
curl -X POST "https://metacube-el5.pages.dev/api/device/register" \
  -H "Content-Type: application/json" \
  -d '{
    "device_hash": "TEST123456789",
    "email": "test@example.com",
    "password": "testpass123"
  }'
```

## What This Migration Creates

### Functions Created:
1. **`register_device_with_setup`** - Handles device registration
2. **`get_user_status`** - Returns user dashboard data

### Permissions Granted:
- Functions accessible to `anon` and `authenticated` roles
- Proper security with SECURITY DEFINER

## Troubleshooting

### If you get "Function already exists":
```sql
-- Drop existing functions first
DROP FUNCTION IF EXISTS register_device_with_setup;
DROP FUNCTION IF EXISTS get_user_status;
-- Then run the migration again
```

### If you get permission errors:
- Make sure you're logged in as the project owner
- Check you're in the correct project

### If tables don't exist:
- The migration will fail if required tables are missing
- Check if you need to run previous migrations first

## Success Indicators

✅ **Migration Successful When:**
- No SQL errors during execution
- Verification script shows 2 functions
- API test returns valid JSON (not "function not found" error)
- Device registration works through the web interface

❌ **Migration Failed If:**
- SQL errors during execution
- Verification shows 0 functions
- API still returns "Could not find function" error

## After Migration

Once successful:
1. Device registration should work
2. User dashboard should load correctly
3. The "register_device_with_setup" error should be gone

**Execute this migration immediately to fix the API!**