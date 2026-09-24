import {
  chyronLayer,
  duration,
  frameCount,
  type Easing,
  type ImageLayer,
  type ImageMotion,
  type Project,
} from './model'
export const clamp = (x: number) => Math.max(0, Math.min(1, x))
const smooth = (x: number) => x * x * x * (x * (x * 6 - 15) + 10)
const outCubic = (x: number) => 1 - (1 - x) ** 3
const outBack = (x: number) => 1 + 2.4 * (x - 1) ** 3 + 1.4 * (x - 1) ** 2
const outExpo = (x: number) => (x >= 1 ? 1 : 1 - 2 ** (-10 * x))
const outQuart = (x: number) => 1 - (1 - x) ** 4
function outBounce(x: number) {
  const n = 7.5625,
    d = 2.75
  if (x < 1 / d) return n * x * x
  if (x < 2 / d) return n * (x -= 1.5 / d) * x + 0.75
  if (x < 2.5 / d) return n * (x -= 2.25 / d) * x + 0.9375
  return n * (x -= 2.625 / d) * x + 0.984375
}
function outElastic(x: number) {
  if (x <= 0 || x >= 1) return x <= 0 ? 0 : 1
  return 2 ** (-10 * x) * Math.sin(((x * 10 - 0.75) * 2 * Math.PI) / 3) + 1
}
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
  // A layer delay starts the intro later and finishes the outro earlier by the same amount.
  const delay = Math.min(chyronLayer(p).delay, Math.max(0, total / 2 - p.animationDuration))
  const phaseTime = Math.min(time, total - time) - delay
  const progress = clamp((phaseTime - edge) / (p.animationDuration - edge))
  const order = count <= 1 ? 0 : index / (count - 1)
  // Normalize stagger to the element count. Even 160 letters finish within the intro.
  const enter = clamp((progress - order * p.stagger) / (1 - p.stagger))
  const hidden = phaseTime <= edge + 1e-7
  pose.opacity = hidden ? 0 : smooth(clamp(enter * 3))
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
  } else if (p.motion === 'drop') {
    // Letters fall from above and bounce into place.
    pose.y = -(1 - outBounce(enter)) * 140
    pose.opacity = phaseTime <= edge + 1e-7 ? 0 : smooth(clamp(enter * 6))
  } else if (p.motion === 'zoom') {
    // Letters shrink down from oversized, like a camera push.
    pose.scale = 1 + 1.6 * (1 - outCubic(enter))
    pose.opacity = phaseTime <= edge + 1e-7 ? 0 : smooth(clamp(enter * 2))
  } else if (p.motion === 'spin') {
    pose.rotation = (1 - outCubic(enter)) * (index % 2 ? 200 : -200)
    pose.scale = Math.max(0.001, 0.2 + 0.8 * outBack(enter))
  } else if (p.motion === 'wave') {
    // A ripple: each letter overshoots upward, then settles.
    pose.y = (1 - outElastic(enter)) * 70
  } else if (p.motion === 'elastic') {
    pose.scale = Math.max(0.001, outElastic(enter))
    pose.scaleX = Math.max(0.001, 1 + (1 - outCubic(enter)) * 0.6)
  } else if (p.motion === 'bounce') {
    pose.scale = Math.max(0.001, outBounce(enter))
  } else if (p.motion === 'from-left' || p.motion === 'from-right') {
    pose.x = (1 - outExpo(enter)) * (p.motion === 'from-left' ? -240 : 240)
    pose.opacity = hidden ? 0 : smooth(clamp(enter * 2))
  } else if (p.motion === 'split') {
    // Alternate letters arrive from above and below.
    pose.y = (1 - outCubic(enter)) * (index % 2 ? 130 : -130)
  } else if (p.motion === 'scatter') {
    const e = 1 - outCubic(enter)
    pose.x = (hash(index, 1) - 0.5) * 520 * e
    pose.y = (hash(index, 2) - 0.5) * 400 * e
    pose.rotation = (hash(index, 3) - 0.5) * 220 * e
    pose.scale = Math.max(0.001, 1 - 0.5 * e)
  } else if (p.motion === 'cascade') {
    const e = 1 - outBack(enter)
    pose.y = -e * 70
    pose.rotation = e * -30
  } else if (p.motion === 'stamp' || p.motion === 'slam') {
    // A fast approach, an impact, then a small recoil.
    const a = clamp(enter / 0.7)
    const recoil = enter > 0.7 ? (enter - 0.7) / 0.3 : 0
    const settle = Math.sin(recoil * Math.PI) * (1 - recoil)
    if (p.motion === 'stamp') pose.scale = 3 - 2 * a * a - 0.1 * settle
    else {
      pose.y = -(1 - a * a) * 180
      pose.scaleX = 1 + 0.3 * settle
      pose.scale = 1 - 0.12 * settle
    }
    pose.opacity = hidden ? 0 : smooth(clamp(a * 3))
  } else if (p.motion === 'shake') {
    pose.x = Math.sin(enter * 42) * (1 - enter) ** 2 * 28
  } else if (p.motion === 'blink' || p.motion === 'glitch') {
    // Deterministic flicker: the same letter blinks the same way every render.
    const step = Math.floor(enter * (p.motion === 'blink' ? 10 : 22))
    const on = enter >= 0.85 || hash(index * 7 + 1, step) < 0.2 + enter * 0.8
    pose.opacity = hidden ? 0 : on ? 1 : 0
    if (p.motion === 'glitch') {
      const k = 1 - enter
      pose.x = (hash(index, step + 50) - 0.5) * 60 * k
      pose.scaleX = 1 + (hash(index, step + 90) - 0.5) * 0.8 * k
    }
  } else if (p.motion === 'swing') {
    const s = 1 - enter
    pose.rotation = 70 * s * s * Math.cos(enter * Math.PI * 3) * (index % 2 ? 1 : -1)
    pose.y = -s * s * 40
  } else {
    pose.opacity = phaseTime <= edge + 1e-7 ? 0 : smooth(enter)
    pose.y = (1 - smooth(enter)) * 12
  }
  return pose
}

