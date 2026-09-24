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
    copy: 'Lightweight video for OBS & the web',
    Icon: Film,
  },
  {
    id: 'mov',
    title: 'ProRes 4444',
    badge: '.mov',
    copy: 'High quality video for editing & compositing',
    Icon: Film,
  },
  {
    id: 'sequence',
    title: 'PNG sequence',
    badge: '.zip',
    copy: 'Lossless RGBA frames for any workflow',
    Icon: Layers,
  },
  {
    id: 'png',
    title: 'PNG image',
    badge: '.png',
    copy: 'A crisp still with a transparent background',
    Icon: Image,
  },
  {
    id: 'svg',
    title: 'SVG vector',
    badge: '.svg',
    copy: 'Scalable artwork with outlined lettering',
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
  const still = format === 'png' || format === 'svg'
  const unavailable = exportAvailability(format, project)
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
      const result = await exportProject(
        { ...project },
        format,
        useCurrentFrame ? time : restTime(project),
        ctrl.signal,
        setProgress,
      )
      if (!ctrl.signal.aborted) {
        setDone(result)
        saveBlob(result.blob, result.filename)
      }
    } catch (e) {
      if (!ctrl.signal.aborted)
        setError(e instanceof Error ? e.message : 'Export failed. Please try again.')
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
      className="export-dialog"
      aria-labelledby="export-title"
      onCancel={(e) => {
        e.preventDefault()
        close()
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) close()
      }}
    >
      <div className="dialog-heading">
        <div>
          <span className="eyebrow">READY FOR THE SPOTLIGHT</span>
          <h2 id="export-title">Take it with you.</h2>
        </div>
        <button className="icon-button" aria-label="Close export" onClick={close}>
          <X size={19} />
        </button>
      </div>
      <div className="export-content">
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
              <span>{exportDescription(project)}</span>
            </div>
            <div className="alpha-note">
              <CheckCheck size={18} />
              <div>
                <strong>Transparency, built in.</strong>
                <p>Your background stays transparent in every format. No keying required.</p>
              </div>
            </div>
            <div className="export-specs">
              <span>
                Color channels<strong>RGB + Alpha</strong>
              </span>
              <span>
                {still ? 'Render' : 'Total frames'}
                <strong>
                  {still
                    ? useCurrentFrame
                      ? 'Current frame'
                      : 'Full composition'
                    : frameCount(project)}
                </strong>
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
        {format === 'mov' && !progress && (
          <p className="export-footnote">
            The ProRes encoder loads on first use. Best for Premiere, After Effects and Final Cut.
            Up to Full HD / 600 frames.
          </p>
        )}
        {format === 'webm' && !progress && (
          <p className="export-footnote">
            VP9 with alpha. The encoder loads on first use. Up to Full HD / 600 frames; PNG
            sequences support larger exports.
          </p>
        )}
        {(format === 'webm' || format === 'mov') &&
          !progress &&
          imageLayers(project).some((l) => l.visible) && (
            <p className="export-footnote">
              Photos make lossless video slower to encode in the browser, often several minutes for
              a few seconds of 720p. ProRes is about twice as fast as WebM; a PNG sequence is
              fastest.
            </p>
          )}
        {(error || unavailable) && (
          <div className="error-banner" role="alert">
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
          <div className="success-banner" role="status">
            <CheckCheck size={18} />
            <span>
              Your export is ready. <strong>{(done.blob.size / 1024 / 1024).toFixed(1)} MB</strong>
            </span>
          </div>
        )}
      </div>
      <div className="dialog-footer">
        <span>
          {progress
            ? 'You can cancel at any time.'
            : 'Rendered on your device. Your work stays yours.'}
        </span>
        {progress ? (
          <button className="button" onClick={() => controller.current?.abort()}>
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
