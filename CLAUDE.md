# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

```bash
# Development
npm run dev          # Start development server at localhost:3000
npm run build        # Build for production (static export)
npm run lint         # Run ESLint

# Database
npx supabase db push # Push migrations to Supabase
npx supabase migration repair --status applied [number] # Fix migration conflicts

# Testing
npm run build && npm run lint # Pre-deployment validation

# Deployment
git push origin main # Auto-deploys to Cloudflare Pages
```

## Architecture Overview

### SMARTGRAM - Instagram Automation SaaS

Multi-plan subscription service for Instagram automation tools on jailbroken iPhone 7/8 devices using AutoTouch.

### Critical Architecture: Cloudflare Pages + Functions

**Frontend**: Next.js 15.5.2 with `output: 'export'` → static files in `/out`
**API Layer**: Cloudflare Functions via `functions/api/[[path]].ts` (NOT Next.js API routes)
**Database**: Supabase (PostgreSQL + Auth + RLS)
**Payments**: Dual provider system (PayPal + Stripe)

### Key API Endpoints

All handled by `functions/api/[[path]].ts`:
- `/api/license/verify` - AutoTouch license validation
- `/api/device/register` - Device registration with trial
- `/api/check/package` - User package existence check
- `/api/download/package` - Download user's .ate file
- `/api/admin/upload-package` - Admin file upload
- `/api/stripe/*` - Stripe integration endpoints
- `/api/paypal/*` - PayPal webhook handlers

### Database Schema

```sql
-- Core tables
devices (id, user_id, device_hash, plan_id, status, trial_ends_at)
subscriptions (id, device_id, provider, plan_id, status)
plans (id, name, display_name, price_jpy, features[], stripe_price_id_monthly)
user_packages (id, user_id, file_name, file_content, is_active)
stripe_webhook_events (stripe_event_id, event_type, processed)

-- Views
device_plan_view (unified device + subscription + plan data)
```

### Payment Integration Flow

```
User Checkout → Stripe/PayPal → Webhook → Supabase Update → Device plan_id Update → License Active
```

Webhook handlers automatically update:
- `devices.plan_id` - Current active plan
- `devices.status` - active/expired/trial
- `subscriptions` table - Payment provider data

### Critical Configuration Files

- `wrangler.toml`: MUST have `pages_build_output_dir = "out"`
- `next.config.mjs`: MUST have `output: 'export'`
- `public/_redirects`: Handles SPA routing
- `lib/supabase/config.ts`: Hardcoded Supabase credentials (Cloudflare Pages compatible)

## Cloudflare Workers Restrictions

### Use Web APIs, NOT Node.js APIs

```typescript
// ❌ WRONG - Node.js Buffer
const buffer = Buffer.from(data, 'base64')

// ✅ CORRECT - Web APIs
const binaryString = atob(data)
const bytes = new Uint8Array(binaryString.length)
for (let i = 0; i < binaryString.length; i++) {
  bytes[i] = binaryString.charCodeAt(i)
}
```

### TypeScript Error Handling

```typescript
// ❌ WRONG
catch (error) {
  console.log(error.message) // TypeScript error
}

// ✅ CORRECT
catch (error) {
  console.log(error instanceof Error ? error.message : String(error))
}
```

### Promise Wrapping for Supabase

```typescript
// ❌ WRONG - Can't chain .catch()
supabase.from('table').insert(data)
  .then(result => {})
  .catch(error => {})

// ✅ CORRECT
Promise.resolve(supabase.from('table').insert(data))
  .then(result => {})
  .catch(error => {})
```

## Common Development Tasks

### Adding New API Endpoint

1. Add handler function in appropriate file (e.g., `functions/api/new-handler.ts`)
2. Import in `functions/api/[[path]].ts`
3. Add route condition:
```typescript
} else if (path === 'your/new/endpoint') {
  return handleYourNewEndpoint(request, env);
```
4. Update available_routes array in 404 response

### Updating Plans/Pricing

1. Update `lib/stripe/config.ts` with new prices
2. Update database: `plans` table with new stripe_price_id
3. Update display components that show pricing

### Database Migrations

```bash
# Create new migration
npx supabase migration new your_migration_name

# Apply with safety checks
npx supabase db push --dry-run  # Preview first
npx supabase db push            # Apply if safe

# If conflicts occur, use SQL Editor directly with IF NOT EXISTS checks
```

### Testing Stripe Integration

1. Use test environment: https://smartgram.jp/admin/stripe-test
2. Check webhook events in `stripe_webhook_events` table
3. Verify `devices.plan_id` updates after checkout

## Troubleshooting

### Build Fails on Cloudflare
- Check for JSX syntax errors (unmatched tags)
- Ensure no `app/api/` directory exists
- Verify no `export const dynamic = "force-dynamic"`

### API Returns HTML Instead of JSON
- Verify path matching in `[[path]].ts`
- Check `_redirects` file doesn't redirect `/api/*`
- Ensure trailing slashes are normalized

### Stripe Redirect Not Working
- `env.NEXT_PUBLIC_SITE_URL` defaults to 'https://smartgram.jp'
- Check Stripe Dashboard for webhook delivery status

### User Can't Download File
- Verify `user_packages` table has active package
- Check `/api/check/package` returns `hasPackage: true`
- Admin must upload file via dashboard first

## Key Business Logic

### Trial & Subscription Flow
1. Device registration → 3-day trial starts
2. Trial tracked via `devices.trial_ends_at`
3. Stripe/PayPal subscription required after trial
4. `devices.plan_id` determines active features
5. License verification checks device status + plan

### Plan Feature Matrix
- **STARTER (¥2,980)**: timeline.lua, hashtaglike.lua
- **PRO (¥6,980)**: + follow.lua, unfollow.lua
- **MAX (¥15,800)**: + activelike.lua, 24h support

### Admin Functions
- Upload .ate files for specific users
- View all users and their devices
- Test Stripe integration at `/admin/stripe-test`
- Admin emails checked via `isAdminEmail()` function