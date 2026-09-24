import { describe, expect, it } from 'vitest'
import {
  DEFAULT_IMAGE_LAYER,
  DEFAULT_PROJECT,
  IMAGE_MOTIONS,
  HOLD_EFFECTS,
  chyronLayer,
  duration,
  frameCount,
  frameTime,
  hasArtwork,
  introLength,
  normalizeProject,
  parseProject,
  restTime,
  type ImageLayer,
  type Project,
} from '../src/studio/model'
import { imagePoseAt, imageTiming, poseAt } from '../src/studio/motion'
import {
  createImageLayer,
  duplicateLayer,
  fitWidth,
  moveLayer,
  removeLayer,
} from '../src/studio/layers'
import { snapImagePosition } from '../src/studio/transform'

const image = (patch: Partial<ImageLayer> = {}): ImageLayer => ({
  ...DEFAULT_IMAGE_LAYER,
  id: 'logo',
  assetId: 'asset-1',
  name: 'SHOWDOWN',
  aspect: 0.5,
  ...patch,
})
const withImage = (patch: Partial<ImageLayer> = {}, project: Partial<Project> = {}): Project =>
  normalizeProject({
    ...DEFAULT_PROJECT,
    ...project,
    layers: [...DEFAULT_PROJECT.layers, image(patch)],
  })

describe('layer schema', () => {
  it('keeps legacy projects working with a single chyron layer', () => {
    const p = parseProject('{"version":2,"text":"Existing","width":1920,"height":1080}')
    expect(p.layers).toEqual([
      { id: 'chyron', kind: 'chyron', name: 'Chyron', visible: true, delay: 0 },
    ])
  })
  it('round-trips image layers and clamps invalid values', () => {
    const p = normalizeProject({
      ...DEFAULT_PROJECT,
      layers: [
        image({ width: 9999, intro: 'nope' as never, outro: 'glitch', emphasis: 'shine' }),
        { kind: 'chyron', delay: 50, visible: false },
        { kind: 'chyron' },
        { kind: 'image', id: 'bad' },
        'junk',
      ],
    })
    expect(p.layers.map((l) => l.kind)).toEqual(['image', 'chyron'])
    const l = p.layers[0] as ImageLayer
    expect(l.width).toBe(400)
    expect(l.intro).toBe(DEFAULT_IMAGE_LAYER.intro)
    expect(l.outro).toBe('glitch')
    expect(l.emphasis).toBe('shine')
    expect(chyronLayer(p)).toMatchObject({ visible: false, delay: 10 })
    expect(normalizeProject(JSON.parse(JSON.stringify(p)))).toEqual(p)
  })
  it('adds a chyron layer when missing and rejects duplicate image ids', () => {
    const p = normalizeProject({ ...DEFAULT_PROJECT, layers: [image(), image()] })
    expect(p.layers.map((l) => l.id)).toEqual(['logo', 'chyron'])
  })
  it('counts image-only compositions as exportable artwork', () => {
    const hidden = normalizeProject({
      ...DEFAULT_PROJECT,
      layers: [{ ...chyronLayer(DEFAULT_PROJECT), visible: false }],
    })
    expect(hasArtwork(hidden)).toBe(false)
    expect(hasArtwork({ ...hidden, layers: [...hidden.layers, image()] })).toBe(true)
  })
})

describe('layer operations', () => {
  it('places logos on top and full-bleed photos at the back', () => {
    const logo = createImageLayer(DEFAULT_PROJECT, {
      id: 'a',
      name: 'showdown.png',
      width: 1000,
      height: 400,
      opaque: false,
    })
    expect(logo.layers.at(-1)).toBe(logo.layer)
    expect(logo.layer.name).toBe('showdown')
    const photo = createImageLayer(DEFAULT_PROJECT, {
      id: 'b',
      name: 'affidavit.jpg',
      width: 720,
      height: 1280,
      opaque: true,
    })
    expect(photo.layers[0]).toBe(photo.layer)
    expect(photo.layer.width).toBe(100)
    expect(photo.layer.intro).toBe('fade')
  })
  it('computes fit and fill widths for the canvas', () => {
    // 720 × 1280 canvas; a square image fits at 100% width and fills at 177.8%.
    expect(fitWidth(DEFAULT_PROJECT, 1, 'contain')).toBe(100)
    expect(fitWidth(DEFAULT_PROJECT, 1, 'cover')).toBe(177.8)
  })
  it('reorders, duplicates and removes layers but never the chyron', () => {
    const p = withImage()
    expect(moveLayer(p, 'logo', 'back').map((l) => l.id)).toEqual(['logo', 'chyron'])
    const copy = duplicateLayer(p, 'logo')
    expect(copy.layers).toHaveLength(3)
    expect(copy.layers[2].id).toBe(copy.id)
    expect(removeLayer(p, 'chyron')).toHaveLength(2)
    expect(removeLayer(p, 'logo').map((l) => l.id)).toEqual(['chyron'])
  })
  it('snaps image centers and edges', () => {
    expect(snapImagePosition(50.8, 20, 40, 20).x).toBe(50)
    const left = snapImagePosition(20.5, 50, 40, 20)
    expect(left.x).toBe(20)
    expect(left.snap.x?.label).toBe('Left edge')
    expect(snapImagePosition(140, -40, 10, 10)).toMatchObject({ x: 140, y: -40 })
  })
})

