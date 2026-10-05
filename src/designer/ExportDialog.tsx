import { useEffect, useRef, useState } from 'react'
import {
  Check,
  CheckCheck,
  Download,
  FileImage,
  FileJson,
  Image as ImageIcon,
  LoaderCircle,
  X,
} from 'lucide-react'
import { NumberField, Toggle } from '../components/Controls'
import { saveBlob } from '../studio/export'
import { fileStem, pruneAssets, type DesignDoc } from './model'
import { renderArtboard } from './render'
import { SAVVY_TYPE, savvyName } from '../utils/savvyFile'

type Format = 'png' | 'jpeg' | 'webp' | 'json'
const FORMATS: {
  id: Format
  title: string
  badge: string
  copy: string
  Icon: typeof FileImage
}[] = [
  {
    id: 'png',
    title: 'PNG',
    badge: 'Lossless',
    copy: 'Sharp edges and text; keeps transparency.',
    Icon: FileImage,
  },
  {
    id: 'jpeg',
    title: 'JPEG',
    badge: 'Small',
    copy: 'Best for photos. No transparency.',
    Icon: ImageIcon,
  },
  {
    id: 'webp',
    title: 'WebP',
    badge: 'Web',
    copy: 'Small files with transparency.',
    Icon: ImageIcon,
  },
  {
    id: 'json',
    title: 'Design file',
    badge: '.savvy',
    copy: 'Every layer and image, editable later.',
    Icon: FileJson,
  },
]
const SCALES = [0.5, 1, 2, 3]

export function DesignerExportDialog({ doc, onClose }: { doc: DesignDoc; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const preview = useRef<HTMLCanvasElement>(null)
  const [format, setFormat] = useState<Format>('png')
  const [scale, setScale] = useState(1)
  const [quality, setQuality] = useState(90)
  const [transparent, setTransparent] = useState(doc.transparent)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState<{ blob: Blob; filename: string } | null>(null)
  const max = Math.max(doc.width, doc.height) * scale
  const tooBig = format !== 'json' && max > 16384
  const alpha = format !== 'jpeg' && transparent

  useEffect(() => {
    dialog.current?.showModal()
  }, [])
  useEffect(() => {
    const c = preview.current
    if (!c) return
    const s = Math.min(480 / doc.width, 320 / doc.height)
    const art = renderArtboard(doc, s * (window.devicePixelRatio || 1), { transparent: alpha })
    c.width = art.width
    c.height = art.height
    c.getContext('2d')!.drawImage(art, 0, 0)
  }, [doc, alpha])

  const run = async () => {
    setBusy(true)
    setError('')
    setDone(null)
    try {
      let blob: Blob
      let filename: string
      if (format === 'json') {
        blob = new Blob([JSON.stringify(pruneAssets(doc))], { type: SAVVY_TYPE })
        filename = savvyName(fileStem(doc.name))
      } else {
        await document.fonts?.ready
        const canvas = renderArtboard(doc, scale, { transparent: alpha })
        blob = await new Promise<Blob>((resolve, reject) =>
          canvas.toBlob(
            (b) =>
              b ? resolve(b) : reject(new Error('Your browser could not encode this image.')),
            `image/${format}`,
            quality / 100,
          ),
        )
        filename = `${fileStem(doc.name)}${scale !== 1 ? `@${scale}x` : ''}.${format === 'jpeg' ? 'jpg' : format}`
      }
      saveBlob(blob, filename)
      setDone({ blob, filename })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Export failed. Please try again.')
    } finally {
      setBusy(false)
    }
  }
  const close = () => {
    dialog.current?.close()
    onClose()
  }

  return (
    <dialog
      ref={dialog}
      className="dialog dialog-lg export-dialog"
      aria-labelledby="dz-export-title"
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
          <h2 id="dz-export-title">Export design</h2>
          <p>Rendered on your device at full quality</p>
        </div>
        <button className="icon-button" aria-label="Close export" onClick={close}>
          <X size={19} />
        </button>
      </div>
      <div className="dialog-body export-content">
        <div className="export-layout">
          <div className="export-preview">
            <div className="checker dz-export-preview">
              <canvas ref={preview} aria-label="Export preview" />
            </div>
            <div className="export-preview-caption">
              <span>{doc.name}</span>
              <span>
                {format === 'json'
                  ? `${doc.layers.length} layers`
                  : `${Math.round(doc.width * scale)} × ${Math.round(doc.height * scale)} px`}
              </span>
            </div>
          </div>
          <div className="format-options" role="radiogroup" aria-label="Export format">
            {FORMATS.map((f) => (
              <button
                key={f.id}
                role="radio"
                aria-checked={format === f.id}
                disabled={busy}
                className={`format-option ${format === f.id ? 'selected' : ''}`}
                onClick={() => {
                  setFormat(f.id)
                  setDone(null)
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
        {format !== 'json' && (
          <div className="dz-export-options">
            <div className="field">
              <span className="field-label">Scale</span>
              <div className="segmented" role="group" aria-label="Export scale">
                {SCALES.map((s) => (
                  <button
                    key={s}
                    className={scale === s ? 'active' : ''}
                    aria-pressed={scale === s}
                    onClick={() => setScale(s)}
                  >
                    {s}×
                  </button>
                ))}
              </div>
            </div>
            {format !== 'png' && (
              <NumberField
                label="Quality"
                value={quality}
                min={10}
                max={100}
                unit="%"
                onChange={setQuality}
              />
            )}
            {format !== 'jpeg' && (
              <Toggle
                label="Transparent background"
                checked={transparent}
                onChange={setTransparent}
              />
            )}
          </div>
        )}
        {(error || tooBig) && (
          <div className="alert alert-danger" role="alert">
            {error || 'That is larger than browsers can draw (16384 px). Choose a smaller scale.'}
          </div>
        )}
        {done && (
          <div className="alert alert-success" role="status">
            <CheckCheck size={18} />
            <span>
              {done.filename} is ready.{' '}
              <strong>{(done.blob.size / 1024 / 1024).toFixed(2)} MB</strong>
            </span>
          </div>
        )}
      </div>
      <div className="dialog-footer">
        <span className="dialog-footer-note">Nothing leaves your device.</span>
        <span className="dialog-footer-spacer" />
        {busy && <LoaderCircle className="spin" size={16} />}
        <button className="button primary" disabled={busy || tooBig} onClick={() => void run()}>
          <Download size={16} />{' '}
          {done ? 'Download again' : `Export ${FORMATS.find((f) => f.id === format)?.title}`}
        </button>
      </div>
    </dialog>
  )
}
