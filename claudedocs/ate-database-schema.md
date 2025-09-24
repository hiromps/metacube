# .ate File Generation Database Schema

## Overview

This document describes the database schema and workflow for the SMARTGRAM .ate file generation system.

## Workflow

```
1. User purchases subscription → DB saves (device_hash, plan, purchase_date)
2. Trigger .ate generation queue → Template + Device info
3. Background process generates personalized .ate file
4. File encrypted with AES-256-GCM → Upload to Supabase Storage
5. Dashboard shows download link when ready
```

## New Tables

### `plans` - Subscription Plan Definitions

Defines available subscription tiers with tool access control:

```sql
- id UUID PRIMARY KEY
- name VARCHAR(50) UNIQUE -- 'basic', 'premium', 'enterprise'
- display_name VARCHAR(100) -- '基本プラン', 'プレミアムプラン'
- price_jpy INTEGER -- 2980, 8800, 15000
- tools JSONB -- ['timeline', 'story', 'follow'] - available tools
- max_devices INTEGER DEFAULT 1
- trial_days INTEGER DEFAULT 3
- is_active BOOLEAN DEFAULT TRUE
```

**Default Plans:**
- **⚡ STARTER (¥2,980)**: timeline, basic_analysis (1 device, 3-day trial)
- **🚀 PRO (¥6,980)**: timeline, follow, unfollow, target, video_training, advanced_analysis (3 devices, 3-day trial)
- **👑 MAX (¥15,800)**: All tools + unlimited + consultant + 24h_support + security (10 devices, 3-day trial)

### `ate_templates` - Template File Definitions

Stores base template configurations:

```sql
- id UUID PRIMARY KEY
- name VARCHAR(100) UNIQUE -- 'smartgram'
- version VARCHAR(20) -- '1.0.0'
- template_path VARCHAR(255) -- 'templates/smartgram.at/' in Storage
- file_structure JSONB -- Array of files in template
- required_variables JSONB -- ['device_hash', 'plan_tools', 'license_key']
- is_active BOOLEAN DEFAULT TRUE
```

**Template Structure:**
```json
{
  "file_structure": [
    {"file": "main.lua", "type": "lua", "required": true},
    {"file": "timeline.lua", "type": "lua", "required": false},
    {"file": "story.lua", "type": "lua", "required": false},
    {"file": "config.json", "type": "json", "required": true}
  ]
}
```

### `ate_files` - Generated File Tracking

Tracks generated .ate files per device:

```sql
- id UUID PRIMARY KEY
- device_id UUID REFERENCES devices(id)
- template_id UUID REFERENCES ate_templates(id)
- plan_id UUID REFERENCES plans(id)
- filename VARCHAR(255) -- 'device_hash_timestamp.ate'
- file_path VARCHAR(500) -- 'generated/device_hash/smartgram_123456.ate'
- file_size_bytes BIGINT
- checksum VARCHAR(64) -- SHA-256 hash
- encryption_key_hash VARCHAR(64) -- Hash of AES key
- generated_variables JSONB -- Actual values used
- generation_status VARCHAR(20) -- 'pending', 'success', 'failed'
- download_count INTEGER DEFAULT 0
- expires_at TIMESTAMPTZ -- Matches license expiry
- UNIQUE(device_id, template_id) -- One file per device per template
```

### `download_history` - Download Event Tracking

Logs all download events:

```sql
- id UUID PRIMARY KEY
- ate_file_id UUID REFERENCES ate_files(id)
- device_id UUID REFERENCES devices(id)
- download_ip INET
- user_agent TEXT
- status VARCHAR(20) -- 'completed', 'failed'
- bytes_downloaded BIGINT
- created_at TIMESTAMPTZ
```

### `file_generation_queue` - Async Processing Queue

Manages background file generation:

```sql
- id UUID PRIMARY KEY
- device_id UUID REFERENCES devices(id)
- template_id UUID REFERENCES ate_templates(id)
- priority INTEGER DEFAULT 5 -- 1=highest, 10=lowest
- status VARCHAR(20) -- 'queued', 'processing', 'completed', 'failed'
- generation_params JSONB -- Parameters for generation
- retry_count INTEGER DEFAULT 0
- max_retries INTEGER DEFAULT 3
```

