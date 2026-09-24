import { outline, type Fonts } from './fonts'
import { hash, imagePoseAt, poseAt, type ImagePose } from './motion'
import { chyronLayer, imageLayers, type ImageLayer, type Project } from './model'
import type { ImageMap } from './assets'

interface Shape {
  d: string
  color: string
  x?: number
  y?: number
  stroke?: string
  strokeWidth?: number
  blur?: number
}
interface Element {
  x: number
  y: number
  width: number
  height: number
  rotation: number
  scale: number
  skew: number
  shapes: Shape[]
}
export interface Scene {
  elements: Element[]
  width: number
  height: number
  paths: Map<string, Path2D>
}
const rect = (w: number, h: number, r: number) => {
  r = Math.max(0, Math.min(r, w / 2, h / 2))
  return `M${r} 0H${w - r}Q${w} 0 ${w} ${r}V${h - r}Q${w} ${h} ${w - r} ${h}H${r}Q0 ${h} 0 ${h - r}V${r}Q0 0 ${r} 0Z`
}
function shade(hex: string, amount = 0.25) {
  const rgb = [1, 3, 5].map((i) => Math.round(parseInt(hex.slice(i, i + 2), 16) * (1 - amount)))
  return `rgb(${rgb.join(',')})`
}

export function buildScene(p: Project, fonts: Fonts): Scene {
  const elements: Element[] = []
  const text =
    p.textCase === 'upper'
      ? p.text.toUpperCase()
      : p.textCase === 'lower'
        ? p.text.toLowerCase()
        : p.text
  const lines = text.normalize('NFC').split('\n')
  let index = 0,
    y = 0,
    maxWidth = 0
  const rows: { nodes: Element[]; width: number }[] = []
  for (const line of lines) {
    const nodes: Element[] = []
    let width = 0,
      height = p.tileSize
    if (p.mode === 'tiles') {
      for (const char of Array.from(line)) {
        if (char === ' ') {
          width += p.tileSize * 0.45 + p.gap
          continue
        }
        const glyph = outline(char, p.tileSize * 0.63, fonts)
        const fit = Math.min(1, (p.tileSize - p.padding * 2) / Math.max(1, glyph.width))
        const actual = fit < 1 ? outline(char, p.tileSize * 0.63 * fit, fonts) : glyph
        const tile = rect(p.tileSize, p.tileSize, p.radius)
        const depth = Math.max(0, p.depth + Math.sin(index * 3.3) * p.shadowVariation)
        const shapes: Shape[] = []
        if (depth > 0)
          shapes.push({ d: tile, color: shade(p.tileColor, 0.38), x: depth * 0.65, y: depth })
        shapes.push(
          { d: tile, color: p.tileColor },
          {
            d: actual.d,
            color: p.textColor,
            x: (p.tileSize - actual.width) / 2 - actual.left,
            y: (p.tileSize - actual.height) / 2 - actual.top,
          },
        )
        nodes.push({
          x: width + Math.sin(index * 123.45) * p.scatter,
          y: y + Math.cos(index * 61.725) * p.scatter,
          width: p.tileSize,
          height: p.tileSize,
          rotation: (index % 2 ? 1 : -1) * p.rotation,
          scale: 1 + Math.sin(index * 2.5) * p.variation,
          skew: 0,
          shapes,
        })
        width += p.tileSize + p.gap
        index++
      }
      width = Math.max(0, width - p.gap)
    } else {
      const glyph = outline(line || ' ', p.tileSize * 1.3, fonts)
      width = glyph.width + Math.max(0, Array.from(line).length - 1) * p.tracking
      height = Math.max(p.tileSize * 0.9, glyph.height)
      let cursor = 0
      for (const char of Array.from(line)) {
        const letter = outline(char, p.tileSize * 1.3, fonts)
        const main: Shape = { d: letter.d, color: p.textColor, x: -glyph.left, y: -glyph.top }
        const shapes: Shape[] = []
        const offset = (color: string, x: number, yy: number) =>
          shapes.push({ ...main, color, x: main.x! + x, y: main.y! + yy })
        if (p.effect === 'extrude' || p.effect === 'skew') {
          for (let j = Math.ceil(p.depth); j > 0; j--) offset(p.effectColor, j, j)
        } else if (p.effect === 'retro') {
          offset(p.effectColor2, p.depth, p.depth)
          offset(p.effectColor, p.depth / 2, p.depth / 2)
        } else if (p.effect === 'offset') offset(p.effectColor, p.depth, p.depth)
        if (p.effect === 'glow' || p.effect === 'neon') {
          shapes.push(
            { ...main, color: p.effectColor2, blur: Math.max(2, p.depth * 2) },
            { ...main, color: p.effectColor, blur: Math.max(1, p.depth) },
          )
        }
        if (p.effect === 'outline' || p.effect === 'neon') {
          shapes.push({
            ...main,
            color: p.filled ? p.textColor : 'transparent',
            stroke: p.effect === 'outline' ? p.effectColor : p.textColor,
            strokeWidth: p.effect === 'outline' ? Math.max(1, p.depth / 2) : 1.5,
          })
        } else shapes.push(main)
        if (letter.d)
          nodes.push({
            x: cursor,
            y,
            width: letter.width,
            height,
            rotation: 0,
            scale: 1,
            skew: p.effect === 'skew' || p.italic ? -0.12 : 0,
            shapes,
          })
        cursor += letter.advance + p.tracking
      }
    }
    rows.push({ nodes, width })
    maxWidth = Math.max(maxWidth, width)
    y += height + p.lineGap
  }
  y = Math.max(0, y - p.lineGap)
  const subtitle = p.subtitlePill ? p.subtitle.trim() : ''
  const sub = outline(subtitle, p.subtitleSize, fonts, true)
  const padX = p.subtitlePaddingX
  const padY = p.subtitlePaddingY
  const subWidth = subtitle ? sub.width + padX * 2 : 0
  const subHeight = subtitle ? sub.height + padY * 2 : 0
  maxWidth = Math.max(maxWidth, subWidth, 1)
  const subGap = subtitle ? p.subtitleGap : 0
  const topOffset = p.subtitlePosition === 'top' ? subHeight + subGap : 0
  const alignOffset = (width: number) =>
    p.align === 'left' ? 0 : p.align === 'right' ? maxWidth - width : (maxWidth - width) / 2
  for (const row of rows)
    for (const node of row.nodes)
      elements.push({ ...node, x: node.x + alignOffset(row.width), y: node.y + topOffset })
  if (subtitle)
    elements.push({
      x: alignOffset(subWidth),
      y: p.subtitlePosition === 'top' ? 0 : y + subGap,
      width: subWidth,
      height: subHeight,
      rotation: p.mode === 'tiles' ? -1.5 : 0,
      scale: 1,
      skew: 0,
      shapes: [
        { d: rect(subWidth, subHeight, p.subtitleRadius), color: shade(p.accent), y: 3 },
        { d: rect(subWidth, subHeight, p.subtitleRadius), color: p.accent },
        {
          d: sub.d,
          color: p.subtitleColor,
          x: padX - sub.left,
          y: padY - sub.top,
        },
      ],
    })
  // A fixed overscan includes overshoot, rotations, glow and long shadows at every frame.
  const overscan = 85 + p.scatter + p.depth + p.glow * 2
  for (const node of elements) {
    node.x += overscan
    node.y += overscan
  }
  return {
    elements,
    width: maxWidth + overscan * 2,
    height: y + subGap + subHeight + overscan * 2,
    paths: new Map(),
  }
}
export function placement(scene: Scene, p: Project) {
  const angle = (p.compositionRotation * Math.PI) / 180
  const rotatedWidth =
    Math.abs(scene.width * Math.cos(angle)) + Math.abs(scene.height * Math.sin(angle))
  const rotatedHeight =
    Math.abs(scene.height * Math.cos(angle)) + Math.abs(scene.width * Math.sin(angle))
  const scale =
    (Math.min((p.width * 0.94) / rotatedWidth, (p.height * 0.9) / rotatedHeight, 2.5) * p.scale) /
    100
  return {
    scale,
    x: (p.width * p.x) / 100 - (scene.width * scale) / 2,
    y: (p.height * p.y) / 100 - (scene.height * scale) / 2,
  }
}

