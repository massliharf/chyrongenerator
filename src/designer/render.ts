import { useEffect, useState } from 'react'
import '@fontsource/geist-sans/800.css'
import '@fontsource/geist-sans/900.css'
import '@fontsource/inter/400.css'
import '@fontsource/inter/700.css'
import '@fontsource/inter/900.css'
import '@fontsource/anton/400.css'
import '@fontsource/bangers/400.css'
import '@fontsource/chewy/400.css'
import '@fontsource/fredoka/400.css'
import '@fontsource/fredoka/700.css'
import '@fontsource/nunito/400.css'
import '@fontsource/nunito/800.css'
import '@fontsource/oswald/400.css'
import '@fontsource/oswald/700.css'
import '@fontsource/permanent-marker/400.css'
import '@fontsource/ranchers/400.css'
import {
  isShape,
  type DesignDoc,
  type ImageLayer,
  type Layer,
  type ShapeLayer,
  type TextLayer,
} from './model'
import { shapePath } from './shapes'

/* ---------- Image cache ---------- */

const images = new Map<string, HTMLImageElement>()
const listeners = new Set<() => void>()

function ensureImage(id: string, src: string) {
  const cached = images.get(id)
  if (cached && cached.src === src) return
  const img = new Image()
  img.decoding = 'async'
  img.onload = () => listeners.forEach((fn) => fn())
  img.src = src
  images.set(id, img)
}

export function getImage(id: string): HTMLImageElement | null {
  const img = images.get(id)
  return img && img.complete && img.naturalWidth ? img : null
}

/** Waits for the pictures the document's layers show (before an export). */
export async function loadAssets(doc: DesignDoc) {
  const ids = new Set(doc.layers.flatMap((l) => (l.kind === 'image' ? [l.asset] : [])))
  await Promise.all(
    [...ids].map((id) => {
      const src = doc.assets[id]
      if (!src) return
      ensureImage(id, src)
      const img = images.get(id)!
      return img.complete && img.naturalWidth ? undefined : img.decode().catch(() => {})
    }),
  )
}

/** Loads every asset of the document; returns a counter that changes as they arrive. */
export function useAssetImages(doc: DesignDoc) {
  const [version, setVersion] = useState(0)
  useEffect(() => {
    const bump = () => setVersion((v) => v + 1)
    listeners.add(bump)
    return () => {
      listeners.delete(bump)
    }
  }, [])
  useEffect(() => {
    for (const [id, src] of Object.entries(doc.assets)) ensureImage(id, src)
  }, [doc.assets])
  return version
}

/* ---------- Fonts ---------- */

export function fontString(l: Pick<TextLayer, 'italic' | 'weight' | 'size' | 'font'>) {
  return `${l.italic ? 'italic ' : ''}${l.weight} ${l.size}px "${l.font}", "Geist Sans", sans-serif`
}

const fontWaiters = new Map<string, Promise<unknown>>()
/** Resolves once a font is usable on canvas; rerender after it settles. */
export function loadFont(l: TextLayer) {
  const key = fontString({ ...l, size: 32 })
  if (!fontWaiters.has(key))
    fontWaiters.set(key, document.fonts?.load(key).catch(() => []) ?? Promise.resolve())
  return fontWaiters.get(key)!
}

/* ---------- Text layout ---------- */

let measureCtx: CanvasRenderingContext2D | null = null
function measurer() {
  if (!measureCtx) measureCtx = document.createElement('canvas').getContext('2d')!
  return measureCtx
}

function applyFont(ctx: CanvasRenderingContext2D, l: TextLayer) {
  ctx.font = fontString(l)
  if ('letterSpacing' in ctx)
    (ctx as { letterSpacing: string }).letterSpacing = `${l.letterSpacing}px`
}

