import { useEffect, useRef, useState, type ReactNode } from 'react'
import {
  Activity,
  AlignCenter,
  AlignLeft,
  AlignRight,
  Aperture,
  ArrowDown,
  ArrowDownToLine,
  ArrowLeftFromLine,
  ArrowLeftRight,
  ArrowRightFromLine,
  ArrowUp,
  AudioWaveform,
  Bell,
  ChevronDown,
  ChevronUp,
  Circle,
  Clapperboard,
  Copy,
  Crosshair,
  FlipHorizontal2,
  Focus,
  Hammer,
  Heart,
  Layers3,
  Maximize,
  Minimize,
  MoveUp,
  Play,
  Plus,
  RotateCw,
  ScanLine,
  Scissors,
  Sparkles,
  Sun,
  Trash2,
  Type,
  Waves,
  Wind,
  Zap,
  ZoomIn,
  Film,
  MoveVertical,
  MoveHorizontal,
  Disc3,
  FoldVertical,
  Waypoints,
  HeartPulse,
  Orbit,
  ChevronsDown,
  Split,
  Shuffle,
  Tornado,
  Stamp,
  Vibrate,
  Keyboard,
  Lightbulb,
  ArrowDownFromLine,
  ArrowUpFromLine,
  Sparkle,
  Droplets,
  Lock,
  LockOpen,
} from 'lucide-react'
import { Color, Field, NumberInput, Range, Section, Toggle } from './Controls'
import { Composition } from './Composition'
import {
  DEFAULT_PROJECT,
  EASINGS,
  FONT_NAMES,
  TEMPLATES,
  applyTemplate,
  duration,
  frameCount,
  restTime,
  type ChyronLayer,
  type Easing,
  type Effect,
  type HoldEffect,
  type ImageLayer,
  type ImageMotion,
  type Project,
  type Template,
} from '../studio/model'
import { imageTiming } from '../studio/motion'
import { duplicateLayer, fitWidth, moveLayer, removeLayer, updateLayer } from '../studio/layers'
import { useProjectImages } from '../studio/useImages'
import type { SavedPreset } from '../studio/useProject'

type Icon = typeof Sparkles
export type PropertiesTab = 'design' | 'animate'
type Patch = (patch: Partial<Project>) => void

/* ---------- Shared building blocks ---------- */

const OPEN_KEY = 'chyron-studio:groups:v3'
const defaultOpen: Record<string, boolean> = {
  style: true,
  text: true,
  place: true,
  canvas: true,
  timing: true,
}
function useGroups() {
  const [open, setOpen] = useState<Record<string, boolean>>(() => {
    try {
      const raw = JSON.parse(localStorage.getItem(OPEN_KEY) || 'null')
      return raw && typeof raw === 'object' ? { ...defaultOpen, ...raw } : defaultOpen
    } catch {
      return defaultOpen
    }
  })
  const toggle = (id: string) => {
    const next = { ...open, [id]: !open[id] }
    setOpen(next)
    try {
      localStorage.setItem(OPEN_KEY, JSON.stringify(next))
    } catch {
      /* Optional preference. */
    }
  }
  return (
    id: string,
    title: string,
    summary: string,
    children: ReactNode,
    onReset?: () => void,
  ) => (
    <Section
      key={id}
      title={title}
      summary={summary}
      open={!!open[id]}
      onToggle={() => toggle(id)}
      onReset={onReset}
    >
      {children}
    </Section>
  )
}

function Chips<T extends string>({
  label,
  items,
  value,
  onChange,
  columns = 4,
}: {
  label: string
  items: { id: T; name: string; Icon: Icon }[]
  value: T
  onChange: (value: T) => void
  columns?: number
}) {
  return (
    <div
      className="chip-grid"
      role="group"
      aria-label={label}
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
    >
      {items.map(({ id, name, Icon }) => (
        <button
          key={id}
          className={value === id ? 'active' : ''}
          aria-pressed={value === id}
          onClick={() => onChange(id)}
        >
          <Icon size={18} aria-hidden="true" />
          <span>{name}</span>
        </button>
      ))}
    </div>
  )
}

function Segmented<T extends string>({
  label,
  items,
  value,
  onChange,
}: {
  label: string
  items: { id: T; name: string; Icon?: Icon }[]
  value: T
  onChange: (value: T) => void
}) {
  return (
    <div className="segmented" role="group" aria-label={label}>
      {items.map(({ id, name, Icon }) => (
        <button
          key={id}
          className={value === id ? 'active' : ''}
          aria-pressed={value === id}
          aria-label={Icon && !name ? id : undefined}
          onClick={() => onChange(id)}
        >
          {Icon && <Icon size={18} aria-hidden="true" />}
          {name}
        </button>
      ))}
    </div>
  )
}