export function chyronBounds(scene: Scene, p: Project) {
  const { scale } = placement(scene, p)
  return {
    cx: (p.width * p.x) / 100,
    cy: (p.height * p.y) / 100,
    width: scene.width * scale,
    height: scene.height * scale,
    rotation: p.compositionRotation,
  }
}

export function renderFrame(ctx: CanvasRenderingContext2D, scene: Scene, p: Project, time: number) {
  const { scale, x, y } = placement(scene, p)
  ctx.save()
  ctx.setTransform(ctx.canvas.width / p.width, 0, 0, ctx.canvas.height / p.height, 0, 0)
  ctx.clearRect(0, 0, p.width, p.height)
  ctx.translate(x, y)
  ctx.scale(scale, scale)
  ctx.translate(scene.width / 2, scene.height / 2)
  ctx.rotate((p.compositionRotation * Math.PI) / 180)
  ctx.translate(-scene.width / 2, -scene.height / 2)
  const backdropPose = poseAt(time, 0, 1, p)
  if (p.backdrop && scene.elements.length) {
    ctx.save()
    ctx.globalAlpha = backdropPose.opacity * 0.4
    ctx.fillStyle = '#000'
    ctx.filter = 'blur(20px)'
    ctx.fillRect(60, 60, scene.width - 120, scene.height - 120)
    ctx.restore()
  }
  scene.elements.forEach((node, i) => {
    const pose = poseAt(time, i, scene.elements.length, p)
    if (pose.opacity <= 0 || pose.reveal <= 0) return
    ctx.save()
    ctx.globalAlpha = pose.opacity
    ctx.translate(node.x + node.width / 2 + pose.x, node.y + node.height / 2 + pose.y)
    ctx.rotate(((node.rotation + pose.rotation) * Math.PI) / 180)
    ctx.scale(node.scale * pose.scale * pose.scaleX, node.scale * pose.scale)
    ctx.transform(1, 0, node.skew, 1, 0, 0)
    ctx.translate(-node.width / 2, -node.height / 2)
    if (pose.reveal < 1) {
      ctx.beginPath()
      ctx.rect(
        -p.depth * 3,
        -p.depth * 3,
        (node.width + p.depth * 6) * pose.reveal,
        node.height + p.depth * 6,
      )
      ctx.clip()
    }
    if (p.glow) {
      ctx.shadowColor = '#00000090'
      ctx.shadowBlur = p.glow
    }
    for (const shape of node.shapes) {
      if (!shape.d) continue
      if (!scene.paths.has(shape.d)) scene.paths.set(shape.d, new Path2D(shape.d))
      const path = scene.paths.get(shape.d)!
      ctx.save()
      ctx.translate(shape.x || 0, shape.y || 0)
      if (shape.blur) ctx.filter = `blur(${shape.blur}px)`
      if (shape.color !== 'transparent') {
        ctx.fillStyle = shape.color
        ctx.fill(path)
      }
      if (shape.stroke) {
        ctx.strokeStyle = shape.stroke
        ctx.lineWidth = shape.strokeWidth || 1
        ctx.lineJoin = 'round'
        ctx.stroke(path)
      }
      ctx.restore()
    }
    ctx.restore()
  })
  ctx.restore()
  // Apply composition opacity once after compositing its layers, matching SVG group
  // opacity. Per-shape alpha would make overlapping letters and shadows too opaque.
  if (p.opacity < 100) {
    ctx.save()
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.globalCompositeOperation = 'destination-in'
    ctx.globalAlpha = p.opacity / 100
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height)
    ctx.restore()
  }
}
function chyronSvg(scene: Scene, p: Project, time: number) {
  const { scale, x, y } = placement(scene, p)
  const defs: string[] = []
  const content = scene.elements
    .map((node, i) => {
      const pose = poseAt(time, i, scene.elements.length, p)
      const transform = `translate(${node.x + node.width / 2 + pose.x} ${node.y + node.height / 2 + pose.y}) rotate(${node.rotation + pose.rotation}) scale(${node.scale * pose.scale * pose.scaleX} ${node.scale * pose.scale}) matrix(1 0 ${node.skew} 1 0 0) translate(${-node.width / 2} ${-node.height / 2})`
      if (pose.reveal < 1)
        defs.push(
          `<clipPath id="clip${i}"><rect x="${-p.depth * 3}" y="${-p.depth * 3}" width="${(node.width + p.depth * 6) * pose.reveal}" height="${node.height + p.depth * 6}"/></clipPath>`,
        )
      const shapes = node.shapes
        .map((s, j) => {
          if (s.blur)
            defs.push(
              `<filter id="blur${i}-${j}" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="${s.blur / 2}"/></filter>`,
            )
          return `<path d="${s.d}" fill="${s.color === 'transparent' ? 'none' : s.color}" transform="translate(${s.x || 0} ${s.y || 0})"${s.stroke ? ` stroke="${s.stroke}" stroke-width="${s.strokeWidth}" stroke-linejoin="round"` : ''}${s.blur ? ` filter="url(#blur${i}-${j})"` : ''}/>`
        })
        .join('')
      return `<g opacity="${pose.opacity}" transform="${transform}"${pose.reveal < 1 ? ` clip-path="url(#clip${i})"` : ''}${p.glow ? ' filter="url(#shadow)"' : ''}>${shapes}</g>`
    })
    .join('')
  if (p.glow)
    defs.push(
      `<filter id="shadow" x="-100%" y="-100%" width="300%" height="300%"><feDropShadow dx="0" dy="0" stdDeviation="${p.glow / 2}" flood-opacity="0.56"/></filter>`,
    )
  let backdrop = ''
  if (p.backdrop && scene.elements.length) {
    defs.push('<filter id="backdrop"><feGaussianBlur stdDeviation="10"/></filter>')
    backdrop = `<rect x="60" y="60" width="${scene.width - 120}" height="${scene.height - 120}" opacity="${poseAt(time, 0, 1, p).opacity * 0.4}" filter="url(#backdrop)"/>`
  }
  return {
    defs: defs.join(''),
    body: `<g opacity="${p.opacity / 100}" transform="translate(${x} ${y}) scale(${scale}) rotate(${p.compositionRotation} ${scene.width / 2} ${scene.height / 2})">${backdrop}${content}</g>`,
  }
}

