import type { Project } from './model'

export const CORNERS = ['top-left', 'top-right', 'bottom-left', 'bottom-right'] as const
export type Corner = (typeof CORNERS)[number]
export type Point = { x: number; y: number }

export interface SnapGuide {
  position: number // percentage 0..100
  label: string
}

export interface SnapState {
  x: SnapGuide | null
  y: SnapGuide | null
}

export function isPointInChyron(
  clientPoint: Point,
  canvasRect: { left: number; top: number; width: number; height: number },
  p: Project,
  bounds: { cx: number; cy: number; width: number; height: number; rotation: number },
): boolean {
  if (canvasRect.width <= 0 || canvasRect.height <= 0) return false

  const px = ((clientPoint.x - canvasRect.left) / canvasRect.width) * p.width
  const py = ((clientPoint.y - canvasRect.top) / canvasRect.height) * p.height

  const angle = (-bounds.rotation * Math.PI) / 180
  const dx = px - bounds.cx
  const dy = py - bounds.cy

  const unrotX = dx * Math.cos(angle) - dy * Math.sin(angle)
  const unrotY = dx * Math.sin(angle) + dy * Math.cos(angle)

  return Math.abs(unrotX) <= bounds.width / 2 && Math.abs(unrotY) <= bounds.height / 2
}

export function snapPosition(
  rawX: number,
  rawY: number,
  p: Project,
  bounds: { width: number; height: number },
  threshold = 2.0,
): { x: number; y: number; snap: SnapState } {
  let x = rawX
  let y = rawY
  const snap: SnapState = { x: null, y: null }

  const hw = ((bounds.width / p.width) * 100) / 2

  // 1. Center snap (X: 50%)
  if (Math.abs(rawX - 50) < threshold) {
    x = 50
    snap.x = { position: 50, label: 'Center' }
  }
  // 2. Left snaps: left edge to 10% (safe area) or 5% (margin), or center to 25%
  else if (Math.abs(rawX - hw - 10) < threshold) {
    x = 10 + hw
    snap.x = { position: 10, label: 'Left Safe (10%)' }
  } else if (Math.abs(rawX - hw - 5) < threshold) {
    x = 5 + hw
    snap.x = { position: 5, label: 'Left (5%)' }
  } else if (Math.abs(rawX - 25) < threshold * 0.75) {
    x = 25
    snap.x = { position: 25, label: 'Left Column' }
  }
  // 3. Right snaps: right edge to 90% (safe area) or 95% (margin), or center to 75%
  else if (Math.abs(rawX + hw - 90) < threshold) {
    x = 90 - hw
    snap.x = { position: 90, label: 'Right Safe (90%)' }
  } else if (Math.abs(rawX + hw - 95) < threshold) {
    x = 95 - hw
    snap.x = { position: 95, label: 'Right (95%)' }
  } else if (Math.abs(rawX - 75) < threshold * 0.75) {
    x = 75
    snap.x = { position: 75, label: 'Right Column' }
  }

  // Vertical snaps
  // 1. Middle snap (Y: 50%)
  if (Math.abs(rawY - 50) < threshold) {
    y = 50
    snap.y = { position: 50, label: 'Middle' }
  }
  // 2. Lower third snap (Y: 75%)
  else if (Math.abs(rawY - 75) < threshold) {
    y = 75
    snap.y = { position: 75, label: 'Lower Third' }
  }
  // 3. Upper third snap (Y: 25%)
  else if (Math.abs(rawY - 25) < threshold) {
    y = 25
    snap.y = { position: 25, label: 'Upper Third' }
  }

  return {
    x: Math.round(Math.min(95, Math.max(5, x)) * 10) / 10,
    y: Math.round(Math.min(95, Math.max(5, y)) * 10) / 10,
    snap,
  }
}

export function rotateChyron(
  initialRotation: number,
  center: Point,
  start: Point,
  current: Point,
  snap15: boolean,
): number {
  const startAngle = Math.atan2(start.y - center.y, start.x - center.x)
  const currentAngle = Math.atan2(current.y - center.y, current.x - center.x)
  const delta = ((currentAngle - startAngle) * 180) / Math.PI
  let next = ((((Math.round(initialRotation + delta) + 180) % 360) + 360) % 360) - 180

  if (snap15) {
    next = Math.round(next / 15) * 15
  } else if (Math.abs(next) < 2) {
    next = 0
  }
  return next
}

export function scaleChyron(
  initialScale: number,
  canvasRect: { left: number; top: number; width: number; height: number },
  p: Project,
  startPoint: Point,
  currentPoint: Point,
): number {
  const cx = canvasRect.left + (canvasRect.width * p.x) / 100
  const cy = canvasRect.top + (canvasRect.height * p.y) / 100
  const initialDist = Math.hypot(startPoint.x - cx, startPoint.y - cy)
  const currentDist = Math.hypot(currentPoint.x - cx, currentPoint.y - cy)

  if (initialDist < 5) return initialScale
  const factor = currentDist / initialDist
  return Math.round(Math.min(150, Math.max(20, initialScale * factor)))
}

