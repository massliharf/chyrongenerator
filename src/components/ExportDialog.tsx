import { imageLayers } from '../studio/model'
import { useEffect, useRef, useState } from 'react'
import {
  Check,
  CheckCheck,
  Download,
  FileImage,
  Film,
  Image,
  Layers,
  LoaderCircle,
  X,
} from 'lucide-react'
import {
  exportAvailability,
  exportDescription,
  exportProject,
  keepAwake,
  maxVideoSeconds,
  saveBlob,
  type ExportFormat,
  type ExportProgress,
} from '../studio/export'
import { frameCount, restTime, type Project } from '../studio/model'
import { Composition } from './Composition'

const formats = [
  {
    id: 'webm',
    title: 'WebM',
    badge: 'Alpha',
    copy: 'Video for OBS and the web',
    Icon: Film,
  },
  {
    id: 'mov',
    title: 'ProRes 4444',
    badge: '.mov',
    copy: 'For Premiere, After Effects, Final Cut',
    Icon: Film,
  },
  {
    id: 'sequence',
    title: 'PNG sequence',
    badge: '.zip',
    copy: 'Lossless frames, fastest to export',
    Icon: Layers,
  },
  {
    id: 'png',
    title: 'PNG image',
    badge: '.png',
    copy: 'A single still frame',
    Icon: Image,
  },
  {
    id: 'svg',
    title: 'SVG vector',
    badge: '.svg',
    copy: 'Scalable, outlined lettering',
    Icon: FileImage,
  },
] as const
export function ExportDialog({
  project,
  time,
  onClose,
}: {
  project: Project
  time: number
  onClose: () => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const controller = useRef<AbortController | null>(null)
  const [format, setFormat] = useState<ExportFormat>('webm')
  const [progress, setProgress] = useState<ExportProgress | null>(null)
  const [error, setError] = useState('')
  const [done, setDone] = useState<{ blob: Blob; filename: string } | null>(null)
  const [useCurrentFrame, setUseCurrentFrame] = useState(false)
  const [withMusic, setWithMusic] = useState(true)
  const still = format === 'png' || format === 'svg'
  const unavailable = exportAvailability(format, project)
  const music =
    project.audio && !project.audio.muted && project.audio.volume > 0 ? project.audio : null
  // While exporting, the tab title shows progress, so it can be followed from another app.
  useEffect(() => {
    if (!progress) return
    const title = document.title
    document.title = `${Math.round(progress.progress * 100)}% · Exporting — ${title.replace(/^\d+% · Exporting — /, '')}`
    return () => {
      document.title = title
    }
  }, [progress])
  useEffect(() => {
    dialog.current?.showModal()
    return () => {
      controller.current?.abort()
    }
  }, [])
  const start = async () => {
    const ctrl = new AbortController()
    controller.current = ctrl
    setError('')
    setDone(null)
    setProgress({ progress: 0, label: 'Getting ready…' })
    try {
      const result = await keepAwake(() =>
        exportProject(
          { ...project },
          format,
          useCurrentFrame ? time : restTime(project),
          ctrl.signal,
          setProgress,
          { music: withMusic },
        ),
      )
      if (!ctrl.signal.aborted) {
        setDone(result)
        saveBlob(result.blob, result.filename)
      }
    } catch (e) {
      if (!ctrl.signal.aborted) {
        console.error(e)
        setError(e instanceof Error ? e.message : 'Export failed. Please try again.')
      }
    } finally {
      setProgress(null)
      controller.current = null
    }
  }
  const close = () => {
    controller.current?.abort()
    dialog.current?.close()
    onClose()
  }
  return (
    <dialog
      ref={dialog}
      className="dialog dialog-lg export-dialog"
      aria-labelledby="export-title"
      onCancel={(e) => {
        e.preventDefault()
        close()
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) close()
      }}
    >
      <div className="dialog-header">
        <div>
          <h2 id="export-title">Export</h2>
          <p>Transparent background in every format</p>
        </div>
        <button className="icon-button" aria-label="Close export" onClick={close}>
          <X size={19} />
        </button>
      </div>
      <div className="dialog-body export-content">
        <div className="export-layout">
          <div className="export-preview">
            <div
              className="checker"
              style={{
                maxWidth: `calc(var(--export-preview-height, 320px) * ${project.width / project.height})`,
              }}
            >
              <Composition
                project={project}
                time={still && useCurrentFrame ? time : restTime(project)}
              />
            </div>
            <div className="export-preview-caption">
              <span>{project.name}</span>
              <span>
                {exportDescription(project)}
                {still ? '' : ` · ${frameCount(project)} frames`}
              </span>
            </div>
          </div>
          <div className="format-options" role="radiogroup" aria-label="Export format">
            {formats.map((f) => (
              <button
                key={f.id}
                role="radio"
                aria-checked={format === f.id}
                tabIndex={format === f.id ? 0 : -1}
                disabled={!!progress}
                className={`format-option ${format === f.id ? 'selected' : ''}`}
                onClick={() => {
                  setFormat(f.id)
                  setDone(null)
                  setError('')
                }}
                onKeyDown={(event) => {
                  const index = formats.findIndex((item) => item.id === format)
                  let next: number | undefined
                  if (event.key === 'ArrowDown' || event.key === 'ArrowRight')
                    next = (index + 1) % formats.length
                  if (event.key === 'ArrowUp' || event.key === 'ArrowLeft')
                    next = (index + formats.length - 1) % formats.length
                  if (event.key === 'Home') next = 0
                  if (event.key === 'End') next = formats.length - 1
                  if (next !== undefined) {
                    event.preventDefault()
                    setFormat(formats[next].id)
                    setDone(null)
                    setError('')
                    event.currentTarget.parentElement
                      ?.querySelectorAll<HTMLButtonElement>('[role="radio"]')
                      .item(next)
                      ?.focus()
                  }
                }}
              >
                <f.Icon size={20} />
                <span>
                  <span className="format-title">
                    {f.title} <small>{f.badge}</small>
                  </span>
                  <span className="format-copy">{f.copy}</span>
                </span>
                <span className="radio-indicator">{format === f.id && <Check size={11} />}</span>
              </button>
            ))}
          </div>
        </div>
        {still && (
          <label className="current-frame">
            <input
              type="checkbox"
              checked={useCurrentFrame}
              disabled={!!progress}
              onChange={(e) => {
                setUseCurrentFrame(e.target.checked)
                setDone(null)
              }}
            />{' '}
            Export the current playhead frame ({time.toFixed(2)} s)
          </label>
        )}
        {music && !still && (
          <label className="current-frame">
            <input
              type="checkbox"
              checked={withMusic}
              disabled={!!progress}
              onChange={(e) => {
                setWithMusic(e.target.checked)
                setDone(null)
              }}
            />{' '}
            {format === 'sequence'
              ? `Add the music as music.wav (${music.name})`
              : `Include the music (${music.name})`}
          </label>
        )}
        {!progress && (format === 'webm' || format === 'mov') && (
          <p className="export-footnote">
            {format === 'mov' ? 'ProRes' : 'VP9'} encoder loads on first use · up to Full HD and{' '}
            {maxVideoSeconds(project, format)} s at this size
            {imageLayers(project).some((l) => l.visible)
              ? ' · photos slow video exports; PNG sequence is fastest'
              : ''}
          </p>
        )}
        {(error || unavailable) && (
          <div className="alert alert-danger" role="alert">
            {error || unavailable}
          </div>
        )}
        {progress && (
          <div className="export-progress" aria-live="polite">
            <div>
              <span>{progress.label}</span>
              <strong>{Math.round(progress.progress * 100)}%</strong>
            </div>
            <progress aria-label="Export progress" max={1} value={progress.progress} />
          </div>
        )}
        {done && (
          <div className="alert alert-success" role="status">
            <CheckCheck size={18} />
            <span>
              Your export is ready. <strong>{(done.blob.size / 1024 / 1024).toFixed(1)} MB</strong>
            </span>
          </div>
        )}
      </div>
      <div className="dialog-footer">
        <span className="dialog-footer-note">
          {progress
            ? 'Keeps going while you use other apps. You can cancel at any time.'
            : 'Rendered on your device.'}
        </span>
        <span className="dialog-footer-spacer" />
        {progress ? (
          <button className="button outline" onClick={() => controller.current?.abort()}>
            <X size={14} /> Cancel export
          </button>
        ) : done ? (
          <button className="button primary" onClick={() => saveBlob(done.blob, done.filename)}>
            <Download size={16} /> Download again
          </button>
        ) : (
          <button className="button primary" disabled={!!unavailable} onClick={start}>
            <Download size={16} /> Export {formats.find((f) => f.id === format)?.title}
          </button>
        )}
        {progress && <LoaderCircle className="spin" size={16} />}
      </div>
    </dialog>
  )
}
