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
} from 'lucide-react'
import { chyronLayer, duration, type Layer, type Project } from '../studio/model'
import { imageTiming } from '../studio/motion'
import type { usePlayback } from '../studio/usePlayback'
import { MenuButton } from './Menu'

const KEY = 'chyron-studio:timeline'

/** Playback, the time ruler and the layer stack in one place: each row is a layer. */
export function Timeline({
  project: p,
  playback,
  selected,
  onSelect,
  onToggleVisible,
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
  onAddImages: (files: File[]) => void
  onOpenGallery?: () => void
  /** Drag results: a new start delay, or a new transition length, in seconds. */
  onTiming: (id: string, timing: { delay?: number; length?: number }) => void
  /** Move a layer to a new stack index (0 = back). */
  onReorder: (id: string, index: number) => void
}) {
  const [dragged, setDragged] = useState<string | null>(null)
  const [dropIndex, setDropIndex] = useState<number | null>(null)
  const drag = useRef<{
    id: string
    mode: 'delay' | 'length'
    x: number
    width: number
    delay: number
    length: number
  } | null>(null)
  const snap = (seconds: number) => Math.round(seconds * p.fps) / p.fps
  const beginDrag = (
    e: React.PointerEvent<HTMLElement>,
    l: Layer,
    mode: 'delay' | 'length',
    current: { delay: number; length: number },
  ) => {
    if (e.button !== 0) return
    e.stopPropagation()
    const track = (e.currentTarget.closest('.tracks') as HTMLElement).getBoundingClientRect()
    e.currentTarget.setPointerCapture(e.pointerId)
    drag.current = { id: l.id, mode, x: e.clientX, width: track.width, ...current }
    onSelect(l.id)
  }
  const moveDrag = (e: React.PointerEvent<HTMLElement>) => {
    const d = drag.current
    if (!d) return
    const seconds = ((e.clientX - d.x) / d.width) * total
    if (d.mode === 'delay') onTiming(d.id, { delay: Math.max(0, snap(d.delay + seconds)) })
    else onTiming(d.id, { length: Math.max(0.2, snap(d.length + seconds)) })
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
  const span = (l: Layer) => {
    if (l.kind === 'image') {
      const t = imageTiming(l, p)
      return { start: t.delay, length: l.intro === 'none' ? 0 : t.length, end: total - t.delay }
    }
    const delay = Math.min(chyronLayer(p).delay, Math.max(0, total / 2 - p.animationDuration))
    return {
      start: delay,
      length: p.motion === 'none' ? 0 : p.animationDuration,
      end: total - delay,
    }
  }
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
                className={`layer-label ${l.id === selected ? 'selected' : ''} ${l.visible ? '' : 'is-hidden'} ${dragged === l.id ? 'is-dragging' : ''} ${dropIndex === row && dragged && dragged !== l.id ? 'drop-target' : ''}`}
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
              </li>
            )
          })}
        </ol>
        <div className="tracks">
          {layers.map((l) => {
            const s = span(l)
            const width = Math.max(0.001, s.end - s.start)
            const edge = (s.length / width) * 100
            return (
              <div
                key={l.id}
                className={`track ${l.id === selected ? 'selected' : ''}`}
                aria-hidden="true"
                onClick={() => onSelect(l.id)}
              >
                <div
                  className={`clip ${l.kind === 'chyron' ? 'title-clip' : 'image-clip'} ${l.visible ? '' : 'is-hidden'}`}
                  style={{ marginLeft: pct(s.start), width: pct(width) }}
                  title="Drag to change when it starts"
                  onPointerDown={(e) =>
                    beginDrag(e, l, 'delay', { delay: s.start, length: s.length })
                  }
                  onPointerMove={moveDrag}
                  onPointerUp={endDrag}
                  onPointerCancel={endDrag}
                >
                  <span
                    className="clip-in"
                    title={`Intro · ${s.length}s`}
                    style={{ width: `${edge}%` }}
                  />
                  <span className="clip-hold">
                    {l.kind === 'chyron' ? p.text.replace(/\n/g, ' ') || 'Chyron' : l.name}
                  </span>
                  {s.length > 0 && (
                    <i
                      className="clip-handle"
                      title="Drag to change the transition length"
                      style={{ left: `${edge}%` }}
                      onPointerDown={(e) =>
                        beginDrag(e, l, 'length', { delay: s.start, length: s.length })
                      }
                      onPointerMove={moveDrag}
                      onPointerUp={endDrag}
                      onPointerCancel={endDrag}
                    />
                  )}
                  <span
                    className="clip-out"
                    title={`Outro · ${s.length}s`}
                    style={{ width: `${edge}%` }}
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
