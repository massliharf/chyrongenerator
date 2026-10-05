import { useEffect, useRef, useState } from 'react'
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  ChevronDown,
  Download,
  Expand,
  Film,
  HardDrive,
  HelpCircle,
  ImagePlus,
  MoreHorizontal,
  PanelRightClose,
  PanelRightOpen,
  Plus,
  Redo2,
  ScanLine,
  Undo2,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'
import { Composition } from './components/Composition'
import { MUSIC, Properties, type PropertiesTab } from './components/Properties'
import { Timeline, type TimingChange } from './components/Timeline'
import { ExportDialog } from './components/ExportDialog'
import { AppNav, type Workspace } from './components/WorkspaceNav'
import { MenuButton } from './components/Menu'
import { SaveStatus, TopBar } from './components/TopBar'
import { StorageDialog } from './components/StorageDialog'
import { BackgroundRemovalDialog } from './components/BackgroundRemovalDialog'
import StreamWorkspace from './stream/StreamWorkspace'
import MediaGalleryWorkspace from './gallery/MediaGalleryWorkspace'
import DesignerWorkspace from './designer/DesignerWorkspace'
import {
  DEFAULT_AUDIO,
  DEFAULT_PROJECT,
  PRIMARY_CHYRON,
  applyTemplateToStyle,
  applyTemplate,
  duration,
  hasArtwork,
  layerTiming,
  imageLayers,
  parseProject,
  pickStyle,
  restTime,
  styleOf,
  type ChyronStyle,
  type ElementLayer,
  type ImageLayer,
  type Layer,
  type Project,
  type Template,
} from './studio/model'
import {
  collectUnusedAssets,
  importImageFile,
  referencedAssets,
  restoreEmbeddedAssets,
} from './studio/assets'
import {
  LIMIT_MESSAGE,
  canAdd,
  chyronStylePatch,
  createChyronLayer,
  createImageLayer,
  createShapeLayer,
  duplicateLayer,
  moveLayer,
  removeLayer,
  updateLayer,
} from './studio/layers'
import { loadPresets, storePresets, useProject, type SavedPreset } from './studio/useProject'
import { usePlayback } from './studio/usePlayback'
import { useMusicPreview } from './studio/useMusicPreview'
import { AUDIO_ACCEPT, importAudioFile } from './studio/audio'
import {
  canChooseLocation,
  forgetProjectFile,
  saveProjectFile,
  type SavedFile,
} from './studio/projectFile'
import { generateId } from './utils/id'
import { MediaGalleryModal } from './components/MediaGalleryModal'
import { fetchGalleryFile, type GalleryItem } from './studio/galleryData'

