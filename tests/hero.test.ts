import { describe, expect, it } from 'vitest'
import {
  GAP,
  HERO_SIZES,
  MORE_SIZES,
  compose,
  copyToOthers,
  defaultSet,
  duplicateArtboard,
  framingOf,
  fromStream,
  hostBox,
  layout,
  neighborsOf,
  parseHero,
  patchLook,
  placeOnArtboard,
  pruneHeroAssets,
  reconcile,
  resizeArtboard,
  setPresetSize,
  type HeroSet,
  type HostImage,
} from '../src/apps/hero/model'
import { createShape, createText, DEFAULT_DOC, type ImageLayer } from '../src/designer/model'
import { coverRect, defaultLayout, FORMATS, hostRect, newStreamDocument } from '../src/stream/model'
import { savvyKind } from '../src/utils/savvyFile'
import { formatTime, rulerSteps, rulerTicks, snapTo, tickLabel } from '../src/studio/timelineScale'

// Built-in backgrounds are measured in the browser; here they get a size.
for (const id of ['grid', 'savvy', 'super']) setPresetSize(id, { width: 1600, height: 1600 })

const HOST: HostImage = {
  asset: 'host',
  name: 'host.png',
  width: 1000,
  height: 1400,
  bounds: { x: 200, y: 100, width: 400, height: 800 },
}
const withHost = (set: HeroSet = defaultSet()) =>
  patchLook({ ...set, host: HOST, assets: { ...set.assets, host: 'data:host' } }, [], {})
const hosted = () => {
  const s = withHost()
  return { ...s, artboards: s.artboards.map((a) => compose(s, a)) }
}
const roles = (set: HeroSet, i: number) => set.artboards[i].doc.layers.map((l) => l.role ?? l.name)