const esc = (value: string) => value.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`)
function imageSvg(l: ImageLayer, p: Project, time: number, href: string, n: number) {
  const pose = imagePoseAt(time, l, p)
  const opacity = pose.opacity * (l.opacity / 100)
  if (opacity <= 0 || pose.reveal <= 0) return { defs: '', body: '' }
  const { w, h, cx, cy } = imageBox(l, p)
  const defs: string[] = []
  const r = radiusPx(l, w, h)
  const id = `img${n}`
  defs.push(
    `<clipPath id="${id}-frame"><rect x="${-w / 2}" y="${-h / 2}" width="${w}" height="${h}" rx="${r}"/></clipPath>`,
  )
  let reveal = ''
  if (pose.reveal < 1) {
    defs.push(
      pose.revealMode === 'iris'
        ? `<clipPath id="${id}-reveal"><circle cx="0" cy="0" r="${(pose.reveal * Math.hypot(w, h)) / 2}"/></clipPath>`
        : `<clipPath id="${id}-reveal"><rect x="${-w / 2 - 2}" y="${-h / 2 - 2}" width="${(w + 4) * pose.reveal}" height="${h + 4}"/></clipPath>`,
    )
    reveal = ` clip-path="url(#${id}-reveal)"`
  }
  const filters: string[] = []
  if (pose.blur > 0.05) filters.push(`<feGaussianBlur stdDeviation="${pose.blur / 2}"/>`)
  if (l.shadow > 0)
    filters.push(
      `<feDropShadow dx="0" dy="${l.shadow * 0.3}" stdDeviation="${l.shadow / 2}" flood-opacity="0.5"/>`,
    )
  if (filters.length)
    defs.push(
      `<filter id="${id}-fx" x="-50%" y="-50%" width="200%" height="200%">${filters.join('')}</filter>`,
    )
  const zoom = pose.contentZoom
  const border =
    l.border > 0
      ? `<rect x="${-w / 2 + l.border / 2}" y="${-h / 2 + l.border / 2}" width="${Math.max(0, w - l.border)}" height="${Math.max(0, h - l.border)}" rx="${Math.max(0, r - l.border / 2)}" fill="none" stroke="${l.borderColor}" stroke-width="${l.border}"/>`
      : ''
  const sx = pose.scale * pose.scaleX * (l.flipX ? -1 : 1)
  const sy = pose.scale * pose.scaleY
  const pivot = pose.pivotY * h
  const body = `<g opacity="${opacity}" transform="translate(${cx + pose.x} ${cy + pose.y + pivot}) rotate(${l.rotation + pose.rotation}) translate(0 ${-pivot}) scale(${sx} ${sy})"${reveal}><g${filters.length ? ` filter="url(#${id}-fx)"` : ''}><g clip-path="url(#${id}-frame)"><image href="${esc(href)}" x="${(-w * zoom) / 2}" y="${(-h * zoom) / 2}" width="${w * zoom}" height="${h * zoom}" preserveAspectRatio="none"/></g>${border}</g></g>`
  return { defs: defs.join(''), body }
}

/** Standalone SVG of every visible layer. `images` maps asset ids to data URLs. */
export function renderSvg(
  scene: Scene,
  p: Project,
  time: number,
  images: ReadonlyMap<string, string> = new Map(),
) {
  const defs: string[] = []
  const bodies: string[] = []
  let n = 0
  for (const layer of p.layers) {
    if (!layer.visible) continue
    const part =
      layer.kind === 'chyron'
        ? chyronSvg(scene, p, time)
        : images.has(layer.assetId)
          ? imageSvg(layer, p, time, images.get(layer.assetId)!, n++)
          : null
    if (!part) continue
    defs.push(part.defs)
    bodies.push(part.body)
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${p.width}" height="${p.height}" viewBox="0 0 ${p.width} ${p.height}"><defs>${defs.join('')}</defs>${bodies.join('')}</svg>`
}

