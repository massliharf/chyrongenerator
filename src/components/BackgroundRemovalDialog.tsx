import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { Check, Eye, LoaderCircle, Pipette, Sparkles, X } from 'lucide-react'
import { NumberField, Toggle } from './Controls'
import { Segmented } from './InspectorParts'
import {
  MODEL_BYTES,
  applyMatte,
  borderColor,
  colorKeyMatte,
  loadModel,
  predictMap,
  refineMatte,
  resizeMatte,
  type Matte,
  type Pixels,
} from '../studio/cutout'

type Mode = 'subject' | 'color'
const PREVIEW = 1024
const hex = (c: [number, number, number]) =>
  `#${c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`
const rgb = (h: string): [number, number, number] =>
  [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number]

/** Pixels of a blob, at most `max` px on the longer side (0 = full size). */
async function pixelsOf(blob: Blob, max = 0): Promise<Pixels> {
  const bitmap = await createImageBitmap(blob)
  const k = max ? Math.min(1, max / Math.max(bitmap.width, bitmap.height)) : 1
  const width = Math.max(1, Math.round(bitmap.width * k))
  const height = Math.max(1, Math.round(bitmap.height * k))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  ctx.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()
  const { data } = ctx.getImageData(0, 0, width, height)
  canvas.width = canvas.height = 0
  return { data, width, height }
}

/** The picture to cut out; editors pass their original, even after an earlier cut-out. */
export interface CutoutSource {
  blob: Blob
  name: string
}
/** The cut-out: a PNG the size of the source. */
export interface CutoutResult {
  blob: Blob
  name: string
  width: number
  height: number
}

/**
 * Remove an image's background, on this device. "Subject" finds the person or
 * object with a bundled model; "Colour" removes a flat colour. The result is a
 * new PNG the editor stores next to the original, so it can be restored.
 * Used by the Chyron editor and the Designer alike.
 */