/** A softer spring for Burst: one generous overshoot that settles quickly. */
const outSpring = (x: number) =>
  x >= 1 ? 1 : 1 - Math.exp(-6.5 * x) * Math.cos(x * Math.PI * 2.2) * (1 - x) ** 0.5
export const EASE: Record<Exclude<Easing, 'auto'>, (x: number) => number> = {
  smooth: outCubic,
  snappy: outExpo,
  bounce: outBounce,
  elastic: outElastic,
  linear: (x) => x,
}
const AUTO_EASE: Record<ImageMotion, (x: number) => number> = {
  fade: smooth,
  pop: outBack,
  burst: outSpring,
  rise: outCubic,
  drop: outBounce,
  'slide-left': outQuart,
  'slide-right': outQuart,
  zoom: outCubic,
  slam: (x) => x,
  spin: outCubic,
  flip: outCubic,
  swing: (x) => x,
  wipe: smooth,
  iris: outCubic,
  focus: outCubic,
  glitch: (x) => x,
  stretch: (x) => x,
  roll: outCubic,
  unfold: outBack,
  bounce: outBounce,
  'from-top': outQuart,
  'from-bottom': outQuart,
  flicker: (x) => x,
  none: (x) => x,
}
/** Deterministic noise in [0, 1): identical for preview, scrubbing and export. */
export const hash = (a: number, b = 0) => {
  const v = Math.sin(a * 127.1 + b * 311.7) * 43758.5453
  return v - Math.floor(v)
}
export interface ImagePose {
  opacity: number
  /** Offsets in composition pixels. */
  x: number
  y: number
  scale: number
  scaleX: number
  scaleY: number
  rotation: number
  /** Rotation pivot relative to the layer center, as a fraction of its height. */
  pivotY: number
  blur: number
  brightness: number
  reveal: number
  revealMode: 'none' | 'wipe' | 'iris'
  glitch: number
  seed: number
  /** Position of the shine sweep in [0, 1], or -1 when inactive. */
  shine: number
  /** Burst spark progress in [0, 1), or -1 when inactive. */
  sparks: number
  /** Zoom applied to the picture inside its frame (Ken Burns). */
  contentZoom: number
}
export const settledImagePose = (): ImagePose => ({
  opacity: 1,
  x: 0,
  y: 0,
  scale: 1,
  scaleX: 1,
  scaleY: 1,
  rotation: 0,
  pivotY: 0,
  blur: 0,
  brightness: 1,
  reveal: 1,
  revealMode: 'none',
  glitch: 0,
  seed: 0,
  shine: -1,
  sparks: -1,
  contentZoom: 1,
})

/** Start and end of a layer's own intro, and start of its outro, in clip seconds. */
export function imageTiming(l: ImageLayer, p: Project) {
  const total = duration(p)
  const half = total / 2
  const delay = Math.min(l.delay, Math.max(0, half - 0.2))
  const length = Math.max(0.05, Math.min(l.duration, half - delay))
  return { total, delay, length, introEnd: delay + length, outroStart: total - delay - length }
}

