# AutoTouch .ate File Format Analysis

## Executive Summary

Analysis of the working AutoTouch .ate file reveals specific ZIP AES encryption parameters that differ significantly from our current implementation. The key findings indicate AutoTouch uses **AES-256** with **16-byte salt** and specific WinZip AES format requirements.

## Critical Findings

### 🔐 Encryption Specifications Found

| Parameter | Working AutoTouch File | Our Current Implementation | Status |
|-----------|----------------------|---------------------------|---------|
| **AES Key Size** | 256-bit (key size = 3) | 256-bit | ✅ **MATCH** |
| **Salt Size** | 16 bytes | 8 bytes | ❌ **MISMATCH** |
| **PBKDF2 Hash** | SHA-1 (inferred) | SHA-1 | ✅ **MATCH** |
| **PBKDF2 Iterations** | Unknown (likely 1000) | 1000 | ⚠️ **ASSUMED** |
| **AES Mode** | CTR (inferred) | CTR | ✅ **MATCH** |
| **Auth Code Size** | 10 bytes | 10 bytes | ✅ **MATCH** |
| **Extra Field Format** | WinZip AES | Custom | ❌ **MISMATCH** |

### 🏗️ ZIP Structure Analysis

**Working AutoTouch File Structure:**
```
File 1: worker.js
- Local Header: 70 bytes (includes AES extra field)
- Salt: 16 bytes (09275d93063ce269145d3b7811e54f4c)
- Encrypted Data: 822 bytes
- Auth Code: 10 bytes
- Total encrypted block: 848 bytes

File 2: index.js
- Local Header: 69 bytes (includes AES extra field)
- Salt: 16 bytes (5ad6caf256061db79891899367a95471)
- Encrypted Data: 187 bytes
- Auth Code: 10 bytes
- Total encrypted block: 213 bytes
```

### 🔍 Key Issues Identified

#### 1. **CRITICAL: Salt Size Mismatch**
- **AutoTouch expects**: 16-byte salt (for AES-256)
- **We generate**: 8-byte salt
- **Impact**: "Failed to decrypt package" error

#### 2. **CRITICAL: Extra Field Format**
- **AutoTouch uses**: Standard WinZip AES extra field format
- **We generate**: Custom/incomplete extra field
- **Impact**: AutoTouch cannot recognize proper AES parameters

#### 3. **ZIP64 Compressed Size Issue**
- **AutoTouch sets**: `compressed_size = 0xFFFFFFFF` (ZIP64 indicator)
- **We set**: Actual compressed size
- **Impact**: May cause parsing issues in AutoTouch

#### 4. **Flags Configuration**
- **AutoTouch uses**: `0x0809` (bit 3 + bit 11: encrypted + UTF-8)
- **We use**: `0x0809`
- **Status**: ✅ **CORRECT**

## 🔧 Required Fixes

### Priority 1: Critical Fixes

1. **Fix Salt Size for AES-256**
   ```typescript
   // Current (WRONG for AES-256)
   const saltArray = crypto.getRandomValues(new Uint8Array(8))

   // Required (CORRECT for AES-256)
   const saltArray = crypto.getRandomValues(new Uint8Array(16))
   ```

2. **Fix Extra Field Format**
   ```typescript
   // Required: Proper WinZip AES extra field
   // Header ID: 0x9901, Data Size: 7 bytes
   // Version: 0x0001, Vendor: "AE", Strength: 3 (AES-256), Method: 8 (deflate)
   const aesExtraField = new Uint8Array([
     0x01, 0x99, // AES header ID (little endian)
     0x07, 0x00, // Data size (7 bytes)
     0x01, 0x00, // AES version
     0x41, 0x45, // Vendor "AE"
     0x03,       // Strength (3 = AES-256)
     0x08, 0x00  // Compression method (8 = deflate)
   ])
   ```

3. **Fix Compressed Size Field**
   ```typescript
   // Use ZIP64 format like AutoTouch
   headerView.setUint32(offset, 0xFFFFFFFF, true) // Compressed size
   headerView.setUint32(offset + 4, 0xFFFFFFFF, true) // Uncompressed size
   ```

### Priority 2: Verification Fixes

4. **Key Derivation Parameters**
   - Verify PBKDF2 iterations count
   - Confirm SHA-1 hash function usage
   - Test key derivation with 16-byte salt

5. **Data Structure Order**
   ```
   Encrypted File Data = Salt(16) + EncryptedPayload + AuthCode(10)
   ```

## 🧪 Testing Strategy

### Phase 1: Salt Size Fix
1. Update salt generation to 16 bytes
2. Test with simple file
3. Verify AutoTouch can decrypt

### Phase 2: Extra Field Fix
1. Implement proper WinZip AES extra field
2. Test AutoTouch recognition
3. Verify compatibility

### Phase 3: Full Integration
1. Apply all fixes together
2. Test with complete .ate generation
3. Verify in AutoTouch environment

## 🎯 Expected Outcome

After implementing these fixes:
- AutoTouch should successfully decrypt our generated .ate files
- "Failed to decrypt package" error should be resolved
- "wrong password" error should be eliminated
- Full compatibility with AutoTouch encryption expectations

## 📋 Implementation Checklist

- [ ] Change salt size from 8 to 16 bytes for AES-256
- [ ] Implement proper WinZip AES extra field format
- [ ] Set compressed/uncompressed size to 0xFFFFFFFF
- [ ] Test key derivation with 16-byte salt
- [ ] Verify encrypted data structure order
- [ ] Test complete .ate file generation
- [ ] Validate in AutoTouch environment

## 🔬 Technical Details

### WinZip AES Extra Field Specification
```
Offset  Size  Description
------  ----  -----------
0       2     Extra field header ID (0x9901)
2       2     Data size (7)
4       2     AES version (1)
6       2     Vendor ID ("AE")
8       1     AES strength (1=128, 2=192, 3=256)
9       2     Compression method of encrypted data
```

### AES-256 Encryption Flow
```
Password → PBKDF2(SHA1, salt=16bytes, iter=1000) → 256-bit key
Data → AES-256-CTR(key, iv) → Encrypted + HMAC-SHA1 → AuthCode(10bytes)
Final: Salt(16) + Encrypted + AuthCode(10)
```

This analysis provides the roadmap to achieve AutoTouch compatibility with our generated .ate files.