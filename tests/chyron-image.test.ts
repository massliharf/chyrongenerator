import { describe, expect, it } from 'vitest'
import {
  keepCropRatio,
  adjustFilter,
  cropOf,
  cropToRatio,
  FULL_CROP,
  maskPath,
  panCrop,
  resizeCrop,
  withCrop,
} from '../src/studio/crop'
import { DEFAULT_IMAGE_LAYER, normalizeImageLayer, type ImageLayer } from '../src/studio/model'
import { layerSnapTargets, snapImagePosition } from '../src/studio/transform'

const canvas = { width: 1920, height: 1080 }
// A 2:1 picture shown 50 % wide in the middle.
const layer = (over: Partial<ImageLayer> = {}): ImageLayer => ({
  ...DEFAULT_IMAGE_LAYER,
  id: 'a',
  assetId: 'asset',
  name: 'Photo',
  aspect: 0.5,
  width: 50,
  ...over,
})

describe('image crop', () => {
  it('keeps old projects uncropped and rectangular', () => {
    const l = normalizeImageLayer({ id: 'a', assetId: 'x', kind: 'image', aspect: 0.5 })!
    expect(l.mask).toBe('none')
    expect(l.crop).toBeUndefined()
    expect(cropOf(l)).toEqual(FULL_CROP)
    expect([l.brightness, l.contrast, l.saturation]).toEqual([100, 100, 100])
  })
  it('cropping the right half keeps the picture where it was', () => {
    const v = withCrop(layer(), { x: 0.5, y: 0, w: 0.5, h: 1 }, canvas)
    expect(v.width).toBeCloseTo(25)
    expect(v.aspect).toBeCloseTo(1)
    // The right half's centre was 12.5 % of the canvas right of the old centre.
    expect(v.x).toBeCloseTo(62.5)
    expect(v.y).toBeCloseTo(50)
  })
  it('mirrors the shift on flipped pictures', () => {
    const v = withCrop(layer({ flipX: true }), { x: 0.5, y: 0, w: 0.5, h: 1 }, canvas)
    expect(v.x).toBeCloseTo(37.5)
  })
  it('round-trips a crop through the normalizer', () => {
    const l = { ...layer(), ...withCrop(layer(), { x: 0.25, y: 0.1, w: 0.5, h: 0.8 }, canvas) }
    const back = normalizeImageLayer(JSON.parse(JSON.stringify(l)))!
    expect(back.crop).toEqual(l.crop)
    expect(back.sourceAspect).toBeCloseTo(0.5)
  })
  it('drags handles within the image and swaps sides when mirrored', () => {
    const full = { w: 1000, h: 500 }
    expect(resizeCrop(FULL_CROP, 'e', -250, 0, full, false)).toEqual({ x: 0, y: 0, w: 0.75, h: 1 })
    expect(resizeCrop(FULL_CROP, 'e', -250, 0, full, true)).toEqual({
      x: 0.25,
      y: 0,
      w: 0.75,
      h: 1,
    })
    // Cannot grow past the picture.
    expect(resizeCrop(FULL_CROP, 'w', -300, 0, full, false).x).toBe(0)
  })
  it('pans the picture inside the frame, clamped', () => {
    const c = { x: 0.25, y: 0, w: 0.5, h: 1 }
    expect(panCrop(c, 100, 0, { w: 1000, h: 500 }, false).x).toBeCloseTo(0.15)
    expect(panCrop(c, 5000, 0, { w: 1000, h: 500 }, false).x).toBe(0)
  })
  it('crops to a visible square on a wide picture', () => {
    const c = cropToRatio(layer(), 1)
    expect(c).toEqual({ x: 0.25, y: 0, w: 0.5, h: 1 })
  })
})

describe('ratio-locked crop', () => {
  const start = { x: 0.25, y: 0, w: 0.5, h: 1 }
  it('an edge drag shrinks both sides, centred on the other axis', () => {
    const c = keepCropRatio(start, { ...start, w: 0.25 }, 'e', 0.5)
    expect(c.w / c.h).toBeCloseTo(0.5)
    expect(c.x).toBeCloseTo(0.25)
    expect(c.y).toBeCloseTo(0.25)
  })
  it('a west-corner drag stays anchored on the east edge', () => {
    const c = keepCropRatio(start, { x: 0.4, y: 0.1, w: 0.35, h: 0.9 }, 'nw', 0.5)
    expect(c.x + c.w).toBeCloseTo(0.75)
    expect(c.y + c.h).toBeCloseTo(1)
    expect(c.w / c.h).toBeCloseTo(0.5)
  })
})

describe('image shape and colour', () => {
  it('has a path for every shape but the rectangle', () => {
    expect(maskPath('none', 0, 0, 10, 10)).toBeNull()
    for (const m of ['circle', 'arch', 'triangle', 'hexagon', 'star', 'heart'] as const)
      expect(maskPath(m, 0, 0, 10, 10)).toMatch(/Z$/)
  })
  it('only filters when something changed', () => {
    expect(adjustFilter({ brightness: 100, contrast: 100, saturation: 100 })).toBe('')
    expect(adjustFilter({ brightness: 120, contrast: 100, saturation: 0 })).toBe(
      'brightness(120%) saturate(0%)',
    )
  })
})

describe('image snapping', () => {
  const targets = layerSnapTargets([
    {
      name: 'Chyron',
      box: { left: 10, right: 40, cx: 25, top: 70, bottom: 90, cy: 80, w: 30, h: 20 },
    },
  ])
  it('lines an edge up with another layer and names the guide', () => {
    // 16 % wide picture whose left edge is 0.6 % off the chyron's right edge.
    const r = snapImagePosition(48.6, 30, 16, 10, 1.5, targets)
    expect(r.x).toBe(48)
    expect(r.snap.x).toEqual({ position: 40, label: 'Chyron right' })
  })
  it('prefers the nearest line', () => {
    const r = snapImagePosition(25.4, 79.1, 6, 6, 1.5, targets)
    expect(r.snap.x?.label).toBe('Chyron center')
    expect(r.snap.y?.label).toBe('Chyron middle')
  })
  it('still snaps to the canvas without targets', () => {
    expect(snapImagePosition(49.2, 30, 20, 10).x).toBe(50)
  })
})
