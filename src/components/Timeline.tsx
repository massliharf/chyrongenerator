import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import {
  ChevronDown,
  Magnet,
  ZoomIn,
  ZoomOut,
  ChevronFirst,
  ChevronLast,
  Eye,
  EyeOff,
  Image as ImageIcon,
  LetterText,
  Music,
  Pause,
  Play,
  Repeat2,
  Shapes,
  Type,
  Lock,
  LockOpen,
  MoreHorizontal,
  Scissors,
  Volume2,
  VolumeX,
} from 'lucide-react'
import {
  MAX_HOLD,
  duration,
  isStill,
  layerTiming,
  styleOf,
  type AudioSegment,
  type AudioTrack,
  type Layer,
  type LayerTiming,
  type Project,
} from '../studio/model'
import { moveSegment, musicEnvelope, partAt, segmentsOf, trimSegment } from '../studio/audio'
import type { usePlayback } from '../studio/usePlayback'
import type { MenuPoint } from './Menu'
import { belowButton, MUSIC } from './layerMenu'
import { Waveform } from './MusicPanel'
import { NumberInput } from './Controls'
import { useAudioPeaks } from '../studio/useAudioPeaks'
import {
  MAX_ZOOM,
  MIN_ZOOM,
  formatTime,
  rulerSteps,
  rulerTicks,
  snapTo,
  tickLabel,
} from '../studio/timelineScale'

const KEY = 'chyron-studio:timeline'
const PREFS = 'chyron-studio:timeline-prefs'
type Prefs = { snap: boolean; height: number; frames: boolean }
const DEFAULT_PREFS: Prefs = { snap: true, height: 232, frames: false }
function loadPrefs(): Prefs {
  try {
    return { ...DEFAULT_PREFS, ...JSON.parse(localStorage.getItem(PREFS) || '{}') }
  } catch {
    return DEFAULT_PREFS
  }
}
/** Snap distance on screen, in pixels. */
const SNAP_PX = 8

