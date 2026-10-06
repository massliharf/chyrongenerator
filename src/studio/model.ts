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
  'wave',
  'ripple',
] as const
export type HoldEffect = (typeof HOLD_EFFECTS)[number]
/** Effects that move letters one by one: chyrons and text only. */
export const LETTER_EFFECTS: HoldEffect[] = ['wave', 'ripple']
/** On-screen effects each layer kind offers. */
export const effectsFor = (kind: 'chyron' | 'image' | 'shape' | 'text'): HoldEffect[] =>
  HOLD_EFFECTS.filter((e) =>
    kind === 'chyron'
      ? e !== 'kenburns'
      : kind === 'image'
        ? !LETTER_EFFECTS.includes(e)
        : e !== 'kenburns' && !LETTER_EFFECTS.includes(e),
  )

/** Shape an image is cut to. 'none' keeps the rectangle (with its corner radius). */
export const IMAGE_MASKS = [
  'none',
  'circle',
  'arch',
  'triangle',
  'hexagon',
  'star',
  'heart',
] as const
export type ImageMask = (typeof IMAGE_MASKS)[number]

/** Shapes a shape layer can draw. They share their outlines with the image masks. */
export const SHAPE_KINDS = [
  'rect',
  'circle',
  'arch',
  'triangle',
  'hexagon',
  'star',
  'heart',
  'line',
] as const
export type ShapeKind = (typeof SHAPE_KINDS)[number]
export const GRADIENTS = ['none', 'linear', 'radial'] as const
export type Gradient = (typeof GRADIENTS)[number]

/** Visible part of the source image, as fractions of its width and height. */
export interface ImageCrop {
  x: number
  y: number
  w: number
  h: number
}

/** On-screen effect settings every layer kind shares. */
export interface Emphasis {
  emphasis: HoldEffect
  emphasisStrength: number
  /** Seconds per emphasis cycle. */
  emphasisSpeed: number
}
/** Timing every layer kind shares. */
interface LayerBase {
  id: string
  name: string
  visible: boolean
  /** Locked layers ignore clicks on the canvas; select them from the timeline. */
  locked?: boolean
  /** Seconds after the clip starts before the layer's intro begins. */
  delay: number
  /** Outro length in seconds. Unset: the outro mirrors the intro. */
  outDuration?: number
  /** Seconds before the clip ends that the outro finishes. Unset: same as `delay`. */
  endDelay?: number
}

export interface ChyronLayer extends LayerBase, Partial<Emphasis> {
  kind: 'chyron'
  /**
   * Lettering, colours, placement and motion of this chyron. The first chyron
   * (id 'chyron') keeps them on the project itself, as every earlier version
   * did, so `style` is only set on the chyrons added after it.
   */
  style?: ChyronStyle
  /** Intro length of an added chyron. Unset: the composition's transition length. */
  duration?: number
}
/** A box-shaped layer (image or shape): position, size and element motion. */
interface ElementBase extends LayerBase, Emphasis {
  /** Height ÷ width of the box. */
  aspect: number
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
  /** Intro length in seconds. */
  duration: number
  burstColor: string
}
export interface ImageLayer extends ElementBase {
  kind: 'image'
  assetId: string
  /** The picture before its background was removed. Restoring swaps it back. */
  originalAssetId?: string
  /** Natural height ÷ width of the source. Set once the image is cropped. */
  sourceAspect?: number
  crop?: ImageCrop
  mask: ImageMask
  /** Colour adjustments, 100 = unchanged. */
  brightness: number
  contrast: number
  saturation: number
}
export interface ShapeLayer extends ElementBase {
  kind: 'shape'
  shape: ShapeKind
  fill: string
  /** Second gradient colour. */
  fill2: string
  gradient: Gradient
  /** Linear gradient direction in degrees (0 = left to right). */
  gradientAngle: number
}
export const TEXT_ALIGNS = ['left', 'center', 'right'] as const
export type TextAlign = (typeof TEXT_ALIGNS)[number]
/**
 * Plain text in a box, as in the Designer: words wrap at the box's width and
 * the box grows with them. It moves, animates and stacks like an image or a
 * shape; chyrons keep their own lettering and styles.
 */