export function layoutText(l: TextLayer, width = l.w): string[] {
  const ctx = measurer()
  applyFont(ctx, l)
  const text = l.uppercase ? l.text.toUpperCase() : l.text
  const lines: string[] = []
  for (const para of text.split('\n')) {
    const words = para.split(/(\s+)/)
    let line = ''
    for (const word of words) {
      const candidate = line + word
      if (line && ctx.measureText(candidate.trimEnd()).width > width) {
        lines.push(line.trimEnd())
        line = word.trimStart()
        // A single word longer than the box breaks by character.
        while (ctx.measureText(line).width > width && line.length > 1) {
          let i = line.length - 1
          while (i > 1 && ctx.measureText(line.slice(0, i)).width > width) i--
          lines.push(line.slice(0, i))
          line = line.slice(i)
        }
      } else line = candidate
    }
    lines.push(line.trimEnd())
  }
  return lines
}

/** Height a text box needs for its content at its width. */
export function textHeight(l: TextLayer, width = l.w) {
  return Math.max(1, Math.ceil(layoutText(l, width).length * l.size * l.lineHeight))
}

/** Width of the longest line when the text does not wrap. */
export function textNaturalWidth(l: TextLayer) {
  const ctx = measurer()
  applyFont(ctx, l)
  const text = l.uppercase ? l.text.toUpperCase() : l.text
  return Math.ceil(Math.max(1, ...text.split('\n').map((t) => ctx.measureText(t).width)) + 2)
}

/* ---------- Paths ---------- */

export function roundedRectPath(
  ctx: CanvasRenderingContext2D | Path2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2))
  ctx.moveTo(x + rr, y)
  ctx.lineTo(x + w - rr, y)
  ctx.arcTo(x + w, y, x + w, y + rr, rr)
  ctx.lineTo(x + w, y + h - rr)
  ctx.arcTo(x + w, y + h, x + w - rr, y + h, rr)
  ctx.lineTo(x + rr, y + h)
  ctx.arcTo(x, y + h, x, y + h - rr, rr)
  ctx.lineTo(x, y + rr)
  ctx.arcTo(x, y, x + rr, y, rr)
  ctx.closePath()
}

/* ---------- Layer content (local frame 0..w, 0..h) ---------- */

function filterString(l: ImageLayer, pixelScale: number) {
  const f = l.filters
  const parts: string[] = []
  if (f.brightness !== 100) parts.push(`brightness(${f.brightness}%)`)
  if (f.contrast !== 100) parts.push(`contrast(${f.contrast}%)`)
  if (f.saturation !== 100) parts.push(`saturate(${f.saturation}%)`)
  if (f.grayscale) parts.push(`grayscale(${f.grayscale}%)`)
  if (f.hue) parts.push(`hue-rotate(${f.hue}deg)`)
  if (f.blur) parts.push(`blur(${f.blur * pixelScale}px)`)
  return parts.join(' ') || 'none'
}

function drawImageContent(
  ctx: CanvasRenderingContext2D,
  l: ImageLayer,
  pixelScale: number,
  extra = '',
) {
  const img = getImage(l.asset)
  ctx.save()
  if (l.radius > 0) {
    ctx.beginPath()
    roundedRectPath(ctx, 0, 0, l.w, l.h, l.radius)
    ctx.clip()
  }
  if (img) {
    const own = filterString(l, pixelScale)
    const filter = [extra, own === 'none' ? '' : own].filter(Boolean).join(' ') || 'none'
    const sw = Math.ceil(l.w * pixelScale),
      sh = Math.ceil(l.h * pixelScale)
    if (l.fade && fadeScratch && sw > 0 && sh > 0 && sw * sh < 64e6) {
      // Fade the bottom: draw the picture alone, then keep it under a gradient.
      fadeScratch.width = sw
      fadeScratch.height = sh
      const f = fadeScratch.getContext('2d')!
      f.setTransform(pixelScale, 0, 0, pixelScale, 0, 0)
      f.filter = filter
      f.drawImage(img, l.crop.x, l.crop.y, l.crop.w, l.crop.h, 0, 0, l.w, l.h)
      f.filter = 'none'
      f.globalCompositeOperation = 'destination-in'
      const g = f.createLinearGradient(
        0,
        l.h * l.fade.from,
        0,
        l.h * Math.max(l.fade.to, l.fade.from + 0.001),
      )
      g.addColorStop(0, '#000')
      g.addColorStop(1, '#0000')
      f.fillStyle = g
      f.fillRect(0, 0, l.w, l.h)
      ctx.drawImage(fadeScratch, 0, 0, l.w, l.h)
    } else {
      ctx.filter = filter
      ctx.drawImage(img, l.crop.x, l.crop.y, l.crop.w, l.crop.h, 0, 0, l.w, l.h)
      ctx.filter = 'none'
    }
  } else {
    ctx.fillStyle = 'rgba(128,128,128,0.25)'
    ctx.fillRect(0, 0, l.w, l.h)
  }
  ctx.restore()
  if (l.strokeWidth > 0) {
    const s = l.strokeWidth
    ctx.beginPath()
    roundedRectPath(ctx, s / 2, s / 2, l.w - s, l.h - s, Math.max(0, l.radius - s / 2))
    ctx.lineWidth = s
    ctx.strokeStyle = l.stroke
    ctx.stroke()
  }
}

