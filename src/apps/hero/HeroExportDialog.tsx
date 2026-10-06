import { useEffect, useRef, useState } from 'react'
import { Check, Download, LoaderCircle, X } from 'lucide-react'
import { saveBlob } from '../../studio/export'
import { IMAGE_FORMATS, exportImages, type ImageFormat } from './export'
import type { HeroSet } from './model'

/**
 * Export a hero set: every artboard (or the ones ticked) at 1× or 2× as PNG,
 * JPEG or WebP. One image downloads as it is; several come in one ZIP.
 */
export function HeroExportDialog({
  set,
  activeId,
  onClose,
}: {
  set: HeroSet
  activeId: string
  onClose: () => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [picked, setPicked] = useState(() => new Set(set.artboards.map((a) => a.id)))
  const [format, setFormat] = useState<ImageFormat>('png')
  const [scale, setScale] = useState(1)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState('')
  const [error, setError] = useState('')
  useEffect(() => {
    dialog.current?.showModal()
  }, [])
  const chosen = set.artboards.filter((a) => picked.has(a.id))
  const close = () => {
    dialog.current?.close()
    onClose()
  }
  const start = async () => {
    setBusy(true)
    setError('')
    setDone('')
    try {
      const result = await exportImages(set, chosen, { format, scale })
      saveBlob(result.blob, result.filename)
      setDone(
        chosen.length === 1
          ? `${result.filename} is in your downloads folder.`
          : `${result.filename} (${chosen.length} images) is in your downloads folder.`,
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The export failed. Please try again.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <dialog
      ref={dialog}
      className="dialog hero-export"
      aria-labelledby="hero-export-title"
      onCancel={(e) => {
        e.preventDefault()
        close()
      }}
    >
      <div className="dialog-header">
        <div>
          <h2 id="hero-export-title">Export</h2>
          <p>Every artboard at its own size, made on this device.</p>
        </div>
        <button className="icon-button" aria-label="Close export" onClick={close}>
          <X size={18} />
        </button>
      </div>
      <div className="dialog-body">
        <fieldset className="hero-export-list">
          <legend className="block-label">Artboards</legend>
          {set.artboards.map((a) => (
            <label key={a.id} className="hero-export-item">
              <input
                type="checkbox"
                checked={picked.has(a.id)}
                onChange={(e) => {
                  const next = new Set(picked)
                  if (e.target.checked) next.add(a.id)
                  else next.delete(a.id)
                  setPicked(next)
                }}
              />
              <span>
                {a.doc.name}
                {a.id === activeId && <small> · editing</small>}
              </span>
              <small>
                {a.doc.width * scale} × {a.doc.height * scale}
              </small>
            </label>
          ))}
        </fieldset>
        <div className="hero-export-options">
          <div className="segmented" role="group" aria-label="Format">
            {IMAGE_FORMATS.map((f) => (
              <button key={f.id} aria-pressed={format === f.id} onClick={() => setFormat(f.id)}>
                {f.name}
              </button>
            ))}
          </div>
          <div className="segmented" role="group" aria-label="Size">
            {[1, 2].map((s) => (
              <button key={s} aria-pressed={scale === s} onClick={() => setScale(s)}>
                {s}×
              </button>
            ))}
          </div>
        </div>
        {format === 'jpeg' && (
          <p className="block-note">
            JPEG has no transparency; transparent artboards get their colour.
          </p>
        )}
        {error && (
          <div className="alert alert-danger" role="alert">
            {error}
          </div>
        )}
        {done && (
          <div className="alert alert-success" role="status">
            <Check size={18} aria-hidden="true" /> <span>{done}</span>
          </div>
        )}
      </div>
      <div className="dialog-footer">
        <span className="dialog-footer-note">
          {chosen.length > 1 ? `${chosen.length} images in one ZIP` : 'One image'}
        </span>
        <span className="dialog-footer-spacer" />
        <button
          className="button primary"
          disabled={!chosen.length || busy}
          onClick={() => void start()}
        >
          {busy ? (
            <LoaderCircle className="spin" size={16} />
          ) : (
            <Download size={16} aria-hidden="true" />
          )}{' '}
          Export {chosen.length === 1 ? 'image' : `${chosen.length} images`}
        </button>
      </div>
    </dialog>
  )
}
