import { generateId } from '../utils/id'
import {
  DEFAULT_IMAGE_LAYER,
  MAX_IMAGE_LAYERS,
  imageLayers,
  type ChyronLayer,
  type ImageLayer,
  type Layer,
  type Project,
} from './model'

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

export function updateLayer(
  p: Project,
  id: string,
  patch: Partial<ImageLayer> | Partial<ChyronLayer>,
) {
  return p.layers.map((l) => (l.id === id ? ({ ...l, ...patch } as Layer) : l))
}
export const removeLayer = (p: Project, id: string) =>
  p.layers.filter((l) => l.id !== id || l.kind === 'chyron')

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
  if (!source || source.kind !== 'image' || !canAddImage(p)) return { layers: p.layers, id: null }
  const copy: ImageLayer = {
    ...source,
    id: generateId(),
    name: `${source.name} copy`.slice(0, 80),
    x: Math.min(150, source.x + 3),
    y: Math.min(150, source.y + 3),
  }
  const layers = [...p.layers]
  layers.splice(index + 1, 0, copy)
  return { layers, id: copy.id }
}
