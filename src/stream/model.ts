export const FORMATS = [
  {
    id: 'hero',
    name: 'Hero image',
    width: 900,
    height: 1200,
    ratio: '3:4',
    caption: 'Your show, front and center',
  },
  {
    id: 'host',
    name: 'Host card',
    width: 1024,
    height: 1024,
    ratio: '1:1',
    caption: 'A little more personality',
  },
  {
    id: 'stream',
    name: 'Stream image',
    width: 1200,
    height: 1200,
    ratio: '1:1',
    caption: 'Ready for the live lineup',
  },
] as const
export type FormatId = (typeof FORMATS)[number]['id']
export type Format = (typeof FORMATS)[number]

export const BACKGROUNDS = [
  { id: 'grid', name: 'Blue grid', file: 'grid-blue.png' },
  { id: 'savvy', name: 'Savvy', file: 'savvy-blue.png' },
  { id: 'super', name: 'Super Savvy', file: 'super-savvy.png' },
] as const
export const COLOR_STYLES = [
  { name: 'Electric blue', color: '#126BEE', color2: '#47DFFF' },
  { name: 'Lilac', color: '#7738D9', color2: '#F7BBFF' },
  { name: 'Coral', color: '#DC345A', color2: '#FFCA91' },
  { name: 'Mint', color: '#047B71', color2: '#8EF3C0' },
  { name: 'Gold', color: '#A45300', color2: '#FFE478' },
]
export interface Bounds {
  x: number
  y: number
  width: number
  height: number
}
export interface ImageAsset {
  id: string
  name: string
  blob: Blob
  width: number
  height: number
  bounds: Bounds
}
export interface Layout {
  background: string
  color: string
  color2: string
  backgroundX: number
  backgroundY: number
  backgroundZoom: number
  x: number
  y: number
  zoom: number
  rotation: number
  flip: boolean
  shadow: number
  fade: number
}
export interface StreamDocument {
  version: 1
  name: string
  layouts: Record<FormatId, Layout>
  host: ImageAsset | null
  backgrounds: ImageAsset[]
}
export const DEFAULT_FRAMING = {
  x: 50,
  y: 54,
  zoom: 100,
  rotation: 0,
  flip: false,
}
export function defaultLayout(id: FormatId): Layout {
  return {
    ...DEFAULT_FRAMING,
    shadow: 0,
    fade: 0,
    background: id === 'hero' ? 'grid' : id === 'host' ? 'gradient' : 'savvy',
    color: '#126BEE',
    color2: '#47DFFF',
    backgroundX: 50,
    backgroundY: 50,
    backgroundZoom: 100,
  }
}
export function newStreamDocument(): StreamDocument {
  return {
    version: 1,
    name: 'Untitled stream set',
    host: null,
    backgrounds: [],
    layouts: {
      hero: defaultLayout('hero'),
      host: defaultLayout('host'),
      stream: defaultLayout('stream'),
    },
  }
}
export const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value))
export function hostRect(format: Format, layout: Layout, bounds: Bounds): Bounds {
  // Fit the visible cutout, excluding transparent margins; preserve its proportions.
  const scale =
    (Math.min((format.width * 0.9) / bounds.width, (format.height * 0.92) / bounds.height) *
      layout.zoom) /
    100
  return {
    x: (format.width * layout.x) / 100,
    y: (format.height * layout.y) / 100,
    width: bounds.width * scale,
    height: bounds.height * scale,
  }
}
export function coverRect(width: number, height: number, format: Format, layout: Layout): Bounds {
  const scale =
    (Math.max(format.width / width, format.height / height) * layout.backgroundZoom) / 100
  const w = width * scale,
    h = height * scale
  return {
    x: ((format.width - w) * layout.backgroundX) / 100,
    y: ((format.height - h) * layout.backgroundY) / 100,
    width: w,
    height: h,
  }
}
export function assetUrl(file: string) {
  return `${import.meta.env.BASE_URL}assets/stream/${file}`
}