export interface TextLayer extends ElementBase {
  kind: 'text'
  text: string
  font: FontName
  /** Letter size as a percentage of the composition's width, so it follows a resize. */
  size: number
  color: string
  align: TextAlign
  /** Line spacing as a multiple of the letter size. */
  lineHeight: number
  /** Extra space between letters, in ems. */
  letterSpacing: number
  uppercase: boolean
}
export type ElementLayer = ImageLayer | ShapeLayer | TextLayer
export type Layer = ChyronLayer | ElementLayer
export type LayerKind = Layer['kind']
/** The first chyron. Its style lives on the project. */
export const PRIMARY_CHYRON = 'chyron'
export const CHYRON_LAYER: ChyronLayer = {
  id: PRIMARY_CHYRON,
  kind: 'chyron',
  name: 'Chyron',
  visible: true,
  delay: 0,
}
const DEFAULT_ELEMENT = {
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
  intro: 'pop' as ImageMotion,
  outro: 'mirror' as ImageMotion | 'mirror',
  easing: 'auto' as Easing,
  duration: 1,
  delay: 0,
  emphasis: 'none' as HoldEffect,
  emphasisStrength: 50,
  emphasisSpeed: 2,
  burstColor: '#ffffff',
}
export const DEFAULT_IMAGE_LAYER: Omit<ImageLayer, 'id' | 'assetId' | 'aspect' | 'name'> = {
  ...DEFAULT_ELEMENT,
  kind: 'image',
  mask: 'none',
  brightness: 100,
  contrast: 100,
  saturation: 100,
}
export const DEFAULT_TEXT_LAYER: Omit<TextLayer, 'id' | 'name'> = {
  ...DEFAULT_ELEMENT,
  kind: 'text',
  aspect: 0.2,
  width: 70,
  intro: 'fade',
  text: 'Add a heading',
  font: 'Inter',
  size: 7,
  color: '#ffffff',
  align: 'center',
  lineHeight: 1.15,
  letterSpacing: 0,
  uppercase: false,
}
export const DEFAULT_SHAPE_LAYER: Omit<ShapeLayer, 'id' | 'name'> = {
  ...DEFAULT_ELEMENT,
  kind: 'shape',
  shape: 'rect',
  aspect: 0.25,
  width: 70,
  y: 75,
  radius: 20,
  fill: '#3e75f3',
  fill2: '#9075fc',
  gradient: 'none',
  gradientAngle: 0,
  intro: 'wipe',
}

/** A music track under the whole composition. */
/** A part of the song placed in the clip. Cut music (split, trimmed, moved) is a list of these. */
export interface AudioSegment {
  id: string
  /** Clip seconds where the part starts. */
  at: number
  /** Song seconds it plays from. */
  from: number
  /** How long it plays, in seconds. */
  length: number
}
export const MAX_AUDIO_SEGMENTS = 32
export interface AudioTrack {
  assetId: string
  name: string
  /** Length of the source file in seconds. */
  length: number
  /** Loudness, 100 = as recorded. */
  volume: number
  /** Seconds into the song where playback begins. */
  trim: number
  /** Seconds into the clip before the music starts. */
  delay: number
  fadeIn: number
  /** Fade at the end of the clip (or of the song, when it ends first). */
  fadeOut: number
  /** Start the song again from `trim` when it runs out before the clip does. */
  loop: boolean
  muted: boolean
  /**
   * The music once it has been cut: its parts, in clip order. Unset, the song
   * plays from `trim` at `delay` (looping when `loop`), as before cutting.
   */
  segments?: AudioSegment[]
}
export const DEFAULT_AUDIO: Omit<AudioTrack, 'assetId' | 'name' | 'length'> = {
  volume: 100,
  trim: 0,
  delay: 0,
  fadeIn: 0,
  fadeOut: 1,
  loop: true,
  muted: false,
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
  /** Outro of the first chyron: 'mirror' plays the intro in reverse. */
  outro: Motion | 'mirror'
  animationDuration: number
  hold: number
  stagger: number
  previewBackground: 'live' | 'checker' | 'dark' | 'light' | 'color'
  background: string
  /** Bottom-to-top stack of chyrons, images and shapes. Any of them can be removed. */
  layers: Layer[]
  audio?: AudioTrack
}

