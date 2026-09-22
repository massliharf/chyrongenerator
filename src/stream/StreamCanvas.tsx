import { useEffect, useRef } from 'react'
import { clamp, type Format, type Layout, type ImageAsset } from './model'
import { drawStream, type StreamImages } from './renderer'

export function StreamCanvas({
  format,
  layout,
  host,
  images,
  onTransform,
  thumbnail = false,
}: {
  format: Format
  layout: Layout
  host: ImageAsset | null
  images: StreamImages | null
  onTransform?: (values: Partial<Pick<Layout, 'x' | 'y' | 'zoom' | 'rotation'>>) => void
  thumbnail?: boolean
}) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const drag = useRef<{
    id: number
    x: number
    y: number
    startX: number
    startY: number
    startRotation: number
    mode: 'move' | 'rotate'
  } | null>(null)
  useEffect(() => {
    if (!images || !canvas.current) return
    const ctx = canvas.current.getContext('2d')
    if (ctx) drawStream(ctx, format, layout, host, images)
  }, [format, layout, host, images])

  // Scroll-to-zoom
  useEffect(() => {
    const el = canvas.current
    if (!el || thumbnail) return
    const handler = (e: WheelEvent) => {
      if (!onTransform || !host || !images) return
      e.preventDefault()
      const delta = e.deltaY > 0 ? -5 : 5
      onTransform({ zoom: clamp(layout.zoom + delta, 20, 300) })
    }
    el.addEventListener('wheel', handler, { passive: false })
    return () => el.removeEventListener('wheel', handler)
  }, [layout.zoom, onTransform, host, images, thumbnail])

  const width = thumbnail ? 240 : Math.min(format.width, 900)
  const interactive = !!onTransform && !!host && !!images
  return (
    <canvas
      ref={canvas}
      width={width}
      height={Math.round((width * format.height) / format.width)}
      role="img"
      aria-label={`${format.name} preview${interactive ? '. Drag to move, Shift+drag to rotate, scroll to zoom.' : ''}`}
      tabIndex={interactive ? 0 : undefined}
      data-ready={!!images}
      className={`si-canvas ${interactive ? 'is-interactive' : ''}`}
      style={{ opacity: images ? 1 : 0 }}
      onPointerDown={(e) => {
        if (!interactive || e.button !== 0) return
        e.preventDefault()
        e.currentTarget.focus()
        e.currentTarget.setPointerCapture(e.pointerId)
        drag.current = {
          id: e.pointerId,
          x: e.clientX,
          y: e.clientY,
          startX: layout.x,
          startY: layout.y,
          startRotation: layout.rotation,
          mode: e.shiftKey ? 'rotate' : 'move',
        }
      }}
      onPointerMove={(e) => {
        const start = drag.current
        if (!interactive || !start || start.id !== e.pointerId) return
        const rect = e.currentTarget.getBoundingClientRect()
        if (start.mode === 'rotate') {
          // Horizontal drag maps to rotation
          const dx = e.clientX - start.x
          const rotationDelta = (dx / rect.width) * 90
          onTransform!({
            rotation: clamp(
              Math.round(start.startRotation + rotationDelta),
              -180,
              180,
            ),
          })
        } else {
          onTransform!({
            x: clamp(start.startX + ((e.clientX - start.x) / rect.width) * 100, -50, 150),
            y: clamp(start.startY + ((e.clientY - start.y) / rect.height) * 100, -50, 150),
          })
        }
      }}
      onPointerUp={(e) => {
        drag.current = null
        if (e.currentTarget.hasPointerCapture(e.pointerId))
          e.currentTarget.releasePointerCapture(e.pointerId)
      }}
      onLostPointerCapture={() => {
        drag.current = null
      }}
      onPointerCancel={() => {
        drag.current = null
      }}
      onKeyDown={(e) => {
        if (!interactive) return
        // Arrow keys: move
        if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
          e.preventDefault()
          e.stopPropagation()
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
          return
        }
        // +/- or =/_ : zoom
        if (e.key === '+' || e.key === '=' || e.key === '-' || e.key === '_') {
          e.preventDefault()
          const zoomStep = e.shiftKey ? 10 : 5
          const dir = e.key === '+' || e.key === '=' ? 1 : -1
          onTransform!({ zoom: clamp(layout.zoom + dir * zoomStep, 20, 300) })
          return
        }
        // [ / ] : rotate
        if (e.key === '[' || e.key === ']') {
          e.preventDefault()
          const rotStep = e.shiftKey ? 15 : 5
          const dir = e.key === ']' ? 1 : -1
          onTransform!({ rotation: clamp(layout.rotation + dir * rotStep, -180, 180) })
          return
        }
      }}
    />
  )
}