/* ---------- Image layers ---------- */

export function imageBox(l: ImageLayer, p: Project) {
  const w = (l.width / 100) * p.width
  return { w, h: w * l.aspect, cx: (l.x / 100) * p.width, cy: (l.y / 100) * p.height }
}
export function imageBounds(l: ImageLayer, p: Project) {
  const { w, h, cx, cy } = imageBox(l, p)
  return { cx, cy, width: w, height: h, rotation: l.rotation }
}
const radiusPx = (l: ImageLayer, w: number, h: number) => (l.radius / 100) * Math.min(w, h)

type Surface = HTMLCanvasElement | OffscreenCanvas
function surface(width: number, height: number): Surface {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(width, height)
  const c = document.createElement('canvas')
  c.width = width
  c.height = height
  return c
}
const context2d = (s: Surface) =>
  s.getContext('2d') as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null

/* Framed images (radius, border, Ken Burns zoom) are cached by their exact pixel size. */
const cards = new Map<string, Surface>()
function framedImage(
  image: CanvasImageSource & { width: number; height: number },
  l: ImageLayer,
  pw: number,
  ph: number,
  k: number,
  zoom: number,
) {
  const key = `${l.assetId}|${pw}|${ph}|${l.radius}|${l.border}|${l.borderColor}|${zoom.toFixed(4)}`
  const cached = cards.get(key)
  if (cached) {
    cards.delete(key)
    cards.set(key, cached)
    return cached
  }
  const card = surface(pw, ph)
  const ctx = context2d(card)
  if (!ctx) return card
  const r = (l.radius / 100) * Math.min(pw, ph)
  ctx.save()
  if (r > 0) {
    ctx.beginPath()
    ctx.roundRect(0, 0, pw, ph, r)
    ctx.clip()
  }
  ctx.imageSmoothingQuality = 'high'
  const dw = pw * zoom,
    dh = ph * zoom
  ctx.drawImage(image, (pw - dw) / 2, (ph - dh) / 2, dw, dh)
  ctx.restore()
  if (l.border > 0) {
    const b = l.border * k
    ctx.strokeStyle = l.borderColor
    ctx.lineWidth = b
    ctx.beginPath()
    ctx.roundRect(b / 2, b / 2, Math.max(0, pw - b), Math.max(0, ph - b), Math.max(0, r - b / 2))
    ctx.stroke()
  }
  cards.set(key, card)
  // Ken Burns creates a new size every frame; keep memory bounded.
  while (cards.size > 24) cards.delete(cards.keys().next().value!)
  return card
}
function tinted(card: Surface, color: string) {
  const out = surface(card.width, card.height)
  const ctx = context2d(out)
  if (!ctx) return out
  ctx.drawImage(card, 0, 0)
  ctx.globalCompositeOperation = 'source-atop'
  ctx.fillStyle = color
  ctx.fillRect(0, 0, out.width, out.height)
  return out
}
function shineCard(card: Surface, position: number, strength: number) {
  const out = surface(card.width, card.height)
  const ctx = context2d(out)
  if (!ctx) return card
  ctx.drawImage(card, 0, 0)
  ctx.globalCompositeOperation = 'source-atop'
  const w = out.width,
    h = out.height
  const band = Math.max(w, h) * (0.12 + 0.18 * strength)
  const center = -band + (w + h + band * 2) * position
  const gradient = ctx.createLinearGradient(center - band, 0, center + band, h * 0.35)
  gradient.addColorStop(0, 'rgba(255,255,255,0)')
  gradient.addColorStop(0.5, `rgba(255,255,255,${0.35 + 0.45 * strength})`)
  gradient.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, w, h)
  return out
}

