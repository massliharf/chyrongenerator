import { useRef, useState } from 'react'
import {
  ChevronDown,
  ChevronFirst,
  ChevronLast,
  Eye,
  EyeOff,
  ImagePlus,
  Images,
  Pause,
  Play,
  Repeat2,
  Type,
  Upload,
  Lock,
  LockOpen,
} from 'lucide-react'
import { duration, layerTiming, type Layer, type LayerTiming, type Project } from '../studio/model'
import type { usePlayback } from '../studio/usePlayback'
import { MenuButton } from './Menu'

const KEY = 'chyron-studio:timeline'

export interface TimingChange {
  delay?: number
  length?: number
  outLength?: number
  endDelay?: number
}
type DragMode = 'move' | 'start' | 'in' | 'out' | 'end'

/** Playback, the time ruler and the layer stack in one place: each row is a layer. */
export function Timeline({
  project: p,
  playback,
  selected,
  onSelect,
  onToggleVisible,
  onToggleLock,
  onAddImages,
  onOpenGallery,
  onTiming,
  onReorder,
}: {
  project: Project
  playback: ReturnType<typeof usePlayback>
  selected: string | null
  onSelect: (id: string | null) => void
  onToggleVisible: (id: string) => void
  /** Locked layers ignore clicks on the canvas. */
  onToggleLock?: (id: string) => void
  onAddImages: (files: File[]) => void
  onOpenGallery?: () => void
  /** Drag results, in seconds: where the layer starts/ends and how long its intro and outro last. */
  onTiming: (id: string, timing: TimingChange) => void
  /** Move a layer to a new stack index (0 = back). */
  onReorder: (id: string, index: number) => void
}) {
  const [dragged, setDragged] = useState<string | null>(null)
  const [dropIndex, setDropIndex] = useState<number | null>(null)
  const drag = useRef<{
    id: string
    mode: DragMode
    x: number
    width: number
    t: LayerTiming
  } | null>(null)
  const snap = (seconds: number) => Math.round(seconds * p.fps) / p.fps
  const beginDrag = (e: React.PointerEvent<HTMLElement>, l: Layer, mode: DragMode) => {
    if (e.button !== 0) return
    e.stopPropagation()
    const track = (e.currentTarget.closest('.tracks') as HTMLElement).getBoundingClientRect()
    e.currentTarget.setPointerCapture(e.pointerId)
    drag.current = { id: l.id, mode, x: e.clientX, width: track.width, t: layerTiming(l, p) }
    onSelect(l.id)
  }
  const moveDrag = (e: React.PointerEvent<HTMLElement>) => {
    const d = drag.current
    if (!d) return
    const dt = ((e.clientX - d.x) / d.width) * total
    const { t } = d
    const room = (fixed: number) => Math.max(0, total - fixed)
    if (d.mode === 'move') {
      // Slide the whole clip: its intro, hold and outro keep their lengths.
      const span = t.length + t.hold + t.outLength
      const delay = Math.max(0, Math.min(room(span), snap(t.delay + dt)))
      onTiming(d.id, { delay, endDelay: Math.max(0, snap(total - span - delay)) })
    } else if (d.mode === 'start') {
      const max = room(t.length + t.outLength + t.endDelay)
      onTiming(d.id, {
        delay: Math.max(0, Math.min(max, snap(t.delay + dt))),
        endDelay: t.endDelay,
      })
    } else if (d.mode === 'end') {
      const max = room(t.delay + t.length + t.outLength)
      onTiming(d.id, {
        endDelay: Math.max(0, Math.min(max, snap(t.endDelay - dt))),
        delay: t.delay,
      })
    } else if (d.mode === 'in') {
      const max = room(t.delay + t.outLength + t.endDelay)
      onTiming(d.id, { length: Math.max(0.2, Math.min(max, snap(t.length + dt))) })
    } else {
      const max = room(t.delay + t.length + t.endDelay)
      onTiming(d.id, {
        outLength: Math.max(0.2, Math.min(max, snap(t.outLength - dt))),
        endDelay: t.endDelay,
      })
    }
  }
  const endDrag = () => {
    drag.current = null
  }
  const [expanded, setExpanded] = useState(() => {
    try {
      return localStorage.getItem(KEY) !== 'collapsed'
    } catch {
      return true
    }
  })
  const input = useRef<HTMLInputElement>(null)
  const total = duration(p)
  const pct = (s: number) => `${(s / total) * 100}%`
  const toggleExpanded = () => {
    setExpanded(!expanded)
    try {
      localStorage.setItem(KEY, expanded ? 'collapsed' : 'expanded')
    } catch {
      /* Optional preference. */
    }
  }
  const still = (l: Layer) => (l.kind === 'image' ? l.intro === 'none' : p.motion === 'none')
  const scrubber = (className: string) => (
    <input
      className={className}
      aria-label="Playhead time"
      type="range"
      min={0}
      max={total}
      step={1 / p.fps}
      value={playback.time}
      aria-valuetext={`${playback.time.toFixed(2)} of ${total.toFixed(2)} seconds`}
      style={{ '--range-progress': `${(playback.time / total) * 100}%` } as React.CSSProperties}
      onChange={(e) => playback.seek(Number(e.target.value))}
    />
  )
  const layers = [...p.layers].reverse()
  return (
    <section
      className={`timeline ${expanded ? 'is-expanded' : ''}`}
      aria-label="Timeline and layers"
    >
      <div className="timeline-toolbar">
        <button
          className="icon-button timeline-toggle"
          aria-label={expanded ? 'Collapse timeline' : 'Expand timeline'}
          aria-expanded={expanded}
          aria-controls="timeline-details"
          title={expanded ? 'Hide layers' : 'Show layers'}
          onClick={toggleExpanded}
        >
          <ChevronDown size={20} />
        </button>
        <div className="transport">
          <button
            className="icon-button transport-boundary"
            aria-label="Go to start"
            title="Go to start"
            onClick={() => playback.seek(0)}
          >
            <ChevronFirst size={18} />
          </button>
          <button
            className="play-button"
            aria-label={playback.playing ? 'Pause animation' : 'Play animation'}
            title="Play / pause (Space)"
            onClick={playback.toggle}
          >
            {playback.playing ? (
              <Pause size={18} fill="currentColor" />
            ) : (
              <Play size={18} fill="currentColor" />
            )}
          </button>
          <button
            className="icon-button transport-boundary"
            aria-label="Go to end"
            title="Go to end"
            onClick={() => playback.seek(total)}
          >
            <ChevronLast size={18} />
          </button>
          <span className="timecode">
            {playback.time.toFixed(2)} <span>/ {total.toFixed(2)} s</span>
          </span>
        </div>
        <div className="timeline-tools">
          <button
            className={`icon-button ${playback.loop ? 'selected' : ''}`}
            aria-label="Loop playback"
            aria-pressed={playback.loop}
            title="Loop"
            onClick={() => playback.setLoop(!playback.loop)}
          >
            <Repeat2 size={18} />
          </button>
          {onOpenGallery ? (
            <MenuButton
              label="Add image"
              className="button outline add-layer"
              align="end"
              placement="top"
              title="Add a logo, photo or graphic"
              items={[
                {
                  label: 'Choose from Media gallery',
                  Icon: Images,
                  onSelect: onOpenGallery,
                },
                {
                  label: 'Upload from device',
                  Icon: Upload,
                  hint: 'PNG, JPEG, WebP or GIF',
                  onSelect: () => input.current?.click(),
                },
              ]}
            >
              <ImagePlus size={18} aria-hidden="true" />
              <span className="label">Add image</span>
            </MenuButton>
          ) : (
            <button
              className="button outline add-layer"
              aria-label="Add image"
              title="Add a logo, photo or graphic"
              onClick={() => input.current?.click()}
            >
              <ImagePlus size={18} aria-hidden="true" />
              <span className="label">Add image</span>
            </button>
          )}
          <input
            ref={input}
            type="file"
            hidden
            multiple
            accept="image/png,image/jpeg,image/webp,image/gif"
            onChange={(e) => {
              const files = Array.from(e.currentTarget.files ?? [])
              e.currentTarget.value = ''
              if (files.length) onAddImages(files)
            }}
          />
        </div>
      </div>
      {!expanded && <div className="compact-scrubber">{scrubber('compact-playhead')}</div>}
      <div id="timeline-details" className="timeline-grid" hidden={!expanded}>
        <div className="ruler-label" aria-hidden="true" />
        <div className="ruler">
          {Array.from({ length: 5 }, (_, i) => (
            <span key={i} aria-hidden="true" style={{ left: `${(i / 4) * 100}%` }}>
              {((i / 4) * total).toFixed(1)}s
            </span>
          ))}
          {scrubber('timeline-scrubber')}
        </div>
        <ol className="layer-labels" aria-label="Layers, front to back">
          {layers.map((l, row) => {
            const name = l.kind === 'chyron' ? 'Chyron' : l.name
            return (
              <li
                key={l.id}
                className={`layer-label ${l.id === selected ? 'selected' : ''} ${l.visible ? '' : 'is-hidden'} ${l.locked ? 'is-locked' : ''} ${dragged === l.id ? 'is-dragging' : ''} ${dropIndex === row && dragged && dragged !== l.id ? 'drop-target' : ''}`}
                draggable
                title="Drag to reorder"
                onDragStart={(e) => {
                  e.dataTransfer.effectAllowed = 'move'
                  e.dataTransfer.setData('text/plain', l.id)
                  setDragged(l.id)
                }}
                onDragOver={(e) => {
                  if (!dragged) return
                  e.preventDefault()
                  setDropIndex(row)
                }}
                onDrop={(e) => {
                  e.preventDefault()
                  if (dragged && dragged !== l.id) onReorder(dragged, p.layers.length - 1 - row)
                  setDragged(null)
                  setDropIndex(null)
                }}
                onDragEnd={() => {
                  setDragged(null)
                  setDropIndex(null)
                }}
              >
                <button
                  className="eye"
                  aria-label={`${l.visible ? 'Hide' : 'Show'} ${name}`}
                  aria-pressed={!l.visible}
                  title={l.visible ? 'Hide' : 'Show'}
                  onClick={() => onToggleVisible(l.id)}
                >
                  {l.visible ? <Eye size={16} /> : <EyeOff size={16} />}
                </button>
                <button
                  className="layer-name"
                  aria-pressed={l.id === selected}
                  onClick={() => onSelect(l.id === selected ? null : l.id)}
                >
                  {l.kind === 'chyron' && <Type size={14} aria-hidden="true" />}
                  <span>{name}</span>
                </button>
                {onToggleLock && (
                  <button
                    className={`eye lock ${l.locked ? 'is-on' : ''}`}
                    aria-label={`${l.locked ? 'Unlock' : 'Lock'} ${name}`}
                    aria-pressed={!!l.locked}
                    title={
                      l.locked
                        ? 'Unlock: clicks on the canvas reach it again'
                        : 'Lock: ignore clicks on the canvas'
                    }
                    onClick={() => onToggleLock(l.id)}
                  >
                    {l.locked ? <Lock size={14} /> : <LockOpen size={14} />}
                  </button>
                )}
              </li>
            )
          })}
        </ol>
        <div className="tracks">
          {layers.map((l) => {
            const t = layerTiming(l, p)
            const cut = still(l)
            const width = Math.max(0.001, total - t.delay - t.endDelay)
            const inPct = cut ? 0 : (t.length / width) * 100
            const outPct = cut ? 0 : (t.outLength / width) * 100
            const handlers = {
              onPointerMove: moveDrag,
              onPointerUp: endDrag,
              onPointerCancel: endDrag,
            }
            return (
              <div
                key={l.id}
                className={`track ${l.id === selected ? 'selected' : ''}`}
                aria-hidden="true"
                onClick={() => onSelect(l.id)}
              >
                <div
                  className={`clip ${l.kind === 'chyron' ? 'title-clip' : 'image-clip'} ${l.visible ? '' : 'is-hidden'}`}
                  style={{ marginLeft: pct(t.delay), width: pct(width) }}
                  title={`In ${t.length.toFixed(2)}s · Hold ${t.hold.toFixed(2)}s · Out ${t.outLength.toFixed(2)}s — drag to move`}
                  onPointerDown={(e) => beginDrag(e, l, 'move')}
                  {...handlers}
                >
                  <i
                    className="clip-edge start"
                    title="Drag to change when it starts"
                    onPointerDown={(e) => beginDrag(e, l, 'start')}
                    {...handlers}
                  />
                  <span
                    className="clip-in"
                    title={`Intro · ${t.length}s`}
                    style={{ width: `${inPct}%` }}
                  />
                  <span className="clip-hold">
                    {l.kind === 'chyron' ? p.text.replace(/\n/g, ' ') || 'Chyron' : l.name}
                  </span>
                  <span
                    className="clip-out"
                    title={`Outro · ${t.outLength}s`}
                    style={{ width: `${outPct}%` }}
                  />
                  {!cut && (
                    <>
                      <i
                        className="clip-handle"
                        title="Drag to change the intro length"
                        style={{ left: `${inPct}%` }}
                        onPointerDown={(e) => beginDrag(e, l, 'in')}
                        {...handlers}
                      />
                      <i
                        className="clip-handle"
                        title="Drag to change the outro length"
                        style={{ left: `${100 - outPct}%` }}
                        onPointerDown={(e) => beginDrag(e, l, 'out')}
                        {...handlers}
                      />
                    </>
                  )}
                  <i
                    className="clip-edge end"
                    title="Drag to change when it ends"
                    onPointerDown={(e) => beginDrag(e, l, 'end')}
                    {...handlers}
                  />
                </div>
              </div>
            )
          })}
          <div className="playhead" style={{ left: `${(playback.time / total) * 100}%` }}>
            <span />
          </div>
        </div>
      </div>
    </section>
  )
}
