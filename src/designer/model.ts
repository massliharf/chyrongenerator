import { generateId } from '../utils/id'

/**
 * Designer document model. Every layer is a box (x, y = unrotated top-left,
 * w, h) rotated about its centre. Layers are stored bottom → top.
 * A layer with `clip: true` is clipped to the nearest non-clip layer below it
 * (a clipping mask, as in Photoshop / Magnific Designer).
 */

export type BlendMode =
  | 'normal'
  | 'multiply'
  | 'screen'
  | 'overlay'
  | 'darken'
  | 'lighten'
  | 'color-dodge'
  | 'color-burn'
  | 'hard-light'
  | 'soft-light'
  | 'difference'
  | 'exclusion'
  | 'hue'
  | 'saturation'
  | 'color'
  | 'luminosity'

export const BLEND_MODES: { id: BlendMode; name: string }[] = [
  { id: 'normal', name: 'Normal' },
  { id: 'multiply', name: 'Multiply' },
  { id: 'screen', name: 'Screen' },
  { id: 'overlay', name: 'Overlay' },
  { id: 'darken', name: 'Darken' },
  { id: 'lighten', name: 'Lighten' },
  { id: 'color-dodge', name: 'Color dodge' },
  { id: 'color-burn', name: 'Color burn' },
  { id: 'hard-light', name: 'Hard light' },
  { id: 'soft-light', name: 'Soft light' },
  { id: 'difference', name: 'Difference' },
  { id: 'exclusion', name: 'Exclusion' },
  { id: 'hue', name: 'Hue' },
  { id: 'saturation', name: 'Saturation' },
  { id: 'color', name: 'Color' },
  { id: 'luminosity', name: 'Luminosity' },
]

export interface Shadow {
  enabled: boolean
  color: string
  opacity: number
  blur: number
  x: number
  y: number
}

interface BaseLayer {
  id: string
  name: string
  x: number
  y: number
  w: number
  h: number
  rotation: number
  opacity: number
  visible: boolean
  locked: boolean
  blend: BlendMode
  clip: boolean
  /** As a clipping base: lend its shape to the layers clipped to it, draw nothing itself. */
  maskOnly?: boolean
  /** Mask-only bases: show the clipped layers outside the shape instead. */
  maskInvert?: boolean
  /** Mask-only bases: soften the mask edge by this many px. */
  maskFeather?: number
  flipX: boolean
  flipY: boolean
  shadow: Shadow
}

export interface Crop {
  /** Source-pixel rectangle of the image that fills the layer box. */
  x: number
  y: number
  w: number
  h: number
}

export interface Filters {
  brightness: number
  contrast: number
  saturation: number
  blur: number
  grayscale: number
  hue: number
}

export interface ImageLayer extends BaseLayer {
  kind: 'image'
  asset: string
  naturalW: number
  naturalH: number
  crop: Crop
  radius: number
  filters: Filters
  stroke: string
  strokeWidth: number
}

export type ShapeKind = 'rect' | 'ellipse' | 'triangle' | 'polygon' | 'star' | 'heart' | 'arch'

export interface ShapeLayer extends BaseLayer {
  kind: ShapeKind
  /** Polygon corners. */
  sides: number
  /** Star points and inner radius (0–1). */
  points: number
  inner: number
  fill: string
  fillEnabled: boolean
  stroke: string
  strokeWidth: number
  radius: number
}

export interface TextLayer extends BaseLayer {
  kind: 'text'
  text: string
  font: string
  size: number
  weight: number
  italic: boolean
  color: string
  align: 'left' | 'center' | 'right'
  lineHeight: number
  letterSpacing: number
  uppercase: boolean
}

export type Layer = ImageLayer | ShapeLayer | TextLayer
export type LayerKind = Layer['kind']

export interface GridSettings {
  show: boolean
  size: number
  snapToGrid: boolean
  snapToObjects: boolean
}

export interface DesignDoc {
  version: 1
  name: string
  width: number
  height: number
  background: string
  transparent: boolean
  layers: Layer[]
  /** asset id → data URL. Shared by duplicates; travels with saved files. */
  assets: Record<string, string>
  grid: GridSettings
}

export const ARTBOARD_PRESETS = [
  { id: 'square', name: 'Square post', width: 1080, height: 1080 },
  { id: 'portrait', name: 'Portrait post', width: 1080, height: 1350 },
  { id: 'story', name: 'Story / Reel', width: 1080, height: 1920 },
  { id: 'hd', name: 'HD 16:9', width: 1920, height: 1080 },
  { id: 'thumb', name: 'YouTube thumbnail', width: 1280, height: 720 },
  { id: 'banner', name: 'Banner', width: 1500, height: 500 },
  { id: 'a4', name: 'A4 portrait', width: 2480, height: 3508 },
] as const

