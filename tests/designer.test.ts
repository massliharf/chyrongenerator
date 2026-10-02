import { describe, expect, it } from 'vitest'
import {
  bounds,
  buildTargets,
  clampCrop,
  hitLayer,
  normalizeAngle,
  resizeBox,
  snapMove,
} from '../src/designer/geometry'
import {
  createShape,
  DEFAULT_DOC,
  parseDoc,
  pruneAssets,
  type DesignDoc,
  type ShapeLayer,
} from '../src/designer/model'
import { align, distribute, maskWithShape, reorder } from '../src/designer/ops'
import { clipGroups, maskBaseOf } from '../src/designer/render'

function rect(doc: DesignDoc, x: number, y: number, w: number, h: number, name = 'r'): ShapeLayer {
  return { ...createShape(doc, 'rect'), name, x, y, w, h }
}
const doc = (layers: ShapeLayer[] = []): DesignDoc => ({ ...DEFAULT_DOC, layers })

describe('geometry', () => {
  it('bounds of a 90° rotated box swap its sides', () => {
    const b = bounds({ x: 0, y: 0, w: 200, h: 100, rotation: 90 })
    expect(b.w).toBeCloseTo(100)
    expect(b.h).toBeCloseTo(200)
    expect(b.x).toBeCloseTo(50)
  })
  it('hit-tests ellipses by their outline, not their box', () => {
    const e = { ...createShape(DEFAULT_DOC, 'ellipse'), x: 0, y: 0, w: 100, h: 100 }
    expect(hitLayer({ x: 50, y: 50 }, e)).toBe(true)
    expect(hitLayer({ x: 2, y: 2 }, e)).toBe(false)
  })
  it('resizes from the opposite corner and keeps ratio when asked', () => {
    const start = { x: 0, y: 0, w: 200, h: 100, rotation: 0 }
    const r = resizeBox(start, 'se', { x: 400, y: 120 }, { keepRatio: true })
    expect(r.x).toBeCloseTo(0)
    expect(r.w / r.h).toBeCloseTo(2)
    expect(r.w).toBeCloseTo(400)
  })
  it('keeps the opposite edge fixed when a rotated box is resized', () => {
    const start = { x: 0, y: 0, w: 200, h: 100, rotation: 90 }
    const r = resizeBox(start, 'e', { x: 100, y: 250 })
    // Rotated 90°: the west edge sits at world y = -50 and must stay there.
    const b = bounds({ ...r, rotation: 90 })
    expect(b.y).toBeCloseTo(-50)
  })
  it('normalizes angles into (-180, 180]', () => {
    expect(normalizeAngle(270)).toBe(-90)
    expect(normalizeAngle(-190)).toBe(170)
  })
  it('clamps crops inside the image', () => {
    expect(clampCrop({ x: -10, y: 50, w: 500, h: 80 }, 400, 100)).toEqual({
      x: 0,
      y: 20,
      w: 400,
      h: 80,
    })
  })
})

describe('snapping', () => {
  const a = rect(DEFAULT_DOC, 100, 100, 100, 100, 'a')
  const targets = buildTargets([a], new Set(), DEFAULT_DOC, true)
  it('snaps a moving edge to another layer’s edge and reports a guide', () => {
    const s = snapMove({ x: 203, y: 400, w: 50, h: 50 }, targets, 6, { snap: false, size: 10 })
    expect(s.dx).toBe(-3)
    expect(s.guides.some((g) => g.axis === 'x' && g.pos === 200)).toBe(true)
  })
  it('snaps centres to the artboard centre', () => {
    const s = snapMove({ x: 512, y: 700, w: 60, h: 60 }, targets, 6, { snap: false, size: 10 })
    expect(512 + s.dx + 30).toBe(540)
  })
  it('falls back to the grid when nothing is near', () => {
    const s = snapMove(
      { x: 333, y: 377, w: 10, h: 10 },
      buildTargets([], new Set(), DEFAULT_DOC, false),
      2,
      {
        snap: true,
        size: 40,
      },
    )
    expect(333 + s.dx).toBe(320)
    expect(377 + s.dy).toBe(360)
  })
})

describe('layer operations', () => {
  it('aligns a single layer to the artboard', () => {
    const d = doc([rect(DEFAULT_DOC, 10, 10, 100, 100)])
    const out = align(d, [d.layers[0].id], 'right')
    expect(out.layers[0].x).toBe(DEFAULT_DOC.width - 100)
  })
  it('distributes three layers evenly', () => {
    const d = doc([
      rect(DEFAULT_DOC, 0, 0, 10, 10),
      rect(DEFAULT_DOC, 13, 0, 10, 10),
      rect(DEFAULT_DOC, 100, 0, 10, 10),
    ])
    const out = distribute(
      d,
      d.layers.map((l) => l.id),
      'x',
    )
    expect(out.layers.map((l) => l.x)).toEqual([0, 50, 100])
  })
  it('reorders selected layers to the front', () => {
    const d = doc([
      rect(DEFAULT_DOC, 0, 0, 1, 1, 'a'),
      rect(DEFAULT_DOC, 0, 0, 1, 1, 'b'),
      rect(DEFAULT_DOC, 0, 0, 1, 1, 'c'),
    ])
    const out = reorder(d, new Set([d.layers[0].id]), 'front')
    expect(out.layers.map((l) => l.name)).toEqual(['b', 'c', 'a'])
  })
  it('masking puts a mask-only shape below and clips the layer to it', () => {
    const d = doc([rect(DEFAULT_DOC, 0, 0, 100, 100, 'photo')])
    const { doc: out, maskId } = maskWithShape(d, d.layers[0].id, 'ellipse')
    expect(out.layers.map((l) => l.name)).toEqual(['photo mask', 'photo'])
    expect(out.layers[1].clip).toBe(true)
    expect(out.layers[0].maskOnly).toBe(true)
    expect(maskBaseOf(out.layers, out.layers[1].id)?.id).toBe(maskId)
    expect(clipGroups(out.layers)).toHaveLength(1)
  })
})

describe('files', () => {
  it('drops unused image data before saving', () => {
    const d = { ...doc(), assets: { unused: 'data:x' } }
    expect(pruneAssets(d).assets).toEqual({})
  })
  it('rejects files that are not designs', () => {
    expect(() => parseDoc('{"hello":1}')).toThrow()
  })
  it('round-trips a design', () => {
    const d = doc([rect(DEFAULT_DOC, 1, 2, 3, 4)])
    expect(parseDoc(JSON.stringify(d)).layers[0]).toMatchObject({ x: 1, y: 2, w: 3, h: 4 })
  })
})
