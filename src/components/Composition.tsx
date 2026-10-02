import {
  memo,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from 'react'
import { Check, Lock, LoaderCircle, RotateCcw, RotateCw, X } from 'lucide-react'
import { loadFonts, type Fonts } from '../studio/fonts'
import { buildScene, chyronBounds, imageBounds, renderComposition } from '../studio/renderer'
import { chyronLayer, type ImageLayer, type Project } from '../studio/model'
import { useProjectImages } from '../studio/useImages'
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
  type SnapTargets,
  type Corner,
  type Point,
  type SnapState,
} from '../studio/transform'

type Action = 'move' | 'rotate' | Corner
type Gesture = {
  id: number
  action: Action
  target: string
  start: Point
  project: Project
  layer: ImageLayer | null
  rect: DOMRect
  targets: SnapTargets
}
type Box = { cx: number; cy: number; width: number; height: number; rotation: number }

export const Composition = memo(function Composition({
  project,
  time,
  thumbnail = false,
  onTransform,
  onLayerChange,
  selected = null,
  onSelect,
  cropping = false,
  onCropChange,
}: {
  project: Project
  time: number
  thumbnail?: boolean
  /** Chyron placement changes. */
  onTransform?: (values: Partial<Project>) => void
  /** Image layer placement changes. */
  onLayerChange?: (id: string, values: Partial<ImageLayer>) => void
  /** Selected layer id ('chyron' or an image layer id). */
  selected?: string | null
  onSelect?: (id: string | null) => void
  /** The selected image is being cropped. */
  cropping?: boolean
  onCropChange?: (id: string | null) => void
}) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const drag = useRef<Gesture | null>(null)
  const [loaded, setLoaded] = useState<{ fonts: Fonts; name: string } | null>(null)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const [hovering, setHovering] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [activeSnap, setActiveSnap] = useState<SnapState>({ x: null, y: null })
  const images = useProjectImages(project)

  useEffect(() => {
    let disposed = false
    loadFonts(project.font)
      .then((fonts) => {
        if (!disposed) {
          setLoaded({ fonts, name: project.font })
          setError('')
        }
      })
      .catch((e) => {
        if (!disposed) setError(e instanceof Error ? e.message : 'Font could not be loaded.')
      })
    return () => {
      disposed = true
    }
  }, [project.font, attempt])

  const scene = useMemo(
    () => (loaded ? buildScene(project, loaded.fonts) : null),
    [loaded, project],
  )
  const chyron = chyronLayer(project)
  const bounds = useMemo(() => (scene ? chyronBounds(scene, project) : null), [scene, project])
  const interactive = !thumbnail && !!onTransform && !!bounds && !!scene
  const selectedImage =
    selected && selected !== 'chyron'
      ? (project.layers.find((l) => l.id === selected && l.kind === 'image') as
          ImageLayer | undefined)
      : undefined
  const selectedBox: Box | null =
    selected === 'chyron' && chyron.visible
      ? bounds
      : selectedImage?.visible
        ? imageBounds(selectedImage, project)
        : null
  const boxPosition = selectedImage
    ? { x: selectedImage.x, y: selectedImage.y }
    : { x: project.x, y: project.y }

  useEffect(() => {
    const node = canvas.current
    if (!node || !scene || loaded?.name !== project.font) return
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
      if (context) renderComposition(context, scene, project, time, images)
    }
    draw()
    const observer = new ResizeObserver(draw)
    observer.observe(node)
    return () => observer.disconnect()
  }, [scene, project, time, loaded, images])

  /** Topmost visible layer under the pointer. */
  function hitTest(point: Point): string | null {
    if (!canvas.current || !bounds) return null
    const rect = canvas.current.getBoundingClientRect()
    for (let i = project.layers.length - 1; i >= 0; i--) {
      const layer = project.layers[i]
      if (!layer.visible || layer.locked) continue
      if (layer.kind === 'chyron') {
        if (isPointInChyron(point, rect, project, bounds)) return 'chyron'
      } else if (images.has(layer.assetId) && layer.opacity > 0) {
        if (isPointInChyron(point, rect, project, imageBounds(layer, project))) return layer.id
      }
    }
    return null
  }

  /** Edges and centres of every other visible layer. */
  function snapTargetsExcept(id: string): SnapTargets {
    const boxes: { name: string; box: ReturnType<typeof boundsPercent> }[] = []
    for (const l of project.layers) {
      if (l.id === id || !l.visible) continue
      if (l.kind === 'chyron') {
        if (bounds) boxes.push({ name: 'Chyron', box: boundsPercent(bounds, project) })
      } else if (images.has(l.assetId) && l.opacity > 0)
        boxes.push({ name: l.name, box: boundsPercent(imageBounds(l, project), project) })
    }
    return layerSnapTargets(boxes)
  }

  function begin(e: PointerEvent<HTMLElement>, action: Action, target = selected) {
    if (!interactive || !target || e.button !== 0 || drag.current || !canvas.current) return
    e.preventDefault()
    e.stopPropagation()
    e.currentTarget.focus({ preventScroll: true })
    e.currentTarget.setPointerCapture(e.pointerId)
    setIsDragging(true)
    const layer =
      target === 'chyron'
        ? null
        : ((project.layers.find((l) => l.id === target) as ImageLayer | undefined) ?? null)
    drag.current = {
      id: e.pointerId,
      action,
      target,
      start: { x: e.clientX, y: e.clientY },
      project: { ...project },
      layer: layer && { ...layer },
      rect: canvas.current.getBoundingClientRect(),
      targets: snapTargetsExcept(target),
    }
  }

  function move(e: PointerEvent<HTMLElement>) {
    const start = drag.current
    if (!interactive || !start || start.id !== e.pointerId || !bounds) return
    const { rect, project: initial, layer } = start
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
      } else {
        onLayerChange?.(layer.id, {
          width: scaleImage(layer.width, center, start.start, pointer),
        })
      }
      return
    }
    if (start.action === 'move') {
      const rawX = initial.x + (delta.x / project.width) * 100
      const rawY = initial.y + (delta.y / project.height) * 100
      const { x, y, snap } = snapPosition(rawX, rawY, project, bounds)
      setActiveSnap(snap)
      onTransform!({ x, y })
    } else if (start.action === 'rotate') {
      const center = {
        x: rect.left + (rect.width * initial.x) / 100,
        y: rect.top + (rect.height * initial.y) / 100,
      }
      onTransform!({
        compositionRotation: rotateChyron(
          initial.compositionRotation,
          center,
          start.start,
          pointer,
          e.shiftKey,
        ),
      })
    } else {
      onTransform!({ scale: scaleChyron(initial.scale, rect, initial, start.start, pointer) })
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
        else onTransform!(gesture.project)
        drag.current = null
        setIsDragging(false)
        setActiveSnap({ x: null, y: null })
      }
      onSelect?.(null)
      e.preventDefault()
      e.stopPropagation()
      return
    }
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key) || !selected) return
    e.preventDefault()
    e.stopPropagation()
    const dx = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0
    const dy = e.key === 'ArrowDown' ? 1 : e.key === 'ArrowUp' ? -1 : 0
    const direction = e.key === 'ArrowRight' || e.key === 'ArrowUp' ? 1 : -1
    const round = (v: number) => Math.round(v * 10) / 10
    if (selectedImage) {
      const l = selectedImage
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
    if (action === 'move') {
      const step = e.shiftKey ? 2 : 0.5
      onTransform!({
        x: round(Math.min(95, Math.max(5, project.x + dx * step))),
        y: round(Math.min(95, Math.max(5, project.y + dy * step))),
      })
    } else if (action === 'rotate') {
      onTransform!({
        compositionRotation: Math.min(
          180,
          Math.max(-180, project.compositionRotation + direction * (e.shiftKey ? 15 : 1)),
        ),
      })
    } else {
      onTransform!({
        scale: Math.min(150, Math.max(20, project.scale + direction * (e.shiftKey ? 10 : 2))),
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

  const ready = loaded?.name === project.font
  const targetName = selectedImage ? selectedImage.name : 'chyron'
  const showControls = !!selectedBox
  const locked = !!(selectedImage ? selectedImage.locked : selected === 'chyron' && chyron.locked)
  const cropLayer = cropping && selectedImage?.visible ? selectedImage : null

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
            : `Composition preview: ${chyron.visible ? project.text.replace(/\n/g, ' ') : ''}.${chyron.visible && project.subtitlePill ? ` ${project.subtitle}` : ''}${project.layers.length > 1 ? ` ${project.layers.length - 1} image layer${project.layers.length > 2 ? 's' : ''}.` : ''}`
        }
        role={thumbnail ? undefined : 'img'}
        title={
          interactive
            ? showControls
              ? 'Drag to move (snaps to center and edges) · Corners to scale · Click empty space to deselect'
              : 'Click the chyron or an image to move, scale & rotate'
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
          if (hit && hit !== 'chyron') {
            onSelect?.(hit)
            onCropChange?.(hit)
          }
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
          className={`composition-transform-box si-transform-box ${selectedImage ? 'is-image' : ''}`}
          role="group"
          aria-label={`${selectedImage ? selectedImage.name : 'Chyron'} transform controls`}
          style={{
            left: `${boxPosition.x}%`,
            top: `${boxPosition.y}%`,
            width: `${(selectedBox.width / project.width) * 100}%`,
            height: `${(selectedBox.height / project.height) * 100}%`,
            transform: `translate(-50%, -50%) rotate(${selectedBox.rotation}deg)`,
          }}
        >
          {CORNERS.map((corner) => (
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
          <button
            className="si-transform-handle si-rotate-handle"
            aria-label={`Rotate ${targetName}`}
            title="Drag to rotate · Shift snaps to 15° · Arrow keys adjust angle"
            onPointerDown={(e) => begin(e, 'rotate')}
            onKeyDown={(e) => keydown(e, 'rotate')}
            {...pointerEvents}
          >
            <RotateCw size={18} />
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
