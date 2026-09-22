import { useState } from 'react'
import {
  ChevronDown,
  ChevronFirst,
  ChevronLast,
  Pause,
  Play,
  Repeat2,
  RotateCcw,
} from 'lucide-react'
import { duration, frameCount, type Project } from '../studio/model'
import type { usePlayback } from '../studio/usePlayback'

export function Timeline({
  project: p,
  playback,
}: {
  project: Project
  playback: ReturnType<typeof usePlayback>
}) {
  const [expanded, setExpanded] = useState(() => {
    try {
      return localStorage.getItem('chyron-studio:timeline') === 'expanded'
    } catch {
      return false
    }
  })
  const total = duration(p)
  const toggleExpanded = () => {
    setExpanded(!expanded)
    try {
      localStorage.setItem('chyron-studio:timeline', expanded ? 'collapsed' : 'expanded')
    } catch {
      /* Layout preferences are optional. */
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
  return (
    <section
      className={`timeline ${expanded ? 'is-expanded' : ''}`}
      aria-label="Animation timeline"
    >
      <div className="timeline-toolbar">
        <button
          className="timeline-title"
          aria-label={expanded ? 'Collapse timeline' : 'Expand timeline'}
          aria-expanded={expanded}
          aria-controls="timeline-details"
          onClick={toggleExpanded}
        >
          <ChevronDown size={20} />
          <span>Timeline</span>
          <span className="subtle">{frameCount(p)} frames</span>
        </button>
        <div className="transport">
          <button
            className="icon-button transport-boundary"
            aria-label="Go to start"
            title="Go to start"
            onClick={() => playback.seek(0)}
          >
            <ChevronFirst size={20} />
          </button>
          <button
            className="play-button"
            aria-label={playback.playing ? 'Pause animation' : 'Play animation'}
            title="Play / pause (Space)"
            onClick={playback.toggle}
          >
            {playback.playing ? (
              <Pause size={20} fill="currentColor" />
            ) : (
              <Play size={20} fill="currentColor" />
            )}
          </button>
          <button
            className="icon-button transport-boundary"
            aria-label="Go to end"
            title="Go to end"
            onClick={() => playback.seek(total)}
          >
            <ChevronLast size={20} />
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
            title="Loop playback"
            onClick={() => playback.setLoop(!playback.loop)}
          >
            <Repeat2 size={20} />
          </button>
          <button
            className="icon-button"
            aria-label="Replay animation"
            title="Replay"
            onClick={() => playback.play(true)}
          >
            <RotateCcw size={20} />
          </button>
        </div>
      </div>
      {!expanded && <div className="compact-scrubber">{scrubber('compact-playhead')}</div>}
      <div id="timeline-details" hidden={!expanded}>
        <div className="timeline-body">
          <div className="track-labels">
            <span />
            <span>Title</span>
            <span>Subtitle</span>
          </div>
          <div className="tracks">
            <div className="ruler">
              {Array.from({ length: 5 }, (_, i) => (
                <span key={i} style={{ left: `${(i / 4) * 100}%` }}>
                  {((i / 4) * total).toFixed(1)}s
                </span>
              ))}
            </div>
            <div className="track">
              <div className="clip title-clip">
                <span
                  className="clip-in"
                  title={`Intro · ${p.animationDuration}s`}
                  style={{ width: `${(p.animationDuration / total) * 100}%` }}
                >
                  {p.motion === 'none' ? 'Still' : 'Intro'}
                </span>
                <span className="clip-hold" style={{ width: `${(p.hold / total) * 100}%` }}>
                  {p.hold > 0.7 ? p.text.replace(/\n/g, ' ') || 'Title' : ''}
                </span>
                <span
                  className="clip-out"
                  title={`Outro · ${p.animationDuration}s`}
                  style={{ width: `${(p.animationDuration / total) * 100}%` }}
                >
                  Outro
                </span>
              </div>
            </div>
            <div className="track">
              <div className={`clip subtitle-clip ${!p.subtitle ? 'empty' : ''}`}>
                <span>{p.subtitle || 'No subtitle'}</span>
              </div>
            </div>
            <div className="playhead" style={{ left: `${(playback.time / total) * 100}%` }}>
              <span />
            </div>
            {expanded && scrubber('timeline-scrubber')}
          </div>
        </div>
        <div className="timeline-bottom">
          <span>
            <kbd>Space</kbd> Play / pause{' '}
            <span className="keyboard-hint">
              · <kbd>←</kbd>
              <kbd>→</kbd> Step frames
            </span>
          </span>
          <span>{p.motion === 'none' ? 'Still composition' : 'Intro · Hold · Outro'}</span>
        </div>
      </div>
    </section>
  )
}
