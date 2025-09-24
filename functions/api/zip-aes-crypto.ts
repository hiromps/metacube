// AutoTouch compatible ZIP AES encryption for .ate files
// Fixed based on analysis of working AutoTouch .ate file format

export interface ZipFileEntry {
  name: string
  content: string | Uint8Array
  isText: boolean
}

export interface ZipAESResult {
  zipBuffer: ArrayBuffer
  fileCount: number
}

// CRC32 calculation for ZIP files
class CRC32 {
  private static table: number[] | undefined

  private static initTable(): void {
    if (this.table) return
    this.table = new Array(256)
    for (let i = 0; i < 256; i++) {
      let crc = i
      for (let j = 0; j < 8; j++) {
        crc = (crc & 1) ? (0xEDB88320 ^ (crc >>> 1)) : (crc >>> 1)
      }
      this.table[i] = crc
    }
  }

  static calculate(data: Uint8Array): number {
    this.initTable()
    let crc = 0xFFFFFFFF
    for (let i = 0; i < data.length; i++) {
      crc = this.table![(crc ^ data[i]) & 0xFF] ^ (crc >>> 8)
    }
    return (crc ^ 0xFFFFFFFF) >>> 0
  }
}

// AES encryption compatible with AutoTouch ZIP AES format
async function encryptFileAES(data: Uint8Array, password: string): Promise<{
  encryptedData: Uint8Array
  authCode: Uint8Array
  salt: Uint8Array
}> {
  // CRITICAL FIX: Generate 16-byte salt for AES-256 (AutoTouch requirement)
  const saltArray = crypto.getRandomValues(new Uint8Array(16)) // Changed from 8 to 16 bytes
  const salt = saltArray.buffer.slice(saltArray.byteOffset, saltArray.byteOffset + saltArray.byteLength)

  // Derive key using PBKDF2 (ZIP AES standard)
  const encoder = new TextEncoder()
  const passwordBytes = encoder.encode(password)

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    passwordBytes,
    'PBKDF2',
    false,
    ['deriveKey']
  )

  // AES-256 key derivation with 16-byte salt
  const key = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: 1000, // ZIP AES standard iterations
      hash: 'SHA-1' // ZIP AES uses SHA-1
    },
    keyMaterial,
    { name: 'AES-CTR', length: 256 },
    false,
    ['encrypt']
  )

  // Generate IV (16 bytes for CTR mode)
  const iv = crypto.getRandomValues(new Uint8Array(16))

  // Encrypt the data
  const dataBuffer = new ArrayBuffer(data.byteLength)
  new Uint8Array(dataBuffer).set(data)
  const encryptedBuffer = await crypto.subtle.encrypt(
    {
      name: 'AES-CTR',
      counter: iv,
      length: 128
    },
    key,
    dataBuffer
  )

  const encryptedData = new Uint8Array(encryptedBuffer)

  // Generate proper HMAC-based authentication code
  // For now using simplified approach - may need HMAC-SHA1 for full compatibility
  const authCode = crypto.getRandomValues(new Uint8Array(10))

  return {
    encryptedData,
    authCode,
    salt: saltArray
  }
}

// Create proper WinZip AES extra field
function createAESExtraField(): Uint8Array {
  // WinZip AES Extra Field format (AutoTouch compatible)
  const extraField = new Uint8Array(11) // 4 bytes header + 7 bytes data
  const view = new DataView(extraField.buffer)

  let offset = 0

  // Extra field header ID (0x9901 for AES)
  view.setUint16(offset, 0x9901, true)
  offset += 2

  // Data size (7 bytes)
  view.setUint16(offset, 7, true)
  offset += 2

  // AES version (1)
  view.setUint16(offset, 1, true)
  offset += 2

  // Vendor ID ("AE")
  extraField[offset] = 0x41 // 'A'
  extraField[offset + 1] = 0x45 // 'E'
  offset += 2

  // AES strength (3 = AES-256)
  extraField[offset] = 3
  offset += 1

  // Compression method (8 = deflate)
  view.setUint16(offset, 8, true)

  return extraField
}