describe('hero image sets', () => {
  it('start as the three stream images with their usual looks', () => {
    const s = defaultSet()
    expect(s.artboards.map((a) => [a.doc.name, a.doc.width, a.doc.height])).toEqual([
      ['Hero image', 900, 1200],
      ['Host card', 1024, 1024],
      ['Stream image', 1200, 1200],
    ])
    expect(s.artboards.map((a) => a.look.background)).toEqual(['grid', 'gradient', 'savvy'])
    // The hero image darkens its lower half for text; the others do not.
    expect(roles(s, 0)).toEqual(['background', 'shade'])
    expect(roles(s, 1)).toEqual(['background'])
    // Built-in backgrounds come with the set, by URL.
    expect(s.assets['bg:grid']).toMatch(/grid-blue\.png$/)
    expect(HERO_SIZES).toHaveLength(3)
    expect(MORE_SIZES.some((m) => m.width === 900 && m.height === 1200)).toBe(false)
  })

  it('draws the look the way stream images did', () => {
    const s = hosted()
    const [hero, card] = s.artboards
    expect(roles(s, 0)).toEqual(['background', 'host', 'shade'])
    // The host sits where stream images put it, without its transparent margins.
    const host = hero.doc.layers[1] as ImageLayer
    const r = hostRect(FORMATS[0], defaultLayout('hero'), HOST.bounds)
    expect(host.x + host.w / 2).toBeCloseTo(r.x)
    expect(host.y + host.h / 2).toBeCloseTo(r.y)
    expect([host.w, host.h]).toEqual([r.width, r.height])
    expect(host.crop).toEqual({ x: 200, y: 100, w: 400, h: 800 })
    // The background picture covers the artboard like before.
    const bg = hero.doc.layers[0]
    const c = coverRect(1600, 1600, FORMATS[0], defaultLayout('hero'))
    expect([bg.x, bg.y, bg.w, bg.h]).toEqual([c.x, c.y, c.width, c.height])
    // The host card's gradient runs from the lower left to the upper right.
    const g = card.doc.layers[0]
    expect(g.kind === 'rect' && g.gradient).toMatchObject({ x0: 0.15, y0: 1, x1: 0.85, y1: 0 })
    // Shadow and fade, measured on the artboard.
    const lit = patchLook(s, [hero.id], { shadow: 70, fade: 25 }).artboards[0]
    const h = lit.doc.layers[1] as ImageLayer
    expect(h.shadow).toMatchObject({
      enabled: true,
      opacity: 50,
      blur: 900 * 0.035,
      y: 1200 * 0.015,
    })
    expect((h.y + h.h * h.fade!.from) / 1200).toBeCloseTo(0.75)
    expect(h.y + h.h * h.fade!.to).toBeCloseTo(1200)
    // None: a transparent artboard, without the bottom shadow.
    const none = patchLook(s, [hero.id], { background: 'transparent' }).artboards[0]
    expect(none.doc.transparent).toBe(true)
    expect(none.doc.layers.map((l) => l.role)).toEqual(['host'])
  })

  it('takes edits back from the canvas: moving the host is framing, deleting turns a part off', () => {
    const s = hosted()
    const a = s.artboards[0]
    const host = a.doc.layers[1]
    const unit = hostBox(a.doc, { x: 50, y: 50, zoom: 100 }, HOST.bounds)
    const moved = { ...host, x: host.x + 90, y: host.y - 120, w: unit.w * 1.5, h: unit.h * 1.5 }
    const back = reconcile(s, a, { ...a.doc, layers: [a.doc.layers[0], moved, a.doc.layers[2]] })
    const f = framingOf(a.doc, moved, HOST.bounds)
    expect(back.look).toMatchObject({ x: f.x, y: f.y })
    expect(back.look.zoom).toBeCloseTo(150)
    // Added layers keep their place among the look's layers.
    const title = createText({ ...DEFAULT_DOC, width: 900, height: 1200 }, 'heading')
    const withTitle = reconcile(s, a, {
      ...a.doc,
      layers: [a.doc.layers[0], title, ...a.doc.layers.slice(1)],
    })
    expect(withTitle.doc.layers.map((l) => l.role ?? 'title')).toEqual([
      'background',
      'title',
      'host',
      'shade',
    ])
    // A duplicate of the host is an ordinary picture.
    const twice = reconcile(s, a, { ...a.doc, layers: [...a.doc.layers, { ...host, id: 'copy' }] })
    expect(twice.doc.layers.filter((l) => l.role === 'host')).toHaveLength(1)
    expect(twice.doc.layers.at(-1)).toMatchObject({ id: 'copy', locked: false })
    // Deleting look layers turns them off in the panel too.
    const bare = reconcile(s, a, { ...a.doc, layers: [] })
    expect(bare.look).toMatchObject({ background: 'transparent', bottomShadow: 0, hostOff: true })
    expect(bare.doc.layers).toEqual([])
  })

  it('resizes artboards with their look, and new sizes take the look along', () => {
    const s = hosted()
    const a = resizeArtboard(s, s.artboards[2].id, 1920, 1080).artboards[2]
    expect([a.doc.width, a.doc.height]).toEqual([1920, 1080])
    expect(a.doc.layers.map((l) => [l.x, l.w])[0]).toEqual([0, 1920])
    const host = a.doc.layers.find((l) => l.role === 'host')!
    expect(host.x + host.w / 2).toBeCloseTo(960)
  })

  it('reads Stream images sets, framings and colours included', () => {
    const old = newStreamDocument()
    old.layouts.host = {
      ...old.layouts.host,
      zoom: 140,
      x: 40,
      color: '#DC345A',
      color2: '#FFCA91',
    }
    const s = fromStream({
      name: 'Monday show',
      layouts: old.layouts,
      host: { ...HOST, id: 'host' },
      hostSrc: 'data:host',
      backgrounds: [{ id: 'mine', name: 'mine.png', width: 800, height: 600, src: 'data:bg' }],
    })
    expect(s.name).toBe('Monday show')
    expect(s.artboards[1].look).toMatchObject({ zoom: 140, x: 40, color: '#DC345A' })
    expect(s.assets).toMatchObject({ host: 'data:host', mine: 'data:bg' })
    expect(roles(s, 1)).toEqual(['background', 'host'])
    expect(s.backgrounds).toEqual([{ id: 'mine', name: 'mine.png', width: 800, height: 600 }])
  })

  it('lays artboards out in a row and places the others around the one being edited', () => {
    const s = defaultSet()
    expect(layout(s.artboards).map((a) => a.x)).toEqual([0, 900 + GAP, 900 + GAP + 1024 + GAP])
    const around = neighborsOf(s, s.artboards[1].id)
    expect(around.map((n) => n.x)).toEqual([-(900 + GAP), 1024 + GAP])
    // Neighbours see every picture of the set.
    expect(around[0].doc.assets).toBe(s.assets)
  })

  it('copies layers to other sizes in the same place, scaled to fit', () => {
    const square = { width: 1000, height: 1000 }
    const tall = { width: 900, height: 1200 }
    const badge = {
      ...createShape(DEFAULT_DOC, 'rect'),
      x: 700,
      y: 100,
      w: 200,
      h: 100,
      radius: 20,
    }
    const copy = placeOnArtboard(badge, square, tall)
    expect(copy.id).not.toBe(badge.id)
    // Uniform scale 0.9; the centre keeps its place relative to the artboard.
    expect([copy.w, copy.h, copy.kind === 'rect' && copy.radius]).toEqual([180, 90, 18])
    expect([copy.x + copy.w / 2, copy.y + copy.h / 2]).toEqual([720, 180])
    // A full-bleed layer covers the new artboard.
    const bg = { ...createShape(DEFAULT_DOC, 'rect'), x: 0, y: 0, w: 1000, h: 1000 }
    const cover = placeOnArtboard(bg, square, tall)
    expect([cover.w, cover.h, cover.x]).toEqual([1200, 1200, -150])
  })

  it('copies added layers to every artboard, duplicates and keeps only pictures in use', () => {
    const s = hosted()
    const logo = { ...createShape(DEFAULT_DOC, 'rect'), name: 'Logo' }
    const look = s.artboards[0].doc.layers
    // The look's own layers stay on their artboard.
    const copied = copyToOthers(s, s.artboards[0].id, [logo, ...look])
    expect(copied.artboards.map((a) => a.doc.layers.length)).toEqual([3, 3, 3])
    expect(copied.artboards[1].doc.layers.at(-1)!.name).toBe('Logo')
    const pruned = pruneHeroAssets({ ...copied, assets: { ...copied.assets, stale: 'data:x' } })
    expect(Object.keys(pruned.assets).sort()).toEqual(['bg:grid', 'bg:savvy', 'host'])
    const dup = duplicateArtboard(copied, copied.artboards[1].id)
    expect(dup.set.artboards[2].doc.name).toBe('Host card copy')
    expect(dup.set.artboards[2].look).toEqual(copied.artboards[1].look)
    expect(dup.set.artboards[2].doc.layers[0].id).not.toBe(copied.artboards[1].doc.layers[0].id)
  })

  it('reads its own .savvy files, and the app tells them apart', () => {
    const s = hosted()
    const json = JSON.stringify(s)
    expect(savvyKind(JSON.parse(json))).toBe('hero')
    const back = parseHero(json)
    expect(back.artboards).toHaveLength(3)
    expect(back.host).toEqual(HOST)
    expect(back.artboards[0].look).toEqual(s.artboards[0].look)
    expect(() => parseHero(JSON.stringify(DEFAULT_DOC))).toThrow('not a hero image set')
    expect(savvyKind(DEFAULT_DOC)).toBe('design')
  })
})