/** A line other layers can snap to, in canvas percent. */
export interface SnapLine {
  position: number
  label: string
}
export interface SnapTargets {
  x: SnapLine[]
  y: SnapLine[]
}

/** Axis-aligned bounds of a (possibly rotated) box, in canvas percent. */
export function boundsPercent(
  b: { cx: number; cy: number; width: number; height: number; rotation: number },
  canvas: { width: number; height: number },
) {
  const a = (b.rotation * Math.PI) / 180
  const w = Math.abs(b.width * Math.cos(a)) + Math.abs(b.height * Math.sin(a))
  const h = Math.abs(b.width * Math.sin(a)) + Math.abs(b.height * Math.cos(a))
  return {
    left: ((b.cx - w / 2) / canvas.width) * 100,
    right: ((b.cx + w / 2) / canvas.width) * 100,
    cx: (b.cx / canvas.width) * 100,
    top: ((b.cy - h / 2) / canvas.height) * 100,
    bottom: ((b.cy + h / 2) / canvas.height) * 100,
    cy: (b.cy / canvas.height) * 100,
    w: (w / canvas.width) * 100,
    h: (h / canvas.height) * 100,
  }
}

/** Edge and centre lines of other layers. */
export function layerSnapTargets(
  boxes: { name: string; box: ReturnType<typeof boundsPercent> }[],
): SnapTargets {
  const t: SnapTargets = { x: [], y: [] }
  for (const { name, box } of boxes) {
    t.x.push(
      { position: box.left, label: `${name} left` },
      { position: box.cx, label: `${name} center` },
      { position: box.right, label: `${name} right` },
    )
    t.y.push(
      { position: box.top, label: `${name} top` },
      { position: box.cy, label: `${name} middle` },
      { position: box.bottom, label: `${name} bottom` },
    )
  }
  return t
}

/**
 * Snap an image layer's center to the canvas center and edges, and its edges
 * and centre to other layers', so full-bleed backgrounds, edge-aligned logos
 * and side-by-side pictures land exactly. Values are percentages; the nearest
 * line within the threshold wins. `widthPercent`/`heightPercent` are the
 * layer's axis-aligned size.
 */
export function snapImagePosition(
  rawX: number,
  rawY: number,
  widthPercent: number,
  heightPercent: number,
  threshold = 1.5,
  targets: SnapTargets = { x: [], y: [] },
): { x: number; y: number; snap: SnapState } {
  const snap: SnapState = { x: null, y: null }
  const axis = (
    raw: number,
    size: number,
    canvasLabels: [string, string, string],
    lines: SnapLine[],
  ) => {
    const half = size / 2
    // [centre value that aligns, guide position, label]
    const candidates: [number, number, string][] = [
      [50, 50, canvasLabels[0]],
      [half, 0, canvasLabels[1]],
      [100 - half, 100, canvasLabels[2]],
    ]
    for (const line of lines) {
      candidates.push(
        [line.position, line.position, line.label],
        [line.position + half, line.position, line.label],
        [line.position - half, line.position, line.label],
      )
    }
    let best: { value: number; guide: SnapGuide; d: number } | null = null
    for (const [value, guide, label] of candidates) {
      const d = Math.abs(raw - value)
      if (d < threshold && (!best || d < best.d - 1e-9))
        best = { value, guide: { position: guide, label }, d }
    }
    return best ? { value: best.value, guide: best.guide } : { value: raw, guide: null }
  }
  const x = axis(rawX, widthPercent, ['Center', 'Left edge', 'Right edge'], targets.x)
  const y = axis(rawY, heightPercent, ['Middle', 'Top edge', 'Bottom edge'], targets.y)
  snap.x = x.guide
  snap.y = y.guide
  const round = (v: number) => Math.round(Math.min(150, Math.max(-50, v)) * 10) / 10
  return { x: round(x.value), y: round(y.value), snap }
}

/** Proportional resize from a corner: returns the new width percentage. */
export function scaleImage(
  initialWidth: number,
  center: Point,
  startPoint: Point,
  currentPoint: Point,
): number {
  const initialDist = Math.hypot(startPoint.x - center.x, startPoint.y - center.y)
  const currentDist = Math.hypot(currentPoint.x - center.x, currentPoint.y - center.y)
  if (initialDist < 5) return initialWidth
  return (
    Math.round(Math.min(400, Math.max(2, initialWidth * (currentDist / initialDist))) * 10) / 10
  )
}
