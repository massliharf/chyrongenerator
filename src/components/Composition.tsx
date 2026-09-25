import {
  memo,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from 'react'
import { LoaderCircle, RotateCcw, RotateCw } from 'lucide-react'
import { loadFonts, type Fonts } from '../studio/fonts'
import { buildScene, chyronBounds, imageBounds, renderComposition } from '../studio/renderer'
import { chyronLayer, type ImageLayer, type Project } from '../studio/model'
import { useProjectImages } from '../studio/useImages'
import {
  CORNERS,
  isPointInChyron,
  rotateChyron,
  scaleChyron,
  scaleImage,
  snapImagePosition,
  snapPosition,
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
      if (!layer.visible) continue
      if (layer.kind === 'chyron') {
        if (isPointInChyron(point, rect, project, bounds)) return 'chyron'
      } else if (images.has(layer.assetId) && layer.opacity > 0) {
        if (isPointInChyron(point, rect, project, imageBounds(layer, project))) return layer.id
      }
    }
    return null
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
        const box = imageBounds(layer, project)
        const { x, y, snap } = snapImagePosition(
          layer.x + (delta.x / project.width) * 100,
          layer.y + (delta.y / project.height) * 100,
          (box.width / project.width) * 100,
          (box.height / project.height) * 100,
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
      {interactive && selectedBox && (
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
