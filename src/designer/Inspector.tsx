import { useState } from 'react'
import {
  AlignCenterHorizontal,
  AlignCenterVertical,
  AlignEndHorizontal,
  AlignEndVertical,
  AlignHorizontalDistributeCenter,
  AlignStartHorizontal,
  AlignStartVertical,
  AlignVerticalDistributeCenter,
  ArrowLeftRight,
  Circle,
  Copy,
  Crop as CropIcon,
  FlipHorizontal2,
  FlipVertical2,
  Frame,
  Image as ImageIcon,
  Italic,
  Link,
  Unlink,
  MoreHorizontal,
  Replace,
  RotateCcw,
  Square,
  Trash2,
  Type,
  ChevronsUp,
  ChevronsDown,
  ChevronUp,
  ChevronDown,
  Layers as LayersIcon,
  CaseUpper,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Check,
  X,
  Maximize2,
  Upload,
  FolderOpen,
} from 'lucide-react'
import { Color, Field, NumberField, Section, Toggle } from '../components/Controls'
import { MenuButton, type MenuEntry } from '../components/Menu'
import {
  ARTBOARD_PRESETS,
  CROP_RATIOS,
  BLEND_MODES,
  DEFAULT_FILTERS,
  FONTS,
  SHAPES,
  isShape,
  type BlendMode,
  type DesignDoc,
  type ImageLayer,
  type Layer,
  type ShapeLayer,
  type TextLayer,
} from './model'
import type { Align } from './ops'
import { maskBaseOf } from './render'
import { ShapeIcon } from './LeftPanel'

export interface InspectorActions {
  /** Live edit of the selection; consecutive edits merge into one undo step. */
  update: (values: Partial<Layer> | ((l: Layer) => Partial<Layer>)) => void
  updateDoc: (values: Partial<DesignDoc>) => void
  align: (how: Align) => void
  distribute: (axis: 'x' | 'y') => void
  duplicate: () => void
  remove: () => void
  reorder: (dir: 1 | -1 | 'front' | 'back') => void
  startCrop: () => void
  applyCrop: () => void
  cancelCrop: () => void
  resetCrop: () => void
  setCropRatio: (id: string) => void
  maskWith: (presetName: string) => void
  updateLayer: (id: string, values: Partial<Layer>) => void
  select: (ids: string[]) => void
  releaseAll: (baseId: string) => void
  fitToMask: (id: string) => void
  fillFrame: (frameId: string, source: 'upload' | 'gallery') => void
  replaceImage: () => void
  fitToArtboard: (mode: 'fit' | 'fill') => void
}

function Segmented<T extends string>({
  label,
  items,
  value,
  onChange,
}: {
  label: string
  items: { id: T; name: string; Icon?: typeof Type }[]
  value: T
  onChange: (v: T) => void
}) {
  return (
    <div className="segmented" role="group" aria-label={label}>
      {items.map(({ id, name, Icon }) => (
        <button
          key={id}
          className={value === id ? 'active' : ''}
          aria-pressed={value === id}
          aria-label={Icon ? name : undefined}
          title={Icon ? name : undefined}
          onClick={() => onChange(id)}
        >
          {Icon ? <Icon size={16} aria-hidden="true" /> : name}
        </button>
      ))}
    </div>
  )
}

function AlignBar({ actions, multi }: { actions: InspectorActions; multi: boolean }) {
  const items: { id: Align; label: string; Icon: typeof Type }[] = [
    { id: 'left', label: 'Align left', Icon: AlignStartVertical },
    { id: 'hcenter', label: 'Align horizontal centers', Icon: AlignCenterVertical },
    { id: 'right', label: 'Align right', Icon: AlignEndVertical },
    { id: 'top', label: 'Align top', Icon: AlignStartHorizontal },
    { id: 'vcenter', label: 'Align vertical centers', Icon: AlignCenterHorizontal },
    { id: 'bottom', label: 'Align bottom', Icon: AlignEndHorizontal },
  ]
  return (
    <div
      className="dz-align-bar"
      role="toolbar"
      aria-label={multi ? 'Align selection' : 'Align to artboard'}
    >
      {items.map(({ id, label, Icon }) => (
        <button
          key={id}
          className="icon-button"
          aria-label={label}
          title={label}
          onClick={() => actions.align(id)}
        >
          <Icon size={18} />
        </button>
      ))}
      {multi && (
        <>
          <span className="dz-align-sep" aria-hidden="true" />
          <button
            className="icon-button"
            aria-label="Distribute horizontally"
            title="Distribute horizontal spacing (3+ layers)"
            onClick={() => actions.distribute('x')}
          >
            <AlignHorizontalDistributeCenter size={18} />
          </button>
          <button
            className="icon-button"
            aria-label="Distribute vertically"
            title="Distribute vertical spacing (3+ layers)"
            onClick={() => actions.distribute('y')}
          >
            <AlignVerticalDistributeCenter size={18} />
          </button>
        </>
      )}
    </div>
  )
}

