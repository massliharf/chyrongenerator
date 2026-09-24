export const FONT_NAMES = [
  'Wicked Mouse',
  'Inter',
  'Anton',
  'Bangers',
  'Fredoka',
  'Oswald',
  'Chewy',
  'Permanent Marker',
  'Ranchers',
  'Nunito',
] as const
export type FontName = (typeof FONT_NAMES)[number]
export const MOTIONS = [
  'pop',
  'flip',
  'slide',
  'wipe',
  'typewriter',
  'fade',
  'drop',
  'zoom',
  'spin',
  'wave',
  'elastic',
  'swing',
  'bounce',
  'from-left',
  'from-right',
  'split',
  'scatter',
  'cascade',
  'stamp',
  'slam',
  'shake',
  'blink',
  'glitch',
  'none',
] as const
export type Motion = (typeof MOTIONS)[number]
export type Effect = 'extrude' | 'skew' | 'offset' | 'outline' | 'retro' | 'glow' | 'neon'

/** Intro/outro styles for uploaded images. Each describes the journey from hidden (0) to settled (1). */
export const IMAGE_MOTIONS = [
  'fade',
  'pop',
  'burst',
  'rise',
  'drop',
  'slide-left',
  'slide-right',
  'zoom',
  'slam',
  'spin',
  'flip',
  'swing',
  'wipe',
  'iris',
  'focus',
  'glitch',
  'stretch',
  'roll',
  'unfold',
  'bounce',
  'from-top',
  'from-bottom',
  'flicker',
  'none',
] as const
export type ImageMotion = (typeof IMAGE_MOTIONS)[number]
export const EASINGS = ['auto', 'smooth', 'snappy', 'bounce', 'elastic', 'linear'] as const
export type Easing = (typeof EASINGS)[number]
export const HOLD_EFFECTS = [
  'none',
  'pulse',
  'float',
  'sway',
  'kenburns',
  'shine',
  'rumble',
  'wiggle',
  'heartbeat',
  'orbit',
  'glow',
  'jelly',
] as const
export type HoldEffect = (typeof HOLD_EFFECTS)[number]

export interface ChyronLayer {
  id: 'chyron'
  kind: 'chyron'
  name: string
  visible: boolean
  /** Seconds after the clip starts before the title's intro begins; the outro finishes this early. */
  delay: number
}
export interface ImageLayer {
  id: string
  kind: 'image'
  name: string
  assetId: string
  /** Natural height ÷ width, kept on the layer so layout never waits for decoding. */
  aspect: number
  visible: boolean
  /** Center position as a percentage of the canvas. Values outside 0–100 sit partly off-canvas. */
  x: number
  y: number
  /** Width as a percentage of the canvas width. */
  width: number
  rotation: number
  opacity: number
  flipX: boolean
  radius: number
  border: number
  borderColor: string
  shadow: number
  intro: ImageMotion
  outro: ImageMotion | 'mirror'
  easing: Easing
  duration: number
  delay: number
  emphasis: HoldEffect
  emphasisStrength: number
  /** Seconds per emphasis cycle. */
  emphasisSpeed: number
  burstColor: string
}
export type Layer = ChyronLayer | ImageLayer
export const CHYRON_LAYER: ChyronLayer = {
  id: 'chyron',
  kind: 'chyron',
  name: 'Chyron',
  visible: true,
  delay: 0,
}
export const DEFAULT_IMAGE_LAYER: Omit<ImageLayer, 'id' | 'assetId' | 'aspect' | 'name'> = {
  kind: 'image',
  visible: true,
  x: 50,
  y: 50,
  width: 60,
  rotation: 0,
  opacity: 100,
  flipX: false,
  radius: 0,
  border: 0,
  borderColor: '#ffffff',
  shadow: 0,
  intro: 'pop',
  outro: 'mirror',
  easing: 'auto',
  duration: 1,
  delay: 0,
  emphasis: 'none',
  emphasisStrength: 50,
  emphasisSpeed: 2,
  burstColor: '#ffffff',
}
export interface Project {
  version: 2
  name: string
  mode: 'tiles' | 'typography'
  text: string
  textCase: 'upper' | 'original' | 'lower'
  tracking: number
  subtitle: string
  font: FontName
  tileColor: string
  textColor: string
  accent: string
  subtitleColor: string
  effectColor: string
  effectColor2: string
  effect: Effect
  filled: boolean
  italic: boolean
  tileSize: number
  gap: number
  lineGap: number
  padding: number
  radius: number
  depth: number
  rotation: number
  variation: number
  scatter: number
  shadowVariation: number
  glow: number
  backdrop: boolean
  subtitleSize: number
  subtitleGap: number
  subtitleRadius: number
  subtitlePaddingX: number
  subtitlePaddingY: number
  subtitlePosition: 'top' | 'bottom'
  subtitlePill: boolean
  align: 'left' | 'center' | 'right'
  width: number
  height: number
  scale: number
  compositionRotation: number
  opacity: number
  x: number
  y: number
  fps: 24 | 30 | 60
  motion: Motion
  animationDuration: number
  hold: number
  stagger: number
  previewBackground: 'live' | 'checker' | 'dark' | 'light' | 'color'
  background: string
  /** Bottom-to-top stack. Always contains exactly one chyron layer. */
  layers: Layer[]
}

