import { generateId } from '../utils/id'
import {
  DEFAULT_IMAGE_LAYER,
  DEFAULT_SHAPE_LAYER,
  DEFAULT_TEXT_LAYER,
  MAX_CHYRONS,
  MAX_IMAGE_LAYERS,
  MAX_SHAPES,
  MAX_TEXTS,
  chyronLayers,
  imageLayers,
  pickStyle,
  shapeLayers,
  styleOf,
  textLayers,
  type ChyronLayer,
  type ChyronStyle,
  type ImageLayer,
  type Layer,
  type LayerKind,
  type Project,
  type ShapeKind,
  type ShapeLayer,
  type TextLayer,
} from './model'
import { TEXT_PRESETS, type TextPreset } from '../designer/model'

/** Width percentage that makes an image cover or fit the whole canvas. */
export function fitWidth(p: Project, aspect: number, mode: 'contain' | 'cover') {
  const canvasAspect = p.height / p.width
  const cover = mode === 'cover' ? aspect < canvasAspect : aspect > canvasAspect
  return Math.round((cover ? canvasAspect / aspect : 1) * 1000) / 10
}

export function createImageLayer(
  p: Project,
  image: { id: string; name: string; width: number; height: number; opaque: boolean },
): { layer: ImageLayer; layers: Layer[] } {
  const aspect = image.height / Math.max(1, image.width)
  const canvasAspect = p.height / p.width
  // An opaque photo shaped like the canvas is almost always a background plate:
  // make it full-bleed and put it at the bottom. Everything else arrives as a
  // centered logo on top of the stack.
  const background = image.opaque && Math.abs(Math.log(aspect / canvasAspect)) < 0.2
  const layer: ImageLayer = {
    ...DEFAULT_IMAGE_LAYER,
    id: generateId(),
    assetId: image.id,
    name: image.name.replace(/\.[a-z0-9]+$/i, '').slice(0, 80) || 'Image',
    aspect,
    width: background
      ? fitWidth(p, aspect, 'cover')
      : Math.round(Math.min(60, (60 * canvasAspect) / aspect) * 10) / 10,
    intro: background ? 'fade' : 'pop',
  }
  return { layer, layers: background ? [layer, ...p.layers] : [...p.layers, layer] }
}

export const canAddImage = (p: Project) => imageLayers(p).length < MAX_IMAGE_LAYERS
export const canAdd = (p: Project, kind: LayerKind) =>
  kind === 'image'
    ? canAddImage(p)
    : kind === 'shape'
      ? shapeLayers(p).length < MAX_SHAPES
      : kind === 'text'
        ? textLayers(p).length < MAX_TEXTS
        : chyronLayers(p).length < MAX_CHYRONS
export const LIMIT_MESSAGE: Record<LayerKind, string> = {
  image: `Up to ${MAX_IMAGE_LAYERS} images per composition.`,
  shape: `Up to ${MAX_SHAPES} shapes per composition.`,
  text: `Up to ${MAX_TEXTS} text layers per composition.`,
  chyron: `Up to ${MAX_CHYRONS} chyrons per composition.`,
}

/** A unique "Name 2", "Name 3"… among the project's layer names. */
function nextName(p: Project, base: string) {
  const names = new Set(p.layers.map((l) => l.name))
  if (!names.has(base)) return base
  for (let i = 2; ; i++) if (!names.has(`${base} ${i}`)) return `${base} ${i}`
}

/**
 * A free height for a new chyron: the first of `slots` (canvas %) with no
 * other chyron centred within 14 % of it.
 */
function freeSlot(p: Project, slots: number[]) {
  const taken = p.layers.flatMap((l) =>
    l.kind === 'chyron' ? [styleOf(p, l).y] : l.kind === 'text' ? [l.y] : [],
  )
  return slots.find((y) => taken.every((t) => Math.abs(t - y) >= 14)) ?? slots[0]
}

/**
 * A new chyron on top of the stack, in the look of the first chyron so a
 * guest's name matches the host's. It lands away from the first chyron's
 * position.
 */
export function createChyronLayer(p: Project): { layer: ChyronLayer; layers: Layer[] } {
  const base = pickStyle(p)
  // On an empty canvas a chyron takes the centre at full size. Next to other
  // chyrons it starts smaller, in a free band (chyrons fill the width at 100 %).
  const alone = !chyronLayers(p).length
  const style: ChyronStyle = {
    ...base,
    text: alone ? 'Your\nName' : 'Guest\nName',
    subtitle: alone ? 'ROLE' : 'GUEST',
    x: p.x,
    y: alone ? p.y : freeSlot(p, [78, 22, 64, 36]),
    scale: alone ? base.scale : Math.min(base.scale, 60),
  }
  const layer: ChyronLayer = {
    id: generateId(),
    kind: 'chyron',
    name: nextName(p, 'Chyron'),
    visible: true,
    delay: 0,
    style,
  }
  return { layer, layers: [...p.layers, layer] }
}