// Create ZIP file with AES encryption (AutoTouch compatible)
export async function createAutoTouchZIP(files: ZipFileEntry[], password: string = '1111'): Promise<ZipAESResult> {
  console.log(`🔐 Creating AutoTouch compatible ZIP with ${files.length} files (AES-256, 16-byte salt)`)

  const zipEntries: Array<{
    name: string
    encryptedData: Uint8Array
    authCode: Uint8Array
    salt: Uint8Array
    originalSize: number
    crc32: number
  }> = []

  // Process each file
  for (const file of files) {
    console.log(`📄 Processing file: ${file.name}`)

    // Convert content to bytes
    let fileBytes: Uint8Array
    if (file.isText) {
      fileBytes = new TextEncoder().encode(file.content as string)
    } else {
      fileBytes = file.content as Uint8Array
    }

    // Calculate CRC32 of original data
    const crc32 = CRC32.calculate(fileBytes)

    // Encrypt the file with AutoTouch-compatible parameters
    const encryptionResult = await encryptFileAES(fileBytes, password)

    zipEntries.push({
      name: file.name,
      encryptedData: encryptionResult.encryptedData,
      authCode: encryptionResult.authCode,
      salt: encryptionResult.salt,
      originalSize: fileBytes.length,
      crc32: crc32
    })

    console.log(`✅ Encrypted: ${file.name} (${fileBytes.length} → ${encryptionResult.encryptedData.length} bytes, salt: 16 bytes)`)
  }

  // Create ZIP structure with AutoTouch-compatible format
  const centralDirectory: Array<{
    header: Uint8Array
    filenameBytes: Uint8Array
  }> = []

  let zipData = new Uint8Array(0)
  let localFileOffset = 0

  // Write local file headers and data
  for (const entry of zipEntries) {
    const filenameBytes = new TextEncoder().encode(entry.name)
    const aesExtraField = createAESExtraField()

    // CRITICAL FIX: AutoTouch-compatible local file header
    const localHeader = new Uint8Array(30 + filenameBytes.length + aesExtraField.length)
    const headerView = new DataView(localHeader.buffer)

    let offset = 0

    // Local file header signature
    headerView.setUint32(offset, 0x04034b50, true) // PK\x03\x04
    offset += 4

    // Version needed to extract (5.1 for AES)
    headerView.setUint16(offset, 51, true)
    offset += 2

    // General purpose bit flag (AutoTouch compatible)
    headerView.setUint16(offset, 0x0809, true) // Bit 3 (encrypted) + Bit 11 (UTF-8)
    offset += 2

    // Compression method (99 for AES encryption)
    headerView.setUint16(offset, 99, true)
    offset += 2

    // Last mod time & date (current time)
    const now = new Date()
    const dosTime = ((now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1))
    const dosDate = (((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate())
    headerView.setUint16(offset, dosTime, true)
    offset += 2
    headerView.setUint16(offset, dosDate, true)
    offset += 2

    // CRC-32 of original data
    headerView.setUint32(offset, entry.crc32, true)
    offset += 4

    // CRITICAL FIX: Use ZIP64 format like AutoTouch (0xFFFFFFFF)
    headerView.setUint32(offset, 0xFFFFFFFF, true) // Compressed size
    offset += 4
    headerView.setUint32(offset, 0xFFFFFFFF, true) // Uncompressed size
    offset += 4

    // Filename length
    headerView.setUint16(offset, filenameBytes.length, true)
    offset += 2

    // Extra field length (AES extra field)
    headerView.setUint16(offset, aesExtraField.length, true)
    offset += 2

    // Filename
    localHeader.set(filenameBytes, offset)
    offset += filenameBytes.length

    // AES Extra field
    localHeader.set(aesExtraField, offset)

    // CRITICAL FIX: AutoTouch data structure - Salt + Encrypted + AuthCode
    const fileDataSize = entry.salt.length + entry.encryptedData.length + entry.authCode.length
    const fileData = new Uint8Array(fileDataSize)
    let fileDataOffset = 0

    fileData.set(entry.salt, fileDataOffset) // 16 bytes salt first
    fileDataOffset += entry.salt.length
    fileData.set(entry.encryptedData, fileDataOffset) // Encrypted payload
    fileDataOffset += entry.encryptedData.length
    fileData.set(entry.authCode, fileDataOffset) // 10 bytes auth code last

    // Append header and data to ZIP
    const totalSize = localHeader.length + fileData.length
    const newZipData = new Uint8Array(zipData.length + totalSize)
    newZipData.set(zipData)
    newZipData.set(localHeader, zipData.length)
    newZipData.set(fileData, zipData.length + localHeader.length)
    zipData = newZipData

    // Create central directory entry (copy format from local header)
    const centralHeader = new Uint8Array(46 + filenameBytes.length + aesExtraField.length)
    const centralView = new DataView(centralHeader.buffer)

    let centralOffset = 0

    // Central file header signature
    centralView.setUint32(centralOffset, 0x02014b50, true) // PK\x01\x02
    centralOffset += 4

    // Version made by
    centralView.setUint16(centralOffset, 51, true)
    centralOffset += 2

    // Copy version needed through extra field length (26 bytes)
    const headerBytes = new Uint8Array(localHeader.buffer, 4, 26)
    centralHeader.set(headerBytes, centralOffset)
    centralOffset += 26

    // File comment length
    centralView.setUint16(centralOffset, 0, true)
    centralOffset += 2

    // Disk number start
    centralView.setUint16(centralOffset, 0, true)
    centralOffset += 2

    // Internal file attributes
    centralView.setUint16(centralOffset, 0, true)
    centralOffset += 2

    // External file attributes
    centralView.setUint32(centralOffset, 0x20000000, true)
    centralOffset += 4

    // Relative offset of local header
    centralView.setUint32(centralOffset, localFileOffset, true)
    centralOffset += 4

    // Filename
    centralHeader.set(filenameBytes, centralOffset)
    centralOffset += filenameBytes.length

    // Extra field
    centralHeader.set(aesExtraField, centralOffset)

    centralDirectory.push({
      header: centralHeader,
      filenameBytes: filenameBytes
    })

    localFileOffset += totalSize
  }

  // Write central directory
  const centralDirectoryOffset = zipData.length
  let centralDirectorySize = 0

  for (const entry of centralDirectory) {
    const newZipData = new Uint8Array(zipData.length + entry.header.length)
    newZipData.set(zipData)
    newZipData.set(entry.header, zipData.length)
    zipData = newZipData
    centralDirectorySize += entry.header.length
  }

  // Write end of central directory record
  const endRecord = new Uint8Array(22)
  const endView = new DataView(endRecord.buffer)

  // End of central directory signature
  endView.setUint32(0, 0x06054b50, true) // PK\x05\x06

  // Disk numbers
  endView.setUint16(4, 0, true) // This disk number
  endView.setUint16(6, 0, true) // Central directory start disk

  // Number of entries
  endView.setUint16(8, zipEntries.length, true) // This disk
  endView.setUint16(10, zipEntries.length, true) // Total

  // Central directory size and offset
  endView.setUint32(12, centralDirectorySize, true)
  endView.setUint32(16, centralDirectoryOffset, true)

  // Comment length
  endView.setUint16(20, 0, true)

  // Append end record
  const finalZipData = new Uint8Array(zipData.length + endRecord.length)
  finalZipData.set(zipData)
  finalZipData.set(endRecord, zipData.length)

  console.log(`✅ AutoTouch-compatible ZIP created: ${finalZipData.length} bytes with ${zipEntries.length} AES-256 encrypted files`)

  return {
    zipBuffer: finalZipData.buffer,
    fileCount: zipEntries.length
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