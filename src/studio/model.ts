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
export type Motion = 'pop' | 'flip' | 'slide' | 'wipe' | 'typewriter' | 'fade' | 'none'
export type Effect = 'extrude' | 'skew' | 'offset' | 'outline' | 'retro' | 'glow' | 'neon'
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
  background: '#202126',
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
  motion: ['pop', 'flip', 'slide', 'wipe', 'typewriter', 'fade', 'none'],
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
    if (input === undefined || key === 'version') continue
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
  return output
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
