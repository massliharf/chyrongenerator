import { describe, expect, it, vi } from 'vitest'
import { generateId } from '../src/utils/id'

describe('generateId', () => {
  const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

  it('generates a valid UUID string format', () => {
    const id = generateId()
    expect(id).toMatch(UUID_REGEX)
  })

  it('generates distinct IDs on consecutive calls', () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateId()))
    expect(ids.size).toBe(100)
  })

  it('falls back gracefully when crypto.randomUUID is not a function (insecure context)', () => {
    const originalCrypto = globalThis.crypto
    try {
      // Simulate non-secure context where crypto exists but randomUUID does not
      vi.stubGlobal('crypto', {
        getRandomValues: originalCrypto?.getRandomValues?.bind(originalCrypto),
      })
      const id = generateId()
      expect(id).toMatch(UUID_REGEX)
    } finally {
      vi.stubGlobal('crypto', originalCrypto)
    }
  })

  it('falls back to Math.random when crypto is completely undefined', () => {
    const originalCrypto = globalThis.crypto
    try {
      vi.stubGlobal('crypto', undefined)
      const id = generateId()
      expect(id).toMatch(UUID_REGEX)
    } finally {
      vi.stubGlobal('crypto', originalCrypto)
    }
  })
})
