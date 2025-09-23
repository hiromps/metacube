# Execute Migration 09 - Manual Instructions

## Step 1: Access Supabase SQL Editor

1. **Go to Supabase Dashboard**: https://bsujceqmhvpltedjkvum.supabase.co
2. **Navigate to SQL Editor**: Click on "SQL Editor" in the left sidebar
3. **Create New Query**: Click "New Query" button

## Step 2: Execute the Migration SQL

1. **Copy the entire SQL content** from `C:\Users\Public\Documents\myproject\smartgram\scripts\execute-migration-09.sql`
2. **Paste it into the SQL Editor**
3. **Click "Run"** to execute the migration

## Step 3: Verify Functions Creation

After running the migration, execute this verification query:

```sql
-- Check if functions were created
SELECT proname, prorettype::regtype, prosrc
FROM pg_proc
WHERE proname IN ('register_device_with_setup', 'get_user_status');
```

Expected result: You should see 2 rows showing both functions.

## Step 4: Test the Functions

Execute these test queries to ensure functions work:

```sql
-- Test register_device_with_setup function
SELECT register_device_with_setup(
    gen_random_uuid(),
    'TEST123456789',
    'test@example.com'
);

-- Test get_user_status function
SELECT get_user_status(gen_random_uuid());
```

## What This Migration Does

This migration creates two critical functions that were missing:

1. **`register_device_with_setup`** - Handles device registration from the API
   - Parameters: `p_user_id UUID`, `p_device_hash TEXT`, `p_email TEXT`
   - Returns: JSON with success status and device information

2. **`get_user_status`** - Returns comprehensive user status for dashboard
   - Parameters: `p_user_id UUID`
   - Returns: JSON with user status, device info, trial info, subscription info

## Troubleshooting

If you get any errors:

1. **Permission errors**: Make sure you're logged in as the project owner
2. **Function already exists**: Drop the existing functions first:
   ```sql
   DROP FUNCTION IF EXISTS register_device_with_setup;
   DROP FUNCTION IF EXISTS get_user_status;
   ```
3. **Table dependency errors**: Ensure all tables exist (devices, licenses, subscriptions, etc.)

## After Migration

Once successful, the API endpoints should work:
- `/api/device/register` - Device registration
- `/api/user/status` - User dashboard data

The error "Could not find the function public.register_device_with_setup" should be resolved.