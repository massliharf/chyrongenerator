/** Where a floating panel goes next to its trigger: below (or above), start- or end-aligned, on screen. */
export function placeNear(
  anchor: DOMRect,
  panel: { width: number; height: number },
  {
    align = 'start',
    placement = 'bottom',
    gap = 4,
  }: {
    align?: 'start' | 'end' | 'center'
    placement?: 'bottom' | 'top'
    gap?: number
  } = {},
) {
  const margin = 8
  const vw = window.innerWidth,
    vh = window.innerHeight
  const below = anchor.bottom + gap,
    above = anchor.top - gap - panel.height
  const fitsBelow = below + panel.height <= vh - margin
  const fitsAbove = above >= margin
  // The preferred side, or the other one when only that one has room.
  let y =
    placement === 'top'
      ? fitsAbove || !fitsBelow
        ? above
        : below
      : fitsBelow || !fitsAbove
        ? below
        : above
  let x =
    align === 'center'
      ? anchor.left + anchor.width / 2 - panel.width / 2
      : align === 'end'
        ? anchor.right - panel.width
        : anchor.left
  // Flip sideways before clamping, like system menus.
  if (align === 'start' && x + panel.width > vw - margin) x = anchor.right - panel.width
  if (align === 'end' && x < margin) x = anchor.left
  x = Math.max(margin, Math.min(x, vw - panel.width - margin))
  y = Math.max(margin, Math.min(y, vh - panel.height - margin))
  return { x, y }
}
