import { useEffect, useRef, useState } from 'react'
import {
  clamp,
  DEFAULT_FRAMING,
  hostRect,
  type Format,
  type ImageAsset,
  type Layout,
} from './model'
import { FlipHorizontal2, RotateCcw, RotateCw } from 'lucide-react'

interface TransformOverlayProps {
  format: Format
  layout: Layout
  host: ImageAsset
  onTransform: (values: Partial<Layout>) => void
}

type DragMode = 'move' | 'scale' | 'rotate' | null

export function TransformOverlay({
  format,
  layout,
  host,
  onTransform,
}: TransformOverlayProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const boxRef = useRef<HTMLDivElement>(null)
  const [activeMode, setActiveMode] = useState<DragMode>(null)
  const [isHovered, setIsHovered] = useState(false)

  const activeOp = useRef<{
    mode: DragMode
    pointerId: number
    startMouseX: number
    startMouseY: number
    startX: number
    startY: number
    startZoom: number
    startRotation: number
    centerX: number
    centerY: number
    startDist: number
    startAngleDeg: number
  } | null>(null)

  // Calculate bounding box geometry in format units and percentages
  const rect = hostRect(format, layout, host.bounds)
  const leftPercent = layout.x
  const topPercent = layout.y
  const widthPercent = (rect.width / format.width) * 100
  const heightPercent = (rect.height / format.height) * 100

  // Handle wheel zoom over overlay
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const delta = e.deltaY > 0 ? -5 : 5
    onTransform({ zoom: clamp(layout.zoom + delta, 20, 300) })
  }

  // --- Translation (Move) ---
  const handleMoveStart = (e: React.PointerEvent) => {
    if (e.button !== 0) return
    e.preventDefault()
    e.stopPropagation()
    const target = e.currentTarget as HTMLElement
    target.setPointerCapture(e.pointerId)

    const parent = containerRef.current?.parentElement
    if (!parent) return

    const box = boxRef.current?.getBoundingClientRect()
    const centerX = box ? box.left + box.width / 2 : e.clientX
    const centerY = box ? box.top + box.height / 2 : e.clientY

    activeOp.current = {
      mode: 'move',
      pointerId: e.pointerId,
      startMouseX: e.clientX,
      startMouseY: e.clientY,
      startX: layout.x,
      startY: layout.y,
      startZoom: layout.zoom,
      startRotation: layout.rotation,
      centerX,
      centerY,
      startDist: 0,
      startAngleDeg: 0,
    }
    setActiveMode('move')
  }

  // --- Scale (Corner Handles) ---
  const handleScaleStart = (e: React.PointerEvent) => {
    if (e.button !== 0) return
    e.preventDefault()
    e.stopPropagation()
    const target = e.currentTarget as HTMLElement
    target.setPointerCapture(e.pointerId)

    const box = boxRef.current?.getBoundingClientRect()
    if (!box) return

    const centerX = box.left + box.width / 2
    const centerY = box.top + box.height / 2
    const startDist = Math.hypot(e.clientX - centerX, e.clientY - centerY)

    activeOp.current = {
      mode: 'scale',
      pointerId: e.pointerId,
      startMouseX: e.clientX,
      startMouseY: e.clientY,
      startX: layout.x,
      startY: layout.y,
      startZoom: layout.zoom,
      startRotation: layout.rotation,
      centerX,
      centerY,
      startDist: Math.max(startDist, 10),
      startAngleDeg: 0,
    }
    setActiveMode('scale')
  }

  // --- Rotation (Rotate Handle) ---
  const handleRotateStart = (e: React.PointerEvent) => {
    if (e.button !== 0) return
    e.preventDefault()
    e.stopPropagation()
    const target = e.currentTarget as HTMLElement
    target.setPointerCapture(e.pointerId)

    const box = boxRef.current?.getBoundingClientRect()
    if (!box) return

    const centerX = box.left + box.width / 2
    const centerY = box.top + box.height / 2
    const startAngleRad = Math.atan2(e.clientY - centerY, e.clientX - centerX)
    const startAngleDeg = (startAngleRad * 180) / Math.PI

    activeOp.current = {
      mode: 'rotate',
      pointerId: e.pointerId,
      startMouseX: e.clientX,
      startMouseY: e.clientY,
      startX: layout.x,
      startY: layout.y,
      startZoom: layout.zoom,
      startRotation: layout.rotation,
      centerX,
      centerY,
      startDist: 0,
      startAngleDeg,
    }
    setActiveMode('rotate')
  }

  // Global pointer move & up
  useEffect(() => {
    const onPointerMove = (e: PointerEvent) => {
      const op = activeOp.current
      if (!op || op.pointerId !== e.pointerId) return

      const parent = containerRef.current?.parentElement
      if (!parent) return
      const parentRect = parent.getBoundingClientRect()

      if (op.mode === 'move') {
        const dx = e.clientX - op.startMouseX
        const dy = e.clientY - op.startMouseY
        const deltaXPercent = (dx / parentRect.width) * 100
        const deltaYPercent = (dy / parentRect.height) * 100

        onTransform({
          x: clamp(Math.round((op.startX + deltaXPercent) * 100) / 100, -50, 150),
          y: clamp(Math.round((op.startY + deltaYPercent) * 100) / 100, -50, 150),
        })
      } else if (op.mode === 'scale') {
        const currentDist = Math.hypot(e.clientX - op.centerX, e.clientY - op.centerY)
        const ratio = currentDist / op.startDist
        const newZoom = clamp(Math.round(op.startZoom * ratio), 20, 300)
        onTransform({ zoom: newZoom })
      } else if (op.mode === 'rotate') {
        const currentAngleRad = Math.atan2(e.clientY - op.centerY, e.clientX - op.centerX)
        const currentAngleDeg = (currentAngleRad * 180) / Math.PI
        let diff = currentAngleDeg - op.startAngleDeg

        while (diff > 180) diff -= 360
        while (diff < -180) diff += 360

        let newRotation = op.startRotation + diff
        while (newRotation > 180) newRotation -= 360
        while (newRotation < -180) newRotation += 360

        if (e.shiftKey) {
          // Snap to 15-degree steps with Shift
          newRotation = Math.round(newRotation / 15) * 15
        } else {
          newRotation = Math.round(newRotation)
        }

        onTransform({ rotation: clamp(newRotation, -180, 180) })
      }
    }

    const onPointerUp = (e: PointerEvent) => {
      if (activeOp.current && activeOp.current.pointerId === e.pointerId) {
        activeOp.current = null
        setActiveMode(null)
      }
    }

    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
    window.addEventListener('pointercancel', onPointerUp)
    return () => {
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
      window.removeEventListener('pointercancel', onPointerUp)
    }
  }, [onTransform])

  const showToolbar = isHovered || activeMode !== null

  return (
    <div
      ref={containerRef}
      className="to-container"
      onWheel={handleWheel}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div
        ref={boxRef}
        className={`to-box ${activeMode ? `is-${activeMode}` : ''}`}
        style={{
          left: `${leftPercent}%`,
          top: `${topPercent}%`,
          width: `${widthPercent}%`,
          height: `${heightPercent}%`,
          transform: `translate(-50%, -50%) rotate(${layout.rotation}deg)`,
        }}
        tabIndex={0}
        role="region"
        aria-label="Host image transform controls. Drag inside to move, corners to scale, top handle to rotate."
        onPointerDown={handleMoveStart}
        onDoubleClick={() => onTransform(DEFAULT_FRAMING)}
        onKeyDown={(e) => {
          // Arrow keys to move
          if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
            e.preventDefault()
            const step = e.shiftKey ? 2 : 0.25
            onTransform({
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
          // +/- zoom
          if (['+', '=', '-', '_'].includes(e.key)) {
            e.preventDefault()
            const dir = ['+', '='].includes(e.key) ? 1 : -1
            const step = e.shiftKey ? 10 : 5
            onTransform({ zoom: clamp(layout.zoom + dir * step, 20, 300) })
            return
          }
          // [ / ] rotate
          if (['[', ']'].includes(e.key)) {
            e.preventDefault()
            const dir = e.key === ']' ? 1 : -1
            const step = e.shiftKey ? 15 : 5
            onTransform({ rotation: clamp(layout.rotation + dir * step, -180, 180) })
            return
          }
        }}
      >
        {/* Rotation Stalk & Handle */}
        <div className="to-rot-stem" />
        <button
          type="button"
          className="to-rot-handle"
          title="Drag to rotate (Hold Shift for 15° snap)"
          aria-label="Rotate host image"
          onPointerDown={handleRotateStart}
        />

        {/* 4 Corner Scale Handles */}
        <div
          className="to-corner to-corner-nw"
          title="Drag to scale size"
          onPointerDown={handleScaleStart}
        />
        <div
          className="to-corner to-corner-ne"
          title="Drag to scale size"
          onPointerDown={handleScaleStart}
        />
        <div
          className="to-corner to-corner-se"
          title="Drag to scale size"
          onPointerDown={handleScaleStart}
        />
        <div
          className="to-corner to-corner-sw"
          title="Drag to scale size"
          onPointerDown={handleScaleStart}
        />

        {/* Floating Quick Action Badge */}
        <div
          className={`to-badge ${showToolbar ? 'is-visible' : ''}`}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <span className="to-badge-stat">{Math.round(layout.zoom)}%</span>
          <span className="to-badge-dot">·</span>
          <span className="to-badge-stat">{layout.rotation}°</span>

          <div className="to-badge-actions">
            <button
              type="button"
              className={`to-mini-btn ${layout.flip ? 'selected' : ''}`}
              title="Flip horizontal"
              aria-label="Flip horizontal"
              onClick={() => onTransform({ flip: !layout.flip })}
            >
              <FlipHorizontal2 size={13} />
            </button>
            <button
              type="button"
              className="to-mini-btn"
              title="Rotate -90°"
              aria-label="Rotate 90 degrees counter-clockwise"
              onClick={() =>
                onTransform({ rotation: ((layout.rotation - 90 + 180) % 360) - 180 })
              }
            >
              <RotateCcw size={13} />
            </button>
            <button
              type="button"
              className="to-mini-btn"
              title="Rotate +90°"
              aria-label="Rotate 90 degrees clockwise"
              onClick={() =>
                onTransform({ rotation: ((layout.rotation + 90 + 180) % 360) - 180 })
              }
            >
              <RotateCw size={13} />
            </button>
            <button
              type="button"
              className="to-mini-btn"
              title="Reset to default framing (or double-click)"
              aria-label="Reset framing"
              onClick={() => onTransform(DEFAULT_FRAMING)}
            >
              <span style={{ fontSize: '11px', fontWeight: 600 }}>1:1</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
