import {
  ARTBOARD_PRESETS,
  DEFAULT_DOC,
  DEFAULT_FILTERS,
  type DesignDoc,
  type ImageLayer,
  type Layer,
  type ShapeLayer,
} from '../../designer/model'
import {
  BACKGROUNDS,
  DEFAULT_FRAMING,
  FORMATS,
  defaultLayout,
  type Bounds,
  type FormatId,
  type Layout,
} from '../../stream/model'
import { generateId } from '../../utils/id'

/**
 * Hero image generator: the stream's hero image, host card and stream image
 * (and any other size) as artboards on one canvas. Every artboard keeps the
 * stream image settings — background, host framing, shadow and fade — which
 * become three layers the Designer draws (background, host photo, bottom
 * shadow); anything added on top is an ordinary Designer layer.
 */

/** The host photo, shared by every artboard; `bounds` is its visible (non-transparent) part. */
export interface HostImage {
  asset: string
  name: string
  width: number
  height: number
  bounds: Bounds
}
/** A background picture added to the set; its picture is `assets[id]`. */
export interface CustomBackground {
  id: string
  name: string
  width: number
  height: number
}
/** An artboard's stream image settings; `hostOff` leaves the host out of this artboard. */
export interface Look extends Layout {
  hostOff?: boolean
}
export interface Artboard {
  id: string
  /** Its layers and size; pictures live on the set (`assets` stays empty). */
  doc: DesignDoc
  look: Look
}
export interface HeroSet {
  version: 2
  kind: 'hero'
  name: string
  artboards: Artboard[]
  /** Pictures by id: data URLs, and built-in backgrounds by URL (`bg:<id>`). */
  assets: Record<string, string>
  host: HostImage | null
  backgrounds: CustomBackground[]
}
type Role = NonNullable<Layer['role']>
type Size = { width: number; height: number }
type Box = { x: number; y: number; w: number; h: number }

/** The stream's sizes first, then common social sizes. */
export const HERO_SIZES = FORMATS.map((f) => ({
  id: f.id,
  name: f.name,
  width: f.width,
  height: f.height,
}))
export const MORE_SIZES = ARTBOARD_PRESETS.filter(
  (p) => !HERO_SIZES.some((h) => h.width === p.width && h.height === p.height),
).map((p) => ({ ...p }))
/** Space between artboards on the canvas, in pixels. */
export const GAP = 160
export const MAX_BACKGROUNDS = 8
export const DEFAULT_NAME = 'Untitled hero set'

export const presetAsset = (id: string) => `bg:${id}`
export const isImageBackground = (background: string) =>
  background !== 'gradient' && background !== 'solid' && background !== 'transparent'
/** Stream images start with these looks; other sizes start like the host card. */
export const lookFor = (id: FormatId = 'host'): Look => defaultLayout(id)

/* ---------- Geometry (the stream image's own formulas) ---------- */

/** The host's box for a framing: fits the visible cut-out, centred at x/y (percent). */
export function hostBox(size: Size, look: Pick<Layout, 'x' | 'y' | 'zoom'>, bounds: Bounds): Box {
  const scale =
    (Math.min((size.width * 0.9) / bounds.width, (size.height * 0.92) / bounds.height) *
      look.zoom) /
    100
  const w = bounds.width * scale,
    h = bounds.height * scale
  return { x: (size.width * look.x) / 100 - w / 2, y: (size.height * look.y) / 100 - h / 2, w, h }
}
/** The framing a host layer's box stands for, so the canvas and the fields agree. */
export function framingOf(size: Size, layer: Layer, bounds: Bounds) {
  const unit = hostBox(size, { x: 50, y: 50, zoom: 100 }, bounds)
  return {
    x: ((layer.x + layer.w / 2) / size.width) * 100,
    y: ((layer.y + layer.h / 2) / size.height) * 100,
    zoom: (layer.w / unit.w) * 100,
    rotation: layer.rotation,
    flip: layer.flipX,
  }
}
/** A background picture's box covering the artboard, moved and zoomed by the look. */
export function coverBox(size: Size, image: Size, look: Layout): Box {
  const scale =
    (Math.max(size.width / image.width, size.height / image.height) * look.backgroundZoom) / 100
  const w = image.width * scale,
    h = image.height * scale
  return {
    x: ((size.width - w) * look.backgroundX) / 100,
    y: ((size.height - h) * look.backgroundY) / 100,
    w,
    h,
  }
}
/** The bottom `fade` % of the artboard fades the host out, wherever the host sits. */
function fadeFor(box: Box, size: Size, fade: number) {
  if (!fade || box.h <= 0) return undefined
  return {
    from: (size.height * (1 - fade / 100) - box.y) / box.h,
    to: (size.height - box.y) / box.h,
  }
}