function Preview({ onPreview }: { onPreview: (phase: 'intro' | 'outro') => void }) {
  return (
    <div className="pair-buttons">
      <button className="button" onClick={() => onPreview('intro')}>
        <Play size={16} /> Preview in
      </button>
      <button className="button" onClick={() => onPreview('outro')}>
        <Play size={16} /> Preview out
      </button>
    </div>
  )
}

/* ---------- Panel ---------- */

export interface PropertiesProps {
  project: Project
  patch: Patch
  selected: string | null
  onSelect: (id: string | null) => void
  tab: PropertiesTab
  onTab: (tab: PropertiesTab) => void
  previewPhase: (phase: 'intro' | 'outro', returnToRest?: boolean) => void
  presets: SavedPreset[]
  onApplyTemplate: (template: Template) => void
  onApplyPreset: (preset: SavedPreset) => void
  onSavePreset: (name: string) => boolean
  onRemovePreset: (id: string) => void
}

export function Properties(props: PropertiesProps) {
  const { project: p, patch, selected, onSelect, tab, onTab } = props
  const layer = p.layers.find((l) => l.id === selected)
  const index = layer ? p.layers.indexOf(layer) : -1
  const images = useProjectImages(p)
  const tabs: { id: PropertiesTab; label: string }[] = [
    { id: 'design', label: 'Design' },
    { id: 'animate', label: 'Animate' },
  ]
  return (
    <aside className="inspector properties" aria-label="Properties">
      <header className="props-head">
        <span
          className={`props-icon ${layer?.kind === 'chyron' ? 'is-chyron' : ''}`}
          aria-hidden="true"
        >
          {!layer ? (
            <Film size={16} />
          ) : layer.kind === 'chyron' ? (
            <Type size={16} />
          ) : (
            <Thumb image={images.get(layer.assetId)} />
          )}
        </span>
        {layer?.kind === 'image' ? (
          <input
            className="props-title-input"
            aria-label="Layer name"
            value={layer.name}
            maxLength={80}
            onChange={(e) => patch({ layers: updateLayer(p, layer.id, { name: e.target.value }) })}
          />
        ) : (
          <h2 className="props-title">{layer ? 'Chyron' : 'Composition'}</h2>
        )}
        {layer && (
          <div className="props-actions">
            <button
              className="icon-button"
              aria-label="Bring forward"
              title="Bring forward"
              disabled={index === p.layers.length - 1}
              onClick={() => patch({ layers: moveLayer(p, layer.id, 1) })}
            >
              <ChevronUp size={18} />
            </button>
            <button
              className="icon-button"
              aria-label="Send backward"
              title="Send backward"
              disabled={index === 0}
              onClick={() => patch({ layers: moveLayer(p, layer.id, -1) })}
            >
              <ChevronDown size={18} />
            </button>
            {layer.kind === 'image' && (
              <>
                <button
                  className="icon-button"
                  aria-label="Duplicate layer"
                  title="Duplicate"
                  onClick={() => {
                    const next = duplicateLayer(p, layer.id)
                    if (next.id) {
                      patch({ layers: next.layers })
                      onSelect(next.id)
                    }
                  }}
                >
                  <Copy size={18} />
                </button>
                <button
                  className="icon-button danger"
                  aria-label="Delete layer"
                  title="Delete (Del)"
                  onClick={() => {
                    patch({ layers: removeLayer(p, layer.id) })
                    onSelect(null)
                  }}
                >
                  <Trash2 size={18} />
                </button>
              </>
            )}
          </div>
        )}
      </header>
      {layer && (
        <div className="props-tabs" role="tablist" aria-label="Layer settings">
          {tabs.map((t, i) => (
            <button
              key={t.id}
              id={`props-tab-${t.id}`}
              role="tab"
              aria-selected={tab === t.id}
              aria-controls="props-panel"
              tabIndex={tab === t.id ? 0 : -1}
              className={tab === t.id ? 'active' : ''}
              onClick={() => onTab(t.id)}
              onKeyDown={(e) => {
                if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return
                e.preventDefault()
                e.stopPropagation()
                const next = tabs[(i + 1) % tabs.length]
                onTab(next.id)
                document.getElementById(`props-tab-${next.id}`)?.focus()
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}
      <div
        className="inspector-body props-body"
        id="props-panel"
        role={layer ? 'tabpanel' : 'region'}
        aria-labelledby={layer ? `props-tab-${tab}` : undefined}
        aria-label={layer ? undefined : 'Composition settings'}
      >
        {!layer && <CompositionSettings project={p} patch={patch} />}
        {layer?.kind === 'chyron' &&
          (tab === 'design' ? (
            <ChyronDesign {...props} />
          ) : (
            <ChyronAnimate
              project={p}
              patch={patch}
              layer={layer}
              previewPhase={props.previewPhase}
            />
          ))}
        {layer?.kind === 'image' &&
          (tab === 'design' ? (
            <ImageDesign l={layer} p={p} patch={patch} />
          ) : (
            <ImageAnimate l={layer} p={p} patch={patch} previewPhase={props.previewPhase} />
          ))}
      </div>
    </aside>
  )
}

function Thumb({ image }: { image?: CanvasImageSource & { width: number; height: number } }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = ref.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx || !image) return
    canvas.width = canvas.height = 64
    ctx.clearRect(0, 0, 64, 64)
    const s = Math.min(64 / image.width, 64 / image.height)
    ctx.drawImage(
      image,
      (64 - image.width * s) / 2,
      (64 - image.height * s) / 2,
      image.width * s,
      image.height * s,
    )
  }, [image])
  return <canvas ref={ref} className="thumb-canvas" />
}

/* ---------- Composition (nothing selected) ---------- */

const canvasPresets = [
  ['720x1280', 'Vertical · 720 × 1280'],
  ['1080x1920', 'Vertical · 1080 × 1920'],
  ['1280x720', 'Landscape · 1280 × 720'],
  ['1920x1080', 'Landscape · 1920 × 1080'],
  ['1080x1080', 'Square · 1080 × 1080'],
  ['1080x1350', 'Portrait · 1080 × 1350'],
  ['1920x480', 'Lower third · 1920 × 480'],
  ['3840x2160', '4K · 3840 × 2160'],
]
function CompositionSettings({ project: p, patch }: { project: Project; patch: Patch }) {
  const group = useGroups()
  const [locked, setLocked] = useState(false)
  const ratio = useRef(p.width / p.height)
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
  const total = duration(p)
  return (
    <>
      {group(
        'canvas',
        'Canvas',
        `${p.width} × ${p.height}`,
        <>
          <Field label="Size">
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
          <div className="size-row">
            <Field label="Width (px)">
              <NumberInput
                value={p.width}
                min={320}
                max={3840}
                step={2}
                onChange={(v) => resize('width', v)}
              />
            </Field>
            <span className="size-times" aria-hidden="true">
              ×
            </span>
            <Field label="Height (px)">
              <NumberInput
                value={p.height}
                min={180}
                max={3840}
                step={2}
                onChange={(v) => resize('height', v)}
              />
            </Field>
            <div className="size-actions">
              <button
                className={`icon-button ${locked ? 'selected' : ''}`}
                aria-label="Lock aspect ratio"
                aria-pressed={locked}
                title={locked ? 'Aspect ratio locked' : 'Lock aspect ratio'}
                onClick={() => {
                  ratio.current = p.width / p.height
                  setLocked(!locked)
                }}
              >
                {locked ? <Lock size={16} /> : <LockOpen size={16} />}
              </button>
              <button
                className="icon-button"
                aria-label="Swap dimensions"
                title="Swap width and height"
                onClick={() => {
                  const width = Math.max(320, p.height),
                    height = p.width
                  ratio.current = width / height
                  patch({ width, height })
                }}
              >
                <ArrowLeftRight size={16} />
              </button>
            </div>
          </div>
        </>,
        () => patch({ width: DEFAULT_PROJECT.width, height: DEFAULT_PROJECT.height }),
      )}
      {group(
        'timing',
        'Timing',
        `${total.toFixed(1)} s · ${frameCount(p)} frames`,
        <>
          <Range
            label="Transition"
            value={p.animationDuration}
            min={0.2}
            max={4}
            step={0.1}
            unit="s"
            onChange={(animationDuration) => patch({ animationDuration })}
          />
          <Range
            label="Hold"
            value={p.hold}
            min={0}
            max={12}
            step={0.1}
            unit="s"
            onChange={(hold) => patch({ hold })}
          />
          <div className="inline-control">
            <span className="field-label">Frame rate</span>
            <Segmented
              label="Frame rate"
              value={String(p.fps) as '24' | '30' | '60'}
              onChange={(fps) => patch({ fps: Number(fps) as Project['fps'] })}
              items={[
                { id: '24', name: '24' },
                { id: '30', name: '30' },
                { id: '60', name: '60' },
              ]}
            />
          </div>
        </>,
        () =>
          patch({
            animationDuration: DEFAULT_PROJECT.animationDuration,
            hold: DEFAULT_PROJECT.hold,
            fps: DEFAULT_PROJECT.fps,
          }),
      )}
    </>
  )
}

/* ---------- Chyron ---------- */

const templateSamples = TEMPLATES.map((t) =>
  applyTemplate({ ...DEFAULT_PROJECT, width: 1280, height: 720, text: 'Aa', subtitle: '' }, t),
)
const palettes = [
  ['#b8d4ff', '#142a4f', '#3e75f3'],
  ['#dcf383', '#253319', '#627b36'],
  ['#f7b8d7', '#651c48', '#da538e'],
  ['#c6b4ff', '#322450', '#8062d7'],
  ['#b9e1d3', '#153d37', '#338b76'],
  ['#f6d5a7', '#502a1a', '#cb773d'],
]
const paletteNames = ['Blue', 'Lime', 'Pink', 'Purple', 'Mint', 'Peach']

function ChyronDesign({
  project: p,
  patch,
  presets,
  onApplyTemplate,
  onApplyPreset,
  onSavePreset,
  onRemovePreset,
}: PropertiesProps) {
  const group = useGroups()
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const r = (label: string, key: keyof Project, min: number, max: number, step = 1, unit = '') => (
    <Range
      label={label}
      value={p[key] as number}
      onChange={(v) => patch({ [key]: v })}
      {...{ min, max, step, unit }}
    />
  )
  const reset = (keys: (keyof Project)[]) => () =>
    patch(Object.fromEntries(keys.map((k) => [k, DEFAULT_PROJECT[k]])))
  const tiles = p.mode === 'tiles'
  return (
    <>
      {group(
        'style',
        'Style',
        '',
        <>
          <div className="style-grid">
            {TEMPLATES.map((t, i) => (
              <button
                key={t.id}
                className="style-card"
                title={t.caption}
                aria-label={`Apply ${t.name} style`}
                onClick={() => onApplyTemplate(t)}
              >
                <span className="style-art" style={{ background: t.background }}>
                  <Composition
                    project={templateSamples[i]}
                    time={restTime(templateSamples[i])}
                    thumbnail
                  />
                </span>
                <span className="style-name">{t.name}</span>
              </button>
            ))}
          </div>
          {presets.length > 0 && (
            <ul className="saved-styles" aria-label="Your styles">
              {presets.map((preset) => (
                <li key={preset.id}>
                  <button className="saved-style" onClick={() => onApplyPreset(preset)}>
                    <Layers3 size={16} aria-hidden="true" />
                    <span>{preset.name}</span>
                  </button>
                  <button
                    className="icon-button"
                    aria-label={`Delete style ${preset.name}`}
                    onClick={() => onRemovePreset(preset.id)}
                  >
                    <Trash2 size={16} />
                  </button>
                </li>
              ))}
            </ul>
          )}
          {saving ? (
            <form
              className="inline-form"
              onSubmit={(e) => {
                e.preventDefault()
                if (name.trim() && onSavePreset(name.trim())) {
                  setName('')
                  setSaving(false)
                }
              }}
            >
              <input
                aria-label="Style name"
                placeholder="Name this style"
                maxLength={80}
                value={name}
                autoFocus
                onChange={(e) => setName(e.target.value)}
              />
              <button className="button primary" type="submit" disabled={!name.trim()}>
                Save
              </button>
            </form>
          ) : (
            <button className="button subtle full" onClick={() => setSaving(true)}>
              <Plus size={16} /> Save current style
            </button>
          )}
        </>,
      )}
      {group(
        'text',
        'Text',
        '',
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
        </>,
        reset(['text']),
      )}
      {group(
        'subtitle',
        'Subtitle',
        p.subtitlePill
          ? `${p.subtitle ? `"${p.subtitle}" · ` : ''}${p.subtitlePosition === 'top' ? 'Above title' : 'Below title'}`
          : 'Disabled',
        <>
          <Toggle
            label="Subtitle"
            checked={p.subtitlePill}
            onChange={(subtitlePill) => patch({ subtitlePill })}
          />
          {p.subtitlePill && (
            <>
              <Field label="Subtitle text">
                <input
                  value={p.subtitle}
                  maxLength={80}
                  onChange={(e) => patch({ subtitle: e.target.value })}
                  placeholder="Role, name or detail"
                />
              </Field>
              <Segmented
                label="Subtitle position"
                value={p.subtitlePosition}
                onChange={(subtitlePosition) => patch({ subtitlePosition })}
                items={[
                  { id: 'top', name: 'Above', Icon: ArrowUp },
                  { id: 'bottom', name: 'Below', Icon: ArrowDown },
                ]}
              />
              <div className="color-grid">
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
              </div>
              {r('Subtitle size', 'subtitleSize', 12, 80, 1, 'px')}
              {r('Subtitle gap', 'subtitleGap', 0, 100, 1, 'px')}
              {r('Subtitle radius', 'subtitleRadius', 0, 50, 1, 'px')}
              {r('Horizontal padding', 'subtitlePaddingX', 0, 80, 1, 'px')}
              {r('Vertical padding', 'subtitlePaddingY', 0, 40, 1, 'px')}
            </>
          )}
        </>,
        reset([
          'subtitlePill',
          'subtitle',
          'subtitlePosition',
          'accent',
          'subtitleColor',
          'subtitleSize',
          'subtitleGap',
          'subtitleRadius',
          'subtitlePaddingX',
          'subtitlePaddingY',
        ]),
      )}
      {group(
        'type',
        'Typography',
        `${p.font} · ${tiles ? 'Tiles' : 'Type'}`,
        <>
          <Segmented
            label="Letter style"
            value={p.mode}
            onChange={(mode) => patch({ mode })}
            items={[
              { id: 'tiles', name: 'Tiles', Icon: Layers3 },
              { id: 'typography', name: 'Type', Icon: Type },
            ]}
          />
          <div className="pair-fields">
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
            <Field label="Case">
              <select
                value={p.textCase}
                onChange={(e) => patch({ textCase: e.target.value as Project['textCase'] })}
              >
                <option value="upper">ABC</option>
                <option value="original">Abc</option>
                <option value="lower">abc</option>
              </select>
            </Field>
          </div>
          {r('Size', 'tileSize', 48, 180, 1, 'px')}
          {!tiles && (
            <>
              {r('Letter spacing', 'tracking', -4, 32, 1, 'px')}
              <Field label="Effect">
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
              <Toggle label="Italic" checked={p.italic} onChange={(italic) => patch({ italic })} />
              {(p.effect === 'neon' || p.effect === 'outline') && (
                <Toggle
                  label="Fill letters"
                  checked={p.filled}
                  onChange={(filled) => patch({ filled })}
                />
              )}
            </>
          )}
          <Segmented
            label="Text alignment"
            value={p.align}
            onChange={(align) => patch({ align })}
            items={[
              { id: 'left', name: '', Icon: AlignLeft },
              { id: 'center', name: '', Icon: AlignCenter },
              { id: 'right', name: '', Icon: AlignRight },
            ]}
          />
        </>,
        reset([
          'mode',
          'font',
          'tileSize',
          'textCase',
          'tracking',
          'italic',
          'effect',
          'filled',
          'align',
        ]),
      )}
      {group(
        'colors',
        'Colors',
        '',
        <>
          <div className="palettes" aria-label="Color palettes">
            {palettes.map((colors, i) => (
              <button
                key={i}
                aria-label={`Apply ${paletteNames[i].toLowerCase()} palette`}
                title={`${paletteNames[i]} palette`}
                onClick={() =>
                  patch({
                    tileColor: colors[0],
                    textColor: tiles ? colors[1] : colors[0],
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
          <div className="color-grid">
            {tiles && (
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
            {!tiles && (
              <>
                <Color
                  label="Effect"
                  value={p.effectColor}
                  onChange={(effectColor) => patch({ effectColor })}
                />
                <Color
                  label="Effect 2"
                  value={p.effectColor2}
                  onChange={(effectColor2) => patch({ effectColor2 })}
                />
              </>
            )}
          </div>
        </>,
        reset(['tileColor', 'textColor', 'effectColor', 'effectColor2']),
      )}
      {group(
        'shape',
        'Shape & spacing',
        `${tiles ? `${p.radius}px corners · ` : ''}${p.depth}px depth`,
        <>
          {tiles && (
            <>
              {r('Corner radius', 'radius', 0, 80, 1, 'px')}
              {r('Letter padding', 'padding', 0, 35, 1, 'px')}
              {r('Tile spacing', 'gap', 0, 48, 1, 'px')}
            </>
          )}
          {r('Line spacing', 'lineGap', 0, 80, 1, 'px')}
          {r('Depth', 'depth', 0, 30, 1, 'px')}
        </>,
        reset(['radius', 'padding', 'gap', 'lineGap', 'depth']),
      )}
      {group(
        'finish',
        'Details',
        p.backdrop ? 'Backdrop on' : '',
        <>
          {tiles && (
            <>
              {r('Tile rotation', 'rotation', 0, 18, 1, '°')}
              {r('Size variation', 'variation', 0, 0.3, 0.01)}
              {r('Position variation', 'scatter', 0, 30, 1, 'px')}
              {r('Shadow variation', 'shadowVariation', 0, 12, 1, 'px')}
            </>
          )}
          {r('Soft shadow', 'glow', 0, 40, 1, 'px')}
          <Toggle
            label="Dark backdrop"
            checked={p.backdrop}
            onChange={(backdrop) => patch({ backdrop })}
          />
        </>,
        reset(['rotation', 'variation', 'scatter', 'shadowVariation', 'glow', 'backdrop']),
      )}
      {group(
        'place',
        'Position',
        `${p.scale}% · ${p.compositionRotation}° · ${p.opacity}%`,
        <>
          <div className="chip-grid quick" role="group" aria-label="Quick position">
            <button onClick={() => patch({ x: 50, y: 50 })}>
              <Crosshair size={18} aria-hidden="true" />
              <span>Center</span>
            </button>
            <button onClick={() => patch({ x: 50, y: 75 })}>
              <ArrowDownToLine size={18} aria-hidden="true" />
              <span>Lower third</span>
            </button>
          </div>
          {r('Scale', 'scale', 20, 150, 1, '%')}
          {r('Rotation', 'compositionRotation', -180, 180, 1, '°')}
          {r('Opacity', 'opacity', 0, 100, 1, '%')}
          {r('Horizontal position', 'x', 10, 90, 1, '%')}
          {r('Vertical position', 'y', 10, 90, 1, '%')}
        </>,
        reset(['scale', 'compositionRotation', 'opacity', 'x', 'y']),
      )}
    </>
  )
}

const CHYRON_MOTION: Record<Project['motion'], { name: string; Icon: Icon }> = {
  fade: { name: 'Fade', Icon: Circle },
  pop: { name: 'Pop', Icon: Sparkles },
  slide: { name: 'Rise', Icon: MoveUp },
  none: { name: 'Still', Icon: Clapperboard },
  drop: { name: 'Drop', Icon: ArrowDownToLine },
  bounce: { name: 'Bounce', Icon: ChevronsDown },
  wave: { name: 'Wave', Icon: Waves },
  elastic: { name: 'Elastic', Icon: MoveHorizontal },
  'from-left': { name: 'From left', Icon: ArrowRightFromLine },
  'from-right': { name: 'From right', Icon: ArrowLeftFromLine },
  split: { name: 'Split', Icon: Split },
  scatter: { name: 'Scatter', Icon: Shuffle },
  flip: { name: 'Flip', Icon: FlipHorizontal2 },
  spin: { name: 'Spin', Icon: RotateCw },
  swing: { name: 'Swing', Icon: Bell },
  cascade: { name: 'Cascade', Icon: Tornado },
  zoom: { name: 'Zoom', Icon: ZoomIn },
  stamp: { name: 'Stamp', Icon: Stamp },
  slam: { name: 'Slam', Icon: Hammer },
  shake: { name: 'Shake', Icon: Vibrate },
  wipe: { name: 'Reveal', Icon: ScanLine },
  typewriter: { name: 'Typewriter', Icon: Keyboard },
  blink: { name: 'Blink', Icon: Lightbulb },
  glitch: { name: 'Glitch', Icon: AudioWaveform },
}
const CHYRON_GROUPS: { title: string; items: Project['motion'][] }[] = [
  { title: 'Simple', items: ['fade', 'pop', 'slide', 'none'] },
  { title: 'Bouncy', items: ['drop', 'bounce', 'wave', 'elastic'] },
  { title: 'Move', items: ['from-left', 'from-right', 'split', 'scatter'] },
  { title: 'Turn', items: ['flip', 'spin', 'swing', 'cascade'] },
  { title: 'Impact', items: ['zoom', 'stamp', 'slam', 'shake'] },
  { title: 'Reveal', items: ['wipe', 'typewriter', 'blink', 'glitch'] },
]

function ChyronAnimate({
  project: p,
  patch,
  layer,
  previewPhase,
}: {
  project: Project
  patch: Patch
  layer: ChyronLayer
  previewPhase: (phase: 'intro' | 'outro', returnToRest?: boolean) => void
}) {
  const maxDelay = Math.max(0, Math.round((duration(p) / 2 - p.animationDuration) * 10) / 10)
  return (
    <div className="props-stack">
      <div className="block">
        <span className="block-label">In & out</span>
        {CHYRON_GROUPS.map((g) => (
          <div key={g.title} className="motion-group">
            <span className="motion-group-title">{g.title}</span>
            <Chips
              label={`${g.title} animations`}
              columns={4}
              items={g.items.map((id) => ({ id, ...CHYRON_MOTION[id] }))}
              value={p.motion}
              onChange={(motion) => {
                patch({ motion })
                // Picking a style plays it right away.
                if (motion !== 'none') previewPhase('intro', true)
              }}
            />
          </div>
        ))}
        <p className="block-note">The outro plays the intro in reverse.</p>
      </div>
      {p.motion !== 'none' && <Preview onPreview={previewPhase} />}
      <div className="block">
        <Range
          label="Stagger"
          value={p.stagger}
          min={0}
          max={0.8}
          step={0.05}
          onChange={(stagger) => patch({ stagger })}
        />
        <Range
          label="Delay"
          value={Math.min(layer.delay, maxDelay)}
          min={0}
          max={maxDelay}
          step={0.1}
          unit="s"
          onChange={(delay) => patch({ layers: updateLayer(p, layer.id, { delay }) })}
        />
      </div>
    </div>
  )
}

/* ---------- Images ---------- */

const MOTION: Record<ImageMotion, { name: string; out?: string; Icon: Icon }> = {
  fade: { name: 'Fade', Icon: Circle },
  pop: { name: 'Pop', Icon: Sparkles },
  rise: { name: 'Rise', Icon: MoveUp },
  none: { name: 'Cut', Icon: Scissors },
  burst: { name: 'Burst', Icon: Zap },
  slam: { name: 'Slam', Icon: Hammer },
  drop: { name: 'Drop', Icon: ArrowDownToLine },
  swing: { name: 'Swing', Icon: Bell },
  'slide-left': { name: 'From left', out: 'To left', Icon: ArrowRightFromLine },
  'slide-right': { name: 'From right', out: 'To right', Icon: ArrowLeftFromLine },
  zoom: { name: 'Zoom', Icon: ZoomIn },
  spin: { name: 'Spin', Icon: RotateCw },
  wipe: { name: 'Wipe', Icon: ScanLine },
  iris: { name: 'Iris', Icon: Aperture },
  focus: { name: 'Focus', Icon: Focus },
  flip: { name: 'Flip', Icon: FlipHorizontal2 },
  glitch: { name: 'Glitch', Icon: AudioWaveform },
  stretch: { name: 'Stretch', Icon: MoveVertical },
  roll: { name: 'Roll', Icon: Disc3 },
  unfold: { name: 'Unfold', Icon: FoldVertical },
  bounce: { name: 'Bounce', Icon: ChevronsDown },
  'from-top': { name: 'From top', out: 'To top', Icon: ArrowDownFromLine },
  'from-bottom': { name: 'From bottom', out: 'To bottom', Icon: ArrowUpFromLine },
  flicker: { name: 'Flicker', Icon: Lightbulb },
}
const MOTION_GROUPS: { title: string; items: ImageMotion[] }[] = [
  { title: 'Simple', items: ['fade', 'pop', 'rise', 'none'] },
  { title: 'Punchy', items: ['burst', 'slam', 'drop', 'bounce'] },
  { title: 'Springy', items: ['swing', 'stretch', 'unfold', 'flip'] },
  { title: 'Move', items: ['slide-left', 'slide-right', 'from-top', 'from-bottom'] },
  { title: 'Turn', items: ['spin', 'roll', 'zoom', 'focus'] },
  { title: 'Reveal', items: ['wipe', 'iris', 'glitch', 'flicker'] },
]
const EFFECTS: { id: HoldEffect; name: string; Icon: Icon }[] = [
  { id: 'none', name: 'None', Icon: Circle },
  { id: 'pulse', name: 'Pulse', Icon: Heart },
  { id: 'float', name: 'Float', Icon: Waves },
  { id: 'sway', name: 'Sway', Icon: Wind },
  { id: 'kenburns', name: 'Ken Burns', Icon: ZoomIn },
  { id: 'shine', name: 'Shine', Icon: Sun },
  { id: 'rumble', name: 'Rumble', Icon: Activity },
  { id: 'wiggle', name: 'Wiggle', Icon: Waypoints },
  { id: 'heartbeat', name: 'Heartbeat', Icon: HeartPulse },
  { id: 'orbit', name: 'Orbit', Icon: Orbit },
  { id: 'glow', name: 'Glow', Icon: Sparkle },
  { id: 'jelly', name: 'Jelly', Icon: Droplets },
]
const EASING_NAMES: Record<Easing, string> = {
  auto: 'Signature',
  smooth: 'Smooth',
  snappy: 'Snappy',
  bounce: 'Bounce',
  elastic: 'Elastic',
  linear: 'Linear',
}

function ImageDesign({ l, p, patch }: { l: ImageLayer; p: Project; patch: Patch }) {
  const group = useGroups()
  const set = (values: Partial<ImageLayer>) => patch({ layers: updateLayer(p, l.id, values) })
  const r = (
    label: string,
    key: keyof ImageLayer,
    min: number,
    max: number,
    step = 1,
    unit = '',
  ) => (
    <Range
      label={label}
      value={Math.min(max, l[key] as number)}
      onChange={(v) => set({ [key]: v })}
      {...{ min, max, step, unit }}
    />
  )
  return (
    <>
      {group(
        'place',
        'Position',
        `${l.width}% · ${l.rotation}° · ${l.opacity}%`,
        <>
          <div className="chip-grid quick" role="group" aria-label="Quick placement">
            <button
              onClick={() =>
                set({ width: fitWidth(p, l.aspect, 'contain'), x: 50, y: 50, rotation: 0 })
              }
            >
              <Minimize size={18} aria-hidden="true" />
              <span>Fit</span>
            </button>
            <button
              onClick={() =>
                set({ width: fitWidth(p, l.aspect, 'cover'), x: 50, y: 50, rotation: 0 })
              }
            >
              <Maximize size={18} aria-hidden="true" />
              <span>Fill</span>
            </button>
            <button onClick={() => set({ x: 50, y: 50 })}>
              <Crosshair size={18} aria-hidden="true" />
              <span>Center</span>
            </button>
            <button onClick={() => set({ x: 50, y: 75 })}>
              <ArrowDownToLine size={18} aria-hidden="true" />
              <span>Lower</span>
            </button>
          </div>
          {r('Size', 'width', 2, 400, 0.5, '%')}
          {r('Rotation', 'rotation', -180, 180, 1, '°')}
          {r('Opacity', 'opacity', 0, 100, 1, '%')}
          <div className="pair-fields">
            <Field label="X (%)">
              <NumberInput
                value={l.x}
                min={-50}
                max={150}
                step={0.5}
                onChange={(x) => set({ x })}
              />
            </Field>
            <Field label="Y (%)">
              <NumberInput
                value={l.y}
                min={-50}
                max={150}
                step={0.5}
                onChange={(y) => set({ y })}
              />
            </Field>
          </div>
          <Toggle label="Mirror" checked={l.flipX} onChange={(flipX) => set({ flipX })} />
        </>,
      )}
      {group(
        'frame',
        'Frame & shadow',
        l.radius || l.border || l.shadow ? `${l.radius}% round · ${l.shadow}px shadow` : '',
        <>
          {r('Round corners', 'radius', 0, 50, 1, '%')}
          {r('Border', 'border', 0, 40, 1, 'px')}
          {l.border > 0 && (
            <Color
              label="Border color"
              value={l.borderColor}
              onChange={(borderColor) => set({ borderColor })}
            />
          )}
          {r('Shadow', 'shadow', 0, 80, 1, 'px')}
        </>,
        () => set({ radius: 0, border: 0, shadow: 0 }),
      )}
    </>
  )
}

function ImageAnimate({
  l,
  p,
  patch,
  previewPhase,
}: {
  l: ImageLayer
  p: Project
  patch: Patch
  previewPhase: (phase: 'intro' | 'outro', returnToRest?: boolean) => void
}) {
  const set = (values: Partial<ImageLayer>) => patch({ layers: updateLayer(p, l.id, values) })
  const timing = imageTiming(l, p)
  const others = p.layers.filter((layer) => layer.kind === 'image' && layer.id !== l.id).length
  const maxDelay = Math.max(0, Math.round((duration(p) / 2 - 0.2) * 10) / 10)
  return (
    <div className="props-stack">
      <div className="block">
        <span className="block-label">In</span>
        {MOTION_GROUPS.map((g) => (
          <div key={g.title} className="motion-group">
            <span className="motion-group-title">{g.title}</span>
            <Chips
              label={`${g.title} intro styles`}
              columns={4}
              items={g.items.map((id) => ({ id, ...MOTION[id] }))}
              value={l.intro}
              onChange={(intro) => {
                set({ intro })
                previewPhase('intro', true)
              }}
            />
          </div>
        ))}
      </div>
      <div className="block">
        <div className="pair-fields">
          <Field label="Out">
            <select
              value={l.outro}
              onChange={(e) => set({ outro: e.target.value as ImageLayer['outro'] })}
            >
              <option value="mirror">Reverse</option>
              {MOTION_GROUPS.flatMap((g) => g.items).map((id) => (
                <option key={id} value={id}>
                  {MOTION[id].out ?? MOTION[id].name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Easing">
            <select value={l.easing} onChange={(e) => set({ easing: e.target.value as Easing })}>
              {EASINGS.map((id) => (
                <option key={id} value={id}>
                  {EASING_NAMES[id]}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <div className="pair-fields">
          <Field label="Length (s)">
            <NumberInput
              value={l.duration}
              min={0.2}
              max={4}
              step={0.1}
              onChange={(duration) => set({ duration })}
            />
          </Field>
          <Field label="Delay (s)">
            <NumberInput
              value={Math.min(l.delay, maxDelay)}
              min={0}
              max={maxDelay}
              step={0.1}
              onChange={(delay) => set({ delay })}
            />
          </Field>
        </div>
        {timing.length < l.duration - 0.001 && (
          <p className="block-note" role="status">
            Shortened to {Math.round(timing.length * 100) / 100}s to fit the clip.
          </p>
        )}
        {(l.intro === 'burst' || l.outro === 'burst') && (
          <Color
            label="Burst sparks"
            value={l.burstColor}
            onChange={(burstColor) => set({ burstColor })}
          />
        )}
      </div>
      <Preview onPreview={previewPhase} />
      <div className="block">
        <span className="block-label">While on screen</span>
        <Chips
          label="While on screen"
          items={EFFECTS}
          value={l.emphasis}
          onChange={(emphasis) => set({ emphasis })}
        />
        {l.emphasis !== 'none' && (
          <>
            <Range
              label="Strength"
              value={l.emphasisStrength}
              min={0}
              max={100}
              unit="%"
              onChange={(emphasisStrength) => set({ emphasisStrength })}
            />
            {l.emphasis !== 'kenburns' && (
              <Range
                label="Cycle"
                value={l.emphasisSpeed}
                min={0.5}
                max={8}
                step={0.1}
                unit="s"
                onChange={(emphasisSpeed) => set({ emphasisSpeed })}
              />
            )}
          </>
        )}
      </div>
      {others > 0 && (
        <button
          className="button subtle full"
          title="Give every image this intro, outro, easing, length and on-screen effect"
          onClick={() =>
            patch({
              layers: p.layers.map((layer) =>
                layer.kind === 'image' && layer.id !== l.id
                  ? {
                      ...layer,
                      intro: l.intro,
                      outro: l.outro,
                      easing: l.easing,
                      duration: l.duration,
                      emphasis: l.emphasis,
                      emphasisStrength: l.emphasisStrength,
                      emphasisSpeed: l.emphasisSpeed,
                      burstColor: l.burstColor,
                    }
                  : layer,
              ),
            })
          }
        >
          <Copy size={16} /> Use this animation on {others} other image{others === 1 ? '' : 's'}
        </button>
      )}
    </div>
  )
}