export const CROP_RATIOS: { id: string; name: string; ratio: number | null }[] = [
  { id: 'free', name: 'Free', ratio: null },
  { id: 'original', name: 'Original', ratio: -1 },
  { id: '1:1', name: '1:1', ratio: 1 },
  { id: '4:5', name: '4:5', ratio: 4 / 5 },
  { id: '3:2', name: '3:2', ratio: 3 / 2 },
  { id: '16:9', name: '16:9', ratio: 16 / 9 },
  { id: '9:16', name: '9:16', ratio: 9 / 16 },
]

export const FONTS = [
  'Geist Sans',
  'Inter',
  'Anton',
  'Oswald',
  'Bangers',
  'Chewy',
  'Fredoka',
  'Nunito',
  'Permanent Marker',
  'Ranchers',
  'Georgia',
  'Courier New',
]

export const DEFAULT_SHADOW: Shadow = {
  enabled: false,
  color: '#000000',
  opacity: 35,
  blur: 24,
  x: 0,
  y: 12,
}
export const DEFAULT_FILTERS: Filters = {
  brightness: 100,
  contrast: 100,
  saturation: 100,
  blur: 0,
  grayscale: 0,
  hue: 0,
}

export const DEFAULT_DOC: DesignDoc = {
  version: 1,
  name: 'Untitled design',
  width: 1080,
  height: 1080,
  background: '#ffffff',
  transparent: false,
  layers: [],
  assets: {},
  grid: { show: false, size: 40, snapToGrid: false, snapToObjects: true },
}

function base(doc: DesignDoc, name: string, w: number, h: number): BaseLayer {
  return {
    id: generateId(),
    name,
    x: Math.round((doc.width - w) / 2),
    y: Math.round((doc.height - h) / 2),
    w,
    h,
    rotation: 0,
    opacity: 100,
    visible: true,
    locked: false,
    blend: 'normal',
    clip: false,
    flipX: false,
    flipY: false,
    shadow: { ...DEFAULT_SHADOW },
  }
}

function uniqueName(doc: DesignDoc, stem: string) {
  const names = new Set(doc.layers.map((l) => l.name))
  if (!names.has(stem)) return stem
  let i = 2
  while (names.has(`${stem} ${i}`)) i++
  return `${stem} ${i}`
}

export const SHAPES: { kind: ShapeKind; name: string; radius?: number; sides?: number }[] = [
  { kind: 'rect', name: 'Square' },
  { kind: 'rect', name: 'Rounded', radius: 0.18 },
  { kind: 'ellipse', name: 'Circle' },
  { kind: 'arch', name: 'Arch' },
  { kind: 'triangle', name: 'Triangle' },
  { kind: 'polygon', name: 'Hexagon', sides: 6 },
  { kind: 'star', name: 'Star' },
  { kind: 'heart', name: 'Heart' },
]

const SHAPE_NAMES: Record<ShapeKind, string> = {
  rect: 'Rectangle',
  ellipse: 'Ellipse',
  triangle: 'Triangle',
  polygon: 'Polygon',
  star: 'Star',
  heart: 'Heart',
  arch: 'Arch',
}

export function isShape(l: Layer): l is ShapeLayer {
  return l.kind !== 'image' && l.kind !== 'text'
}

export function createShape(
  doc: DesignDoc,
  kind: ShapeKind,
  opts: { radius?: number; sides?: number; name?: string } = {},
): ShapeLayer {
  const size = Math.round(Math.min(doc.width, doc.height) * 0.4)
  return {
    ...base(
      doc,
      uniqueName(doc, opts.name ?? SHAPE_NAMES[kind]),
      size,
      kind === 'arch' ? Math.round(size * 1.25) : size,
    ),
    kind,
    sides: opts.sides ?? 6,
    points: 5,
    inner: 0.45,
    fill: '#4f69f2',
    fillEnabled: true,
    stroke: '#1a1a1a',
    strokeWidth: 0,
    radius: Math.round(size * (opts.radius ?? 0)),
  }
}

