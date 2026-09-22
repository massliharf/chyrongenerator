import { useEffect, useRef, useState } from 'react'
import {
  Check,
  Download,
  FlipHorizontal2,
  ImagePlus,
  LoaderCircle,
  Move,
  Redo2,
  RotateCcw,
  RotateCw,
  ScanLine,
  Trash2,
  Undo2,
  Upload,
  UserRound,
  X,
} from 'lucide-react'
import { Color, Field, Range, Section, Toggle } from '../components/Controls'
import { WorkspaceNav, type Workspace } from '../components/WorkspaceNav'
import { saveBlob } from '../studio/export'
import { importImage } from './assets'
import { exportStreamPng, exportStreamSet } from './export'
import {
  assetUrl,
  BACKGROUNDS,
  COLOR_STYLES,
  DEFAULT_FRAMING,
  FORMATS,
  type FormatId,
  type Layout,
} from './model'
import { useStreamImages } from './renderer'
import { StreamCanvas } from './StreamCanvas'
import { TransformOverlay } from './TransformOverlay'
import { useStreamProject } from './useStreamProject'
import './StreamWorkspace.css'

function ImageThumbnail({ image }: { image: HTMLImageElement | null | undefined }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const ctx = canvas.current?.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, 120, 90)
    if (!image) return
    const scale = Math.min(120 / image.naturalWidth, 90 / image.naturalHeight)
    const w = image.naturalWidth * scale,
      h = image.naturalHeight * scale
    ctx.drawImage(image, (120 - w) / 2, (90 - h) / 2, w, h)
  }, [image])
  return <canvas ref={canvas} width={120} height={90} aria-hidden="true" />
}