export function BackgroundRemovalDialog({
  load,
  onApply,
  onClose,
}: {
  load: () => Promise<CutoutSource>
  onApply: (result: CutoutResult) => void | Promise<void>
  onClose: () => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const [source, setSource] = useState<{ blob: Blob; name: string; preview: Pixels } | null>(null)
  const [mode, setMode] = useState<Mode>('subject')
  const [map, setMap] = useState<{ data: Float32Array; width: number; height: number } | null>(null)
  const [status, setStatus] = useState('Opening the image…')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [compare, setCompare] = useState(false)
  const [picking, setPicking] = useState(false)
  const [softness, setSoftness] = useState(60)
  const [shift, setShift] = useState(0)
  const [key, setKey] = useState('#ffffff')
  const [tolerance, setTolerance] = useState(25)
  const [feather, setFeather] = useState(20)
  const [connected, setConnected] = useState(true)
  // Loaded once, when the dialog opens.
  const loader = useRef(load)

  useEffect(() => {
    dialog.current?.showModal()
  }, [])
  useEffect(() => {
    let disposed = false
    void (async () => {
      try {
        const stored = await loader.current()
        const preview = await pixelsOf(stored.blob, PREVIEW)
        if (disposed) return
        setSource({ blob: stored.blob, name: stored.name, preview })
        setKey(hex(borderColor(preview)))
        setStatus('')
      } catch (e) {
        if (!disposed) setError(e instanceof Error ? e.message : 'The image could not be opened.')
      }
    })()
    return () => {
      disposed = true
    }
  }, [])
  // Find the subject once; the edge controls only reshape the result.
  useEffect(() => {
    if (mode !== 'subject' || !source || map) return
    let disposed = false
    void (async () => {
      try {
        setBusy(true)
        setStatus(`Loading the cut-out model (${(MODEL_BYTES / 1024 / 1024).toFixed(1)} MB, once)…`)
        const model = await loadModel((f) =>
          setStatus(`Loading the cut-out model… ${Math.round(f * 100)}%`),
        )
        if (disposed) return
        setStatus('Finding the subject…')
        const next = await predictMap(source.preview, model)
        if (disposed) return
        setMap(next)
        setStatus('')
      } catch (e) {
        if (!disposed)
          setError(
            e instanceof Error && e.message ? e.message : 'The subject could not be found here.',
          )
      } finally {
        if (!disposed) setBusy(false)
      }
    })()
    return () => {
      disposed = true
    }
  }, [mode, source, map])

  const matteFor = (px: Pixels): Matte | null => {
    if (mode === 'color') return colorKeyMatte(px, rgb(key), tolerance, feather, connected)
    if (!map) return null
    return refineMatte(
      resizeMatte(map.data, map.width, map.height, px.width, px.height),
      softness,
      shift,
    )
  }
  // Draw the preview.
  useEffect(() => {
    const el = canvas.current
    if (!el || !source) return
    const px = source.preview
    el.width = px.width
    el.height = px.height
    const matte = compare ? null : matteFor(px)
    const out = matte ? applyMatte(px, matte) : px
    el.getContext('2d')!.putImageData(new ImageData(out.data, out.width, out.height), 0, 0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source, map, mode, softness, shift, key, tolerance, feather, connected, compare])

  const pick = (e: PointerEvent<HTMLCanvasElement>) => {
    if (!picking || !source) return
    const rect = e.currentTarget.getBoundingClientRect()
    const x = Math.floor(((e.clientX - rect.left) / rect.width) * source.preview.width)
    const y = Math.floor(((e.clientY - rect.top) / rect.height) * source.preview.height)
    const i = (y * source.preview.width + x) * 4
    const d = source.preview.data
    setKey(hex([d[i], d[i + 1], d[i + 2]]))
    setPicking(false)
  }
  const close = () => {
    dialog.current?.close()
    onClose()
  }
  const apply = async () => {
    if (!source) return
    try {
      setBusy(true)
      setStatus('Cutting out at full size…')
      const full = await pixelsOf(source.blob)
      const matte = matteFor(full)
      if (!matte) return
      const out = applyMatte(full, matte)
      const c = document.createElement('canvas')
      c.width = out.width
      c.height = out.height
      c.getContext('2d')!.putImageData(new ImageData(out.data, out.width, out.height), 0, 0)
      const blob = await new Promise<Blob>((resolve, reject) =>
        c.toBlob(
          (b) => (b ? resolve(b) : reject(new Error('The cut-out could not be saved.'))),
          'image/png',
        ),
      )
      c.width = c.height = 0
      await onApply({
        blob,
        name: `${source.name.replace(/\.[a-z0-9]+$/i, '')} cutout.png`.slice(0, 80),
        width: out.width,
        height: out.height,
      })
      dialog.current?.close()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The cut-out could not be saved.')
    } finally {
      setBusy(false)
      setStatus('')
    }
  }
  const ready = !!source && (mode === 'color' || !!map)
  return (
    <dialog
      ref={dialog}
      className="dialog dialog-lg cutout-dialog"
      aria-labelledby="cutout-title"
      onCancel={(e) => {
        e.preventDefault()
        close()
      }}
    >
      <div className="dialog-header">
        <div>
          <h2 id="cutout-title">Remove background</h2>
          <p>Runs on this device; the picture is never uploaded. The original is kept.</p>
        </div>
        <button className="icon-button" aria-label="Close" onClick={close}>
          <X size={18} />
        </button>
      </div>
      <div className="dialog-body cutout-layout">
        <div className="cutout-preview checker">
          {source && (
            <canvas
              ref={canvas}
              className={picking ? 'is-picking' : ''}
              role="img"
              aria-label={compare ? 'Original picture' : 'Picture without its background'}
              onPointerDown={pick}
            />
          )}
          {(status || busy) && !error && (
            <div className="cutout-status" role="status">
              <LoaderCircle className="spin" size={16} aria-hidden="true" /> {status || 'Working…'}
            </div>
          )}
        </div>
        <div className="cutout-controls">
          <Segmented
            label="Method"
            value={mode}
            onChange={(m: Mode) => {
              setMode(m)
              setError('')
              setPicking(false)
            }}
            items={[
              { id: 'subject', name: 'Subject', Icon: Sparkles },
              { id: 'color', name: 'Colour', Icon: Pipette },
            ]}
          />
          {mode === 'subject' ? (
            <>
              <p className="block-note">
                Finds the person or object in front and removes everything behind it.
              </p>
              <NumberField
                label="Edge softness"
                value={softness}
                min={0}
                max={100}
                unit="%"
                onChange={setSoftness}
              />
              <NumberField
                label="Shrink or grow the edge"
                value={shift}
                min={-50}
                max={50}
                hint="Below 0 trims the edge in; above 0 keeps more around the subject"
                onChange={setShift}
              />
            </>
          ) : (
            <>
              <p className="block-note">
                Removes one colour, such as a white or green backdrop. Pick it from the picture.
              </p>
              <div className="cutout-key">
                <span className="cutout-swatch" style={{ background: key }} aria-hidden="true" />
                <span>{key.toUpperCase()}</span>
                <button
                  className={`button secondary sm ${picking ? 'selected' : ''}`}
                  aria-pressed={picking}
                  onClick={() => setPicking(!picking)}
                >
                  <Pipette size={14} aria-hidden="true" />{' '}
                  {picking ? 'Click the picture' : 'Pick colour'}
                </button>
              </div>
              <NumberField
                label="Tolerance"
                value={tolerance}
                min={0}
                max={100}
                unit="%"
                onChange={setTolerance}
              />
              <NumberField
                label="Edge softness"
                value={feather}
                min={0}
                max={100}
                unit="%"
                onChange={setFeather}
              />
              <Toggle
                label="Only around the edges"
                hint="Keep the colour inside the subject"
                checked={connected}
                onChange={setConnected}
              />
            </>
          )}
          <button
            className={`button ghost sm ${compare ? 'selected' : ''}`}
            aria-pressed={compare}
            onClick={() => setCompare(!compare)}
            disabled={!ready}
          >
            <Eye size={14} aria-hidden="true" />{' '}
            {compare ? 'Showing original' : 'Compare with original'}
          </button>
          {error && (
            <div className="alert alert-danger" role="alert">
              {error}
            </div>
          )}
        </div>
      </div>
      <div className="dialog-footer">
        <span className="dialog-footer-note">The cut-out replaces the picture in this layer.</span>
        <span className="dialog-footer-spacer" />
        <button className="button secondary" onClick={close}>
          Cancel
        </button>
        <button className="button primary" disabled={!ready || busy} onClick={() => void apply()}>
          <Check size={16} aria-hidden="true" /> Apply
        </button>
      </div>
    </dialog>
  )
}
