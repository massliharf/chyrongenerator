import { describe, expect, it } from 'vitest'
import { DEFAULT_PROJECT, frameCount, normalizeProject } from '../src/studio/model'
import {
  exportAvailability,
  maxVideoSeconds,
  segmentFrames,
  yieldToBrowser,
} from '../src/studio/export'

describe('video export limits', () => {
  it('exports a one-minute hold at 720 × 1280 and 30 fps as WebM', () => {
    const p = normalizeProject({ ...DEFAULT_PROJECT, hold: 60 })
    expect(frameCount(p)).toBe(62 * 30)
    expect(maxVideoSeconds(p)).toBe(90)
    expect(exportAvailability('webm', p)).toBeNull()
    // ProRes keeps its single-pass budget: 45 s here, and says WebM goes further.
    expect(maxVideoSeconds(p, 'mov')).toBe(45)
    expect(exportAvailability('mov', p)).toMatch(/ProRes .* up to 45 seconds \(WebM up to 90\)/)
    expect(exportAvailability('mov', normalizeProject({ ...DEFAULT_PROJECT, hold: 40 }))).toBeNull()
  })
  it('explains the limit when a long Full HD clip would not fit in memory', () => {
    const p = normalizeProject({ ...DEFAULT_PROJECT, width: 1920, height: 1080, hold: 60, fps: 60 })
    const message = exportAvailability('webm', p)
    expect(message).toMatch(/up to \d+ seconds/)
    expect(exportAvailability('sequence', p)).toBeNull()
  })
  it('encodes in segments of a bounded size', () => {
    expect(segmentFrames({ width: 720, height: 1280 })).toBe(260)
    expect(segmentFrames({ width: 1920, height: 1080 })).toBe(115)
    expect(segmentFrames({ width: 3840, height: 3840 })).toBe(30)
  })
  it('yields without timers, in order', async () => {
    const order: number[] = []
    await Promise.all([1, 2, 3].map((n) => yieldToBrowser().then(() => order.push(n))))
    expect(order).toEqual([1, 2, 3])
  })
})