/** Letter size of each text preset, as a share of the composition's shorter side (the Designer's sizes on a 1080 artboard). */
const TEXT_SIZE: Record<TextPreset, number> = {
  heading: 96 / 1080,
  subheading: 56 / 1080,
  body: 32 / 1080,
}
/**
 * Plain text, as in the Designer: a heading, subheading or body text in a box
 * across the middle, above everything else.
 */
export function createTextLayer(
  p: Project,
  preset: TextPreset = 'heading',
): { layer: TextLayer; layers: Layer[] } {
  const size = (Math.min(p.width, p.height) * TEXT_SIZE[preset] * 100) / p.width
  const layer: TextLayer = {
    ...DEFAULT_TEXT_LAYER,
    id: generateId(),
    name: nextName(p, 'Text'),
    text: TEXT_PRESETS[preset].text,
    size: Math.round(size * 100) / 100,
    width: preset === 'body' ? 70 : 80,
    y: textLayers(p).length ? freeSlot(p, [30, 70, 50, 14, 86]) : 50,
  }
  return { layer, layers: [...p.layers, layer] }
}

const SHAPE_NAMES: Record<ShapeKind, string> = {
  rect: 'Rectangle',
  circle: 'Circle',
  arch: 'Arch',
  triangle: 'Triangle',
  hexagon: 'Hexagon',
  star: 'Star',
  heart: 'Heart',
  line: 'Line',
}
/**
 * A new shape. Rectangles arrive as a lower-third bar, lines as a thin rule
 * across the middle, everything else as a square badge.
 */
export function createShapeLayer(
  p: Project,
  shape: ShapeKind = 'rect',
): { layer: ShapeLayer; layers: Layer[] } {
  const bar = shape === 'rect'
  const line = shape === 'line'
  const canvasAspect = p.height / p.width
  const width = bar
    ? DEFAULT_SHAPE_LAYER.width
    : line
      ? 50
      : Math.round(Math.min(40, 40 * canvasAspect))
  // A line is as thick as the stroke a 1080 px frame would use (about 6 px).
  const thickness = Math.max(2, Math.round(Math.min(p.width, p.height) * 0.006))
  const layer: ShapeLayer = {
    ...DEFAULT_SHAPE_LAYER,
    id: generateId(),
    name: nextName(p, SHAPE_NAMES[shape]),
    shape,
    width,
    aspect: bar ? DEFAULT_SHAPE_LAYER.aspect : line ? thickness / ((width / 100) * p.width) : 1,
    y: bar ? DEFAULT_SHAPE_LAYER.y : 50,
    radius: bar ? DEFAULT_SHAPE_LAYER.radius : 0,
    intro: bar || line ? 'wipe' : 'pop',
  }
  return { layer, layers: [...p.layers, layer] }
}

export function updateLayer(p: Project, id: string, patch: Partial<Layer>) {
  return p.layers.map((l) => (l.id === id ? ({ ...l, ...patch } as Layer) : l))
}
/** Change an added chyron's style, or the project for the first chyron. */
export function chyronStylePatch(
  p: Project,
  id: string,
  values: Partial<ChyronStyle>,
): Partial<Project> {
  const layer = p.layers.find((l): l is ChyronLayer => l.id === id && l.kind === 'chyron')
  if (!layer || !layer.style) return values
  return { layers: updateLayer(p, id, { style: { ...layer.style, ...values } }) }
}
/** Remove any layer, the first chyron included. Undo brings it back. */
export const removeLayer = (p: Project, id: string) => p.layers.filter((l) => l.id !== id)

/** Move a layer up (towards the front) or down (towards the back) of the stack. */
export function moveLayer(p: Project, id: string, direction: 1 | -1 | 'front' | 'back') {
  const index = p.layers.findIndex((l) => l.id === id)
  if (index < 0) return p.layers
  const layers = [...p.layers]
  const [layer] = layers.splice(index, 1)
  const target =
    direction === 'front'
      ? layers.length
      : direction === 'back'
        ? 0
        : Math.min(layers.length, Math.max(0, index + direction))
  layers.splice(target, 0, layer)
  return layers
}

export function duplicateLayer(p: Project, id: string): { layers: Layer[]; id: string | null } {
  const index = p.layers.findIndex((l) => l.id === id)
  const source = p.layers[index]
  if (!source || !canAdd(p, source.kind)) return { layers: p.layers, id: null }
  const name = `${source.name} copy`.slice(0, 80)
  let copy: Layer
  if (source.kind === 'chyron') {
    const style = styleOf(p, source)
    copy = {
      ...source,
      id: generateId(),
      name,
      style: { ...pickStyle(style), y: Math.min(90, style.y + 6) },
    }
  } else
    copy = {
      ...source,
      id: generateId(),
      name,
      x: Math.min(150, source.x + 3),
      y: Math.min(150, source.y + 3),
    }
  const layers = [...p.layers]
  layers.splice(index + 1, 0, copy)
  return { layers, id: copy.id }
}
