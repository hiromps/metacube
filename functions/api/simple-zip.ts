// Simple ZIP file creation for AutoTouch compatibility
// Based on discovery that .ate files are actually standard ZIP files

export interface SimpleZipEntry {
  name: string
  content: string | Uint8Array
  isText: boolean
}

export interface SimpleZipResult {
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

// Create simple ZIP file (no encryption)
export function createSimpleZIP(files: SimpleZipEntry[]): SimpleZipResult {
  console.log(`📦 Creating simple ZIP with ${files.length} files (no encryption)`)

  const zipEntries: Array<{
    name: string
    data: Uint8Array
    crc32: number
    localHeaderOffset: number
  }> = []

  let zipData = new Uint8Array(0)
  let currentOffset = 0

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

    // Calculate CRC32
    const crc32 = CRC32.calculate(fileBytes)

    // Create local file header
    const filenameBytes = new TextEncoder().encode(file.name)
    const localHeader = new Uint8Array(30 + filenameBytes.length)
    const headerView = new DataView(localHeader.buffer)

    let offset = 0

    // Local file header signature
    headerView.setUint32(offset, 0x04034b50, true) // PK\x03\x04
    offset += 4

    // Version needed to extract (2.0)
    headerView.setUint16(offset, 20, true)
    offset += 2

    // General purpose bit flag (0 = no encryption, no compression)
    headerView.setUint16(offset, 0, true)
    offset += 2

    // Compression method (0 = stored/no compression)
    headerView.setUint16(offset, 0, true)
    offset += 2

    // Last mod time & date (current time)
    const now = new Date()
    const dosTime = ((now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1))
    const dosDate = (((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate())
    headerView.setUint16(offset, dosTime, true)
    offset += 2
    headerView.setUint16(offset, dosDate, true)
    offset += 2

    // CRC-32
    headerView.setUint32(offset, crc32, true)
    offset += 4

    // Compressed size (same as uncompressed since no compression)
    headerView.setUint32(offset, fileBytes.length, true)
    offset += 4

    // Uncompressed size
    headerView.setUint32(offset, fileBytes.length, true)
    offset += 4

    // Filename length
    headerView.setUint16(offset, filenameBytes.length, true)
    offset += 2

    // Extra field length (0)
    headerView.setUint16(offset, 0, true)
    offset += 2

    // Filename
    localHeader.set(filenameBytes, offset)

    // Combine header + data
    const totalSize = localHeader.length + fileBytes.length
    const newZipData = new Uint8Array(zipData.length + totalSize)
    newZipData.set(zipData)
    newZipData.set(localHeader, zipData.length)
    newZipData.set(fileBytes, zipData.length + localHeader.length)
    zipData = newZipData

    zipEntries.push({
      name: file.name,
      data: fileBytes,
      crc32: crc32,
      localHeaderOffset: currentOffset
    })

    currentOffset += totalSize
    console.log(`✅ Added: ${file.name} (${fileBytes.length} bytes, CRC32: ${crc32.toString(16)})`)
  }

  // Create central directory
  const centralDirectoryOffset = zipData.length
  let centralDirectorySize = 0

  for (const entry of zipEntries) {
    const filenameBytes = new TextEncoder().encode(entry.name)
    const centralHeader = new Uint8Array(46 + filenameBytes.length)
    const centralView = new DataView(centralHeader.buffer)

    let offset = 0

    // Central file header signature
    centralView.setUint32(offset, 0x02014b50, true) // PK\x01\x02
    offset += 4

    // Version made by
    centralView.setUint16(offset, 20, true)
    offset += 2

    // Version needed to extract
    centralView.setUint16(offset, 20, true)
    offset += 2

    // General purpose bit flag
    centralView.setUint16(offset, 0, true)
    offset += 2

    // Compression method
    centralView.setUint16(offset, 0, true)
    offset += 2

    // Last mod time
    const now = new Date()
    const dosTime = ((now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1))
    const dosDate = (((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate())
    centralView.setUint16(offset, dosTime, true)
    offset += 2
    centralView.setUint16(offset, dosDate, true)
    offset += 2

    // CRC-32
    centralView.setUint32(offset, entry.crc32, true)
    offset += 4

    // Compressed size
    centralView.setUint32(offset, entry.data.length, true)
    offset += 4

    // Uncompressed size
    centralView.setUint32(offset, entry.data.length, true)
    offset += 4

    // Filename length
    centralView.setUint16(offset, filenameBytes.length, true)
    offset += 2

    // Extra field length
    centralView.setUint16(offset, 0, true)
    offset += 2

    // File comment length
    centralView.setUint16(offset, 0, true)
    offset += 2

    // Disk number start
    centralView.setUint16(offset, 0, true)
    offset += 2

    // Internal file attributes
    centralView.setUint16(offset, 0, true)
    offset += 2

    // External file attributes
    centralView.setUint32(offset, 0x20000000, true)
    offset += 4

    // Relative offset of local header
    centralView.setUint32(offset, entry.localHeaderOffset, true)
    offset += 4

    // Filename
    centralHeader.set(filenameBytes, offset)

    // Add to ZIP
    const newZipData = new Uint8Array(zipData.length + centralHeader.length)
    newZipData.set(zipData)
    newZipData.set(centralHeader, zipData.length)
    zipData = newZipData

    centralDirectorySize += centralHeader.length
  }

  // End of central directory record
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

  console.log(`✅ Simple ZIP created: ${finalZipData.length} bytes with ${zipEntries.length} files`)

  return {
    zipBuffer: finalZipData.buffer,
    fileCount: zipEntries.length
  }
}