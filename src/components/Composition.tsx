import {
  memo,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from 'react'
import { Check, Lock, LoaderCircle, RotateCcw, X } from 'lucide-react'
import { chyronBounds, imageBounds, renderComposition } from '../studio/renderer'
import {
  chyronProject,
  isElement,
  styleOf,
  type ChyronLayer,
  type ChyronStyle,
  type ElementLayer,
  type ImageLayer,
  type Layer,
  type Project,
} from '../studio/model'
import { useProjectImages } from '../studio/useImages'
import { useScenes } from '../studio/useScenes'
import {
  cropOf,
  cropToRatio,
  FULL_CROP,
  keepCropRatio,
  SQUARE_MASKS,
  panCrop,
  resizeCrop,
  sourceAspectOf,
  withCrop,
  type CropHandle,
} from '../studio/crop'
import type { ImageMap } from '../studio/assets'
import {
  CORNERS,
  isPointInChyron,
  rotateChyron,
  scaleChyron,
  scaleImage,
  boundsPercent,
  layerSnapTargets,
  snapImagePosition,
  snapPosition,
  type SnapGuide,
  type SnapLine,
  type SnapTargets,
  type Corner,
  type Point,
  type SnapState,
} from '../studio/transform'

type Side = 'n' | 's' | 'e' | 'w'
type Action = 'move' | 'rotate' | Corner | Side
const SIDES: Side[] = ['n', 'e', 's', 'w']
type Gesture = {
  id: number
  action: Action
  target: string
  start: Point
  /** The chyron's style when the gesture began. */
  style: ChyronStyle | null
  layer: ElementLayer | null
  rect: DOMRect
  targets: SnapTargets
}
type Box = { cx: number; cy: number; width: number; height: number; rotation: number }

export const Composition = memo(function Composition({
  project,
  time,
  thumbnail = false,
  onChyronChange,
  onLayerChange,
  selected = null,
  onSelect,
  cropping = false,
  onCropChange,
  onEditText,
  onLayerMenu,
}: {
  project: Project
  time: number
  thumbnail?: boolean
  /** Placement changes of a chyron (its x, y, scale and rotation). */
  onChyronChange?: (id: string, values: Partial<ChyronStyle>) => void
  /** Placement changes of an image or shape. */
  onLayerChange?: (id: string, values: Partial<ElementLayer>) => void
  /** Selected layer id. */
  selected?: string | null
  onSelect?: (id: string | null) => void
  /** The selected image is being cropped. */
  cropping?: boolean
  onCropChange?: (id: string | null) => void
  /** Double-clicking a chyron edits its words. */
  onEditText?: (id: string) => void
  /** Right-clicking a layer opens its actions at the pointer. */
  onLayerMenu?: (id: string, at: { x: number; y: number }) => void
}) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const drag = useRef<Gesture | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [hovering, setHovering] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [activeSnap, setActiveSnap] = useState<SnapState>({ x: null, y: null })
  const images = useProjectImages(project)
  const { scenes, ready, error } = useScenes(project, attempt)

  /** Where each visible layer sits on the canvas, in composition pixels. */
  const boxes = useMemo(() => {
    const map = new Map<string, Box>()
    for (const l of project.layers) {
      if (l.kind === 'chyron') {
        const scene = scenes.get(l.id)
        if (scene) map.set(l.id, chyronBounds(scene, chyronProject(project, l)))
      } else if (l.kind === 'shape' || l.kind === 'text' || images.has(l.assetId))
        map.set(l.id, imageBounds(l, project))
    }
    return map
  }, [project, scenes, images])
  const interactive = !thumbnail && !!onLayerChange && !!onChyronChange && ready
  const selectedLayer = project.layers.find((l) => l.id === selected)
  const selectedElement = selectedLayer && isElement(selectedLayer) ? selectedLayer : undefined
  const selectedImage = selectedElement?.kind === 'image' ? selectedElement : undefined
  const isLine = selectedElement?.kind === 'shape' && selectedElement.shape === 'line'
  // Lines and text boxes only get longer or shorter, wider or narrower, from the sides.
  const sidesOnly = isLine || selectedElement?.kind === 'text'
  const selectedStyle =
    selectedLayer?.kind === 'chyron' ? styleOf(project, selectedLayer) : undefined
  const selectedBox: Box | null =
    selectedLayer?.visible && boxes.has(selectedLayer.id) ? boxes.get(selectedLayer.id)! : null
  const boxPosition = selectedElement
    ? { x: selectedElement.x, y: selectedElement.y }
    : { x: selectedStyle?.x ?? project.x, y: selectedStyle?.y ?? project.y }

  useEffect(() => {
    const node = canvas.current
    if (!node || !ready) return
    const draw = () => {
      const width = Math.min(
        project.width,
        Math.round(node.clientWidth * Math.min(window.devicePixelRatio || 1, 2)),
      )
      if (!width) return
      const height = Math.round((width * project.height) / project.width)
      if (node.width !== width || node.height !== height) {
        node.width = width
        node.height = height
      }
      const context = node.getContext('2d', { alpha: true })
      if (context) renderComposition(context, scenes, project, time, images)
    }
    draw()
    const observer = new ResizeObserver(draw)
    observer.observe(node)
    return () => observer.disconnect()
  }, [scenes, project, time, ready, images])

  const hittable = (l: Layer) =>
    l.visible && !l.locked && boxes.has(l.id) && (l.kind === 'chyron' || l.opacity > 0)
  /** Topmost visible layer under the pointer. */
  function hitTest(point: Point): string | null {
    if (!canvas.current) return null
    const rect = canvas.current.getBoundingClientRect()
    for (let i = project.layers.length - 1; i >= 0; i--) {
      const layer = project.layers[i]
      if (hittable(layer) && isPointInChyron(point, rect, project, boxes.get(layer.id)!))
        return layer.id
    }
    return null
  }

  /** Edges and centres of every other visible layer. */
  function snapTargetsExcept(id: string): SnapTargets {
    const list: { name: string; box: ReturnType<typeof boundsPercent> }[] = []
    for (const l of project.layers) {
      if (l.id === id || !l.visible || !boxes.has(l.id)) continue
      if (l.kind !== 'chyron' && l.opacity <= 0) continue
      list.push({ name: l.name, box: boundsPercent(boxes.get(l.id)!, project) })
    }
    return layerSnapTargets(list)
  }

  function begin(e: PointerEvent<HTMLElement>, action: Action, target = selected) {
    if (!interactive || !target || e.button !== 0 || drag.current || !canvas.current) return
    const layer = project.layers.find((l) => l.id === target)
    if (!layer) return
    e.preventDefault()
    e.stopPropagation()
    e.currentTarget.focus({ preventScroll: true })
    e.currentTarget.setPointerCapture(e.pointerId)
    setIsDragging(true)
    drag.current = {
      id: e.pointerId,
      action,
      target,
      start: { x: e.clientX, y: e.clientY },
      style: layer.kind === 'chyron' ? { ...styleOf(project, layer) } : null,
      layer: isElement(layer) ? { ...layer } : null,
      rect: canvas.current.getBoundingClientRect(),
      targets: snapTargetsExcept(target),
    }
  }

  function move(e: PointerEvent<HTMLElement>) {
    const start = drag.current
    if (!interactive || !start || start.id !== e.pointerId) return
    const { rect, layer, style } = start
    const delta = {
      x: ((e.clientX - start.start.x) / rect.width) * project.width,
      y: ((e.clientY - start.start.y) / rect.height) * project.height,
    }
    const pointer = { x: e.clientX, y: e.clientY }
    if (layer) {
      const center = {
        x: rect.left + (rect.width * layer.x) / 100,
        y: rect.top + (rect.height * layer.y) / 100,
      }
      if (start.action === 'move') {
        const box = boundsPercent(imageBounds(layer, project), project)
        const { x, y, snap } = snapImagePosition(
          layer.x + (delta.x / project.width) * 100,
          layer.y + (delta.y / project.height) * 100,
          box.w,
          box.h,
          1.5,
          e.altKey ? { x: [], y: [] } : start.targets,
        )
        setActiveSnap(snap)
        onLayerChange?.(layer.id, { x, y })
      } else if (start.action === 'rotate') {
        onLayerChange?.(layer.id, {
          rotation: rotateChyron(layer.rotation, center, start.start, pointer, e.shiftKey),
        })
      } else if (SIDES.includes(start.action as Side)) {
        onLayerChange?.(layer.id, stretch(layer, start.action as Side, delta, e.altKey))
      } else {
        const width = scaleImage(layer.width, center, start.start, pointer)
        // Text scales its letters with the box, like a picture.
        onLayerChange?.(layer.id, {
          width,
          ...(layer.kind === 'text'
            ? { size: Math.round(((layer.size * width) / layer.width) * 100) / 100 }
            : {}),
        })
      }
      return
    }
    if (!style) return
    const box = boxes.get(start.target)
    const view = { ...project, ...style }
    if (start.action === 'move' && box) {
      const rawX = style.x + (delta.x / project.width) * 100
      const rawY = style.y + (delta.y / project.height) * 100
      let { x, y, snap } = snapPosition(rawX, rawY, view, box)
      if (e.altKey) {
        x = Math.round(Math.min(90, Math.max(10, rawX)) * 10) / 10
        y = Math.round(Math.min(90, Math.max(10, rawY)) * 10) / 10
        snap = { x: null, y: null }
      } else {
        // No safe-area line nearby: line up with the other layers instead.
        const b = boundsPercent(box, project)
        const near = snapImagePosition(rawX, rawY, b.w, b.h, 1.5, start.targets)
        const fromLayer = (guide: SnapGuide | null, lines: SnapLine[]) =>
          !!guide && lines.some((line) => line.label === guide.label)
        if (!snap.x && fromLayer(near.snap.x, start.targets.x)) {
          x = near.x
          snap = { ...snap, x: near.snap.x }
        }
        if (!snap.y && fromLayer(near.snap.y, start.targets.y)) {
          y = near.y
          snap = { ...snap, y: near.snap.y }
        }
      }
      setActiveSnap(snap)
      onChyronChange!(start.target, { x, y })
    } else if (start.action === 'rotate') {
      const center = {
        x: rect.left + (rect.width * style.x) / 100,
        y: rect.top + (rect.height * style.y) / 100,
      }
      onChyronChange!(start.target, {
        compositionRotation: rotateChyron(
          style.compositionRotation,
          center,
          start.start,
          pointer,
          e.shiftKey,
        ),
      })
    } else if (CORNERS.includes(start.action as Corner)) {
      onChyronChange!(start.target, {
        scale: scaleChyron(style.scale, rect, view, start.start, pointer),
      })
    }
  }

  /** Width and height from a side handle; the opposite side stays put unless Alt is held. */
  function stretch(l: ElementLayer, side: Side, delta: Point, centered: boolean) {
    const a = (-l.rotation * Math.PI) / 180
    // Pointer travel in the layer's own frame, in composition pixels.
    const lx = delta.x * Math.cos(a) - delta.y * Math.sin(a)
    const ly = delta.x * Math.sin(a) + delta.y * Math.cos(a)
    const w0 = (l.width / 100) * project.width
    const h0 = w0 * l.aspect
    const k = centered ? 2 : 1
    let w = w0,
      h = h0,
      ox = 0,
      oy = 0
    if (side === 'e' || side === 'w') {
      const d = (side === 'e' ? lx : -lx) * k
      w = Math.max(4, w0 + d)
      if (!centered) ox = ((w - w0) / 2) * (side === 'e' ? 1 : -1)
    } else {
      const d = (side === 's' ? ly : -ly) * k
      h = Math.max(4, h0 + d)
      if (!centered) oy = ((h - h0) / 2) * (side === 's' ? 1 : -1)
    }
    const r = (l.rotation * Math.PI) / 180
    const dx = ox * Math.cos(r) - oy * Math.sin(r)
    const dy = ox * Math.sin(r) + oy * Math.cos(r)
    const round = (v: number) => Math.round(v * 100) / 100
    const width = Math.min(400, Math.max(2, (w / project.width) * 100))
    // A text box only gets wider or narrower; its lines decide its height.
    if (l.kind === 'text')
      return {
        width: round(width),
        x: round(l.x + (dx / project.width) * 100),
        y: round(l.y + (dy / project.height) * 100),
      }
    return {
      width: round(width),
      aspect: Math.min(100, Math.max(0.01, h / ((width / 100) * project.width))),
      x: round(l.x + (dx / project.width) * 100),
      y: round(l.y + (dy / project.height) * 100),
    }
  }

  function end(e: PointerEvent<HTMLElement>) {
    if (drag.current?.id !== e.pointerId) return
    drag.current = null
    setIsDragging(false)
    setActiveSnap({ x: null, y: null })
    if (e.currentTarget.hasPointerCapture(e.pointerId))
      e.currentTarget.releasePointerCapture(e.pointerId)
  }

  function keydown(e: KeyboardEvent<HTMLElement>, action: Action) {
    if (!interactive) return
    if (e.key === 'Escape') {
      const gesture = drag.current
      if (gesture) {
        if (gesture.layer) onLayerChange?.(gesture.layer.id, gesture.layer)
        else if (gesture.style) onChyronChange!(gesture.target, gesture.style)
        drag.current = null
        setIsDragging(false)
        setActiveSnap({ x: null, y: null })
      }
      onSelect?.(null)
      e.preventDefault()
      e.stopPropagation()
      return
    }
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key) || !selectedLayer)
      return
    e.preventDefault()
    e.stopPropagation()
    const dx = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0
    const dy = e.key === 'ArrowDown' ? 1 : e.key === 'ArrowUp' ? -1 : 0
    const direction = e.key === 'ArrowRight' || e.key === 'ArrowUp' ? 1 : -1
    const round = (v: number) => Math.round(v * 10) / 10
    if (selectedElement) {
      const l = selectedElement
      if (action === 'move') {
        const step = e.shiftKey ? 2 : 0.5
        onLayerChange?.(l.id, {
          x: round(Math.min(150, Math.max(-50, l.x + dx * step))),
          y: round(Math.min(150, Math.max(-50, l.y + dy * step))),
        })
      } else if (action === 'rotate') {
        onLayerChange?.(l.id, {
          rotation: Math.min(180, Math.max(-180, l.rotation + direction * (e.shiftKey ? 15 : 1))),
        })
      } else {
        onLayerChange?.(l.id, {
          width: round(Math.min(400, Math.max(2, l.width + direction * (e.shiftKey ? 5 : 1)))),
        })
      }
      return
    }
    const style = selectedStyle
    if (!style) return
    const id = selectedLayer.id
    if (action === 'move') {
      const step = e.shiftKey ? 2 : 0.5
      onChyronChange!(id, {
        x: round(Math.min(95, Math.max(5, style.x + dx * step))),
        y: round(Math.min(95, Math.max(5, style.y + dy * step))),
      })
    } else if (action === 'rotate') {
      onChyronChange!(id, {
        compositionRotation: Math.min(
          180,
          Math.max(-180, style.compositionRotation + direction * (e.shiftKey ? 15 : 1)),
        ),
      })
    } else {
      onChyronChange!(id, {
        scale: Math.min(150, Math.max(20, style.scale + direction * (e.shiftKey ? 10 : 2))),
      })
    }
  }

  function canvasPointerDown(e: PointerEvent<HTMLCanvasElement>) {
    if (!interactive || e.button !== 0 || drag.current) return
    if (cropping) {
      // Clicking outside the crop frame applies it.
      onCropChange?.(null)
      return
    }
    const hit = hitTest({ x: e.clientX, y: e.clientY })
    if (hit) {
      if (hit !== selected) onSelect?.(hit)
      begin(e, 'move', hit)
    } else if (selected) onSelect?.(null)
  }

  function canvasPointerMove(e: PointerEvent<HTMLCanvasElement>) {
    if (drag.current) {
      move(e)
      return
    }
    const over = interactive && !!hitTest({ x: e.clientX, y: e.clientY })
    if (over !== hovering) setHovering(over)
  }

  const pointerEvents = {
    onPointerMove: move,
    onPointerUp: end,
    onPointerCancel: end,
    onLostPointerCapture: end,
  }

  // Spoken summary: the words of every visible chyron, then how many other layers.
  const words = project.layers
    .filter((l): l is ChyronLayer => l.kind === 'chyron' && l.visible)
    .map((l) => {
      const s = styleOf(project, l)
      return [s.text.replace(/\n/g, ' '), s.subtitlePill ? s.subtitle : '']
        .filter(Boolean)
        .join(' ')
    })
  const targetName = selectedLayer?.name ?? 'layer'
  const showControls = !!selectedBox
  const locked = !!selectedLayer?.locked
  const cropLayer = cropping && selectedImage?.visible ? selectedImage : null
  const others = project.layers.filter((l) => l.kind !== 'chyron').length

  return (
    <div
      className={`composition ${thumbnail ? 'thumbnail-composition' : ''}`}
      style={{ aspectRatio: `${project.width}/${project.height}` }}
    >
      <canvas
        ref={canvas}
        aria-label={
          thumbnail
            ? undefined
            : `Composition preview: ${words.join('. ') || 'empty'}.${others > 0 ? ` ${others} more layer${others > 1 ? 's' : ''}.` : ''}`
        }
        role={thumbnail ? undefined : 'img'}
        title={
          interactive
            ? showControls
              ? 'Drag to move (snaps to center and edges) · Corners to scale · Click empty space to deselect'
              : 'Click a layer to move, scale & rotate it'
            : undefined
        }
        className={`${interactive ? 'is-interactive' : ''} ${showControls ? 'has-controls' : ''} ${hovering ? 'hovering-chyron' : ''} ${isDragging ? 'is-dragging' : ''}`}
        style={{ opacity: ready ? 1 : 0 }}
        tabIndex={interactive ? 0 : undefined}
        onPointerDown={canvasPointerDown}
        onPointerMove={canvasPointerMove}
        onPointerLeave={() => !drag.current && hovering && setHovering(false)}
        onPointerUp={end}
        onPointerCancel={end}
        onLostPointerCapture={end}
        onKeyDown={(e) => keydown(e, 'move')}
        onDoubleClick={(e) => {
          if (!interactive || cropping) return
          const hit = hitTest({ x: e.clientX, y: e.clientY })
          const layer = project.layers.find((l) => l.id === hit)
          if (!layer) return
          onSelect?.(layer.id)
          if (layer.kind === 'image') onCropChange?.(layer.id)
          else if (layer.kind === 'chyron' || layer.kind === 'text') onEditText?.(layer.id)
        }}
        onContextMenu={(e) => {
          if (!interactive || cropping || !onLayerMenu) return
          const hit = hitTest({ x: e.clientX, y: e.clientY })
          if (!hit) return
          e.preventDefault()
          onLayerMenu(hit, { x: e.clientX, y: e.clientY })
        }}
      />
      {interactive && isDragging && activeSnap.x && (
        <>
          <div
            className="composition-snap-line vertical"
            style={{ left: `${activeSnap.x.position}%` }}
          />
          <div
            className="composition-snap-badge"
            style={{ left: `${Math.min(88, Math.max(12, activeSnap.x.position))}%`, top: '24px' }}
          >
            {activeSnap.x.label}
          </div>
        </>
      )}
      {interactive && isDragging && activeSnap.y && (
        <>
          <div
            className="composition-snap-line horizontal"
            style={{ top: `${activeSnap.y.position}%` }}
          />
          <div
            className="composition-snap-badge"
            style={{ left: '60px', top: `${Math.min(94, Math.max(6, activeSnap.y.position))}%` }}
          >
            {activeSnap.y.label}
          </div>
        </>
      )}
      {interactive && cropLayer && (
        <CropOverlay
          layer={cropLayer}
          project={project}
          canvas={canvas}
          images={images}
          onChange={(values) => onLayerChange?.(cropLayer.id, values)}
          onDone={() => onCropChange?.(null)}
        />
      )}
      {interactive && selectedBox && !cropLayer && locked && (
        <div
          className="composition-transform-box si-transform-box is-locked"
          aria-label={`${targetName} is locked`}
          style={{
            left: `${boxPosition.x}%`,
            top: `${boxPosition.y}%`,
            width: `${(selectedBox.width / project.width) * 100}%`,
            height: `${(selectedBox.height / project.height) * 100}%`,
            transform: `translate(-50%, -50%) rotate(${selectedBox.rotation}deg)`,
          }}
        >
          <span className="composition-lock-badge">
            <Lock size={12} aria-hidden="true" /> Locked
          </span>
        </div>
      )}
      {interactive && selectedBox && !cropLayer && !locked && (
        <div
          className={`composition-transform-box si-transform-box ${selectedElement ? 'is-image' : ''}`}
          role="group"
          aria-label={`${targetName} transform controls`}
          style={{
            left: `${boxPosition.x}%`,
            top: `${boxPosition.y}%`,
            width: `${(selectedBox.width / project.width) * 100}%`,
            height: `${(selectedBox.height / project.height) * 100}%`,
            transform: `translate(-50%, -50%) rotate(${selectedBox.rotation}deg)`,
          }}
        >
          {/* A line has two ends (as in the Designer); its thickness is set in the panel. */}
          {!isLine &&
            CORNERS.map((corner) => (
              <button
                key={corner}
                className={`si-transform-handle si-resize-handle ${corner}`}
                aria-label={`Scale ${targetName} from ${corner.replace('-', ' ')}`}
                title="Drag to scale · Arrow keys adjust size · Shift for larger steps"
                onPointerDown={(e) => begin(e, corner)}
                onKeyDown={(e) => keydown(e, corner)}
                {...pointerEvents}
              >
                <span />
              </button>
            ))}
          {(selectedElement?.kind === 'shape' || selectedElement?.kind === 'text') &&
            SIDES.filter((side) => !sidesOnly || side === 'e' || side === 'w').map((side) => (
              <button
                key={side}
                className={`si-transform-handle si-side-handle side-${side}`}
                aria-label={`Stretch ${targetName} from the ${{ n: 'top', s: 'bottom', e: 'right', w: 'left' }[side]}`}
                title="Drag to stretch · Alt from the centre"
                tabIndex={-1}
                onPointerDown={(e) => begin(e, side)}
                {...pointerEvents}
              >
                <span />
              </button>
            ))}
          <button
            className="si-transform-handle si-rotate-handle"
            aria-label={`Rotate ${targetName}`}
            title="Drag to rotate · Shift snaps to 15° · Arrow keys adjust angle"
            onPointerDown={(e) => begin(e, 'rotate')}
            onKeyDown={(e) => keydown(e, 'rotate')}
            {...pointerEvents}
          >
            <span />
          </button>
        </div>
      )}
      {!thumbnail && !ready && !error && (
        <div className="canvas-message">
          <LoaderCircle className="spin" size={20} /> Preparing your canvas
        </div>
      )}
      {!thumbnail && error && (
        <div className="canvas-message">
          <span>{error}</span>
          <button className="button outline sm" onClick={() => setAttempt((n) => n + 1)}>
            <RotateCcw size={14} /> Retry
          </button>
        </div>
      )}
    </div>
  )
})

