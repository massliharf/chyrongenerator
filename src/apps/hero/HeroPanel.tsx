import { useState } from 'react'
import {
  Copy,
  FlipHorizontal2,
  Image as ImageIcon,
  Plus,
  RefreshCw,
  Trash2,
  Upload,
  UserRound,
} from 'lucide-react'
import { Color, NumberField, Section } from '../../components/Controls'
import { MenuButton, type MenuEntry } from '../../components/Menu'
import { BACKGROUNDS, COLOR_STYLES, FORMATS } from '../../stream/model'
import {
  DEFAULT_FRAMING,
  isImageBackground,
  lookFor,
  type Artboard,
  type HeroSet,
  type Look,
} from './model'

export type PickSource = 'gallery' | 'upload'
type Open = { framing: boolean; background: boolean; finish: boolean; artboard: boolean }
type Role = 'background' | 'host' | 'shade' | null

const round = (n: number, places = 1) => Math.round(n * 10 ** places) / 10 ** places
/** The stream image an artboard's size stands for; other sizes start like the host card. */
const defaultsFor = (a: Artboard) =>
  lookFor(FORMATS.find((f) => f.width === a.doc.width && f.height === a.doc.height)?.id)

/**
 * The stream image settings of the artboard being edited: the host photo
 * (shared by every artboard), its framing, the background and the finish.
 * Shown when nothing is selected or one of the artboard's own layers is.
 */