/* ---------- The look as layers ---------- */

function base(name: string, role: Role, box: Box) {
  return {
    id: generateId(),
    name,
    role,
    x: box.x,
    y: box.y,
    w: Math.max(1, box.w),
    h: Math.max(1, box.h),
    rotation: 0,
    opacity: 100,
    visible: true,
    // The background and the shadow stay put while the host and added layers move.
    locked: role !== 'host',
    blend: 'normal' as const,
    clip: false,
    flipX: false,
    flipY: false,
    shadow: { enabled: false, color: '#000000', opacity: 35, blur: 24, x: 0, y: 12 },
  }
}
function rect(name: string, role: Role, box: Box, fill: string): ShapeLayer {
  return {
    ...base(name, role, box),
    kind: 'rect',
    sides: 6,
    points: 5,
    inner: 0.45,
    fill,
    fillEnabled: true,
    stroke: '#ffffff',
    strokeWidth: 0,
    radius: 0,
  }
}
function picture(
  name: string,
  role: Role,
  box: Box,
  asset: string,
  image: Size,
  crop?: Bounds,
): ImageLayer {
  const c = crop ?? { x: 0, y: 0, width: image.width, height: image.height }
  return {
    ...base(name, role, box),
    kind: 'image',
    asset,
    naturalW: image.width,
    naturalH: image.height,
    crop: { x: c.x, y: c.y, w: c.width, h: c.height },
    radius: 0,
    filters: { ...DEFAULT_FILTERS },
    stroke: '#ffffff',
    strokeWidth: 0,
  }
}

/** Natural sizes of the built-in backgrounds, needed to cover an artboard (see loadPresetSizes). */
const presetSizes = new Map<string, Size>()
export async function loadPresetSizes() {
  await Promise.all(
    BACKGROUNDS.filter((b) => !presetSizes.has(b.id)).map(
      (b) =>
        new Promise<void>((resolve) => {
          const img = new Image()
          img.onload = () => {
            presetSizes.set(b.id, { width: img.naturalWidth, height: img.naturalHeight })
            resolve()
          }
          img.onerror = () => resolve()
          img.src = b.url
        }),
    ),
  )
}
/** For tests and for pictures measured elsewhere. */
export const setPresetSize = (id: string, size: Size) => presetSizes.set(id, size)

/** The background as a layer, or null for None (the artboard is transparent). */
export function backgroundLayer(set: HeroSet, size: Size, look: Look): Layer | null {
  const full = { x: 0, y: 0, w: size.width, h: size.height }
  if (look.background === 'transparent') return null
  if (look.background === 'gradient')
    return {
      ...rect('Background', 'background', full, look.color),
      // The stream image's diagonal: from the lower left towards the upper right.
      gradient: {
        x0: 0.15,
        y0: 1,
        x1: 0.85,
        y1: 0,
        stops: [
          { at: 0, color: look.color },
          { at: 1, color: look.color2 },
        ],
      },
    }
  const custom = set.backgrounds.find((b) => b.id === look.background)
  const image = custom ?? presetSizes.get(look.background)
  const asset = custom ? custom.id : presetAsset(look.background)
  // Solid, or a picture not ready yet: the colour (pictures cover it once they arrive).
  if (look.background === 'solid' || !image || !set.assets[asset])
    return rect('Background', 'background', full, look.color)
  return picture('Background', 'background', coverBox(size, image, look), asset, image)
}

/** The host photo, framed, with the look's shadow and fade. */
export function hostLayer(host: HostImage, size: Size, look: Look): ImageLayer {
  const box = hostBox(size, look, host.bounds)
  const layer = picture('Host photo', 'host', box, host.asset, host, host.bounds)
  return {
    ...layer,
    rotation: look.rotation,
    flipX: look.flip,
    shadow: {
      enabled: look.shadow > 0,
      color: '#000000',
      opacity: (look.shadow / 140) * 100,
      blur: size.width * 0.035,
      x: 0,
      y: size.height * 0.015,
    },
    fade: fadeFor(box, size, look.fade),
  }
}

