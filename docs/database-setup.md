# SocialTouch Database Setup Guide

## Supabase Database Schema

### Overview
Complete database schema for iPhone 7/8 AutoTouch license management system with PayPal subscriptions.

### Tables Created

1. **users_profile** - Extended user information
2. **devices** - Device registration (1 per user)
3. **subscriptions** - PayPal subscription management
4. **licenses** - License validation and caching
5. **payment_history** - Payment tracking
6. **api_logs** - API access monitoring

### Key Features

#### Security
- Row Level Security (RLS) enabled on all tables
- Users can only access their own data
- API service role for license verification
- Secure function execution

#### Business Logic
- **3-day trial period** automatically set
- **One device per user** constraint
- **Immediate cancellation** (no grace period in MVP)
- **24-hour license caching** through verification tracking

#### Helper Functions
- `create_device_and_license()` - Complete user onboarding
- `verify_license()` - License validation for Lua scripts
- `activate_subscription()` - PayPal subscription confirmation
- `cancel_subscription()` - Immediate subscription termination

### Setup Instructions

1. **Create Supabase Project**
   ```bash
   npx supabase init
   npx supabase start
   ```

2. **Run Migrations**
   ```bash
   npx supabase db reset
   ```

3. **Configure Environment**
   - Update `supabase/config.toml` with your project details
   - Set up environment variables in `.env.local`

4. **Test Database**
   ```sql
   -- Test device registration
   SELECT create_device_and_license(
     'user-uuid-here',
     'device-hash-here',
     'test@example.com'
   );

   -- Test license verification
   SELECT verify_license('device-hash-here');
   ```

### Environment Variables Needed

```env
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### API Endpoints Required

1. **POST /api/device/register**
   - Register new device with 3-day trial
   - Input: device_hash, email, password
   - Output: success, trial_ends_at

2. **POST /api/license/verify**
   - Verify license for Lua scripts
   - Input: device_hash
   - Output: is_valid, expires_at

### Notes

- Database automatically handles trial periods and expiration
- RLS policies ensure data isolation between users
- Helper functions provide atomic operations for critical business logic
- All timestamps are in UTC with timezone support