describe('image motion', () => {
  it('starts and ends transparent and settles at rest for every style and effect', () => {
    for (const intro of IMAGE_MOTIONS)
      for (const emphasis of HOLD_EFFECTS)
        for (const fps of [24, 30, 60] as const) {
          const p = withImage({ intro, emphasis, outro: 'mirror' }, { fps })
          const l = p.layers[1] as ImageLayer
          expect(imagePoseAt(frameTime(0, p), l, p).opacity, intro).toBe(0)
          expect(imagePoseAt(frameTime(frameCount(p) - 1, p), l, p).opacity, intro).toBe(0)
          const rest = imagePoseAt(restTime(p), l, p)
          expect(rest.opacity, `${intro} ${emphasis}`).toBe(1)
          expect(rest.reveal).toBe(1)
          expect(rest.blur).toBe(0)
          if (emphasis === 'none') {
            expect(rest.scale).toBeCloseTo(1, 6)
            expect(rest.x).toBeCloseTo(0, 6)
            expect(rest.y).toBeCloseTo(0, 6)
            expect(rest.rotation).toBeCloseTo(0, 6)
          }
        }
  })
  it('mirrors the intro in the outro by default', () => {
    const p = withImage({ intro: 'slide-left' })
    const l = p.layers[1] as ImageLayer
    const total = duration(p)
    for (const t of [0.1, 0.3, 0.6, 0.9]) {
      const a = imagePoseAt(t, l, p)
      const b = imagePoseAt(total - t, l, p)
      expect(b.x).toBeCloseTo(a.x, 6)
      expect(b.opacity).toBeCloseTo(a.opacity, 6)
    }
    expect(imagePoseAt(0.3, l, p).x).toBeLessThan(0)
  })
  it('uses a separate outro style when chosen', () => {
    const p = withImage({ intro: 'slide-left', outro: 'slide-right' })
    const l = p.layers[1] as ImageLayer
    expect(imagePoseAt(duration(p) - 0.3, l, p).x).toBeGreaterThan(0)
  })
  it('delays a layer symmetrically and is deterministic', () => {
    const p = withImage({ intro: 'pop', delay: 0.8 })
    const l = p.layers[1] as ImageLayer
    const total = duration(p)
    expect(imagePoseAt(0.7, l, p).opacity).toBe(0)
    expect(imagePoseAt(total - 0.7, l, p).opacity).toBe(0)
    expect(imagePoseAt(1.2, l, p).opacity).toBeGreaterThan(0)
    expect(imagePoseAt(1.2, l, p)).toEqual(imagePoseAt(1.2, l, p))
    expect(imageTiming(l, p).introEnd).toBeCloseTo(1.8)
    expect(introLength(p)).toBeCloseTo(1.8)
  })
  it('keeps delays and lengths inside the clip', () => {
    const p = withImage({ delay: 10, duration: 4 })
    const t = imageTiming(p.layers[1] as ImageLayer, p)
    expect(t.introEnd).toBeLessThanOrEqual(duration(p) / 2 + 1e-9)
    expect(t.outroStart).toBeGreaterThanOrEqual(duration(p) / 2 - 1e-9)
  })
  it('pushes Ken Burns continuously and sweeps shine during the hold', () => {
    const p = withImage({ emphasis: 'kenburns', emphasisStrength: 100 })
    const l = p.layers[1] as ImageLayer
    expect(imagePoseAt(0.5, l, p).contentZoom).toBeLessThan(imagePoseAt(3, l, p).contentZoom)
    const shine = withImage({ emphasis: 'shine', emphasisSpeed: 1 })
    const s = shine.layers[1] as ImageLayer
    const sweeps = Array.from({ length: 20 }, (_, i) => imagePoseAt(1.4 + i * 0.05, s, shine).shine)
    expect(sweeps.some((v) => v >= 0)).toBe(true)
    expect(imagePoseAt(0.2, s, shine).shine).toBe(-1)
  })
  it('bursts with sparks that finish by the end of the intro', () => {
    const p = withImage({ intro: 'burst' })
    const l = p.layers[1] as ImageLayer
    expect(imagePoseAt(0.4, l, p).sparks).toBeGreaterThan(0)
    expect(imagePoseAt(restTime(p), l, p).sparks).toBe(-1)
  })
})

describe('new on-screen effects', () => {
  it('orbit, wiggle and heartbeat are settled when the intro ends and the outro starts', () => {
    for (const emphasis of ['orbit', 'wiggle', 'heartbeat'] as const) {
      const p = withImage({ emphasis, emphasisStrength: 100, emphasisSpeed: 0.7 }, { hold: 3 })
      const l = p.layers[1] as ImageLayer
      const t = imageTiming(l, p)
      for (const time of [t.introEnd, t.outroStart]) {
        const pose = imagePoseAt(time, l, p)
        expect(((pose.rotation % 360) + 360) % 360, emphasis).toBeCloseTo(0, 6)
        expect(pose.scale, emphasis).toBeCloseTo(1, 6)
      }
    }
  })
  it('orbit completes whole turns during the hold', () => {
    const p = withImage({ emphasis: 'orbit', emphasisStrength: 100, emphasisSpeed: 1 }, { hold: 3 })
    const l = p.layers[1] as ImageLayer
    const t = imageTiming(l, p)
    expect(imagePoseAt(t.outroStart, l, p).rotation).toBeCloseTo(360 * 3, 6)
  })
})

describe('chyron delay', () => {
  it('delays the chyron intro and brings its outro forward', () => {
    const base = { ...DEFAULT_PROJECT, motion: 'fade' as const }
    const delayed = normalizeProject({
      ...base,
      layers: [{ ...chyronLayer(base), delay: 0.5 }],
    })
    expect(poseAt(0.45, 0, 1, delayed).opacity).toBe(0)
    expect(poseAt(0.45, 0, 1, base).opacity).toBeGreaterThan(0)
    expect(poseAt(duration(delayed) - 0.45, 0, 1, delayed).opacity).toBe(0)
    expect(poseAt(restTime(delayed), 0, 1, delayed).opacity).toBe(1)
  })
})
