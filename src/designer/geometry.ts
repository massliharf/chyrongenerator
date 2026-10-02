import type { Crop, Layer } from './model'

export interface Point {
  x: number
  y: number
}
export interface Rect {
  x: number
  y: number
  w: number
  h: number
}
type Box = Pick<Layer, 'x' | 'y' | 'w' | 'h' | 'rotation'>

const RAD = Math.PI / 180

export function rotate(p: Point, deg: number, origin: Point = { x: 0, y: 0 }): Point {
  const a = deg * RAD,
    c = Math.cos(a),
    s = Math.sin(a)
  const dx = p.x - origin.x,
    dy = p.y - origin.y
  return { x: origin.x + dx * c - dy * s, y: origin.y + dx * s + dy * c }
}

export function center(b: Box): Point {
  return { x: b.x + b.w / 2, y: b.y + b.h / 2 }
}

export function corners(b: Box): Point[] {
  const c = center(b)
  return [
    { x: b.x, y: b.y },
    { x: b.x + b.w, y: b.y },
    { x: b.x + b.w, y: b.y + b.h },
    { x: b.x, y: b.y + b.h },
  ].map((p) => rotate(p, b.rotation, c))
}

/** Axis-aligned bounds of a (possibly rotated) layer. */
export function bounds(b: Box): Rect {
  if (!b.rotation) return { x: b.x, y: b.y, w: b.w, h: b.h }
  const pts = corners(b)
  const xs = pts.map((p) => p.x),
    ys = pts.map((p) => p.y)
  const x = Math.min(...xs),
    y = Math.min(...ys)
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y }
}

export function unionBounds(boxes: Box[]): Rect | null {
  if (!boxes.length) return null
  const rs = boxes.map(bounds)
  const x = Math.min(...rs.map((r) => r.x)),
    y = Math.min(...rs.map((r) => r.y))
  const r = Math.max(...rs.map((r) => r.x + r.w)),
    b = Math.max(...rs.map((r) => r.y + r.h))
  return { x, y, w: r - x, h: b - y }
}

/** Point in the layer's own unrotated frame, origin at its top-left. */
export function toLocal(p: Point, b: Box): Point {
  const q = rotate(p, -b.rotation, center(b))
  return { x: q.x - b.x, y: q.y - b.y }
}

export function hitLayer(p: Point, l: Layer, slop = 0): boolean {
  const q = toLocal(p, l)
  if (l.kind === 'ellipse') {
    const rx = l.w / 2 + slop,
      ry = l.h / 2 + slop
    const dx = q.x - l.w / 2,
      dy = q.y - l.h / 2
    return (dx * dx) / (rx * rx) + (dy * dy) / (ry * ry) <= 1
  }
  return q.x >= -slop && q.y >= -slop && q.x <= l.w + slop && q.y <= l.h + slop
}

export function rectsIntersect(a: Rect, b: Rect) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
}

export function normalizeRect(a: Point, b: Point): Rect {
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    w: Math.abs(a.x - b.x),
    h: Math.abs(a.y - b.y),
  }
}

/* ---------- Resize in the layer's local frame ---------- */

export type Handle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w'
export const HANDLES: Handle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']

/**
 * Applies a local-frame edge box {l, t, r, b} (relative to the old box's
 * top-left, unrotated) back to world space, keeping the rotation.
 */
export function applyLocalBox(
  old: Box,
  l: number,
  t: number,
  r: number,
  b: number,
): Pick<Layer, 'x' | 'y' | 'w' | 'h'> {
  const w = Math.max(1, r - l),
    h = Math.max(1, b - t)
  const oc = center(old)
  const localCenter = { x: l + w / 2 - old.w / 2, y: t + h / 2 - old.h / 2 }
  const worldCenter = rotate(localCenter, old.rotation)
  const cx = oc.x + worldCenter.x,
    cy = oc.y + worldCenter.y
  return { x: cx - w / 2, y: cy - h / 2, w, h }
}

/**
 * Resizes `start` by dragging `handle` to world point `p`.
 * keepRatio locks the aspect (corner handles); fromCenter mirrors (Alt).
 */
export function resizeBox(
  start: Box,
  handle: Handle,
  p: Point,
  { keepRatio = false, fromCenter = false } = {},
) {
  const q = toLocal(p, start)
  let l = 0,
    t = 0,
    r = start.w,
    b = start.h
  if (handle.includes('w')) l = q.x
  if (handle.includes('e')) r = q.x
  if (handle.includes('n')) t = q.y
  if (handle.includes('s')) b = q.y
  if (fromCenter) {
    if (handle.includes('w')) r = start.w - l
    if (handle.includes('e')) l = start.w - r
    if (handle.includes('n')) b = start.h - t
    if (handle.includes('s')) t = start.h - b
  }
  // No flipping through zero: clamp to a 1px box.
  if (r - l < 1) {
    if (handle.includes('w')) l = r - 1
    else r = l + 1
  }
  if (b - t < 1) {
    if (handle.includes('n')) t = b - 1
    else b = t + 1
  }
  if (keepRatio && handle.length === 2) {
    const ratio = start.w / start.h
    let w = r - l,
      h = b - t
    if (w / h > ratio) h = w / ratio
    else w = h * ratio
    if (fromCenter) {
      l = (start.w - w) / 2
      r = l + w
      t = (start.h - h) / 2
      b = t + h
    } else {
      if (handle.includes('w')) l = r - w
      else r = l + w
      if (handle.includes('n')) t = b - h
      else b = t + h
    }
  }
  return applyLocalBox(start, l, t, r, b)
}