function drawSparks(
  ctx: CanvasRenderingContext2D,
  pose: ImagePose,
  l: ImageLayer,
  w: number,
  h: number,
) {
  const t = pose.sparks
  const size = Math.max(w, h) * 0.6
  ctx.save()
  ctx.globalAlpha *= (1 - t) ** 1.2
  ctx.strokeStyle = l.burstColor
  ctx.fillStyle = l.burstColor
  ctx.lineCap = 'round'
  const count = 16
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2 + hash(i, 3) * 0.3
    const reach = size * (0.35 + 0.9 * Math.sqrt(t)) * (0.75 + 0.4 * hash(i, 4))
    const length = size * 0.22 * (1 - t) * (0.6 + 0.6 * hash(i, 5))
    ctx.lineWidth = Math.max(1, size * 0.018 * (1 - t))
    ctx.beginPath()
    ctx.moveTo(Math.cos(angle) * reach, Math.sin(angle) * reach)
    ctx.lineTo(Math.cos(angle) * (reach + length), Math.sin(angle) * (reach + length))
    ctx.stroke()
  }
  // A soft flash ring that expands with the burst.
  ctx.globalAlpha *= 0.5
  ctx.lineWidth = Math.max(1, size * 0.03 * (1 - t))
  ctx.beginPath()
  ctx.arc(0, 0, size * (0.3 + t), 0, Math.PI * 2)
  ctx.stroke()
  ctx.restore()
}

