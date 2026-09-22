/**
 * Safely generates a unique ID (UUID v4 format).
 * Works in both secure contexts (HTTPS/localhost) and insecure contexts (HTTP over LAN/host IP),
 * where `crypto.randomUUID` is not available.
 */
export function generateId(): string {
  if (typeof crypto !== 'undefined') {
    if (typeof crypto.randomUUID === 'function') {
      try {
        return crypto.randomUUID()
      } catch {
        // Fall through to getRandomValues or Math.random
      }
    }
    if (typeof crypto.getRandomValues === 'function') {
      try {
        return '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, (c) => {
          const num = +c
          return (
            num ^
            (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (num / 4)))
          ).toString(16)
        })
      } catch {
        // Fall through to Math.random
      }
    }
  }

  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}
