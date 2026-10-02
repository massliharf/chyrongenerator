import type { ShapeKind } from './model'

export interface ShapeParams {
  radius?: number
  sides?: number
  points?: number
  inner?: number
}

const f = (n: number) => Math.round(n * 1000) / 1000

/** Points on an ellipse, rescaled so their bounds fill the box exactly. */
function fitted(pts: [number, number][], x: number, y: number, w: number, h: number) {
  const xs = pts.map((p) => p[0]),
    ys = pts.map((p) => p[1])
  const minX = Math.min(...xs),
    minY = Math.min(...ys)
  const sx = w / (Math.max(...xs) - minX || 1),
    sy = h / (Math.max(...ys) - minY || 1)
  return (
    pts
      .map(([px, py], i) => `${i ? 'L' : 'M'}${f(x + (px - minX) * sx)} ${f(y + (py - minY) * sy)}`)
      .join(' ') + ' Z'
  )
}

function roundedRect(x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2))
  if (!rr) return `M${f(x)} ${f(y)} H${f(x + w)} V${f(y + h)} H${f(x)} Z`
  return [
    `M${f(x + rr)} ${f(y)}`,
    `H${f(x + w - rr)}`,
    `A${f(rr)} ${f(rr)} 0 0 1 ${f(x + w)} ${f(y + rr)}`,
    `V${f(y + h - rr)}`,
    `A${f(rr)} ${f(rr)} 0 0 1 ${f(x + w - rr)} ${f(y + h)}`,
    `H${f(x + rr)}`,
    `A${f(rr)} ${f(rr)} 0 0 1 ${f(x)} ${f(y + h - rr)}`,
    `V${f(y + rr)}`,
    `A${f(rr)} ${f(rr)} 0 0 1 ${f(x + rr)} ${f(y)}`,
    'Z',
  ].join(' ')
}

/**
 * SVG path data for a shape filling the box (x, y, w, h). The same string
 * feeds Path2D on canvas, hit testing and the SVG icons in the panels.
 */
export function shapePath(
  kind: ShapeKind,
  x: number,
  y: number,
  w: number,
  h: number,
  p: ShapeParams = {},
) {
  w = Math.max(0.5, w)
  h = Math.max(0.5, h)
  switch (kind) {
    case 'rect':
      return roundedRect(x, y, w, h, p.radius ?? 0)
    case 'ellipse': {
      const rx = w / 2,
        ry = h / 2
      return `M${f(x + rx)} ${f(y)} A${f(rx)} ${f(ry)} 0 1 1 ${f(x + rx)} ${f(y + h)} A${f(rx)} ${f(ry)} 0 1 1 ${f(x + rx)} ${f(y)} Z`
    }
    case 'triangle':
      return `M${f(x + w / 2)} ${f(y)} L${f(x + w)} ${f(y + h)} L${f(x)} ${f(y + h)} Z`
    case 'polygon': {
      const n = Math.max(3, Math.min(24, Math.round(p.sides ?? 6)))
      const pts: [number, number][] = []
      for (let i = 0; i < n; i++) {
        const a = -Math.PI / 2 + (i * 2 * Math.PI) / n
        pts.push([Math.cos(a), Math.sin(a)])
      }
      return fitted(pts, x, y, w, h)
    }
    case 'star': {
      const n = Math.max(3, Math.min(24, Math.round(p.points ?? 5)))
      const inner = Math.max(0.1, Math.min(0.95, p.inner ?? 0.45))
      const pts: [number, number][] = []
      for (let i = 0; i < n * 2; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / n
        const r = i % 2 ? inner : 1
        pts.push([Math.cos(a) * r, Math.sin(a) * r])
      }
      return fitted(pts, x, y, w, h)
    }
    case 'heart': {
      const X = (u: number) => f(x + u * w),
        Y = (v: number) => f(y + v * h)
      return [
        `M${X(0.5)} ${Y(1)}`,
        `C${X(0.5)} ${Y(1)} ${X(0)} ${Y(0.66)} ${X(0)} ${Y(0.31)}`,
        `C${X(0)} ${Y(0.12)} ${X(0.14)} ${Y(0)} ${X(0.29)} ${Y(0)}`,
        `C${X(0.39)} ${Y(0)} ${X(0.46)} ${Y(0.06)} ${X(0.5)} ${Y(0.15)}`,
        `C${X(0.54)} ${Y(0.06)} ${X(0.61)} ${Y(0)} ${X(0.71)} ${Y(0)}`,
        `C${X(0.86)} ${Y(0)} ${X(1)} ${Y(0.12)} ${X(1)} ${Y(0.31)}`,
        `C${X(1)} ${Y(0.66)} ${X(0.5)} ${Y(1)} ${X(0.5)} ${Y(1)}`,
        'Z',
      ].join(' ')
    }
    case 'arch': {
      const rx = w / 2,
        ry = Math.min(w / 2, h)
      return `M${f(x)} ${f(y + h)} V${f(y + ry)} A${f(rx)} ${f(ry)} 0 0 1 ${f(x + w)} ${f(y + ry)} V${f(y + h)} Z`
    }
  }
}