export function drawImageLayer(
  ctx: CanvasRenderingContext2D,
  l: ImageLayer,
  image: CanvasImageSource & { width: number; height: number },
  p: Project,
  time: number,
) {
  const pose = imagePoseAt(time, l, p)
  const opacity = pose.opacity * (l.opacity / 100)
  if (opacity <= 0 || pose.reveal <= 0) return
  const k = ctx.canvas.width / p.width
  const { w, h, cx, cy } = imageBox(l, p)
  const pw = Math.max(1, Math.min(8192, Math.round(w * k)))
  const ph = Math.max(1, Math.min(8192, Math.round(h * k)))
  let card: Surface = framedImage(image, l, pw, ph, k, pose.contentZoom)
  if (pose.shine >= 0) card = shineCard(card, pose.shine, l.emphasisStrength / 100)
  ctx.save()
  ctx.setTransform(k, 0, 0, ctx.canvas.height / p.height, 0, 0)
  ctx.globalAlpha = opacity
  const pivot = pose.pivotY * h
  ctx.translate(cx + pose.x, cy + pose.y + pivot)
  ctx.rotate(((l.rotation + pose.rotation) * Math.PI) / 180)
  ctx.translate(0, -pivot)
  if (pose.sparks >= 0) drawSparks(ctx, pose, l, w, h)
  ctx.scale(pose.scale * pose.scaleX * (l.flipX ? -1 : 1), pose.scale * pose.scaleY)
  if (pose.reveal < 1) {
    ctx.beginPath()
    if (pose.revealMode === 'iris')
      ctx.arc(0, 0, (pose.reveal * Math.hypot(w, h)) / 2, 0, Math.PI * 2)
    else ctx.rect(-w / 2 - 2, -h / 2 - 2, (w + 4) * pose.reveal, h + 4)
    ctx.clip()
  }
  // Canvas filters and shadows are measured in device pixels, not in the current transform.
  const filters: string[] = []
  if (pose.blur > 0.05) filters.push(`blur(${(pose.blur * k).toFixed(2)}px)`)
  if (pose.brightness !== 1) filters.push(`brightness(${pose.brightness.toFixed(3)})`)
  if (filters.length) ctx.filter = filters.join(' ')
  if (l.shadow > 0) {
    ctx.shadowColor = 'rgba(0,0,0,0.5)'
    ctx.shadowBlur = l.shadow * k
    ctx.shadowOffsetY = l.shadow * 0.3 * k
  }
  if (pose.glitch > 0.01) {
    const g = pose.glitch
    const split = w * 0.03 * g
    ctx.save()
    ctx.shadowColor = 'transparent'
    ctx.globalAlpha = opacity * 0.6
    ctx.drawImage(tinted(card, '#ff2a55'), -w / 2 - split, -h / 2, w, h)
    ctx.drawImage(tinted(card, '#22e4ff'), -w / 2 + split, -h / 2, w, h)
    ctx.restore()
    const slices = 7
    for (let i = 0; i < slices; i++) {
      const offset = (hash(pose.seed, i + 11) - 0.5) * 2 * g * w * 0.1
      const sy = (i / slices) * card.height
      const sh = card.height / slices
      ctx.drawImage(
        card,
        0,
        sy,
        card.width,
        sh,
        -w / 2 + offset,
        -h / 2 + (i / slices) * h,
        w,
        h / slices + 0.5,
      )
    }
  } else ctx.drawImage(card, -w / 2, -h / 2, w, h)
  ctx.restore()
}