/**
 * Everything that styles one chyron. The first chyron reads these from the
 * project; chyrons added after it carry their own copy in `layer.style`.
 */
export const CHYRON_STYLE_KEYS = [
  'mode',
  'text',
  'textCase',
  'tracking',
  'subtitle',
  'font',
  'tileColor',
  'textColor',
  'accent',
  'subtitleColor',
  'effectColor',
  'effectColor2',
  'effect',
  'filled',
  'italic',
  'tileSize',
  'gap',
  'lineGap',
  'padding',
  'radius',
  'depth',
  'rotation',
  'variation',
  'scatter',
  'shadowVariation',
  'glow',
  'backdrop',
  'subtitleSize',
  'subtitleGap',
  'subtitleRadius',
  'subtitlePaddingX',
  'subtitlePaddingY',
  'subtitlePosition',
  'subtitlePill',
  'align',
  'scale',
  'compositionRotation',
  'opacity',
  'x',
  'y',
  'motion',
  'outro',
  'stagger',
] as const satisfies readonly (keyof Project)[]
export type ChyronStyleKey = (typeof CHYRON_STYLE_KEYS)[number]
export type ChyronStyle = Pick<Project, ChyronStyleKey>
export const pickStyle = (p: ChyronStyle): ChyronStyle =>
  Object.fromEntries(CHYRON_STYLE_KEYS.map((k) => [k, p[k]])) as ChyronStyle

export const DEFAULT_PROJECT: Project = {
  version: 2,
  name: 'Untitled chyron',
  mode: 'tiles',
  text: 'Scott\nRogowsky',
  textCase: 'upper',
  tracking: 0,
  subtitle: 'PUZZLE PAPI',
  // The look of Play it bold, the starting template.
  font: 'Wicked Mouse',
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
  outro: 'mirror',
  animationDuration: 1,
  hold: 2.4,
  stagger: 0.45,
  previewBackground: 'live',
  background: '#14243d',
  layers: [CHYRON_LAYER],
}

/** Longest hold, in seconds. */
export const MAX_HOLD = 60
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
  hold: [0, MAX_HOLD],
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
  outro: ['mirror', ...MOTIONS],
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
/** Validated copy of every scalar project field in `record`, defaults for the rest. */
function normalizeFields(record: Record<string, unknown>): Project {
  const output = { ...DEFAULT_PROJECT }
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
  return output
}
export function normalizeProject(value: unknown): Project {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { ...DEFAULT_PROJECT }
  const record = { ...value } as Record<string, unknown>
  // Earlier v2 projects stored separate intro/outro lengths. Keep their intro timing
  // as the shared duration while retaining their artwork and canvas dimensions.
  if (record.animationDuration === undefined) {
    record.animationDuration = [record.entrance, record.exit].find(
      (v) => typeof v === 'number' && Number.isFinite(v),
    )
  }
  const output = normalizeFields(record)
  output.width = Math.round(output.width / 2) * 2
  output.height = Math.round(output.height / 2) * 2
  output.layers = normalizeLayers(record.layers)
  const audio = normalizeAudio(record.audio)
  if (audio) output.audio = audio
  else delete output.audio
  return output
}
/** A full, valid chyron style from untrusted input. */
export const normalizeChyronStyle = (raw: unknown): ChyronStyle =>
  pickStyle(normalizeFields(raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}))

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
const assetIdPattern = /^[\w-]{1,80}$/

export const MAX_IMAGE_LAYERS = 12
export const MAX_CHYRONS = 8
export const MAX_SHAPES = 16
export const MAX_TEXTS = 16
/** Seconds a layer may wait before its intro (or after its outro). */
const MAX_OFFSET = MAX_HOLD + 8

