import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  FileImage,
  LoaderCircle,
  MoreHorizontal,
  PencilLine,
  Plus,
  Settings2,
  Trash2,
  X,
} from 'lucide-react'
import { DesignEditor } from '../../designer/DesignerWorkspace'
import { fileStem, type DesignDoc, type Layer } from '../../designer/model'
import { renderArtboard, useAssetImages } from '../../designer/render'
import { MenuButton, type MenuEntry } from '../../components/Menu'
import { MediaGalleryModal } from '../../components/MediaGalleryModal'
import { saveBlob } from '../../studio/export'
import { fetchGalleryFile, type GalleryItem } from '../../studio/galleryData'
import { BACKGROUNDS } from '../../stream/model'
import { importImage } from '../../stream/assets'
import {
  SAVVY_ACCEPT,
  SAVVY_TYPE,
  savvyKind,
  savvyName,
  sendSavvyFile,
} from '../../utils/savvyFile'
import { generateId } from '../../utils/id'
import {
  HERO_SIZES,
  MAX_BACKGROUNDS,
  MORE_SIZES,
  defaultSet,
  neighborsOf,
  parseHero,
  pruneHeroAssets,
} from './model'
import { readAsDataUrl, useHeroProject } from './useHeroProject'
import { HeroExportDialog } from './HeroExportDialog'
import { HeroPanel, type PickSource } from './HeroPanel'
import { exportImages } from './export'
import { subscribeHeroPicks } from './handoff'

/** A small picture of an artboard for the list; redrawn as it changes. */
function ArtboardThumb({ doc, version }: { doc: DesignDoc; version: number }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const frame = requestAnimationFrame(() => {
      const scale = Math.min(56 / doc.width, 40 / doc.height)
      const art = renderArtboard(doc, scale * (window.devicePixelRatio || 1))
      el.width = art.width
      el.height = art.height
      el.getContext('2d')?.drawImage(art, 0, 0)
    })
    return () => cancelAnimationFrame(frame)
  }, [doc, version])
  return <canvas ref={ref} className="hero-thumb" aria-hidden="true" />
}

const isPicture = (file: File) => ['image/png', 'image/jpeg', 'image/webp'].includes(file.type)

/**
 * Hero image generator: the stream images (hero image, host card, stream
 * image, and any other size) side by side on one canvas. Each artboard keeps
 * the stream image settings in the panel on the right — host framing,
 * background, shadow and fade — and takes any Designer layer on top.
 */
