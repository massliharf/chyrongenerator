import { useEffect, useRef, useState } from 'react'
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowDown,
  ArrowDownToLine,
  ArrowLeftRight,
  ArrowUp,
  Crop as CropIcon,
  Crosshair,
  Eraser,
  Film,
  Layers3,
  Lock,
  LockOpen,
  Maximize,
  Minimize,
  MoreHorizontal,
  Music,
  Plus,
  RectangleHorizontal,
  Replace,
  RotateCcw as ResetIcon,
  Shapes,
  Trash2,
  Type,
  WandSparkles,
} from 'lucide-react'
import { Color, Field, NumberField, NumberInput, Toggle } from './Controls'
import { Segmented } from './InspectorParts'
import { useGroups } from './inspectorHooks'
import { MenuButton, type MenuEntry } from './Menu'
import { Composition } from './Composition'
import { AnimatePanel } from './AnimatePanel'
import { MusicPanel } from './MusicPanel'
import {
  DEFAULT_PROJECT,
  FONT_NAMES,
  MAX_HOLD,
  TEMPLATES,
  applyTemplate,
  duration,
  frameCount,
  restTime,
  styleOf,
  type AudioTrack,
  type ChyronStyle,
  type ChyronStyleKey,
  type Effect,
  type Gradient,
  type ImageLayer,
  type ImageMask,
  type Layer,
  type Project,
  type ShapeKind as LayerShape,
  type ShapeLayer,
  type Template,
} from '../studio/model'
import { chyronStylePatch, fitWidth, updateLayer } from '../studio/layers'
import { useProjectImages } from '../studio/useImages'
import { cropToRatio, FULL_CROP, isCropped, SQUARE_MASKS, withCrop } from '../studio/crop'
import { maxVideoSeconds } from '../studio/export'
import { ShapeIcon } from '../designer/LeftPanel'
import { LINE, SHAPES, type ShapeKind } from '../designer/model'
import type { SavedPreset } from '../studio/useProject'
import type { TimingChange } from './Timeline'

export type PropertiesTab = 'design' | 'animate'
type Patch = (patch: Partial<Project>) => void
import { MUSIC } from './layerMenu'
export { MUSIC }

/* ---------- Panel ---------- */

export interface PropertiesProps {
  project: Project
  patch: Patch
  /** A layer id, MUSIC, or null for the composition. */
  selected: string | null
  onSelect: (id: string | null) => void
  tab: PropertiesTab
  onTab: (tab: PropertiesTab) => void
  previewPhase: (phase: 'intro' | 'outro', returnToRest?: boolean) => void
  presets: SavedPreset[]
  /** Restyle a chyron with a template or saved style. */
  onApplyTemplate: (id: string, template: Template) => void
  /** Save a chyron's style to the library. */
  onSavePreset: (name: string, id: string) => boolean
  onRemovePreset: (id: string) => void
  onTiming: (id: string, change: TimingChange) => void
  /** Show the composition's clip length (Hold) and frame rate. */
  onClipTiming?: () => void
  /** Every action for a layer or the music track, as in the timeline and on the canvas. */
  layerMenu: (id: string) => MenuEntry[]
  /** Start cropping an image layer on the canvas. */
  onCrop?: (id: string) => void
  onRemoveBackground?: (id: string) => void
  onReplaceImage?: (id: string) => void
  onReplaceMusic: () => void
  onRemoveMusic: () => void
  /** Cutting the music: the picked part and what to do with it. */
  musicPart?: string | null
  onMusicPart?: (id: string | null) => void
  onSplitMusic?: () => void
  canSplitMusic?: boolean
  onRemoveMusicPart?: (id: string) => void
  onJoinMusic?: () => void
}