export default function StreamWorkspace({
  active,
  onWorkspaceChange,
}: {
  active: boolean
  onWorkspaceChange: (workspace: Workspace) => void
}) {
  const editor = useStreamProject()
  const doc = editor.document
  const [selected, setSelected] = useState<FormatId>('hero')
  const format = FORMATS.find((f) => f.id === selected)!
  const layout = doc.layouts[selected]
  const [retry, setRetry] = useState(0)
  const { images, error: imageError } = useStreamImages(doc, retry)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [dragging, setDragging] = useState(false)
  const [guides, setGuides] = useState(false)
  const [open, setOpen] = useState({ framing: false, background: true, finish: false })
  const hostInput = useRef<HTMLInputElement>(null)
  const backgroundInput = useRef<HTMLInputElement>(null)
  const pending = useRef(false)
  const patch = (values: Partial<Layout>) => editor.patch(selected, values)
  const toggle = (section: keyof typeof open) => setOpen((v) => ({ ...v, [section]: !v[section] }))
  const disabled = !editor.ready || !!busy
  const canExport = !disabled && !!doc.host && !!images
  const imageBackground = !['gradient', 'solid', 'transparent'].includes(layout.background)

  useEffect(() => {
    if (!active) return
    const keydown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement
      if (pending.current || target.closest('input, textarea, select, [contenteditable=true]'))
        return
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault()
        if (event.shiftKey) editor.redo()
        else editor.undo()
      }
    }
    window.addEventListener('keydown', keydown)
    return () => window.removeEventListener('keydown', keydown)
  }, [active, editor])
  useEffect(() => {
    if (!notice) return
    const timer = setTimeout(() => setNotice(''), 5000)
    return () => clearTimeout(timer)
  }, [notice])

  const upload = async (file: File | undefined, background = false) => {
    if (!file || pending.current || !editor.ready) return
    if (background && doc.backgrounds.length >= 8) {
      setError('You can keep 8 custom backgrounds. Select and remove one to make room for another.')
      return
    }
    pending.current = true
    setBusy(background ? 'Opening background…' : 'Preparing your host…')
    setError('')
    try {
      const asset = await importImage(file, !background)
      if (background) editor.addBackground(asset, selected)
      else editor.setHost(asset)
      setNotice(
        background
          ? 'Background added to this image.'
          : 'Host updated in all three images. Each keeps its own framing.',
      )
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to open this image.')
    } finally {
      setBusy('')
      pending.current = false
    }
  }
  const download = async (all: boolean) => {
    if (!canExport || pending.current || !images) return
    pending.current = true
    setBusy('Preparing PNG…')
    setError('')
    try {
      const result = all
        ? await exportStreamSet(doc, images, setBusy)
        : await exportStreamPng(doc, format, images)
      saveBlob(result.blob, result.filename)
      setNotice(
        all
          ? 'Your ZIP is ready — three full-resolution PNGs.'
          : `${format.name} downloaded at ${format.width} × ${format.height}.`,
      )
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Export failed. Please try again.')
    } finally {
      setBusy('')
      pending.current = false
    }
  }

  return (
    <div className="studio-shell stream-shell">
      <a className="skip-link" href="#stream-controls">
        Skip to image settings
      </a>
      <header className="app-header">
        <h1 className="brand" aria-label="Chyron Studio">
          <span className="brand-symbol" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          <strong>
            chyron<span>studio</span>
          </strong>
          <span className="version-pill">2.3</span>
        </h1>
        <div className="project-header">
          <span className="header-divider" />
          <input
            className="project-name"
            aria-label="Stream set name"
            value={doc.name}
            maxLength={80}
            disabled={disabled}
            onChange={(e) => editor.rename(e.target.value)}
          />
        </div>
        <div className="header-actions">
          <div className="history-actions">
            <button
              className="icon-button"
              aria-label="Undo image edit"
              disabled={disabled || !editor.canUndo}
              onClick={editor.undo}
            >
              <Undo2 size={18} />
            </button>
            <button
              className="icon-button"
              aria-label="Redo image edit"
              disabled={disabled || !editor.canRedo}
              onClick={editor.redo}
            >
              <Redo2 size={18} />
            </button>
          </div>
          <button
            className="button primary export-trigger"
            aria-label="Download all images as ZIP"
            disabled={!canExport}
            onClick={() => void download(true)}
          >
            {busy ? <LoaderCircle size={20} className="spin" /> : <Download size={20} />}{' '}
            <span>
              Download set <span className="si-count">3</span>
            </span>
          </button>
        </div>
      </header>
      <WorkspaceNav current="stream" onChange={onWorkspaceChange} />
      <div className="si-workspace">
        <main className="si-main" aria-label="Stream image previews">
          <div className="si-heading">
            <div>
              <h2>Stream image generator</h2>
              <p>One host. Three images, ready to go.</p>
            </div>
            <span className="si-local">
              <span className="status-dot" /> ON YOUR DEVICE
            </span>
          </div>
          <div className="si-preview-toolbar">
            <div>
              <strong>{format.name}</strong>
              <span>
                {format.width} × {format.height} <span aria-hidden="true">·</span> {format.ratio}
              </span>
            </div>
            <button
              className={`icon-button ${guides ? 'selected' : ''}`}
              aria-label="Show image safe area"
              aria-pressed={guides}
              onClick={() => setGuides(!guides)}
              title="Safe area guides"
            >
              <ScanLine size={20} />
            </button>
          </div>
          <div
            className={`si-stage ${dragging ? 'is-dragging' : ''}`}
            onDragOver={(e) => {
              e.preventDefault()
              if (!disabled) setDragging(true)
            }}
            onDragLeave={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragging(false)
            }}
            onDrop={(e) => {
              e.preventDefault()
              setDragging(false)
              if (!disabled) void upload(e.dataTransfer.files[0])
            }}
          >
            <div
              className="si-artboard"
              style={
                {
                  '--si-aspect': format.width / format.height,
                  aspectRatio: `${format.width}/${format.height}`,
                } as React.CSSProperties
              }
            >
              <StreamCanvas
                format={format}
                layout={layout}
                host={doc.host}
                images={images}
                onTransform={disabled ? undefined : patch}
              />
              {doc.host && images?.host && !disabled && (
                <TransformOverlay
                  format={format}
                  layout={layout}
                  host={doc.host}
                  onTransform={patch}
                />
              )}
              {guides && (
                <div className="si-guides" aria-hidden="true">
                  <span>SAFE AREA</span>
                </div>
              )}
              {!doc.host && (
                <div className="si-placeholder">
                  <UserRound size={48} strokeWidth={1.25} />
                  <strong>Your host goes here</strong>
                  <span>Drop a transparent PNG to create all three images.</span>
                  <button
                    className="button primary"
                    disabled={disabled}
                    onClick={() => hostInput.current?.click()}
                  >
                    <Upload size={18} /> Upload host
                  </button>
                </div>
              )}
            </div>
            {dragging && (
              <div className="si-drop-overlay">
                <Upload size={32} />
                Drop your host image
              </div>
            )}
          </div>
          <div className="si-preview-actions">
            <span>
              <Move size={16} />{' '}
              {doc.host
                ? 'Drag to move · Drag corners to scale · Drag top handle to rotate · Scroll to zoom'
                : 'Your PNG cutout is placed over the background.'}
            </span>
            <button className="button" disabled={!canExport} onClick={() => void download(false)}>
              <Download size={18} /> Download PNG
            </button>
          </div>
          <div className="si-formats" role="group" aria-label="Output images">
            {FORMATS.map((f) => (
              <button
                key={f.id}
                className={`si-format ${selected === f.id ? 'selected' : ''}`}
                aria-pressed={selected === f.id}
                aria-label={`Edit ${f.name}, ${f.width} by ${f.height}`}
                onClick={() => setSelected(f.id)}
              >
                <div className="si-format-preview">
                  <StreamCanvas
                    format={f}
                    layout={doc.layouts[f.id]}
                    host={doc.host}
                    images={images}
                    thumbnail
                  />
                </div>
                <div className="si-format-copy">
                  <strong>{f.name}</strong>
                  <span>
                    {f.width} × {f.height}
                  </span>
                </div>
                {selected === f.id && <Check size={18} className="si-selected-check" />}
              </button>
            ))}
          </div>
        </main>
        <aside
          className="si-inspector"
          aria-label="Stream image settings"
          id="stream-controls"
          tabIndex={-1}
        >
          <div className="si-panel-heading">
            <h2>Make it yours</h2>
            <span>Editing {format.name.toLowerCase()}</span>
          </div>
          <fieldset className="si-controls" disabled={disabled}>
            <legend className="sr-only">Image customization</legend>
            <div className="si-host-upload">
              <div className="si-section-label">
                <h3>Host image</h3>
                <span>Shared across all 3</span>
              </div>
              {doc.host ? (
                <div className="si-file-card">
                  <div className="si-file-thumb">
                    <ImageThumbnail image={images?.host} />
                  </div>
                  <div>
                    <strong title={doc.host.name}>{doc.host.name}</strong>
                    <span>
                      {doc.host.width} × {doc.host.height}
                    </span>
                  </div>
                  <button
                    className="icon-button"
                    aria-label="Remove host image"
                    onClick={() => editor.setHost(null)}
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              ) : (
                <p>Upload once to fill every format.</p>
              )}
              <button
                className={`button ${doc.host ? '' : 'primary'} full`}
                onClick={() => hostInput.current?.click()}
              >
                <ImagePlus size={18} /> {doc.host ? 'Replace host image' : 'Upload host image'}
              </button>
              <p className="field-hint">
                PNG, JPEG or WebP · up to 20 MB. Use a transparent PNG for a cutout; photo
                backgrounds are kept.
              </p>
            </div>
            <Section
              title="Host framing"
              summary={`${Math.round(layout.zoom)}% size · ${layout.rotation}° rotation`}
              open={open.framing}
              onToggle={() => toggle('framing')}
              onReset={() => patch(DEFAULT_FRAMING)}
            >
              <fieldset className="si-framing" disabled={!doc.host}>
                <legend className="sr-only">Host position</legend>
                <div className="si-quick-actions">
                  <button className="button" onClick={() => patch(DEFAULT_FRAMING)}>
                    <RotateCcw size={16} /> Auto fit
                  </button>
                  <button
                    className={`button ${layout.flip ? 'selected' : ''}`}
                    aria-pressed={layout.flip}
                    onClick={() => patch({ flip: !layout.flip })}
                  >
                    <FlipHorizontal2 size={16} /> Flip
                  </button>
                  <button
                    className="button"
                    aria-label="Rotate 90° counter-clockwise"
                    title="Rotate −90°"
                    onClick={() =>
                      patch({ rotation: ((layout.rotation - 90 + 180) % 360) - 180 })
                    }
                  >
                    <RotateCcw size={16} />
                  </button>
                  <button
                    className="button"
                    aria-label="Rotate 90° clockwise"
                    title="Rotate +90°"
                    onClick={() =>
                      patch({ rotation: ((layout.rotation + 90 + 180) % 360) - 180 })
                    }
                  >
                    <RotateCw size={16} />
                  </button>
                </div>
                <Range
                  label="Host size"
                  value={layout.zoom}
                  min={20}
                  max={300}
                  unit="%"
                  onChange={(zoom) => patch({ zoom })}
                />
                <Range
                  label="Horizontal position"
                  value={layout.x}
                  min={-50}
                  max={150}
                  step={0.25}
                  unit="%"
                  onChange={(x) => patch({ x })}
                />
                <Range
                  label="Vertical position"
                  value={layout.y}
                  min={-50}
                  max={150}
                  step={0.25}
                  unit="%"
                  onChange={(y) => patch({ y })}
                />
                <Range
                  label="Host rotation"
                  value={layout.rotation}
                  min={-180}
                  max={180}
                  unit="°"
                  onChange={(rotation) => patch({ rotation })}
                />
              </fieldset>
            </Section>
            <Section
              title="Background"
              summary={
                BACKGROUNDS.find((b) => b.id === layout.background)?.name ??
                doc.backgrounds.find((b) => b.id === layout.background)?.name ??
                (layout.background === 'gradient'
                  ? 'Color gradient'
                  : layout.background === 'solid'
                    ? 'Solid color'
                    : 'Transparent')
              }
              open={open.background}
              onToggle={() => toggle('background')}
            >
              <div className="si-background-grid">
                {BACKGROUNDS.map((bg) => (
                  <button
                    key={bg.id}
                    aria-label={`Use ${bg.name} background`}
                    aria-pressed={layout.background === bg.id}
                    onClick={() =>
                      patch({
                        background: bg.id,
                        backgroundX: 50,
                        backgroundY: 50,
                        backgroundZoom: 100,
                      })
                    }
                  >
                    <img src={assetUrl(bg.file)} alt="" />
                    <span>{bg.name}</span>
                  </button>
                ))}
                {doc.backgrounds.map((bg) => (
                  <button
                    key={bg.id}
                    aria-label={`Use ${bg.name} background`}
                    aria-pressed={layout.background === bg.id}
                    onClick={() =>
                      patch({
                        background: bg.id,
                        backgroundX: 50,
                        backgroundY: 50,
                        backgroundZoom: 100,
                      })
                    }
                  >
                    <ImageThumbnail image={images?.backgrounds[bg.id]} />
                    <span title={bg.name}>{bg.name}</span>
                  </button>
                ))}
              </div>
              <div className="si-quick-actions">
                <button className="button" onClick={() => backgroundInput.current?.click()}>
                  <Upload size={16} /> Upload background
                </button>
              </div>
              <Field label="Background style">
                <select
                  value={imageBackground ? 'image' : layout.background}
                  onChange={(e) =>
                    patch({ background: e.target.value === 'image' ? 'grid' : e.target.value })
                  }
                >
                  <option value="image">Background image</option>
                  <option value="gradient">Color gradient</option>
                  <option value="solid">Solid color</option>
                  <option value="transparent">Transparent</option>
                </select>
              </Field>
              {doc.backgrounds.some((bg) => bg.id === layout.background) && (
                <button
                  className="text-button"
                  onClick={() => {
                    editor.removeBackground(layout.background)
                    setNotice('Background removed. Undo to restore it.')
                  }}
                >
                  <Trash2 size={16} /> Remove custom background
                </button>
              )}
              {(layout.background === 'gradient' || layout.background === 'solid') && (
                <>
                  <div className="si-palette" role="group" aria-label="Background color presets">
                    {COLOR_STYLES.map((p) => (
                      <button
                        key={p.name}
                        aria-label={`Use ${p.name} colors`}
                        title={p.name}
                        style={{ background: `linear-gradient(35deg, ${p.color}, ${p.color2})` }}
                        onClick={() => patch({ color: p.color, color2: p.color2 })}
                      />
                    ))}
                  </div>
                  <Color
                    label="Background color"
                    value={layout.color}
                    onChange={(color) => patch({ color })}
                  />
                  {layout.background === 'gradient' && (
                    <Color
                      label="Gradient highlight"
                      value={layout.color2}
                      onChange={(color2) => patch({ color2 })}
                    />
                  )}
                </>
              )}
              {imageBackground && (
                <details className="si-background-position">
                  <summary>Adjust background crop</summary>
                  <Range
                    label="Background zoom"
                    min={100}
                    max={250}
                    value={layout.backgroundZoom}
                    unit="%"
                    onChange={(backgroundZoom) => patch({ backgroundZoom })}
                  />
                  <Range
                    label="Background horizontal"
                    min={0}
                    max={100}
                    value={layout.backgroundX}
                    unit="%"
                    onChange={(backgroundX) => patch({ backgroundX })}
                  />
                  <Range
                    label="Background vertical"
                    min={0}
                    max={100}
                    value={layout.backgroundY}
                    unit="%"
                    onChange={(backgroundY) => patch({ backgroundY })}
                  />
                </details>
              )}
              <button
                className="text-button full"
                onClick={() => {
                  editor.applyBackgroundToAll(selected)
                  setNotice('Background applied to all three images. Host framing is unchanged.')
                }}
              >
                Use this background for all 3
              </button>
            </Section>
            <Section
              title="Finishing"
              summary="Shadow, fade & preview guides"
              open={open.finish}
              onToggle={() => toggle('finish')}
              onReset={() => patch({ shadow: 0, fade: 0 })}
            >
              <Range
                label="Host shadow"
                min={0}
                max={100}
                value={layout.shadow}
                unit="%"
                onChange={(shadow) => patch({ shadow })}
              />
              <Range
                label="Bottom fade"
                min={0}
                max={60}
                value={layout.fade}
                unit="%"
                onChange={(fade) => patch({ fade })}
              />
              <Toggle
                label="Safe area guides"
                hint="Preview only; excluded from downloads."
                checked={guides}
                onChange={setGuides}
              />
            </Section>
          </fieldset>
          <div className={`si-save-state ${editor.storageError ? 'is-error' : ''}`}>
            <Check size={16} />
            <span>{editor.saveStatus}</span>
          </div>
        </aside>
      </div>
      <input
        ref={hostInput}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        hidden
        aria-label="Host image file"
        onChange={(e) => {
          void upload(e.currentTarget.files?.[0])
          e.currentTarget.value = ''
        }}
      />
      <input
        ref={backgroundInput}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        hidden
        aria-label="Background image file"
        onChange={(e) => {
          void upload(e.currentTarget.files?.[0], true)
          e.currentTarget.value = ''
        }}
      />
      {(error || imageError) && (
        <div className="si-error" role="alert">
          <span>{error || imageError}</span>
          {imageError && (
            <button className="text-button" onClick={() => setRetry((n) => n + 1)}>
              Retry images
            </button>
          )}
          <button
            className="icon-button"
            aria-label="Dismiss image error"
            onClick={() => setError('')}
            disabled={!error}
          >
            <X size={18} />
          </button>
        </div>
      )}
      {(notice || busy) && (
        <div className="toast" role="status">
          {busy && <LoaderCircle className="spin" size={18} />}
          <span>{busy || notice}</span>
          {!busy && (
            <button
              className="icon-button"
              aria-label="Dismiss image notification"
              onClick={() => setNotice('')}
            >
              <X size={18} />
            </button>
          )}
        </div>
      )}
    </div>
  )
}