export function HeroApp({
  active,
  onBack,
  incoming,
  onIncomingDone,
}: {
  active: boolean
  onBack: () => void
  /** A .savvy set handed over from another editor. */
  incoming: File | null
  onIncomingDone: () => void
}) {
  const hero = useHeroProject()
  const { set, active: activeId, editor, artboards, look } = hero
  const board = set.artboards.find((a) => a.id === activeId)!
  const [exportOpen, setExportOpen] = useState(false)
  const [renaming, setRenaming] = useState<string | null>(null)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState('')
  const [gallery, setGallery] = useState<'host' | 'background' | null>(null)
  const [focus, setFocus] = useState(0)
  const openInput = useRef<HTMLInputElement>(null)
  const hostInput = useRef<HTMLInputElement>(null)
  const backgroundInput = useRef<HTMLInputElement>(null)
  const pending = useRef(false)
  const version = useAssetImages(editor.doc)
  const neighbors = useMemo(() => neighborsOf(set, activeId), [set, activeId])
  const count = set.artboards.length
  const disabled = !editor.ready || !!busy

  useEffect(() => {
    if (!notice) return
    const t = setTimeout(() => setNotice(''), 5000)
    return () => clearTimeout(t)
  }, [notice])

  /* ---------- Host and backgrounds ---------- */
  const takePicture = async (file: File | undefined, target: 'host' | 'background') => {
    if (!file || pending.current) return
    if (target === 'background' && set.backgrounds.length >= MAX_BACKGROUNDS) {
      setError(
        `You can keep ${MAX_BACKGROUNDS} custom backgrounds. Select and remove one to make room for another.`,
      )
      return
    }
    pending.current = true
    setBusy(target === 'host' ? 'Preparing your host…' : 'Opening background…')
    setError('')
    try {
      // The host is measured without its transparent margins, as stream images frame it.
      const picture = await importImage(file, target === 'host')
      const src = await readAsDataUrl(picture.blob)
      if (target === 'host') {
        look.setHost(
          {
            asset: generateId(),
            name: picture.name,
            width: picture.width,
            height: picture.height,
            bounds: picture.bounds,
          },
          src,
        )
        setNotice(`Host updated on all ${count} artboards. Each keeps its own framing.`)
      } else {
        look.addBackground(
          { id: generateId(), name: picture.name, width: picture.width, height: picture.height },
          src,
        )
        setNotice('Background added to this artboard.')
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to open this image.')
    } finally {
      setBusy('')
      pending.current = false
    }
  }
  const takeGalleryItem = async (item: GalleryItem, target: 'host' | 'background') => {
    const preset = target === 'background' && BACKGROUNDS.find((b) => b.id === item.id)
    if (preset) {
      look.patch({ background: preset.id, backgroundX: 50, backgroundY: 50, backgroundZoom: 100 })
      setNotice(`Applied ${preset.name} background.`)
      return
    }
    try {
      setBusy(target === 'host' ? 'Preparing your host…' : 'Opening background…')
      const file = await fetchGalleryFile(item)
      setBusy('')
      await takePicture(file, target)
    } catch (cause) {
      setBusy('')
      setError(cause instanceof Error ? cause.message : 'Could not load the gallery picture.')
    }
  }
  const pick = (target: 'host' | 'background') => (source: PickSource) => {
    if (source === 'gallery') setGallery(target)
    else (target === 'host' ? hostInput : backgroundInput).current?.click()
  }
  // Pictures sent from the Media gallery ("Use in Hero image generator").
  const galleryRef = useRef(takeGalleryItem)
  useEffect(() => {
    galleryRef.current = takeGalleryItem
  })
  useEffect(() => {
    if (!editor.ready) return
    return subscribeHeroPicks((p) => void galleryRef.current(p.item, p.target))
  }, [editor.ready])

  /* ---------- Download ---------- */
  const download = async (all: boolean) => {
    if (pending.current) return
    pending.current = true
    setError('')
    try {
      const result = await exportImages(set, all ? set.artboards : [board], {
        progress: (name) => setBusy(`Preparing ${name.toLowerCase()}…`),
      })
      saveBlob(result.blob, result.filename)
      setNotice(
        all
          ? `${result.filename} is ready: ${count} full-size PNGs.`
          : `${board.doc.name} downloaded at ${board.doc.width} × ${board.doc.height}.`,
      )
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Export failed. Please try again.')
    } finally {
      setBusy('')
      pending.current = false
    }
  }

  /* ---------- Files ---------- */
  const save = () => {
    const file = savvyName(fileStem(set.name))
    saveBlob(new Blob([JSON.stringify(pruneHeroAssets(set))], { type: SAVVY_TYPE }), file)
    setNotice(`Saved ${file} to your downloads folder.`)
  }
  const openFile = async (file: File) => {
    try {
      const text = await file.text()
      let raw: unknown = null
      try {
        raw = JSON.parse(text)
      } catch {
        /* parseHero explains. */
      }
      const kind = savvyKind(raw)
      if (kind === 'chyron' || kind === 'design') return sendSavvyFile(kind, file)
      hero.replace(parseHero(text))
      setFocus((n) => n + 1)
      setNotice(`Opened ${file.name}. Undo to go back.`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'This file could not be opened.')
    }
  }
  const openRef = useRef(openFile)
  useEffect(() => {
    openRef.current = openFile
  })
  useEffect(() => {
    if (!incoming || !editor.ready) return
    void openRef.current(incoming)
    onIncomingDone()
  }, [incoming, editor.ready, onIncomingDone])

  /* ---------- Artboards ---------- */
  const show = (id: string) => {
    artboards.select(id)
    setFocus((n) => n + 1)
  }
  const sizeItems = (sizes: { name: string; width: number; height: number }[]): MenuEntry[] =>
    sizes.map((s) => ({
      label: s.name,
      hint: `${s.width} × ${s.height}`,
      onSelect: () => {
        artboards.add(s.name, s.width, s.height)
        setFocus((n) => n + 1)
      },
    }))
  const addMenu: MenuEntry[] = [...sizeItems(HERO_SIZES), 'separator', ...sizeItems(MORE_SIZES)]

  const panel = (
    <section className="hero-artboards" aria-label="Artboards">
      <div className="dz-left-head">
        <h2>
          Artboards <span className="count-badge">{count}</span>
        </h2>
        <MenuButton
          label="Add artboard"
          align="end"
          className="icon-button sm"
          title="Add an artboard in another size"
          items={addMenu}
        >
          <Plus size={16} />
        </MenuButton>
      </div>
      <ul className="hero-artboard-list">
        {set.artboards.map((a, i) => (
          <li key={a.id} className={a.id === activeId ? 'is-active' : ''}>
            {renaming === a.id ? (
              <input
                className="hero-rename"
                aria-label="Artboard name"
                defaultValue={a.doc.name}
                maxLength={60}
                autoFocus
                onBlur={(e) => {
                  const name = e.currentTarget.value.trim()
                  if (name && name !== a.doc.name) artboards.rename(a.id, name)
                  setRenaming(null)
                }}
                onKeyDown={(e) => {
                  e.stopPropagation()
                  if (e.key === 'Enter') e.currentTarget.blur()
                  if (e.key === 'Escape') setRenaming(null)
                }}
              />
            ) : (
              <button
                className="hero-artboard"
                aria-pressed={a.id === activeId}
                title="Edit this artboard · double-click to rename"
                onClick={() => show(a.id)}
                onDoubleClick={() => setRenaming(a.id)}
              >
                <span className="hero-thumb-frame">
                  <ArtboardThumb doc={{ ...a.doc, assets: set.assets }} version={version} />
                </span>
                <span className="hero-artboard-text">
                  <strong>{a.doc.name}</strong>
                  <small>
                    {a.doc.width} × {a.doc.height}
                  </small>
                </span>
              </button>
            )}
            <MenuButton
              label={`Actions for ${a.doc.name}`}
              align="end"
              className="icon-button sm hero-artboard-more"
              items={[
                { label: 'Rename', Icon: PencilLine, onSelect: () => setRenaming(a.id) },
                {
                  label: 'Duplicate',
                  Icon: Copy,
                  onSelect: () => {
                    artboards.duplicate(a.id)
                    setFocus((n) => n + 1)
                  },
                },
                {
                  label: 'Move left',
                  Icon: ChevronLeft,
                  disabled: i === 0,
                  onSelect: () => artboards.move(a.id, -1),
                },
                {
                  label: 'Move right',
                  Icon: ChevronRight,
                  disabled: i === count - 1,
                  onSelect: () => artboards.move(a.id, 1),
                },
                'separator',
                {
                  label: 'Delete artboard',
                  Icon: Trash2,
                  danger: true,
                  disabled: count < 2,
                  onSelect: () => {
                    if (artboards.remove(a.id))
                      setNotice(`${a.doc.name} deleted. Undo to bring it back.`)
                  },
                },
              ]}
            >
              <MoreHorizontal size={16} />
            </MenuButton>
          </li>
        ))}
      </ul>
      <p className="hero-hint">
        Click an artboard on the canvas to edit it. Right-click a layer › Copy to other artboards to
        put it in every size.
      </p>
    </section>
  )

  const title = (
    <>
      <h1 className="sr-only">Hero image generator</h1>
      <button className="button ghost sm hero-back" onClick={onBack} title="All apps">
        <ChevronLeft size={16} aria-hidden="true" /> Apps
      </button>
      <div className="document-title">
        <input
          aria-label="Set name"
          className="document-name"
          value={set.name}
          maxLength={80}
          onChange={(e) => hero.setName(e.target.value)}
        />
        <MenuButton
          label="Set menu"
          items={[
            {
              label: 'Save set file',
              Icon: ArrowDownToLine,
              shortcut: '⌘ S',
              hint: 'One .savvy with every artboard and picture',
              onSelect: save,
            },
            {
              label: 'Open set file',
              Icon: ArrowUpFromLine,
              onSelect: () => openInput.current?.click(),
            },
            {
              label: 'New set',
              Icon: Plus,
              hint: 'Hero image, host card and stream image',
              onSelect: () => {
                hero.replace(defaultSet())
                setFocus((n) => n + 1)
                setNotice('New set. Undo to return to your previous work.')
              },
            },
          ]}
        >
          <ChevronDown size={18} />
        </MenuButton>
      </div>
    </>
  )

  const actions = (
    <div className="split-button">
      <button
        className="button primary topbar-primary"
        aria-label="Download set"
        title={`Every artboard as a full-size PNG, in one ZIP (${count} images)`}
        disabled={disabled}
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
        disabled={disabled}
        items={[
          {
            label: `Download ${board.doc.name} only`,
            Icon: FileImage,
            hint: `PNG · ${board.doc.width} × ${board.doc.height}`,
            onSelect: () => void download(false),
          },
          {
            label: 'Export options…',
            Icon: Settings2,
            shortcut: '⌘ E',
            hint: 'Choose artboards, JPEG or WebP, 2×',
            onSelect: () => setExportOpen(true),
          },
        ]}
      >
        <ChevronDown size={18} />
      </MenuButton>
    </div>
  )

  return (
    <div className="hero-app">
      <DesignEditor
        active={active}
        editor={editor}
        board={{
          activeId,
          neighbors,
          focus,
          onActivate: (id) => artboards.select(id),
          title,
          panel,
          actions,
          onExport: () => setExportOpen(true),
          onSave: save,
          onCopyToOthers: (layers: Layer[]) => {
            const own = layers.filter((l) => !l.role)
            if (!own.length)
              return setNotice(
                'Every artboard has its own host, background and bottom shadow: set them in the panel.',
              )
            artboards.copyToOthers(own)
            setNotice(
              `${own.length === 1 ? own[0].name : `${own.length} layers`} copied to ${count - 1} other artboard${count === 2 ? '' : 's'}. Undo to take it back.`,
            )
          },
          onDropFiles: (files) => {
            if (set.host || files.length !== 1 || !isPicture(files[0])) return false
            void takePicture(files[0], 'host')
            return true
          },
          inspector: (selected) => {
            const role = selected.length === 1 ? (selected[0].role ?? false) : null
            if (role === false || selected.length > 1) return null
            return (
              <HeroPanel
                set={set}
                artboard={board}
                role={role}
                disabled={disabled}
                onPatch={look.patch}
                onPickHost={pick('host')}
                onRemoveHost={() => {
                  look.setHost(null)
                  setNotice('Host removed from every artboard. Undo to bring it back.')
                }}
                onPickBackground={pick('background')}
                onRemoveBackground={(id) => {
                  look.removeBackground(id)
                  setNotice('Background removed. Undo to restore it.')
                }}
                onResize={look.resize}
                onNotice={setNotice}
              />
            )
          },
          name: 'Hero image generator',
        }}
      />
      <input
        ref={openInput}
        type="file"
        hidden
        accept={SAVVY_ACCEPT}
        onChange={(e) => {
          const file = e.currentTarget.files?.[0]
          e.currentTarget.value = ''
          if (file) void openFile(file)
        }}
      />
      <input
        ref={hostInput}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        hidden
        aria-label="Host image file"
        onChange={(e) => {
          void takePicture(e.currentTarget.files?.[0], 'host')
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
          void takePicture(e.currentTarget.files?.[0], 'background')
          e.currentTarget.value = ''
        }}
      />
      <MediaGalleryModal
        open={gallery !== null}
        initialCategory={gallery === 'host' ? 'Host Images' : 'Backgrounds'}
        onClose={() => setGallery(null)}
        onSelect={(item) => {
          const target = gallery ?? 'host'
          setGallery(null)
          void takeGalleryItem(item, target)
        }}
        onUploadClick={() =>
          (gallery === 'background' ? backgroundInput : hostInput).current?.click()
        }
      />
      {exportOpen && (
        <HeroExportDialog set={set} activeId={activeId} onClose={() => setExportOpen(false)} />
      )}
      {error && (
        <div className="toast toast-danger hero-toast" role="alert">
          <span>{error}</span>
          <button className="icon-button" aria-label="Dismiss error" onClick={() => setError('')}>
            <X size={16} />
          </button>
        </div>
      )}
      {!error && (notice || busy) && (
        <div className="toast hero-toast" role="status">
          {busy && <LoaderCircle className="spin" size={18} aria-hidden="true" />}
          <span>{busy || notice}</span>
          {!busy && (
            <button
              className="icon-button"
              aria-label="Dismiss notification"
              onClick={() => setNotice('')}
            >
              <X size={16} />
            </button>
          )}
        </div>
      )}
    </div>
  )
}