/* ---------- Snapping ---------- */

export interface SnapGuide {
  axis: 'x' | 'y'
  pos: number
  from: number
  to: number
}
export interface SnapTargets {
  x: number[]
  y: number[]
  /** For drawing guides: extent of the thing each target came from. */
  spanX: Map<number, [number, number]>
  spanY: Map<number, [number, number]>
}

export function buildTargets(
  layers: Layer[],
  exclude: Set<string>,
  artboard: { width: number; height: number },
  objects: boolean,
): SnapTargets {
  const t: SnapTargets = { x: [], y: [], spanX: new Map(), spanY: new Map() }
  const add = (axis: 'x' | 'y', v: number, a: number, b: number) => {
    const list = axis === 'x' ? t.x : t.y
    const span = axis === 'x' ? t.spanX : t.spanY
    list.push(v)
    const prev = span.get(v)
    span.set(v, prev ? [Math.min(prev[0], a), Math.max(prev[1], b)] : [a, b])
  }
  const W = artboard.width,
    H = artboard.height
  for (const v of [0, W / 2, W]) add('x', v, 0, H)
  for (const v of [0, H / 2, H]) add('y', v, 0, W)
  if (objects) {
    for (const l of layers) {
      if (exclude.has(l.id) || !l.visible) continue
      const r = bounds(l)
      for (const v of [r.x, r.x + r.w / 2, r.x + r.w]) add('x', v, r.y, r.y + r.h)
      for (const v of [r.y, r.y + r.h / 2, r.y + r.h]) add('y', v, r.x, r.x + r.w)
    }
  }
  return t
}

function nearest(values: number[], targets: number[], threshold: number) {
  let best: { delta: number; target: number; value: number } | null = null
  for (const v of values)
    for (const target of targets) {
      const d = target - v
      if (Math.abs(d) <= threshold && (!best || Math.abs(d) < Math.abs(best.delta)))
        best = { delta: d, target, value: v }
    }
  return best
}

function gridSnap(v: number, size: number) {
  return Math.round(v / size) * size
}

/**
 * Snaps a moving rectangle. Objects/canvas lines win over the grid when both
 * are in range, because they carry visible intent.
 */
export function snapMove(
  rect: Rect,
  targets: SnapTargets,
  threshold: number,
  grid: { snap: boolean; size: number },
): { dx: number; dy: number; guides: SnapGuide[] } {
  const xs = [rect.x, rect.x + rect.w / 2, rect.x + rect.w]
  const ys = [rect.y, rect.y + rect.h / 2, rect.y + rect.h]
  const guides: SnapGuide[] = []
  let dx = 0,
    dy = 0
  const sx = nearest(xs, targets.x, threshold)
  const sy = nearest(ys, targets.y, threshold)
  if (sx) dx = sx.delta
  else if (grid.snap) dx = gridSnap(rect.x, grid.size) - rect.x
  if (sy) dy = sy.delta
  else if (grid.snap) dy = gridSnap(rect.y, grid.size) - rect.y
  if (sx) {
    const span = targets.spanX.get(sx.target)!
    guides.push({
      axis: 'x',
      pos: sx.target,
      from: Math.min(span[0], rect.y + dy),
      to: Math.max(span[1], rect.y + dy + rect.h),
    })
  }
  if (sy) {
    const span = targets.spanY.get(sy.target)!
    guides.push({
      axis: 'y',
      pos: sy.target,
      from: Math.min(span[0], rect.x + dx),
      to: Math.max(span[1], rect.x + dx + rect.w),
    })
  }
  return { dx, dy, guides }
}

/** Snaps a single value (a dragged edge) to targets, then the grid. */
export function snapValue(
  v: number,
  axis: 'x' | 'y',
  targets: SnapTargets,
  threshold: number,
  grid: { snap: boolean; size: number },
): { value: number; hit: number | null } {
  const s = nearest([v], axis === 'x' ? targets.x : targets.y, threshold)
  if (s) return { value: s.target, hit: s.target }
  if (grid.snap) return { value: gridSnap(v, grid.size), hit: null }
  return { value: v, hit: null }
}

export function snapAngle(deg: number, step = 15) {
  return Math.round(deg / step) * step
}

export function normalizeAngle(deg: number) {
  let a = deg % 360
  if (a > 180) a -= 360
  if (a <= -180) a += 360
  return Math.round(a * 100) / 100
}

/* ---------- Crop ---------- */

/**
 * Crop mode keeps the image's on-screen scale fixed. Given the layer's
 * current box and crop, returns the full image's rectangle in local space.
 */
export function fullImageLocal(l: {
  w: number
  h: number
  crop: Crop
  naturalW: number
  naturalH: number
}) {
  const sx = l.w / l.crop.w,
    sy = l.h / l.crop.h
  return { x: -l.crop.x * sx, y: -l.crop.y * sy, w: l.naturalW * sx, h: l.naturalH * sy, sx, sy }
}

/** Clamp a crop rectangle to the source image. */
export function clampCrop(c: Crop, nw: number, nh: number): Crop {
  const w = Math.min(nw, Math.max(1, c.w)),
    h = Math.min(nh, Math.max(1, c.h))
  return { x: Math.min(nw - w, Math.max(0, c.x)), y: Math.min(nh - h, Math.max(0, c.y)), w, h }
}