describe('timeline scale', () => {
  it('picks ruler steps for the zoom: frames close up, seconds far out', () => {
    expect(rulerSteps(177, 30)).toEqual({ major: 0.5, minor: 0.1 })
    expect(rulerSteps(2000, 30).major).toBeCloseTo(1 / 15)
    expect(rulerSteps(10, 30).major).toBe(10)
    // Small ticks never fall below one frame.
    const close = rulerSteps(5000, 30)
    expect(close.minor === 0 || close.minor >= 1 / 30 - 1e-9).toBe(true)
  })

  it('labels, snaps and formats times', () => {
    expect(rulerTicks(4.4, 1)).toEqual([0, 1, 2, 3, 4])
    expect(tickLabel(0.5, 0.5)).toBe('0.5s')
    expect(tickLabel(90, 30)).toBe('1:30')
    expect(snapTo(2.16, [0, 2.2, 4.4], 0.05)).toEqual({ value: 2.2, target: 2.2 })
    expect(snapTo(2.1, [0, 2.2, 4.4], 0.05)).toEqual({ value: 2.1, target: null })
    expect(formatTime(2.2, 30, 'seconds')).toBe('2.20')
    expect(formatTime(2.2, 30, 'frames')).toBe('00:02:06')
    expect(formatTime(75.5, 30, 'frames')).toBe('01:15:15')
  })
})
