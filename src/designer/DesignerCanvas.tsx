import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react'
import { ImagePlus, Lock } from 'lucide-react'
import {
  applyLocalBox,
  bounds,
  buildTargets,
  center,
  clampCrop,
  corners,
  fullImageLocal,
  HANDLES,
  hitLayer,
  normalizeAngle,
  normalizeRect,
  rectsIntersect,
  resizeBox,
  snapAngle,
  snapMove,
  snapValue,
  toLocal,
  unionBounds,
  type Handle,
  type Point,
  type Rect,
  type SnapGuide,
  type SnapTargets,
} from './geometry'
import {
  createShape,
  createText,
  isShape,
  type ShapeKind,
  type DesignDoc,
  type ImageLayer,
  type Layer,
  type TextLayer,
} from './model'
import { addLayer, groupIds, updateLayers } from './ops'
import {
  fontString,
  hitShape,
  loadFont,
  maskBaseOf,
  renderLayers,
  shapeD,
  textNaturalWidth,
} from './render'
import type { DesignEditor } from './useDesignDoc'

export type Tool = 'select' | 'hand' | 'text' | 'rect' | 'ellipse'
export interface View {
  zoom: number
  panX: number
  panY: number
}

type Gesture =
  | { kind: 'pan'; start: Point; view: View }
  | {
      kind: 'move'
      start: Point
      layers: Layer[]
      rect: Rect
      targets: SnapTargets
      moved: boolean
      /** Click without drag on an already-selected layer narrows to it. */
      narrowTo: string | null
    }
  | {
      kind: 'resize'
      handle: Handle
      layer: Layer
      targets: SnapTargets
    }
  | { kind: 'rotate'; layer: Layer; startAngle: number }
  | { kind: 'marquee'; start: Point; additive: string[] }
  | { kind: 'draw'; start: Point; id: string; targets: SnapTargets }
  | { kind: 'crop-resize'; handle: Handle; layer: ImageLayer }
  | { kind: 'crop-pan'; start: Point; layer: ImageLayer }

/** Another artboard drawn around the one being edited; its corner is relative to it. */
export interface Neighbor {
  id: string
  x: number
  y: number
  doc: DesignDoc
}

export interface CanvasProps {
  /** Other artboards (multi-artboard apps): drawn alongside, a click edits them. */
  neighbors?: Neighbor[]
  onActivate?: (id: string, layerId: string | null) => void
  editor: DesignEditor
  doc: DesignDoc
  selection: string[]
  onSelect: (ids: string[]) => void
  tool: Tool
  onTool: (tool: Tool) => void
  view: View
  onView: (view: View | ((v: View) => View)) => void
  onStageSize: (size: { width: number; height: number }) => void
  cropId: string | null
  cropRatio: number | null
  onCrop: (id: string | null) => void
  editingId: string | null
  onEditText: (id: string | null) => void
  spaceHeld: boolean
  imagesVersion: number
  onContextMenu: (at: { x: number; y: number }, hit: string | null) => void
  onDropFiles: (files: File[], at: Point, frameId: string | null) => void
  /** Double-click on an empty frame. */
  onFillFrame: (frameId: string) => void
  /** An image dragged onto an empty frame goes inside it. */
  onDropIntoFrame: (layerId: string, frameId: string) => void
}

const HANDLE_CURSOR: Record<Handle, string> = {
  n: 'ns-resize',
  s: 'ns-resize',
  e: 'ew-resize',
  w: 'ew-resize',
  ne: 'nesw-resize',
  sw: 'nesw-resize',
  nw: 'nwse-resize',
  se: 'nwse-resize',
}

function handleCursor(h: Handle, rotation: number) {
  // Rotate the cursor with the layer, in 45° steps.
  const order: Handle[] = ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw']
  const step = Math.round(rotation / 45)
  return HANDLE_CURSOR[order[(order.indexOf(h) + step + 80) % 8]]
}