/** An image frame: a mask-only shape waiting for a picture. */
export function createFrame(doc: DesignDoc, preset: (typeof SHAPES)[number]): ShapeLayer {
  const shape = createShape(doc, preset.kind, {
    radius: preset.radius,
    sides: preset.sides,
    name: `${preset.name} frame`,
  })
  const size = Math.round(Math.min(doc.width, doc.height) * 0.55)
  shape.w = size
  shape.h = preset.kind === 'arch' ? Math.round(size * 1.25) : size
  shape.x = Math.round((doc.width - shape.w) / 2)
  shape.y = Math.round((doc.height - shape.h) / 2)
  shape.radius = Math.round(size * (preset.radius ?? 0))
  shape.fill = '#9a9a9a'
  shape.maskOnly = true
  return shape
}

export const TEXT_PRESETS = {
  heading: { label: 'Heading', text: 'Add a heading', size: 96, weight: 700 },
  subheading: { label: 'Subheading', text: 'Add a subheading', size: 56, weight: 600 },
  body: { label: 'Body text', text: 'Add a little bit of body text', size: 32, weight: 400 },
} as const
export type TextPreset = keyof typeof TEXT_PRESETS

export function createText(doc: DesignDoc, preset: TextPreset = 'heading'): TextLayer {
  const p = TEXT_PRESETS[preset]
  const w = Math.round(Math.min(doc.width * 0.8, p.size * p.text.length * 0.55))
  return {
    ...base(doc, uniqueName(doc, p.label), w, Math.round(p.size * 1.2)),
    kind: 'text',
    text: p.text,
    font: 'Geist Sans',
    size: p.size,
    weight: p.weight,
    italic: false,
    color: '#1a1a1a',
    align: 'center',
    lineHeight: 1.2,
    letterSpacing: 0,
    uppercase: false,
  }
}

export function createImage(
  doc: DesignDoc,
  asset: string,
  naturalW: number,
  naturalH: number,
  name: string,
): ImageLayer {
  // Arrive at most 70 % of the artboard, never upscaled.
  const scale = Math.min(1, (doc.width * 0.7) / naturalW, (doc.height * 0.7) / naturalH)
  const w = Math.max(1, Math.round(naturalW * scale))
  const h = Math.max(1, Math.round(naturalH * scale))
  return {
    ...base(doc, uniqueName(doc, name.replace(/\.[a-z0-9]+$/i, '').slice(0, 60) || 'Image'), w, h),
    kind: 'image',
    asset,
    naturalW,
    naturalH,
    crop: { x: 0, y: 0, w: naturalW, h: naturalH },
    radius: 0,
    filters: { ...DEFAULT_FILTERS },
    stroke: '#ffffff',
    strokeWidth: 0,
  }
}

export function duplicate(doc: DesignDoc, layer: Layer, offset = 24): Layer {
  return {
    ...structuredClone(layer),
    id: generateId(),
    name: uniqueName(doc, layer.name.replace(/ copy( \d+)?$/, '') + ' copy'),
    x: layer.x + offset,
    y: layer.y + offset,
  }
}

export function fileStem(name: string) {
  return (
    name
      .trim()
      .replace(/[^a-z0-9-_ ]/gi, '')
      .replace(/\s+/g, '-')
      .toLowerCase() || 'design'
  )
}

/** Removes asset data no layer points at any more. */
export function pruneAssets(doc: DesignDoc): DesignDoc {
  const used = new Set(doc.layers.flatMap((l) => (l.kind === 'image' ? [l.asset] : [])))
  const keys = Object.keys(doc.assets)
  if (keys.every((k) => used.has(k))) return doc
  return {
    ...doc,
    assets: Object.fromEntries(keys.filter((k) => used.has(k)).map((k) => [k, doc.assets[k]])),
  }
}

export function parseDoc(json: string): DesignDoc {
  const raw = JSON.parse(json) as Partial<DesignDoc>
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.layers))
    throw new Error('This is not a Designer file.')
  const w = Number(raw.width),
    h = Number(raw.height)
  if (!(w >= 16 && w <= 8000 && h >= 16 && h <= 8000)) throw new Error('Artboard size is invalid.')
  return {
    ...DEFAULT_DOC,
    ...raw,
    version: 1,
    grid: { ...DEFAULT_DOC.grid, ...(raw.grid ?? {}) },
    assets: raw.assets ?? {},
    layers: raw.layers.map((l) => ({
      ...(l.kind !== 'image' && l.kind !== 'text' ? { sides: 6, points: 5, inner: 0.45 } : {}),
      ...l,
      shadow: { ...DEFAULT_SHADOW, ...(l.shadow ?? {}) },
    })),
  } as DesignDoc
}
