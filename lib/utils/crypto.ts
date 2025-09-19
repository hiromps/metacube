import * as crypto from 'crypto'

/**
 * Generate a device hash from device information
 * This should match the Lua implementation
 */
export function generateDeviceHash(deviceId: string, model: string = 'iPhone'): string {
  const data = `${deviceId}:${model}:socialtouch`
  return crypto.createHash('sha256').update(data).digest('hex').substring(0, 16)
}

/**
 * Verify a device hash format
 */
export function isValidDeviceHash(hash: string): boolean {
  // Device hash should be 16 characters hex string
  return /^[a-f0-9]{16}$/.test(hash)
}

/**
 * Generate API key for service authentication
 */
export function generateApiKey(): string {
  return crypto.randomBytes(32).toString('hex')
}

/**
 * Hash password for comparison
 */
export function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password).digest('hex')
}