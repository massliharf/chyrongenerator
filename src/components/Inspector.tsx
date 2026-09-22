import { useState, useRef } from 'react'
import type { ReactNode } from 'react'
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowDown,
  ArrowUp,
  ArrowUpRight,
  Circle,
  Clapperboard,
  FlipHorizontal2,
  Layers3,
  MoveUp,
  ScanLine,
  SlidersHorizontal,
  Sparkles,
  Type,
  Search,
  X,
  ChevronsDownUp,
  ChevronsUpDown,
  Check,
  HelpCircle,
  ArrowLeftRight,
} from 'lucide-react'
import { Color, Field, NumberInput, Range, Section, Toggle } from './Controls'
import { DEFAULT_PROJECT, FONT_NAMES, type Effect, type Project } from '../studio/model'

type Tab = 'design' | 'motion' | 'canvas'
const tabs = [
  { id: 'design', label: 'Design', Icon: SlidersHorizontal },
  { id: 'motion', label: 'Motion', Icon: Sparkles },
  { id: 'canvas', label: 'Canvas', Icon: ScanLine },
] as const
const groups: {
  id: string
  tab: Tab
  title: string
  keywords: string
  reset: (keyof Project)[]
}[] = [
  {
    id: 'words',
    tab: 'design',
    title: 'Your words',
    keywords: 'title subtitle content text',
    reset: [],
  },
  {
    id: 'type',
    tab: 'design',
    title: 'Typography',
    keywords: 'font typeface tile size letter case tracking spacing italic effect fill',
    reset: [
      'mode',
      'font',
      'tileSize',
      'textCase',
      'tracking',
      'italic',
      'effect',
      'filled',
      'align',
    ],
  },
  {
    id: 'colors',
    tab: 'design',
    title: 'Colors & palettes',
    keywords: 'color hex tiles lettering subtitle fill text effect palette',
    reset: ['tileColor', 'textColor', 'accent', 'subtitleColor', 'effectColor', 'effectColor2'],
  },
  {
    id: 'shape',
    tab: 'design',
    title: 'Shape & spacing',
    keywords: 'corner radius letter padding tile gap line spacing depth',
    reset: ['radius', 'padding', 'gap', 'lineGap', 'depth'],
  },
  {
    id: 'subtitle',
    tab: 'design',
    title: 'Subtitle style',
    keywords: 'subtitle position above below pill banner size gap radius padding',
    reset: [
      'subtitlePosition',
      'subtitlePill',
      'subtitleSize',
      'subtitleGap',
      'subtitleRadius',
      'subtitlePaddingX',
      'subtitlePaddingY',
    ],
  },
  {
    id: 'finish',
    tab: 'design',
    title: 'Character & finishing',
    keywords: 'rotation variation scatter shadow glow backdrop',
    reset: ['rotation', 'variation', 'scatter', 'shadowVariation', 'glow', 'backdrop'],
  },
  {
    id: 'animation',
    tab: 'motion',
    title: 'Intro & outro',
    keywords: 'animation flip pop rise reveal typewriter fade still preview',
    reset: ['motion'],
  },
  {
    id: 'timing',
    tab: 'motion',
    title: 'Timing',
    keywords: 'animation duration seconds hold stagger length',
    reset: ['animationDuration', 'hold', 'stagger'],
  },
  {
    id: 'playback',
    tab: 'motion',
    title: 'Frame rate',
    keywords: 'fps frame rate playback 24 30 60',
    reset: ['fps'],
  },
  {
    id: 'size',
    tab: 'canvas',
    title: 'Canvas size',
    keywords: 'width height dimensions resolution aspect ratio lock swap 720p portrait',
    reset: ['width', 'height'],
  },
  {
    id: 'transform',
    tab: 'canvas',
    title: 'Composition',
    keywords: 'scale rotation opacity horizontal vertical position center lower third',
    reset: ['scale', 'compositionRotation', 'opacity', 'x', 'y'],
  },
  {
    id: 'preview',
    tab: 'canvas',
    title: 'Preview background',
    keywords: 'background checker dark light custom color transparency',
    reset: ['previewBackground', 'background'],
  },
]
const initialOpen: Record<string, boolean> = {
  words: true,
  animation: true,
  timing: true,
  size: true,
}
const preferenceKey = 'chyron-studio:sections:v1'
function loadSections(): Record<string, boolean> {
  try {
    const raw = JSON.parse(localStorage.getItem(preferenceKey) || 'null')
    if (raw && typeof raw === 'object' && !Array.isArray(raw))
      return Object.fromEntries(
        groups.map((g) => [g.id, typeof raw[g.id] === 'boolean' ? raw[g.id] : !!initialOpen[g.id]]),
      )
  } catch {
    /* Preferences are optional. */
  }
  return initialOpen
}
const canvasPresets = [
  ['720x1280', 'App · 720 × 1280 (720p)'],
  ['1280x720', 'Landscape · 1280 × 720'],
  ['1920x1080', 'Full HD · 1920 × 1080'],
  ['1080x1920', 'Vertical · 1080 × 1920'],
  ['1080x1080', 'Square · 1080 × 1080'],
  ['1080x1350', 'Portrait · 1080 × 1350'],
  ['3840x2160', '4K · 3840 × 2160'],
  ['1920x480', 'Lower third · 1920 × 480'],
]
const motions = [
  { id: 'pop', name: 'Pop', Icon: Sparkles },
  { id: 'flip', name: 'Flip', Icon: FlipHorizontal2 },
  { id: 'slide', name: 'Rise', Icon: MoveUp },
  { id: 'wipe', name: 'Reveal', Icon: ScanLine },
  { id: 'typewriter', name: 'Typewriter', Icon: Type },
  { id: 'fade', name: 'Soft fade', Icon: Circle },
  { id: 'none', name: 'Still', Icon: Clapperboard },
] as const

