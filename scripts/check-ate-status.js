#!/usr/bin/env node

const https = require('https')

const deviceHash = process.argv[2]

if (!deviceHash) {
  console.log('Usage: node scripts/check-ate-status.js <device_hash>')
  console.log('Example: node scripts/check-ate-status.js FFMZ3GTSJC6J')
  process.exit(1)
}

const url = `https://smartgram.jp/api/ate/status?device_hash=${deviceHash}`

console.log(`📊 Checking .ate file status for device: ${deviceHash}`)
console.log(`🔗 URL: ${url}\n`)

https.get(url, (res) => {
  let data = ''

  res.on('data', (chunk) => {
    data += chunk
  })

  res.on('end', () => {
    try {
      const result = JSON.parse(data)

      if (result.success) {
        console.log('✅ Status Check Successful')
        console.log(`📁 File Ready: ${result.is_ready ? '✅ YES' : '❌ NO'}`)

        if (result.is_ready) {
          console.log(`📄 Filename: ${result.filename}`)
          console.log(`📏 File Size: ${result.file_size_bytes} bytes`)
          console.log(`📥 Download Count: ${result.download_count}`)
          console.log(`🔗 Download URL: https://smartgram.jp${result.download_url}`)
          console.log(`⏰ Expires: ${result.expires_at}`)

          if (result.last_downloaded_at) {
            console.log(`📅 Last Downloaded: ${result.last_downloaded_at}`)
          }
        } else {
          console.log(`💬 Message: ${result.message}`)
        }
      } else {
        console.log('❌ Status Check Failed')
        console.log(`🚨 Error: ${result.error}`)
      }
    } catch (err) {
      console.error('❌ Failed to parse response:', err.message)
      console.log('Raw response:', data)
    }
  })
}).on('error', (err) => {
  console.error('❌ Request failed:', err.message)
})