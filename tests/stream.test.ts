import { CORNERS, isFormatPointInHost, isPointInHost, resizeHost, rotateHost } from '../src/stream/transform'
import { describe, expect, it } from 'vitest'
import { coverRect, defaultLayout, FORMATS, hostRect, newStreamDocument } from '../src/stream/model'

describe('stream output geometry', () => {
  it('provides the three requested exact output dimensions and independent layouts', () => {
    expect(FORMATS.map((f) => [f.width, f.height])).toEqual([
      [900, 1200],
      [1024, 1024],
      [1200, 1200],
    ])
    const doc = newStreamDocument()
    doc.layouts.hero.zoom = 180
    expect(doc.layouts.host.zoom).toBe(100)
    expect(doc.layouts.stream.zoom).toBe(100)
    expect(doc.layouts.host.background).toBe('gradient')
  })
  it('fits the visible host without stretching and ignores transparent padding', () => {
    const f = FORMATS[0],
      layout = defaultLayout(f.id)
    const r = hostRect(f, layout, { x: 200, y: 100, width: 400, height: 800 })
    expect(r.width / r.height).toBe(0.5)
    expect(r.height).toBeCloseTo(1104)
    expect(r.width).toBeLessThanOrEqual(f.width * 0.9)
    expect(r.y + r.height / 2).toBeCloseTo(1200)
    const zoomed = hostRect(f, { ...layout, zoom: 200 }, { x: 0, y: 0, width: 400, height: 800 })
    expect(zoomed.width).toBeCloseTo(r.width * 2)
  })
  it('covers square canvases with supplied portrait backgrounds without stretching', () => {
    const f = FORMATS[1],
      layout = defaultLayout(f.id)
    const r = coverRect(900, 1200, f, layout)
    expect(r.width).toBe(1024)
    expect(r.height).toBeCloseTo((1024 * 4) / 3)
    expect(r.y).toBeCloseTo((1024 - r.height) / 2)
    expect(coverRect(900, 1200, f, { ...layout, backgroundY: 100 }).y + r.height).toBeCloseTo(1024)
  })
})

describe('direct host transforms', () => {
  const format = FORMATS[0]
  const bounds = { x: 70, y: 55, width: 160, height: 320 }
  for (const rotation of [0, 37, -90]) {
    for (const corner of CORNERS) {
      it(`resizes ${corner} at ${rotation} degrees with its opposite corner anchored`, () => {
        const layout = { ...defaultLayout('hero'), rotation, flip: true }
        const before = hostRect(format, layout, bounds)
        const radians = (rotation * Math.PI) / 180
        const dx = before.width * (corner.endsWith('left') ? -1 : 1)
        const dy = before.height * (corner.startsWith('top') ? -1 : 1)
        const vx = dx * Math.cos(radians) - dy * Math.sin(radians)
        const vy = dx * Math.sin(radians) + dy * Math.cos(radians)
        const next = resizeHost(format, layout, bounds, corner, { x: vx / 4, y: vy / 4 })
        const after = hostRect(format, { ...layout, ...next }, bounds)
        expect(next.zoom).toBe(125)
        expect(after.width / after.height).toBeCloseTo(0.5)
        expect(after.x - (vx * 1.25) / 2).toBeCloseTo(before.x - vx / 2)
        expect(after.y - (vy * 1.25) / 2).toBeCloseTo(before.y - vy / 2)
      })
    }
  }
  it('clamps resizing without flipping or producing a zero-size image', () => {
    const layout = defaultLayout('hero')
    expect(resizeHost(format, layout, bounds, 'bottom-right', { x: -9999, y: -9999 }).zoom).toBe(20)
    expect(resizeHost(format, layout, bounds, 'bottom-right', { x: 9999, y: 9999 }).zoom).toBe(300)
  })
  it('rotates clockwise, snaps by 15 degrees, and wraps across the angle boundary', () => {
    const center = { x: 100, y: 100 }
    expect(rotateHost(0, center, { x: 100, y: 0 }, { x: 200, y: 100 }, false)).toBe(90)
    expect(rotateHost(179, center, { x: 100, y: 0 }, { x: 200, y: 100 }, false)).toBe(-91)
    expect(rotateHost(4, center, { x: 100, y: 0 }, { x: 200, y: 100 }, true)).toBe(90)
  })
})

describe('host hit testing for framing controls', () => {
  const format = FORMATS[0] // 900x1200
  const layout = defaultLayout('hero') // x: 50, y: 54, rotation: 0
  const bounds = { x: 0, y: 0, width: 400, height: 800 }
  const rect = hostRect(format, layout, bounds) // center: (450, 648)

  it('detects hits inside unrotated host image', () => {
    expect(isFormatPointInHost({ x: rect.x, y: rect.y }, format, layout, bounds)).toBe(true)
    expect(isFormatPointInHost({ x: rect.x + rect.width * 0.45, y: rect.y }, format, layout, bounds)).toBe(true)
    expect(isFormatPointInHost({ x: rect.x, y: rect.y + rect.height * 0.45 }, format, layout, bounds)).toBe(true)
  })

  it('rejects points outside host image boundaries', () => {
    expect(isFormatPointInHost({ x: 50, y: 50 }, format, layout, bounds)).toBe(false)
    expect(isFormatPointInHost({ x: rect.x + rect.width * 0.6, y: rect.y }, format, layout, bounds)).toBe(false)
    expect(isFormatPointInHost({ x: rect.x, y: rect.y + rect.height * 0.6 }, format, layout, bounds)).toBe(false)
  })

  it('correctly handles rotated host hit testing', () => {
    const rotated = { ...layout, rotation: 90 }
    // When rotated 90 degrees, width and height visual axes swap
    expect(isFormatPointInHost({ x: rect.x, y: rect.y }, format, rotated, bounds)).toBe(true)
    // A point along the Y axis of original (height = 800) is now along the X axis
    expect(isFormatPointInHost({ x: rect.x + rect.height * 0.45, y: rect.y }, format, rotated, bounds)).toBe(true)
  })

  it('converts client viewport coordinates through canvas DOMRect', () => {
    const canvasRect = { left: 100, top: 200, width: 450, height: 600 } // scale factor = 0.5
    // Format center (450, 648) -> Client center: left + 450*0.5 = 325, top + 648*0.5 = 524
    expect(isPointInHost({ x: 325, y: 524 }, canvasRect, format, layout, bounds)).toBe(true)
    expect(isPointInHost({ x: 105, y: 205 }, canvasRect, format, layout, bounds)).toBe(false)
  })
})