export function HeroPanel({
  set,
  artboard,
  role,
  disabled,
  onPatch,
  onPickHost,
  onRemoveHost,
  onPickBackground,
  onRemoveBackground,
  onResize,
  onNotice,
}: {
  set: HeroSet
  artboard: Artboard
  /** The look layer selected on the canvas, whose section opens. */
  role: Role
  disabled: boolean
  onPatch: (values: Partial<Look>, all?: boolean) => void
  onPickHost: (source: PickSource) => void
  onRemoveHost: () => void
  onPickBackground: (source: PickSource) => void
  onRemoveBackground: (id: string) => void
  onResize: (width: number, height: number) => void
  onNotice: (message: string) => void
}) {
  const look = artboard.look
  const doc = artboard.doc
  const count = set.artboards.length
  const [open, setOpen] = useState<Open>({
    framing: role === 'host',
    background: role !== 'host' && role !== 'shade',
    finish: role === 'shade',
    artboard: false,
  })
  // A look layer picked on the canvas opens its settings.
  const [shownRole, setShownRole] = useState(role)
  if (role !== shownRole) {
    setShownRole(role)
    if (role === 'host') setOpen((o) => ({ ...o, framing: true }))
    if (role === 'background') setOpen((o) => ({ ...o, background: true }))
    if (role === 'shade') setOpen((o) => ({ ...o, finish: true }))
  }
  const toggle = (key: keyof Open) => setOpen((o) => ({ ...o, [key]: !o[key] }))
  const host = set.host
  const imageBackground = isImageBackground(look.background)
  const backgroundKind = imageBackground ? 'image' : look.background
  const backgroundName =
    BACKGROUNDS.find((b) => b.id === look.background)?.name ??
    set.backgrounds.find((b) => b.id === look.background)?.name ??
    (look.background === 'gradient'
      ? 'Gradient'
      : look.background === 'solid'
        ? 'Solid color'
        : 'None')
  const selectBackground = (id: string) =>
    onPatch({ background: id, backgroundX: 50, backgroundY: 50, backgroundZoom: 100 })
  const pickItems = (pick: (s: PickSource) => void, hint: string): MenuEntry[] => [
    { label: 'Choose from Media gallery', Icon: ImageIcon, onSelect: () => pick('gallery') },
    { label: 'Upload from device', Icon: Upload, hint, onSelect: () => pick('upload') },
  ]
  const hostItems = pickItems(onPickHost, 'PNG, JPEG or WebP · up to 20 MB')

  return (
    <aside className="inspector dz-inspector hero-panel" aria-label="Image settings">
      <header className="inspector-head">
        <span className="inspector-icon" aria-hidden="true">
          <ImageIcon size={16} />
        </span>
        <div className="inspector-heading">
          <h2 className="inspector-title">{doc.name}</h2>
          <span>Framing and background apply to this artboard</span>
        </div>
      </header>
      <fieldset className="inspector-body" id="dz-props" disabled={disabled}>
        <legend className="sr-only">Image settings</legend>
        <section className="panel-block" aria-labelledby="hero-host-heading">
          <h3 id="hero-host-heading" className="panel-block-title">
            Host image
          </h3>
          {host ? (
            <>
              <div className="file-card">
                <div className="file-card-thumb">
                  <img src={set.assets[host.asset]} alt="" />
                </div>
                <div className="file-card-text">
                  <strong title={host.name}>{host.name}</strong>
                  <span>
                    {host.width} × {host.height} · all {count} artboards
                  </span>
                </div>
                <MenuButton
                  label="Replace host image"
                  className="icon-button"
                  align="end"
                  disabled={disabled}
                  items={hostItems}
                >
                  <RefreshCw size={18} />
                </MenuButton>
                <button
                  className="icon-button"
                  aria-label="Remove host image"
                  title="Remove host image from every artboard"
                  onClick={onRemoveHost}
                >
                  <Trash2 size={18} />
                </button>
              </div>
              {look.hostOff && (
                <div className="hero-host-off">
                  <span>Not on this artboard.</span>
                  <button
                    className="button secondary sm"
                    onClick={() => onPatch({ hostOff: false })}
                  >
                    <UserRound size={14} aria-hidden="true" /> Show host here
                  </button>
                </div>
              )}
            </>
          ) : (
            <>
              <MenuButton
                label="Add host image"
                className="button secondary full"
                disabled={disabled}
                items={hostItems}
              >
                <Plus size={16} aria-hidden="true" /> Add host image
              </MenuButton>
              <p className="field-hint">Shared by every artboard. A transparent PNG works best.</p>
            </>
          )}
        </section>

        <Section
          title="Framing"
          summary={`${Math.round(look.zoom)}% · ${round(look.rotation)}°`}
          open={open.framing}
          onToggle={() => toggle('framing')}
          onReset={() => onPatch(DEFAULT_FRAMING)}
        >
          <fieldset className="form-grid" disabled={!host || look.hostOff}>
            <legend className="sr-only">Host position</legend>
            <NumberField
              label="Host size"
              value={round(look.zoom)}
              min={20}
              max={300}
              unit="%"
              onChange={(zoom) => onPatch({ zoom })}
            />
            <NumberField
              label="Host rotation"
              value={round(look.rotation)}
              min={-180}
              max={180}
              unit="°"
              onChange={(rotation) => onPatch({ rotation })}
            />
            <NumberField
              label="Host horizontal"
              value={round(look.x, 2)}
              min={-50}
              max={150}
              step={0.25}
              unit="%"
              onChange={(x) => onPatch({ x })}
            />
            <NumberField
              label="Host vertical"
              value={round(look.y, 2)}
              min={-50}
              max={150}
              step={0.25}
              unit="%"
              onChange={(y) => onPatch({ y })}
            />
            <button
              className={`button secondary sm hero-flip ${look.flip ? 'is-on' : ''}`}
              aria-pressed={look.flip}
              onClick={() => onPatch({ flip: !look.flip })}
            >
              <FlipHorizontal2 size={16} aria-hidden="true" /> Flip horizontally
            </button>
            {!host ? (
              <p className="field-hint">Add a host image to frame it.</p>
            ) : (
              <p className="field-hint">
                Or drag the host on the canvas: corners resize, the top handle turns.
              </p>
            )}
          </fieldset>
        </Section>

        <Section
          title="Background"
          summary={backgroundName}
          open={open.background}
          onToggle={() => toggle('background')}
        >
          <div className="field">
            <span className="field-label" id="hero-bg-kind">
              Background style
            </span>
            <div className="segmented" role="radiogroup" aria-labelledby="hero-bg-kind">
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
                    } else onPatch({ background: id })
                  }}
                >
                  {name}
                </button>
              ))}
            </div>
          </div>
          {imageBackground && (
            <>
              <div className="hero-backgrounds" role="group" aria-label="Background images">
                {BACKGROUNDS.map((bg) => (
                  <button
                    key={bg.id}
                    aria-label={`Use ${bg.name} background`}
                    aria-pressed={look.background === bg.id}
                    onClick={() => selectBackground(bg.id)}
                  >
                    <img src={bg.thumbUrl || bg.url} alt="" loading="lazy" />
                    <span>{bg.name}</span>
                  </button>
                ))}
                {set.backgrounds.map((bg) => (
                  <button
                    key={bg.id}
                    aria-label={`Use ${bg.name} background`}
                    aria-pressed={look.background === bg.id}
                    onClick={() => selectBackground(bg.id)}
                  >
                    <img src={set.assets[bg.id]} alt="" />
                    <span title={bg.name}>{bg.name}</span>
                  </button>
                ))}
                <MenuButton
                  label="Add background"
                  className="hero-background-add"
                  disabled={disabled}
                  items={pickItems(onPickBackground, 'Up to 8 custom backgrounds')}
                >
                  <Plus size={20} aria-hidden="true" />
                  <span>Add</span>
                </MenuButton>
              </div>
              {set.backgrounds.some((bg) => bg.id === look.background) && (
                <button
                  className="button ghost danger-text sm"
                  onClick={() => onRemoveBackground(look.background)}
                >
                  <Trash2 size={16} aria-hidden="true" /> Remove this background
                </button>
              )}
              <div className="form-grid">
                <NumberField
                  label="Background horizontal"
                  min={0}
                  max={100}
                  value={round(look.backgroundX)}
                  unit="%"
                  onChange={(backgroundX) => onPatch({ backgroundX })}
                />
                <NumberField
                  label="Background vertical"
                  min={0}
                  max={100}
                  value={round(look.backgroundY)}
                  unit="%"
                  onChange={(backgroundY) => onPatch({ backgroundY })}
                />
                <NumberField
                  label="Background zoom"
                  min={100}
                  max={250}
                  value={round(look.backgroundZoom)}
                  unit="%"
                  onChange={(backgroundZoom) => onPatch({ backgroundZoom })}
                />
              </div>
            </>
          )}
          {(look.background === 'gradient' || look.background === 'solid') && (
            <>
              <div className="swatch-row" role="group" aria-label="Background color presets">
                {COLOR_STYLES.map((p) => (
                  <button
                    key={p.name}
                    aria-label={`Use ${p.name} colors`}
                    title={p.name}
                    style={{ background: `linear-gradient(35deg, ${p.color}, ${p.color2})` }}
                    onClick={() => onPatch({ color: p.color, color2: p.color2 })}
                  />
                ))}
              </div>
              <div className="color-grid">
                <Color
                  label="Background color"
                  value={look.color}
                  onChange={(color) => onPatch({ color })}
                />
                {look.background === 'gradient' && (
                  <Color
                    label="Gradient highlight"
                    value={look.color2}
                    onChange={(color2) => onPatch({ color2 })}
                  />
                )}
              </div>
            </>
          )}
          {count > 1 && (
            <button
              className="button outline full"
              onClick={() => {
                const { background, color, color2, backgroundX, backgroundY, backgroundZoom } = look
                onPatch(
                  { background, color, color2, backgroundX, backgroundY, backgroundZoom },
                  true,
                )
                onNotice(`Background applied to all ${count} artboards. Host framing is unchanged.`)
              }}
            >
              <Copy size={16} aria-hidden="true" /> Use this background for all {count}
            </button>
          )}
        </Section>

        <Section
          title="Shadow & fade"
          summary={`${look.shadow}% host shadow`}
          open={open.finish}
          onToggle={() => toggle('finish')}
          onReset={() => {
            const { shadow, fade, bottomShadow } = defaultsFor(artboard)
            onPatch({ shadow, fade, bottomShadow })
          }}
        >
          <NumberField
            label="Host shadow"
            min={0}
            max={100}
            value={look.shadow}
            unit="%"
            onChange={(shadow) => onPatch({ shadow })}
          />
          <NumberField
            label="Bottom shadow"
            min={0}
            max={100}
            value={look.bottomShadow}
            unit="%"
            hint={look.background === 'transparent' ? 'Needs a background.' : undefined}
            onChange={(bottomShadow) => onPatch({ bottomShadow })}
          />
          <NumberField
            label="Bottom fade"
            min={0}
            max={60}
            value={look.fade}
            unit="%"
            onChange={(fade) => onPatch({ fade })}
          />
        </Section>

        <Section
          title="Artboard"
          summary={`${doc.width} × ${doc.height}`}
          open={open.artboard}
          onToggle={() => toggle('artboard')}
        >
          <div className="form-grid">
            <NumberField
              label="Width"
              min={16}
              max={8000}
              value={doc.width}
              unit="px"
              onChange={(w) => onResize(Math.round(w), doc.height)}
            />
            <NumberField
              label="Height"
              min={16}
              max={8000}
              value={doc.height}
              unit="px"
              onChange={(h) => onResize(doc.width, Math.round(h))}
            />
          </div>
          <p className="field-hint">
            The host and background follow the new size; added layers stay where they are.
          </p>
        </Section>
      </fieldset>
    </aside>
  )
}