export function DesignerCanvas(props: CanvasProps) {
  const {
    editor,
    doc,
    selection,
    onSelect,
    tool,
    onTool,
    view,
    onView,
    cropId,
    cropRatio,
    editingId,
  } = props
  const stage = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const scratch = useRef<HTMLCanvasElement | null>(null)
  const gesture = useRef<Gesture | null>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })
  const [guides, setGuides] = useState<SnapGuide[]>([])
  const [marquee, setMarquee] = useState<Rect | null>(null)
  const [hover, setHover] = useState<string | null>(null)
  const [dropping, setDropping] = useState(false)
  const [frameTarget, setFrameTarget] = useState<string | null>(null)
  const [panning, setPanning] = useState(false)
  const [, setFontTick] = useState(0)

  const selected = useMemo(
    () => doc.layers.filter((l) => selection.includes(l.id)),
    [doc.layers, selection],
  )
  const single = selected.length === 1 ? selected[0] : null
  const cropLayer = doc.layers.find((l): l is ImageLayer => l.id === cropId && l.kind === 'image')
  const editingLayer = doc.layers.find(
    (l): l is TextLayer => l.id === editingId && l.kind === 'text',
  )

  const toDoc = (clientX: number, clientY: number): Point => {
    const r = stage.current!.getBoundingClientRect()
    return {
      x: (clientX - r.left - view.panX) / view.zoom,
      y: (clientY - r.top - view.panY) / view.zoom,
    }
  }
  const toScreen = (p: Point): Point => ({
    x: p.x * view.zoom + view.panX,
    y: p.y * view.zoom + view.panY,
  })

  /* ---------- Size ---------- */
  useLayoutEffect(() => {
    const el = stage.current
    if (!el) return
    const update = () => {
      const r = el.getBoundingClientRect()
      const next = { width: Math.round(r.width), height: Math.round(r.height) }
      setSize(next)
      props.onStageSize(next)
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /* ---------- Fonts: redraw as text faces arrive ---------- */
  useEffect(() => {
    let alive = true
    for (const l of doc.layers)
      if (l.kind === 'text')
        void loadFont(l).then(() => {
          if (alive) setFontTick((n) => n + 1)
        })
    return () => {
      alive = false
    }
  }, [doc.layers])

  /* ---------- Draw ---------- */
  useEffect(() => {
    const c = canvas.current
    if (!c || !size.width) return
    const frame = requestAnimationFrame(() => {
      const dpr = window.devicePixelRatio || 1
      const w = Math.round(size.width * dpr),
        h = Math.round(size.height * dpr)
      if (c.width !== w || c.height !== h) {
        c.width = w
        c.height = h
      }
      const ctx = c.getContext('2d')!
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.clearRect(0, 0, w, h)
      const s = dpr * view.zoom
      ctx.setTransform(s, 0, 0, s, dpr * view.panX, dpr * view.panY)
      const styles = getComputedStyle(stage.current!)
      scratch.current ??= document.createElement('canvas')
      // Other artboards, each clipped to its own frame.
      for (const n of props.neighbors ?? []) {
        ctx.save()
        ctx.translate(n.x, n.y)
        ctx.save()
        ctx.shadowColor = 'rgba(0,0,0,0.12)'
        ctx.shadowBlur = 12 * dpr
        ctx.fillStyle = n.doc.transparent ? '#ffffff' : n.doc.background
        ctx.fillRect(0, 0, n.doc.width, n.doc.height)
        ctx.restore()
        ctx.beginPath()
        ctx.rect(0, 0, n.doc.width, n.doc.height)
        ctx.clip()
        renderLayers(ctx, n.doc, { pixelScale: s, scratch: scratch.current, preview: true })
        ctx.restore()
      }
      // Artboard
      ctx.save()
      ctx.shadowColor = 'rgba(0,0,0,0.12)'
      ctx.shadowBlur = 12 * dpr
      ctx.fillStyle = doc.transparent ? '#ffffff' : doc.background
      ctx.fillRect(0, 0, doc.width, doc.height)
      ctx.restore()
      if (doc.transparent) {
        const cell = 12 / view.zoom
        ctx.fillStyle = styles.getPropertyValue('--checker-a').trim() || '#e8e8e8'
        ctx.fillRect(0, 0, doc.width, doc.height)
        ctx.fillStyle = styles.getPropertyValue('--checker-b').trim() || '#f7f7f7'
        for (let y = 0, row = 0; y < doc.height; y += cell, row++)
          for (let x = (row % 2) * cell; x < doc.width; x += cell * 2)
            ctx.fillRect(x, y, Math.min(cell, doc.width - x), Math.min(cell, doc.height - y))
      }
      ctx.save()
      ctx.beginPath()
      ctx.rect(0, 0, doc.width, doc.height)
      ctx.clip()
      const skip = new Set<string>()
      if (editingId) skip.add(editingId)
      renderLayers(ctx, doc, { pixelScale: s, skip, scratch: scratch.current, preview: true })
      ctx.restore()
      // Grid
      if (doc.grid.show && doc.grid.size * view.zoom >= 5) {
        ctx.save()
        ctx.strokeStyle =
          styles.getPropertyValue('--designer-grid').trim() || 'rgba(79,105,242,0.18)'
        ctx.lineWidth = 1 / s
        ctx.beginPath()
        for (let x = doc.grid.size; x < doc.width; x += doc.grid.size) {
          ctx.moveTo(x, 0)
          ctx.lineTo(x, doc.height)
        }
        for (let y = doc.grid.size; y < doc.height; y += doc.grid.size) {
          ctx.moveTo(0, y)
          ctx.lineTo(doc.width, y)
        }
        ctx.stroke()
        ctx.restore()
      }
    })
    return () => cancelAnimationFrame(frame)
  })

  /* ---------- Wheel: pan, ctrl/⌘ + wheel or pinch zooms at the cursor ---------- */
  useEffect(() => {
    const el = stage.current
    if (!el) return
    const wheel = (e: WheelEvent) => {
      e.preventDefault()
      const r = el.getBoundingClientRect()
      const sx = e.clientX - r.left,
        sy = e.clientY - r.top
      if (e.ctrlKey || e.metaKey) {
        onView((v) => {
          const zoom = Math.min(32, Math.max(0.02, v.zoom * Math.exp(-e.deltaY * 0.01)))
          return {
            zoom,
            panX: sx - ((sx - v.panX) / v.zoom) * zoom,
            panY: sy - ((sy - v.panY) / v.zoom) * zoom,
          }
        })
      } else {
        const dx = e.shiftKey && !e.deltaX ? e.deltaY : e.deltaX
        const dy = e.shiftKey && !e.deltaX ? 0 : e.deltaY
        onView((v) => ({ ...v, panX: v.panX - dx, panY: v.panY - dy }))
      }
    }
    el.addEventListener('wheel', wheel, { passive: false })
    return () => el.removeEventListener('wheel', wheel)
  }, [onView])

  /* ---------- Hit testing ---------- */
  /** Box test plus the real outline for ellipses, stars, hearts… */
  const hitPrecise = (p: Point, l: Layer, slop: number) => {
    if (!hitLayer(p, l, slop)) return false
    if (!isShape(l) || l.kind === 'rect' || l.kind === 'ellipse' || l.kind === 'line') return true
    const q = toLocal(p, l)
    return hitShape(l, q.x, q.y)
  }
  const isFrame = (l: Layer | null | undefined) => !!l && !l.clip && !!l.maskOnly && isShape(l)
  const frameHasContent = (layers: Layer[], id: string) => groupIds(layers, id).length > 1
  /**
   * Topmost layer under p. A picture inside a frame selects the frame, so the
   * pair moves together; `deep` (⌘-click, double-click) reaches inside.
   */
  const hitAt = (p: Point, includeLocked = false, deep = false): Layer | null => {
    const slop = 3 / view.zoom
    for (let i = doc.layers.length - 1; i >= 0; i--) {
      const l = doc.layers[i]
      if (!l.visible || (!includeLocked && l.locked)) continue
      if (!hitPrecise(p, l, l.kind === 'text' ? slop * 2 : slop)) continue
      // A clipped layer is only hittable where its mask is.
      if (l.clip) {
        const base = maskBaseOf(doc.layers, l.id)
        if (base && !hitPrecise(p, base, slop)) continue
        if (!deep && isFrame(base) && base && base.visible && (includeLocked || !base.locked))
          return base
      }
      return l
    }
    return null
  }
  /** Empty frame under p that `excludeId` could be dropped into. */
  const emptyFrameAt = (p: Point, excludeId?: string) => {
    for (let i = doc.layers.length - 1; i >= 0; i--) {
      const l = doc.layers[i]
      if (l.id === excludeId || !l.visible || !isFrame(l)) continue
      if (frameHasContent(doc.layers, l.id)) continue
      if (hitPrecise(p, l, 0)) return l
    }
    return null
  }
  const frameAt = (p: Point) => {
    for (let i = doc.layers.length - 1; i >= 0; i--) {
      const l = doc.layers[i]
      if (l.visible && isFrame(l) && hitPrecise(p, l, 0)) return l
    }
    return null
  }

  const grid = { snap: doc.grid.snapToGrid, size: doc.grid.size }
  const threshold = 6 / view.zoom
  const targetsExcluding = (ids: string[]) =>
    buildTargets(doc.layers, new Set(ids), doc, doc.grid.snapToObjects)

  /* ---------- Pointer handling ---------- */
  const capture = (e: ReactPointerEvent) => {
    try {
      stage.current?.setPointerCapture(e.pointerId)
    } catch {
      /* pointer already gone */
    }
  }

  const startPan = (e: ReactPointerEvent) => {
    gesture.current = { kind: 'pan', start: { x: e.clientX, y: e.clientY }, view }
    setPanning(true)
    capture(e)
  }

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button === 2) return
    if (editingId) {
      // Clicking away from the text being edited finishes the edit.
      props.onEditText(null)
      return
    }
    if (e.button === 1 || tool === 'hand' || props.spaceHeld) {
      e.preventDefault()
      startPan(e)
      return
    }
    const p = toDoc(e.clientX, e.clientY)
    if (cropLayer) {
      // Clicking outside the crop frame applies the crop.
      if (!hitLayer(p, cropLayer)) props.onCrop(null)
      else {
        editor.begin()
        gesture.current = { kind: 'crop-pan', start: p, layer: cropLayer }
        capture(e)
      }
      return
    }
    // A click on another artboard edits it, selecting the layer under the pointer.
    const outside = p.x < 0 || p.y < 0 || p.x > doc.width || p.y > doc.height
    if (outside && props.onActivate && tool === 'select') {
      const n = props.neighbors?.find(
        (b) => p.x >= b.x && p.y >= b.y && p.x <= b.x + b.doc.width && p.y <= b.y + b.doc.height,
      )
      if (n) {
        const local = { x: p.x - n.x, y: p.y - n.y }
        const hit = [...n.doc.layers]
          .reverse()
          .find((l) => l.visible && !l.locked && !l.maskOnly && hitLayer(local, l))
        props.onActivate(n.id, hit?.id ?? null)
        return
      }
    }
    if (tool === 'rect' || tool === 'ellipse') {
      const shape = createShape(doc, tool)
      const sp = snapPoint(p, targetsExcluding([]))
      Object.assign(shape, { x: sp.x, y: sp.y, w: 1, h: 1 })
      editor.begin()
      editor.preview(addLayer(doc, shape))
      onSelect([shape.id])
      gesture.current = {
        kind: 'draw',
        start: sp,
        id: shape.id,
        targets: targetsExcluding([shape.id]),
      }
      capture(e)
      return
    }
    if (tool === 'text') {
      const t = createText(doc, 'body')
      t.text = 'Type something'
      t.align = 'left'
      t.w = Math.max(40, textNaturalWidth(t))
      t.x = Math.round(p.x)
      t.y = Math.round(p.y - t.size * t.lineHeight * 0.5)
      editor.commit(addLayer(doc, t))
      onSelect([t.id])
      onTool('select')
      props.onEditText(t.id)
      return
    }
    // Select tool (⌘/Ctrl-click reaches inside frames)
    const hit = hitAt(p, false, e.metaKey || e.ctrlKey)
    if (!hit) {
      gesture.current = { kind: 'marquee', start: p, additive: e.shiftKey ? selection : [] }
      if (!e.shiftKey) onSelect([])
      capture(e)
      return
    }
    let ids = selection
    let narrowTo: string | null = null
    if (e.shiftKey) {
      ids = selection.includes(hit.id)
        ? selection.filter((id) => id !== hit.id)
        : [...selection, hit.id]
      onSelect(ids)
      if (!ids.includes(hit.id)) return
    } else if (!selection.includes(hit.id)) {
      ids = [hit.id]
      onSelect(ids)
    } else if (selection.length > 1) narrowTo = hit.id
    // Frames carry their pictures with them.
    const moveIds = new Set(
      ids.flatMap((id) =>
        isFrame(doc.layers.find((l) => l.id === id)) ? groupIds(doc.layers, id) : [id],
      ),
    )
    const layers = doc.layers.filter((l) => moveIds.has(l.id) && !l.locked)
    if (!layers.length) return
    gesture.current = {
      kind: 'move',
      start: p,
      layers,
      rect: unionBounds(layers)!,
      targets: targetsExcluding([...moveIds]),
      moved: false,
      narrowTo,
    }
    capture(e)
  }

  const snapPoint = (p: Point, targets: SnapTargets) => {
    const x = snapValue(p.x, 'x', targets, threshold, grid)
    const y = snapValue(p.y, 'y', targets, threshold, grid)
    return { x: x.value, y: y.value }
  }

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const g = gesture.current
    if (!g) {
      if (tool === 'select' && !cropLayer && !editingId && !props.spaceHeld) {
        const h = hitAt(toDoc(e.clientX, e.clientY))
        setHover(h?.id ?? null)
      }
      return
    }
    if (g.kind === 'pan') {
      onView({
        ...g.view,
        panX: g.view.panX + e.clientX - g.start.x,
        panY: g.view.panY + e.clientY - g.start.y,
      })
      return
    }
    const p = toDoc(e.clientX, e.clientY)
    if (g.kind === 'marquee') {
      const r = normalizeRect(g.start, p)
      setMarquee(r)
      const inside = doc.layers
        .filter((l) => l.visible && !l.locked && rectsIntersect(bounds(l), r))
        .map((l) => l.id)
      onSelect([...new Set([...g.additive, ...inside])])
      return
    }
    if (g.kind === 'move') {
      let dx = p.x - g.start.x,
        dy = p.y - g.start.y
      if (!g.moved) {
        if (Math.hypot(dx, dy) * view.zoom < 3) return
        g.moved = true
        editor.begin()
      }
      if (e.shiftKey) {
        // Constrain to the dominant axis.
        if (Math.abs(dx) > Math.abs(dy)) dy = 0
        else dx = 0
      }
      const moved = { ...g.rect, x: g.rect.x + dx, y: g.rect.y + dy }
      let guidesNow: SnapGuide[] = []
      if (!e.altKey) {
        const s = snapMove(moved, g.targets, threshold, grid)
        dx += s.dx
        dy += s.dy
        guidesNow = s.guides
      }
      setGuides(guidesNow)
      // A loose image over an empty frame offers to go inside it.
      const only = g.layers.length === 1 ? g.layers[0] : null
      setFrameTarget(
        only && only.kind === 'image' && !only.clip ? (emptyFrameAt(p, only.id)?.id ?? null) : null,
      )
      const byId = new Map(g.layers.map((l) => [l.id, l]))
      editor.preview(
        updateLayers(editor.current.current, byId.keys(), (l) => ({
          x: Math.round((byId.get(l.id)!.x + dx) * 100) / 100,
          y: Math.round((byId.get(l.id)!.y + dy) * 100) / 100,
        })),
      )
      return
    }
    if (g.kind === 'resize') {
      const l = g.layer
      const corner = g.handle.length === 2
      const keepRatio =
        l.kind === 'image' ? corner !== e.shiftKey : l.kind === 'text' ? corner : e.shiftKey
      let box = resizeBox(l, g.handle, p, { keepRatio, fromCenter: e.altKey })
      const found: SnapGuide[] = []
      if (!l.rotation && !e.altKey) {
        // Snap the dragged edges.
        let { x, y, w, h } = box
        const r0 = x + w,
          b0 = y + h
        if (g.handle.includes('w')) {
          const s = snapValue(x, 'x', g.targets, threshold, grid)
          x = s.value
          w = r0 - x
          if (s.hit !== null) found.push({ axis: 'x', pos: s.hit, from: y, to: b0 })
        }
        if (g.handle.includes('e')) {
          const s = snapValue(r0, 'x', g.targets, threshold, grid)
          w = s.value - x
          if (s.hit !== null) found.push({ axis: 'x', pos: s.hit, from: y, to: b0 })
        }
        if (!keepRatio || !(g.handle.includes('w') || g.handle.includes('e'))) {
          if (g.handle.includes('n')) {
            const s = snapValue(y, 'y', g.targets, threshold, grid)
            y = s.value
            h = b0 - y
            if (s.hit !== null) found.push({ axis: 'y', pos: s.hit, from: x, to: x + w })
          }
          if (g.handle.includes('s')) {
            const s = snapValue(b0, 'y', g.targets, threshold, grid)
            h = s.value - y
            if (s.hit !== null) found.push({ axis: 'y', pos: s.hit, from: x, to: x + w })
          }
        } else if (keepRatio) {
          const nh = w / (l.w / l.h)
          if (g.handle.includes('n')) y = b0 - nh
          h = nh
        }
        if (w >= 1 && h >= 1) box = { x, y, w, h }
      }
      setGuides(found)
      let values: Partial<Layer> = box
      if (l.kind === 'text') {
        // Sides reflow text; corners scale the type.
        values = corner
          ? { ...box, size: Math.max(4, Math.round(l.size * (box.w / l.w) * 10) / 10) }
          : { x: box.x, w: box.w, ...(l.rotation ? { y: box.y } : {}) }
      }
      editor.preview(updateLayers(editor.current.current, [l.id], values))
      return
    }
    if (g.kind === 'rotate') {
      const c = center(g.layer)
      const angle = (Math.atan2(p.y - c.y, p.x - c.x) * 180) / Math.PI
      let rotation = g.layer.rotation + angle - g.startAngle
      if (e.shiftKey) rotation = snapAngle(rotation)
      editor.preview(
        updateLayers(editor.current.current, [g.layer.id], { rotation: normalizeAngle(rotation) }),
      )
      return
    }
    if (g.kind === 'draw') {
      const sp = e.altKey ? p : snapPoint(p, g.targets)
      let r = normalizeRect(g.start, sp)
      if (e.shiftKey) {
        const side = Math.max(r.w, r.h)
        r = {
          x: sp.x < g.start.x ? g.start.x - side : g.start.x,
          y: sp.y < g.start.y ? g.start.y - side : g.start.y,
          w: side,
          h: side,
        }
      }
      editor.preview(
        updateLayers(editor.current.current, [g.id], {
          x: r.x,
          y: r.y,
          w: Math.max(1, r.w),
          h: Math.max(1, r.h),
        }),
      )
      return
    }
    if (g.kind === 'crop-pan') {
      const l = g.layer
      const a = toLocal(g.start, l),
        b = toLocal(p, l)
      const f = fullImageLocal(l)
      const dx = (b.x - a.x) * (l.flipX ? -1 : 1),
        dy = (b.y - a.y) * (l.flipY ? -1 : 1)
      const crop = clampCrop(
        { ...l.crop, x: l.crop.x - dx / f.sx, y: l.crop.y - dy / f.sy },
        l.naturalW,
        l.naturalH,
      )
      editor.preview(updateLayers(editor.current.current, [l.id], { crop } as Partial<Layer>))
      return
    }
    if (g.kind === 'crop-resize') {
      const l = g.layer
      const f = fullImageLocal(l)
      // Image rectangle as seen in the box's (flipped) local frame.
      const fv = {
        x: l.flipX ? l.w - (f.x + f.w) : f.x,
        y: l.flipY ? l.h - (f.y + f.h) : f.y,
        w: f.w,
        h: f.h,
      }
      const q = toLocal(p, l)
      let left = 0,
        top = 0,
        right = l.w,
        bottom = l.h
      const min = 8 / view.zoom
      if (g.handle.includes('w')) left = Math.min(right - min, Math.max(fv.x, q.x))
      if (g.handle.includes('e')) right = Math.max(left + min, Math.min(fv.x + fv.w, q.x))
      if (g.handle.includes('n')) top = Math.min(bottom - min, Math.max(fv.y, q.y))
      if (g.handle.includes('s')) bottom = Math.max(top + min, Math.min(fv.y + fv.h, q.y))
      const ratio = cropRatio ?? (e.shiftKey ? l.w / l.h : null)
      if (ratio) {
        let w = right - left,
          h = bottom - top
        if (g.handle === 'n' || g.handle === 's') w = h * ratio
        else if (g.handle === 'e' || g.handle === 'w') h = w / ratio
        else if (w / h > ratio) h = w / ratio
        else w = h * ratio
        // Stay inside the image.
        const maxW = g.handle.includes('w') ? right - fv.x : fv.x + fv.w - left
        const maxH = g.handle.includes('n') ? bottom - fv.y : fv.y + fv.h - top
        const k = Math.min(1, maxW / w, maxH / h)
        w *= k
        h *= k
        if (g.handle.includes('w')) left = right - w
        else right = left + w
        if (g.handle.includes('n')) top = bottom - h
        else bottom = top + h
      }
      const box = applyLocalBox(l, left, top, right, bottom)
      const cx = l.flipX ? fv.x + fv.w - right : left - fv.x
      const cy = l.flipY ? fv.y + fv.h - bottom : top - fv.y
      const crop = clampCrop(
        { x: cx / f.sx, y: cy / f.sy, w: (right - left) / f.sx, h: (bottom - top) / f.sy },
        l.naturalW,
        l.naturalH,
      )
      editor.preview(
        updateLayers(editor.current.current, [l.id], { ...box, crop } as Partial<Layer>),
      )
    }
  }

  const onPointerUp = () => {
    const g = gesture.current
    gesture.current = null
    setGuides([])
    setMarquee(null)
    setPanning(false)
    if (!g) return
    if (g.kind === 'move') {
      const target = frameTarget
      setFrameTarget(null)
      if (g.moved && target && g.layers.length === 1) {
        editor.cancel()
        props.onDropIntoFrame(g.layers[0].id, target)
      } else if (g.moved) editor.end()
      else if (g.narrowTo) onSelect([g.narrowTo])
    }
    if (g.kind === 'draw') {
      const l = editor.current.current.layers.find((x) => x.id === g.id)
      if (l && l.w < 4 && l.h < 4) {
        // A click places a default-size shape.
        const d = createShape(doc, l.kind as ShapeKind)
        editor.preview(
          updateLayers(editor.current.current, [g.id], {
            x: g.start.x - d.w / 2,
            y: g.start.y - d.h / 2,
            w: d.w,
            h: d.h,
          }),
        )
      }
      editor.end()
      onTool('select')
    }
    if (
      g.kind === 'resize' ||
      g.kind === 'rotate' ||
      g.kind === 'crop-pan' ||
      g.kind === 'crop-resize'
    )
      editor.end()
  }

  const startHandle = (e: ReactPointerEvent, handle: Handle | 'rotate') => {
    if (!single || single.locked) return
    e.stopPropagation()
    e.preventDefault()
    editor.begin()
    if (handle === 'rotate') {
      const c = center(single)
      const p = toDoc(e.clientX, e.clientY)
      gesture.current = {
        kind: 'rotate',
        layer: single,
        startAngle: (Math.atan2(p.y - c.y, p.x - c.x) * 180) / Math.PI,
      }
    } else if (cropLayer) gesture.current = { kind: 'crop-resize', handle, layer: cropLayer }
    else
      gesture.current = {
        kind: 'resize',
        handle,
        layer: single,
        targets: targetsExcluding([single.id]),
      }
    capture(e)
  }

  const onDoubleClick = (e: React.MouseEvent) => {
    if (tool !== 'select' || cropLayer) return
    const p = toDoc(e.clientX, e.clientY)
    const hit = hitAt(p)
    if (!hit) return
    if (isFrame(hit)) {
      // Double-click a frame: reach in to the picture (or ask for one).
      const inner = hitAt(p, false, true)
      if (inner && inner.id !== hit.id) onSelect([inner.id])
      else props.onFillFrame(hit.id)
      return
    }
    onSelect([hit.id])
    if (hit.kind === 'image') props.onCrop(hit.id)
    if (hit.kind === 'text') props.onEditText(hit.id)
  }

  /* ---------- Overlay geometry ---------- */
  const boxStyle = (l: Pick<Layer, 'x' | 'y' | 'w' | 'h' | 'rotation'>): CSSProperties => {
    const c = toScreen(center(l))
    const w = l.w * view.zoom,
      h = l.h * view.zoom
    return {
      left: c.x - w / 2,
      top: c.y - h / 2,
      width: w,
      height: h,
      transform: `rotate(${l.rotation}deg)`,
    }
  }
  /** Selection-style outline that follows the real shape. */
  const outline = (l: Layer, className: string, key?: string) => {
    if (!isShape(l) || l.kind === 'rect')
      return <polygon key={key} className={className} points={polygon(l)} />
    const c = toScreen(center(l))
    const w = l.w * view.zoom,
      h = l.h * view.zoom
    const d = shapeD({ ...l, x: 0, y: 0, w, h, radius: l.radius * view.zoom })
    return (
      <path
        key={key}
        className={className}
        d={d}
        transform={`translate(${c.x} ${c.y}) rotate(${l.rotation}) scale(${l.flipX ? -1 : 1} ${l.flipY ? -1 : 1}) translate(${-w / 2} ${-h / 2})`}
      />
    )
  }
  const polygon = (l: Layer) =>
    corners(l)
      .map(toScreen)
      .map((p) => `${p.x},${p.y}`)
      .join(' ')

  const showHandles =
    single &&
    !single.locked &&
    !editingId &&
    tool === 'select' &&
    !gesture.current?.kind.startsWith('move')
  const handles: Handle[] = cropLayer
    ? HANDLES
    : single?.kind === 'text'
      ? ['nw', 'ne', 'e', 'se', 'sw', 'w']
      : // A line has two ends; its thickness is set in the panel.
        single?.kind === 'line'
        ? ['e', 'w']
        : HANDLES
  const multiRect = selected.length > 1 ? unionBounds(selected) : null
  const maskBase = single?.clip ? maskBaseOf(doc.layers, single.id) : null
  const cursor = panning
    ? 'grabbing'
    : tool === 'hand' || props.spaceHeld
      ? 'grab'
      : tool === 'text'
        ? 'text'
        : tool === 'rect' || tool === 'ellipse'
          ? 'crosshair'
          : cropLayer
            ? 'move'
            : 'default'

  const artTop = toScreen({ x: 0, y: 0 })

  return (
    <div
      ref={stage}
      className={`stage dz-stage ${dropping ? 'is-dropping' : ''}`}
      style={{ cursor }}
      tabIndex={-1}
      aria-label="Artboard"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onPointerLeave={() => setHover(null)}
      onDoubleClick={onDoubleClick}
      onContextMenu={(e) => {
        e.preventDefault()
        const p = toDoc(e.clientX, e.clientY)
        const hit = hitAt(p, true)
        if (hit && !selection.includes(hit.id)) onSelect([hit.id])
        props.onContextMenu({ x: e.clientX, y: e.clientY }, hit?.id ?? null)
      }}
      onDragOver={(e) => {
        if (!Array.from(e.dataTransfer.types).includes('Files')) return
        e.preventDefault()
        e.dataTransfer.dropEffect = 'copy'
        if (!dropping) setDropping(true)
        const f = frameAt(toDoc(e.clientX, e.clientY))?.id ?? null
        if (f !== frameTarget) setFrameTarget(f)
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
          setDropping(false)
          setFrameTarget(null)
        }
      }}
      onDrop={(e) => {
        e.preventDefault()
        setDropping(false)
        const files = Array.from(e.dataTransfer.files)
        const at = toDoc(e.clientX, e.clientY)
        setFrameTarget(null)
        if (files.length) props.onDropFiles(files, at, frameAt(at)?.id ?? null)
      }}
    >
      <canvas ref={canvas} className="dz-canvas" aria-hidden="true" />
      <div
        className={`dz-artboard-label ${props.neighbors ? 'is-active' : ''}`}
        style={{ left: artTop.x, top: artTop.y, maxWidth: Math.max(48, doc.width * view.zoom) }}
        aria-hidden="true"
      >
        {doc.name}{' '}
        <span>
          {doc.width} × {doc.height}
        </span>
      </div>
      {props.neighbors?.map((n) => {
        const at = toScreen({ x: n.x, y: n.y })
        return (
          <button
            key={n.id}
            className="dz-artboard-label is-neighbor"
            style={{ left: at.x, top: at.y, maxWidth: Math.max(48, n.doc.width * view.zoom) }}
            title={`Edit ${n.doc.name}`}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => props.onActivate?.(n.id, null)}
          >
            {n.doc.name}{' '}
            <span>
              {n.doc.width} × {n.doc.height}
            </span>
          </button>
        )
      })}

      {cropLayer && (
        <CropGhost
          layer={cropLayer}
          style={boxStyle(cropLayer)}
          src={doc.assets[cropLayer.asset]}
          zoom={view.zoom}
        />
      )}

      <svg className="dz-overlay" width={size.width} height={size.height} aria-hidden="true">
        {hover &&
          !selection.includes(hover) &&
          !gesture.current &&
          (() => {
            const l = doc.layers.find((x) => x.id === hover)
            return l ? outline(l, 'dz-hover') : null
          })()}
        {maskBase && outline(maskBase, 'dz-mask-outline')}
        {single && isFrame(single) && outline(single, 'dz-selected')}
        {selected.length > 1 && selected.map((l) => outline(l, 'dz-selected', l.id))}
        {frameTarget &&
          (() => {
            const f = doc.layers.find((l) => l.id === frameTarget)
            return f ? outline(f, 'dz-frame-target') : null
          })()}
        {multiRect && (
          <rect
            className="dz-selected"
            x={toScreen(multiRect).x}
            y={toScreen(multiRect).y}
            width={multiRect.w * view.zoom}
            height={multiRect.h * view.zoom}
          />
        )}
        {guides.map((g, i) => {
          const a = toScreen(g.axis === 'x' ? { x: g.pos, y: g.from } : { x: g.from, y: g.pos })
          const b = toScreen(g.axis === 'x' ? { x: g.pos, y: g.to } : { x: g.to, y: g.pos })
          return <line key={i} className="dz-guide" x1={a.x} y1={a.y} x2={b.x} y2={b.y} />
        })}
        {marquee && (
          <rect
            className="dz-marquee"
            x={toScreen(marquee).x}
            y={toScreen(marquee).y}
            width={marquee.w * view.zoom}
            height={marquee.h * view.zoom}
          />
        )}
      </svg>

      {single && !editingId && (
        <div
          className={`dz-transform ${single.locked ? 'is-locked' : ''} ${cropLayer ? 'is-crop' : ''}`}
          style={boxStyle(single)}
          aria-hidden="true"
        >
          {single.locked && !cropLayer && (
            // The same badge as the Chyron editor's locked layers.
            <span className="composition-lock-badge">
              <Lock size={12} aria-hidden="true" /> Locked
            </span>
          )}
          {cropLayer && (
            <>
              <i className="dz-crop-third v1" />
              <i className="dz-crop-third v2" />
              <i className="dz-crop-third h1" />
              <i className="dz-crop-third h2" />
            </>
          )}
          {showHandles &&
            handles.map((h) => (
              <span
                key={h}
                className={`dz-handle h-${h} ${cropLayer ? 'is-crop' : ''}`}
                style={{ cursor: handleCursor(h, single.rotation) }}
                onPointerDown={(e) => startHandle(e, h)}
              />
            ))}
          {showHandles && !cropLayer && (
            <span
              className="dz-rotate"
              title="Rotate (Shift snaps to 15°)"
              onPointerDown={(e) => startHandle(e, 'rotate')}
            />
          )}
          {gesture.current?.kind === 'resize' || gesture.current?.kind === 'crop-resize' ? (
            <span className="dz-size-badge">
              {Math.round(single.w)} × {Math.round(single.h)}
            </span>
          ) : gesture.current?.kind === 'rotate' ? (
            <span className="dz-size-badge">{Math.round(single.rotation)}°</span>
          ) : null}
        </div>
      )}

      {editingLayer && (
        <TextEditor
          key={editingLayer.id}
          layer={editingLayer}
          style={boxStyle(editingLayer)}
          zoom={view.zoom}
          editor={editor}
          onDone={() => props.onEditText(null)}
        />
      )}

      {dropping && (
        <div className="drop-overlay" aria-hidden="true">
          <ImagePlus size={28} /> Drop to add images
        </div>
      )}
    </div>
  )
}