export function shapeD(l: ShapeLayer, inset = 0) {
  return shapePath(l.kind, inset, inset, l.w - inset * 2, l.h - inset * 2, {
    radius: Math.max(0, l.radius - inset),
    sides: l.sides,
    points: l.points,
    inner: l.inner,
  })
}

function drawShapeContent(ctx: CanvasRenderingContext2D, l: ShapeLayer) {
  const s = Math.min(l.strokeWidth, l.w / 2, l.h / 2)
  if (l.fillEnabled) {
    const g = l.gradient
    if (g) {
      const fill = ctx.createLinearGradient(g.x0 * l.w, g.y0 * l.h, g.x1 * l.w, g.y1 * l.h)
      for (const stop of g.stops) fill.addColorStop(stop.at, stop.color)
      ctx.fillStyle = fill
    } else ctx.fillStyle = l.fill
    ctx.fill(new Path2D(shapeD(l)))
  }
  if (s > 0) {
    ctx.lineWidth = s
    ctx.lineJoin = 'round'
    ctx.strokeStyle = l.stroke
    ctx.stroke(new Path2D(shapeD(l, s / 2)))
  }
}

/** Point-in-shape for a point in the layer's local (unrotated) frame. */
export function hitShape(l: ShapeLayer, x: number, y: number) {
  const ctx = measurer()
  const px = l.flipX ? l.w - x : x,
    py = l.flipY ? l.h - y : y
  return ctx.isPointInPath(new Path2D(shapeD(l)), px, py)
}

/** Empty image frame while editing: hatched shape with a picture glyph. */
function drawFramePlaceholder(ctx: CanvasRenderingContext2D, l: ShapeLayer, pixelScale: number) {
  ctx.save()
  enterLocal(ctx, l)
  const path = new Path2D(shapeD(l))
  ctx.fillStyle = 'rgba(133, 102, 220, 0.12)'
  ctx.fill(path)
  ctx.save()
  ctx.clip(path)
  ctx.strokeStyle = 'rgba(133, 102, 220, 0.18)'
  ctx.lineWidth = 1.5 / pixelScale
  const step = 14 / pixelScale
  ctx.beginPath()
  for (let d = -l.h; d < l.w; d += step) {
    ctx.moveTo(d, 0)
    ctx.lineTo(d + l.h, l.h)
  }
  ctx.stroke()
  ctx.restore()
  ctx.setLineDash([6 / pixelScale, 4 / pixelScale])
  ctx.lineWidth = 1.5 / pixelScale
  ctx.strokeStyle = 'rgba(133, 102, 220, 0.7)'
  ctx.stroke(path)
  // Picture glyph
  const g = Math.min(l.w, l.h) * 0.22
  const gx = l.w / 2 - g / 2,
    gy = l.h / 2 - g * 0.4
  ctx.setLineDash([])
  ctx.lineWidth = Math.max(1 / pixelScale, g * 0.07)
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  ctx.strokeStyle = 'rgba(133, 102, 220, 0.75)'
  ctx.beginPath()
  roundedRectPath(ctx, gx, gy, g, g * 0.8, g * 0.12)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(gx + g * 0.12, gy + g * 0.68)
  ctx.lineTo(gx + g * 0.4, gy + g * 0.38)
  ctx.lineTo(gx + g * 0.62, gy + g * 0.58)
  ctx.lineTo(gx + g * 0.74, gy + g * 0.47)
  ctx.lineTo(gx + g * 0.88, gy + g * 0.68)
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(gx + g * 0.7, gy + g * 0.24, g * 0.08, 0, Math.PI * 2)
  ctx.stroke()
  ctx.restore()
}

