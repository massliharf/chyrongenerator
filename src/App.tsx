import { useEffect, useRef, useState } from 'react'
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  ChevronDown,
  Download,
  Expand,
  FolderOpen,
  Grid2X2,
  HelpCircle,
  Layers3,
  Plus,
  PanelRightClose,
  PanelRightOpen,
  MoreHorizontal,
  Search,
  ZoomIn,
  ZoomOut,
  Redo2,
  Save,
  ScanLine,
  Trash2,
  Undo2,
  X,
} from 'lucide-react'
import { Composition } from './components/Composition'
import { Inspector } from './components/Inspector'
import { Timeline } from './components/Timeline'
import { ExportDialog } from './components/ExportDialog'
import { WorkspaceNav, type Workspace } from './components/WorkspaceNav'
import StreamWorkspace from './stream/StreamWorkspace'
import {
  applyTemplate,
  DEFAULT_PROJECT,
  fileStem,
  parseProject,
  restTime,
  TEMPLATES,
} from './studio/model'
import { loadPresets, storePresets, useProject, type SavedPreset } from './studio/useProject'
import { usePlayback } from './studio/usePlayback'
import { saveBlob } from './studio/export'
import { generateId } from './utils/id'
import './App.css'
import './StudioLayout.css'

const templateSamples = TEMPLATES.map((template) =>
  applyTemplate(
    {
      ...DEFAULT_PROJECT,
      width: 1920,
      height: 1080,
      text: 'Your\nMoment',
      subtitle: 'MAKE IT COUNT',
    },
    template,
  ),
)

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
  const [tab, setTab] = useState<'design' | 'motion' | 'canvas'>('design')
  const [exportOpen, setExportOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [templatesOpen, setTemplatesOpen] = useState(false)
  const [guides, setGuides] = useState(false)
  const [focusCanvas, setFocusCanvas] = useState(false)
  const [compactViewport, setCompactViewport] = useState(
    () => window.matchMedia('(max-width: 899px)').matches,
  )
  const [detailOverride, setDetailOverride] = useState<boolean | null>(null)
  const artworkDetail =
    !focusCanvas &&
    tab !== 'canvas' &&
    (detailOverride ?? (compactViewport && project.previewBackground !== 'live'))
  const [templateQuery, setTemplateQuery] = useState('')
  const [libraryOpen, setLibraryOpen] = useState(false)
  const [deletedPreset, setDeletedPreset] = useState<SavedPreset | null>(null)
  const [presets, setPresets] = useState(loadPresets)
  const [presetName, setPresetName] = useState('')
  const [savingPreset, setSavingPreset] = useState(false)
  const [notice, setNotice] = useState('')
  const [help, setHelp] = useState(false)
  const importInput = useRef<HTMLInputElement>(null)
  const stage = useRef<HTMLDivElement>(null)
  const helpDialog = useRef<HTMLDialogElement>(null)
  const templateDialog = useRef<HTMLDialogElement>(null)
  const projectMenu = useRef<HTMLDivElement>(null)
  const projectMenuButton = useRef<HTMLButtonElement>(null)
  const viewMenu = useRef<HTMLDetailsElement>(null)
  const closeTemplates = () => {
    templateDialog.current?.close()
    setTemplatesOpen(false)
  }
  const closeProjectMenu = () => {
    setMenuOpen(false)
    projectMenuButton.current?.focus()
  }
  const closeHelp = () => {
    helpDialog.current?.close()
    setHelp(false)
  }
  useEffect(() => {
    const media = window.matchMedia('(max-width: 899px)')
    const update = () => setCompactViewport(media.matches)
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])
  useEffect(() => {
    if (templatesOpen) templateDialog.current?.showModal()
  }, [templatesOpen])
  useEffect(() => {
    if (menuOpen) projectMenu.current?.querySelector('button')?.focus()
  }, [menuOpen])
  useEffect(() => {
    const dismiss = (event: PointerEvent) => {
      if (viewMenu.current && !viewMenu.current.contains(event.target as Node))
        viewMenu.current.open = false
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
  const saveProject = () =>
    saveBlob(
      new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' }),
      `${fileStem(project.name)}.chyron.json`,
    )
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (!active) return
      const element = event.target as HTMLElement
      const typing =
        ['INPUT', 'TEXTAREA', 'SELECT'].includes(element.tagName) || element.isContentEditable
      if (exportOpen || help || templatesOpen) return
      if (event.key === 'Escape' && menuOpen) {
        closeProjectMenu()
        return
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
        event.preventDefault()
        saveProject()
        return
      }
      if (typing) return
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault()
        if (event.shiftKey) editor.redo()
        else editor.undo()
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
      if (event.key === 'Escape') {
        closeTemplates()
        closeProjectMenu()
      }
    }
    window.addEventListener('keydown', keydown)
    return () => window.removeEventListener('keydown', keydown)
  })
  const savePreset = () => {
    if (!presetName.trim()) return
    if (presets.length >= 40) {
      setNotice('Your library is full. Remove a preset to add another.')
      return
    }
    const next = [
      ...presets,
      { id: generateId(), name: presetName.trim(), project: { ...project } },
    ]
    try {
      storePresets(next)
      setPresets(next)
      setSavingPreset(false)
      setLibraryOpen(true)
      setPresetName('')
      setNotice('Preset added to your library.')
    } catch {
      setNotice('Device storage is unavailable. Save a project file instead.')
    }
  }
  const removePreset = (id: string) => {
    const next = presets.filter((p) => p.id !== id)
    try {
      storePresets(next)
      setPresets(next)
      setDeletedPreset(presets.find((p) => p.id === id) || null)
      setNotice('Preset removed.')
    } catch {
      setNotice('Unable to update your saved presets.')
    }
  }
  const restorePreset = () => {
    if (!deletedPreset) return
    if (presets.length >= 40) {
      setNotice('Remove a preset to make room before restoring.')
      return
    }
    const next = [...presets, deletedPreset]
    try {
      storePresets(next)
      setPresets(next)
      setDeletedPreset(null)
      setNotice('Preset restored.')
    } catch {
      setNotice('Unable to restore this preset. Device storage is unavailable.')
    }
  }
  return (
    <div className={`studio-shell ${focusCanvas ? 'canvas-focused' : ''}`}>
      <a className="skip-link" href="#settings-panel" onClick={() => setFocusCanvas(false)}>
        Skip to settings
      </a>
      <header className="app-header">
        <h1 className="brand" aria-label="Chyron Studio">
          <span className="brand-symbol">
            <i />
            <i />
            <i />
          </span>
          <strong>
            chyron<span>studio</span>
          </strong>
          <span className="version-pill">2.4</span>
        </h1>
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
              <ChevronDown size={14} />
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
                      saveProject()
                      closeProjectMenu()
                    }}
                  >
                    <ArrowDownToLine size={15} /> Save project file <kbd>⌘ S</kbd>
                  </button>
                  <button
                    onClick={() => {
                      importInput.current?.click()
                      closeProjectMenu()
                    }}
                  >
                    <ArrowUpFromLine size={15} /> Open project file
                  </button>
                  <button
                    onClick={() => {
                      setSavingPreset(true)
                      setLibraryOpen(true)
                      setTemplatesOpen(true)
                      closeProjectMenu()
                    }}
                  >
                    <Save size={15} /> Save as preset
                  </button>
                  <hr />
                  <button
                    onClick={() => {
                      replace({ ...DEFAULT_PROJECT })
                      playback.seek(restTime(DEFAULT_PROJECT))
                      closeProjectMenu()
                      setNotice('New composition. Undo to return to your previous work.')
                    }}
                  >
                    <Plus size={15} /> New composition
                  </button>
                </div>
              </>
            )}
          </div>
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
              <Undo2 size={17} />
            </button>
            <button
              className="icon-button"
              aria-label="Redo"
              title="Redo (⌘/Ctrl Shift Z)"
              disabled={!editor.canRedo}
              onClick={editor.redo}
            >
              <Redo2 size={17} />
            </button>
          </div>
          <button
            className="button primary export-trigger"
            aria-label="Export"
            onClick={() => {
              playback.pause()
              setExportOpen(true)
            }}
          >
            <Download size={20} /> <span>Export</span>
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
              if (file.size > 1024 * 1024)
                throw new Error('Choose a project file smaller than 1 MB.')
              const imported = parseProject(await file.text())
              replace(imported)
              playback.seek(restTime(imported))
              setNotice('Project opened.')
            } catch (error) {
              setNotice(error instanceof Error ? error.message : 'Unable to open this file.')
            }
            input.value = ''
          }}
        />
      </header>
      <WorkspaceNav
        current="chyron"
        onChange={(workspace) => {
          playback.pause()
          onWorkspaceChange(workspace)
        }}
      />
      <div className="workspace">
        {templatesOpen && (
          <dialog
            className="template-dialog"
            ref={templateDialog}
            aria-labelledby="templates-title"
            onCancel={(e) => {
              e.preventDefault()
              closeTemplates()
            }}
            onClick={(e) => {
              if (e.target === e.currentTarget) closeTemplates()
            }}
          >
            <div className="sidebar-title">
              <h2 id="templates-title">
                <Grid2X2 size={22} /> Your starting point
              </h2>
              <button
                className="icon-button close-templates"
                aria-label="Close template panel"
                onClick={closeTemplates}
              >
                <X size={16} />
              </button>
            </div>
            <p className="sidebar-intro">Styles keep your words, canvas and timing.</p>
            <div className="template-search settings-search">
              <Search size={20} />
              <input
                type="search"
                aria-label="Search templates"
                placeholder="Search templates…"
                value={templateQuery}
                onChange={(e) => setTemplateQuery(e.target.value)}
              />
            </div>
            <div className="template-list">
              {TEMPLATES.map((template, index) => {
                if (
                  !`${template.name} ${template.caption}`
                    .toLowerCase()
                    .includes(templateQuery.toLowerCase())
                )
                  return null
                const sample = templateSamples[index]
                return (
                  <button
                    className="template-card"
                    key={template.id}
                    onClick={() => {
                      const next = applyTemplate(project, template)
                      replace(next)
                      playback.seek(restTime(next))
                      closeTemplates()
                    }}
                  >
                    <div className="template-art" style={{ background: template.background }}>
                      <Composition project={sample} time={restTime(sample)} thumbnail />
                      <span className="template-use">
                        <Plus size={13} />
                      </span>
                    </div>
                    <span className="template-card-info">
                      <strong>{template.name}</strong>
                      <span>{template.caption}</span>
                    </span>
                  </button>
                )
              })}
            </div>
            {!TEMPLATES.some((t) =>
              `${t.name} ${t.caption}`.toLowerCase().includes(templateQuery.toLowerCase()),
            ) && <p className="field-hint">No matching templates. Try a different name.</p>}
            <details
              className="preset-library"
              open={libraryOpen}
              onToggle={(e) => setLibraryOpen(e.currentTarget.open)}
            >
              <summary>
                <FolderOpen size={20} /> Saved presets <span>{presets.length}</span>
                <ChevronDown size={20} />
              </summary>
              <div className="library-header">
                <span>
                  <FolderOpen size={18} /> Your compositions
                </span>
                <button
                  className="icon-button"
                  aria-label="Save preset"
                  title="Save current composition as a preset"
                  onClick={() => setSavingPreset(!savingPreset)}
                >
                  <Plus size={15} />
                </button>
              </div>
              {savingPreset && (
                <form
                  className="preset-form"
                  onSubmit={(e) => {
                    e.preventDefault()
                    savePreset()
                  }}
                >
                  <input
                    aria-label="Preset name"
                    placeholder="Name your preset"
                    maxLength={80}
                    value={presetName}
                    onChange={(e) => setPresetName(e.target.value)}
                    autoFocus
                  />
                  <button className="button primary" type="submit" disabled={!presetName.trim()}>
                    Save
                  </button>
                </form>
              )}
              {presets.length ? (
                <div className="saved-presets">
                  {presets.map((preset) => (
                    <div key={preset.id}>
                      <button
                        onClick={() => {
                          replace(preset.project)
                          playback.seek(restTime(preset.project))
                          closeTemplates()
                        }}
                      >
                        <Layers3 size={14} />
                        <span>{preset.name}</span>
                      </button>
                      <button
                        className="icon-button"
                        aria-label={`Delete preset ${preset.name}`}
                        onClick={() => removePreset(preset.id)}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="library-empty">
                  Your signature styles, saved here.
                  <br />
                  <button onClick={() => setSavingPreset(true)}>
                    Create your first preset <Plus size={11} />
                  </button>
                </p>
              )}
            </details>
            <button
              className="help-link"
              onClick={() => {
                closeTemplates()
                setHelp(true)
              }}
            >
              <HelpCircle size={15} /> A quick tour <span>↗</span>
            </button>
          </dialog>
        )}
        <main className="main-workspace" aria-label="Canvas and playback">
          <h2 className="sr-only">Canvas preview</h2>
          <div className="canvas-toolbar">
            <div>
              <button
                className="button templates-trigger"
                aria-label="Templates"
                aria-haspopup="dialog"
                onClick={() => setTemplatesOpen(true)}
              >
                <Grid2X2 size={20} /> <span>Templates</span>
              </button>
              <button
                className="canvas-size"
                aria-label={`Canvas settings: ${project.width} by ${project.height}`}
                onClick={() => {
                  setFocusCanvas(false)
                  setTab('canvas')
                }}
              >
                {project.width} <span>×</span> {project.height}
                <ChevronDown size={16} />
              </button>
            </div>
            <div className="canvas-tools">
              <button
                className={`icon-button ${artworkDetail ? 'selected' : ''}`}
                aria-label={artworkDetail ? 'Fit canvas preview' : 'Show artwork detail'}
                aria-pressed={artworkDetail}
                title={artworkDetail ? 'Fit canvas' : 'Artwork detail'}
                disabled={tab === 'canvas' || focusCanvas}
                onClick={() => setDetailOverride(!artworkDetail)}
              >
                {artworkDetail ? <ZoomOut size={20} /> : <ZoomIn size={20} />}
              </button>
              <details
                className="view-menu"
                ref={viewMenu}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    e.currentTarget.open = false
                    e.currentTarget.querySelector('summary')?.focus()
                    e.stopPropagation()
                  }
                }}
              >
                <summary aria-label="Preview options" title="Preview options">
                  <MoreHorizontal size={22} />
                </summary>
                <div className="view-menu-content">
                  <button
                    className="mobile-focus-action"
                    onClick={() => {
                      setFocusCanvas(!focusCanvas)
                      if (viewMenu.current) viewMenu.current.open = false
                    }}
                  >
                    <PanelRightClose size={20} />
                    {focusCanvas ? 'Show settings' : 'Focus canvas'}
                  </button>
                  <button aria-pressed={guides} onClick={() => setGuides(!guides)}>
                    <ScanLine size={20} /> {guides ? 'Hide' : 'Show'} safe area
                  </button>
                  <button
                    onClick={() => {
                      if (viewMenu.current) viewMenu.current.open = false
                      if (document.fullscreenElement) void document.exitFullscreen()
                      else if (stage.current?.requestFullscreen)
                        void stage.current
                          .requestFullscreen()
                          .catch(() => setNotice('Fullscreen is unavailable in this browser.'))
                      else setNotice('Fullscreen is unavailable in this browser.')
                    }}
                  >
                    <Expand size={20} /> Fullscreen preview
                  </button>
                  {(['live', 'checker', 'dark', 'light'] as const).map((bg) => (
                    <button
                      key={bg}
                      aria-pressed={project.previewBackground === bg}
                      onClick={() => {
                        patch({ previewBackground: bg })
                        if (viewMenu.current) viewMenu.current.open = false
                      }}
                    >
                      <span className={`menu-swatch ${bg}`} />{' '}
                      {bg === 'live'
                        ? 'Live preview'
                        : bg === 'checker'
                          ? 'Transparency checker'
                          : `${bg === 'dark' ? 'Dark' : 'Light'} preview`}
                    </button>
                  ))}
                </div>
              </details>
              <button
                className={`icon-button focus-canvas-toggle ${focusCanvas ? 'selected' : ''}`}
                aria-label={focusCanvas ? 'Show settings' : 'Focus canvas'}
                aria-pressed={focusCanvas}
                title={focusCanvas ? 'Show settings' : 'Focus canvas'}
                onClick={() => setFocusCanvas(!focusCanvas)}
              >
                {focusCanvas ? <PanelRightOpen size={20} /> : <PanelRightClose size={20} />}
              </button>
            </div>
          </div>
          <div className={`stage-surround ${artworkDetail ? 'artwork-detail' : ''}`} ref={stage}>
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
            >
              <Composition project={project} time={playback.time} />
              {guides && (
                <div className="safe-guides">
                  <span>SAFE AREA · 90%</span>
                </div>
              )}
              {!project.text.trim() && (!project.subtitlePill || !project.subtitle.trim()) && (
                <div className="empty-canvas">
                  <span className="empty-type">Aa</span>
                  <strong>Your next big moment starts here.</strong>
                  <span>Add your words in the Design panel.</span>
                </div>
              )}
            </div>
            {artworkDetail && <span className="preview-detail-label">Cropped preview</span>}
            <div className="stage-meta">
              <span>
                <span className="status-dot" /> LIVE PREVIEW
              </span>
              <span>
                {project.fps} FPS <span className="meta-separator">/</span>{' '}
                {project.mode === 'tiles' ? 'TILE COMPOSITION' : 'TYPOGRAPHY'}
              </span>
            </div>
          </div>
          <div className="canvas-bottom">
            <div className="preview-swatches">
              {(['live', 'checker', 'dark', 'light'] as const).map((bg) => (
                <button
                  key={bg}
                  aria-label={`Set ${bg} preview`}
                  title={`${bg[0].toUpperCase() + bg.slice(1)} background`}
                  className={`background-chip ${bg} ${project.previewBackground === bg ? 'selected' : ''}`}
                  aria-pressed={project.previewBackground === bg}
                  onClick={() => patch({ previewBackground: bg })}
                />
              ))}
              <span>Preview background</span>
            </div>
            <button className="fit-button" onClick={() => patch({ scale: 100, x: 50, y: 50 })}>
              Fit <Expand size={12} />
            </button>
          </div>
          <Timeline project={project} playback={playback} />
        </main>
        <div className="inspector-wrap" hidden={focusCanvas}>
          <Inspector
            project={project}
            patch={patch}
            tab={tab}
            setTab={setTab}
            replay={() => playback.play(true)}
            previewPhase={playback.previewPhase}
            saveStatus={editor.saveStatus}
            onHelp={() => setHelp(true)}
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
              Undo removal
            </button>
          )}
          <button
            className="icon-button"
            aria-label="Dismiss notification"
            onClick={() => setNotice('')}
          >
            <X size={14} />
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
            <h2 id="help-title">From words to wow.</h2>
            <button className="icon-button" aria-label="Close tour" onClick={closeHelp}>
              <X size={18} />
            </button>
          </div>
          <ol>
            <li>
              <strong>Find your starting point.</strong> Pick a template, then make it yours with
              your words, fonts, colors and shapes.
            </li>
            <li>
              <strong>Give it a little motion.</strong> Choose an animation and set one duration for
              its intro and reversed outro. Preview either transition, scrub the timeline or press
              Space to play the full clip.
            </li>
            <li>
              <strong>Take it anywhere.</strong> Every format preserves alpha. Use WebM for OBS,
              ProRes for editing, or PNG sequences for lossless frames.
            </li>
          </ol>
          <p>
            Changes are saved on this device. Use the project menu to save a portable project file
            or add a preset to your library.
          </p>
          <button className="button primary full" onClick={() => setHelp(false)}>
            Let's make something.
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
