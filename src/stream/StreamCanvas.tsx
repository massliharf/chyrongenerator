import { useEffect, useRef, useState, type PointerEvent, type KeyboardEvent } from 'react'
import { RotateCw } from 'lucide-react'
import { clamp, hostRect, type Format, type Layout, type ImageAsset } from './model'
import {
  CORNERS,
  isPointInHost,
  normalizeRotation,
  resizeHost,
  rotateHost,
  type Corner,
  type Point,
} from './transform'
import { drawStream, type StreamImages } from './renderer'

type Action = 'move' | 'rotate' | Corner
type Gesture = {
  id: number
  action: Action
  start: Point
  layout: Layout
  rect: DOMRect
}

export function StreamCanvas({
  format,
  layout,
  host,
  images,
  onTransform,
  showControls = true,
  onSelectHost,
  thumbnail = false,
}: {
  format: Format
  layout: Layout
  host: ImageAsset | null
  images: StreamImages | null
  onTransform?: (values: Partial<Layout>) => void
  showControls?: boolean
  onSelectHost?: (selected: boolean) => void
  thumbnail?: boolean
}) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const drag = useRef<Gesture | null>(null)
  const [hoveringHost, setHoveringHost] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  useEffect(() => {
    if (!images || !canvas.current) return
    const ctx = canvas.current.getContext('2d')
    if (ctx) drawStream(ctx, format, layout, host, images)
  }, [format, layout, host, images])
  const width = thumbnail ? 240 : Math.min(format.width, 900)
  const interactive = !!onTransform && !!host && !!images
  const bounds = host ? hostRect(format, layout, host.bounds) : null

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
      layout: { ...layout },
      rect: canvas.current.getBoundingClientRect(),
    }
  }

  function move(e: PointerEvent<HTMLElement>) {
    const start = drag.current
    if (!interactive || !start || start.id !== e.pointerId) return
    const { rect, layout: initial } = start
    const delta = {
      x: ((e.clientX - start.start.x) / rect.width) * format.width,
      y: ((e.clientY - start.start.y) / rect.height) * format.height,
    }
    if (start.action === 'move') {
      onTransform!({
        x: clamp(initial.x + (delta.x / format.width) * 100, -50, 150),
        y: clamp(initial.y + (delta.y / format.height) * 100, -50, 150),
      })
    } else if (start.action === 'rotate') {
      onTransform!({
        rotation: rotateHost(
          initial.rotation,
          {
            x: rect.left + (rect.width * initial.x) / 100,
            y: rect.top + (rect.height * initial.y) / 100,
          },
          start.start,
          { x: e.clientX, y: e.clientY },
          e.shiftKey,
        ),
      })
    } else onTransform!(resizeHost(format, initial, host!.bounds, start.action, delta))
  }

  function end(e: PointerEvent<HTMLElement>) {
    if (drag.current?.id !== e.pointerId) return
    drag.current = null
    setIsDragging(false)
    if (e.currentTarget.hasPointerCapture(e.pointerId))
      e.currentTarget.releasePointerCapture(e.pointerId)
  }

  function keydown(e: KeyboardEvent<HTMLElement>, action: Action) {
    if (!interactive) return
    if (e.key === 'Escape') {
      if (drag.current) {
        onTransform!(drag.current.layout)
        drag.current = null
        setIsDragging(false)
      }
      onSelectHost?.(false)
      e.preventDefault()
      e.stopPropagation()
      return
    }
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return
    e.preventDefault()
    e.stopPropagation()
    if (action === 'move') {
      const step = e.shiftKey ? 2 : 0.25
      onTransform!({
        x: clamp(
          layout.x + (e.key === 'ArrowRight' ? step : e.key === 'ArrowLeft' ? -step : 0),
          -50,
          150,
        ),
        y: clamp(
          layout.y + (e.key === 'ArrowDown' ? step : e.key === 'ArrowUp' ? -step : 0),
          -50,
          150,
        ),
      })
    } else {
      const direction = e.key === 'ArrowRight' || e.key === 'ArrowUp' ? 1 : -1
      onTransform!(
        action === 'rotate'
          ? { rotation: normalizeRotation(layout.rotation + direction * (e.shiftKey ? 15 : 1)) }
          : { zoom: clamp(layout.zoom + direction * (e.shiftKey ? 10 : 1), 20, 300) },
      )
    }
  }

  function canvasPointerDown(e: PointerEvent<HTMLCanvasElement>) {
    if (!interactive || e.button !== 0 || drag.current || !canvas.current || !host) return
    const inHost = isPointInHost(
      { x: e.clientX, y: e.clientY },
      canvas.current.getBoundingClientRect(),
      format,
      layout,
      host.bounds,
    )
    if (inHost) {
      if (!showControls) {
        onSelectHost?.(true)
      }
      begin(e, 'move')
    } else {
      if (showControls) {
        onSelectHost?.(false)
      }
    }
  }

  function canvasPointerMove(e: PointerEvent<HTMLCanvasElement>) {
    if (drag.current) {
      move(e)
      return
    }
    if (!interactive || !canvas.current || !host) {
      if (hoveringHost) setHoveringHost(false)
      return
    }
    const inHost = isPointInHost(
      { x: e.clientX, y: e.clientY },
      canvas.current.getBoundingClientRect(),
      format,
      layout,
      host.bounds,
    )
    if (inHost !== hoveringHost) {
      setHoveringHost(inHost)
    }
  }

  function canvasPointerLeave() {
    if (!drag.current && hoveringHost) {
      setHoveringHost(false)
    }
  }

  const pointerEvents = {
    onPointerMove: move,
    onPointerUp: end,
    onPointerCancel: end,
    onLostPointerCapture: end,
  }
  return (
    <>
      <canvas
        ref={canvas}
        width={width}
        height={Math.round((width * format.height) / format.width)}
        role="img"
        aria-label={`${format.name} preview${interactive ? (showControls ? '. Drag to move host; arrow keys to nudge, Shift for larger steps.' : '. Click host image to frame.') : ''}`}
        title={
          interactive && host
            ? showControls
              ? 'Drag host to move · Corners to resize · Click outside to deselect'
              : 'Click host image to frame'
            : undefined
        }
        tabIndex={interactive ? 0 : undefined}
        data-ready={!!images}
        className={`si-canvas ${interactive ? 'is-interactive' : ''} ${showControls ? 'has-controls' : ''} ${hoveringHost ? 'hovering-host' : ''} ${isDragging ? 'is-dragging' : ''}`}
        style={{ opacity: images ? 1 : 0 }}
        onPointerDown={canvasPointerDown}
        onPointerMove={canvasPointerMove}
        onPointerLeave={canvasPointerLeave}
        onPointerUp={end}
        onPointerCancel={end}
        onLostPointerCapture={end}
        onKeyDown={(e) => keydown(e, 'move')}
      />
      {interactive && showControls && bounds && (
        <div
          className="si-transform-box"
          role="group"
          aria-label="Host transform controls"
          style={{
            left: `${layout.x}%`,
            top: `${layout.y}%`,
            width: `${(bounds.width / format.width) * 100}%`,
            height: `${(bounds.height / format.height) * 100}%`,
            transform: `translate(-50%, -50%) rotate(${layout.rotation}deg)`,
          }}
        >
          {CORNERS.map((corner) => (
            <button
              key={corner}
              className={`si-transform-handle si-resize-handle ${corner}`}
              aria-label={`Resize host from ${corner.replace('-', ' ')}`}
              title="Drag to resize · Arrow keys adjust size · Shift for larger steps"
              onPointerDown={(e) => begin(e, corner)}
              onKeyDown={(e) => keydown(e, corner)}
              {...pointerEvents}
            >
              <span />
            </button>
          ))}
          <button
            className="si-transform-handle si-rotate-handle"
            aria-label="Rotate host"
            title="Drag to rotate · Shift snaps to 15° · Arrow keys adjust angle"
            onPointerDown={(e) => begin(e, 'rotate')}
            onKeyDown={(e) => keydown(e, 'rotate')}
            {...pointerEvents}
          >
            <RotateCw size={18} />
          </button>
        </div>
      )}
    </>
  )
}