/** Position, size, frame and element motion shared by images and shapes. */
function normalizeElement(
  raw: Record<string, unknown>,
  d: typeof DEFAULT_ELEMENT & { aspect?: number },
): Omit<ElementBase, 'name'> {
  return {
    id: (raw.id as string).slice(0, 80),
    visible: typeof raw.visible === 'boolean' ? raw.visible : true,
    ...(raw.locked === true ? { locked: true } : {}),
    aspect: num(raw.aspect, d.aspect ?? 1, 0.01, 100),
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
    outro: raw.outro === 'mirror' ? 'mirror' : pick(raw.outro, IMAGE_MOTIONS, 'mirror' as never),
    easing: pick(raw.easing, EASINGS, d.easing),
    duration: num(raw.duration, d.duration, 0.2, 4),
    delay: num(raw.delay, d.delay, 0, MAX_OFFSET),
    ...optionalTiming(raw),
    emphasis: pick(raw.emphasis, HOLD_EFFECTS, d.emphasis),
    emphasisStrength: num(raw.emphasisStrength, d.emphasisStrength, 0, 100),
    emphasisSpeed: num(raw.emphasisSpeed, d.emphasisSpeed, 0.5, 8),
    burstColor: hex(raw.burstColor, d.burstColor),
  }
}
export function normalizeImageLayer(raw: Record<string, unknown>): ImageLayer | null {
  if (typeof raw.id !== 'string' || !raw.id || raw.id === PRIMARY_CHYRON) return null
  if (typeof raw.assetId !== 'string' || !assetIdPattern.test(raw.assetId)) return null
  const d = DEFAULT_IMAGE_LAYER
  const { id, visible, locked, ...element } = normalizeElement(raw, d)
  return {
    id,
    kind: 'image',
    name: text(raw.name, 'Image'),
    assetId: raw.assetId,
    ...(typeof raw.originalAssetId === 'string' && assetIdPattern.test(raw.originalAssetId)
      ? { originalAssetId: raw.originalAssetId }
      : {}),
    ...cropFields(raw),
    mask: pick(raw.mask, IMAGE_MASKS, d.mask),
    brightness: num(raw.brightness, 100, 0, 200),
    contrast: num(raw.contrast, 100, 0, 200),
    saturation: num(raw.saturation, 100, 0, 300),
    visible,
    ...(locked ? { locked } : {}),
    ...element,
  }
}
export function normalizeShapeLayer(raw: Record<string, unknown>): ShapeLayer | null {
  if (typeof raw.id !== 'string' || !raw.id || raw.id === PRIMARY_CHYRON) return null
  const d = DEFAULT_SHAPE_LAYER
  return {
    ...normalizeElement(raw, d),
    kind: 'shape',
    name: text(raw.name, 'Shape'),
    shape: pick(raw.shape, SHAPE_KINDS, d.shape),
    fill: hex(raw.fill, d.fill),
    fill2: hex(raw.fill2, d.fill2),
    gradient: pick(raw.gradient, GRADIENTS, d.gradient),
    gradientAngle: num(raw.gradientAngle, d.gradientAngle, -180, 180),
  }
}
export function normalizeTextLayer(raw: Record<string, unknown>): TextLayer | null {
  if (typeof raw.id !== 'string' || !raw.id || raw.id === PRIMARY_CHYRON) return null
  const d = DEFAULT_TEXT_LAYER
  return {
    ...normalizeElement(raw, d),
    kind: 'text',
    name: text(raw.name, 'Text'),
    text: typeof raw.text === 'string' ? raw.text.slice(0, 2000) : d.text,
    font: pick(raw.font, FONT_NAMES, d.font),
    size: num(raw.size, d.size, 0.5, 60),
    color: hex(raw.color, d.color),
    align: pick(raw.align, TEXT_ALIGNS, d.align),
    lineHeight: num(raw.lineHeight, d.lineHeight, 0.6, 3),
    letterSpacing: num(raw.letterSpacing, d.letterSpacing, -0.2, 1),
    uppercase: raw.uppercase === true,
  }
}
function cropFields(raw: Record<string, unknown>) {
  const c = raw.crop as Record<string, unknown> | undefined
  if (!c || typeof c !== 'object' || typeof raw.sourceAspect !== 'number') return {}
  const w = num(c.w, 1, 0.01, 1),
    h = num(c.h, 1, 0.01, 1)
  return {
    sourceAspect: num(raw.sourceAspect, 1, 0.01, 100),
    crop: { x: num(c.x, 0, 0, 1 - w), y: num(c.y, 0, 0, 1 - h), w, h },
  }
}
function optionalTiming(raw: Record<string, unknown>) {
  const out: { outDuration?: number; endDelay?: number } = {}
  if (typeof raw.outDuration === 'number') out.outDuration = num(raw.outDuration, 1, 0.05, 30)
  if (typeof raw.endDelay === 'number') out.endDelay = num(raw.endDelay, 0, 0, MAX_OFFSET)
  return out
}
/** Chyron emphasis is optional so layers without one stay exactly as before. */
function chyronEmphasis(raw: Record<string, unknown>): Partial<Emphasis> {
  const emphasis = pick(raw.emphasis, HOLD_EFFECTS, 'none')
  if (emphasis === 'none') return {}
  return {
    emphasis,
    emphasisStrength: num(raw.emphasisStrength, DEFAULT_ELEMENT.emphasisStrength, 0, 100),
    emphasisSpeed: num(raw.emphasisSpeed, DEFAULT_ELEMENT.emphasisSpeed, 0.5, 8),
  }
}
function normalizeChyronLayer(raw: Record<string, unknown>, primary: boolean): ChyronLayer {
  const layer: ChyronLayer = {
    ...CHYRON_LAYER,
    id: primary ? PRIMARY_CHYRON : (raw.id as string).slice(0, 80),
    name: text(raw.name, CHYRON_LAYER.name),
    visible: typeof raw.visible === 'boolean' ? raw.visible : true,
    ...(raw.locked === true ? { locked: true } : {}),
    delay: num(raw.delay, 0, 0, MAX_OFFSET),
    ...optionalTiming(raw),
    ...chyronEmphasis(raw),
  }
  if (!primary) {
    layer.style = normalizeChyronStyle(raw.style)
    if (typeof raw.duration === 'number') layer.duration = num(raw.duration, 1, 0.2, 4)
  }
  return layer
}
export function normalizeLayers(value: unknown): Layer[] {
  // Projects from before layers existed were one chyron.
  if (!Array.isArray(value)) return [{ ...CHYRON_LAYER }]
  const layers: Layer[] = []
  const ids = new Set<string>()
  const count = { image: 0, shape: 0, text: 0, chyron: 0 }
  let primary: ChyronLayer | null = null
  for (const entry of value) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue
    const raw = entry as Record<string, unknown>
    if (raw.kind === 'chyron') {
      // Added chyrons carry their own style; a chyron without one is the first chyron.
      const added =
        raw.style && typeof raw.style === 'object' && typeof raw.id === 'string' && raw.id
      if (added && raw.id !== PRIMARY_CHYRON) {
        if (ids.has(raw.id as string) || count.chyron >= MAX_CHYRONS - 1) continue
        const layer = normalizeChyronLayer(raw, false)
        ids.add(layer.id)
        count.chyron++
        layers.push(layer)
      } else if (!primary) {
        primary = normalizeChyronLayer(raw, true)
        layers.push(primary)
      }
    } else if (raw.kind === 'image' || raw.kind === 'shape' || raw.kind === 'text') {
      const layer =
        raw.kind === 'image'
          ? normalizeImageLayer(raw)
          : raw.kind === 'shape'
            ? normalizeShapeLayer(raw)
            : normalizeTextLayer(raw)
      const max =
        raw.kind === 'image' ? MAX_IMAGE_LAYERS : raw.kind === 'shape' ? MAX_SHAPES : MAX_TEXTS
      if (!layer || ids.has(layer.id) || count[layer.kind] >= max) continue
      ids.add(layer.id)
      count[layer.kind]++
      layers.push(layer)
    }
  }
  return layers
}
export function normalizeAudio(raw: unknown): AudioTrack | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const r = raw as Record<string, unknown>
  if (typeof r.assetId !== 'string' || !assetIdPattern.test(r.assetId)) return null
  const length = num(r.length, 0, 0, 24 * 3600)
  if (!length) return null
  const d = DEFAULT_AUDIO
  return {
    assetId: r.assetId,
    name: text(r.name, 'Music'),
    length,
    volume: num(r.volume, d.volume, 0, 200),
    trim: num(r.trim, d.trim, 0, Math.max(0, length - 0.1)),
    delay: num(r.delay, d.delay, 0, MAX_OFFSET),
    fadeIn: num(r.fadeIn, d.fadeIn, 0, 10),
    fadeOut: num(r.fadeOut, d.fadeOut, 0, 10),
    loop: typeof r.loop === 'boolean' ? r.loop : d.loop,
    muted: typeof r.muted === 'boolean' ? r.muted : d.muted,
    ...normalizeSegments(r.segments, length),
  }
}
function normalizeSegments(raw: unknown, length: number): { segments?: AudioSegment[] } {
  if (!Array.isArray(raw)) return {}
  const segments: AudioSegment[] = []
  let end = 0
  const at = (v: unknown) =>
    v && typeof v === 'object' ? Number((v as { at?: unknown }).at) || 0 : 0
  for (const item of [...raw].sort((a, b) => at(a) - at(b)).slice(0, MAX_AUDIO_SEGMENTS)) {
    if (!item || typeof item !== 'object') continue
    const s = item as Record<string, unknown>
    if (typeof s.id !== 'string' || !s.id) continue
    const from = num(s.from, 0, 0, Math.max(0, length - 0.05))
    const seg = {
      id: s.id.slice(0, 64),
      // Parts never overlap: each starts where the one before it ends, at the earliest.
      at: Math.max(end, num(s.at, 0, 0, MAX_OFFSET)),
      from,
      length: num(s.length, 0.05, 0.05, Math.max(0.05, length - from)),
    }
    segments.push(seg)
    end = seg.at + seg.length
  }
  return segments.length ? { segments } : {}
}