function useOpen(initial: Record<string, boolean>) {
  const [open, setOpen] = useState(initial)
  return [open, (k: string) => setOpen((o) => ({ ...o, [k]: !(o[k] ?? false) }))] as const
}

/* ---------- Artboard ---------- */

function ArtboardPanel({ doc, actions }: { doc: DesignDoc; actions: InspectorActions }) {
  const [open, toggle] = useOpen({ size: true, fill: true, grid: true })
  const preset = ARTBOARD_PRESETS.find((p) => p.width === doc.width && p.height === doc.height)
  return (
    <>
      <Section
        title="Artboard"
        summary={`${doc.width} × ${doc.height}`}
        open={open.size}
        onToggle={() => toggle('size')}
      >
        <Field label="Preset">
          <select
            value={preset?.id ?? 'custom'}
            onChange={(e) => {
              const p = ARTBOARD_PRESETS.find((x) => x.id === e.target.value)
              if (p) actions.updateDoc({ width: p.width, height: p.height })
            }}
          >
            {ARTBOARD_PRESETS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} · {p.width} × {p.height}
              </option>
            ))}
            {!preset && <option value="custom">Custom</option>}
          </select>
        </Field>
        <div className="dz-size-row">
          <NumberField
            label="W"
            value={doc.width}
            min={16}
            max={8000}
            unit="px"
            onChange={(width) => actions.updateDoc({ width })}
          />
          <NumberField
            label="H"
            value={doc.height}
            min={16}
            max={8000}
            unit="px"
            onChange={(height) => actions.updateDoc({ height })}
          />
          <button
            className="icon-button"
            aria-label="Swap width and height"
            title="Swap orientation"
            onClick={() => actions.updateDoc({ width: doc.height, height: doc.width })}
          >
            <ArrowLeftRight size={16} />
          </button>
        </div>
      </Section>
      <Section
        title="Background"
        summary={doc.transparent ? 'Transparent' : doc.background.toUpperCase()}
        open={open.fill}
        onToggle={() => toggle('fill')}
      >
        <Toggle
          label="Transparent"
          hint="PNG and WebP exports keep the alpha channel."
          checked={doc.transparent}
          onChange={(transparent) => actions.updateDoc({ transparent })}
        />
        {!doc.transparent && (
          <Color
            label="Color"
            value={doc.background}
            onChange={(background) => actions.updateDoc({ background })}
          />
        )}
      </Section>
      <Section
        title="Grid & snapping"
        summary={doc.grid.show ? `${doc.grid.size} px grid` : 'Grid hidden'}
        open={open.grid}
        onToggle={() => toggle('grid')}
      >
        <Toggle
          label="Show grid"
          checked={doc.grid.show}
          onChange={(show) => actions.updateDoc({ grid: { ...doc.grid, show } })}
        />
        <NumberField
          label="Grid size"
          value={doc.grid.size}
          min={2}
          max={500}
          unit="px"
          onChange={(size) => actions.updateDoc({ grid: { ...doc.grid, size } })}
        />
        <Toggle
          label="Snap to grid"
          checked={doc.grid.snapToGrid}
          onChange={(snapToGrid) => actions.updateDoc({ grid: { ...doc.grid, snapToGrid } })}
        />
        <Toggle
          label="Snap to objects"
          hint="Edges and centers of layers and the artboard. Hold Alt to drag freely."
          checked={doc.grid.snapToObjects}
          onChange={(snapToObjects) => actions.updateDoc({ grid: { ...doc.grid, snapToObjects } })}
        />
      </Section>
    </>
  )
}

/* ---------- Layer sections ---------- */

