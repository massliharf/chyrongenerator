/**
 * Timeline arithmetic: ruler steps for any zoom, snapping, and time labels.
 * Kept free of React so it can be tested on its own.
 */

/** Zoom limits: 1 = the whole clip fits the width. */
export const MIN_ZOOM = 1
export const MAX_ZOOM = 40

/** Labelled ticks at least this far apart, in pixels. */
const MAJOR_MIN_PX = 72
/** Small ticks at least this far apart, in pixels. */
const MINOR_MIN_PX = 8

/**
 * Seconds between labelled ticks and between small ticks for a ruler drawn at
 * `pxPerSecond`. Steps are whole frames when zoomed far in, then tenths,
 * seconds, and round minutes. `minor` is 0 when small ticks would crowd.
 */
export function rulerSteps(pxPerSecond: number, fps: number) {
  const frame = 1 / fps
  // Round decimal steps first; whole frames only below a tenth of a second.
  const candidates = [frame, 2 * frame, 0.1, 0.2, 0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300].sort(
    (a, b) => a - b,
  )
  const major = candidates.find((s) => s * pxPerSecond >= MAJOR_MIN_PX) ?? candidates.at(-1)!
  // A small tick divides the major step evenly: fifths, quarters or halves, never below a frame.
  const minor =
    [5, 4, 2]
      .map((n) => major / n)
      .find((s) => s >= frame - 1e-9 && s * pxPerSecond >= MINOR_MIN_PX) ?? 0
  return { major, minor }
}

/** Times of the labelled ticks from 0 to `total`. */
export function rulerTicks(total: number, major: number) {
  const ticks: number[] = []
  const count = Math.floor(total / major + 1e-6)
  for (let i = 0; i <= count && ticks.length < 2000; i++) ticks.push(i * major)
  return ticks
}

/** A ruler label: as many decimals as the step needs. */
export function tickLabel(seconds: number, step: number) {
  const decimals = step >= 1 ? 0 : Math.abs(step * 10 - Math.round(step * 10)) < 1e-6 ? 1 : 2
  if (seconds >= 60 && step >= 1) {
    const m = Math.floor(seconds / 60)
    const s = Math.round(seconds - m * 60)
    return `${m}:${String(s).padStart(2, '0')}`
  }
  return `${seconds.toFixed(decimals)}s`
}

/**
 * Snaps `value` to the nearest of `targets` within `threshold` seconds.
 * Returns the value unchanged (and `target: null`) when nothing is close.
 */
export function snapTo(value: number, targets: number[], threshold: number) {
  let best: number | null = null
  for (const t of targets)
    if (
      Math.abs(t - value) <= threshold &&
      (best === null || Math.abs(t - value) < Math.abs(best - value))
    )
      best = t
  return { value: best ?? value, target: best }
}

/** The current time as seconds ("2.20") or as seconds and frames ("00:02:06"). */
export function formatTime(seconds: number, fps: number, mode: 'seconds' | 'frames') {
  if (mode === 'seconds') return seconds.toFixed(2)
  const frames = Math.round(seconds * fps)
  const s = Math.floor(frames / fps)
  const f = frames - s * fps
  const m = Math.floor(s / 60)
  return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}:${String(f).padStart(2, '0')}`
}
