import { useEffect, useRef, useState } from 'react'
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Check,
  ChevronDown,
  Download,
  Expand,
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
import { Properties, type PropertiesTab } from './components/Properties'
import { Timeline } from './components/Timeline'
import { ExportDialog } from './components/ExportDialog'
import { ThemeToggle } from './components/ThemeToggle'
import { WorkspaceNav, type Workspace } from './components/WorkspaceNav'
import StreamWorkspace from './stream/StreamWorkspace'
import {
  applyTemplate,
  DEFAULT_PROJECT,
  duration,
  fileStem,
  hasArtwork,
  imageLayers,
  parseProject,
  restTime,
  type ImageLayer,
  type Project,
  type Template,
} from './studio/model'
import {
  collectUnusedAssets,
  embedAssets,
  importImageFile,
  referencedAssets,
  restoreEmbeddedAssets,
} from './studio/assets'
import {
  canAddImage,
  createImageLayer,
  duplicateLayer,
  moveLayer,
  removeLayer,
  updateLayer,
} from './studio/layers'
import { loadPresets, storePresets, useProject, type SavedPreset } from './studio/useProject'
import { usePlayback } from './studio/usePlayback'
import { saveBlob } from './studio/export'
import { generateId } from './utils/id'
import './App.css'
import './StudioLayout.css'
import './Shell.css'

