import { memo, useEffect, useMemo, useRef, useState } from 'react'
import { LoaderCircle, RotateCcw } from 'lucide-react'
import { loadFonts, type Fonts } from '../studio/fonts'
import { buildScene, renderFrame } from '../studio/renderer'
import type { Project } from '../studio/model'

export const Composition = memo(function Composition({
  project,
  time,
  thumbnail = false,
}: {
  project: Project
  time: number
  thumbnail?: boolean
}) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const [loaded, setLoaded] = useState<{ fonts: Fonts; name: string } | null>(null)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
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
        style={{ opacity: ready ? 1 : 0 }}
      />
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
