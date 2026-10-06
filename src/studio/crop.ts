import type { ImageCrop, ImageLayer, ImageMask, ShapeKind as LayerShape } from './model'
import { shapePath } from '../designer/shapes'
import type { ShapeKind } from '../designer/model'

export const FULL_CROP: ImageCrop = { x: 0, y: 0, w: 1, h: 1 }
const MIN = 0.02

export const cropOf = (l: ImageLayer) => l.crop ?? FULL_CROP
export const sourceAspectOf = (l: ImageLayer) => l.sourceAspect ?? l.aspect
export const isCropped = (l: ImageLayer) => {
  const c = cropOf(l)
  return c.x > 0.001 || c.y > 0.001 || c.w < 0.999 || c.h < 0.999
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

/**
 * Layer values for showing `crop` with the picture at the same on-screen scale
 * and position as `l` shows it now. `w`/`h` are the layer box in canvas px.
 */
export function withCrop(
  l: ImageLayer,
  next: ImageCrop,
  canvas: { width: number; height: number },
) {
  const c = cropOf(l)
  const sa = sourceAspectOf(l)
  const crop = {
    w: clamp(next.w, MIN, 1),
    h: clamp(next.h, MIN, 1),
    x: 0,
    y: 0,
  }
  crop.x = clamp(next.x, 0, 1 - crop.w)
  crop.y = clamp(next.y, 0, 1 - crop.h)
  // Box size in canvas px; the full image size stays fixed.
  const boxW = (l.width / 100) * canvas.width
  const fullW = boxW / c.w
  const fullH = (boxW * l.aspect) / c.h
  // Centre shift in the image's own (unrotated, unflipped) frame.
  const ox = (crop.x + crop.w / 2 - (c.x + c.w / 2)) * fullW * (l.flipX ? -1 : 1)
  const oy = (crop.y + crop.h / 2 - (c.y + c.h / 2)) * fullH
  const a = (l.rotation * Math.PI) / 180
  const dx = ox * Math.cos(a) - oy * Math.sin(a)
  const dy = ox * Math.sin(a) + oy * Math.cos(a)
  const round = (v: number) => Math.round(v * 1000) / 1000
  return {
    crop,
    sourceAspect: sa,
    aspect: (sa * crop.h) / crop.w,
    width: round(clamp((l.width * crop.w) / c.w, 2, 400)),
    x: round(l.x + (dx / canvas.width) * 100),
    y: round(l.y + (dy / canvas.height) * 100),
  } satisfies Partial<ImageLayer>
}

export type CropHandle = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw'

/**
 * Crop after dragging a handle by (dx, dy) screen px in the image's local
 * (unrotated) frame. `full` is the full image's on-screen size.
 */
export function resizeCrop(
  start: ImageCrop,
  handle: CropHandle,
  dx: number,
  dy: number,
  full: { w: number; h: number },
  flipX: boolean,
): ImageCrop {
  // On a mirrored image the visual east edge is the source's west edge.
  let h = handle as string
  if (flipX) {
    h = h.replace('e', 'X').replace('w', 'e').replace('X', 'w')
    dx = -dx
  }
  let { x, y, w, h: hh } = start
  const ux = dx / full.w,
    uy = dy / full.h
  if (h.includes('e')) w = clamp(w + ux, MIN, 1 - x)
  if (h.includes('w')) {
    const nx = clamp(x + ux, 0, x + w - MIN)
    w += x - nx
    x = nx
  }
  if (h.includes('s')) hh = clamp(hh + uy, MIN, 1 - y)
  if (h.includes('n')) {
    const ny = clamp(y + uy, 0, y + hh - MIN)
    hh += y - ny
    y = ny
  }
  return { x, y, w, h: hh }
}

/** Crop after dragging the picture inside its frame. */
export function panCrop(
  start: ImageCrop,
  dx: number,
  dy: number,
  full: { w: number; h: number },
  flipX: boolean,
) {
  return {
    ...start,
    x: clamp(start.x - (dx / full.w) * (flipX ? -1 : 1), 0, 1 - start.w),
    y: clamp(start.y - dy / full.h, 0, 1 - start.h),
  }
}

/** Largest crop of the given visible ratio (width ÷ height) inside the current one, centred. */
export function cropToRatio(l: ImageLayer, ratio: number): ImageCrop {
  const c = cropOf(l)
  const sa = sourceAspectOf(l)
  let w = c.w,
    h = c.h
  if (c.w / (c.h * sa) > ratio) w = ratio * c.h * sa
  else h = c.w / (ratio * sa)
  return { x: c.x + (c.w - w) / 2, y: c.y + (c.h - h) / 2, w, h }
}

/* ---------- Shape masks ---------- */

const MASK_SHAPES: Record<Exclude<ImageMask, 'none'>, { kind: ShapeKind; sides?: number }> = {
  circle: { kind: 'ellipse' },
  arch: { kind: 'arch' },
  triangle: { kind: 'triangle' },
  hexagon: { kind: 'polygon', sides: 6 },
  star: { kind: 'star' },
  heart: { kind: 'heart' },
}

/** Masks that read best on a square picture (circle, hexagon, star, heart). */
export const SQUARE_MASKS: ImageMask[] = ['circle', 'hexagon', 'star', 'heart']

/** SVG path for a mask filling the box, or null for the plain rectangle. */
export function maskPath(mask: ImageMask, x: number, y: number, w: number, h: number) {
  if (mask === 'none') return null
  const s = MASK_SHAPES[mask]
  return shapePath(s.kind, x, y, w, h, { sides: s.sides, points: 5, inner: 0.45 })
}

/** Outline of a shape layer filling the box; rectangles round their corners by `radius` px. */
export function shapeOutline(
  shape: LayerShape,
  x: number,
  y: number,
  w: number,
  h: number,
  radius = 0,
) {
  if (shape === 'rect' || shape === 'line') return shapePath('rect', x, y, w, h, { radius })
  return maskPath(shape, x, y, w, h)!
}

/** CSS/canvas filter string for the colour adjustments, or '' when unchanged. */
export function adjustFilter(l: Pick<ImageLayer, 'brightness' | 'contrast' | 'saturation'>) {
  const parts: string[] = []
  if (l.brightness !== 100) parts.push(`brightness(${l.brightness}%)`)
  if (l.contrast !== 100) parts.push(`contrast(${l.contrast}%)`)
  if (l.saturation !== 100) parts.push(`saturate(${l.saturation}%)`)
  return parts.join(' ')
}

/**
 * Re-shapes a dragged crop back to the start's visible ratio, anchored on the
 * edges the handle didn't move, and kept inside the image.
 */
export function keepCropRatio(
  start: ImageCrop,
  next: ImageCrop,
  handle: CropHandle,
  sa: number,
): ImageCrop {
  const ratio = start.w / start.h // in source fractions; constant for a fixed visible ratio
  const horizontal = handle.includes('e') || handle.includes('w')
  const vertical = handle.includes('n') || handle.includes('s')
  let w = next.w,
    h = next.h
  if (horizontal && vertical) {
    // Corner: follow whichever side moved more.
    if (Math.abs(next.w - start.w) / start.w >= Math.abs(next.h - start.h) / start.h) h = w / ratio
    else w = h * ratio
  } else if (horizontal) h = w / ratio
  else w = h * ratio
  // Fit inside the image from the anchored side.
  const right = start.x + start.w,
    bottom = start.y + start.h
  const maxW = handle.includes('w') ? right : horizontal ? 1 - start.x : 1
  const maxH = handle.includes('n') ? bottom : vertical ? 1 - start.y : 1
  const k = Math.min(1, maxW / w, maxH / h)
  w *= k
  h *= k
  let x = handle.includes('w') ? right - w : horizontal ? start.x : start.x + (start.w - w) / 2
  let y = handle.includes('n') ? bottom - h : vertical ? start.y : start.y + (start.h - h) / 2
  x = clamp(x, 0, 1 - w)
  y = clamp(y, 0, 1 - h)
  void sa
  return { x, y, w, h }
}
