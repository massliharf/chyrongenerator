import { useEffect, useRef, useState } from 'react'
import {
  ChevronDown,
  Copy,
  Download,
  FileImage,
  FlipHorizontal2,
  Image as ImageIcon,
  LoaderCircle,
  Plus,
  Redo2,
  RefreshCw,
  ScanLine,
  SquareDashed,
  Trash2,
  Undo2,
  Upload,
  UserRound,
  X,
} from 'lucide-react'
import { Color, NumberField, Section } from '../components/Controls'
import { MenuButton } from '../components/Menu'
import { SaveStatus, TopBar } from '../components/TopBar'
import { saveBlob } from '../studio/export'
import { importImage } from './assets'
import { exportStreamPng, exportStreamSet } from './export'
import { MediaGalleryModal } from '../components/MediaGalleryModal'
import { fetchGalleryFile, type GalleryItem } from '../studio/galleryData'
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
import { useStreamProject } from './useStreamProject'

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

export default function StreamWorkspace({ active }: { active: boolean }) {
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
  const [showControls, setShowControls] = useState(false)
  const [open, setOpen] = useState({ framing: false, background: true, finish: false })
  const [galleryTarget, setGalleryTarget] = useState<'host' | 'background' | null>(null)
  const hostInput = useRef<HTMLInputElement>(null)
  const backgroundInput = useRef<HTMLInputElement>(null)
  const pending = useRef(false)
  const patch = (values: Partial<Layout>) => editor.patch(selected, values)
  const toggle = (section: keyof typeof open) => setOpen((v) => ({ ...v, [section]: !v[section] }))
  const disabled = !editor.ready || !!busy
  const canExport = !disabled && !!doc.host && !!images
  const imageBackground = !['gradient', 'solid', 'transparent'].includes(layout.background)

  const handleSelectGallery = async (item: GalleryItem) => {
    const isBg = galleryTarget === 'background'
    setGalleryTarget(null)
    try {
      setBusy(isBg ? 'Opening background…' : 'Preparing your host…')
      const file = await fetchGalleryFile(item)
      await upload(file, isBg)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load gallery asset.')
      setBusy('')
    }
  }

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
      else {
        editor.setHost(asset)
        // A new host is what people frame next: show its handles right away.
        setShowControls(true)
      }
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

  const uploadRef = useRef(upload)
  uploadRef.current = upload

  useEffect(() => {
    const handler = async (e: Event) => {
      const custom = e as CustomEvent<{ item: GalleryItem; target?: 'host' | 'background' }>
      if (!custom.detail?.item) return
      const isBg =
        custom.detail.target === 'background' || custom.detail.item.category === 'Backgrounds'
      try {
        setBusy(isBg ? 'Opening background…' : 'Preparing your host…')
        const file = await fetchGalleryFile(custom.detail.item)
        await uploadRef.current(file, isBg)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not load gallery asset.')
        setBusy('')
      }
    }
    window.addEventListener('stream:import-gallery-item', handler)
    return () => window.removeEventListener('stream:import-gallery-item', handler)
  }, [])
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

  const hostMenu = (label: string, className: string, content: React.ReactNode) => (
    <MenuButton
      label={label}
      className={className}
      disabled={disabled}
      items={[
        {
          label: 'Choose from Media gallery',
          Icon: ImageIcon,
          onSelect: () => setGalleryTarget('host'),
        },
        {
          label: 'Upload from device',
          Icon: Upload,
          hint: 'PNG, JPEG or WebP · up to 20 MB',
          onSelect: () => hostInput.current?.click(),
        },
      ]}
    >
      {content}
    </MenuButton>
  )
  const backgroundKind = imageBackground ? 'image' : layout.background
  const backgroundName =
    BACKGROUNDS.find((b) => b.id === layout.background)?.name ??
    doc.backgrounds.find((b) => b.id === layout.background)?.name ??
    (layout.background === 'gradient'
      ? 'Gradient'
      : layout.background === 'solid'
        ? 'Solid color'
        : 'Transparent')
  const selectBackground = (id: string) =>
    patch({ background: id, backgroundX: 50, backgroundY: 50, backgroundZoom: 100 })

  return (
    <div className="workspace-root stream-root">
      <a className="skip-link" href="#stream-controls">
        Skip to image settings
      </a>
      <TopBar
        actions={
          <>
            <div className="history-actions">
              <button
                className="icon-button"
                aria-label="Undo image edit"
                title="Undo (⌘/Ctrl Z)"
                disabled={disabled || !editor.canUndo}
                onClick={editor.undo}
              >
                <Undo2 size={20} />
              </button>
              <button
                className="icon-button"
                aria-label="Redo image edit"
                title="Redo (⌘/Ctrl Shift Z)"
                disabled={disabled || !editor.canRedo}
                onClick={editor.redo}
              >
                <Redo2 size={20} />
              </button>
            </div>
            <div className="split-button">
              <button
                className="button primary topbar-primary"
                aria-label="Download all images as ZIP"
                title="Three full-resolution PNGs in one ZIP"
                disabled={!canExport}
                onClick={() => void download(true)}
              >
                {busy ? (
                  <LoaderCircle size={18} className="spin" aria-hidden="true" />
                ) : (
                  <Download size={18} aria-hidden="true" />
                )}{' '}
                <span className="label">Download set</span>
              </button>
              <MenuButton
                label="More download options"
                className="button primary split-button-toggle"
                align="end"
                disabled={!canExport}
                items={[
                  {
                    label: `Download ${format.name} only`,
                    Icon: FileImage,
                    hint: `PNG · ${format.width} × ${format.height}`,
                    onSelect: () => void download(false),
                  },
                ]}
              >
                <ChevronDown size={18} />
              </MenuButton>
            </div>
          </>
        }
      >
        <h1 className="sr-only">Stream images</h1>
        <div className="document-title">
          <input
            className="document-name"
            aria-label="Stream set name"
            value={doc.name}
            maxLength={80}
            disabled={disabled}
            onChange={(e) => editor.rename(e.target.value)}
          />
        </div>
        <SaveStatus status={editor.saveStatus} error={editor.storageError} />
      </TopBar>
      <div className="workspace-body">
        <main className="editor-main" aria-label="Stream image previews">
          <div className="canvas-toolbar">
            <div className="canvas-title">
              <strong>{format.name}</strong>
              <span className="badge">
                {format.width} × {format.height} · {format.ratio}
              </span>
            </div>
            <div className="canvas-tools" role="group" aria-label="Canvas tools">
              <button
                className={`icon-button ${layout.flip ? 'selected' : ''}`}
                aria-label="Flip host horizontally"
                title="Flip host horizontally"
                aria-pressed={layout.flip}
                disabled={disabled || !doc.host}
                onClick={() => patch({ flip: !layout.flip })}
              >
                <FlipHorizontal2 size={20} />
              </button>
              <button
                className={`icon-button ${showControls ? 'selected' : ''}`}
                aria-label="Show image controls"
                title={
                  showControls ? 'Hide frame handles' : 'Show frame handles (or click the host)'
                }
                aria-pressed={showControls}
                disabled={disabled || !doc.host}
                onClick={() => setShowControls(!showControls)}
              >
                <SquareDashed size={20} />
              </button>
              <button
                className={`icon-button ${guides ? 'selected' : ''}`}
                aria-label="Show image safe area"
                aria-pressed={guides}
                onClick={() => setGuides(!guides)}
                title="Safe area guides (preview only)"
              >
                <ScanLine size={20} />
              </button>
            </div>
          </div>
          <div
            className={`stage si-stage ${dragging ? 'is-dragging' : ''}`}
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
            onPointerDown={(e) => {
              if (e.target === e.currentTarget && showControls) {
                setShowControls(false)
              }
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
                showControls={showControls}
                onSelectHost={setShowControls}
              />
              {guides && (
                <div className="si-guides" aria-hidden="true">
                  <span>Safe area</span>
                </div>
              )}
              {!doc.host && (
                <div className="si-placeholder">
                  <UserRound size={40} strokeWidth={1.5} aria-hidden="true" />
                  <strong>Add your host</strong>
                  <span>Drop a transparent PNG here. It fills all three images.</span>
                  {hostMenu(
                    'Add host image',
                    'button primary',
                    <>
                      <Plus size={18} aria-hidden="true" /> Add host image
                    </>,
                  )}
                </div>
              )}
            </div>
            {dragging && (
              <div className="drop-overlay">
                <Upload size={28} aria-hidden="true" />
                Drop your host image
              </div>
            )}
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
              </button>
            ))}
          </div>
        </main>
        <aside
          className="inspector"
          aria-label="Stream image settings"
          id="stream-controls"
          tabIndex={-1}
        >
          <header className="inspector-head">
            <span className="inspector-icon" aria-hidden="true">
              <ImageIcon size={18} />
            </span>
            <div className="inspector-heading">
              <h2>{format.name}</h2>
              <span>Framing and background apply to this image</span>
            </div>
          </header>
          <fieldset className="inspector-body" disabled={disabled}>
            <legend className="sr-only">Image customization</legend>
            <section className="panel-block" aria-labelledby="host-heading">
              <h3 id="host-heading" className="panel-block-title">
                Host image
              </h3>
              {doc.host ? (
                <div className="file-card">
                  <div className="file-card-thumb">
                    <ImageThumbnail image={images?.host} />
                  </div>
                  <div className="file-card-text">
                    <strong title={doc.host.name}>{doc.host.name}</strong>
                    <span>
                      {doc.host.width} × {doc.host.height} · all 3 images
                    </span>
                  </div>
                  {hostMenu('Replace host image', 'icon-button', <RefreshCw size={18} />)}
                  <button
                    className="icon-button"
                    aria-label="Remove host image"
                    title="Remove host image"
                    onClick={() => editor.setHost(null)}
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              ) : (
                <p className="field-hint">
                  No host yet. Add one from the canvas or drop a file on it. A transparent PNG works
                  best; photo backgrounds are kept.
                </p>
              )}
            </section>
            <Section
              title="Framing"
              summary={`${Math.round(layout.zoom)}% · ${layout.rotation}°`}
              open={open.framing}
              onToggle={() => toggle('framing')}
              onReset={() => patch(DEFAULT_FRAMING)}
            >
              <fieldset className="form-grid" disabled={!doc.host}>
                <legend className="sr-only">Host position</legend>
                <NumberField
                  label="Host size"
                  value={layout.zoom}
                  min={20}
                  max={300}
                  unit="%"
                  onChange={(zoom) => patch({ zoom })}
                />
                <NumberField
                  label="Host rotation"
                  value={layout.rotation}
                  min={-180}
                  max={180}
                  unit="°"
                  onChange={(rotation) => patch({ rotation })}
                />
                <NumberField
                  label="Host horizontal"
                  value={layout.x}
                  min={-50}
                  max={150}
                  step={0.25}
                  unit="%"
                  onChange={(x) => patch({ x })}
                />
                <NumberField
                  label="Host vertical"
                  value={layout.y}
                  min={-50}
                  max={150}
                  step={0.25}
                  unit="%"
                  onChange={(y) => patch({ y })}
                />
                {!doc.host && <p className="field-hint">Add a host image to frame it.</p>}
              </fieldset>
            </Section>
            <Section
              title="Background"
              summary={backgroundName}
              open={open.background}
              onToggle={() => toggle('background')}
            >
              <div className="field">
                <span className="field-label" id="bg-kind-label">
                  Background style
                </span>
                <div className="segmented" role="radiogroup" aria-labelledby="bg-kind-label">
                  {(
                    [
                      ['image', 'Image'],
                      ['gradient', 'Gradient'],
                      ['solid', 'Solid'],
                      ['transparent', 'None'],
                    ] as const
                  ).map(([id, name]) => (
                    <button
                      key={id}
                      role="radio"
                      aria-checked={backgroundKind === id}
                      className={backgroundKind === id ? 'active' : ''}
                      onClick={() => {
                        if (id === 'image') {
                          if (!imageBackground) selectBackground('grid')
                        } else patch({ background: id })
                      }}
                    >
                      {name}
                    </button>
                  ))}
                </div>
              </div>
              {imageBackground && (
                <>
                  <div className="si-background-grid" role="group" aria-label="Background images">
                    {BACKGROUNDS.map((bg) => (
                      <button
                        key={bg.id}
                        aria-label={`Use ${bg.name} background`}
                        aria-pressed={layout.background === bg.id}
                        onClick={() => selectBackground(bg.id)}
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
                        onClick={() => selectBackground(bg.id)}
                      >
                        <ImageThumbnail image={images?.backgrounds[bg.id]} />
                        <span title={bg.name}>{bg.name}</span>
                      </button>
                    ))}
                    <MenuButton
                      label="Add background"
                      className="si-background-add"
                      disabled={disabled}
                      items={[
                        {
                          label: 'Choose from Media gallery',
                          Icon: ImageIcon,
                          onSelect: () => setGalleryTarget('background'),
                        },
                        {
                          label: 'Upload from device',
                          Icon: Upload,
                          hint: 'Up to 8 custom backgrounds',
                          onSelect: () => backgroundInput.current?.click(),
                        },
                      ]}
                    >
                      <Plus size={20} aria-hidden="true" />
                      <span>Add</span>
                    </MenuButton>
                  </div>
                  {doc.backgrounds.some((bg) => bg.id === layout.background) && (
                    <button
                      className="button ghost danger-text sm"
                      onClick={() => {
                        editor.removeBackground(layout.background)
                        setNotice('Background removed. Undo to restore it.')
                      }}
                    >
                      <Trash2 size={16} aria-hidden="true" /> Remove this background
                    </button>
                  )}
                  <div className="form-grid">
                    <NumberField
                      label="Background horizontal"
                      min={0}
                      max={100}
                      value={layout.backgroundX}
                      unit="%"
                      onChange={(backgroundX) => patch({ backgroundX })}
                    />
                    <NumberField
                      label="Background vertical"
                      min={0}
                      max={100}
                      value={layout.backgroundY}
                      unit="%"
                      onChange={(backgroundY) => patch({ backgroundY })}
                    />
                    <NumberField
                      label="Background zoom"
                      min={100}
                      max={250}
                      value={layout.backgroundZoom}
                      unit="%"
                      onChange={(backgroundZoom) => patch({ backgroundZoom })}
                    />
                  </div>
                </>
              )}
              {(layout.background === 'gradient' || layout.background === 'solid') && (
                <>
                  <div className="swatch-row" role="group" aria-label="Background color presets">
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
                  <div className="color-grid">
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
                  </div>
                </>
              )}
              <button
                className="button outline full"
                onClick={() => {
                  editor.applyBackgroundToAll(selected)
                  setNotice('Background applied to all three images. Host framing is unchanged.')
                }}
              >
                <Copy size={16} aria-hidden="true" /> Use this background for all 3
              </button>
            </Section>
            <Section
              title="Shadow & fade"
              summary={`${layout.shadow}% host shadow`}
              open={open.finish}
              onToggle={() => toggle('finish')}
              onReset={() =>
                patch({ shadow: 0, fade: 0, bottomShadow: selected === 'hero' ? 65 : 0 })
              }
            >
              <NumberField
                label="Host shadow"
                min={0}
                max={100}
                value={layout.shadow}
                unit="%"
                onChange={(shadow) => patch({ shadow })}
              />
              <NumberField
                label="Bottom shadow"
                min={0}
                max={100}
                value={layout.bottomShadow ?? (selected === 'hero' ? 65 : 0)}
                unit="%"
                onChange={(bottomShadow) => patch({ bottomShadow })}
              />
              <NumberField
                label="Bottom fade"
                min={0}
                max={60}
                value={layout.fade}
                unit="%"
                onChange={(fade) => patch({ fade })}
              />
            </Section>
          </fieldset>
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
        <div className="toast toast-danger" role="alert">
          <span>{error || imageError}</span>
          {imageError && (
            <button className="button ghost sm" onClick={() => setRetry((n) => n + 1)}>
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
      <MediaGalleryModal
        open={galleryTarget !== null}
        initialCategory={galleryTarget === 'host' ? 'Host Images' : 'Backgrounds'}
        onClose={() => setGalleryTarget(null)}
        onSelect={handleSelectGallery}
        onUploadClick={() => {
          if (galleryTarget === 'host') hostInput.current?.click()
          else backgroundInput.current?.click()
        }}
      />
    </div>
  )
}
