import { describe, expect, it } from 'vitest'
import { DEFAULT_PROJECT } from '../src/studio/model'
import { isPointInChyron, rotateChyron, scaleChyron, snapPosition } from '../src/studio/transform'

describe('chyron canvas transform & snapping', () => {
  const p = { ...DEFAULT_PROJECT, width: 720, height: 1280, x: 50, y: 50 }
  const bounds = {
    cx: 360,
    cy: 640,
    width: 400,
    height: 200,
    rotation: 0,
  }

  describe('snapPosition', () => {
    it('snaps horizontal position to center (50%) when within threshold', () => {
      const res = snapPosition(49.2, 30, p, bounds)
      expect(res.x).toBe(50)
      expect(res.snap.x).toEqual({ position: 50, label: 'Center' })
    })

    it('snaps vertical position to middle (50%) and lower third (75%)', () => {
      const middle = snapPosition(30, 50.8, p, bounds)
      expect(middle.y).toBe(50)
      expect(middle.snap.y).toEqual({ position: 50, label: 'Middle' })

      const lowerThird = snapPosition(30, 74.2, p, bounds)
      expect(lowerThird.y).toBe(75)
      expect(lowerThird.snap.y).toEqual({ position: 75, label: 'Lower Third' })
    })

    it('snaps to left safe area (10%) when left edge is close', () => {
      // hw = (400 / 720 * 100) / 2 = 27.777%
      const hw = ((bounds.width / p.width) * 100) / 2
      // target rawX for left edge at 10% is 10 + hw = 37.777%
      const res = snapPosition(38.0, 30, p, bounds)
      expect(res.x).toBeCloseTo(10 + hw, 1)
      expect(res.snap.x?.position).toBe(10)
      expect(res.snap.x?.label).toBe('Left Safe (10%)')
    })

    it('snaps to right safe area (90%) when right edge is close', () => {
      const hw = ((bounds.width / p.width) * 100) / 2
      // target rawX for right edge at 90% is 90 - hw = 62.222%
      const res = snapPosition(62.5, 30, p, bounds)
      expect(res.x).toBeCloseTo(90 - hw, 1)
      expect(res.snap.x?.position).toBe(90)
      expect(res.snap.x?.label).toBe('Right Safe (90%)')
    })

    it('does not snap when position is far from any snap guides', () => {
      const res = snapPosition(60, 40, p, bounds)
      expect(res.x).toBe(60)
      expect(res.y).toBe(40)
      expect(res.snap.x).toBeNull()
      expect(res.snap.y).toBeNull()
    })
  })

  describe('isPointInChyron', () => {
    const canvasRect = { left: 0, top: 0, width: 720, height: 1280 }

    it('detects clicks inside unrotated chyron bounds', () => {
      expect(isPointInChyron({ x: 360, y: 640 }, canvasRect, p, bounds)).toBe(true)
      expect(isPointInChyron({ x: 360 + 150, y: 640 + 80 }, canvasRect, p, bounds)).toBe(true)
    })

    it('rejects clicks outside chyron bounds', () => {
      expect(isPointInChyron({ x: 50, y: 50 }, canvasRect, p, bounds)).toBe(false)
      expect(isPointInChyron({ x: 360 + 250, y: 640 }, canvasRect, p, bounds)).toBe(false)
    })

    it('correctly handles rotated chyron hit testing', () => {
      const rotated = { ...bounds, rotation: 90 }
      // When rotated 90 degrees, width (400) extends along Y axis
      expect(isPointInChyron({ x: 360, y: 640 + 150 }, canvasRect, p, rotated)).toBe(true)
      // And along X axis extends only by height/2 (100)
      expect(isPointInChyron({ x: 360 + 150, y: 640 }, canvasRect, p, rotated)).toBe(false)
    })
  })

  describe('scaleChyron & rotateChyron', () => {
    const canvasRect = { left: 0, top: 0, width: 720, height: 1280 }

    it('increases scale when dragging outward', () => {
      const start = { x: 360 + 100, y: 640 + 100 }
      const current = { x: 360 + 150, y: 640 + 150 }
      const next = scaleChyron(100, canvasRect, p, start, current)
      expect(next).toBeGreaterThan(100)
    })

    it('decreases scale when dragging inward', () => {
      const start = { x: 360 + 100, y: 640 + 100 }
      const current = { x: 360 + 50, y: 640 + 50 }
      const next = scaleChyron(100, canvasRect, p, start, current)
      expect(next).toBeLessThan(100)
    })

    it('rotates clockwise and snaps to 15° with shiftKey', () => {
      const center = { x: 360, y: 640 }
      const start = { x: 360, y: 500 }
      const current = { x: 460, y: 500 }
      const free = rotateChyron(0, center, start, current, false)
      expect(free).toBeGreaterThan(0)

      const snapped = rotateChyron(0, center, start, current, true)
      expect(snapped % 15).toBe(0)
    })
  })
})
