# Critical: Fix Missing Database Functions

## Problem Summary
The application is failing with "Could not find the function public.register_device_with_setup" error because database functions were removed in previous migrations but the API code still references them.

## Required Functions
1. `register_device_with_setup(p_user_id UUID, p_device_hash TEXT, p_email TEXT)` - Called by API for device registration
2. `get_user_status(p_user_id UUID)` - For user status queries

## IMMEDIATE ACTION REQUIRED

### Step 1: Access Supabase Database
1. Go to: https://bsujceqmhvpltedjkvum.supabase.co
2. Navigate to **SQL Editor** in the left sidebar
3. Click **New Query**

### Step 2: Execute the Migration
Copy and paste the contents from: `C:\Users\Public\Documents\myproject\smartgram\scripts\execute-migration-09.sql`

Or run the SQL directly from the command line if you have access.

### Step 3: Verify Functions Were Created
After executing the migration, run this verification query:
```sql
SELECT proname, prorettype::regtype
FROM pg_proc
WHERE proname IN ('register_device_with_setup', 'get_user_status');
```

Expected result: Both functions should appear in the results.

### Step 4: Test the Functions
Test with these queries:
```sql
-- Test device registration
SELECT register_device_with_setup(
    '2f1bbfdc-1ce7-4fac-9bf9-943afe80d6df'::uuid,
    'TEST123456789',
    'test@example.com'
);

-- Test user status
SELECT get_user_status('2f1bbfdc-1ce7-4fac-9bf9-943afe80d6df'::uuid);
```

## What This Fixes
- ✅ Device registration API will work
- ✅ "Function not found" errors will be resolved
- ✅ User status queries will work properly
- ✅ The application will be functional again

## Files Created
1. `supabase/migrations/09_restore_missing_functions.sql` - Migration file
2. `scripts/execute-migration-09.sql` - Direct SQL to execute
3. `scripts/apply-migration-09.md` - Detailed instructions
4. `scripts/MIGRATION_INSTRUCTIONS.md` - This summary

## Function Details

### `register_device_with_setup`
- **Purpose**: Handle device registration from the API
- **Parameters**: user_id (UUID), device_hash (TEXT), email (TEXT)
- **Returns**: JSON with success status and device information
- **Side Effects**: Creates device, license, and event records

### `get_user_status`
- **Purpose**: Get comprehensive user status for dashboard/API
- **Parameters**: user_id (UUID)
- **Returns**: JSON with complete user status, trial info, subscription details
- **Source**: Queries the user_dashboard view

## Security
Both functions are created with `SECURITY DEFINER` and granted to `anon` and `authenticated` roles for API access.

## Next Steps After Migration
1. Test device registration through the web interface
2. Verify the dashboard loads user status correctly
3. Test the main.lua license verification
4. Monitor application logs for any remaining function errors