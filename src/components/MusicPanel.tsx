import { useEffect, useRef, type PointerEvent } from 'react'
import { Combine, Replace, Scissors, Trash2 } from 'lucide-react'
import { NumberField, Toggle } from './Controls'
import { clock } from './inspectorHooks'
import { duration, type AudioTrack, type Project } from '../studio/model'
import { MIN_PART, moveSegment, musicWindow, segmentsOf, trimSegment } from '../studio/audio'
import { useAudioPeaks } from '../studio/useAudioPeaks'

/** Bars for the part of the song between `from` and `to` seconds. */
export function Waveform({
  peaks,
  length,
  from,
  to,
  loopFrom = 0,
  className = '',
}: {
  peaks: Float32Array | null
  length: number
  from: number
  to: number
  /** Where the song restarts when the window runs past its end. */
  loopFrom?: number
  className?: string
}) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const draw = () => {
      const ratio = Math.min(2, window.devicePixelRatio || 1)
      const w = Math.max(1, Math.round(canvas.clientWidth * ratio))
      const h = Math.max(1, Math.round(canvas.clientHeight * ratio))
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w
        canvas.height = h
      }
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.clearRect(0, 0, w, h)
      if (!peaks || length <= 0) return
      ctx.fillStyle = getComputedStyle(canvas).color
      const bar = Math.max(1, Math.round(2 * ratio))
      const gap = Math.max(1, Math.round(ratio))
      for (let x = 0; x < w; x += bar + gap) {
        // Loop the song when the window runs past its end.
        const t = from + ((to - from) * x) / w
        const s = t < length ? t : loopFrom + ((t - loopFrom) % Math.max(0.001, length - loopFrom))
        const v = peaks[Math.min(peaks.length - 1, Math.floor((s / length) * peaks.length))]
        const bh = Math.max(ratio, v * h * 0.9)
        ctx.fillRect(x, (h - bh) / 2, bar, bh)
      }
    }
    draw()
    const observer = new ResizeObserver(draw)
    observer.observe(canvas)
    return () => observer.disconnect()
  }, [peaks, length, from, to, loopFrom])
  return <canvas ref={ref} className={`waveform ${className}`} aria-hidden="true" />
}

