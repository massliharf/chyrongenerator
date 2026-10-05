import {
  CHYRON_LAYER,
  DEFAULT_PROJECT,
  applyTemplateToStyle,
  normalizeProject,
  pickStyle,
  restTime,
  styleOf,
  type ChyronLayer,
  type ChyronStyle,
  type Project,
  type Template,
} from '../studio/model'
import { loadFonts } from '../studio/fonts'
import { buildScene, renderFrame } from '../studio/renderer'
import { generateId } from '../utils/id'
import type { DesignDoc, ImageLayer } from './model'

/**
 * Chyrons in the Designer: the Chyron editor's lettering drawn once, at rest,
 * into a transparent picture. The layer keeps the style so the words and look
 * can be changed later; every change draws the picture again.
 */

/** A new chyron's words, the same as a first chyron in the Chyron editor. */
const WORDS = { text: 'Your\nName', subtitle: 'ROLE' }

export function chyronFromTemplate(template: Template, words = WORDS): ChyronStyle {
  return applyTemplateToStyle({ ...pickStyle(DEFAULT_PROJECT), ...words }, template)
}

/** The first chyron of the Chyron editor's project on this device, if there is one. */
export function savedChyron(): ChyronStyle | null {
  try {
    const raw = localStorage.getItem('chyron-studio:v2')
    if (!raw) return null
    const project = normalizeProject(JSON.parse(raw))
    const layer = project.layers.find((l): l is ChyronLayer => l.kind === 'chyron')
    if (!layer) return null
    const style = pickStyle(styleOf(project, layer))
    return style.text.trim() || style.subtitle.trim() ? style : null
  } catch {
    return null
  }
}

/** Big enough to stay sharp at a few times the size a chyron arrives at. */
const SIZE = 1600

/** Draws a chyron at rest and trims it to its lettering, shadows included. */
export async function renderChyron(
  style: ChyronStyle,
): Promise<{ id: string; src: string; width: number; height: number; name: string }> {
  const p: Project = {
    ...DEFAULT_PROJECT,
    ...style,
    width: SIZE,
    height: SIZE,
    x: 50,
    y: 50,
    scale: 100,
    compositionRotation: 0,
    opacity: 100,
    layers: [{ ...CHYRON_LAYER }],
  }
  const fonts = await loadFonts(p.font)
  const scene = buildScene(p, fonts)
  const canvas = document.createElement('canvas')
  canvas.width = SIZE
  canvas.height = SIZE
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('Your browser could not draw the chyron.')
  renderFrame(ctx, scene, p, restTime(p))
  const { data } = ctx.getImageData(0, 0, SIZE, SIZE)
  let minX = SIZE,
    minY = SIZE,
    maxX = -1,
    maxY = -1
  for (let y = 0; y < SIZE; y++) {
    const row = y * SIZE * 4
    for (let x = 0; x < SIZE; x++) {
      if (data[row + x * 4 + 3] === 0) continue
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (y < minY) minY = y
      if (y > maxY) maxY = y
    }
  }
  if (maxX < 0) throw new Error('Type a title or a subtitle for this chyron.')
  const pad = 2
  minX = Math.max(0, minX - pad)
  minY = Math.max(0, minY - pad)
  const width = Math.min(SIZE, maxX + pad + 1) - minX
  const height = Math.min(SIZE, maxY + pad + 1) - minY
  const out = document.createElement('canvas')
  out.width = width
  out.height = height
  out.getContext('2d')!.drawImage(canvas, minX, minY, width, height, 0, 0, width, height)
  return { id: generateId(), src: out.toDataURL('image/png'), width, height, name: 'Chyron' }
}

/**
 * Puts a newly drawn chyron picture in its layer. The layer keeps its centre and
 * its scale, so longer words make it wider rather than smaller.
 */
export function withChyronAsset(
  doc: DesignDoc,
  id: string,
  asset: { id: string; src: string; width: number; height: number },
): DesignDoc {
  const layer = doc.layers.find((l): l is ImageLayer => l.id === id && l.kind === 'image')
  if (!layer) return doc
  const scale = layer.w / Math.max(1, layer.crop.w)
  const w = Math.max(1, Math.round(asset.width * scale))
  const h = Math.max(1, Math.round(asset.height * scale))
  const next: ImageLayer = {
    ...layer,
    asset: asset.id,
    naturalW: asset.width,
    naturalH: asset.height,
    crop: { x: 0, y: 0, w: asset.width, h: asset.height },
    w,
    h,
    x: Math.round(layer.x + layer.w / 2 - w / 2),
    y: Math.round(layer.y + layer.h / 2 - h / 2),
  }
  return {
    ...doc,
    assets: { ...doc.assets, [asset.id]: asset.src },
    layers: doc.layers.map((l) => (l.id === id ? next : l)),
  }
}