function LayoutSection({
  l,
  actions,
  open,
  toggle,
}: {
  l: Layer
  actions: InspectorActions
  open: boolean
  toggle: () => void
}) {
  const [ratioLock, setRatioLock] = useState(l.kind === 'image')
  const ratio = l.w / l.h
  return (
    <Section
      title="Layout"
      summary={`${Math.round(l.w)} × ${Math.round(l.h)}`}
      open={open}
      onToggle={toggle}
    >
      <div className="pair-fields">
        <NumberField
          label="X"
          value={Math.round(l.x * 10) / 10}
          min={-20000}
          max={20000}
          onChange={(x) => actions.update({ x })}
        />
        <NumberField
          label="Y"
          value={Math.round(l.y * 10) / 10}
          min={-20000}
          max={20000}
          onChange={(y) => actions.update({ y })}
        />
      </div>
      <div className="dz-size-row">
        <NumberField
          label="W"
          value={Math.round(l.w * 10) / 10}
          min={1}
          max={20000}
          onChange={(w) =>
            actions.update(
              l.kind === 'text' ? { w } : ratioLock ? { w, h: Math.max(1, w / ratio) } : { w },
            )
          }
        />
        <NumberField
          label="H"
          value={Math.round(l.h * 10) / 10}
          min={1}
          max={20000}
          onChange={(h) => {
            if (l.kind === 'text') return
            actions.update(ratioLock ? { h, w: Math.max(1, h * ratio) } : { h })
          }}
        />
        <button
          className={`icon-button ${ratioLock ? 'selected' : ''}`}
          aria-label="Lock aspect ratio"
          aria-pressed={ratioLock}
          title={ratioLock ? 'Unlock aspect ratio' : 'Lock aspect ratio'}
          onClick={() => setRatioLock(!ratioLock)}
        >
          {ratioLock ? <Link size={16} /> : <Unlink size={16} />}
        </button>
      </div>
      <div className="dz-size-row">
        <NumberField
          label="Rotation"
          value={l.rotation}
          min={-180}
          max={180}
          step={1}
          unit="°"
          onChange={(rotation) => actions.update({ rotation })}
        />
        <button
          className={`icon-button ${l.flipX ? 'selected' : ''}`}
          aria-label="Flip horizontal"
          aria-pressed={l.flipX}
          title="Flip horizontal (Shift H)"
          onClick={() => actions.update({ flipX: !l.flipX })}
        >
          <FlipHorizontal2 size={16} />
        </button>
        <button
          className={`icon-button ${l.flipY ? 'selected' : ''}`}
          aria-label="Flip vertical"
          aria-pressed={l.flipY}
          title="Flip vertical (Shift V)"
          onClick={() => actions.update({ flipY: !l.flipY })}
        >
          <FlipVertical2 size={16} />
        </button>
      </div>
      {l.kind === 'image' && (
        <div className="dz-button-row">
          <button className="button secondary sm" onClick={() => actions.fitToArtboard('fit')}>
            Fit artboard
          </button>
          <button className="button secondary sm" onClick={() => actions.fitToArtboard('fill')}>
            Fill artboard
          </button>
        </div>
      )}
    </Section>
  )
}

