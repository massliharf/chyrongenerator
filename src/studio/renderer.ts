import { outline, type Fonts } from './fonts'
import { poseAt } from './motion'
import type { Project } from './model'

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
function placement(scene: Scene, p: Project) {
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
export function renderSvg(scene: Scene, p: Project, time: number) {
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
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${p.width}" height="${p.height}" viewBox="0 0 ${p.width} ${p.height}"><defs>${defs.join('')}</defs><g opacity="${p.opacity / 100}" transform="translate(${x} ${y}) scale(${scale}) rotate(${p.compositionRotation} ${scene.width / 2} ${scene.height / 2})">${backdrop}${content}</g></svg>`
}