function drawTextContent(ctx: CanvasRenderingContext2D, l: TextLayer) {
  const lines = layoutText(l)
  applyFont(ctx, l)
  ctx.fillStyle = l.color
  ctx.textBaseline = 'middle'
  ctx.textAlign = l.align
  const lh = l.size * l.lineHeight
  // letterSpacing adds trailing space after the last glyph; nudge to stay centred.
  const trail =
    l.align === 'center' ? l.letterSpacing / 2 : l.align === 'right' ? l.letterSpacing : 0
  const x = (l.align === 'left' ? 0 : l.align === 'center' ? l.w / 2 : l.w) + trail
  lines.forEach((line, i) => ctx.fillText(line, x, i * lh + lh / 2))
}

function drawContent(ctx: CanvasRenderingContext2D, l: Layer, pixelScale: number, extra = '') {
  if (l.kind === 'image') drawImageContent(ctx, l, pixelScale, extra)
  else if (l.kind === 'text') drawTextContent(ctx, l)
  else drawShapeContent(ctx, l)
}

/* ---------- Layers ---------- */

function enterLocal(ctx: CanvasRenderingContext2D, l: Layer) {
  ctx.translate(l.x + l.w / 2, l.y + l.h / 2)
  if (l.rotation) ctx.rotate((l.rotation * Math.PI) / 180)
  ctx.scale(l.flipX ? -1 : 1, l.flipY ? -1 : 1)
  ctx.translate(-l.w / 2, -l.h / 2)
}

