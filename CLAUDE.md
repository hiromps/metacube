# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

```bash
# Development
npm run dev          # Start development server at localhost:3000
npm run build        # Build for production (static export to /out)
npm run lint         # Run ESLint

# Deployment
git push origin main # Auto-deploys to Cloudflare Pages
```

## Critical Architecture: Cloudflare Pages + Functions

**IMPORTANT**: This is NOT a standard Next.js deployment. It uses a hybrid architecture:

1. **Frontend**: Next.js 15.5.2 with `output: 'export'` (static HTML in `/out`)
2. **API**: Cloudflare Functions in `functions/api/[[path]].ts` (NOT Next.js API routes)
3. **Routing**: All API requests handled by catch-all route, NOT individual files

### Key Configuration Files
- `next.config.mjs`: MUST have `output: 'export'` for static generation
- `wrangler.toml`: Sets `pages_build_output_dir = "out"` (NOT `.next`)
- `public/_redirects`: Handles SPA routing (pages fallback to index.html)
- `functions/api/[[path]].ts`: Single catch-all API handler

## API Implementation Pattern

**NEVER create files in `app/api/` - use Cloudflare Functions only**

```typescript
// functions/api/[[path]].ts - All API requests go through here
export async function onRequestPOST(context: EventContext) {
  const url = new URL(context.request.url);
  const path = url.pathname.replace('/api/', '').replace(/\/$/, '');

  // Route to appropriate handler
  if (path === 'license/verify') {
    return handleLicenseVerify(context.request);
  }
  // ... other routes
}
```

## Cloudflare Workers Limitations & Solutions

### Buffer API Not Available

```typescript
// ❌ FAILS in Workers
const buffer = Buffer.from(data, 'base64');

// ✅ Use Web APIs instead
const binaryString = atob(data);
const bytes = new Uint8Array(binaryString.length);
for (let i = 0; i < binaryString.length; i++) {
  bytes[i] = binaryString.charCodeAt(i);
}
```

### Supabase Promise Handling

```typescript
// ❌ TypeScript error in Workers
supabase.from('table').insert(data)
  .then(result => {})
  .catch(error => {});

// ✅ Wrap in Promise.resolve()
Promise.resolve(supabase.from('table').insert(data))
  .then(result => {})
  .catch(error => {});
```

### UUID Validation Required
```typescript
// Always validate UUIDs before database queries
function isValidUUID(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

if (!isValidUUID(id)) {
  return new Response(JSON.stringify({ error: 'Invalid ID format' }), {
    status: 400
  });
}
```

## Database Schema

### Core Tables
- `users`: Supabase Auth managed
- `devices`: Device registrations with trial tracking
- `subscriptions`: Active subscriptions (PayPal/Stripe)
- `user_packages`: User-uploaded AutoTouch packages
- `plans`: Subscription plans with features

### Plan Structure
```typescript
// Plan names in database (lowercase)
'starter' | 'pro' | 'max' | 'trial'

// Plan features mapping
const planFeatures = {
  'starter': ['timeline.lua', 'hashtaglike.lua'],
  'pro': ['timeline.lua', 'hashtaglike.lua', 'follow.lua', 'unfollow.lua'],
  'max': ['timeline.lua', 'hashtaglike.lua', 'follow.lua', 'unfollow.lua', 'activelike.lua']
};
```

## Authentication & Session Management

### Remember Me Implementation
```typescript
// Uses custom session storage logic in lib/auth/client.ts
if (rememberMe) {
  localStorage.setItem('supabase.auth.token', session);  // Persistent
} else {
  sessionStorage.setItem('supabase.auth.token', session); // Temporary
}
```

### Common Auth Issues
- New user registration: Use `supabase.auth.signUp()` NOT `signInWithPassword()`
- Session persistence: Check both localStorage and sessionStorage
- Email confirmation: Handle `'Email not confirmed'` error with clear messaging

## Payment Integration

### Dual Payment System
1. **Stripe** (Primary): Payment Links with webhook handling
2. **PayPal** (Legacy): Subscription API with IPN

### Stripe Webhook Processing
```typescript
// functions/api/stripe-handlers.ts
// Critical: Update device.plan_id in webhook handler
await supabase.from('devices')
  .update({
    plan_id: planId,
    status: 'active'
  })
  .eq('user_id', userId);
```

## Common Development Tasks

### Fix Dashboard Auto-Reload Issues
Check useEffect dependencies in:
- `app/components/DashboardContent.tsx`: Remove `refetch` from dependencies
- `app/hooks/useUserData.ts`: Stabilize refetch callback with empty deps

### Handle File Downloads
```typescript
// Convert base64 to binary for download (Workers-compatible)
const binaryString = atob(packageData.file_content);
const bytes = new Uint8Array(binaryString.length);
for (let i = 0; i < binaryString.length; i++) {
  bytes[i] = binaryString.charCodeAt(i);
}
return new Response(bytes, {
  headers: {
    'Content-Type': 'application/zip',
    'Content-Disposition': 'attachment; filename="package.zip"'
  }
});
```

### Debug API Routes
1. Check `functions/api/[[path]].ts` routing logic
2. Verify path normalization (remove trailing slashes)
3. Test locally with `npm run dev` (Functions work in dev)
4. Use browser DevTools Network tab to inspect requests

## Deployment Checklist

Before pushing to production:
- [ ] `next.config.mjs` has `output: 'export'`
- [ ] No files in `app/api/` directory
- [ ] All APIs in `functions/api/[[path]].ts`
- [ ] UUID validation for all database queries
- [ ] No Node.js-specific APIs (Buffer, fs, path)
- [ ] Trailing slashes handled in API routes
- [ ] Error responses include proper status codes

## Environment Variables

Required in Cloudflare Pages dashboard:
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
NEXT_PUBLIC_SITE_URL (defaults to https://smartgram.jp)
```

## Testing

### API Testing
Use built-in test page: `https://smartgram.jp/api-test.html`

### Local Development
```bash
npm run dev  # Functions work locally with Cloudflare Pages dev server
```

### Common Test Scenarios
- Device registration with trial period
- Stripe Payment Link completion
- File upload/download for packages
- Plan feature access control