/** The bottom shadow: darkens the lower part for text, over the host. */
export function shadeLayer(size: Size, look: Look): ShapeLayer | null {
  if (!look.bottomShadow || look.background === 'transparent') return null
  const top = size.height * 0.45
  const a = (look.bottomShadow / 100) * 0.88
  return {
    ...rect(
      'Bottom shadow',
      'shade',
      { x: 0, y: top, w: size.width, h: size.height - top },
      '#000000',
    ),
    gradient: {
      x0: 0,
      y0: 0,
      x1: 0,
      y1: 1,
      stops: [
        { at: 0, color: 'rgba(0, 0, 0, 0)' },
        { at: 0.3, color: `rgba(0, 0, 0, ${a * 0.2})` },
        { at: 0.65, color: `rgba(0, 0, 0, ${a * 0.6})` },
        { at: 1, color: `rgba(0, 0, 0, ${a})` },
      ],
    },
  }
}

/** Where a missing look layer goes: the background at the bottom, the host on it, the shadow on the host. */
const UNDER: Record<Role, Role[]> = {
  background: [],
  host: ['background'],
  shade: ['host', 'background'],
}

/**
 * Brings an artboard's look layers up to date with its look. They keep their
 * place among the added layers and what the Designer lets people change on
 * any layer (name, visibility, opacity, blend, lock).
 */
export function compose(set: HeroSet, a: Artboard): Artboard {
  const size = a.doc
  const want: Record<Role, Layer | null> = {
    background: backgroundLayer(set, size, a.look),
    host: set.host && !a.look.hostOff ? hostLayer(set.host, size, a.look) : null,
    shade: shadeLayer(size, a.look),
  }
  const layers: Layer[] = []
  const placed = new Set<Role>()
  for (const l of a.doc.layers) {
    if (!l.role) layers.push(l)
    else if (!placed.has(l.role)) {
      placed.add(l.role)
      const next = want[l.role]
      if (next)
        layers.push({
          ...next,
          id: l.id,
          name: l.name,
          visible: l.visible,
          opacity: l.opacity,
          blend: l.blend,
          locked: l.locked,
        } as Layer)
    }
  }
  for (const role of ['background', 'host', 'shade'] as const) {
    const next = want[role]
    if (!next || placed.has(role)) continue
    const below = UNDER[role].map((r) => layers.findIndex((l) => l.role === r)).find((i) => i >= 0)
    layers.splice(below === undefined ? 0 : below + 1, 0, next)
  }
  return {
    ...a,
    doc: {
      ...a.doc,
      background: a.look.color,
      transparent: a.look.background === 'transparent',
      layers,
    },
  }
}

/**
 * Takes an artboard back from the Designer: moving, turning or resizing the
 * host changes its framing; deleting a look layer turns that part off. A copy
 * of a look layer (duplicate, paste) becomes an ordinary layer.
 */
export function reconcile(set: HeroSet, a: Artboard, doc: DesignDoc): Artboard {
  const seen = new Set<Role>()
  const layers = doc.layers.map((l) => {
    if (!l.role) return l
    if (!seen.has(l.role)) {
      seen.add(l.role)
      return l
    }
    const copy = { ...l, locked: false }
    delete copy.role
    return copy
  })
  const look: Look = { ...a.look }
  const host = layers.find((l) => l.role === 'host')
  if (set.host) {
    if (host) Object.assign(look, framingOf(doc, host, set.host.bounds))
    look.hostOff = !host
  }
  if (look.background !== 'transparent') {
    if (look.bottomShadow && !seen.has('shade')) look.bottomShadow = 0
    if (!seen.has('background')) look.background = 'transparent'
  }
  return compose(set, { ...a, look, doc: { ...doc, layers, assets: {} } })
}

/** Adds the built-in backgrounds the artboards use to the set's pictures. */
export function withPresets(set: HeroSet): HeroSet {
  const missing = set.artboards
    .map((a) => a.look.background)
    .filter((id) => BACKGROUNDS.some((b) => b.id === id) && !set.assets[presetAsset(id)])
  if (!missing.length) return set
  const assets = { ...set.assets }
  for (const id of missing) assets[presetAsset(id)] = BACKGROUNDS.find((b) => b.id === id)!.url
  return { ...set, assets }
}
/** Rebuilds every artboard's look layers (after the host, a background or the pictures change). */
export function composeAll(set: HeroSet): HeroSet {
  const ready = withPresets(set)
  return { ...ready, artboards: ready.artboards.map((a) => compose(ready, a)) }
}
/** Changes one artboard's look (or all of them) and redraws it. */
export function patchLook(set: HeroSet, ids: string[], values: Partial<Look>): HeroSet {
  const next = withPresets({
    ...set,
    artboards: set.artboards.map((a) =>
      ids.includes(a.id) ? { ...a, look: { ...a.look, ...values } } : a,
    ),
  })
  return {
    ...next,
    artboards: next.artboards.map((a) => (ids.includes(a.id) ? compose(next, a) : a)),
  }
}

