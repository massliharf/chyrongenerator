import { generateId } from '../utils/id'
import { bounds, unionBounds } from './geometry'
import {
  createImage,
  createShape,
  duplicate,
  type DesignDoc,
  type ImageLayer,
  type Layer,
} from './model'
import { textHeight } from './render'

export function updateLayers(
  doc: DesignDoc,
  ids: Iterable<string>,
  values: Partial<Layer> | ((l: Layer) => Partial<Layer>),
): DesignDoc {
  const set = new Set(ids)
  return {
    ...doc,
    layers: doc.layers.map((l) => {
      if (!set.has(l.id)) return l
      const next = { ...l, ...(typeof values === 'function' ? values(l) : values) } as Layer
      // Text boxes grow with their content.
      if (next.kind === 'text') next.h = textHeight(next)
      return next
    }),
  }
}

export function removeLayers(doc: DesignDoc, ids: Iterable<string>): DesignDoc {
  const set = new Set(ids)
  return { ...doc, layers: doc.layers.filter((l) => !set.has(l.id)) }
}

export function addLayer(doc: DesignDoc, layer: Layer, index = doc.layers.length): DesignDoc {
  const layers = [...doc.layers]
  layers.splice(index, 0, layer)
  return { ...doc, layers }
}

export function duplicateLayers(doc: DesignDoc, ids: string[]) {
  let next = doc
  const created: string[] = []
  // Each copy lands directly above its original.
  for (const id of ids) {
    const index = next.layers.findIndex((l) => l.id === id)
    if (index < 0) continue
    const copy = duplicate(next, next.layers[index])
    next = addLayer(next, copy, index + 1)
    created.push(copy.id)
  }
  return { doc: next, ids: created }
}

/** Moves selected layers one step (±1) or to the end (±Infinity). */
export function reorder(doc: DesignDoc, ids: Set<string>, dir: 1 | -1 | 'front' | 'back') {
  const layers = [...doc.layers]
  if (dir === 'front' || dir === 'back') {
    const picked = layers.filter((l) => ids.has(l.id))
    const rest = layers.filter((l) => !ids.has(l.id))
    return { ...doc, layers: dir === 'front' ? [...rest, ...picked] : [...picked, ...rest] }
  }
  const order = dir === 1 ? [...layers.keys()].reverse() : [...layers.keys()]
  for (const i of order) {
    const j = i + dir
    if (!ids.has(layers[i].id) || j < 0 || j >= layers.length || ids.has(layers[j].id)) continue
    ;[layers[i], layers[j]] = [layers[j], layers[i]]
  }
  return { ...doc, layers }
}

export function moveLayerTo(doc: DesignDoc, id: string, index: number) {
  const layer = doc.layers.find((l) => l.id === id)
  if (!layer) return doc
  const layers = doc.layers.filter((l) => l.id !== id)
  layers.splice(Math.max(0, Math.min(layers.length, index)), 0, layer)
  return { ...doc, layers }
}

export type Align = 'left' | 'hcenter' | 'right' | 'top' | 'vcenter' | 'bottom'

/** Aligns to the selection's bounds, or to the artboard for a single layer. */
export function align(doc: DesignDoc, ids: string[], how: Align): DesignDoc {
  const sel = doc.layers.filter((l) => ids.includes(l.id) && !l.locked)
  if (!sel.length) return doc
  const ref = sel.length === 1 ? { x: 0, y: 0, w: doc.width, h: doc.height } : unionBounds(sel)!
  return updateLayers(
    doc,
    sel.map((l) => l.id),
    (l) => {
      const b = bounds(l)
      let dx = 0,
        dy = 0
      if (how === 'left') dx = ref.x - b.x
      if (how === 'hcenter') dx = ref.x + ref.w / 2 - (b.x + b.w / 2)
      if (how === 'right') dx = ref.x + ref.w - (b.x + b.w)
      if (how === 'top') dy = ref.y - b.y
      if (how === 'vcenter') dy = ref.y + ref.h / 2 - (b.y + b.h / 2)
      if (how === 'bottom') dy = ref.y + ref.h - (b.y + b.h)
      return { x: Math.round(l.x + dx), y: Math.round(l.y + dy) }
    },
  )
}