/** The first chyron, whose style lives on the project (a default one when there is none). */
export const chyronLayer = (p: Pick<Project, 'layers'>): ChyronLayer =>
  (p.layers?.find((l) => l.id === PRIMARY_CHYRON && l.kind === 'chyron') as
    ChyronLayer | undefined) ??
  (p.layers?.find((l) => l.kind === 'chyron') as ChyronLayer | undefined) ??
  CHYRON_LAYER
export const chyronLayers = (p: Pick<Project, 'layers'>) =>
  (p.layers ?? []).filter((l): l is ChyronLayer => l.kind === 'chyron')
export const imageLayers = (p: Pick<Project, 'layers'>) =>
  (p.layers ?? []).filter((l): l is ImageLayer => l.kind === 'image')
export const shapeLayers = (p: Pick<Project, 'layers'>) =>
  (p.layers ?? []).filter((l): l is ShapeLayer => l.kind === 'shape')
export const textLayers = (p: Pick<Project, 'layers'>) =>
  (p.layers ?? []).filter((l): l is TextLayer => l.kind === 'text')
export const isElement = (l: Layer): l is ElementLayer =>
  l.kind === 'image' || l.kind === 'shape' || l.kind === 'text'
/** A chyron's style, wherever it is stored. */
export const styleOf = (p: Project, l: ChyronLayer): ChyronStyle => l.style ?? p
/**
 * The project as one chyron sees it: its own style over the composition, and
 * itself as the only layer, so the scene, pose and timing helpers read it.
 */
