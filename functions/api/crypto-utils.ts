// AES-256-GCM encryption utilities for Cloudflare Workers
// Compatible with AutoTouch .ate file format

export interface EncryptionResult {
  encryptedData: ArrayBuffer
  iv: Uint8Array
  authTag: Uint8Array
}

// Convert password string to AES key using PBKDF2
export async function deriveKey(password: string, salt: ArrayBuffer): Promise<CryptoKey> {
  const encoder = new TextEncoder()
  const passwordBuffer = encoder.encode(password)

  // Import password as raw key material
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    passwordBuffer,
    'PBKDF2',
    false,
    ['deriveBits', 'deriveKey']
  )

  // Derive AES-256-GCM key
  return await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: 100000, // Standard iteration count
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  )
}

// Encrypt data using AES-256-GCM
export async function encryptData(data: ArrayBuffer, password: string): Promise<EncryptionResult> {
  try {
    // Generate random salt and IV
    const saltArray = crypto.getRandomValues(new Uint8Array(16)) // 128-bit salt
    const salt = saltArray.buffer.slice(saltArray.byteOffset, saltArray.byteOffset + saltArray.byteLength)
    const iv = crypto.getRandomValues(new Uint8Array(12))   // 96-bit IV for GCM

    // Derive encryption key
    const key = await deriveKey(password, salt)

    // Encrypt data
    const encryptedBuffer = await crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: iv,
        additionalData: saltArray // Use salt as additional authenticated data
      },
      key,
      data
    )

    // Extract authentication tag (last 16 bytes)
    const encryptedData = encryptedBuffer.slice(0, -16)
    const authTag = new Uint8Array(encryptedBuffer.slice(-16))

    return {
      encryptedData,
      iv,
      authTag
    }
  } catch (error) {
    console.error('❌ Encryption error:', error)
    throw new Error(`Encryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

// Create .ate file structure with encryption
export async function createAteFile(
  files: Record<string, string>,
  password: string = '1111'
): Promise<ArrayBuffer> {
  try {
    console.log('🔐 Creating encrypted .ate file...')

    // Create file structure similar to ZIP
    const fileEntries: Array<{
      name: string
      content: Uint8Array
    }> = []

    // Process each file
    for (const [filePath, content] of Object.entries(files)) {
      console.log(`📄 Processing file: ${filePath}`)

      // Convert content to bytes
      let contentBytes: Uint8Array
      if (filePath.endsWith('.png') || filePath.endsWith('.jpg')) {
        // Assume base64 encoded images
        const binaryString = atob(content)
        contentBytes = new Uint8Array(binaryString.length)
        for (let i = 0; i < binaryString.length; i++) {
          contentBytes[i] = binaryString.charCodeAt(i)
        }
      } else {
        // Text files (Lua scripts)
        const encoder = new TextEncoder()
        contentBytes = encoder.encode(content)
      }

      fileEntries.push({
        name: filePath,
        content: contentBytes
      })
    }

    // Create simple archive structure
    let totalSize = 0
    const headerSize = 4 + (fileEntries.length * 64) // Simple header: count + entries

    // Calculate total size needed
    for (const entry of fileEntries) {
      totalSize += entry.content.length
    }

    const archiveSize = headerSize + totalSize
    console.log(`📊 Archive size: ${archiveSize} bytes (${fileEntries.length} files)`)

    // Create archive buffer
    const archiveBuffer = new ArrayBuffer(archiveSize)
    const archiveView = new DataView(archiveBuffer)
    const archiveBytes = new Uint8Array(archiveBuffer)

    let offset = 0

    // Write file count
    archiveView.setUint32(offset, fileEntries.length, true)
    offset += 4

    // Write file headers (simplified structure)
    let dataOffset = headerSize
    for (const entry of fileEntries) {
      // Write filename (32 bytes max)
      const nameBytes = new TextEncoder().encode(entry.name)
      const nameLength = Math.min(nameBytes.length, 31)
      archiveBytes.set(nameBytes.slice(0, nameLength), offset)
      offset += 32

      // Write file size
      archiveView.setUint32(offset, entry.content.length, true)
      offset += 4

      // Write data offset
      archiveView.setUint32(offset, dataOffset, true)
      offset += 4

      dataOffset += entry.content.length
    }

    // Write file data
    dataOffset = headerSize
    for (const entry of fileEntries) {
      archiveBytes.set(entry.content, dataOffset)
      dataOffset += entry.content.length
    }

    console.log('📦 Archive created, encrypting with AES-256-GCM...')

    // Encrypt the entire archive
    const encryptionResult = await encryptData(archiveBuffer, password)

    // Create final .ate file structure
    // Format: [SALT:16][IV:12][AUTH_TAG:16][ENCRYPTED_DATA:N]
    const fileSalt = crypto.getRandomValues(new Uint8Array(16))
    const finalSize = 16 + 12 + 16 + encryptionResult.encryptedData.byteLength
    const finalBuffer = new ArrayBuffer(finalSize)
    const finalBytes = new Uint8Array(finalBuffer)

    let finalOffset = 0

    // Write salt
    finalBytes.set(fileSalt, finalOffset)
    finalOffset += 16

    // Write IV
    finalBytes.set(encryptionResult.iv, finalOffset)
    finalOffset += 12

    // Write auth tag
    finalBytes.set(encryptionResult.authTag, finalOffset)
    finalOffset += 16

    // Write encrypted data
    finalBytes.set(new Uint8Array(encryptionResult.encryptedData), finalOffset)

    console.log(`✅ .ate file created: ${finalSize} bytes encrypted`)
    return finalBuffer

  } catch (error) {
    console.error('❌ .ate file creation error:', error)
    throw new Error(`Failed to create .ate file: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

// Utility function to convert ArrayBuffer to base64 for download
export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}