function ChyronEditor({ active }: { active: boolean }) {
  const editor = useProject()
  const { project, patch, replace } = editor
  const playback = usePlayback(project)
  useMusicPreview(project.audio, duration(project), playback.playing, playback.time)
  const pauseRef = useRef(playback.pause)
  pauseRef.current = playback.pause
  useEffect(() => {
    // Leaving the workspace stops playback.
    if (!active) pauseRef.current()
  }, [active])
  const [tab, setTab] = useState<PropertiesTab>('design')
  // The chyron starts selected so its text is one click away.
  const [selection, setSelection] = useState<string | null>(PRIMARY_CHYRON)
  const [cropId, setCropId] = useState<string | null>(null)
  const [cutoutId, setCutoutId] = useState<string | null>(null)
  const [dropping, setDropping] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const [storageOpen, setStorageOpen] = useState(false)
  const [guides, setGuides] = useState(false)
  const [focusCanvas, setFocusCanvas] = useState(false)
  const [compactViewport, setCompactViewport] = useState(
    () => window.matchMedia('(max-width: 899px)').matches,
  )
  const [detailOverride, setDetailOverride] = useState<boolean | null>(null)
  const [deletedPreset, setDeletedPreset] = useState<SavedPreset | null>(null)
  const [presets, setPresets] = useState(loadPresets)
  const [notice, setNoticeText] = useState('')
  const [noticeAction, setNoticeAction] = useState<{ label: string; run: () => void } | null>(null)
  const setNotice = (text: string, action: { label: string; run: () => void } | null = null) => {
    setNoticeText(text)
    setNoticeAction(action)
  }
  const [lastSaved, setLastSaved] = useState<SavedFile | null>(null)
  const [help, setHelp] = useState(false)
  const [galleryOpen, setGalleryOpen] = useState(false)
  const importInput = useRef<HTMLInputElement>(null)
  const musicInput = useRef<HTMLInputElement>(null)
  const replaceInput = useRef<HTMLInputElement>(null)
  const replaceTarget = useRef<string | null>(null)
  const stage = useRef<HTMLDivElement>(null)
  const helpDialog = useRef<HTMLDialogElement>(null)
  // A layer removed by undo or a new composition can no longer stay selected.
  const selected =
    selection === MUSIC
      ? project.audio
        ? MUSIC
        : null
      : project.layers.some((l) => l.id === selection)
        ? selection
        : null
  // Crop mode ends when its layer is no longer the selection.
  useEffect(() => {
    if (cropId && cropId !== selected) setCropId(null)
  }, [cropId, selected])
  const selectedLayer = project.layers.find((l) => l.id === selected)
  const selectedImage = selectedLayer?.kind === 'image' ? selectedLayer : undefined
  const cutoutLayer = project.layers.find(
    (l): l is ImageLayer => l.id === cutoutId && l.kind === 'image',
  )
  const artworkDetail =
    !focusCanvas &&
    selected !== null &&
    (detailOverride ?? (compactViewport && project.previewBackground !== 'live'))
  const changeLayer = (id: string, values: Partial<ElementLayer>) =>
    patch({ layers: updateLayer(project, id, values as Partial<Layer>) })
  const changeChyron = (id: string, values: Partial<ChyronStyle>) =>
    patch(chyronStylePatch(project, id, values))
  /** Intro, hold and outro edits from the timeline or the Animate panel. */
  const setLayerTiming = (id: string, change: TimingChange) => {
    const layer = project.layers.find((l) => l.id === id)
    if (!layer) return
    const values: Record<string, number> = {}
    if (change.delay !== undefined) values.delay = change.delay
    if (change.endDelay !== undefined) values.endDelay = change.endDelay
    if (change.outLength !== undefined) values.outDuration = Math.min(30, change.outLength)
    // The first chyron's intro length is the composition's transition length.
    const transition = layer.id === PRIMARY_CHYRON
    if (change.length !== undefined && !transition) values.duration = Math.min(4, change.length)
    // Once an edge is set, keep the other one explicit so the clip stops mirroring.
    if (values.endDelay === undefined && layer.endDelay === undefined && 'delay' in values)
      values.endDelay = layer.delay
    if (values.outDuration === undefined && layer.outDuration === undefined) {
      const t = layerTiming(layer, project)
      if (Object.keys(values).length) values.outDuration = t.outLength
    }
    const next: Partial<Project> = {
      layers: updateLayer(project, id, values as Partial<Layer>),
    }
    if (change.length !== undefined && transition)
      next.animationDuration = Math.max(0.2, Math.min(4, change.length))
    patch(next)
  }
  const closeHelp = () => {
    helpDialog.current?.close()
    setHelp(false)
  }
  const select = (id: string, nextTab: PropertiesTab = 'design') => {
    setSelection(id)
    setTab(nextTab)
    setFocusCanvas(false)
  }
  const addImages = async (files: File[]) => {
    let next: Project = project
    let last: string | null = null
    const errors: string[] = []
    for (const file of files) {
      if (!canAdd(next, 'image')) {
        errors.push(LIMIT_MESSAGE.image)
        break
      }
      try {
        const stored = await importImageFile(file)
        const { layer, layers } = createImageLayer(next, {
          ...stored,
          opaque: file.type === 'image/jpeg',
        })
        next = { ...next, layers }
        last = layer.id
      } catch (error) {
        errors.push(error instanceof Error ? error.message : `${file.name} could not be added.`)
      }
    }
    if (last) {
      patch({ layers: next.layers })
      select(last, 'animate')
    }
    const added = imageLayers(next).length - imageLayers(project).length
    const id = last
    if (errors.length) setNotice(errors[0])
    else if (added > 1) setNotice(`${added} images added.`)
    else if (id)
      setNotice('Image added. Double-click it to crop.', {
        label: 'Crop',
        run: () => {
          select(id)
          setCropId(id)
        },
      })
  }
  const addChyron = (kind: 'chyron' | 'text') => {
    if (!canAdd(project, 'chyron')) return setNotice(LIMIT_MESSAGE.chyron)
    const { layer, layers } = createChyronLayer(project, kind)
    patch({ layers })
    select(layer.id)
    focusTitle()
  }
  const addShape = () => {
    if (!canAdd(project, 'shape')) return setNotice(LIMIT_MESSAGE.shape)
    const { layer } = createShapeLayer(project)
    // Shapes usually sit behind lettering: a selected chyron keeps the new shape just below it.
    const layers = [...project.layers]
    const below = selectedLayer?.kind === 'chyron' ? layers.indexOf(selectedLayer) : layers.length
    layers.splice(below, 0, layer)
    patch({ layers })
    select(layer.id)
  }
  const addMusic = async (file: File) => {
    try {
      setNotice(`Adding ${file.name}…`)
      const song = await importAudioFile(file)
      const keep = project.audio ?? DEFAULT_AUDIO
      patch({
        audio: {
          ...DEFAULT_AUDIO,
          ...keep,
          trim: 0,
          assetId: song.id,
          name: song.name,
          length: song.length,
        },
      })
      select(MUSIC)
      setNotice(`${song.name} added. It plays with the preview and every video export.`)
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'This music could not be added.')
    }
  }
  const replaceImage = async (id: string, file: File) => {
    const layer = project.layers.find((l): l is ImageLayer => l.id === id && l.kind === 'image')
    if (!layer) return
    try {
      const stored = await importImageFile(file)
      const aspect = stored.height / Math.max(1, stored.width)
      patch({
        layers: updateLayer(project, id, {
          assetId: stored.id,
          aspect,
          name: stored.name.replace(/\.[a-z0-9]+$/i, '').slice(0, 80) || layer.name,
          crop: undefined,
          sourceAspect: undefined,
          originalAssetId: undefined,
        } as Partial<Layer>),
      })
      setNotice('Image replaced. Its size, frame and animation stay the same.')
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'This image could not be used.')
    }
  }
  const removeLayerById = (id: string) => {
    if (id === MUSIC) {
      patch({ audio: undefined })
      setSelection(null)
      setNotice('Music removed. Undo to bring it back.')
      return
    }
    const layer = project.layers.find((l) => l.id === id)
    if (!layer) return
    patch({ layers: removeLayer(project, id) })
    setSelection(null)
    setNotice(`${layer.name} removed. Undo to bring it back.`)
  }
  const duplicateById = (id: string) => {
    const layer = project.layers.find((l) => l.id === id)
    const next = duplicateLayer(project, id)
    if (next.id) {
      patch({ layers: next.layers })
      setSelection(next.id)
    } else if (layer) setNotice(LIMIT_MESSAGE[layer.kind])
  }
  /** Select a chyron's words, ready to type over. */
  const focusTitle = () =>
    requestAnimationFrame(() => {
      const field = document.querySelector<HTMLTextAreaElement>('[data-title-input]')
      field?.focus()
      field?.select()
    })
  const handleSelectGalleryItem = async (item: GalleryItem) => {
    try {
      setNotice(`Adding ${item.name}…`)
      const file = await fetchGalleryFile(item)
      await addImages([file])
      setGalleryOpen(false)
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'Could not load gallery asset.')
    }
  }
  const handleSelectGalleryItemRef = useRef(handleSelectGalleryItem)
  handleSelectGalleryItemRef.current = handleSelectGalleryItem
  useEffect(() => {
    const handler = (e: Event) => {
      const custom = e as CustomEvent<GalleryItem>
      if (custom.detail) {
        void handleSelectGalleryItemRef.current(custom.detail)
      }
    }
    window.addEventListener('chyron:import-gallery-item', handler)
    return () => window.removeEventListener('chyron:import-gallery-item', handler)
  }, [])
  useEffect(() => {
    const media = window.matchMedia('(max-width: 899px)')
    const update = () => setCompactViewport(media.matches)
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])
  useEffect(() => {
    if (!notice) return
    const timeout = setTimeout(() => setNotice(''), deletedPreset || noticeAction ? 12000 : 6000)
    return () => clearTimeout(timeout)
  }, [notice, deletedPreset, noticeAction])
  useEffect(() => {
    if (help) helpDialog.current?.showModal()
  }, [help])
  useEffect(() => {
    // Remove files that neither the draft nor any saved style uses any more.
    const keep = referencedAssets([project, ...loadPresets().map((preset) => preset.project)])
    void collectUnusedAssets(keep).catch(() => {})
    // Only on first open: undo history within the session may still refer to files.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const saveProject = async (choose = false) => {
    try {
      const saved = await saveProjectFile(project, choose)
      if (!saved) return
      setLastSaved(saved)
      if (saved.missing)
        setNotice('Some images or music could not be included in the project file.')
      else
        setNotice(
          saved.picked
            ? `Saved ${saved.filename} where you chose.`
            : `Downloaded ${saved.filename} to your browser's downloads folder.`,
          { label: 'Where is my work?', run: () => setStorageOpen(true) },
        )
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'The project file could not be saved.')
    }
  }
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (!active) return
      const element = event.target as HTMLElement
      const typing =
        ['INPUT', 'TEXTAREA', 'SELECT'].includes(element.tagName) || element.isContentEditable
      if (exportOpen || help || storageOpen || cutoutId) return
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
        event.preventDefault()
        void saveProject(event.shiftKey)
        return
      }
      if (typing) return
      if ((event.key === 'Delete' || event.key === 'Backspace') && selected) {
        event.preventDefault()
        removeLayerById(selected)
        return
      }
      const layer = selectedLayer
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'd' && layer) {
        event.preventDefault()
        duplicateById(layer.id)
        return
      }
      if (!event.metaKey && !event.ctrlKey && !event.altKey && layer) {
        if (event.key === ']' || event.key === '[') {
          event.preventDefault()
          patch({ layers: moveLayer(project, layer.id, event.key === ']' ? 1 : -1) })
          return
        }
        if (event.key.toLowerCase() === 'h') {
          event.preventDefault()
          patch({ layers: updateLayer(project, layer.id, { visible: !layer.visible }) })
          return
        }
        if (event.key.toLowerCase() === 'c' && selectedImage) {
          event.preventDefault()
          setCropId(selectedImage.id)
          return
        }
      }
      if (event.key === '?') {
        event.preventDefault()
        setHelp(true)
        return
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault()
        if (event.shiftKey) editor.redo()
        else editor.undo()
        return
      }
      if (event.key === 'Escape') {
        setSelection(null)
        return
      }
      if (element.closest('button, a, summary, [role=tab], [role=menu], [role=slider]')) return
      if (event.code === 'Space') {
        event.preventDefault()
        playback.toggle()
      }
      if (event.key === 'ArrowRight') {
        event.preventDefault()
        playback.seek(playback.time + 1 / project.fps)
      }
      if (event.key === 'ArrowLeft') {
        event.preventDefault()
        playback.seek(playback.time - 1 / project.fps)
      }
    }
    window.addEventListener('keydown', keydown)
    return () => window.removeEventListener('keydown', keydown)
  })
  const storeAll = (next: SavedPreset[], success: string) => {
    try {
      storePresets(next)
      setPresets(next)
      setNotice(success)
      return true
    } catch {
      setNotice('Device storage is unavailable. Save a project file instead.')
      return false
    }
  }
  const savePreset = (name: string, id: string) => {
    if (presets.length >= 40) {
      setNotice('Your library is full. Remove a style to add another.')
      return false
    }
    const layer = project.layers.find((l) => l.id === id && l.kind === 'chyron')
    const style = layer?.kind === 'chyron' ? pickStyle(styleOf(project, layer)) : {}
    setDeletedPreset(null)
    return storeAll(
      [...presets, { id: generateId(), name, project: { ...project, ...style } }],
      'Style saved.',
    )
  }
  const removePreset = (id: string) => {
    const removed = presets.find((p) => p.id === id) || null
    if (
      storeAll(
        presets.filter((p) => p.id !== id),
        'Style removed.',
      )
    )
      setDeletedPreset(removed)
  }
  const restorePreset = () => {
    if (!deletedPreset) return
    if (storeAll([...presets, deletedPreset], 'Style restored.')) setDeletedPreset(null)
  }
  const applyStyle = (id: string, template: Template) => {
    if (id === PRIMARY_CHYRON) {
      const next = applyTemplate(project, template)
      replace(next)
      playback.seek(restTime(next))
      return
    }
    const layer = project.layers.find((l) => l.id === id && l.kind === 'chyron')
    if (layer?.kind !== 'chyron') return
    patch(chyronStylePatch(project, id, applyTemplateToStyle(styleOf(project, layer), template)))
    playback.seek(restTime(project))
  }
  return (
    <div className={`workspace-root chyron-root ${focusCanvas ? 'canvas-focused' : ''}`}>
      <a className="skip-link" href="#props-panel" onClick={() => setFocusCanvas(false)}>
        Skip to properties
      </a>
      <TopBar
        actions={
          <>
            <div className="history-actions">
              <button
                className="icon-button"
                aria-label="Undo"
                title="Undo (⌘/Ctrl Z)"
                disabled={!editor.canUndo}
                onClick={editor.undo}
              >
                <Undo2 size={20} />
              </button>
              <button
                className="icon-button"
                aria-label="Redo"
                title="Redo (⌘/Ctrl Shift Z)"
                disabled={!editor.canRedo}
                onClick={editor.redo}
              >
                <Redo2 size={20} />
              </button>
            </div>
            <button
              className="button primary topbar-primary"
              aria-label="Export"
              onClick={() => {
                playback.pause()
                setExportOpen(true)
              }}
            >
              <Download size={18} aria-hidden="true" /> <span className="label">Export</span>
            </button>
          </>
        }
      >
        <h1 className="sr-only">Chyron editor</h1>
        <div className="document-title">
          <input
            aria-label="Project name"
            className="document-name"
            value={project.name}
            maxLength={80}
            onChange={(e) => patch({ name: e.target.value })}
          />
          <MenuButton
            label="Project menu"
            items={[
              {
                label: 'Save project file',
                Icon: ArrowDownToLine,
                shortcut: '⌘ S',
                hint: 'One .chyron.json with every image and the music',
                onSelect: () => void saveProject(),
              },
              ...(canChooseLocation()
                ? [
                    {
                      label: 'Save as…',
                      Icon: ArrowDownToLine,
                      shortcut: '⇧⌘ S',
                      hint: 'Choose a new name or folder',
                      onSelect: () => void saveProject(true),
                    },
                  ]
                : []),
              {
                label: 'Open project file',
                Icon: ArrowUpFromLine,
                onSelect: () => importInput.current?.click(),
              },
              {
                label: 'New composition',
                Icon: Plus,
                onSelect: () => {
                  forgetProjectFile()
                  setLastSaved(null)
                  replace({ ...DEFAULT_PROJECT })
                  playback.seek(restTime(DEFAULT_PROJECT))
                  setSelection(PRIMARY_CHYRON)
                  setNotice('New composition. Undo to return to your previous work.')
                },
              },
              'separator',
              {
                label: 'Where is my work?',
                Icon: HardDrive,
                onSelect: () => setStorageOpen(true),
              },
              {
                label: 'Guide & shortcuts',
                Icon: HelpCircle,
                shortcut: '?',
                onSelect: () => setHelp(true),
              },
            ]}
          >
            <ChevronDown size={18} />
          </MenuButton>
        </div>
        <SaveStatus
          status={editor.saveStatus}
          error={editor.saveStatus.startsWith('Save a')}
          onOpen={() => setStorageOpen(true)}
        />
        <input
          type="file"
          ref={importInput}
          hidden
          accept=".json,.chyron.json"
          onChange={async (e) => {
            const input = e.currentTarget,
              file = input.files?.[0]
            if (!file) return
            try {
              if (file.size > 400 * 1024 * 1024)
                throw new Error('Choose a project file smaller than 400 MB.')
              const json = await file.text()
              const imported = parseProject(json)
              const raw = JSON.parse(json) as { assets?: unknown }
              await restoreEmbeddedAssets(raw.assets)
              forgetProjectFile()
              setLastSaved(null)
              replace(imported)
              setSelection(PRIMARY_CHYRON)
              playback.seek(restTime(imported))
              setNotice(`Opened ${file.name}.`)
            } catch (error) {
              setNotice(error instanceof Error ? error.message : 'Unable to open this file.')
            }
            input.value = ''
          }}
        />
      </TopBar>
      {/* Pickers for music and for replacing an image; opened from menus and the inspector. */}
      <input
        type="file"
        ref={musicInput}
        hidden
        accept={AUDIO_ACCEPT}
        aria-label="Music file"
        onChange={(e) => {
          const file = e.currentTarget.files?.[0]
          e.currentTarget.value = ''
          if (file) void addMusic(file)
        }}
      />
      <input
        type="file"
        ref={replaceInput}
        hidden
        accept="image/png,image/jpeg,image/webp,image/gif"
        aria-label="Replacement image"
        onChange={(e) => {
          const file = e.currentTarget.files?.[0]
          e.currentTarget.value = ''
          if (file && replaceTarget.current) void replaceImage(replaceTarget.current, file)
        }}
      />
      <div className="workspace-body">
        <main className="editor-main" aria-label="Canvas and timeline">
          <h2 className="sr-only">Canvas</h2>
          <div className="canvas-toolbar">
            <button
              className="canvas-size"
              aria-label={`Canvas settings: ${project.width} by ${project.height}`}
              aria-pressed={selected === null}
              title="Canvas size, timing and frame rate"
              onClick={() => {
                setFocusCanvas(false)
                setSelection(null)
              }}
            >
              <Film size={16} aria-hidden="true" />
              <span>
                {project.width} × {project.height}
              </span>
              <span className="canvas-size-meta">
                {project.fps} fps · {duration(project).toFixed(1)} s
              </span>
            </button>
            <div className="canvas-tools">
              <button
                className={`icon-button ${artworkDetail ? 'selected' : ''}`}
                aria-label={artworkDetail ? 'Fit canvas preview' : 'Show artwork detail'}
                aria-pressed={artworkDetail}
                title={artworkDetail ? 'Fit canvas' : 'Zoom to artwork'}
                disabled={selected === null || focusCanvas}
                onClick={() => setDetailOverride(!artworkDetail)}
              >
                {artworkDetail ? <ZoomOut size={20} /> : <ZoomIn size={20} />}
              </button>
              <MenuButton
                label="Preview options"
                align="end"
                items={[
                  ...(['live', 'checker', 'dark', 'light'] as const).map((bg) => ({
                    label:
                      bg === 'live'
                        ? 'Live photo background'
                        : bg === 'checker'
                          ? 'Transparency grid'
                          : bg === 'dark'
                            ? 'Dark background'
                            : 'Light background',
                    checked: project.previewBackground === bg,
                    onSelect: () => patch({ previewBackground: bg }),
                  })),
                  'separator' as const,
                  {
                    label: guides ? 'Hide safe area' : 'Show safe area',
                    Icon: ScanLine,
                    onSelect: () => setGuides(!guides),
                  },
                  {
                    label: 'Fullscreen preview',
                    Icon: Expand,
                    onSelect: () => {
                      if (document.fullscreenElement) void document.exitFullscreen()
                      else if (stage.current?.requestFullscreen)
                        void stage.current
                          .requestFullscreen()
                          .catch(() => setNotice('Fullscreen is unavailable in this browser.'))
                      else setNotice('Fullscreen is unavailable in this browser.')
                    },
                  },
                ]}
              >
                <MoreHorizontal size={20} />
              </MenuButton>
              <button
                className={`icon-button focus-toggle ${focusCanvas ? 'selected' : ''}`}
                aria-label={focusCanvas ? 'Show properties' : 'Focus canvas'}
                aria-pressed={focusCanvas}
                title={focusCanvas ? 'Show properties' : 'Hide properties'}
                onClick={() => setFocusCanvas(!focusCanvas)}
              >
                {focusCanvas ? <PanelRightOpen size={20} /> : <PanelRightClose size={20} />}
              </button>
            </div>
          </div>
          <div
            className={`stage stage-surround ${artworkDetail ? 'artwork-detail' : ''} ${dropping ? 'is-dropping' : ''}`}
            ref={stage}
            onPointerDown={(e) => {
              // Clicking empty space around the artwork clears the selection.
              if (e.target === e.currentTarget) setSelection(null)
            }}
            onDragOver={(e) => {
              if (!Array.from(e.dataTransfer.types).includes('Files')) return
              e.preventDefault()
              e.dataTransfer.dropEffect = 'copy'
              if (!dropping) setDropping(true)
            }}
            onDragLeave={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node)) setDropping(false)
            }}
            onDrop={(e) => {
              e.preventDefault()
              setDropping(false)
              const all = Array.from(e.dataTransfer.files)
              const files = all.filter((f) => f.type.startsWith('image/'))
              const song = all.find((f) => f.type.startsWith('audio/'))
              if (song) void addMusic(song)
              if (files.length) void addImages(files)
              else if (!song) setNotice('Drop a PNG, JPEG, WebP or GIF image, or a music file.')
            }}
          >
            {dropping && (
              <div className="drop-overlay" aria-hidden="true">
                <ImagePlus size={28} /> Drop to add a layer
              </div>
            )}
            <div
              className={`stage-canvas ${project.previewBackground}`}
              style={
                {
                  aspectRatio: `${project.width}/${project.height}`,
                  '--canvas-aspect': project.width / project.height,
                  backgroundColor:
                    project.previewBackground === 'color' ? project.background : undefined,
                } as React.CSSProperties
              }
              onPointerDown={(e) => {
                if (e.target === e.currentTarget) setSelection(null)
              }}
            >
              <Composition
                project={project}
                time={playback.time}
                onChyronChange={changeChyron}
                onLayerChange={changeLayer}
                selected={selected}
                onSelect={setSelection}
                cropping={cropId !== null && cropId === selected}
                onCropChange={setCropId}
                onEditText={(id) => {
                  select(id)
                  focusTitle()
                }}
              />
              {guides && <div className="safe-guides" />}
              {!hasArtwork(project) && (
                <div className="empty-canvas">
                  <strong>Nothing to show yet</strong>
                  <span>Use Add in the timeline for a chyron, text, shape, image or music.</span>
                </div>
              )}
            </div>
          </div>
          <Timeline
            project={project}
            playback={playback}
            selected={selected}
            onSelect={setSelection}
            onToggleVisible={(id) => {
              const layer = project.layers.find((l) => l.id === id)
              if (layer) patch({ layers: updateLayer(project, id, { visible: !layer.visible }) })
            }}
            onToggleLock={(id) => {
              const layer = project.layers.find((l) => l.id === id)
              if (layer) patch({ layers: updateLayer(project, id, { locked: !layer.locked }) })
            }}
            onAddImages={(files) => void addImages(files)}
            onOpenGallery={() => setGalleryOpen(true)}
            onAddChyron={addChyron}
            onAddShape={addShape}
            onAddMusic={() => musicInput.current?.click()}
            onMusicChange={(values) =>
              project.audio && patch({ audio: { ...project.audio, ...values } })
            }
            onTiming={(id, change) => setLayerTiming(id, change)}
            onReorder={(id, index) => {
              const layers = project.layers.filter((l) => l.id !== id)
              const layer = project.layers.find((l) => l.id === id)
              if (!layer) return
              layers.splice(Math.min(layers.length, Math.max(0, index)), 0, layer)
              patch({ layers })
            }}
          />
        </main>
        <div className="inspector-slot" hidden={focusCanvas}>
          <Properties
            project={project}
            patch={patch}
            onCrop={(id) => {
              setSelection(id)
              setCropId(id)
            }}
            onRemoveBackground={(id) => {
              playback.pause()
              setCutoutId(id)
            }}
            onReplaceImage={(id) => {
              replaceTarget.current = id
              replaceInput.current?.click()
            }}
            onDelete={removeLayerById}
            onDuplicate={duplicateById}
            onReplaceMusic={() => musicInput.current?.click()}
            onRemoveMusic={() => removeLayerById(MUSIC)}
            selected={selected}
            onSelect={setSelection}
            tab={tab}
            onTab={setTab}
            previewPhase={playback.previewPhase}
            presets={presets}
            onApplyTemplate={applyStyle}
            onSavePreset={savePreset}
            onRemovePreset={removePreset}
            onTiming={setLayerTiming}
          />
        </div>
      </div>
      {exportOpen && (
        <ExportDialog project={project} time={playback.time} onClose={() => setExportOpen(false)} />
      )}
      {storageOpen && (
        <StorageDialog
          project={project}
          saveStatus={editor.saveStatus}
          lastSaved={lastSaved}
          onSave={(choose) => void saveProject(choose)}
          onClose={() => setStorageOpen(false)}
        />
      )}
      {cutoutLayer && (
        <BackgroundRemovalDialog
          layer={cutoutLayer}
          onApply={(assetId) => {
            patch({
              layers: updateLayer(project, cutoutLayer.id, {
                assetId,
                originalAssetId: cutoutLayer.originalAssetId ?? cutoutLayer.assetId,
              } as Partial<Layer>),
            })
            setCutoutId(null)
            setNotice('Background removed. Restore the original from Design any time.')
          }}
          onClose={() => setCutoutId(null)}
        />
      )}
      <MediaGalleryModal
        open={galleryOpen}
        onClose={() => setGalleryOpen(false)}
        onSelect={handleSelectGalleryItem}
        onUploadClick={() => importInput.current?.click()}
      />
      {notice && (
        <div className="toast" role="status">
          <span>{notice}</span>
          {deletedPreset && (
            <button className="button ghost sm" onClick={restorePreset}>
              Undo
            </button>
          )}
          {noticeAction && (
            <button
              className="button ghost sm"
              onClick={() => {
                noticeAction.run()
                setNotice('')
              }}
            >
              {noticeAction.label}
            </button>
          )}
          <button
            className="icon-button"
            aria-label="Dismiss notification"
            onClick={() => setNotice('')}
          >
            <X size={16} />
          </button>
        </div>
      )}
      {help && (
        <dialog
          className="dialog dialog-md help-dialog"
          ref={helpDialog}
          onCancel={(event) => {
            event.preventDefault()
            closeHelp()
          }}
          aria-labelledby="help-title"
        >
          <div className="dialog-header">
            <h2 id="help-title">Guide & shortcuts</h2>
            <button className="icon-button" aria-label="Close tour" onClick={closeHelp}>
              <X size={18} />
            </button>
          </div>
          <div className="dialog-body">
            <ol className="help-steps">
              <li>
                <strong>Build in layers.</strong> Add chyrons, text, shapes, images and music with
                Add in the timeline; each one animates on its own.
              </li>
              <li>
                <strong>Select, then edit.</strong> Click anything on the canvas or in the timeline;
                its settings open on the right. Double-click a chyron to type, an image to crop.
              </li>
              <li>
                <strong>Shape time in the timeline.</strong> Drag a bar to delay it, drag its edge
                to lengthen the transition, drag a name to reorder.
              </li>
              <li>
                <strong>Pick a style to see it.</strong> Every animation plays as soon as you choose
                it; pick it again to replay.
              </li>
            </ol>
            <h3 className="shortcut-title">Shortcuts</h3>
            <dl className="shortcuts">
              {[
                ['Space', 'Play / pause'],
                ['← →', 'Step one frame'],
                ['Esc', 'Composition settings'],
                ['⌘/Ctrl D', 'Duplicate layer'],
                ['[ ]', 'Send backward / bring forward'],
                ['H', 'Hide / show layer'],
                ['C', 'Crop image'],
                ['Del', 'Delete layer'],
                ['⌘/Ctrl Z', 'Undo (⇧ to redo)'],
                ['⌘/Ctrl S', 'Save project file (⇧ to choose where)'],
                ['Arrows on canvas', 'Nudge (⇧ for 4×)'],
                ['?', 'This guide'],
              ].map(([keys, action]) => (
                <div key={keys}>
                  <dt>
                    <kbd>{keys}</kbd>
                  </dt>
                  <dd>{action}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div className="dialog-footer">
            <span className="dialog-footer-spacer" />
            <button className="button primary" onClick={closeHelp}>
              Done
            </button>
          </div>
        </dialog>
      )}
    </div>
  )
}
function App() {
  const [workspace, setWorkspace] = useState<Workspace>(() => {
    try {
      const stored = localStorage.getItem('chyron-studio:workspace')
      if (stored === 'stream' || stored === 'gallery' || stored === 'designer') return stored
      return 'chyron'
    } catch {
      return 'chyron'
    }
  })
  const [streamVisited, setStreamVisited] = useState(workspace === 'stream')
  const [galleryVisited, setGalleryVisited] = useState(workspace === 'gallery')
  const [designerVisited, setDesignerVisited] = useState(workspace === 'designer')
  const changeWorkspace = (next: Workspace) => {
    if (next === workspace) return
    if (next === 'stream') setStreamVisited(true)
    if (next === 'gallery') setGalleryVisited(true)
    if (next === 'designer') setDesignerVisited(true)
    setWorkspace(next)
    try {
      localStorage.setItem('chyron-studio:workspace', next)
    } catch {
      /* Current session still works. */
    }
  }
  return (
    <div className="app-shell">
      <AppNav current={workspace} onChange={changeWorkspace} />
      <div className="app-content">
        <div className="workspace-slot" data-workspace="chyron" hidden={workspace !== 'chyron'}>
          <ChyronEditor active={workspace === 'chyron'} />
        </div>
        {designerVisited && (
          <div
            className="workspace-slot"
            data-workspace="designer"
            hidden={workspace !== 'designer'}
          >
            <DesignerWorkspace active={workspace === 'designer'} />
          </div>
        )}
        {streamVisited && (
          <div className="workspace-slot" data-workspace="stream" hidden={workspace !== 'stream'}>
            <StreamWorkspace active={workspace === 'stream'} />
          </div>
        )}
        {galleryVisited && (
          <div className="workspace-slot" data-workspace="gallery" hidden={workspace !== 'gallery'}>
            <MediaGalleryWorkspace
              active={workspace === 'gallery'}
              onWorkspaceChange={changeWorkspace}
            />
          </div>
        )}
      </div>
    </div>
  )
}
export default App