function hexToRgba(hex: string, alpha: number) {
  const h = hex.replace('#', '')
  const n = parseInt(h.length === 3 ? [...h].map((c) => c + c).join('') : h, 16)
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`
}

const shadowScratch = typeof document !== 'undefined' ? document.createElement('canvas') : null
const fadeScratch = typeof document !== 'undefined' ? document.createElement('canvas') : null

function drawLayer(
  ctx: CanvasRenderingContext2D,
  l: Layer,
  pixelScale: number,
  composite: GlobalCompositeOperation,
  filter = '',
) {
  ctx.save()
  ctx.globalAlpha = l.opacity / 100
  ctx.globalCompositeOperation = composite
  if (filter) ctx.filter = filter
  if (l.shadow.enabled && shadowScratch) {
    // Render content once, then cast its alpha as the shadow so it follows
    // transparent edges, text glyphs and rounded corners alike.
    const pad = 2
    const sw = Math.max(1, Math.ceil(l.w * pixelScale) + pad * 2)
    const sh = Math.max(1, Math.ceil(l.h * pixelScale) + pad * 2)
    if (sw * sh < 64e6) {
      shadowScratch.width = sw
      shadowScratch.height = sh
      const sctx = shadowScratch.getContext('2d')!
      sctx.setTransform(pixelScale, 0, 0, pixelScale, pad, pad)
      drawContent(sctx, l, pixelScale)
      enterLocal(ctx, l)
      ctx.shadowColor = hexToRgba(l.shadow.color, l.shadow.opacity / 100)
      ctx.shadowBlur = l.shadow.blur * pixelScale
      ctx.shadowOffsetX = l.shadow.x * pixelScale
      ctx.shadowOffsetY = l.shadow.y * pixelScale
      ctx.drawImage(
        shadowScratch,
        -pad / pixelScale,
        -pad / pixelScale,
        sw / pixelScale,
        sh / pixelScale,
      )
      ctx.restore()
      return
    }
  }
  enterLocal(ctx, l)
  drawContent(ctx, l, pixelScale, filter)
  ctx.restore()
}

export interface RenderOptions {
  /** Device pixels per document unit, for blur and shadow sizes. */
  pixelScale: number
  /** Layer ids not to draw (e.g. text being edited). */
  skip?: Set<string>
  /** Reusable canvas for clipping groups. */
  scratch?: HTMLCanvasElement
  /** Editing view: empty image frames show a placeholder (exports skip them). */
  preview?: boolean
}

/** Groups each base layer with the clip layers stacked directly on it. */
export function clipGroups(layers: Layer[]) {
  const groups: { base: Layer; clips: Layer[] }[] = []
  for (const l of layers) {
    if (l.clip && groups.length) groups[groups.length - 1].clips.push(l)
    else groups.push({ base: l, clips: [] })
  }
  return groups
}

/** Returns the base layer a clip layer is masked by, if any. */
export function maskBaseOf(layers: Layer[], id: string): Layer | null {
  for (const g of clipGroups(layers)) if (g.clips.some((c) => c.id === id)) return g.base
  return null
}

/**
 * Draws all layers into ctx, whose current transform maps document units to
 * pixels. The caller paints the artboard background and clips to it.
 */
export function renderLayers(ctx: CanvasRenderingContext2D, doc: DesignDoc, opts: RenderOptions) {
  const blend = (l: Layer): GlobalCompositeOperation =>
    l.blend === 'normal' ? 'source-over' : l.blend
  for (const { base, clips } of clipGroups(doc.layers)) {
    if (!base.visible) continue
    const visibleClips = clips.filter((c) => c.visible && !opts.skip?.has(c.id))
    const skipBase = opts.skip?.has(base.id)
    if (!visibleClips.length) {
      if (skipBase) continue
      if (base.maskOnly && isShape(base)) {
        // An empty frame: visible only while editing.
        if (opts.preview && !clips.length) drawFramePlaceholder(ctx, base, opts.pixelScale)
        continue
      }
      drawLayer(ctx, base, opts.pixelScale, blend(base))
      continue
    }
    const scratch = opts.scratch ?? document.createElement('canvas')
    scratch.width = ctx.canvas.width
    scratch.height = ctx.canvas.height
    const sctx = scratch.getContext('2d')!
    sctx.setTransform(ctx.getTransform())
    if (base.maskOnly) {
      // Pure mask: draw the clipped layers, then keep them only inside the base.
      for (const c of visibleClips)
        drawLayer(sctx, c, opts.pixelScale, c.blend === 'normal' ? 'source-over' : c.blend)
      const feather = base.maskFeather ? `blur(${base.maskFeather * opts.pixelScale}px)` : ''
      drawLayer(
        sctx,
        { ...base, opacity: 100, shadow: { ...base.shadow, enabled: false } },
        opts.pixelScale,
        base.maskInvert ? 'destination-out' : 'destination-in',
        feather,
      )
    } else {
      drawLayer(sctx, skipBase ? { ...base, opacity: 0.01 } : base, opts.pixelScale, 'source-over')
      for (const c of visibleClips) drawLayer(sctx, c, opts.pixelScale, 'source-atop')
    }
    ctx.save()
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.globalCompositeOperation = blend(base)
    ctx.drawImage(scratch, 0, 0)
    ctx.restore()
  }
}

/** Renders the whole artboard at `scale` into a new canvas (for export). */
export function renderArtboard(
  doc: DesignDoc,
  scale: number,
  { transparent = doc.transparent, background = doc.background } = {},
) {
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(doc.width * scale)
  canvas.height = Math.round(doc.height * scale)
  const ctx = canvas.getContext('2d')!
  if (!transparent) {
    ctx.fillStyle = background
    ctx.fillRect(0, 0, canvas.width, canvas.height)
  }
  ctx.setTransform(scale, 0, 0, scale, 0, 0)
  renderLayers(ctx, doc, { pixelScale: scale })
  return canvas
}

/** Small preview of one layer for the layers panel. */
export function drawThumb(canvas: HTMLCanvasElement, l: Layer) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const size = canvas.width
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.clearRect(0, 0, size, size)
  const s = (size - 4) / Math.max(l.w, l.h)
  ctx.setTransform(s, 0, 0, s, (size - l.w * s) / 2, (size - l.h * s) / 2)
  if (l.maskOnly && isShape(l))
    drawFramePlaceholder(ctx, { ...l, x: 0, y: 0, rotation: 0, flipX: false, flipY: false }, s)
  else drawContent(ctx, l, s)
}
