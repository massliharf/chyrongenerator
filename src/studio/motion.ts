import { duration, frameCount, type Project } from './model'
export const clamp = (x: number) => Math.max(0, Math.min(1, x))
const smooth = (x: number) => x * x * x * (x * (x * 6 - 15) + 10)
const outCubic = (x: number) => 1 - (1 - x) ** 3
const outBack = (x: number) => 1 + 2.4 * (x - 1) ** 3 + 1.4 * (x - 1) ** 2
export interface Pose {
  opacity: number
  x: number
  y: number
  scale: number
  scaleX: number
  rotation: number
  reveal: number
}

/** Pure time-based motion: preview, scrubbing and offline renders use exactly this function. */
export function poseAt(time: number, index: number, count: number, p: Project): Pose {
  const pose: Pose = { opacity: 1, x: 0, y: 0, scale: 1, scaleX: 1, rotation: 0, reveal: 1 }
  if (p.motion === 'none') return pose
  const total = duration(p)
  // Mirror the same clock, easing and stagger so the outro retraces the intro.
  // Matching transparent margins guarantee clean first/last encoded frames,
  // including durations that don't divide evenly into the selected frame rate.
  const edge = total - (frameCount(p) - 1) / p.fps
  const phaseTime = Math.min(time, total - time)
  const progress = clamp((phaseTime - edge) / (p.animationDuration - edge))
  const order = count <= 1 ? 0 : index / (count - 1)
  // Normalize stagger to the element count. Even 160 letters finish within the intro.
  const enter = clamp((progress - order * p.stagger) / (1 - p.stagger))
  pose.opacity = phaseTime <= edge + 1e-7 ? 0 : smooth(clamp(enter * 3))
  if (p.motion === 'pop') {
    pose.scale = Math.max(0.001, 0.45 + 0.55 * outBack(enter))
    pose.y = (1 - outCubic(enter)) * 45
    pose.rotation = (1 - outCubic(enter)) * (index % 2 ? 12 : -12)
  } else if (p.motion === 'flip') {
    const turn = 1 - outCubic(enter)
    // Orthographic projection of a letter turning from edge-on to face-on.
    pose.scaleX = Math.max(0.001, Math.cos((turn * Math.PI) / 2))
    pose.rotation = turn * -8
    pose.y = turn * 18
  } else if (p.motion === 'slide') {
    pose.y = (1 - outCubic(enter)) * 85
  } else if (p.motion === 'wipe') {
    pose.reveal = smooth(enter)
    pose.x = (1 - outCubic(enter)) * -18
  } else if (p.motion === 'typewriter') {
    pose.opacity = enter > 0.15 ? 1 : 0
  } else {
    pose.opacity = phaseTime <= edge + 1e-7 ? 0 : smooth(enter)
    pose.y = (1 - smooth(enter)) * 12
  }
  return pose
}