export const DEFAULT_PROJECT: Project = {
  version: 2,
  name: 'Untitled chyron',
  mode: 'tiles',
  text: 'Scott\nRogowsky',
  textCase: 'upper',
  tracking: 0,
  subtitle: 'PUZZLE PAPI',
  font: 'Fredoka',
  tileColor: '#b8d4ff',
  textColor: '#142a4f',
  accent: '#3e75f3',
  subtitleColor: '#ffffff',
  effectColor: '#233a66',
  effectColor2: '#9075fc',
  effect: 'extrude',
  filled: true,
  italic: false,
  tileSize: 128,
  gap: 8,
  lineGap: 16,
  padding: 16,
  radius: 24,
  depth: 8,
  rotation: 5,
  variation: 0,
  scatter: 0,
  shadowVariation: 0,
  glow: 0,
  backdrop: false,
  subtitleSize: 64,
  subtitleGap: 32,
  subtitleRadius: 24,
  subtitlePaddingX: 24,
  subtitlePaddingY: 32,
  subtitlePosition: 'bottom',
  subtitlePill: true,
  align: 'center',
  width: 720,
  height: 1280,
  scale: 100,
  compositionRotation: 0,
  opacity: 100,
  x: 50,
  y: 50,
  fps: 30,
  motion: 'pop',
  animationDuration: 1,
  hold: 2.4,
  stagger: 0.45,
  previewBackground: 'live',
  background: '#14243d',
  layers: [CHYRON_LAYER],
}