/* ---------- Artboards ---------- */

export function newArtboard(
  set: HeroSet,
  name: string,
  width: number,
  height: number,
  look: Look,
): Artboard {
  return compose(set, {
    id: generateId(),
    doc: { ...structuredClone(DEFAULT_DOC), name, width, height, layers: [], assets: {} },
    look: { ...look },
  })
}
/** Changes an artboard's size; the look follows (it is measured in percent), added layers stay. */
export function resizeArtboard(set: HeroSet, id: string, width: number, height: number): HeroSet {
  return {
    ...set,
    artboards: set.artboards.map((a) =>
      a.id === id ? compose(set, { ...a, doc: { ...a.doc, width, height } }) : a,
    ),
  }
}

/** The stream's three images with their usual looks. */
export function defaultSet(): HeroSet {
  const set: HeroSet = {
    version: 2,
    kind: 'hero',
    name: DEFAULT_NAME,
    artboards: FORMATS.map((f) => ({
      id: generateId(),
      doc: {
        ...structuredClone(DEFAULT_DOC),
        name: f.name,
        width: f.width,
        height: f.height,
        layers: [],
        assets: {},
      },
      look: lookFor(f.id),
    })),
    assets: {},
    host: null,
    backgrounds: [],
  }
  return composeAll(set)
}

/** Artboards in a row, tops aligned, `GAP` apart. */
export function layout(artboards: Artboard[]) {
  let x = 0
  return artboards.map((a) => {
    const at = { id: a.id, x, y: 0 }
    x += a.doc.width + GAP
    return at
  })
}

/** The other artboards, placed relative to the one being edited. */
export function neighborsOf(set: HeroSet, activeId: string) {
  const places = layout(set.artboards)
  const origin = places.find((p) => p.id === activeId) ?? places[0]
  return set.artboards
    .filter((a) => a.id !== origin.id)
    .map((a) => {
      const at = places.find((p) => p.id === a.id)!
      return {
        id: a.id,
        x: at.x - origin.x,
        y: at.y - origin.y,
        doc: { ...a.doc, assets: set.assets },
      }
    })
}

/**
 * A copy of `layer` for an artboard of another size: it keeps its place
 * (relative to the artboard's centre) and is scaled uniformly to fit; a layer
 * that covered the whole artboard covers the new one.
 */
export function placeOnArtboard(layer: Layer, from: Size, to: Size): Layer {
  const covers =
    layer.x <= 0 &&
    layer.y <= 0 &&
    layer.x + layer.w >= from.width &&
    layer.y + layer.h >= from.height
  const k = covers
    ? Math.max(to.width / from.width, to.height / from.height)
    : Math.min(to.width / from.width, to.height / from.height)
  const w = Math.max(1, Math.round(layer.w * k))
  const h = Math.max(1, Math.round(layer.h * k))
  const cx = covers ? to.width / 2 : ((layer.x + layer.w / 2) / from.width) * to.width
  const cy = covers ? to.height / 2 : ((layer.y + layer.h / 2) / from.height) * to.height
  const copy = {
    ...structuredClone(layer),
    id: generateId(),
    w,
    h,
    x: Math.round(cx - w / 2),
    y: Math.round(cy - h / 2),
  } as Layer
  if (copy.kind === 'text') copy.size = Math.max(4, Math.round(copy.size * k))
  else {
    copy.radius = Math.round(copy.radius * k)
    copy.strokeWidth = Math.round(copy.strokeWidth * k)
  }
  return copy
}

/** Copies added layers from one artboard onto every other one, on top of their own. */
export function copyToOthers(set: HeroSet, fromId: string, layers: Layer[]): HeroSet {
  const from = set.artboards.find((a) => a.id === fromId)
  const own = layers.filter((l) => !l.role)
  if (!from || !own.length) return set
  return {
    ...set,
    artboards: set.artboards.map((a) =>
      a.id === fromId
        ? a
        : {
            ...a,
            doc: {
              ...a.doc,
              layers: [...a.doc.layers, ...own.map((l) => placeOnArtboard(l, from.doc, a.doc))],
            },
          },
    ),
  }
}