## Helper Functions

### `get_device_plan_info(device_hash TEXT)`
Returns device's current plan and tool access:
```sql
SELECT device_id, plan_name, plan_tools, license_expires_at, is_valid
```

### `queue_ate_generation(device_hash TEXT, template_name TEXT, priority INTEGER)`
Queues .ate file generation for a device:
```sql
RETURNS UUID -- queue_id
```

### `complete_ate_generation(queue_id, file_path, file_size, checksum, encryption_key_hash)`
Marks generation as completed and creates ate_files record.

### `log_download(ate_file_id, download_ip, user_agent, bytes_downloaded)`
Logs download event and updates download counters.

### `get_download_info(device_hash TEXT)`
Returns download information for dashboard:
```sql
SELECT ate_file_id, filename, file_size_bytes, expires_at, download_count, is_ready
```

## Integration Points

### Existing Tables Updated

**`subscriptions` table:**
- Add `plan_id` reference to `plans.name`
- Use plan_id instead of hardcoded plan names

**`devices` table:**
- No changes needed - existing structure works

**`licenses` table:**
- No changes needed - expires_at used for file expiry

## Security & Access Control

### Row Level Security (RLS)
- Users can only access their own `ate_files`, `download_history`
- Plans and templates are readable by all authenticated users
- Generation queue items are user-restricted

### API Endpoints Integration

**`/api/ate/generate` (NEW)**
```typescript
POST /api/ate/generate
{
  "device_hash": "abc123",
  "template": "smartgram" // optional, default 'smartgram'
}
```

**`/api/ate/download/{ate_file_id}` (NEW)**
```typescript
GET /api/ate/download/{ate_file_id}
// Returns encrypted .ate file
// Logs download event
```

**`/api/ate/status` (NEW)**
```typescript
GET /api/ate/status?device_hash=abc123
{
  "is_ready": true,
  "filename": "abc123_1699999999.ate",
  "file_size": 1024000,
  "download_count": 3,
  "expires_at": "2024-01-01T00:00:00Z"
}
```

## File Generation Process

### 1. Template Processing
1. Read template files from `templates/smartgram.at/` in Supabase Storage
2. Replace variables in `main.lua`:
   ```lua
   local device_hash = "{{device_hash}}"
   local available_tools = {{plan_tools}} -- JSON array
   local license_key = "{{license_key}}"
   local expires_at = "{{expires_at}}"
   ```

### 2. File Assembly
1. Create temporary directory structure
2. Copy and process all template files
3. Include only tools available in user's plan
4. Generate `config.json` with user-specific settings

### 3. Encryption & Upload
1. Create `.ate` archive (ZIP format)
2. Encrypt entire archive with AES-256-GCM
3. Upload to `generated/{device_hash}/` in Storage
4. Store file metadata in `ate_files` table

### 4. Cleanup
1. Remove temporary files
2. Update generation queue status
3. Mark old .ate files as inactive

## Manual SQL Execution

Since Supabase CLI requires project permissions, execute these SQL files manually in Supabase Dashboard:

1. **SQL Editor** → New Query
2. Copy and paste content from:
   - `supabase/migrations/10_ate_file_system.sql`
   - `supabase/migrations/11_ate_helper_functions.sql`
3. Execute each file in order
4. Verify tables and functions are created

## Next Steps

1. **Background Worker**: Implement file generation processor
2. **API Endpoints**: Create `/api/ate/*` endpoints
3. **Dashboard Integration**: Add download section
4. **Testing**: Verify full workflow with test data

## Dependencies

- **Supabase Storage**: For template and generated file storage
- **Crypto**: Node.js crypto module for AES-256-GCM encryption
- **Background Jobs**: Queue processing system (consider using Supabase Edge Functions or external worker)

---

This schema supports the complete .ate file generation workflow while maintaining security, scalability, and integration with the existing SMARTGRAM system.