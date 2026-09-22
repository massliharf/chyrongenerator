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
import { buildScene, chyronBounds, renderFrame } from '../studio/renderer'
import type { Project } from '../studio/model'
import {
  CORNERS,
  isPointInChyron,
  rotateChyron,
  scaleChyron,
  snapPosition,
  type Corner,
  type Point,
  type SnapState,
} from '../studio/transform'

type Action = 'move' | 'rotate' | Corner
type Gesture = {
  id: number
  action: Action
  start: Point
  project: Project
  rect: DOMRect
}

export const Composition = memo(function Composition({
  project,
  time,
  thumbnail = false,
  onTransform,
  showControls = false,
  onSelectChyron,
}: {
  project: Project
  time: number
  thumbnail?: boolean
  onTransform?: (values: Partial<Project>) => void
  showControls?: boolean
  onSelectChyron?: (selected: boolean) => void
}) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const drag = useRef<Gesture | null>(null)
  const [loaded, setLoaded] = useState<{ fonts: Fonts; name: string } | null>(null)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const [hoveringChyron, setHoveringChyron] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [activeSnap, setActiveSnap] = useState<SnapState>({ x: null, y: null })

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

  const bounds = useMemo(
    () => (scene ? chyronBounds(scene, project) : null),
    [scene, project],
  )

  const interactive = !thumbnail && !!onTransform && !!bounds && !!scene

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
      if (context) renderFrame(context, scene, project, time)
    }
    draw()
    const observer = new ResizeObserver(draw)
    observer.observe(node)
    return () => observer.disconnect()
  }, [scene, project, time, loaded])

  function begin(e: PointerEvent<HTMLElement>, action: Action) {
    if (!interactive || e.button !== 0 || drag.current || !canvas.current) return
    e.preventDefault()
    e.stopPropagation()
    e.currentTarget.focus({ preventScroll: true })
    e.currentTarget.setPointerCapture(e.pointerId)
    setIsDragging(true)
    drag.current = {
      id: e.pointerId,
      action,
      start: { x: e.clientX, y: e.clientY },
      project: { ...project },
      rect: canvas.current.getBoundingClientRect(),
    }
  }

  function move(e: PointerEvent<HTMLElement>) {
    const start = drag.current
    if (!interactive || !start || start.id !== e.pointerId || !bounds) return
    const { rect, project: initial } = start
    const delta = {
      x: ((e.clientX - start.start.x) / rect.width) * project.width,
      y: ((e.clientY - start.start.y) / rect.height) * project.height,
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
      const rotation = rotateChyron(
        initial.compositionRotation,
        center,
        start.start,
        { x: e.clientX, y: e.clientY },
        e.shiftKey,
      )
      onTransform!({ compositionRotation: rotation })
    } else {
      const scale = scaleChyron(
        initial.scale,
        rect,
        initial,
        start.start,
        { x: e.clientX, y: e.clientY },
      )
      onTransform!({ scale })
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
      if (drag.current) {
        onTransform!(drag.current.project)
        drag.current = null
        setIsDragging(false)
        setActiveSnap({ x: null, y: null })
      }
      onSelectChyron?.(false)
      e.preventDefault()
      e.stopPropagation()
      return
    }
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return
    e.preventDefault()
    e.stopPropagation()
    if (action === 'move') {
      const step = e.shiftKey ? 2 : 0.5
      onTransform!({
        x: Math.round(
          Math.min(
            95,
            Math.max(5, project.x + (e.key === 'ArrowRight' ? step : e.key === 'ArrowLeft' ? -step : 0)),
          ) * 10,
        ) / 10,
        y: Math.round(
          Math.min(
            95,
            Math.max(5, project.y + (e.key === 'ArrowDown' ? step : e.key === 'ArrowUp' ? -step : 0)),
          ) * 10,
        ) / 10,
      })
    } else if (action === 'rotate') {
      const direction = e.key === 'ArrowRight' || e.key === 'ArrowUp' ? 1 : -1
      const step = e.shiftKey ? 15 : 1
      onTransform!({
        compositionRotation: Math.min(
          180,
          Math.max(-180, project.compositionRotation + direction * step),
        ),
      })
    } else {
      const direction = e.key === 'ArrowRight' || e.key === 'ArrowUp' ? 1 : -1
      const step = e.shiftKey ? 10 : 2
      onTransform!({
        scale: Math.min(150, Math.max(20, project.scale + direction * step)),
      })
    }
  }

  function canvasPointerDown(e: PointerEvent<HTMLCanvasElement>) {
    if (!interactive || e.button !== 0 || drag.current || !canvas.current || !bounds) return
    const inChyron = isPointInChyron(
      { x: e.clientX, y: e.clientY },
      canvas.current.getBoundingClientRect(),
      project,
      bounds,
    )
    if (inChyron) {
      if (!showControls) {
        onSelectChyron?.(true)
      }
      begin(e, 'move')
    } else {
      if (showControls) {
        onSelectChyron?.(false)
      }
    }
  }

  function canvasPointerMove(e: PointerEvent<HTMLCanvasElement>) {
    if (drag.current) {
      move(e)
      return
    }
    if (!interactive || !canvas.current || !bounds) {
      if (hoveringChyron) setHoveringChyron(false)
      return
    }
    const inChyron = isPointInChyron(
      { x: e.clientX, y: e.clientY },
      canvas.current.getBoundingClientRect(),
      project,
      bounds,
    )
    if (inChyron !== hoveringChyron) {
      setHoveringChyron(inChyron)
    }
  }

  function canvasPointerLeave() {
    if (!drag.current && hoveringChyron) {
      setHoveringChyron(false)
    }
  }

  const pointerEvents = {
    onPointerMove: move,
    onPointerUp: end,
    onPointerCancel: end,
    onLostPointerCapture: end,
  }

  const ready = loaded?.name === project.font

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
            : `Composition preview: ${project.text.replace(/\n/g, ' ')}.${project.subtitlePill ? ` ${project.subtitle}` : ''}`
        }
        role={thumbnail ? undefined : 'img'}
        title={
          interactive
            ? showControls
              ? 'Drag chyron to move (snaps to center/left/right) · Corners to scale · Click outside to deselect'
              : 'Click chyron to move, scale & rotate'
            : undefined
        }
        className={`${interactive ? 'is-interactive' : ''} ${showControls ? 'has-controls' : ''} ${hoveringChyron ? 'hovering-chyron' : ''} ${isDragging ? 'is-dragging' : ''}`}
        style={{ opacity: ready ? 1 : 0 }}
        tabIndex={interactive ? 0 : undefined}
        onPointerDown={canvasPointerDown}
        onPointerMove={canvasPointerMove}
        onPointerLeave={canvasPointerLeave}
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
            style={{ left: `${activeSnap.x.position}%`, top: '24px' }}
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
            style={{ left: '60px', top: `${activeSnap.y.position}%` }}
          >
            {activeSnap.y.label}
          </div>
        </>
      )}
      {interactive && showControls && bounds && (
        <div
          className="composition-transform-box si-transform-box"
          role="group"
          aria-label="Chyron transform controls"
          style={{
            left: `${project.x}%`,
            top: `${project.y}%`,
            width: `${(bounds.width / project.width) * 100}%`,
            height: `${(bounds.height / project.height) * 100}%`,
            transform: `translate(-50%, -50%) rotate(${project.compositionRotation}deg)`,
          }}
        >
          {CORNERS.map((corner) => (
            <button
              key={corner}
              className={`si-transform-handle si-resize-handle ${corner}`}
              aria-label={`Scale chyron from ${corner.replace('-', ' ')}`}
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
            aria-label="Rotate chyron"
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
          <button className="button" onClick={() => setAttempt((n) => n + 1)}>
            <RotateCcw size={14} /> Retry
          </button>
        </div>
      )}
    </div>
  )
})