const CROP_HANDLES: CropHandle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']
const CROP_RATIOS: { label: string; title: string; ratio: number | null }[] = [
  { label: '1:1', title: 'Square', ratio: 1 },
  { label: '4:5', title: 'Portrait 4:5', ratio: 4 / 5 },
  { label: '16:9', title: 'Wide 16:9', ratio: 16 / 9 },
  { label: 'Full', title: 'Whole image', ratio: null },
]
type CropValues = Partial<ImageLayer>

/**
 * Crop mode for an image layer: the whole picture shows dimmed behind the
 * frame; drag the handles to frame it, drag inside to move the picture.
 * Enter or Done applies, Escape or Cancel restores where it started.
 */
function CropOverlay({
  layer,
  project,
  canvas,
  images,
  onChange,
  onDone,
}: {
  layer: ImageLayer
  project: Project
  canvas: { readonly current: HTMLCanvasElement | null }
  images: ImageMap
  onChange: (values: CropValues) => void
  onDone: () => void
}) {
  const ghost = useRef<HTMLCanvasElement>(null)
  const start = useRef<{
    id: number
    handle: CropHandle | 'pan'
    x: number
    y: number
    layer: ImageLayer
  } | null>(null)
  // Where crop mode began, for Cancel.
  const [snapshot] = useState(() => ({
    crop: layer.crop,
    sourceAspect: layer.sourceAspect,
    aspect: layer.aspect,
    width: layer.width,
    x: layer.x,
    y: layer.y,
  }))
  const c = cropOf(layer)
  const image = images.get(layer.assetId)

  useEffect(() => {
    const el = ghost.current
    if (!el || !image) return
    const k = Math.min(1, 640 / Math.max(image.width, image.height))
    el.width = Math.max(1, Math.round(image.width * k))
    el.height = Math.max(1, Math.round(image.height * k))
    el.getContext('2d')?.drawImage(image, 0, 0, el.width, el.height)
  }, [image])

  useEffect(() => {
    const key = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        e.stopPropagation()
        onDone()
      } else if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        onChange(snapshot)
        onDone()
      }
    }
    window.addEventListener('keydown', key, true)
    return () => window.removeEventListener('keydown', key, true)
  }, [onChange, onDone, snapshot])

  const fullSize = (l: ImageLayer) => {
    const rect = canvas.current?.getBoundingClientRect()
    const s = rect ? rect.width / project.width : 1
    const boxW = (l.width / 100) * project.width * s
    const lc = cropOf(l)
    return { w: boxW / lc.w, h: (boxW * l.aspect) / lc.h }
  }
  const begin = (e: PointerEvent<HTMLElement>, handle: CropHandle | 'pan') => {
    if (e.button !== 0) return
    e.preventDefault()
    e.stopPropagation()
    e.currentTarget.setPointerCapture(e.pointerId)
    start.current = { id: e.pointerId, handle, x: e.clientX, y: e.clientY, layer: { ...layer } }
  }
  const move = (e: PointerEvent<HTMLElement>) => {
    const g = start.current
    if (!g || g.id !== e.pointerId) return
    // Screen delta in the picture's own (unrotated) frame.
    const a = (-g.layer.rotation * Math.PI) / 180
    const sx = e.clientX - g.x,
      sy = e.clientY - g.y
    const dx = sx * Math.cos(a) - sy * Math.sin(a)
    const dy = sx * Math.sin(a) + sy * Math.cos(a)
    const full = fullSize(g.layer)
    const c0 = cropOf(g.layer)
    if (g.handle === 'pan') {
      onChange({
        crop: panCrop(c0, dx, dy, full, g.layer.flipX),
        sourceAspect: sourceAspectOf(g.layer),
      })
      return
    }
    let next = resizeCrop(c0, g.handle, dx, dy, full, g.layer.flipX)
    // Round shapes keep their proportions; Shift keeps any crop's.
    if (SQUARE_MASKS.includes(g.layer.mask) || e.shiftKey)
      next = keepCropRatio(c0, next, g.handle, sourceAspectOf(g.layer))
    onChange(withCrop(g.layer, next, project))
  }
  const end = (e: PointerEvent<HTMLElement>) => {
    if (start.current?.id === e.pointerId) start.current = null
  }
  const events = { onPointerMove: move, onPointerUp: end, onPointerCancel: end }

  const box = imageBounds(layer, project)
  const style = {
    left: `${layer.x}%`,
    top: `${layer.y}%`,
    width: `${(box.width / project.width) * 100}%`,
    height: `${(box.height / project.height) * 100}%`,
    transform: `translate(-50%, -50%) rotate(${layer.rotation}deg)`,
  }
  return (
    <>
      <div
        className="composition-crop-box"
        style={style}
        role="group"
        aria-label={`Crop ${layer.name}`}
      >
        <div
          className="composition-crop-ghost"
          style={{ transform: layer.flipX ? 'scaleX(-1)' : undefined }}
        >
          <canvas
            ref={ghost}
            aria-hidden="true"
            style={{
              left: `${(-c.x / c.w) * 100}%`,
              top: `${(-c.y / c.h) * 100}%`,
              width: `${100 / c.w}%`,
              height: `${100 / c.h}%`,
            }}
          />
        </div>
        <div
          className="composition-crop-pan"
          title="Drag to move the picture"
          onPointerDown={(e) => begin(e, 'pan')}
          {...events}
        >
          <i className="third v1" />
          <i className="third v2" />
          <i className="third h1" />
          <i className="third h2" />
        </div>
        {CROP_HANDLES.map((h) => (
          <button
            key={h}
            className={`composition-crop-handle ${h}`}
            aria-label={`Crop from ${h}`}
            onPointerDown={(e) => begin(e, h)}
            {...events}
          />
        ))}
      </div>
      <div className="composition-crop-bar" role="toolbar" aria-label="Crop">
        {CROP_RATIOS.map(({ label, title, ratio }) => (
          <button
            key={label}
            title={title}
            aria-label={title}
            className="button ghost sm"
            onClick={() =>
              onChange(
                withCrop(layer, ratio === null ? FULL_CROP : cropToRatio(layer, ratio), project),
              )
            }
          >
            {label}
          </button>
        ))}
        <span className="composition-crop-sep" aria-hidden="true" />
        <button
          className="icon-button sm"
          aria-label="Cancel crop"
          title="Cancel (Esc)"
          onClick={() => {
            onChange(snapshot)
            onDone()
          }}
        >
          <X size={16} />
        </button>
        <button className="button primary sm" title="Apply (Enter)" onClick={onDone}>
          <Check size={14} aria-hidden="true" /> Done
        </button>
      </div>
    </>
  )
}
