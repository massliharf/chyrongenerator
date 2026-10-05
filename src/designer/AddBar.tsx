import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  Clapperboard,
  ClipboardPaste,
  FolderOpen,
  Image as ImageIcon,
  Shapes,
  SquareDashed,
  Type,
  Upload,
} from 'lucide-react'
import { SHAPES, TEXT_PRESETS, type TextPreset } from './model'
import { ShapeIcon } from './LeftPanel'
import { chyronFromTemplate, savedChyron } from './chyron'
import { Composition } from '../components/Composition'
import {
  DEFAULT_PROJECT,
  TEMPLATES,
  restTime,
  type ChyronStyle,
  type Project,
} from '../studio/model'

type ShapePreset = (typeof SHAPES)[number]

export interface AddActions {
  onUpload: () => void
  onGallery: () => void
  onText: (preset: TextPreset) => void
  onShape: (preset: ShapePreset) => void
  onFrame: (preset: ShapePreset) => void
  onChyron: (style: ChyronStyle) => void
}

/** A trigger with a panel that opens above it; closes on outside click or Escape. */
function Popover({
  label,
  icon,
  wide = false,
  children,
}: {
  label: string
  icon: ReactNode
  wide?: boolean
  children: (close: () => void) => ReactNode
}) {
  const [open, setOpen] = useState(false)
  const wrap = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (!open) return
    const down = (e: PointerEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false)
    }
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        setOpen(false)
        trigger.current?.focus()
      }
    }
    window.addEventListener('pointerdown', down)
    window.addEventListener('keydown', key, true)
    wrap.current?.querySelector<HTMLButtonElement>('.dz-popover button')?.focus()
    return () => {
      window.removeEventListener('pointerdown', down)
      window.removeEventListener('keydown', key, true)
    }
  }, [open])
  return (
    <div className="dz-add-item" ref={wrap}>
      <button
        ref={trigger}
        className={`dz-add-tile ${open ? 'is-open' : ''}`}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen(!open)}
      >
        {icon}
        <span>{label}</span>
      </button>
      {open && (
        <div className={`dz-popover ${wide ? 'is-wide' : ''}`} role="dialog" aria-label={label}>
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  )
}

/** The look of a style card: the template's lettering on its own background. */
const sample = (style: Partial<Project>): Project => ({
  ...DEFAULT_PROJECT,
  ...style,
  width: 1280,
  height: 720,
  x: 50,
  y: 50,
  scale: 100,
  compositionRotation: 0,
})

function ChyronPicker({ onPick }: { onPick: (style: ChyronStyle) => void }) {
  // Read once per opening: the Chyron editor may have changed in the meantime.
  const [mine] = useState(savedChyron)
  const cards = useMemo(
    () => [
      ...(mine
        ? [{ id: 'mine', name: 'Your chyron', background: '#1a1a1a', style: mine, caption: '' }]
        : []),
      ...TEMPLATES.map((t) => ({
        id: t.id,
        name: t.name,
        background: t.background,
        caption: t.caption,
        style: chyronFromTemplate(t),
      })),
    ],
    [mine],
  )
  return (
    <>
      <div className="style-grid dz-chyron-grid">
        {cards.map((c) => {
          const project = sample(
            c.id === 'mine' ? c.style : { ...c.style, text: 'Aa', subtitle: '' },
          )
          return (
            <button
              key={c.id}
              className="style-card"
              title={
                c.id === 'mine' ? 'The chyron from the Chyron editor, with its words' : c.caption
              }
              aria-label={`Add a chyron: ${c.name}`}
              onClick={() => onPick(c.style)}
            >
              <span className="style-art" style={{ background: c.background }}>
                <Composition project={project} time={restTime(project)} thumbnail />
              </span>
              <span className="style-name">{c.name}</span>
            </button>
          )
        })}
      </div>
      <p className="dz-pop-note">
        Lettering from the Chyron editor. Type its words and change its look on the right.
      </p>
    </>
  )
}

/**
 * Everything that can be added to a design, floating over the artboard:
 * images, text, shapes, frames and chyrons. Each opens its choices above it.
 */
export function AddBar({ onUpload, onGallery, onText, onShape, onFrame, onChyron }: AddActions) {
  return (
    <div className="dz-addbar" role="toolbar" aria-label="Add to design">
      <Popover label="Image" icon={<ImageIcon size={16} aria-hidden="true" />}>
        {(close) => (
          <div className="dz-pop-list">
            <button
              className="dz-pop-row"
              onClick={() => {
                close()
                onUpload()
              }}
            >
              <Upload size={16} aria-hidden="true" />
              <span>
                Upload from device
                <small>PNG, JPEG, WebP, GIF · I</small>
              </span>
            </button>
            <button
              className="dz-pop-row"
              onClick={() => {
                close()
                onGallery()
              }}
            >
              <FolderOpen size={16} aria-hidden="true" />
              <span>
                Media gallery
                <small>Hosts and backgrounds</small>
              </span>
            </button>
            <p className="dz-pop-note">
              <ClipboardPaste size={14} aria-hidden="true" /> You can also drop or paste images on
              the artboard.
            </p>
          </div>
        )}
      </Popover>
      <Popover label="Text" icon={<Type size={16} aria-hidden="true" />}>
        {(close) => (
          <div className="dz-pop-list">
            {(Object.keys(TEXT_PRESETS) as TextPreset[]).map((k) => (
              <button
                key={k}
                className={`dz-pop-text is-${k}`}
                onClick={() => {
                  close()
                  onText(k)
                }}
              >
                {TEXT_PRESETS[k].label}
              </button>
            ))}
            <p className="dz-pop-note">Or press T and click on the artboard.</p>
          </div>
        )}
      </Popover>
      <Popover label="Shape" icon={<Shapes size={16} aria-hidden="true" />}>
        {(close) => (
          <>
            <div className="dz-shape-grid">
              {SHAPES.map((p) => (
                <button
                  key={p.name}
                  className="dz-shape-tile"
                  title={p.name}
                  onClick={() => {
                    close()
                    onShape(p)
                  }}
                >
                  <ShapeIcon preset={p} />
                  <span>{p.name}</span>
                </button>
              ))}
            </div>
            <p className="dz-pop-note">R and O draw rectangles and ellipses directly.</p>
          </>
        )}
      </Popover>
      <Popover label="Frame" icon={<SquareDashed size={16} aria-hidden="true" />}>
        {(close) => (
          <>
            <div className="dz-shape-grid is-frames">
              {SHAPES.map((p) => (
                <button
                  key={p.name}
                  className="dz-shape-tile"
                  title={`${p.name} frame`}
                  onClick={() => {
                    close()
                    onFrame(p)
                  }}
                >
                  <ShapeIcon preset={p} />
                  <span>{p.name}</span>
                </button>
              ))}
            </div>
            <p className="dz-pop-note">
              Frames are masks waiting for a picture. Drop a photo on one, or drag an image layer
              onto it.
            </p>
          </>
        )}
      </Popover>
      <span className="dz-addbar-sep" aria-hidden="true" />
      <Popover label="Chyron" wide icon={<Clapperboard size={16} aria-hidden="true" />}>
        {(close) => (
          <ChyronPicker
            onPick={(style) => {
              close()
              onChyron(style)
            }}
          />
        )}
      </Popover>
    </div>
  )
}