const numericLimits: Partial<Record<keyof Project, [number, number]>> = {
  tileSize: [48, 180],
  tracking: [-4, 32],
  gap: [0, 48],
  lineGap: [0, 80],
  padding: [0, 35],
  radius: [0, 80],
  depth: [0, 30],
  rotation: [0, 18],
  variation: [0, 0.3],
  scatter: [0, 30],
  shadowVariation: [0, 12],
  glow: [0, 40],
  subtitleSize: [12, 80],
  subtitleGap: [0, 100],
  subtitleRadius: [0, 50],
  subtitlePaddingX: [0, 80],
  subtitlePaddingY: [0, 40],
  width: [320, 3840],
  height: [180, 3840],
  scale: [20, 150],
  compositionRotation: [-180, 180],
  opacity: [0, 100],
  x: [10, 90],
  y: [10, 90],
  animationDuration: [0.2, 4],
  hold: [0, 12],
  stagger: [0, 0.8],
}
const enums: Partial<Record<keyof Project, readonly (string | number)[]>> = {
  mode: ['tiles', 'typography'],
  textCase: ['upper', 'original', 'lower'],
  font: FONT_NAMES,
  effect: ['extrude', 'skew', 'offset', 'outline', 'retro', 'glow', 'neon'],
  subtitlePosition: ['top', 'bottom'],
  align: ['left', 'center', 'right'],
  fps: [24, 30, 60],
  motion: [...MOTIONS],
  previewBackground: ['live', 'checker', 'dark', 'light', 'color'],
}
const colors = [
  'tileColor',
  'textColor',
  'accent',
  'subtitleColor',
  'effectColor',
  'effectColor2',
  'background',
]
export function normalizeProject(value: unknown): Project {
  const output = { ...DEFAULT_PROJECT }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return output
  const record = { ...value } as Record<string, unknown>
  // Earlier v2 projects stored separate intro/outro lengths. Keep their intro timing
  // as the shared duration while retaining their artwork and canvas dimensions.
  if (record.animationDuration === undefined) {
    record.animationDuration = [record.entrance, record.exit].find(
      (v) => typeof v === 'number' && Number.isFinite(v),
    )
  }
  for (const key of Object.keys(output) as (keyof Project)[]) {
    const input = record[key]
    if (input === undefined || key === 'version' || key === 'layers') continue
    const limits = numericLimits[key]
    let validated: unknown
    if (limits) {
      if (typeof input !== 'number' || !Number.isFinite(input)) continue
      validated = Math.min(limits[1], Math.max(limits[0], input))
    } else if (enums[key]) {
      if (!enums[key]?.includes(input as never)) continue
      validated = input
    } else if (colors.includes(key)) {
      if (typeof input !== 'string' || !/^#[0-9a-f]{6}$/i.test(input)) continue
      validated = input
    } else if (typeof output[key] === 'boolean') {
      if (typeof input !== 'boolean') continue
      validated = input
    } else if (typeof output[key] === 'string') {
      if (typeof input !== 'string') continue
      validated = input.slice(0, key === 'text' ? 160 : 80)
      if (key === 'text') validated = (validated as string).split('\n').slice(0, 5).join('\n')
      if (key === 'subtitle') validated = (validated as string).replace(/[\r\n]/g, ' ')
    } else continue
    Object.assign(output, { [key]: validated })
  }
  output.width = Math.round(output.width / 2) * 2
  output.height = Math.round(output.height / 2) * 2
  output.layers = normalizeLayers(record.layers)
  return output
}

const num = (value: unknown, fallback: number, min: number, max: number) =>
  typeof value === 'number' && Number.isFinite(value)
    ? Math.min(max, Math.max(min, value))
    : fallback
const pick = <T extends string>(value: unknown, options: readonly T[], fallback: T): T =>
  options.includes(value as T) ? (value as T) : fallback
const hex = (value: unknown, fallback: string) =>
  typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value) ? value : fallback
const text = (value: unknown, fallback: string) =>
  typeof value === 'string' && value.trim() ? value.slice(0, 80) : fallback

export const MAX_IMAGE_LAYERS = 12
export function normalizeImageLayer(raw: Record<string, unknown>): ImageLayer | null {
  if (typeof raw.id !== 'string' || !raw.id || raw.id === 'chyron') return null
  if (typeof raw.assetId !== 'string' || !/^[\w-]{1,80}$/.test(raw.assetId)) return null
  const d = DEFAULT_IMAGE_LAYER
  return {
    id: raw.id.slice(0, 80),
    kind: 'image',
    name: text(raw.name, 'Image'),
    assetId: raw.assetId,
    aspect: num(raw.aspect, 1, 0.01, 100),
    visible: typeof raw.visible === 'boolean' ? raw.visible : true,
    x: num(raw.x, d.x, -50, 150),
    y: num(raw.y, d.y, -50, 150),
    width: num(raw.width, d.width, 2, 400),
    rotation: num(raw.rotation, d.rotation, -180, 180),
    opacity: num(raw.opacity, d.opacity, 0, 100),
    flipX: typeof raw.flipX === 'boolean' ? raw.flipX : false,
    radius: num(raw.radius, d.radius, 0, 50),
    border: num(raw.border, d.border, 0, 40),
    borderColor: hex(raw.borderColor, d.borderColor),
    shadow: num(raw.shadow, d.shadow, 0, 80),
    intro: pick(raw.intro, IMAGE_MOTIONS, d.intro),
    outro:
      raw.outro === 'mirror' ? 'mirror' : pick(raw.outro, IMAGE_MOTIONS, 'mirror' as ImageMotion),
    easing: pick(raw.easing, EASINGS, d.easing),
    duration: num(raw.duration, d.duration, 0.2, 4),
    delay: num(raw.delay, d.delay, 0, 10),
    emphasis: pick(raw.emphasis, HOLD_EFFECTS, d.emphasis),
    emphasisStrength: num(raw.emphasisStrength, d.emphasisStrength, 0, 100),
    emphasisSpeed: num(raw.emphasisSpeed, d.emphasisSpeed, 0.5, 8),
    burstColor: hex(raw.burstColor, d.burstColor),
  }
}
export function normalizeLayers(value: unknown): Layer[] {
  if (!Array.isArray(value)) return [{ ...CHYRON_LAYER }]
  const layers: Layer[] = []
  const ids = new Set<string>()
  let chyron: ChyronLayer | null = null
  for (const entry of value) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue
    const raw = entry as Record<string, unknown>
    if (raw.kind === 'chyron') {
      if (chyron) continue
      chyron = {
        ...CHYRON_LAYER,
        name: text(raw.name, CHYRON_LAYER.name),
        visible: typeof raw.visible === 'boolean' ? raw.visible : true,
        delay: num(raw.delay, 0, 0, 10),
      }
      layers.push(chyron)
    } else if (raw.kind === 'image') {
      const layer = normalizeImageLayer(raw)
      if (!layer || ids.has(layer.id) || ids.size >= MAX_IMAGE_LAYERS) continue
      ids.add(layer.id)
      layers.push(layer)
    }
  }
  if (!chyron) layers.push({ ...CHYRON_LAYER })
  return layers
}
export const chyronLayer = (p: Pick<Project, 'layers'>): ChyronLayer =>
  (p.layers?.find((l) => l.kind === 'chyron') as ChyronLayer | undefined) ?? CHYRON_LAYER