/** A copy of an artboard, placed right after it. */
export function duplicateArtboard(set: HeroSet, id: string): { set: HeroSet; id: string } {
  const index = set.artboards.findIndex((a) => a.id === id)
  if (index < 0) return { set, id }
  const source = set.artboards[index]
  const copy: Artboard = {
    id: generateId(),
    look: { ...source.look },
    doc: {
      ...structuredClone(source.doc),
      name: `${source.doc.name} copy`,
      layers: source.doc.layers.map((l) => ({ ...structuredClone(l), id: generateId() })),
    },
  }
  const artboards = [...set.artboards]
  artboards.splice(index + 1, 0, copy)
  return { set: { ...set, artboards }, id: copy.id }
}

/** Keeps only the pictures the host, the backgrounds or some layer still use. */
export function pruneHeroAssets(set: HeroSet): HeroSet {
  const used = new Set<string>([
    ...(set.host ? [set.host.asset] : []),
    ...set.backgrounds.map((b) => b.id),
    ...set.artboards.flatMap((a) =>
      a.doc.layers.flatMap((l) =>
        l.kind === 'image' ? [l.asset, ...(l.originalAsset ? [l.originalAsset] : [])] : [],
      ),
    ),
  ])
  return {
    ...set,
    assets: Object.fromEntries(Object.entries(set.assets).filter(([id]) => used.has(id))),
  }
}

/** Reads a saved set (.savvy); throws a readable error for anything else. */
export function parseHero(json: string): HeroSet {
  const raw = JSON.parse(json) as Partial<HeroSet>
  if (
    !raw ||
    raw.version !== 2 ||
    raw.kind !== 'hero' ||
    !Array.isArray(raw.artboards) ||
    !raw.artboards.length
  )
    throw new Error('This is not a hero image set.')
  return {
    version: 2,
    kind: 'hero',
    name: typeof raw.name === 'string' ? raw.name : DEFAULT_NAME,
    assets: raw.assets && typeof raw.assets === 'object' ? raw.assets : {},
    host: raw.host && typeof raw.host.asset === 'string' ? raw.host : null,
    backgrounds: Array.isArray(raw.backgrounds) ? raw.backgrounds : [],
    artboards: raw.artboards.map((a) => ({
      id: typeof a.id === 'string' ? a.id : generateId(),
      look: { ...lookFor(), ...(a.look ?? {}) },
      doc: {
        ...structuredClone(DEFAULT_DOC),
        ...a.doc,
        grid: { ...DEFAULT_DOC.grid, ...(a.doc?.grid ?? {}) },
        assets: {},
      } as DesignDoc,
    })),
  }
}

/* ---------- From the Stream images workspace ---------- */

/** What the old Stream images workspace kept: pictures as data URLs instead of blobs. */
export interface StreamDraft {
  name: string
  layouts: Record<FormatId, Layout>
  host: (HostImage & { id: string }) | null
  backgrounds: (CustomBackground & { src: string })[]
  hostSrc: string | null
}
/** A Stream images set as a hero set: the same three images, framed and coloured the same. */
export function fromStream(draft: StreamDraft): HeroSet {
  const assets: Record<string, string> = {}
  if (draft.host && draft.hostSrc) assets[draft.host.asset] = draft.hostSrc
  for (const b of draft.backgrounds) assets[b.id] = b.src
  return composeAll({
    version: 2,
    kind: 'hero',
    name: draft.name === 'Untitled stream set' ? DEFAULT_NAME : draft.name,
    assets,
    host:
      draft.host && draft.hostSrc
        ? {
            asset: draft.host.asset,
            name: draft.host.name,
            width: draft.host.width,
            height: draft.host.height,
            bounds: draft.host.bounds,
          }
        : null,
    backgrounds: draft.backgrounds.map(({ id, name, width, height }) => ({
      id,
      name,
      width,
      height,
    })),
    artboards: FORMATS.map((f) => ({
      id: generateId(),
      doc: {
        ...structuredClone(DEFAULT_DOC),
        name: f.name,
        width: f.width,
        height: f.height,
        layers: [],
        assets: {},
      },
      look: { ...lookFor(f.id), ...draft.layouts[f.id] },
    })),
  })
}
export { DEFAULT_FRAMING }