export function Inspector({
  project: p,
  patch,
  tab,
  setTab,
  replay,
  previewPhase,
  saveStatus,
  onHelp,
}: {
  project: Project
  patch: (patch: Partial<Project>) => void
  tab: Tab
  setTab: (tab: Tab) => void
  replay: () => void
  previewPhase: (phase: 'intro' | 'outro') => void
  saveStatus: string
  onHelp: () => void
}) {
  const [openSections, setOpenSections] = useState(loadSections)
  const [query, setQuery] = useState('')
  const [locked, setLocked] = useState(false)
  const ratio = useRef(p.width / p.height)
  const search = query.trim().toLowerCase()
  const matches = (id: string) => {
    const g = groups.find((g) => g.id === id)!
    return search
      ? search.split(/\s+/).every((word) => `${g.title} ${g.keywords}`.toLowerCase().includes(word))
      : g.tab === tab
  }
  const visibleGroups = groups.filter((g) => matches(g.id))
  const anyOpen = !!search || visibleGroups.some((g) => openSections[g.id])
  const saveSections = (next: Record<string, boolean>) => {
    setOpenSections(next)
    try {
      localStorage.setItem(preferenceKey, JSON.stringify(next))
    } catch {
      /* Editor still works without storage. */
    }
  }
  const section = (id: string, summary: string, children: ReactNode, extra?: ReactNode) => {
    if (!matches(id)) return null
    const g = groups.find((g) => g.id === id)!
    return (
      <Section
        key={id}
        title={g.title}
        summary={summary}
        open={!!search || !!openSections[id]}
        onToggle={() => {
          setQuery('')
          saveSections({ ...openSections, [id]: search ? false : !openSections[id] })
        }}
        onReset={
          g.reset.length
            ? () => patch(Object.fromEntries(g.reset.map((key) => [key, DEFAULT_PROJECT[key]])))
            : undefined
        }
        extra={extra}
      >
        {children}
      </Section>
    )
  }
  const r = (label: string, key: keyof Project, min: number, max: number, step = 1, unit = '') => (
    <Range
      label={label}
      value={p[key] as number}
      onChange={(v) => patch({ [key]: v })}
      {...{ min, max, step, unit }}
    />
  )
  const resize = (axis: 'width' | 'height', value: number) => {
    if (!locked) return patch({ [axis]: value })
    const aspect = ratio.current
    if (axis === 'width') {
      const width = Math.min(3840, 3840 * aspect, Math.max(320, 180 * aspect, value))
      patch({ width, height: width / aspect })
    } else {
      const height = Math.min(3840, 3840 / aspect, Math.max(180, 320 / aspect, value))
      patch({ height, width: height * aspect })
    }
  }
  const selectTab = (next: Tab) => {
    setTab(next)
    setQuery('')
  }
  return (
    <aside className="inspector" aria-label="Composition settings">
      <h2 className="sr-only">Composition settings</h2>
      <div className="inspector-tabs" role="tablist" aria-label="Settings">
        {tabs.map((t, i) => (
          <button
            key={t.id}
            id={`tab-${t.id}`}
            role="tab"
            tabIndex={tab === t.id ? 0 : -1}
            aria-selected={tab === t.id}
            aria-controls="settings-panel"
            className={tab === t.id ? 'active' : ''}
            onClick={() => selectTab(t.id)}
            onKeyDown={(e) => {
              let next: number | undefined
              if (e.key === 'ArrowRight') next = (i + 1) % tabs.length
              if (e.key === 'ArrowLeft') next = (i + tabs.length - 1) % tabs.length
              if (e.key === 'Home') next = 0
              if (e.key === 'End') next = tabs.length - 1
              if (next !== undefined) {
                e.preventDefault()
                e.stopPropagation()
                selectTab(tabs[next].id)
                document.getElementById(`tab-${tabs[next].id}`)?.focus()
              }
            }}
          >
            <t.Icon size={18} />
            {t.label}
          </button>
        ))}
      </div>
      <div className="settings-searchbar">
        <div className="settings-search">
          <Search size={18} aria-hidden="true" />
          <input
            type="search"
            aria-label="Search settings"
            placeholder="Find a setting…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query && (
            <button
              className="icon-button"
              aria-label="Clear settings search"
              onClick={() => setQuery('')}
            >
              <X size={18} />
            </button>
          )}
        </div>
        <button
          className="icon-button"
          aria-label={anyOpen ? 'Collapse all sections' : 'Expand all sections'}
          title={anyOpen ? 'Collapse all' : 'Expand all'}
          onClick={() => {
            setQuery('')
            saveSections({
              ...openSections,
              ...Object.fromEntries(visibleGroups.map((g) => [g.id, !anyOpen])),
            })
          }}
        >
          {anyOpen ? <ChevronsDownUp size={20} /> : <ChevronsUpDown size={20} />}
        </button>
      </div>
      <div
        className="inspector-body"
        role="tabpanel"
        id="settings-panel"
        aria-labelledby={`tab-${tab}`}
      >
        {search && (
          <p className="search-summary" role="status">
            {visibleGroups.length} matching {visibleGroups.length === 1 ? 'section' : 'sections'}{' '}
            across all settings
          </p>
        )}
        {!visibleGroups.length && (
          <div className="settings-empty">
            <Search size={24} />
            <strong>No settings found</strong>
            <p>Try “font”, “color” or “duration”.</p>
            <button className="button" onClick={() => setQuery('')}>
              Clear search
            </button>
          </div>
        )}
        {section(
          'words',
          `${p.text.split('\n').length} lines · ${p.text.length}/160 characters`,
          <>
            <Field label="Title">
              <textarea
                value={p.text}
                maxLength={160}
                rows={2}
                spellCheck={false}
                onChange={(e) => patch({ text: e.target.value })}
              />
            </Field>
            <Field label="Subtitle">
              <input
                value={p.subtitle}
                maxLength={80}
                onChange={(e) => patch({ subtitle: e.target.value })}
                placeholder="Add a role, name or detail"
              />
            </Field>
            <p className="field-hint">Enter creates a new title line. Up to 5 lines.</p>
          </>,
        )}
        {section(
          'type',
          `${p.font} · ${p.mode === 'tiles' ? 'Tiles' : 'Typography'}`,
          <>
            <div className="segmented" role="group" aria-label="Letter style">
              <button
                aria-pressed={p.mode === 'tiles'}
                className={p.mode === 'tiles' ? 'active' : ''}
                onClick={() => patch({ mode: 'tiles' })}
              >
                <Layers3 size={18} />
                Tiles
              </button>
              <button
                aria-pressed={p.mode === 'typography'}
                className={p.mode === 'typography' ? 'active' : ''}
                onClick={() => patch({ mode: 'typography' })}
              >
                <Type size={18} />
                Type
              </button>
            </div>
            <Field label="Typeface">
              <select
                value={p.font}
                onChange={(e) => patch({ font: e.target.value as Project['font'] })}
              >
                {FONT_NAMES.map((font) => (
                  <option key={font}>{font}</option>
                ))}
              </select>
            </Field>
            <Field label="Letter case">
              <select
                value={p.textCase}
                onChange={(e) => patch({ textCase: e.target.value as Project['textCase'] })}
              >
                <option value="upper">UPPERCASE</option>
                <option value="original">As typed</option>
                <option value="lower">lowercase</option>
              </select>
            </Field>
            {r(p.mode === 'tiles' ? 'Tile size' : 'Type size', 'tileSize', 48, 180, 1, 'px')}
            {p.mode === 'typography' && (
              <>
                {r('Letter spacing', 'tracking', -4, 32, 1, 'px')}
                <Field label="Text effect">
                  <select
                    value={p.effect}
                    onChange={(e) => patch({ effect: e.target.value as Effect })}
                  >
                    {['extrude', 'skew', 'offset', 'outline', 'retro', 'glow', 'neon'].map((e) => (
                      <option key={e} value={e}>
                        {e[0].toUpperCase() + e.slice(1)}
                      </option>
                    ))}
                  </select>
                </Field>
                <Toggle
                  label="Italic"
                  checked={p.italic}
                  onChange={(italic) => patch({ italic })}
                />
                {(p.effect === 'neon' || p.effect === 'outline') && (
                  <Toggle
                    label="Fill letters"
                    checked={p.filled}
                    onChange={(filled) => patch({ filled })}
                  />
                )}
              </>
            )}
            <div className="inline-label">
              <span>Alignment</span>
              <div className="segmented compact" role="group" aria-label="Text alignment">
                {(
                  [
                    { id: 'left', Icon: AlignLeft },
                    { id: 'center', Icon: AlignCenter },
                    { id: 'right', Icon: AlignRight },
                  ] as const
                ).map(({ id, Icon }) => (
                  <button
                    key={id}
                    aria-label={`Align ${id}`}
                    aria-pressed={p.align === id}
                    className={p.align === id ? 'active' : ''}
                    onClick={() => patch({ align: id })}
                  >
                    <Icon size={20} />
                  </button>
                ))}
              </div>
            </div>
          </>,
        )}
        {section(
          'colors',
          'Editable HEX · 6 starting palettes',
          <>
            <div className="color-grid">
              {p.mode === 'tiles' && (
                <Color
                  label="Tiles"
                  value={p.tileColor}
                  onChange={(tileColor) => patch({ tileColor })}
                />
              )}
              <Color
                label="Lettering"
                value={p.textColor}
                onChange={(textColor) => patch({ textColor })}
              />
              <Color
                label="Subtitle fill"
                value={p.accent}
                onChange={(accent) => patch({ accent })}
              />
              <Color
                label="Subtitle text"
                value={p.subtitleColor}
                onChange={(subtitleColor) => patch({ subtitleColor })}
              />
              {p.mode === 'typography' && (
                <>
                  <Color
                    label="Effect color"
                    value={p.effectColor}
                    onChange={(effectColor) => patch({ effectColor })}
                  />
                  <Color
                    label="Secondary effect"
                    value={p.effectColor2}
                    onChange={(effectColor2) => patch({ effectColor2 })}
                  />
                </>
              )}
            </div>
            <div className="palettes" aria-label="Color palettes">
              {[
                ['#b8d4ff', '#142a4f', '#3e75f3'],
                ['#dcf383', '#253319', '#627b36'],
                ['#f7b8d7', '#651c48', '#da538e'],
                ['#c6b4ff', '#322450', '#8062d7'],
                ['#b9e1d3', '#153d37', '#338b76'],
                ['#f6d5a7', '#502a1a', '#cb773d'],
              ].map((colors, i) => (
                <button
                  key={i}
                  aria-label={`Apply ${['blue', 'lime', 'pink', 'purple', 'mint', 'peach'][i]} palette`}
                  title={`${['Blue', 'Lime', 'Pink', 'Purple', 'Mint', 'Peach'][i]} palette`}
                  onClick={() =>
                    patch({
                      tileColor: colors[0],
                      textColor: p.mode === 'typography' ? colors[0] : colors[1],
                      accent: colors[2],
                      subtitleColor: '#ffffff',
                      effectColor: colors[1],
                      effectColor2: colors[2],
                    })
                  }
                >
                  <span className="palette-colors">
                    {colors.map((color) => (
                      <i key={color} style={{ background: color }} />
                    ))}
                  </span>
                </button>
              ))}
            </div>
          </>,
        )}
        {section(
          'shape',
          `${p.mode === 'tiles' ? `${p.radius}px corners · ` : ''}${p.depth}px depth`,
          <>
            {p.mode === 'tiles' && (
              <>
                {r('Corner radius', 'radius', 0, 80, 1, 'px')}
                {r('Letter padding', 'padding', 0, 35, 1, 'px')}
                {r('Tile spacing', 'gap', 0, 48, 1, 'px')}
              </>
            )}
            {r('Line spacing', 'lineGap', 0, 80, 1, 'px')}
            {r('Depth', 'depth', 0, 30, 1, 'px')}
          </>,
        )}
        {section(
          'subtitle',
          p.subtitlePill
            ? `${p.subtitlePosition === 'top' ? 'Above' : 'Below'} title · Pill`
            : 'Subtitle disabled',
          <>
            <Toggle
              label="Subtitle pill"
              checked={p.subtitlePill}
              onChange={(subtitlePill) => patch({ subtitlePill })}
              hint={p.subtitlePill ? 'Turn off to disable subtitle' : 'Turn on to show subtitle pill'}
            />
            {p.subtitlePill && (
              <>
                <div className="segmented" role="group" aria-label="Subtitle position">
                  <button
                    aria-label="Subtitle above title"
                    aria-pressed={p.subtitlePosition === 'top'}
                    className={p.subtitlePosition === 'top' ? 'active' : ''}
                    onClick={() => patch({ subtitlePosition: 'top' })}
                  >
                    <ArrowUp size={18} />
                    Above
                  </button>
                  <button
                    aria-label="Subtitle below title"
                    aria-pressed={p.subtitlePosition === 'bottom'}
                    className={p.subtitlePosition === 'bottom' ? 'active' : ''}
                    onClick={() => patch({ subtitlePosition: 'bottom' })}
                  >
                    <ArrowDown size={18} />
                    Below
                  </button>
                </div>
                {r('Subtitle size', 'subtitleSize', 12, 80, 1, 'px')}
                {r('Subtitle gap', 'subtitleGap', 0, 100, 1, 'px')}
                {r('Subtitle radius', 'subtitleRadius', 0, 50, 1, 'px')}
                {r('Horizontal padding', 'subtitlePaddingX', 0, 80, 1, 'px')}
                {r('Vertical padding', 'subtitlePaddingY', 0, 40, 1, 'px')}
              </>
            )}
          </>,
        )}
        {section(
          'finish',
          p.backdrop ? 'Soft backdrop enabled' : 'Rotation, variation & shadows',
          <>
            {p.mode === 'tiles' && (
              <>
                {r('Tile rotation', 'rotation', 0, 18, 1, '°')}
                {r('Size variation', 'variation', 0, 0.3, 0.01)}
                {r('Position variation', 'scatter', 0, 30, 1, 'px')}
                {r('Shadow variation', 'shadowVariation', 0, 12, 1, 'px')}
              </>
            )}
            {r('Soft shadow', 'glow', 0, 40, 1, 'px')}
            <Toggle
              label="Soft dark backdrop"
              checked={p.backdrop}
              onChange={(backdrop) => patch({ backdrop })}
              hint="Part of the exported artwork"
            />
          </>,
        )}
        {section(
          'animation',
          `${motions.find((m) => m.id === p.motion)?.name} · reversed outro`,
          <>
            <div className="motion-grid">
              {motions.map((m) => (
                <button
                  key={m.id}
                  className={p.motion === m.id ? 'active' : ''}
                  aria-pressed={p.motion === m.id}
                  onClick={() => patch({ motion: m.id })}
                >
                  <m.Icon size={20} />
                  <span>{m.name}</span>
                </button>
              ))}
            </div>
            <div className="transition-preview">
              <button
                className="button"
                disabled={p.motion === 'none'}
                onClick={() => previewPhase('intro')}
              >
                Preview intro
              </button>
              <button
                className="button"
                disabled={p.motion === 'none'}
                onClick={() => previewPhase('outro')}
              >
                Preview outro
              </button>
            </div>
          </>,
          <button className="text-button" onClick={replay}>
            Replay <ArrowUpRight size={16} />
          </button>,
        )}
        {section(
          'timing',
          `${p.animationDuration}s in · ${p.hold}s hold · ${p.animationDuration}s out`,
          <>
            {r('Animation duration', 'animationDuration', 0.2, 4, 0.1, 's')}
            <p className="field-hint">One duration for each transition: intro and outro.</p>
            {r('Hold', 'hold', 0, 12, 0.1, 's')}
            {r('Stagger', 'stagger', 0, 0.8, 0.05)}
          </>,
        )}
        {section(
          'playback',
          `${p.fps} fps`,
          <Field label="Frame rate">
            <select
              value={p.fps}
              onChange={(e) => patch({ fps: Number(e.target.value) as Project['fps'] })}
            >
              <option value={24}>24 fps · Cinematic</option>
              <option value={30}>30 fps · Standard</option>
              <option value={60}>60 fps · Extra smooth</option>
            </select>
          </Field>,
        )}
        {section(
          'size',
          `${p.width} × ${p.height} px`,
          <>
            <Field label="Canvas size">
              <select
                value={`${p.width}x${p.height}`}
                onChange={(e) => {
                  const [width, height] = e.target.value.split('x').map(Number)
                  ratio.current = width / height
                  patch({ width, height })
                }}
              >
                {!canvasPresets.some(([v]) => v === `${p.width}x${p.height}`) && (
                  <option value={`${p.width}x${p.height}`}>
                    Custom · {p.width} × {p.height}
                  </option>
                )}
                {canvasPresets.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </Field>
            <div className="dimension-fields">
              <Field label="Width (px)">
                <NumberInput
                  value={p.width}
                  min={320}
                  max={3840}
                  step={2}
                  onChange={(v) => resize('width', v)}
                />
              </Field>
              <Field label="Height (px)">
                <NumberInput
                  value={p.height}
                  min={180}
                  max={3840}
                  step={2}
                  onChange={(v) => resize('height', v)}
                />
              </Field>
            </div>
            <Toggle
              label="Lock aspect ratio"
              checked={locked}
              onChange={(next) => {
                ratio.current = p.width / p.height
                setLocked(next)
              }}
            />
            <button
              className="button full"
              onClick={() => {
                const width = Math.max(320, p.height),
                  height = p.width
                ratio.current = width / height
                patch({ width, height })
              }}
            >
              <ArrowLeftRight size={18} />
              Swap dimensions
            </button>
            <p className="field-hint">Enter exact dimensions. Rounded to even pixels for video.</p>
          </>,
        )}
        {section(
          'transform',
          `${p.scale}% scale · ${p.opacity}% opacity`,
          <>
            <div className="segmented">
              <button onClick={() => patch({ x: 50, y: 50 })}>Center</button>
              <button onClick={() => patch({ x: 50, y: 75 })}>Lower third</button>
            </div>
            {r('Composition scale', 'scale', 20, 150, 1, '%')}
            {r('Composition rotation', 'compositionRotation', -180, 180, 1, '°')}
            {r('Opacity', 'opacity', 0, 100, 1, '%')}
            {r('Horizontal position', 'x', 10, 90, 1, '%')}
            {r('Vertical position', 'y', 10, 90, 1, '%')}
            <p className="field-hint">Position refers to the artwork center.</p>
          </>,
        )}
        {section(
          'preview',
          `${p.previewBackground === 'live' ? 'Live stream preview' : p.previewBackground === 'checker' ? 'Transparency checker' : p.previewBackground === 'color' ? 'Custom color' : p.previewBackground} · preview only`,
          <>
            <div className="background-options">
              {(['live', 'checker', 'dark', 'light', 'color'] as const).map((bg) => (
                <button
                  key={bg}
                  aria-label={`Preview on ${bg} background`}
                  aria-pressed={p.previewBackground === bg}
                  className={`background-chip ${bg} ${p.previewBackground === bg ? 'selected' : ''}`}
                  style={bg === 'color' ? { background: p.background } : {}}
                  onClick={() => patch({ previewBackground: bg })}
                >
                  {bg === 'color' && '+'}
                </button>
              ))}
            </div>
            <Color
              label="Custom background"
              value={p.background}
              onChange={(background) => patch({ background, previewBackground: 'color' })}
            />
            <p className="field-hint">
              {p.previewBackground === 'live'
                ? 'Live preview is for on-screen positioning only. Exported background stays transparent.'
                : 'Your exported background stays transparent.'}
            </p>
          </>,
        )}
      </div>
      <div className="inspector-footer">
        <span className="save-state" role="status">
          <Check size={16} />
          {saveStatus}
        </span>
        <button className="icon-button" aria-label="Quick tour" onClick={onHelp}>
          <HelpCircle size={20} />
        </button>
      </div>
    </aside>
  )
}
