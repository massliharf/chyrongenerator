import { clamp, hostRect, type Bounds, type Format, type Layout } from './model'

export const CORNERS = ['top-left', 'top-right', 'bottom-left', 'bottom-right'] as const
export type Corner = (typeof CORNERS)[number]
export type Point = { x: number; y: number }

// Project the pointer onto the rotated diagonal. The opposite corner stays fixed,
// including for flipped cutouts, and the image always keeps its proportions.
export function resizeHost(
  format: Format,
  layout: Layout,
  bounds: Bounds,
  corner: Corner,
  delta: Point,
): Pick<Layout, 'x' | 'y' | 'zoom'> {
  const rect = hostRect(format, layout, bounds)
  const angle = (layout.rotation * Math.PI) / 180
  const dx = rect.width * (corner.endsWith('left') ? -1 : 1)
  const dy = rect.height * (corner.startsWith('top') ? -1 : 1)
  const vx = dx * Math.cos(angle) - dy * Math.sin(angle)
  const vy = dx * Math.sin(angle) + dy * Math.cos(angle)
  const factor = 1 + (delta.x * vx + delta.y * vy) / (vx * vx + vy * vy)
  const zoom = Math.round(clamp(layout.zoom * factor, 20, 300) * 100) / 100
  const shift = (zoom / layout.zoom - 1) / 2
  return {
    zoom,
    x: clamp(layout.x + ((vx * shift) / format.width) * 100, -50, 150),
    y: clamp(layout.y + ((vy * shift) / format.height) * 100, -50, 150),
  }
}

export function normalizeRotation(degrees: number) {
  return ((((Math.round(degrees) + 180) % 360) + 360) % 360) - 180
}

export function rotateHost(
  rotation: number,
  center: Point,
  start: Point,
  end: Point,
  snap: boolean,
) {
  const angle = (point: Point) => Math.atan2(point.y - center.y, point.x - center.x)
  const degrees = rotation + ((angle(end) - angle(start)) * 180) / Math.PI
  return normalizeRotation(snap ? Math.round(degrees / 15) * 15 : degrees)
}

export function isFormatPointInHost(
  point: Point,
  format: Format,
  layout: Layout,
  bounds: Bounds,
): boolean {
  const rect = hostRect(format, layout, bounds)
  const angle = (-layout.rotation * Math.PI) / 180
  const dx = point.x - rect.x
  const dy = point.y - rect.y
  const unrotX = dx * Math.cos(angle) - dy * Math.sin(angle)
  const unrotY = dx * Math.sin(angle) + dy * Math.cos(angle)
  return Math.abs(unrotX) <= rect.width / 2 && Math.abs(unrotY) <= rect.height / 2
}

export function isPointInHost(
  clientPoint: Point,
  canvasRect: { left: number; top: number; width: number; height: number },
  format: Format,
  layout: Layout,
  bounds: Bounds,
): boolean {
  if (canvasRect.width <= 0 || canvasRect.height <= 0) return false
  const px = ((clientPoint.x - canvasRect.left) / canvasRect.width) * format.width
  const py = ((clientPoint.y - canvasRect.top) / canvasRect.height) * format.height
  return isFormatPointInHost({ x: px, y: py }, format, layout, bounds)
}
