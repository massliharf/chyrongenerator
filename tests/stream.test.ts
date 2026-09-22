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