function applyMotion(
  pose: ImagePose,
  motion: ImageMotion,
  t: number,
  l: ImageLayer,
  p: Project,
  frame: number,
) {
  const e = l.easing === 'auto' ? AUTO_EASE[motion](t) : EASE[l.easing](t)
  // Signature motions keep their shape and use the chosen easing as their clock.
  const s = l.easing === 'auto' ? t : EASE[l.easing](t)
  const w = (l.width / 100) * p.width
  const h = w * l.aspect
  const cx = (l.x / 100) * p.width
  const cy = (l.y / 100) * p.height
  const quick = (k: number) => smooth(clamp(t * k))
  switch (motion) {
    case 'fade':
      pose.opacity = clamp(e)
      break
    case 'pop':
      pose.scale = Math.max(0.001, 0.3 + 0.7 * e)
      pose.opacity = quick(3)
      break
    case 'burst':
      pose.scale = Math.max(0.001, e)
      pose.blur = (1 - t) ** 3 * 18
      pose.brightness = 1 + 1.6 * (1 - t) ** 4
      pose.opacity = quick(5)
      pose.sparks = t < 1 ? t : -1
      break
    case 'rise':
      pose.y = (1 - e) * (h * 0.6 + p.height * 0.08)
      pose.opacity = quick(2.5)
      break
    case 'drop':
      pose.y = -(1 - e) * (cy + h / 2 + 24)
      pose.opacity = quick(20)
      break
    case 'slide-left':
      pose.x = -(1 - e) * (cx + (w + h) / 2 + 24)
      pose.opacity = quick(20)
      break
    case 'slide-right':
      pose.x = (1 - e) * (p.width - cx + (w + h) / 2 + 24)
      pose.opacity = quick(20)
      break
    case 'zoom':
      pose.scale = Math.max(0.001, e)
      pose.blur = (1 - t) * 10
      pose.opacity = quick(2)
      break
    case 'slam': {
      const a = clamp(s / 0.6)
      pose.scale = 1 + 2.4 * (1 - a * a)
      pose.opacity = smooth(clamp(a * 3))
      pose.blur = (1 - a) * 6
      if (s > 0.6) {
        const b = (s - 0.6) / 0.4
        const decay = (1 - b) ** 2
        pose.x = Math.sin(b * 40) * decay * w * 0.03
        pose.y = Math.cos(b * 33) * decay * w * 0.03
        pose.scale += Math.sin(b * Math.PI * 3) * (1 - b) * 0.05
      }
      break
    }
    case 'spin':
      pose.rotation = -(1 - e) * 360
      pose.scale = Math.max(0.001, 0.1 + 0.9 * e)
      pose.opacity = quick(3)
      break
    case 'flip':
      pose.scaleX = Math.max(0.001, Math.cos(((1 - e) * Math.PI) / 2))
      pose.rotation = (1 - e) * -6
      pose.opacity = quick(4)
      break
    case 'swing':
      pose.pivotY = -0.5
      pose.rotation = 80 * (1 - s) ** 2 * Math.cos(s * Math.PI * 3)
      pose.y = -(1 - outCubic(s)) * h * 0.25
      pose.opacity = smooth(clamp(s * 4))
      break
    case 'wipe':
      pose.reveal = clamp(e)
      pose.revealMode = 'wipe'
      pose.x = (1 - e) * -0.04 * w
      break
    case 'iris':
      pose.reveal = clamp(e)
      pose.revealMode = 'iris'
      pose.scale = 1.06 - 0.06 * e
      break
    case 'focus':
      pose.blur = (1 - e) * 28
      pose.scale = 1.12 - 0.12 * e
      pose.opacity = smooth(clamp(t * 1.5))
      break
    case 'glitch': {
      pose.seed = frame
      if (s >= 0.85) {
        pose.glitch = (1 - s) * 2
        break
      }
      const on = hash(frame, 1) < 0.3 + 0.7 * s
      pose.opacity = on ? 0.55 + 0.45 * s : 0
      pose.glitch = 1 - s
      pose.x = (hash(frame, 2) - 0.5) * 0.12 * w * (1 - s)
      break
    }
    case 'stretch': {
      // Squash and stretch: tall and thin, then wide, then settled.
      const k = outElastic(s)
      pose.scaleY = Math.max(0.001, k)
      pose.scaleX = Math.max(0.001, 2 - k)
      pose.opacity = smooth(clamp(s * 5))
      break
    }
    case 'roll':
      pose.x = -(1 - e) * (cx + w / 2 + 24)
      pose.rotation = -(1 - e) * 540
      pose.opacity = quick(10)
      break
    case 'unfold':
      pose.scaleY = Math.max(0.001, e)
      pose.pivotY = -0.5
      pose.opacity = quick(6)
      break
    case 'bounce':
      pose.scale = Math.max(0.001, e)
      pose.opacity = quick(6)
      break
    case 'from-top':
      pose.y = -(1 - e) * (cy + h / 2 + 24)
      pose.opacity = quick(20)
      break
    case 'from-bottom':
      pose.y = (1 - e) * (p.height - cy + h / 2 + 24)
      pose.opacity = quick(20)
      break
    case 'flicker': {
      pose.seed = frame
      const on = s >= 0.9 || hash(frame, 21) < 0.25 + 0.75 * s
      pose.opacity = on ? 1 : 0
      break
    }
    case 'none':
      break
  }
}