export const chyronProject = (p: Project, l: ChyronLayer): Project =>
  l.style ? { ...p, ...l.style, layers: [l] } : { ...p, layers: [l] }
const chyronHasText = (s: ChyronStyle) => !!s.text.trim() || (s.subtitlePill && !!s.subtitle.trim())
/** True when the export would contain visible artwork. */
export const hasArtwork = (p: Project) =>
  p.layers.some((l) =>
    !l.visible ? false : l.kind === 'chyron' ? chyronHasText(styleOf(p, l)) : l.opacity > 0,
  )
export interface LayerTiming {
  total: number
  /** Seconds before the intro starts. */
  delay: number
  /** Intro length. */
  length: number
  /** Time the layer spends settled between intro and outro. */
  hold: number
  /** Outro length. */
  outLength: number
  /** Seconds between the end of the outro and the end of the clip. */
  endDelay: number
  introEnd: number
  outroStart: number
}
/**
 * Where a layer sits in the clip: [delay][in][hold][out][endDelay] = total.
 * Layers without their own outro settings stay symmetric, exactly as before.
 */
export function layerTiming(l: Layer, p: Project): LayerTiming {
  const total = duration(p)
  const half = total / 2
  // The first chyron's intro is the composition's transition; it always fits.
  const transition = l.kind === 'chyron' && l.duration === undefined
  const inLen = l.kind === 'chyron' ? (l.duration ?? p.animationDuration) : l.duration
  let delay: number, length: number, outLength: number, endDelay: number
  if (l.outDuration === undefined && l.endDelay === undefined) {
    if (transition) {
      delay = Math.min(l.delay, Math.max(0, half - inLen))
      length = inLen
    } else {
      delay = Math.min(l.delay, Math.max(0, half - 0.2))
      length = Math.max(0.05, Math.min(inLen, half - delay))
    }
    outLength = length
    endDelay = delay
  } else {
    delay = Math.min(l.delay, Math.max(0, total - 0.2))
    length = Math.max(0.05, Math.min(inLen, total - delay - 0.1))
    const rest = total - delay - length
    endDelay = Math.min(l.endDelay ?? l.delay, Math.max(0, rest - 0.05))
    outLength = Math.max(0.05, Math.min(l.outDuration ?? inLen, rest - endDelay))
  }
  const introEnd = delay + length
  const outroStart = Math.max(introEnd, total - endDelay - outLength)
  return {
    total,
    delay,
    length,
    hold: Math.max(0, outroStart - introEnd),
    outLength,
    endDelay,
    introEnd,
    outroStart,
  }
}
/** True when a layer never animates in or out. */
export function isStill(l: Layer, p: Project) {
  if (l.kind !== 'chyron') return l.intro === 'none' && (l.outro === 'mirror' || l.outro === 'none')
  const s = styleOf(p, l)
  return s.motion === 'none' && (s.outro === 'mirror' || s.outro === 'none')
}
/** Longest intro or outro among visible layers, in seconds, bounded by half the clip. */
export function introLength(p: Project) {
  const half = duration(p) / 2
  let end = 0
  for (const l of p.layers)
    if (l.visible && !isStill(l, p)) {
      const t = layerTiming(l, p)
      end = Math.max(end, t.introEnd, t.endDelay + t.outLength)
    }
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
    throw new Error('Choose a Chyron Studio project (.savvy).')
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
      font: 'Wicked Mouse',
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
/** Restyle a chyron with a template, keeping its words and placement. */
export function applyTemplateToStyle(style: ChyronStyle, template: Template): ChyronStyle {
  return normalizeChyronStyle({
    ...pickStyle(DEFAULT_PROJECT),
    ...template.patch,
    text: style.text,
    subtitle: style.subtitle,
    stagger: style.stagger,
    scale: style.scale,
    x: style.x,
    y: style.y,
    compositionRotation: style.compositionRotation,
    opacity: style.opacity,
  })
}
export function applyTemplate(project: Project, template: Template): Project {
  return normalizeProject({
    ...DEFAULT_PROJECT,
    ...template.patch,
    ...applyTemplateToStyle(project, template),
    name: project.name,
    width: project.width,
    height: project.height,
    fps: project.fps,
    animationDuration: project.animationDuration,
    hold: project.hold,
    previewBackground: project.previewBackground,
    background: project.background,
    layers: project.layers,
    audio: project.audio,
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