const chyronSurfaces = new WeakMap<HTMLCanvasElement | OffscreenCanvas, Surface>()
/**
 * Render every visible layer, bottom to top. A project with only its chyron renders
 * exactly as before; otherwise the chyron is composited from its own surface so its
 * group opacity never affects the images beneath it.
 */
export function renderComposition(
  ctx: CanvasRenderingContext2D,
  scene: Scene | null,
  p: Project,
  time: number,
  images: ImageMap = new Map(),
) {
  const images_ = imageLayers(p).filter((l) => l.visible && images.has(l.assetId))
  const chyron = chyronLayer(p)
  if (!images_.length && scene && chyron.visible) {
    renderFrame(ctx, scene, p, time)
    return
  }
  ctx.save()
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height)
  ctx.restore()
  for (const layer of p.layers) {
    if (!layer.visible) continue
    if (layer.kind === 'image') {
      const image = images.get(layer.assetId)
      if (image) drawImageLayer(ctx, layer, image, p, time)
      continue
    }
    if (!scene) continue
    let layerSurface = chyronSurfaces.get(ctx.canvas)
    if (
      !layerSurface ||
      layerSurface.width !== ctx.canvas.width ||
      layerSurface.height !== ctx.canvas.height
    ) {
      layerSurface = surface(ctx.canvas.width, ctx.canvas.height)
      chyronSurfaces.set(ctx.canvas, layerSurface)
    }
    const layerContext = context2d(layerSurface)
    if (!layerContext) continue
    renderFrame(layerContext as CanvasRenderingContext2D, scene, p, time)
    ctx.save()
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.drawImage(layerSurface, 0, 0)
    ctx.restore()
  }
}