export function Properties(props: PropertiesProps) {
  const { project: p, patch, selected, tab, onTab } = props
  const layer = p.layers.find((l) => l.id === selected)
  const music = selected === MUSIC && p.audio ? p.audio : null
  const images = useProjectImages(p)
  const setMusic = (values: Partial<AudioTrack>) =>
    p.audio && patch({ audio: { ...p.audio, ...values } })
  const tabs: { id: PropertiesTab; label: string }[] = [
    { id: 'design', label: 'Design' },
    { id: 'animate', label: 'Animate' },
  ]
  return (
    <aside className="inspector" aria-label="Properties">
      <header className="inspector-head">
        <span
          className={`inspector-icon ${layer?.kind === 'chyron' ? 'is-chyron' : ''} ${layer?.kind === 'shape' ? 'is-shape' : ''} ${music ? 'is-music' : ''}`}
          aria-hidden="true"
        >
          {music ? (
            <Music size={16} />
          ) : !layer ? (
            <Film size={16} />
          ) : layer.kind === 'chyron' ? (
            <Type size={16} />
          ) : layer.kind === 'shape' ? (
            <Shapes size={16} />
          ) : (
            <Thumb image={images.get(layer.assetId)} />
          )}
        </span>
        {layer || music ? (
          // The heading takes its name from the editable field inside it.
          <h2 className="inspector-title-heading">
            <input
              className="inspector-title-input"
              aria-label={music ? 'Music name' : 'Layer name'}
              value={music ? music.name : layer!.name}
              maxLength={80}
              onChange={(e) =>
                music
                  ? setMusic({ name: e.target.value })
                  : patch({ layers: updateLayer(p, layer!.id, { name: e.target.value }) })
              }
            />
          </h2>
        ) : (
          <h2 className="inspector-title">Composition</h2>
        )}
        {(layer || music) && (
          <MenuButton
            label={music ? 'Music actions' : 'Layer actions'}
            align="end"
            items={props.layerMenu(music ? MUSIC : layer!.id)}
          >
            <MoreHorizontal size={20} />
          </MenuButton>
        )}
      </header>
      {layer && (
        <div className="tabs" role="tablist" aria-label="Layer settings">
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
        className="inspector-body"
        id="props-panel"
        role={layer ? 'tabpanel' : 'region'}
        aria-labelledby={layer ? `props-tab-${tab}` : undefined}
        aria-label={layer ? undefined : music ? 'Music settings' : 'Composition settings'}
      >
        {music && (
          <MusicPanel
            project={p}
            track={music}
            onChange={setMusic}
            onReplace={props.onReplaceMusic}
            onRemove={props.onRemoveMusic}
            part={props.musicPart}
            onPart={props.onMusicPart}
            onSplit={props.onSplitMusic}
            canSplit={props.canSplitMusic}
            onRemovePart={props.onRemoveMusicPart}
            onJoin={props.onJoinMusic}
          />
        )}
        {!layer && !music && <CompositionSettings project={p} patch={patch} />}
        {layer && tab === 'animate' && (
          <AnimatePanel
            layer={layer}
            project={p}
            patch={patch}
            previewPhase={props.previewPhase}
            onTiming={props.onTiming}
            onClipTiming={props.onClipTiming}
          />
        )}
        {layer?.kind === 'chyron' && tab === 'design' && (
          <ChyronDesign
            key={layer.id}
            view={styleOf(p, layer)}
            setStyle={(values) => patch(chyronStylePatch(p, layer.id, values))}
            presets={props.presets}
            onApplyTemplate={(template) => props.onApplyTemplate(layer.id, template)}
            onSavePreset={(name) => props.onSavePreset(name, layer.id)}
            onRemovePreset={props.onRemovePreset}
          />
        )}
        {layer?.kind === 'image' && tab === 'design' && (
          <ImageDesign
            l={layer}
            p={p}
            patch={patch}
            onCrop={props.onCrop}
            onRemoveBackground={props.onRemoveBackground}
            onReplaceImage={props.onReplaceImage}
          />
        )}
        {layer?.kind === 'shape' && tab === 'design' && (
          <ShapeDesign l={layer} p={p} patch={patch} />
        )}
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
          {/* The video's length: in, hold and out. Typing a length sets the hold. */}
          <div data-clip-length className="contents">
            <NumberField
              label="Length"
              value={Math.round(total * 100) / 100}
              min={Math.round(p.animationDuration * 200) / 100}
              max={Math.round((p.animationDuration * 2 + MAX_HOLD) * 100) / 100}
              step={0.1}
              unit="s"
              onChange={(length) =>
                patch({
                  hold:
                    Math.round(
                      Math.max(0, Math.min(MAX_HOLD, length - p.animationDuration * 2)) * 100,
                    ) / 100,
                })
              }
            />
          </div>
          <NumberField
            label="Hold"
            value={p.hold}
            min={0}
            max={MAX_HOLD}
            step={0.1}
            unit="s"
            onChange={(hold) => patch({ hold })}
          />
          <NumberField
            label="Transition"
            value={p.animationDuration}
            min={0.2}
            max={4}
            step={0.1}
            unit="s"
            onChange={(animationDuration) => patch({ animationDuration })}
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
          <p className="block-note">
            Length is the transition in, the hold and the transition out; the hold goes up to{' '}
            {MAX_HOLD} s. At this size and frame rate, WebM videos can be up to {maxVideoSeconds(p)}{' '}
            s and ProRes {maxVideoSeconds(p, 'mov')} s; PNG sequences have no limit.
          </p>
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

/**
 * Lettering, colours and placement of one chyron. `p` is the chyron's own view
 * of the project and `patch` writes to wherever its style lives.
 */
function ChyronDesign({
  view: p,
  setStyle: patch,
  presets,
  onApplyTemplate,
  onSavePreset,
  onRemovePreset,
}: {
  view: ChyronStyle
  setStyle: (values: Partial<ChyronStyle>) => void
  presets: SavedPreset[]
  onApplyTemplate: (template: Template) => void
  onSavePreset: (name: string) => boolean
  onRemovePreset: (id: string) => void
}) {
  const group = useGroups()
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const r = (label: string, key: ChyronStyleKey, min: number, max: number, step = 1, unit = '') => (
    <NumberField
      label={label}
      value={p[key] as number}
      onChange={(v) => patch({ [key]: v })}
      {...{ min, max, step, unit }}
    />
  )
  const reset = (keys: ChyronStyleKey[]) => () =>
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
                  <button
                    className="saved-style"
                    onClick={() =>
                      onApplyTemplate({
                        id: preset.id,
                        name: preset.name,
                        caption: '',
                        background: '',
                        patch: preset.project,
                      })
                    }
                  >
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
            <button className="button secondary full" onClick={() => setSaving(true)}>
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
              data-title-input
              value={p.text}
              maxLength={160}
              rows={2}
              spellCheck={false}
              onChange={(e) => patch({ text: e.target.value })}
            />
          </Field>
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
            </>
          )}
        </>,
        reset(['text', 'subtitlePill', 'subtitle', 'subtitlePosition']),
      )}
      {p.subtitlePill &&
        group(
          'subtitle',
          'Subtitle style',
          `${p.subtitleSize}px · ${p.subtitleRadius}px corners`,
          <>
            <div className="color-grid">
              <Color
                label="Subtitle fill"
                value={p.accent}
                onChange={(accent) => patch({ accent })}
              />
              <Color
                label="Subtitle text color"
                value={p.subtitleColor}
                onChange={(subtitleColor) => patch({ subtitleColor })}
              />
            </div>
            {r('Subtitle size', 'subtitleSize', 12, 80, 1, 'px')}
            {r('Subtitle gap', 'subtitleGap', 0, 100, 1, 'px')}
            {r('Subtitle radius', 'subtitleRadius', 0, 50, 1, 'px')}
            {r('Horizontal padding', 'subtitlePaddingX', 0, 80, 1, 'px')}
            {r('Vertical padding', 'subtitlePaddingY', 0, 40, 1, 'px')}
          </>,
          reset([
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
                onChange={(e) => patch({ font: e.target.value as ChyronStyle['font'] })}
              >
                {FONT_NAMES.map((font) => (
                  <option key={font}>{font}</option>
                ))}
              </select>
            </Field>
            <Field label="Case">
              <select
                value={p.textCase}
                onChange={(e) => patch({ textCase: e.target.value as ChyronStyle['textCase'] })}
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

/* ---------- Images ---------- */

/** Image masks: the shapes of the shape pickers (the rectangle is no mask). */
const MASK_OPTIONS: { id: ImageMask; name: string; kind: ShapeKind; sides?: number }[] = SHAPES.map(
  ({ id, name, kind, sides }) => ({
    id: id === 'rect' ? 'none' : (id as ImageMask),
    name,
    kind,
    sides,
  }),
)

function ImageDesign({
  l,
  p,
  patch,
  onCrop,
  onRemoveBackground,
  onReplaceImage,
}: {
  l: ImageLayer
  p: Project
  patch: Patch
  onCrop?: (id: string) => void
  onRemoveBackground?: (id: string) => void
  onReplaceImage?: (id: string) => void
}) {
  const [squared, setSquared] = useState(false)
  const setMask = (mask: ImageMask) => {
    // Round shapes on a wide or tall picture would stretch; frame a square first.
    const ratio = 1 / l.aspect
    const square = SQUARE_MASKS.includes(mask) && Math.abs(ratio - 1) > 0.02
    setSquared(square)
    set({ mask, ...(square ? withCrop(l, cropToRatio(l, 1), p) : {}) })
  }
  const maskName = MASK_OPTIONS.find((m) => m.id === l.mask)?.name ?? 'Rectangle'
  const group = useGroups()
  const set = (values: Partial<ImageLayer>) =>
    patch({ layers: updateLayer(p, l.id, values as Partial<Layer>) })
  const r = (
    label: string,
    key: keyof ImageLayer,
    min: number,
    max: number,
    step = 1,
    unit = '',
  ) => (
    <NumberField
      label={label}
      value={Math.min(max, l[key] as number)}
      onChange={(v) => set({ [key]: v })}
      {...{ min, max, step, unit }}
    />
  )
  return (
    <>
      {/* The picture's own tools, each with its name: what a new image needs first. */}
      <div
        className="picture-actions chip-grid quick picture-tools"
        role="group"
        aria-label="Picture"
      >
        {onCrop && (
          <button onClick={() => onCrop(l.id)} title="Crop (C) · or double-click the image">
            <CropIcon size={18} aria-hidden="true" />
            <span>Crop</span>
          </button>
        )}
        {onRemoveBackground && (
          <button
            onClick={() => onRemoveBackground(l.id)}
            title="Cut out the subject, or remove a colour. Runs on this device."
          >
            <WandSparkles size={18} aria-hidden="true" />
            <span>Remove background</span>
          </button>
        )}
        {onReplaceImage && (
          <button
            aria-label="Replace image"
            title="Pick another picture; size, frame and animation stay"
            onClick={() => onReplaceImage(l.id)}
          >
            <Replace size={18} aria-hidden="true" />
            <span>Replace</span>
          </button>
        )}
      </div>
      {l.originalAssetId && (
        <div className="picture-note">
          <Eraser size={14} aria-hidden="true" />
          <span>Background removed</span>
          <button
            className="button ghost sm"
            onClick={() => set({ assetId: l.originalAssetId, originalAssetId: undefined })}
          >
            Restore original
          </button>
        </div>
      )}
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
        'Shape & frame',
        [
          l.mask !== 'none' ? maskName : l.radius ? `${l.radius}% round` : '',
          isCropped(l) ? 'Cropped' : '',
          l.shadow ? `${l.shadow}px shadow` : '',
        ]
          .filter(Boolean)
          .join(' · '),
        <>
          <div className="mask-picker" role="group" aria-label="Image shape">
            {MASK_OPTIONS.map((m) => (
              <button
                key={m.id}
                className={l.mask === m.id ? 'active' : ''}
                aria-pressed={l.mask === m.id}
                aria-label={m.name}
                title={m.name}
                onClick={() => setMask(m.id)}
              >
                <ShapeIcon preset={{ kind: m.kind, name: m.name, sides: m.sides }} size={20} />
              </button>
            ))}
          </div>
          {squared && (
            <p className="field-hint">
              Cropped to a square so the shape stays even. Use Crop to reframe.
            </p>
          )}
          <div className="button-row">
            {isCropped(l) && (
              <button
                className="button ghost sm"
                onClick={() => {
                  setSquared(false)
                  set(withCrop(l, FULL_CROP, p))
                }}
              >
                <ResetIcon size={14} aria-hidden="true" /> Show whole image
              </button>
            )}
          </div>
          {l.mask === 'none' && r('Round corners', 'radius', 0, 50, 1, '%')}
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
        () => set({ radius: 0, border: 0, shadow: 0, mask: 'none' }),
      )}
      {group(
        'adjust',
        'Adjustments',
        l.brightness !== 100 || l.contrast !== 100 || l.saturation !== 100 ? 'Edited' : '',
        <>
          {r('Brightness', 'brightness', 0, 200, 1, '%')}
          {r('Contrast', 'contrast', 0, 200, 1, '%')}
          {r('Saturation', 'saturation', 0, 300, 1, '%')}
        </>,
        l.brightness !== 100 || l.contrast !== 100 || l.saturation !== 100
          ? () => set({ brightness: 100, contrast: 100, saturation: 100 })
          : undefined,
      )}
    </>
  )
}

/* ---------- Shapes ---------- */

const SHAPE_OPTIONS: {
  id: LayerShape
  name: string
  kind: ShapeKind
  sides?: number
  radius?: number
}[] = [
  // The same shapes, names, order and icons as the Designer.
  ...SHAPES.map(({ id, name, kind, sides }) => ({ id, name, kind, sides })),
  { id: LINE.id, name: LINE.name, kind: LINE.kind },
]

function ShapeDesign({ l, p, patch }: { l: ShapeLayer; p: Project; patch: Patch }) {
  const group = useGroups()
  const set = (values: Partial<ShapeLayer>) =>
    patch({ layers: updateLayer(p, l.id, values as Partial<Layer>) })
  const r = (
    label: string,
    key: keyof ShapeLayer,
    min: number,
    max: number,
    step = 1,
    unit = '',
  ) => (
    <NumberField
      label={label}
      value={Math.min(max, l[key] as number)}
      onChange={(v) => set({ [key]: v })}
      {...{ min, max, step, unit }}
    />
  )
  const round = (v: number) => Math.round(v * 10) / 10
  // Height as a share of the canvas height.
  const heightPercent = round(((l.width / 100) * p.width * l.aspect * 100) / p.height)
  const name = SHAPE_OPTIONS.find((s) => s.id === l.shape)?.name ?? 'Shape'
  return (
    <>
      {group(
        'shape-fill',
        'Shape & fill',
        `${name} · ${l.gradient === 'none' ? l.fill.toUpperCase() : `${l.gradient} gradient`}`,
        <>
          <div className="mask-picker" role="group" aria-label="Shape">
            {SHAPE_OPTIONS.map((m) => (
              <button
                key={m.id}
                className={l.shape === m.id ? 'active' : ''}
                aria-pressed={l.shape === m.id}
                aria-label={m.name}
                title={m.name}
                onClick={() => set({ shape: m.id })}
              >
                <ShapeIcon
                  preset={{ kind: m.kind, name: m.name, sides: m.sides, radius: m.radius }}
                  size={20}
                />
              </button>
            ))}
          </div>
          <Segmented
            label="Fill"
            value={l.gradient}
            onChange={(gradient: Gradient) => set({ gradient })}
            items={[
              { id: 'none', name: 'Solid' },
              { id: 'linear', name: 'Linear' },
              { id: 'radial', name: 'Radial' },
            ]}
          />
          <div className="color-grid">
            <Color
              label={l.gradient === 'none' ? 'Fill' : 'From'}
              value={l.fill}
              onChange={(fill) => set({ fill })}
            />
            {l.gradient !== 'none' && (
              <Color label="To" value={l.fill2} onChange={(fill2) => set({ fill2 })} />
            )}
          </div>
          {l.gradient === 'linear' && r('Angle', 'gradientAngle', -180, 180, 1, '°')}
        </>,
        () => set({ gradient: 'none', fill: '#3e75f3', fill2: '#9075fc', gradientAngle: 0 }),
      )}
      {group(
        'place',
        'Position',
        `${round(l.width)}% × ${heightPercent}% · ${l.rotation}°`,
        <>
          <div className="chip-grid quick" role="group" aria-label="Quick placement">
            <button
              onClick={() =>
                set({
                  width: 90,
                  aspect: (0.12 * p.height) / (0.9 * p.width),
                  x: 50,
                  y: 82,
                  rotation: 0,
                })
              }
            >
              <RectangleHorizontal size={18} aria-hidden="true" />
              <span>Lower bar</span>
            </button>
            <button
              onClick={() =>
                set({ width: 100, aspect: p.height / p.width, x: 50, y: 50, rotation: 0 })
              }
            >
              <Maximize size={18} aria-hidden="true" />
              <span>Fill</span>
            </button>
            <button onClick={() => set({ x: 50, y: 50 })}>
              <Crosshair size={18} aria-hidden="true" />
              <span>Center</span>
            </button>
            <button onClick={() => set({ aspect: 1 })}>
              <Minimize size={18} aria-hidden="true" />
              <span>Square</span>
            </button>
          </div>
          <div className="pair-fields">
            <Field label="Width (%)">
              <NumberInput
                value={round(l.width)}
                min={2}
                max={400}
                step={0.5}
                onChange={(width) => set({ width })}
              />
            </Field>
            <Field label="Height (%)">
              <NumberInput
                value={heightPercent}
                min={0.5}
                max={400}
                step={0.5}
                onChange={(h) =>
                  set({
                    aspect: Math.min(100, Math.max(0.01, (h * p.height) / (l.width * p.width))),
                  })
                }
              />
            </Field>
          </div>
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
        'Corners, border & shadow',
        [
          l.shape === 'rect' && l.radius ? `${l.radius}% round` : '',
          l.border ? `${l.border}px border` : '',
          l.shadow ? `${l.shadow}px shadow` : '',
        ]
          .filter(Boolean)
          .join(' · '),
        <>
          {l.shape === 'rect' && r('Round corners', 'radius', 0, 50, 1, '%')}
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