/** Even gaps between three or more layers along one axis. */
export function distribute(doc: DesignDoc, ids: string[], axis: 'x' | 'y'): DesignDoc {
  const sel = doc.layers.filter((l) => ids.includes(l.id) && !l.locked)
  if (sel.length < 3) return doc
  const items = sel
    .map((l) => ({ l, b: bounds(l) }))
    .sort((a, b) => (axis === 'x' ? a.b.x - b.b.x : a.b.y - b.b.y))
  const size = (b: { w: number; h: number }) => (axis === 'x' ? b.w : b.h)
  const pos = (b: { x: number; y: number }) => (axis === 'x' ? b.x : b.y)
  const first = items[0].b,
    last = items[items.length - 1].b
  const total = pos(last) + size(last) - pos(first)
  const gap = (total - items.reduce((s, i) => s + size(i.b), 0)) / (items.length - 1)
  const moves = new Map<string, number>()
  let cursor = pos(first)
  for (const { l, b } of items) {
    moves.set(l.id, cursor - pos(b))
    cursor += size(b) + gap
  }
  return updateLayers(doc, moves.keys(), (l) =>
    axis === 'x'
      ? { x: Math.round(l.x + moves.get(l.id)!) }
      : { y: Math.round(l.y + moves.get(l.id)!) },
  )
}

/**
 * Puts a shape of the layer's size directly below it and clips the layer to
 * it. The shape is the editable mask: move or reshape it to reframe.
 */
export function maskWithShape(doc: DesignDoc, id: string, kind: 'rect' | 'ellipse') {
  const index = doc.layers.findIndex((l) => l.id === id)
  const layer = doc.layers[index]
  if (!layer) return { doc, maskId: null }
  const shape = {
    ...createShape(doc, kind),
    name: `${layer.name} mask`,
    x: layer.x,
    y: layer.y,
    w: layer.w,
    h: layer.h,
    rotation: layer.rotation,
    fill: '#808080',
    maskOnly: true,
    radius: kind === 'rect' ? Math.round(Math.min(layer.w, layer.h) * 0.08) : 0,
  }
  let next = addLayer(doc, shape, index)
  next = updateLayers(next, [id], { clip: true })
  return { doc: next, maskId: shape.id }
}

export function releaseMask(doc: DesignDoc, id: string) {
  return updateLayers(doc, [id], { clip: false })
}

/* ---------- Image import ---------- */

const MAX_SIDE = 4096
const MAX_BYTES = 30 * 1024 * 1024

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('This image could not be read.'))
    img.src = src
  })
}

function readAsDataURL(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result as string)
    r.onerror = () => reject(new Error('This file could not be read.'))
    r.readAsDataURL(file)
  })
}

/** Reads an image file into an asset, downscaling past 4096 px. */
export async function importImageFile(file: File) {
  if (!file.type.startsWith('image/')) throw new Error(`${file.name} is not an image.`)
  if (file.size > MAX_BYTES) throw new Error(`${file.name} is larger than 30 MB.`)
  let src = await readAsDataURL(file)
  let img = await loadImage(src)
  const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight))
  if (scale < 1 || file.type === 'image/gif') {
    const c = document.createElement('canvas')
    c.width = Math.round(img.naturalWidth * scale)
    c.height = Math.round(img.naturalHeight * scale)
    c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height)
    src = c.toDataURL(file.type === 'image/jpeg' ? 'image/jpeg' : 'image/png', 0.92)
    img = await loadImage(src)
  }
  return {
    id: generateId(),
    src,
    width: img.naturalWidth,
    height: img.naturalHeight,
    name: file.name,
  }
}

export function addImageAsset(
  doc: DesignDoc,
  asset: { id: string; src: string; width: number; height: number; name: string },
  at?: { x: number; y: number },
): { doc: DesignDoc; layer: ImageLayer } {
  const layer = createImage(doc, asset.id, asset.width, asset.height, asset.name)
  if (at) {
    layer.x = Math.round(at.x - layer.w / 2)
    layer.y = Math.round(at.y - layer.h / 2)
  }
  return {
    doc: {
      ...doc,
      assets: { ...doc.assets, [asset.id]: asset.src },
      layers: [...doc.layers, layer],
    },
    layer,
  }
}

/** Replaces an image's pixels, keeping its frame and crop proportions. */
export function replaceImage(
  doc: DesignDoc,
  id: string,
  asset: { id: string; src: string; width: number; height: number },
) {
  const next = { ...doc, assets: { ...doc.assets, [asset.id]: asset.src } }
  return updateLayers(next, [id], (l) => {
    const img = l as ImageLayer
    // Cover the existing box with the new image, centred.
    const ratio = img.w / img.h
    let w = asset.width,
      h = w / ratio
    if (h > asset.height) {
      h = asset.height
      w = h * ratio
    }
    return {
      asset: asset.id,
      naturalW: asset.width,
      naturalH: asset.height,
      crop: { x: (asset.width - w) / 2, y: (asset.height - h) / 2, w, h },
    } as Partial<ImageLayer>
  })
}
