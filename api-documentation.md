# SocialTouch API Documentation

## Base URL
- Development: `http://localhost:3000/api`
- Production: `https://your-domain.com/api`

## Endpoints

### 1. Device Registration
**POST** `/device/register`

Registers a new device with 3-day trial period.

#### Request Body
```json
{
  "device_hash": "a1b2c3d4e5f6g7h8",  // 16 character hex string
  "email": "user@example.com",
  "password": "secure_password"
}
```

#### Response
```json
{
  "success": true,
  "message": "Device registered successfully",
  "data": {
    "device_id": "uuid",
    "license_id": "uuid",
    "trial_ends_at": "2024-01-13T12:00:00Z",
    "user_id": "uuid"
  }
}
```

#### Error Responses
- `400` - Invalid input data
- `409` - Device already registered
- `500` - Server error

---

### 2. License Verification
**POST** `/license/verify`

Verifies license validity for AutoTouch scripts.

#### Request Body
```json
{
  "device_hash": "a1b2c3d4e5f6g7h8"
}
```

#### Response
```json
{
  "success": true,
  "is_valid": true,
  "status": "trial",  // or "active", "expired"
  "expires_at": "2024-01-13T12:00:00Z",
  "cached": false
}
```

#### Error Responses
- `400` - Invalid device hash format
- `404` - Device not found
- `500` - Server error

#### Caching
- Responses are cached for 24 hours
- Cached responses include `"cached": true`

---

### 3. PayPal Webhook
**POST** `/paypal/webhook`

Handles PayPal subscription events (Internal use only).

#### Processed Events
- `BILLING.SUBSCRIPTION.ACTIVATED`
- `BILLING.SUBSCRIPTION.CANCELLED`
- `BILLING.SUBSCRIPTION.EXPIRED`
- `PAYMENT.SALE.COMPLETED`
- `PAYMENT.SALE.REFUNDED`

---

### 4. PayPal Success Callback
**GET** `/paypal/success`

Handles successful PayPal subscription creation.

#### Query Parameters
- `device_hash` - Device identifier
- `subscription_id` - PayPal subscription ID

#### Response
Redirects to dashboard on success or register page on error.

---

## Integration with Lua Scripts

### Example Lua Implementation

```lua
local http = require("socket.http")
local json = require("json")

-- API Configuration
local API_BASE = "https://your-domain.com/api"
local DEVICE_HASH = "a1b2c3d4e5f6g7h8"  -- Generated from device ID

-- Verify License
function verifyLicense()
    local body = json.encode({
        device_hash = DEVICE_HASH
    })

    local response = http.request({
        url = API_BASE .. "/license/verify",
        method = "POST",
        headers = {
            ["Content-Type"] = "application/json",
            ["Content-Length"] = #body
        },
        source = ltn12.source.string(body)
    })

    local result = json.decode(response)

    if result.success and result.is_valid then
        return true, result.expires_at
    else
        return false, nil
    end
end

-- Cache license locally
local LICENSE_CACHE_FILE = "/var/mobile/Documents/license.cache"
local CACHE_DURATION = 24 * 60 * 60  -- 24 hours

function getCachedLicense()
    -- Read from local cache
    local file = io.open(LICENSE_CACHE_FILE, "r")
    if not file then return nil end

    local content = file:read("*all")
    file:close()

    local cache = json.decode(content)
    if cache and os.time() - cache.timestamp < CACHE_DURATION then
        return cache.is_valid
    end

    return nil
end

function saveLicenseCache(is_valid, expires_at)
    local cache = {
        is_valid = is_valid,
        expires_at = expires_at,
        timestamp = os.time()
    }

    local file = io.open(LICENSE_CACHE_FILE, "w")
    file:write(json.encode(cache))
    file:close()
end
```

---

## Environment Variables

Required environment variables for API operation:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# PayPal
PAYPAL_CLIENT_ID=
PAYPAL_CLIENT_SECRET=
PAYPAL_WEBHOOK_ID=
PAYPAL_WEBHOOK_SECRET=

# App
NEXT_PUBLIC_APP_URL=
```

---

## Security Notes

1. **Device Hash Validation**: All device hashes must be 16 character hex strings
2. **Rate Limiting**: Consider implementing rate limiting in production
3. **CORS**: Configure appropriate CORS headers for your domain
4. **HTTPS**: Always use HTTPS in production
5. **License Caching**: 24-hour cache reduces API load and improves performance

---

## Testing

### Test Device Registration
```bash
curl -X POST http://localhost:3000/api/device/register \
  -H "Content-Type: application/json" \
  -d '{"device_hash":"1234567890abcdef","email":"test@example.com","password":"password123"}'
```

### Test License Verification
```bash
curl -X POST http://localhost:3000/api/license/verify \
  -H "Content-Type: application/json" \
  -d '{"device_hash":"1234567890abcdef"}'
```