function CropGhost({
  layer,
  style,
  src,
  zoom,
}: {
  layer: ImageLayer
  style: CSSProperties
  src?: string
  zoom: number
}) {
  const f = fullImageLocal(layer)
  return (
    <div className="dz-crop-ghost" style={style} aria-hidden="true">
      <div
        className="dz-crop-flip"
        style={{ transform: `scale(${layer.flipX ? -1 : 1}, ${layer.flipY ? -1 : 1})` }}
      >
        {src && (
          <img
            src={src}
            alt=""
            draggable={false}
            style={{ left: f.x * zoom, top: f.y * zoom, width: f.w * zoom, height: f.h * zoom }}
          />
        )}
      </div>
    </div>
  )
}

function TextEditor({
  layer,
  style,
  zoom,
  editor,
  onDone,
}: {
  layer: TextLayer
  style: CSSProperties
  zoom: number
  editor: DesignEditor
  onDone: () => void
}) {
  const ref = useRef<HTMLTextAreaElement>(null)
  useEffect(() => {
    editor.begin()
    const el = ref.current
    if (el) {
      el.focus()
      el.select()
    }
    return () => editor.end()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const lineH = layer.size * layer.lineHeight * zoom
  return (
    <textarea
      ref={ref}
      className="dz-text-editor"
      aria-label="Edit text"
      spellCheck={false}
      value={layer.text}
      style={{
        ...style,
        height: Math.max(lineH, layer.h * zoom),
        font: fontString({ ...layer, size: layer.size * zoom }),
        lineHeight: `${lineH}px`,
        letterSpacing: `${layer.letterSpacing * zoom}px`,
        textAlign: layer.align,
        color: layer.color,
        textTransform: layer.uppercase ? 'uppercase' : 'none',
        transform: `${style.transform} scale(${layer.flipX ? -1 : 1}, ${layer.flipY ? -1 : 1})`,
      }}
      onPointerDown={(e) => e.stopPropagation()}
      onChange={(e) =>
        editor.preview(updateLayers(editor.current.current, [layer.id], { text: e.target.value }))
      }
      onKeyDown={(e) => {
        e.stopPropagation()
        if (e.key === 'Escape' || (e.key === 'Enter' && (e.metaKey || e.ctrlKey))) {
          e.preventDefault()
          onDone()
        }
      }}
      onBlur={onDone}
    />
  )
}