function LayerSection({
  l,
  doc,
  actions,
  open,
  toggle,
}: {
  l: Layer
  doc: DesignDoc
  actions: InspectorActions
  open: boolean
  toggle: () => void
}) {
  void doc
  return (
    <Section
      title="Layer"
      summary={`${l.opacity}% · ${BLEND_MODES.find((b) => b.id === l.blend)?.name}`}
      open={open}
      onToggle={toggle}
    >
      <NumberField
        label="Opacity"
        value={l.opacity}
        min={0}
        max={100}
        unit="%"
        onChange={(opacity) => actions.update({ opacity })}
      />
      <Field label="Blend mode">
        <select
          value={l.blend}
          onChange={(e) => actions.update({ blend: e.target.value as BlendMode })}
        >
          {BLEND_MODES.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      </Field>
    </Section>
  )
}

/* ---------- Mask ---------- */

function MaskControls({ base, actions }: { base: Layer; actions: InspectorActions }) {
  const up = (v: Partial<Layer>) => actions.updateLayer(base.id, v)
  return (
    <>
      <Toggle
        label="Hide mask shape"
        hint="Show only what's inside. Off: the shape stays visible behind its contents."
        checked={!!base.maskOnly}
        onChange={(maskOnly) => up({ maskOnly, autoMask: false })}
      />
      {base.maskOnly && (
        <>
          <Toggle
            label="Invert"
            hint="Show the contents outside the shape instead."
            checked={!!base.maskInvert}
            onChange={(maskInvert) => up({ maskInvert })}
          />
          <NumberField
            label="Feather"
            value={base.maskFeather ?? 0}
            min={0}
            max={200}
            unit="px"
            onChange={(maskFeather) => up({ maskFeather })}
          />
        </>
      )}
    </>
  )
}

function MaskSection({
  l,
  doc,
  actions,
  open,
  toggle,
}: {
  l: Layer
  doc: DesignDoc
  actions: InspectorActions
  open: boolean
  toggle: () => void
}) {
  const index = doc.layers.findIndex((x) => x.id === l.id)
  const below = doc.layers[index - 1]
  const base = l.clip ? maskBaseOf(doc.layers, l.id) : null
  const contents: Layer[] = []
  if (!l.clip) for (let j = index + 1; doc.layers[j]?.clip; j++) contents.push(doc.layers[j])
  const frame = !l.clip && !!l.maskOnly && isShape(l)

  let summary = 'None'
  if (base) summary = `Inside ${base.name}`
  else if (frame && !contents.length) summary = 'Empty frame'
  else if (contents.length)
    summary = `Masks ${contents.length} layer${contents.length > 1 ? 's' : ''}`

  return (
    <Section title="Mask" summary={summary} open={open} onToggle={toggle}>
      {base ? (
        <>
          <div className="dz-mask-card">
            <span className="dz-mask-card-icon" aria-hidden="true">
              {isShape(base) ? (
                <ShapeIcon preset={presetOf(base)} size={20} />
              ) : (
                <LayersIcon size={16} />
              )}
            </span>
            <span>
              <strong>{base.name}</strong>
              <small>This layer only shows inside it.</small>
            </span>
          </div>
          <div className="dz-button-row">
            <button className="button secondary sm" onClick={() => actions.select([base.id])}>
              Select mask
            </button>
            <button className="button secondary sm" onClick={() => actions.fitToMask(l.id)}>
              <Maximize2 size={14} aria-hidden="true" /> Fit to mask
            </button>
            <button className="button ghost sm" onClick={() => actions.update({ clip: false })}>
              <Unlink size={14} aria-hidden="true" /> Release
            </button>
          </div>
          <MaskControls base={base} actions={actions} />
        </>
      ) : frame && !contents.length ? (
        <>
          <p className="field-hint">
            This frame is waiting for a picture. Drop a photo on it, drag an image layer onto it, or
            choose one:
          </p>
          <div className="dz-button-row">
            <button className="button primary sm" onClick={() => actions.fillFrame(l.id, 'upload')}>
              <Upload size={14} aria-hidden="true" /> Upload image
            </button>
            <button
              className="button secondary sm"
              onClick={() => actions.fillFrame(l.id, 'gallery')}
            >
              <FolderOpen size={14} aria-hidden="true" /> Media gallery
            </button>
          </div>
        </>
      ) : contents.length ? (
        <>
          <div className="dz-button-row">
            <button
              className="button secondary sm"
              onClick={() => actions.select(contents.map((c) => c.id))}
            >
              Select contents
            </button>
            {frame && (
              <button
                className="button secondary sm"
                onClick={() => actions.fillFrame(l.id, 'upload')}
              >
                <Replace size={14} aria-hidden="true" /> Replace picture
              </button>
            )}
            <button className="button ghost sm" onClick={() => actions.releaseAll(l.id)}>
              <Unlink size={14} aria-hidden="true" /> Release all
            </button>
          </div>
          <MaskControls base={l} actions={actions} />
        </>
      ) : (
        <>
          <div className="dz-mask-row">
            <span className="field-label">Mask with a shape</span>
            <div className="dz-mask-shapes" role="group" aria-label="Mask shapes">
              {SHAPES.map((p) => (
                <button
                  key={p.name}
                  className="dz-shape-tile is-compact"
                  title={`Mask with ${p.name.toLowerCase()}`}
                  aria-label={`Mask with ${p.name.toLowerCase()}`}
                  onClick={() => actions.maskWith(p.name)}
                >
                  <ShapeIcon preset={p} size={20} />
                </button>
              ))}
            </div>
            <span className="field-hint">
              Adds an editable shape under this layer. Or drag the layer onto another one in Layers.
            </span>
          </div>
          <Toggle
            label="Clip to layer below"
            hint={
              below
                ? `Show this layer only inside “${below.name}”. ⌥⌘G`
                : 'Needs a layer below to act as the mask.'
            }
            checked={false}
            onChange={(clip) => (below ? actions.update({ clip }) : undefined)}
          />
        </>
      )}
    </Section>
  )
}

function presetOf(l: ShapeLayer) {
  return (
    SHAPES.find((p) => p.kind === l.kind && (l.kind !== 'rect' || !!p.radius === l.radius > 0)) ??
    SHAPES[0]
  )
}

function TextSection({
  l,
  actions,
  open,
  toggle,
}: {
  l: TextLayer
  actions: InspectorActions
  open: boolean
  toggle: () => void
}) {
  const up = (v: Partial<TextLayer>) => actions.update(v as Partial<Layer>)
  return (
    <Section title="Text" summary={`${l.font} · ${l.size}`} open={open} onToggle={toggle}>
      <Field label="Content" hint="Or double-click the text on the artboard.">
        <textarea rows={3} value={l.text} onChange={(e) => up({ text: e.target.value })} />
      </Field>
      <Field label="Font">
        <select value={l.font} onChange={(e) => up({ font: e.target.value })}>
          {FONTS.map((f) => (
            <option key={f} value={f} style={{ fontFamily: f }}>
              {f}
            </option>
          ))}
        </select>
      </Field>
      <div className="pair-fields">
        <Field label="Weight">
          <select value={l.weight} onChange={(e) => up({ weight: Number(e.target.value) })}>
            {[300, 400, 500, 600, 700, 800, 900].map((w) => (
              <option key={w} value={w}>
                {
                  {
                    300: 'Light',
                    400: 'Regular',
                    500: 'Medium',
                    600: 'Semibold',
                    700: 'Bold',
                    800: 'Extra bold',
                    900: 'Black',
                  }[w]
                }
              </option>
            ))}
          </select>
        </Field>
        <NumberField
          label="Size"
          value={l.size}
          min={4}
          max={1000}
          unit="px"
          onChange={(size) => up({ size })}
        />
      </div>
      <div className="pair-fields">
        <NumberField
          label="Line height"
          value={l.lineHeight}
          min={0.5}
          max={4}
          step={0.05}
          onChange={(lineHeight) => up({ lineHeight })}
        />
        <NumberField
          label="Letter spacing"
          value={l.letterSpacing}
          min={-50}
          max={200}
          step={0.5}
          unit="px"
          onChange={(letterSpacing) => up({ letterSpacing })}
        />
      </div>
      <div className="dz-size-row">
        <Segmented
          label="Text alignment"
          value={l.align}
          onChange={(align) => up({ align })}
          items={[
            { id: 'left', name: 'Align left', Icon: AlignLeft },
            { id: 'center', name: 'Align center', Icon: AlignCenter },
            { id: 'right', name: 'Align right', Icon: AlignRight },
          ]}
        />
        <button
          className={`icon-button ${l.italic ? 'selected' : ''}`}
          aria-label="Italic"
          aria-pressed={l.italic}
          title="Italic"
          onClick={() => up({ italic: !l.italic })}
        >
          <Italic size={16} />
        </button>
        <button
          className={`icon-button ${l.uppercase ? 'selected' : ''}`}
          aria-label="Uppercase"
          aria-pressed={l.uppercase}
          title="Uppercase"
          onClick={() => up({ uppercase: !l.uppercase })}
        >
          <CaseUpper size={16} />
        </button>
      </div>
      <Color label="Color" value={l.color} onChange={(color) => up({ color })} />
    </Section>
  )
}

function ShapeSection({
  l,
  actions,
  open,
  toggle,
}: {
  l: ShapeLayer
  actions: InspectorActions
  open: boolean
  toggle: () => void
}) {
  const up = (v: Partial<ShapeLayer>) => actions.update(v as Partial<Layer>)
  return (
    <Section
      title="Fill & stroke"
      summary={l.fillEnabled ? l.fill.toUpperCase() : 'No fill'}
      open={open}
      onToggle={toggle}
    >
      <Toggle
        label="Fill"
        checked={l.fillEnabled}
        onChange={(fillEnabled) => up({ fillEnabled })}
      />
      {l.fillEnabled && (
        <Color label="Fill color" value={l.fill} onChange={(fill) => up({ fill })} />
      )}
      <NumberField
        label="Stroke width"
        value={l.strokeWidth}
        min={0}
        max={500}
        unit="px"
        onChange={(strokeWidth) => up({ strokeWidth })}
      />
      {l.strokeWidth > 0 && (
        <Color label="Stroke color" value={l.stroke} onChange={(stroke) => up({ stroke })} />
      )}
      {l.kind === 'polygon' && (
        <NumberField
          label="Sides"
          value={l.sides}
          min={3}
          max={24}
          onChange={(sides) => up({ sides })}
        />
      )}
      {l.kind === 'star' && (
        <div className="pair-fields">
          <NumberField
            label="Points"
            value={l.points}
            min={3}
            max={24}
            onChange={(points) => up({ points })}
          />
          <NumberField
            label="Inner radius"
            value={Math.round(l.inner * 100)}
            min={10}
            max={95}
            unit="%"
            onChange={(v) => up({ inner: v / 100 })}
          />
        </div>
      )}
      {l.kind === 'rect' && (
        <NumberField
          label="Corner radius"
          value={l.radius}
          min={0}
          max={Math.round(Math.min(l.w, l.h) / 2)}
          unit="px"
          onChange={(radius) => up({ radius })}
        />
      )}
    </Section>
  )
}

function ImageSection({
  l,
  actions,
  open,
  toggle,
}: {
  l: ImageLayer
  actions: InspectorActions
  open: boolean
  toggle: () => void
}) {
  const up = (v: Partial<ImageLayer>) => actions.update(v as Partial<Layer>)
  const cropped =
    l.crop.x > 0.5 || l.crop.y > 0.5 || l.crop.w < l.naturalW - 0.5 || l.crop.h < l.naturalH - 0.5
  return (
    <Section
      title="Image"
      summary={`${l.naturalW} × ${l.naturalH}${cropped ? ' · cropped' : ''}`}
      open={open}
      onToggle={toggle}
    >
      <div className="dz-button-row">
        <button
          className="button secondary sm"
          onClick={actions.startCrop}
          title="Crop (C or double-click)"
        >
          <CropIcon size={14} aria-hidden="true" /> Crop
        </button>
        <button className="button secondary sm" onClick={actions.replaceImage}>
          <Replace size={14} aria-hidden="true" /> Replace
        </button>
        {cropped && (
          <button className="button ghost sm" onClick={actions.resetCrop}>
            <RotateCcw size={14} aria-hidden="true" /> Reset crop
          </button>
        )}
      </div>
      <NumberField
        label="Corner radius"
        value={l.radius}
        min={0}
        max={Math.round(Math.min(l.w, l.h) / 2)}
        unit="px"
        onChange={(radius) => up({ radius })}
      />
      <NumberField
        label="Border"
        value={l.strokeWidth}
        min={0}
        max={200}
        unit="px"
        onChange={(strokeWidth) => up({ strokeWidth })}
      />
      {l.strokeWidth > 0 && (
        <Color label="Border color" value={l.stroke} onChange={(stroke) => up({ stroke })} />
      )}
    </Section>
  )
}

function AdjustSection({
  l,
  actions,
  open,
  toggle,
}: {
  l: ImageLayer
  actions: InspectorActions
  open: boolean
  toggle: () => void
}) {
  const f = l.filters
  const set = (k: keyof typeof f) => (v: number) =>
    actions.update({ filters: { ...f, [k]: v } } as Partial<Layer>)
  const changed = (Object.keys(DEFAULT_FILTERS) as (keyof typeof f)[]).some(
    (k) => f[k] !== DEFAULT_FILTERS[k],
  )
  return (
    <Section
      title="Adjustments"
      summary={changed ? 'Edited' : 'Original'}
      open={open}
      onToggle={toggle}
      onReset={
        changed
          ? () => actions.update({ filters: { ...DEFAULT_FILTERS } } as Partial<Layer>)
          : undefined
      }
    >
      <NumberField
        label="Brightness"
        value={f.brightness}
        min={0}
        max={200}
        unit="%"
        onChange={set('brightness')}
      />
      <NumberField
        label="Contrast"
        value={f.contrast}
        min={0}
        max={200}
        unit="%"
        onChange={set('contrast')}
      />
      <NumberField
        label="Saturation"
        value={f.saturation}
        min={0}
        max={300}
        unit="%"
        onChange={set('saturation')}
      />
      <NumberField
        label="Grayscale"
        value={f.grayscale}
        min={0}
        max={100}
        unit="%"
        onChange={set('grayscale')}
      />
      <NumberField label="Hue" value={f.hue} min={-180} max={180} unit="°" onChange={set('hue')} />
      <NumberField
        label="Blur"
        value={f.blur}
        min={0}
        max={100}
        step={0.5}
        unit="px"
        onChange={set('blur')}
      />
    </Section>
  )
}

function ShadowSection({
  l,
  actions,
  open,
  toggle,
}: {
  l: Layer
  actions: InspectorActions
  open: boolean
  toggle: () => void
}) {
  const s = l.shadow
  const set = (v: Partial<typeof s>) => actions.update({ shadow: { ...s, ...v } })
  return (
    <Section
      title="Drop shadow"
      summary={s.enabled ? `${s.blur}px blur` : 'Off'}
      open={open}
      onToggle={toggle}
    >
      <Toggle
        label="Shadow"
        hint="Follows transparent edges and glyphs."
        checked={s.enabled}
        onChange={(enabled) => set({ enabled })}
      />
      {s.enabled && (
        <>
          <Color label="Color" value={s.color} onChange={(color) => set({ color })} />
          <div className="pair-fields">
            <NumberField
              label="Opacity"
              value={s.opacity}
              min={0}
              max={100}
              unit="%"
              onChange={(opacity) => set({ opacity })}
            />
            <NumberField
              label="Blur"
              value={s.blur}
              min={0}
              max={300}
              unit="px"
              onChange={(blur) => set({ blur })}
            />
          </div>
          <div className="pair-fields">
            <NumberField
              label="X"
              value={s.x}
              min={-500}
              max={500}
              unit="px"
              onChange={(x) => set({ x })}
            />
            <NumberField
              label="Y"
              value={s.y}
              min={-500}
              max={500}
              unit="px"
              onChange={(y) => set({ y })}
            />
          </div>
        </>
      )}
    </Section>
  )
}

/* ---------- Crop ---------- */

function CropPanel({ ratio, actions }: { ratio: string; actions: InspectorActions }) {
  return (
    <div className="dz-crop-panel">
      <p className="field-hint">
        Drag the handles to frame, drag inside to move the picture. Shift keeps the shape; Enter
        applies, Esc cancels.
      </p>
      <div
        className="chip-grid"
        role="group"
        aria-label="Crop aspect ratio"
        style={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' }}
      >
        {CROP_RATIOS.map((r) => (
          <button
            key={r.id}
            className={ratio === r.id ? 'active' : ''}
            aria-pressed={ratio === r.id}
            onClick={() => actions.setCropRatio(r.id)}
          >
            <span>{r.name}</span>
          </button>
        ))}
      </div>
      <button className="button ghost sm" onClick={actions.resetCrop}>
        <RotateCcw size={14} aria-hidden="true" /> Show whole image
      </button>
      <div className="dz-crop-actions">
        <button className="button secondary" onClick={actions.cancelCrop}>
          <X size={16} aria-hidden="true" /> Cancel
        </button>
        <button className="button primary" onClick={actions.applyCrop}>
          <Check size={16} aria-hidden="true" /> Apply crop
        </button>
      </div>
    </div>
  )
}

/* ---------- Panel ---------- */

export function Inspector({
  doc,
  selection,
  actions,
  cropping,
  cropRatio,
  onRename,
}: {
  doc: DesignDoc
  selection: string[]
  actions: InspectorActions
  cropping: boolean
  cropRatio: string
  onRename: (name: string) => void
}) {
  const [open, toggle] = useOpen({
    layout: true,
    mask: true,
    layer: false,
    kind: true,
    adjust: false,
    shadow: false,
  })
  const selected = doc.layers.filter((l) => selection.includes(l.id))
  const l = selected.length === 1 ? selected[0] : null
  const index = l ? doc.layers.indexOf(l) : -1
  const Icon = !selected.length
    ? Frame
    : selected.length > 1
      ? LayersIcon
      : l?.kind === 'text'
        ? Type
        : l?.kind === 'image'
          ? ImageIcon
          : l?.kind === 'ellipse'
            ? Circle
            : Square

  const menu: MenuEntry[] = [
    {
      label: 'Bring to front',
      Icon: ChevronsUp,
      shortcut: '⇧ ]',
      disabled: index === doc.layers.length - 1 && !!l,
      onSelect: () => actions.reorder('front'),
    },
    { label: 'Bring forward', Icon: ChevronUp, shortcut: ']', onSelect: () => actions.reorder(1) },
    {
      label: 'Send backward',
      Icon: ChevronDown,
      shortcut: '[',
      onSelect: () => actions.reorder(-1),
    },
    {
      label: 'Send to back',
      Icon: ChevronsDown,
      shortcut: '⇧ [',
      disabled: index === 0,
      onSelect: () => actions.reorder('back'),
    },
    'separator',
    { label: 'Duplicate', Icon: Copy, shortcut: '⌘ D', onSelect: actions.duplicate },
    { label: 'Delete', Icon: Trash2, shortcut: 'Del', danger: true, onSelect: actions.remove },
  ]

  return (
    <aside className="inspector dz-inspector" aria-label="Properties">
      <header className="inspector-head">
        <span className="inspector-icon" aria-hidden="true">
          <Icon size={16} />
        </span>
        {cropping ? (
          <h2 className="inspector-title">Crop image</h2>
        ) : l ? (
          <input
            className="inspector-title-input"
            aria-label="Layer name"
            value={l.name}
            maxLength={80}
            onChange={(e) => onRename(e.target.value)}
          />
        ) : (
          <h2 className="inspector-title">
            {selected.length > 1 ? `${selected.length} layers` : 'Design'}
          </h2>
        )}
        {selected.length > 0 && !cropping && (
          <MenuButton label="Layer actions" align="end" items={menu}>
            <MoreHorizontal size={20} />
          </MenuButton>
        )}
      </header>
      <div className="inspector-body" id="dz-props">
        {cropping ? (
          <CropPanel ratio={cropRatio} actions={actions} />
        ) : !selected.length ? (
          <ArtboardPanel doc={doc} actions={actions} />
        ) : !l ? (
          <>
            <div className="panel-block">
              <AlignBar actions={actions} multi />
            </div>
            <Section
              title="Layer"
              summary={`${selected.length} selected`}
              open={open.layer}
              onToggle={() => toggle('layer')}
            >
              <NumberField
                label="Opacity"
                value={selected[0].opacity}
                min={0}
                max={100}
                unit="%"
                onChange={(opacity) => actions.update({ opacity })}
              />
              <div className="dz-button-row">
                <button className="button secondary sm" onClick={actions.duplicate}>
                  <Copy size={14} aria-hidden="true" /> Duplicate
                </button>
                <button className="button secondary sm" onClick={actions.remove}>
                  <Trash2 size={14} aria-hidden="true" /> Delete
                </button>
              </div>
            </Section>
          </>
        ) : (
          <>
            <div className="panel-block">
              <AlignBar actions={actions} multi={false} />
            </div>
            <LayoutSection
              key={l.id}
              l={l}
              actions={actions}
              open={open.layout}
              toggle={() => toggle('layout')}
            />
            {l.kind === 'text' && (
              <TextSection l={l} actions={actions} open={open.kind} toggle={() => toggle('kind')} />
            )}
            {isShape(l) && !l.maskOnly && (
              <ShapeSection
                l={l}
                actions={actions}
                open={open.kind}
                toggle={() => toggle('kind')}
              />
            )}
            {l.kind === 'image' && (
              <>
                <ImageSection
                  l={l}
                  actions={actions}
                  open={open.kind}
                  toggle={() => toggle('kind')}
                />
                <AdjustSection
                  l={l}
                  actions={actions}
                  open={open.adjust}
                  toggle={() => toggle('adjust')}
                />
              </>
            )}
            <MaskSection
              l={l}
              doc={doc}
              actions={actions}
              open={open.mask}
              toggle={() => toggle('mask')}
            />
            <LayerSection
              l={l}
              doc={doc}
              actions={actions}
              open={open.layer}
              toggle={() => toggle('layer')}
            />
            <ShadowSection
              l={l}
              actions={actions}
              open={open.shadow}
              toggle={() => toggle('shadow')}
            />
          </>
        )}
      </div>
    </aside>
  )
}
