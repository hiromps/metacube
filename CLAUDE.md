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

## Package Upload/Download Implementation

### Admin Package Upload System

Successfully implemented a package upload system for admin to upload AutoTouch packages for specific users.

#### Database Schema
```sql
-- user_packages table stores admin-uploaded packages
CREATE TABLE user_packages (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  device_hash TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_content TEXT NOT NULL, -- base64 encoded
  file_size INTEGER NOT NULL,
  uploaded_by TEXT DEFAULT 'admin',
  notes TEXT,
  version TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### Backend Implementation (Cloudflare Functions)

**Route Handler in `functions/api/[[path]].ts`:**
```typescript
// Add route mapping
else if (path === 'admin/upload-package') {
  return handleAdminUploadPackageInternal(request, env);
}

// Upload handler with proper error handling
async function handleAdminUploadPackageInternal(request: Request, env: any) {
  // Critical: Environment variables must be passed correctly
  const supabase = getSupabaseClient(env);

  // Validate admin key
  if (uploadData.admin_key !== 'smartgram-admin-2024') {
    return new Response(JSON.stringify({ error: 'Invalid admin key' }), {
      status: 401
    });
  }

  // Deactivate old packages before inserting new
  await supabase.from('user_packages')
    .update({ is_active: false })
    .eq('user_id', uploadData.user_id)
    .eq('device_hash', uploadData.device_hash);

  // Insert new package
  const { data, error } = await supabase.from('user_packages')
    .insert({
      user_id: uploadData.user_id,
      device_hash: uploadData.device_hash,
      file_name: uploadData.file_name,
      file_content: uploadData.file_content, // base64
      file_size: uploadData.file_size,
      version: generateVersionString(),
      is_active: true
    });
}
```

#### Frontend Implementation

**Admin Upload Form (`app/admin/page.tsx`):**
```typescript
const handlePackageUpload = async () => {
  // Convert file to base64
  const fileContent = await new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = e.target?.result?.toString().split(',')[1];
      resolve(base64);
    };
    reader.readAsDataURL(uploadFile);
  });

  const response = await fetch('/api/admin/upload-package', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      admin_key: 'smartgram-admin-2024', // Set as default
      user_id: uploadUserId,
      device_hash: uploadDeviceHash,
      file_name: uploadFile.name,
      file_content: fileContent,
      file_size: uploadFile.size
    })
  });
};
```

### User Package Download System

**Backend Download Handler:**
```typescript
async function handleUserPackageDownload(request: Request, env: any, packageId: string) {
  // Fetch package from database
  const { data: packageData } = await supabase
    .from('user_packages')
    .select('*')
    .eq('id', packageId)
    .single();

  // Convert base64 to binary (Cloudflare Workers compatible)
  const binaryString = atob(packageData.file_content);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  // Return as downloadable file
  return new Response(bytes, {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${packageData.file_name}"`
    }
  });
}
```

**Frontend Download UI (`app/components/DashboardContent.tsx`):**
```typescript
const handleDownloadPackage = async (packageId: string) => {
  const response = await fetch(`/api/user-packages/download/${packageId}`, {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });

  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  window.URL.revokeObjectURL(url);
};
```

### Key Implementation Details

1. **Base64 Encoding**: Files are converted to base64 on frontend before upload
2. **Binary Conversion**: Use `atob()` and `Uint8Array` for Cloudflare Workers compatibility (no Buffer API)
3. **Admin Authentication**: Simple key-based auth with `smartgram-admin-2024`
4. **Package Versioning**: Auto-generate version string with timestamp
5. **Active Package Management**: Only one active package per user/device combination

### Troubleshooting Tips

- **500 Errors**: Check environment variables are passed to handlers
- **Upload Failures**: Verify admin_key is set correctly (default: 'smartgram-admin-2024')
- **Download Issues**: Ensure proper base64 to binary conversion
- **CORS Errors**: All responses must include `'Access-Control-Allow-Origin': '*'`