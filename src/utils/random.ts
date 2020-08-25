import { randomFillSync } from 'crypto'

export function randomBase64(numBytes = 16): string {
  const bytes = Buffer.alloc(numBytes)
  randomFillSync(bytes)
  return bytes.toString('base64')
}

export default { randomBase64 }