function applyEmphasis(pose: ImagePose, l: ImageLayer, p: Project, time: number, frame: number) {
  if (l.emphasis === 'none' || l.emphasisStrength <= 0) return
  const { total, introEnd, outroStart } = imageTiming(l, p)
  const strength = l.emphasisStrength / 100
  const w = (l.width / 100) * p.width
  const h = w * l.aspect
  if (l.emphasis === 'orbit') {
    // Whole turns across the hold: eases in and out and ends exactly upright.
    const span = Math.max(0.001, outroStart - introEnd)
    const turns = Math.max(1, Math.round((strength * span) / l.emphasisSpeed))
    pose.rotation += 360 * turns * smooth(clamp((time - introEnd) / span))
    return
  }
  if (l.emphasis === 'kenburns') {
    // A continuous push across the whole clip, so there is never a jump at a boundary.
    pose.contentZoom = 1 + strength * 0.2 * (time / total)
    return
  }
  const envelope =
    smooth(clamp((time - introEnd) / 0.35)) * smooth(clamp((outroStart - time) / 0.35))
  if (envelope <= 0) return
  const phase = (time - introEnd) / l.emphasisSpeed
  const wave = Math.sin(phase * Math.PI * 2)
  if (l.emphasis === 'pulse')
    pose.scale *= 1 + 0.09 * strength * envelope * (0.5 - 0.5 * Math.cos(phase * Math.PI * 2))
  else if (l.emphasis === 'float') pose.y += wave * strength * 0.04 * h * envelope
  else if (l.emphasis === 'sway') pose.rotation += wave * strength * 7 * envelope
  else if (l.emphasis === 'rumble') {
    const amp = strength * 0.015 * w * envelope
    pose.x += (hash(frame, 7) - 0.5) * 2 * amp
    pose.y += (hash(frame, 8) - 0.5) * 2 * amp
    pose.rotation += (hash(frame, 9) - 0.5) * strength * 2 * envelope
  } else if (l.emphasis === 'glow') {
    pose.brightness = 1 + 0.4 * strength * envelope * (0.5 - 0.5 * Math.cos(phase * Math.PI * 2))
  } else if (l.emphasis === 'jelly') {
    const k = 0.07 * strength * envelope * Math.sin(phase * Math.PI * 4)
    pose.scaleX *= 1 + k
    pose.scaleY *= 1 - k
  } else if (l.emphasis === 'wiggle') {
    pose.rotation += Math.sin(phase * Math.PI * 8) * strength * 6 * envelope
  } else if (l.emphasis === 'heartbeat') {
    // Two quick beats, then rest.
    const c = phase - Math.floor(phase)
    const beat = (t: number) => Math.max(0, 1 - Math.abs(c - t) / 0.08)
    pose.scale *= 1 + 0.12 * strength * envelope * Math.max(beat(0.1), beat(0.3) * 0.7)
  } else if (l.emphasis === 'shine' && envelope > 0.5) {
    const cycle = phase - Math.floor(phase)
    // The sweep occupies the first half of each cycle; brighter strength = wider band.
    if (cycle < 0.5) pose.shine = cycle / 0.5
  }
}

/** Pure time-based pose for an image layer. Preview, scrubbing and export share it. */
export function imagePoseAt(time: number, l: ImageLayer, p: Project): ImagePose {
  const pose = settledImagePose()
  const { total, delay, length } = imageTiming(l, p)
  const edge = total - (frameCount(p) - 1) / p.fps
  const intro = time <= total / 2
  const local = (intro ? time : total - time) - delay
  const frame = Math.round(time * p.fps)
  const motion = intro || l.outro === 'mirror' ? l.intro : l.outro
  if (local <= edge + 1e-7) {
    pose.opacity = 0
    return pose
  }
  const t = motion === 'none' ? 1 : clamp((local - edge) / Math.max(1e-6, length - edge))
  if (t < 1) applyMotion(pose, motion, t, l, p, frame)
  else if (motion === 'glitch') pose.seed = frame
  applyEmphasis(pose, l, p, time, frame)
  return pose
}