function ChyronEditor({
  active,
  onWorkspaceChange,
}: {
  active: boolean
  onWorkspaceChange: (workspace: Workspace) => void
}) {
  const editor = useProject()
  const { project, patch, replace } = editor
  const playback = usePlayback(project)
  const [tab, setTab] = useState<PropertiesTab>('design')
  // The chyron starts selected so its text is one click away.
  const [selection, setSelection] = useState<string | null>('chyron')
  const [dropping, setDropping] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [guides, setGuides] = useState(false)
  const [focusCanvas, setFocusCanvas] = useState(false)
  const [compactViewport, setCompactViewport] = useState(
    () => window.matchMedia('(max-width: 899px)').matches,
  )
  const [detailOverride, setDetailOverride] = useState<boolean | null>(null)
  const [deletedPreset, setDeletedPreset] = useState<SavedPreset | null>(null)
  const [presets, setPresets] = useState(loadPresets)
  const [notice, setNotice] = useState('')
  const [help, setHelp] = useState(false)
  const importInput = useRef<HTMLInputElement>(null)
  const stage = useRef<HTMLDivElement>(null)
  const helpDialog = useRef<HTMLDialogElement>(null)
  const projectMenu = useRef<HTMLDivElement>(null)
  const projectMenuButton = useRef<HTMLButtonElement>(null)
  const viewMenu = useRef<HTMLDetailsElement>(null)
  // A layer removed by undo or a new composition can no longer stay selected.
  const selected = project.layers.some((l) => l.id === selection) ? selection : null
  const selectedImage = project.layers.find(
    (l): l is ImageLayer => l.id === selected && l.kind === 'image',
  )
  const artworkDetail =
    !focusCanvas &&
    selected !== null &&
    (detailOverride ?? (compactViewport && project.previewBackground !== 'live'))
  const changeLayer = (id: string, values: Partial<ImageLayer>) =>
    patch({ layers: updateLayer(project, id, values) })
  const closeProjectMenu = () => {
    setMenuOpen(false)
    projectMenuButton.current?.focus()
  }
  const closeHelp = () => {
    helpDialog.current?.close()
    setHelp(false)
  }
  const closeView = () => {
    if (viewMenu.current) viewMenu.current.open = false
  }
  const addImages = async (files: File[]) => {
    let next: Project = project
    let last: string | null = null
    const errors: string[] = []
    for (const file of files) {
      if (!canAddImage(next)) {
        errors.push('Up to 12 images per composition.')
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
      setSelection(last)
      setTab('animate')
      setFocusCanvas(false)
    }
    const added = imageLayers(next).length - imageLayers(project).length
    if (errors.length) setNotice(errors[0])
    else if (added > 1) setNotice(`${added} images added.`)
  }
  useEffect(() => {
    const media = window.matchMedia('(max-width: 899px)')
    const update = () => setCompactViewport(media.matches)
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])
  useEffect(() => {
    if (menuOpen) projectMenu.current?.querySelector('button')?.focus()
  }, [menuOpen])
  useEffect(() => {
    const dismiss = (event: PointerEvent) => {
      if (viewMenu.current && !viewMenu.current.contains(event.target as Node)) closeView()
    }
    document.addEventListener('pointerdown', dismiss)
    return () => document.removeEventListener('pointerdown', dismiss)
  }, [])
  useEffect(() => {
    if (!notice) return
    const timeout = setTimeout(() => setNotice(''), deletedPreset ? 12000 : 6000)
    return () => clearTimeout(timeout)
  }, [notice, deletedPreset])
  useEffect(() => {
    if (help) helpDialog.current?.showModal()
  }, [help])
  useEffect(() => {
    // Remove images that neither the draft nor any saved style uses any more.
    const keep = referencedAssets([project, ...loadPresets().map((preset) => preset.project)])
    void collectUnusedAssets(keep).catch(() => {})
    // Only on first open: undo history within the session may still refer to images.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const saveProject = async () => {
    let assets: Awaited<ReturnType<typeof embedAssets>> | undefined
    if (imageLayers(project).length) {
      try {
        assets = await embedAssets(project)
      } catch {
        setNotice('Some images could not be included in the project file.')
      }
    }
    saveBlob(
      new Blob([JSON.stringify({ ...project, assets }, null, 2)], { type: 'application/json' }),
      `${fileStem(project.name)}.chyron.json`,
    )
  }
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (!active) return
      const element = event.target as HTMLElement
      const typing =
        ['INPUT', 'TEXTAREA', 'SELECT'].includes(element.tagName) || element.isContentEditable
      if (exportOpen || help) return
      if (event.key === 'Escape' && menuOpen) {
        closeProjectMenu()
        return
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
        event.preventDefault()
        void saveProject()
        return
      }
      if (typing) return
      if ((event.key === 'Delete' || event.key === 'Backspace') && selectedImage) {
        event.preventDefault()
        patch({ layers: removeLayer(project, selectedImage.id) })
        setSelection(null)
        setNotice(`${selectedImage.name} removed. Undo to bring it back.`)
        return
      }
      const layer = project.layers.find((l) => l.id === selected)
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'd' && selectedImage) {
        event.preventDefault()
        const next = duplicateLayer(project, selectedImage.id)
        if (next.id) {
          patch({ layers: next.layers })
          setSelection(next.id)
        }
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
      if (element.closest('button, a, summary, [role=tab]')) return
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
  const savePreset = (name: string) => {
    if (presets.length >= 40) {
      setNotice('Your library is full. Remove a style to add another.')
      return false
    }
    setDeletedPreset(null)
    return storeAll(
      [...presets, { id: generateId(), name, project: { ...project } }],
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
  const applyStyle = (template: Template) => {
    const next = applyTemplate(project, template)
    replace(next)
    playback.seek(restTime(next))
  }
  const saveLabel =
    editor.saveStatus === 'Saved on this device'
      ? 'Saved'
      : editor.saveStatus === 'Saving…'
        ? 'Saving…'
        : 'Not saved'
  return (
    <div className={`studio-shell ${focusCanvas ? 'canvas-focused' : ''}`}>
      <a className="skip-link" href="#props-panel" onClick={() => setFocusCanvas(false)}>
        Skip to properties
      </a>
      <header className="app-header">
        <div className="header-start">
          <h1 className="brand" aria-label="Chyron Studio">
            <span className="brand-symbol" aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
            <strong>
              chyron<span>studio</span>
            </strong>
          </h1>
          <WorkspaceNav
            current="chyron"
            onChange={(workspace) => {
              playback.pause()
              onWorkspaceChange(workspace)
            }}
          />
        </div>
        <div className="project-header">
          <span className="header-divider" />
          <input
            aria-label="Project name"
            className="project-name"
            value={project.name}
            maxLength={80}
            onChange={(e) => patch({ name: e.target.value })}
          />
          <div className="project-menu-wrap">
            <button
              className="icon-button"
              ref={projectMenuButton}
              aria-label="Project menu"
              aria-controls="project-actions"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen(!menuOpen)}
            >
              <ChevronDown size={16} />
            </button>
            {menuOpen && (
              <>
                <button
                  className="menu-dismiss"
                  aria-label="Close project menu"
                  onClick={closeProjectMenu}
                />
                <div
                  className="project-menu"
                  id="project-actions"
                  ref={projectMenu}
                  role="group"
                  aria-label="Project actions"
                  onKeyDown={(e) => {
                    const buttons = Array.from(e.currentTarget.querySelectorAll('button'))
                    const index = buttons.indexOf(document.activeElement as HTMLButtonElement)
                    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                      e.preventDefault()
                      e.stopPropagation()
                      buttons[
                        (index + (e.key === 'ArrowDown' ? 1 : buttons.length - 1)) % buttons.length
                      ]?.focus()
                    }
                  }}
                >
                  <button
                    onClick={() => {
                      void saveProject()
                      closeProjectMenu()
                    }}
                  >
                    <ArrowDownToLine size={16} /> Save project file <kbd>⌘ S</kbd>
                  </button>
                  <button
                    onClick={() => {
                      importInput.current?.click()
                      closeProjectMenu()
                    }}
                  >
                    <ArrowUpFromLine size={16} /> Open project file
                  </button>
                  <button
                    onClick={() => {
                      replace({ ...DEFAULT_PROJECT })
                      playback.seek(restTime(DEFAULT_PROJECT))
                      setSelection('chyron')
                      closeProjectMenu()
                      setNotice('New composition. Undo to return to your previous work.')
                    }}
                  >
                    <Plus size={16} /> New composition
                  </button>
                  <hr />
                  <button
                    onClick={() => {
                      closeProjectMenu()
                      setHelp(true)
                    }}
                  >
                    <HelpCircle size={16} /> Guide & shortcuts <kbd>?</kbd>
                  </button>
                </div>
              </>
            )}
          </div>
          <span className="save-state" role="status" title={editor.saveStatus}>
            {saveLabel === 'Saved' && <Check size={14} aria-hidden="true" />}
            <span className="sr-only">{editor.saveStatus}</span>
            <span aria-hidden="true">{saveLabel}</span>
          </span>
        </div>
        <div className="header-actions">
          <div className="history-actions">
            <button
              className="icon-button"
              aria-label="Undo"
              title="Undo (⌘/Ctrl Z)"
              disabled={!editor.canUndo}
              onClick={editor.undo}
            >
              <Undo2 size={18} />
            </button>
            <button
              className="icon-button"
              aria-label="Redo"
              title="Redo (⌘/Ctrl Shift Z)"
              disabled={!editor.canRedo}
              onClick={editor.redo}
            >
              <Redo2 size={18} />
            </button>
            <ThemeToggle />
          </div>
          <button
            className="button primary export-trigger"
            aria-label="Export"
            onClick={() => {
              playback.pause()
              setExportOpen(true)
            }}
          >
            <Download size={18} /> <span>Export</span>
          </button>
        </div>
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
              if (file.size > 200 * 1024 * 1024)
                throw new Error('Choose a project file smaller than 200 MB.')
              const json = await file.text()
              const imported = parseProject(json)
              const raw = JSON.parse(json) as { assets?: unknown }
              await restoreEmbeddedAssets(raw.assets)
              replace(imported)
              setSelection('chyron')
              playback.seek(restTime(imported))
              setNotice('Project opened.')
            } catch (error) {
              setNotice(error instanceof Error ? error.message : 'Unable to open this file.')
            }
            input.value = ''
          }}
        />
      </header>
      <div className="workspace">
        <main className="main-workspace" aria-label="Canvas and timeline">
          <h2 className="sr-only">Canvas</h2>
          <div className="canvas-toolbar">
            <button
              className="canvas-size"
              aria-label={`Canvas settings: ${project.width} by ${project.height}`}
              aria-pressed={selected === null}
              title="Canvas, timing and frame rate"
              onClick={() => {
                setFocusCanvas(false)
                setSelection(null)
              }}
            >
              {project.width} × {project.height}
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
                {artworkDetail ? <ZoomOut size={18} /> : <ZoomIn size={18} />}
              </button>
              <details
                className="view-menu"
                ref={viewMenu}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    closeView()
                    e.currentTarget.querySelector('summary')?.focus()
                    e.stopPropagation()
                  }
                }}
              >
                <summary aria-label="Preview options" title="Preview options">
                  <MoreHorizontal size={20} />
                </summary>
                <div className="view-menu-content">
                  <span className="menu-label">Preview background</span>
                  {(['live', 'checker', 'dark', 'light'] as const).map((bg) => (
                    <button
                      key={bg}
                      aria-pressed={project.previewBackground === bg}
                      onClick={() => {
                        patch({ previewBackground: bg })
                        closeView()
                      }}
                    >
                      <span className={`menu-swatch ${bg}`} />
                      {bg === 'live'
                        ? 'Live photo'
                        : bg === 'checker'
                          ? 'Transparency'
                          : bg === 'dark'
                            ? 'Dark'
                            : 'Light'}
                    </button>
                  ))}
                  <hr />
                  <button aria-pressed={guides} onClick={() => setGuides(!guides)}>
                    <ScanLine size={18} /> Safe area
                  </button>
                  <button
                    onClick={() => {
                      closeView()
                      if (document.fullscreenElement) void document.exitFullscreen()
                      else if (stage.current?.requestFullscreen)
                        void stage.current
                          .requestFullscreen()
                          .catch(() => setNotice('Fullscreen is unavailable in this browser.'))
                      else setNotice('Fullscreen is unavailable in this browser.')
                    }}
                  >
                    <Expand size={18} /> Fullscreen
                  </button>
                </div>
              </details>
              <button
                className={`icon-button ${focusCanvas ? 'selected' : ''}`}
                aria-label={focusCanvas ? 'Show properties' : 'Focus canvas'}
                aria-pressed={focusCanvas}
                title={focusCanvas ? 'Show properties' : 'Hide properties'}
                onClick={() => setFocusCanvas(!focusCanvas)}
              >
                {focusCanvas ? <PanelRightOpen size={18} /> : <PanelRightClose size={18} />}
              </button>
            </div>
          </div>
          <div
            className={`stage-surround ${artworkDetail ? 'artwork-detail' : ''} ${dropping ? 'is-dropping' : ''}`}
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
              const files = Array.from(e.dataTransfer.files).filter((f) =>
                f.type.startsWith('image/'),
              )
              if (files.length) void addImages(files)
              else setNotice('Drop a PNG, JPEG, WebP or GIF image.')
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
                onTransform={patch}
                onLayerChange={changeLayer}
                selected={selected}
                onSelect={setSelection}
              />
              {guides && <div className="safe-guides" />}
              {!hasArtwork(project) && (
                <div className="empty-canvas">
                  <strong>Nothing to show yet</strong>
                  <span>Add a title or an image.</span>
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
            onAddImages={(files) => void addImages(files)}
            onTiming={(id, { delay, length }) => {
              const layer = project.layers.find((l) => l.id === id)
              if (!layer) return
              const half = duration(project) / 2
              if (layer.kind === 'image') {
                const values: Partial<ImageLayer> = {}
                if (delay !== undefined) values.delay = Math.min(delay, Math.max(0, half - 0.2))
                if (length !== undefined) values.duration = Math.min(4, length)
                changeLayer(id, values)
              } else if (delay !== undefined) {
                patch({
                  layers: updateLayer(project, id, {
                    delay: Math.min(delay, Math.max(0, half - project.animationDuration)),
                  }),
                })
              } else if (length !== undefined) {
                // The chyron's transition sets the clip's transition length.
                patch({ animationDuration: Math.min(4, length) })
              }
            }}
            onReorder={(id, index) => {
              const layers = project.layers.filter((l) => l.id !== id)
              const layer = project.layers.find((l) => l.id === id)
              if (!layer) return
              layers.splice(Math.min(layers.length, Math.max(0, index)), 0, layer)
              patch({ layers })
            }}
          />
        </main>
        <div className="inspector-wrap" hidden={focusCanvas}>
          <Properties
            project={project}
            patch={patch}
            selected={selected}
            onSelect={setSelection}
            tab={tab}
            onTab={setTab}
            previewPhase={playback.previewPhase}
            presets={presets}
            onApplyTemplate={applyStyle}
            onApplyPreset={(preset) =>
              applyStyle({
                id: preset.id,
                name: preset.name,
                caption: '',
                background: '',
                patch: preset.project,
              })
            }
            onSavePreset={savePreset}
            onRemovePreset={removePreset}
          />
        </div>
      </div>
      {exportOpen && (
        <ExportDialog project={project} time={playback.time} onClose={() => setExportOpen(false)} />
      )}
      {notice && (
        <div className="toast" role="status">
          <span>{notice}</span>
          {deletedPreset && (
            <button className="text-button" onClick={restorePreset}>
              Undo
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
          className="help-dialog"
          ref={helpDialog}
          onCancel={(event) => {
            event.preventDefault()
            closeHelp()
          }}
          aria-labelledby="help-title"
        >
          <div className="dialog-heading">
            <h2 id="help-title">How it works</h2>
            <button className="icon-button" aria-label="Close tour" onClick={closeHelp}>
              <X size={18} />
            </button>
          </div>
          <ol>
            <li>
              <strong>Select, then edit.</strong> Click anything on the canvas or in the timeline;
              its settings open on the right.
            </li>
            <li>
              <strong>Shape time in the timeline.</strong> Drag a bar to delay it, drag its edge to
              lengthen the transition, drag a name to reorder.
            </li>
            <li>
              <strong>Pick a style to see it.</strong> Every animation plays as soon as you choose
              it.
            </li>
          </ol>
          <h3 className="shortcut-title">Shortcuts</h3>
          <dl className="shortcuts">
            {[
              ['Space', 'Play / pause'],
              ['← →', 'Step one frame'],
              ['Esc', 'Composition settings'],
              ['⌘/Ctrl D', 'Duplicate image'],
              ['[ ]', 'Send backward / bring forward'],
              ['H', 'Hide / show layer'],
              ['Del', 'Delete image'],
              ['⌘/Ctrl Z', 'Undo (⇧ to redo)'],
              ['⌘/Ctrl S', 'Save project file'],
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
          <button className="button primary full" onClick={closeHelp}>
            Got it
          </button>
        </dialog>
      )}
    </div>
  )
}
function App() {
  const [workspace, setWorkspace] = useState<Workspace>(() => {
    try {
      return localStorage.getItem('chyron-studio:workspace') === 'stream' ? 'stream' : 'chyron'
    } catch {
      return 'chyron'
    }
  })
  const [streamVisited, setStreamVisited] = useState(workspace === 'stream')
  const changeWorkspace = (next: Workspace) => {
    if (next === workspace) return
    if (next === 'stream') setStreamVisited(true)
    setWorkspace(next)
    requestAnimationFrame(() => {
      document
        .querySelector<HTMLButtonElement>(
          `[data-workspace="${next}"] .workspace-nav button[aria-pressed="true"]`,
        )
        ?.focus()
    })
    try {
      localStorage.setItem('chyron-studio:workspace', next)
    } catch {
      /* Current session still works. */
    }
  }
  return (
    <>
      <div data-workspace="chyron" hidden={workspace !== 'chyron'}>
        <ChyronEditor active={workspace === 'chyron'} onWorkspaceChange={changeWorkspace} />
      </div>
      {streamVisited && (
        <div data-workspace="stream" hidden={workspace !== 'stream'}>
          <StreamWorkspace active={workspace === 'stream'} onWorkspaceChange={changeWorkspace} />
        </div>
      )}
    </>
  )
}
export default App