export interface TimingChange {
  delay?: number
  length?: number
  outLength?: number
  endDelay?: number
  /** A new composition hold: the whole clip gets longer or shorter. */
  clipHold?: number
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
  onMusicChange,
  musicPart = null,
  onMusicPart,
  onSplitMusic,
  onTiming,
  onReorder,
  onLayerMenu,
  onLength,
  onOpenTiming,
}: {
  project: Project
  playback: ReturnType<typeof usePlayback>
  selected: string | null
  onSelect: (id: string | null) => void
  onToggleVisible: (id: string) => void
  /** Locked layers ignore clicks on the canvas. */
  onToggleLock?: (id: string) => void
  /** Changes to the music: where it plays, its parts, volume and fades. */
  onMusicChange?: (values: Partial<AudioTrack>) => void
  /** The part of the cut music picked in the timeline (Delete removes it). */
  musicPart?: string | null
  onMusicPart?: (id: string | null) => void
  /** Cut the music at the playhead (S). */
  onSplitMusic?: () => void
  /** Drag results, in seconds: where the layer starts/ends and how long its intro and outro last. */
  onTiming: (id: string, timing: TimingChange) => void
  /** Move a layer to a new stack index (0 = back). */
  onReorder: (id: string, index: number) => void
  /** Open a layer's (or the music's) actions: right-click on its row, or its ⋯ button. */
  onLayerMenu?: (id: string, at: MenuPoint) => void
  /** A new video length in seconds (the hold grows or shrinks). */
  onLength?: (seconds: number) => void
  /** Double-click on a clip: its timing in the Animate tab. */
  onOpenTiming?: (id: string) => void
}) {
  const [dragged, setDragged] = useState<string | null>(null)
  const [dropIndex, setDropIndex] = useState<number | null>(null)
  const drag = useRef<{
    id: string
    mode: DragMode
    x: number
    width: number
    t: LayerTiming
    /** Times the dragged edges snap to: other clips' edges, the playhead, start and end. */
    targets: number[]
  } | null>(null)
  const [prefs, setPrefsState] = useState(loadPrefs)
  const setPrefs = (values: Partial<Prefs>) => {
    const next = { ...prefs, ...values }
    setPrefsState(next)
    try {
      localStorage.setItem(PREFS, JSON.stringify(next))
    } catch {
      /* Optional preference. */
    }
  }
  /** The edge being dragged, and whether it snapped: drawn as a guide with its time. */
  const [guide, setGuide] = useState<{ time: number; snapped: boolean } | null>(null)
  const [zoom, setZoom] = useState(1)
  const grid = useRef<HTMLDivElement>(null)
  const ruler = useRef<HTMLDivElement>(null)
  const [rulerWidth, setRulerWidth] = useState(0)
  /** Keeps the time under the pointer in place while zooming. */
  const anchor = useRef<{ time: number; offset: number } | null>(null)
  /** A gesture on the music: moving or trimming a part, a fade or the volume. */
  const musicDrag = useRef<{
    kind: 'move' | 'start' | 'end' | 'fadeIn' | 'fadeOut' | 'volume'
    part: AudioSegment
    track: AudioTrack
    x: number
    y: number
    width: number
    height: number
    targets: number[]
  } | null>(null)
  const peaks = useAudioPeaks(p.audio?.assetId)
  const snap = (seconds: number) => Math.round(seconds * p.fps) / p.fps
  const beginDrag = (e: React.PointerEvent<HTMLElement>, l: Layer, mode: DragMode) => {
    if (e.button !== 0) return
    e.stopPropagation()
    const track = (e.currentTarget.closest('.tracks') as HTMLElement).getBoundingClientRect()
    e.currentTarget.setPointerCapture(e.pointerId)
    const targets = [0, total, playback.time]
    for (const other of p.layers) {
      if (other.id === l.id || !other.visible) continue
      const o = layerTiming(other, p)
      targets.push(
        o.delay,
        o.delay + o.length,
        total - o.endDelay - o.outLength,
        total - o.endDelay,
      )
    }
    if (p.audio && !p.audio.muted)
      for (const part of segmentsOf(p.audio, total)) targets.push(part.at, part.at + part.length)
    drag.current = {
      id: l.id,
      mode,
      x: e.clientX,
      width: track.width,
      t: layerTiming(l, p),
      targets,
    }
    onSelect(l.id)
  }
  const moveDrag = (e: React.PointerEvent<HTMLElement>) => {
    const d = drag.current
    if (!d) return
    const dt = ((e.clientX - d.x) / d.width) * total
    const { t } = d
    const room = (fixed: number) => Math.max(0, total - fixed)
    // Snap the edge being moved; Alt (or the magnet off) moves freely.
    const threshold = prefs.snap && !e.altKey ? (SNAP_PX / d.width) * total : 0
    const near = (time: number) => snapTo(time, d.targets, threshold)
    const show = (time: number, snapped: boolean) => setGuide({ time, snapped })
    if (d.mode === 'move') {
      // Slide the whole clip: its intro, hold and outro keep their lengths.
      const span = t.length + t.hold + t.outLength
      let delay = t.delay + dt
      const head = near(delay)
      const tail = near(delay + span)
      const useTail =
        tail.target !== null &&
        (head.target === null ||
          Math.abs(tail.value - (delay + span)) < Math.abs(head.value - delay))
      delay = useTail ? tail.value - span : head.value
      delay = Math.max(0, Math.min(room(span), snap(delay)))
      onTiming(d.id, { delay, endDelay: Math.max(0, snap(total - span - delay)) })
      show(useTail ? delay + span : delay, useTail ? tail.target !== null : head.target !== null)
    } else if (d.mode === 'start') {
      const max = room(t.length + t.outLength + t.endDelay)
      const at = near(t.delay + dt)
      const delay = Math.max(0, Math.min(max, snap(at.value)))
      onTiming(d.id, { delay, endDelay: t.endDelay })
      show(delay, at.target !== null)
    } else if (d.mode === 'end') {
      const max = room(t.delay + t.length + t.outLength)
      const at = near(total - t.endDelay + dt)
      const endDelay = Math.max(0, Math.min(max, snap(total - at.value)))
      onTiming(d.id, { endDelay, delay: t.delay })
      show(total - endDelay, at.target !== null)
    } else if (d.mode === 'in') {
      const max = room(t.delay + t.outLength + t.endDelay)
      const at = near(t.delay + t.length + dt)
      const length = Math.max(0.2, Math.min(max, snap(at.value - t.delay)))
      onTiming(d.id, { length })
      show(t.delay + length, at.target !== null)
    } else {
      const max = room(t.delay + t.length + t.endDelay)
      const end = total - t.endDelay
      const at = near(end - t.outLength + dt)
      const outLength = Math.max(0.2, Math.min(max, snap(end - at.value)))
      onTiming(d.id, { outLength, endDelay: t.endDelay })
      show(end - outLength, at.target !== null)
    }
  }
  const endDrag = () => {
    drag.current = null
    setGuide(null)
  }

  /* ---------- Music: move, trim, fade and level, right on its clips ---------- */
  const beginMusic = (
    e: React.PointerEvent<HTMLElement>,
    kind: NonNullable<typeof musicDrag.current>['kind'],
    part: AudioSegment,
  ) => {
    const track = p.audio
    if (e.button !== 0 || !track) return
    e.stopPropagation()
    const box = (e.currentTarget.closest('.tracks') as HTMLElement).getBoundingClientRect()
    e.currentTarget.setPointerCapture(e.pointerId)
    const targets = [0, total, playback.time]
    for (const l of p.layers) {
      if (!l.visible) continue
      const t = layerTiming(l, p)
      targets.push(t.delay, total - t.endDelay)
    }
    for (const other of segmentsOf(track, total))
      if (other.id !== part.id) targets.push(other.at, other.at + other.length)
    musicDrag.current = {
      kind,
      part,
      track,
      x: e.clientX,
      y: e.clientY,
      width: box.width,
      height: e.currentTarget.closest('.music-track')?.clientHeight ?? 36,
      targets,
    }
    onSelect(MUSIC)
    if (kind === 'move' || kind === 'start' || kind === 'end') onMusicPart?.(part.id)
  }
  const moveMusic = (e: React.PointerEvent<HTMLElement>) => {
    const d = musicDrag.current
    if (!d || !onMusicChange) return
    const dt = ((e.clientX - d.x) / d.width) * total
    const threshold = prefs.snap && !e.altKey ? (SNAP_PX / d.width) * total : 0
    const near = (time: number) => snapTo(time, d.targets, threshold)
    const { track, part } = d
    const tenth = (v: number) => Math.round(v * 10) / 10
    if (d.kind === 'volume') {
      const volume = Math.round(
        Math.max(0, Math.min(200, track.volume - ((e.clientY - d.y) / d.height) * 200)),
      )
      onMusicChange({ volume })
    } else if (d.kind === 'fadeIn') {
      onMusicChange({ fadeIn: tenth(Math.max(0, Math.min(10, track.fadeIn + dt))) })
    } else if (d.kind === 'fadeOut') {
      onMusicChange({ fadeOut: tenth(Math.max(0, Math.min(10, track.fadeOut - dt))) })
    } else if (d.kind === 'move') {
      let at = part.at + dt
      const head = near(at),
        tail = near(at + part.length)
      const useTail =
        tail.target !== null &&
        (head.target === null ||
          Math.abs(tail.value - (at + part.length)) < Math.abs(head.value - at))
      at = snap(useTail ? tail.value - part.length : head.value)
      if (!track.segments) {
        // Music that was never cut keeps playing as before; it just starts elsewhere.
        const delay = Math.max(0, Math.min(total - 0.1, at))
        onMusicChange({ delay })
        setGuide({ time: delay, snapped: head.target !== null })
      } else {
        const next = moveSegment(track, total, part.id, at)
        onMusicChange({ segments: next.segments })
        const moved = next.segments!.find((s) => s.id === part.id)!
        setGuide({
          time: useTail ? moved.at + moved.length : moved.at,
          snapped: (useTail ? tail : head).target !== null,
        })
      }
    } else {
      const edge = d.kind
      const at = near((edge === 'start' ? part.at : part.at + part.length) + dt)
      const next = trimSegment(track, total, part.id, edge, snap(at.value))
      onMusicChange({ segments: next.segments, loop: false })
      const cut = next.segments!.find((s) => s.id === part.id)!
      setGuide({
        time: edge === 'start' ? cut.at : cut.at + cut.length,
        snapped: at.target !== null,
      })
    }
  }
  const endMusic = () => {
    musicDrag.current = null
    setGuide(null)
  }
  const musicHandlers = {
    onPointerMove: moveMusic,
    onPointerUp: endMusic,
    onPointerCancel: endMusic,
  }
  const [expanded, setExpanded] = useState(() => {
    try {
      return localStorage.getItem(KEY) !== 'collapsed'
    } catch {
      return true
    }
  })
  const total = duration(p)
  const pct = (s: number) => `${(s / total) * 100}%`

  /* ---------- Zoom ---------- */
  // The ruler's width follows the zoom and the panel: it sets the tick spacing.
  useLayoutEffect(() => {
    const el = ruler.current
    if (!el || !expanded) return
    const measure = () => setRulerWidth(el.clientWidth)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [expanded])
  /** Zooms keeping the time under `clientX` (or the playhead) where it is on screen. */
  const zoomTo = (next: number, clientX?: number) => {
    const g = grid.current,
      r = ruler.current
    const z = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, next))
    if (g && r) {
      const rect = r.getBoundingClientRect()
      const gridLeft = g.getBoundingClientRect().left
      const x = clientX ?? rect.left + (playback.time / total) * rect.width
      anchor.current = {
        time: Math.max(0, Math.min(total, ((x - rect.left) / Math.max(1, rect.width)) * total)),
        offset: x - gridLeft,
      }
    }
    setZoom(z)
  }
  useLayoutEffect(() => {
    const g = grid.current,
      r = ruler.current,
      a = anchor.current
    if (!g || !r || !a) return
    anchor.current = null
    g.scrollLeft = r.offsetLeft + (a.time / total) * r.clientWidth - a.offset
  }, [zoom, total])
  // ⌘/Ctrl + wheel (and trackpad pinch) zooms at the pointer.
  const zoomRef = useRef(zoomTo)
  useEffect(() => {
    zoomRef.current = zoomTo
  })
  const zoomValue = useRef(zoom)
  useEffect(() => {
    zoomValue.current = zoom
  }, [zoom])
  useEffect(() => {
    const g = grid.current
    if (!g) return
    const wheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return
      e.preventDefault()
      zoomRef.current(zoomValue.current * Math.exp(-e.deltaY * 0.01), e.clientX)
    }
    g.addEventListener('wheel', wheel, { passive: false })
    return () => g.removeEventListener('wheel', wheel)
  }, [])
  // While playing zoomed in, the view follows the playhead.
  useEffect(() => {
    const g = grid.current,
      r = ruler.current
    if (!g || !r || zoom <= 1 || !playback.playing) return
    const x = r.offsetLeft + (playback.time / total) * r.clientWidth
    const left = g.scrollLeft + r.offsetLeft
    if (x < left || x > g.scrollLeft + g.clientWidth - 24) g.scrollLeft = x - r.offsetLeft - 24
  }, [playback.time, playback.playing, zoom, total])
  const pxPerSecond = rulerWidth / total
  const steps = rulerSteps(pxPerSecond || 1, p.fps)

  /* ---------- Height ---------- */
  const resize = useRef<{ y: number; height: number } | null>(null)
  const clampHeight = (h: number) => Math.round(Math.min(640, Math.max(120, h)))
  const toggleExpanded = () => {
    setExpanded(!expanded)
    try {
      localStorage.setItem(KEY, expanded ? 'collapsed' : 'expanded')
    } catch {
      /* Optional preference. */
    }
  }
  const still = (l: Layer) => isStill(l, p)
  const rightClick = (id: string) => (e: React.MouseEvent) => {
    if (!onLayerMenu) return
    e.preventDefault()
    onLayerMenu(id, { x: e.clientX, y: e.clientY })
  }
  const moreButton = (id: string, name: string) =>
    onLayerMenu && (
      <button
        className="eye more"
        aria-label={`Actions for ${name}`}
        aria-haspopup="menu"
        title="Move, hide, rename, duplicate, delete… (or right-click)"
        onClick={(e) => onLayerMenu(id, belowButton(e.currentTarget))}
      >
        <MoreHorizontal size={16} />
      </button>
    )
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
            className="icon-button transport-boundary is-end"
            aria-label="Go to end"
            title="Go to end"
            onClick={() => playback.seek(total)}
          >
            <ChevronLast size={18} />
          </button>
          <span className="timecode">
            <button
              className="timecode-now"
              title={
                prefs.frames
                  ? 'Minutes:seconds:frames · click for seconds'
                  : 'Seconds · click for frames'
              }
              aria-label={`Current time ${playback.time.toFixed(2)} seconds. Show ${prefs.frames ? 'seconds' : 'frames'}`}
              onClick={() => setPrefs({ frames: !prefs.frames })}
            >
              {formatTime(playback.time, p.fps, prefs.frames ? 'frames' : 'seconds')}
            </button>{' '}
            {onLength ? (
              // The video length, typed right here: the hold takes up the change.
              <span className="timecode-length" title="Video length: type a new one">
                <span aria-hidden="true">/</span>
                <NumberInput
                  label="Video length in seconds"
                  value={Math.round(total * 100) / 100}
                  min={Math.round(p.animationDuration * 200) / 100}
                  max={Math.round((p.animationDuration * 2 + MAX_HOLD) * 100) / 100}
                  step={0.1}
                  onChange={onLength}
                />
                <span aria-hidden="true">s</span>
              </span>
            ) : (
              <span>/ {total.toFixed(2)} s</span>
            )}
          </span>
        </div>
        <div className="timeline-tools">
          {expanded && (
            <div className="timeline-zoom" role="group" aria-label="Timeline view">
              <button
                className={`icon-button ${prefs.snap ? 'selected' : ''}`}
                aria-label="Snap clips"
                aria-pressed={prefs.snap}
                title="Snap to the playhead and other clips (hold Alt to move freely)"
                onClick={() => setPrefs({ snap: !prefs.snap })}
              >
                <Magnet size={18} />
              </button>
              <button
                className="icon-button"
                aria-label="Zoom out of the timeline"
                title="Zoom out (⌘ + scroll)"
                disabled={zoom <= MIN_ZOOM}
                onClick={() => zoomTo(zoom / 1.5)}
              >
                <ZoomOut size={18} />
              </button>
              <button
                className="icon-button"
                aria-label="Zoom in to the timeline"
                title="Zoom in (⌘ + scroll)"
                disabled={zoom >= MAX_ZOOM}
                onClick={() => zoomTo(zoom * 1.5)}
              >
                <ZoomIn size={18} />
              </button>
              {zoom > MIN_ZOOM && (
                <button
                  className="button ghost sm timeline-fit"
                  title="Show the whole clip"
                  onClick={() => zoomTo(MIN_ZOOM)}
                >
                  Fit
                </button>
              )}
            </div>
          )}
          {p.audio && onSplitMusic && (
            <button
              className="icon-button"
              aria-label="Cut the music at the playhead"
              title="Cut the music at the playhead (S)"
              disabled={!partAt(p.audio, total, playback.time)}
              onClick={onSplitMusic}
            >
              <Scissors size={18} />
            </button>
          )}
          <button
            className={`icon-button ${playback.loop ? 'selected' : ''}`}
            aria-label="Loop playback"
            aria-pressed={playback.loop}
            title="Loop"
            onClick={() => playback.setLoop(!playback.loop)}
          >
            <Repeat2 size={18} />
          </button>
        </div>
      </div>
      {!expanded && <div className="compact-scrubber">{scrubber('compact-playhead')}</div>}
      {expanded && (
        // Drag the top edge of the layers to give them more or less room.
        <div
          className="timeline-resize"
          role="separator"
          aria-orientation="horizontal"
          aria-label="Timeline height"
          aria-valuemin={120}
          aria-valuemax={640}
          aria-valuenow={prefs.height}
          tabIndex={0}
          title="Drag to resize the timeline"
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId)
            resize.current = { y: e.clientY, height: prefs.height }
          }}
          onPointerMove={(e) => {
            const r = resize.current
            if (r) setPrefsState({ ...prefs, height: clampHeight(r.height - (e.clientY - r.y)) })
          }}
          onPointerUp={() => {
            if (!resize.current) return
            resize.current = null
            setPrefs({ height: prefs.height })
          }}
          onKeyDown={(e) => {
            if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return
            e.preventDefault()
            e.stopPropagation()
            setPrefs({ height: clampHeight(prefs.height + (e.key === 'ArrowUp' ? 24 : -24)) })
          }}
        />
      )}
      <div
        id="timeline-details"
        ref={grid}
        className={`timeline-grid ${zoom > MIN_ZOOM ? 'is-zoomed' : ''}`}
        hidden={!expanded}
        style={
          {
            '--timeline-zoom': zoom,
            '--timeline-height': `${prefs.height}px`,
          } as React.CSSProperties
        }
      >
        <div className="ruler-label" aria-hidden="true" />
        <div
          className="ruler"
          ref={ruler}
          style={
            {
              '--minor-step': steps.minor ? `${steps.minor * pxPerSecond}px` : '0px',
            } as React.CSSProperties
          }
        >
          {rulerWidth > 0 &&
            rulerTicks(total, steps.major).map((time) => (
              <span key={time} className="tick" aria-hidden="true" style={{ left: pct(time) }}>
                {time * pxPerSecond < rulerWidth - 32 && tickLabel(time, steps.major)}
              </span>
            ))}
          {scrubber('timeline-scrubber')}
        </div>
        <ol className="layer-labels" aria-label="Layers, front to back">
          {layers.map((l, row) => {
            const name = l.name
            // Dropping moves the dragged layer to this row's place: dragged down,
            // it lands below this layer; dragged up, above it.
            const from = dragged ? layers.findIndex((d) => d.id === dragged) : -1
            const drop =
              dropIndex === row && dragged && dragged !== l.id
                ? from < row
                  ? 'drop-after'
                  : 'drop-before'
                : ''
            return (
              <li
                key={l.id}
                className={`layer-label ${l.id === selected ? 'selected' : ''} ${l.visible ? '' : 'is-hidden'} ${l.locked ? 'is-locked' : ''} ${dragged === l.id ? 'is-dragging' : ''} ${drop}`}
                draggable
                title="Drag to reorder · Right-click for actions"
                onContextMenu={rightClick(l.id)}
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
                  {l.kind === 'chyron' ? (
                    styleOf(p, l).mode === 'typography' && !styleOf(p, l).subtitlePill ? (
                      <LetterText size={14} aria-hidden="true" />
                    ) : (
                      <Type size={14} aria-hidden="true" />
                    )
                  ) : l.kind === 'shape' ? (
                    <Shapes size={14} aria-hidden="true" />
                  ) : (
                    <ImageIcon size={14} aria-hidden="true" />
                  )}
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
                {moreButton(l.id, name)}
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
                onContextMenu={rightClick(l.id)}
              >
                <div
                  className={`clip ${l.kind === 'chyron' ? 'title-clip' : l.kind === 'shape' ? 'shape-clip' : 'image-clip'} ${l.visible ? '' : 'is-hidden'}`}
                  style={{ marginLeft: pct(t.delay), width: pct(width) }}
                  title={`In ${t.length.toFixed(2)}s · Hold ${t.hold.toFixed(2)}s · Out ${t.outLength.toFixed(2)}s — drag to move, double-click for timing`}
                  onPointerDown={(e) => beginDrag(e, l, 'move')}
                  onDoubleClick={() => onOpenTiming?.(l.id)}
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
                    {l.kind === 'chyron'
                      ? styleOf(p, l).text.replace(/\n/g, ' ') || l.name
                      : l.name}
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
          {guide && (
            <div
              className={`snap-guide ${guide.snapped ? 'is-snapped' : ''}`}
              style={{ left: pct(guide.time) }}
              aria-hidden="true"
            >
              <span>{formatTime(guide.time, p.fps, prefs.frames ? 'frames' : 'seconds')}</span>
            </div>
          )}
          <div className="playhead" style={{ left: `${(playback.time / total) * 100}%` }}>
            <span />
          </div>
        </div>
        {p.audio && (
          <>
            <div
              className={`layer-label music-label ${selected === MUSIC ? 'selected' : ''} ${p.audio.muted ? 'is-hidden' : ''}`}
              onContextMenu={rightClick(MUSIC)}
            >
              <button
                className="eye"
                aria-label={`${p.audio.muted ? 'Unmute' : 'Mute'} music`}
                aria-pressed={p.audio.muted}
                title={p.audio.muted ? 'Unmute' : 'Mute'}
                onClick={() => onMusicChange?.({ muted: !p.audio!.muted })}
              >
                {p.audio.muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
              </button>
              <button
                className="layer-name"
                aria-pressed={selected === 'audio'}
                onClick={() => onSelect(selected === 'audio' ? null : 'audio')}
              >
                <Music size={14} aria-hidden="true" />
                <span>{p.audio.name}</span>
              </button>
              {moreButton(MUSIC, p.audio.name)}
            </div>
            <div className="tracks music-tracks">
              {(() => {
                const track = p.audio!
                const audible = { ...track, muted: false }
                const parts = segmentsOf(audible, total)
                const envelope = musicEnvelope(audible, total)
                const start = parts[0]?.at ?? 0
                const span = Math.max(0.001, (envelope.at(-1)?.[0] ?? start) - start)
                const fadeIn = envelope.length ? envelope[1][0] - envelope[0][0] : 0
                const fadeOut = envelope.length ? envelope[3][0] - envelope[2][0] : 0
                // Gain 0–2 (0–200 %) from the bottom to the top of the row.
                const y = (gain: number) => (1 - gain / 2) * 100
                const x = (t: number) => ((t - start) / span) * 100
                const cut = !!track.segments
                return (
                  <div
                    className={`track music-track ${selected === MUSIC ? 'selected' : ''} ${selected === MUSIC && parts.some((x) => x.id === musicPart) ? 'has-pick' : ''}`}
                    aria-hidden="true"
                    onClick={() => {
                      onSelect(MUSIC)
                      onMusicPart?.(null)
                    }}
                    onContextMenu={rightClick(MUSIC)}
                  >
                    {parts.map((part, i) => (
                      <div
                        key={part.id}
                        className={`clip audio-clip music-part ${track.muted ? 'is-hidden' : ''} ${selected === MUSIC && musicPart === part.id ? 'is-picked' : ''}`}
                        style={{ left: pct(part.at), width: pct(part.length) }}
                        title={`${cut ? `Part ${i + 1} · ` : ''}${part.at.toFixed(2)}–${(part.at + part.length).toFixed(2)}s, song from ${part.from.toFixed(2)}s — drag to move, drag an end to trim, S cuts at the playhead`}
                        onPointerDown={(e) => beginMusic(e, 'move', part)}
                        onClick={(e) => {
                          e.stopPropagation()
                          onSelect(MUSIC)
                          onMusicPart?.(part.id)
                        }}
                        {...musicHandlers}
                      >
                        <Waveform
                          peaks={peaks}
                          length={track.length}
                          from={part.from}
                          to={part.from + part.length}
                          loopFrom={part.from}
                        />
                        <i
                          className="clip-edge start"
                          title="Drag to trim the start"
                          onPointerDown={(e) => beginMusic(e, 'start', part)}
                          {...musicHandlers}
                        />
                        <i
                          className="clip-edge end"
                          title="Drag to trim the end"
                          onPointerDown={(e) => beginMusic(e, 'end', part)}
                          {...musicHandlers}
                        />
                      </div>
                    ))}
                    {envelope.length > 0 && (
                      // Volume and fades over the whole music: drag the line or the corner dots.
                      <div
                        className={`music-envelope ${track.muted ? 'is-hidden' : ''}`}
                        style={{ left: pct(start), width: pct(span) }}
                      >
                        <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                          <polyline
                            points={envelope.map(([t, g]) => `${x(t)},${y(g)}`).join(' ')}
                            vectorEffect="non-scaling-stroke"
                          />
                        </svg>
                        <i
                          className="volume-handle"
                          style={{
                            top: `${y(track.volume / 100)}%`,
                            left: `${(x(start + fadeIn) + x(start + span - fadeOut)) / 2}%`,
                          }}
                          title={`Volume ${track.volume}% — drag up or down`}
                          onPointerDown={(e) => beginMusic(e, 'volume', parts[0])}
                          {...musicHandlers}
                        />
                        <i
                          className="fade-handle in"
                          style={{
                            left: `${x(start + fadeIn)}%`,
                            top: `${y(track.volume / 100)}%`,
                          }}
                          title={`Fade in ${fadeIn.toFixed(1)}s — drag sideways`}
                          onPointerDown={(e) => beginMusic(e, 'fadeIn', parts[0])}
                          {...musicHandlers}
                        />
                        <i
                          className="fade-handle out"
                          style={{
                            left: `${x(start + span - fadeOut)}%`,
                            top: `${y(track.volume / 100)}%`,
                          }}
                          title={`Fade out ${fadeOut.toFixed(1)}s — drag sideways`}
                          onPointerDown={(e) => beginMusic(e, 'fadeOut', parts.at(-1)!)}
                          {...musicHandlers}
                        />
                      </div>
                    )}
                  </div>
                )
              })()}
              <div className="playhead" style={{ left: `${(playback.time / total) * 100}%` }} />
            </div>
          </>
        )}
      </div>
    </section>
  )
}