export function MusicPanel({
  project: p,
  track,
  onChange,
  onReplace,
  onRemove,
  part: partId = null,
  onPart,
  onSplit,
  canSplit = false,
  onRemovePart,
  onJoin,
}: {
  project: Project
  track: AudioTrack
  onChange: (values: Partial<AudioTrack>) => void
  onReplace: () => void
  onRemove: () => void
  /** The picked part of the cut music. */
  part?: string | null
  onPart?: (id: string | null) => void
  /** Cut at the playhead; `canSplit` when the music plays there. */
  onSplit?: () => void
  canSplit?: boolean
  onRemovePart?: (id: string) => void
  onJoin?: () => void
}) {
  const total = duration(p)
  const cut = !!track.segments
  const parts = segmentsOf({ ...track, muted: false }, total)
  const picked = parts.find((x) => x.id === partId) ?? null
  const peaks = useAudioPeaks(track.assetId)
  const plays = musicWindow({ ...track, muted: false }, total)
  const used = Math.max(0, plays.end - plays.start)
  const round = (v: number) => Math.round(v * 10) / 10
  const drag = useRef<{ x: number; width: number; trim: number } | null>(null)
  const slide = {
    onPointerDown: (e: PointerEvent<HTMLDivElement>) => {
      if (e.button !== 0 || cut) return
      e.currentTarget.setPointerCapture(e.pointerId)
      drag.current = {
        x: e.clientX,
        width: e.currentTarget.getBoundingClientRect().width,
        trim: track.trim,
      }
    },
    onPointerMove: (e: PointerEvent<HTMLDivElement>) => {
      const d = drag.current
      if (!d) return
      const trim = d.trim + ((e.clientX - d.x) / d.width) * track.length
      onChange({ trim: round(Math.max(0, Math.min(track.length - 0.1, trim))) })
    },
    onPointerUp: () => {
      drag.current = null
    },
  }
  const shown = Math.min(used, track.length)
  return (
    <div className="props-stack music-panel">
      <div className="block">
        <span className="block-label">Song · {clock(track.length)} long</span>
        <div
          className="music-overview"
          role="slider"
          aria-label="Part of the song that plays"
          aria-valuemin={0}
          aria-valuemax={track.length}
          aria-valuenow={track.trim}
          aria-valuetext={`From ${clock(track.trim)}`}
          tabIndex={cut ? -1 : 0}
          aria-disabled={cut}
          title={
            cut ? 'The parts of the song that play' : 'Drag to choose which part of the song plays'
          }
          onKeyDown={(e) => {
            if (cut || (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight')) return
            e.preventDefault()
            const step = (e.shiftKey ? 5 : 0.5) * (e.key === 'ArrowRight' ? 1 : -1)
            onChange({ trim: round(Math.max(0, Math.min(track.length - 0.1, track.trim + step))) })
          }}
          {...slide}
        >
          <Waveform peaks={peaks} length={track.length} from={0} to={track.length} />
          {cut ? (
            // Every part, where it comes from in the song.
            parts.map((x) => (
              <span
                key={x.id}
                className={`music-overview-window ${x.id === partId ? 'is-picked' : ''}`}
                style={{
                  left: `${(x.from / track.length) * 100}%`,
                  width: `${(x.length / track.length) * 100}%`,
                }}
              />
            ))
          ) : (
            <span
              className="music-overview-window"
              style={{
                left: `${(track.trim / track.length) * 100}%`,
                width: `${Math.min(100 - (track.trim / track.length) * 100, (shown / track.length) * 100)}%`,
              }}
            />
          )}
        </div>
        {!cut && (
          <>
            <NumberField
              label="Play the song from"
              value={track.trim}
              min={0}
              max={Math.max(0, track.length - 0.1)}
              step={0.1}
              unit="s"
              onChange={(trim) => onChange({ trim })}
            />
            <p className="block-note">
              Plays from {clock(track.trim)}. Drag the highlighted part of the song to choose
              another part.
            </p>
          </>
        )}
      </div>
      <div className="block">
        <span className="block-label">Cut</span>
        <div className="button-row">
          <button
            className="button secondary sm"
            disabled={!canSplit}
            title="Cut the music at the playhead (S)"
            onClick={onSplit}
          >
            <Scissors size={14} aria-hidden="true" /> Cut at playhead
          </button>
          {cut && onJoin && (
            <button className="button ghost sm" onClick={onJoin}>
              <Combine size={14} aria-hidden="true" /> Join the parts
            </button>
          )}
        </div>
        {cut ? (
          <>
            <div className="music-parts" role="group" aria-label="Parts of the music">
              {parts.map((x, i) => (
                <button
                  key={x.id}
                  className="music-part-row"
                  aria-pressed={x.id === partId}
                  onClick={() => onPart?.(x.id === partId ? null : x.id)}
                >
                  <span>Part {i + 1}</span>
                  <small>
                    {x.at.toFixed(2)}–{(x.at + x.length).toFixed(2)} s · song {clock(x.from)}
                  </small>
                </button>
              ))}
            </div>
            {picked ? (
              <>
                <NumberField
                  label="Part starts at"
                  value={round(picked.at)}
                  min={0}
                  max={Math.max(0, round(total - MIN_PART))}
                  step={0.1}
                  unit="s"
                  onChange={(at) =>
                    onChange({ segments: moveSegment(track, total, picked.id, at).segments })
                  }
                />
                <NumberField
                  label="Part plays the song from"
                  value={round(picked.from)}
                  min={0}
                  max={Math.max(0, round(track.length - MIN_PART))}
                  step={0.1}
                  unit="s"
                  onChange={(from) =>
                    onChange({
                      segments: track.segments!.map((x) =>
                        x.id === picked.id
                          ? {
                              ...x,
                              from,
                              length: Math.max(MIN_PART, Math.min(x.length, track.length - from)),
                            }
                          : x,
                      ),
                    })
                  }
                />
                <NumberField
                  label="Part length"
                  value={round(picked.length)}
                  min={MIN_PART}
                  max={Math.max(MIN_PART, round(track.length - picked.from))}
                  step={0.1}
                  unit="s"
                  onChange={(length) =>
                    onChange({
                      segments: trimSegment(track, total, picked.id, 'end', picked.at + length)
                        .segments,
                    })
                  }
                />
                {onRemovePart && (
                  <button className="button ghost sm" onClick={() => onRemovePart(picked.id)}>
                    <Trash2 size={14} aria-hidden="true" /> Delete this part
                  </button>
                )}
              </>
            ) : (
              <p className="block-note">
                Pick a part here or in the timeline to move, trim or delete it.
              </p>
            )}
          </>
        ) : (
          <p className="block-note">
            Put the playhead where the music should be cut and press S. Then drag a part's ends in
            the timeline to trim it, or pick it and press Delete.
          </p>
        )}
      </div>
      <div className="block">
        <span className="block-label">In the clip</span>
        <NumberField
          label="Volume"
          value={track.volume}
          min={0}
          max={200}
          unit="%"
          onChange={(volume) => onChange({ volume })}
        />
        {!cut && (
          <NumberField
            label="Starts at"
            value={track.delay}
            min={0}
            max={Math.max(0, round(total - 0.1))}
            step={0.1}
            unit="s"
            onChange={(delay) => onChange({ delay })}
          />
        )}
        <NumberField
          label="Fade in"
          value={track.fadeIn}
          min={0}
          max={10}
          step={0.1}
          unit="s"
          onChange={(fadeIn) => onChange({ fadeIn })}
        />
        <NumberField
          label="Fade out"
          value={track.fadeOut}
          min={0}
          max={10}
          step={0.1}
          unit="s"
          onChange={(fadeOut) => onChange({ fadeOut })}
        />
        {!cut && (
          <Toggle
            label="Loop"
            hint="Start the song again if it ends before the clip"
            checked={track.loop}
            onChange={(loop) => onChange({ loop })}
          />
        )}
        <Toggle
          label="Mute"
          hint="Silence it in the preview and the export"
          checked={track.muted}
          onChange={(muted) => onChange({ muted })}
        />
        <p className="block-note">
          Plays {round(used)}s of the song. In the timeline, drag the music to move it, its round
          handles for the fades and the bar in the middle for the volume. WebM and ProRes exports
          include the music; a PNG sequence adds it as music.wav.
        </p>
      </div>
      <div className="button-row music-actions">
        <button className="button secondary sm" onClick={onReplace}>
          <Replace size={14} aria-hidden="true" /> Replace music
        </button>
        <button className="button ghost sm" onClick={onRemove}>
          <Trash2 size={14} aria-hidden="true" /> Remove
        </button>
      </div>
    </div>
  )
}