export const imageLayers = (p: Pick<Project, 'layers'>) =>
  (p.layers ?? []).filter((l): l is ImageLayer => l.kind === 'image')
/** True when the export would contain visible artwork. */
export const hasArtwork = (p: Project) =>
  (chyronLayer(p).visible && (!!p.text.trim() || (p.subtitlePill && !!p.subtitle.trim()))) ||
  imageLayers(p).some((l) => l.visible && l.opacity > 0)
/** Longest intro among visible layers, in seconds, bounded by half the clip. */
export function introLength(p: Project) {
  const half = duration(p) / 2
  let end = p.motion === 'none' ? 0 : p.animationDuration + chyronLayer(p).delay
  for (const l of imageLayers(p)) if (l.visible) end = Math.max(end, l.delay + l.duration)
  return Math.min(half, Math.max(0.2, end))
}
export function parseProject(json: string): Project {
  const raw: unknown = JSON.parse(json)
  if (
    !raw ||
    typeof raw !== 'object' ||
    !('version' in raw) ||
    raw.version !== 2 ||
    !('text' in raw) ||
    typeof raw.text !== 'string'
  ) {
    throw new Error('Choose a Chyron Studio project (.chyron.json).')
  }
  return normalizeProject(raw)
}
export const duration = (p: Project) => Math.round((p.animationDuration * 2 + p.hold) * 1000) / 1000
export const frameCount = (p: Project) => Math.max(2, Math.round(duration(p) * p.fps))
export const frameTime = (index: number, p: Project) => Math.min(duration(p), index / p.fps)
export const restTime = (p: Project) => p.animationDuration + p.hold / 2
export const fileStem = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^\p{L}\p{N}-]+/gu, '-')
    .replace(/^-|-$/g, '') || 'chyron'

