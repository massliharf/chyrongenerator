import { useEffect, useRef, type PointerEvent } from 'react'
import { Replace, Trash2 } from 'lucide-react'
import { NumberField, Toggle } from './Controls'
import { clock } from './inspectorHooks'
import { duration, type AudioTrack, type Project } from '../studio/model'
import { musicWindow } from '../studio/audio'
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
}: {
  project: Project
  track: AudioTrack
  onChange: (values: Partial<AudioTrack>) => void
  onReplace: () => void
  onRemove: () => void
}) {
  const total = duration(p)
  const peaks = useAudioPeaks(track.assetId)
  const plays = musicWindow({ ...track, muted: false }, total)
  const used = Math.max(0, plays.end - plays.start)
  const round = (v: number) => Math.round(v * 10) / 10
  const drag = useRef<{ x: number; width: number; trim: number } | null>(null)
  const slide = {
    onPointerDown: (e: PointerEvent<HTMLDivElement>) => {
      if (e.button !== 0) return
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
        <span className="block-label">Song · {clock(track.length)}</span>
        <div
          className="music-overview"
          role="slider"
          aria-label="Part of the song that plays"
          aria-valuemin={0}
          aria-valuemax={track.length}
          aria-valuenow={track.trim}
          aria-valuetext={`From ${clock(track.trim)}`}
          tabIndex={0}
          title="Drag to choose which part of the song plays"
          onKeyDown={(e) => {
            if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
            e.preventDefault()
            const step = (e.shiftKey ? 5 : 0.5) * (e.key === 'ArrowRight' ? 1 : -1)
            onChange({ trim: round(Math.max(0, Math.min(track.length - 0.1, track.trim + step))) })
          }}
          {...slide}
        >
          <Waveform peaks={peaks} length={track.length} from={0} to={track.length} />
          <span
            className="music-overview-window"
            style={{
              left: `${(track.trim / track.length) * 100}%`,
              width: `${Math.min(100 - (track.trim / track.length) * 100, (shown / track.length) * 100)}%`,
            }}
          />
        </div>
        <NumberField
          label="Song starts at"
          value={track.trim}
          min={0}
          max={Math.max(0, track.length - 0.1)}
          step={0.1}
          unit="s"
          hint={clock(track.trim)}
          onChange={(trim) => onChange({ trim })}
        />
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
        <NumberField
          label="Starts at"
          value={track.delay}
          min={0}
          max={Math.max(0, round(total - 0.1))}
          step={0.1}
          unit="s"
          onChange={(delay) => onChange({ delay })}
        />
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
        <Toggle
          label="Loop"
          hint="Start the song again if it ends before the clip"
          checked={track.loop}
          onChange={(loop) => onChange({ loop })}
        />
        <Toggle
          label="Mute"
          hint="Silence it in the preview and the export"
          checked={track.muted}
          onChange={(muted) => onChange({ muted })}
        />
        <p className="block-note">
          Plays {round(used)}s of the song. WebM and ProRes exports include the music; a PNG
          sequence adds it as music.wav.
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