export interface Template {
  id: string
  name: string
  caption: string
  background: string
  patch: Partial<Project>
}
export const TEMPLATES: Template[] = [
  {
    id: 'original',
    name: 'Play it bold',
    caption: 'The original, reimagined',
    background: '#202b40',
    patch: { ...DEFAULT_PROJECT },
  },
  {
    id: 'acid',
    name: 'Acid house',
    caption: 'A little extra energy',
    background: '#30331f',
    patch: {
      mode: 'tiles',
      font: 'Anton',
      tileColor: '#dcf383',
      textColor: '#253319',
      accent: '#dcf383',
      subtitleColor: '#253319',
      rotation: 0,
      radius: 7,
      depth: 5,
      motion: 'slide',
    },
  },
  {
    id: 'editorial',
    name: 'On the record',
    caption: 'Clean. Confident. Classic.',
    background: '#30302e',
    patch: {
      mode: 'typography',
      font: 'Anton',
      textColor: '#f2eadb',
      effect: 'extrude',
      effectColor: '#8c877e',
      accent: '#f2eadb',
      subtitleColor: '#282824',
      italic: false,
      depth: 0,
      motion: 'wipe',
    },
  },
  {
    id: 'pink',
    name: 'Sweet talk',
    caption: 'Made to stand out',
    background: '#422a3e',
    patch: {
      mode: 'tiles',
      font: 'Fredoka',
      tileColor: '#f7b8d7',
      textColor: '#651c48',
      accent: '#da538e',
      subtitleColor: '#ffffff',
      radius: 28,
      rotation: 6,
      depth: 7,
      motion: 'pop',
    },
  },
  {
    id: 'neon',
    name: 'After hours',
    caption: 'Keep the lights on',
    background: '#25213c',
    patch: {
      mode: 'typography',
      font: 'Bangers',
      textColor: '#ede7ff',
      effect: 'neon',
      effectColor: '#a98cff',
      effectColor2: '#6d50f1',
      accent: '#8162db',
      subtitleColor: '#ffffff',
      depth: 14,
      motion: 'fade',
      italic: false,
    },
  },
  {
    id: 'retro',
    name: 'Good company',
    caption: 'A familiar kind of fun',
    background: '#453028',
    patch: {
      mode: 'typography',
      font: 'Ranchers',
      textColor: '#ffe4b4',
      effect: 'retro',
      effectColor: '#e77e50',
      effectColor2: '#803d35',
      accent: '#e77e50',
      subtitleColor: '#342420',
      depth: 14,
      motion: 'slide',
      italic: false,
    },
  },
]
export function applyTemplate(project: Project, template: Template): Project {
  return normalizeProject({
    ...DEFAULT_PROJECT,
    ...template.patch,
    text: project.text,
    subtitle: project.subtitle,
    name: project.name,
    width: project.width,
    height: project.height,
    fps: project.fps,
    animationDuration: project.animationDuration,
    hold: project.hold,
    stagger: project.stagger,
    scale: project.scale,
    x: project.x,
    y: project.y,
    compositionRotation: project.compositionRotation,
    opacity: project.opacity,
    previewBackground: project.previewBackground,
    background: project.background,
    layers: project.layers,
  })
}

export function migrateLegacy(raw: Record<string, unknown>, typography = false): Project {
  const p = { ...DEFAULT_PROJECT, mode: typography ? 'typography' : 'tiles' } as Project
  const mapping: Record<string, keyof Project> = {
    text: 'text',
    subtitle: 'subtitle',
    subtitlePos: 'subtitlePosition',
    subtitleRadius: 'subtitleRadius',
    bannerGap: 'subtitleGap',
    tileColor: 'tileColor',
    textColor: 'textColor',
    subTileColor: 'accent',
    subTextColor: 'subtitleColor',
    chaosLevel: 'rotation',
    tileGap: 'gap',
    lineGap: 'lineGap',
    shadowOffset: 'depth',
    shadowChaos: 'shadowVariation',
    borderRadius: 'radius',
    tilePadding: 'padding',
    canvasBg: 'background',
    blackBgBlur: 'backdrop',
    scaleChaos: 'variation',
    posChaos: 'scatter',
    compositionShadow: 'glow',
    animationPreset: 'motion',
    animationDuration: 'animationDuration',
    fontFamily: 'font',
    effect: 'effect',
    effectColor1: 'effectColor',
    effectColor2: 'effectColor2',
    subtitleBg: 'accent',
    subtitleColor: 'subtitleColor',
    value1: 'depth',
    isFilled: 'filled',
    isItalic: 'italic',
  }
  for (const [from, to] of Object.entries(mapping))
    if (raw[from] !== undefined) Object.assign(p, { [to]: raw[from] })
  if (typeof raw.tileSize === 'number') p.tileSize = raw.tileSize * 64
  if (typeof raw.subtitleSize === 'number') p.subtitleSize = raw.subtitleSize * 16
  if (raw.subtitlePadding && typeof raw.subtitlePadding === 'object') {
    const pad = raw.subtitlePadding as { x: number; y: number }
    p.subtitlePaddingX = pad.x
    p.subtitlePaddingY = pad.y
  }
  if (raw.fontFamily === 'Fredoka One') p.font = 'Fredoka'
  return normalizeProject(p)
}
