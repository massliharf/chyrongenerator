import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { placeNear } from '../components/placeNear'
import {
  ChevronLeft,
  Clapperboard,
  ClipboardPaste,
  FolderOpen,
  Image as ImageIcon,
  Minus,
  Shapes,
  SquareDashed,
  Type,
  Upload,
} from 'lucide-react'
import { LINE, SHAPES, TEXT_PRESETS, type ShapePreset, type TextPreset } from './model'
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

export interface AddActions {
  /** The current drawing tool, so Text and Shape show when T, R or O is on. */
  tool: string
  onUpload: () => void
  onGallery: () => void
  onText: (preset: TextPreset) => void
  /** Shapes and lines (LINE). */
  onShape: (preset: ShapePreset) => void
  onFrame: (preset: ShapePreset) => void
  onChyron: (style: ChyronStyle) => void
}

/**
 * An icon in the top toolbar with a panel of choices that opens below it,
 * drawn above the page so nothing cuts it off; closes on outside click or Escape.
 */
export function AddPopover({
  label,
  title,
  icon,
  wide = false,
  active = false,
  children,
}: {
  label: string
  title: string
  icon: ReactNode
  wide?: boolean
  /** Its drawing tool is the current one (T for text, R or O for shapes). */
  active?: boolean
  children: (close: () => void) => ReactNode
}) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  const close = () => {
    setOpen(false)
    setPos(null)
  }
  useLayoutEffect(() => {
    if (!open || !trigger.current || !panel.current) return
    const r = panel.current.getBoundingClientRect()
    setPos(placeNear(trigger.current.getBoundingClientRect(), r, { align: 'center', gap: 8 }))
  }, [open])
  // Focus the first choice once the panel is placed (it is hidden until then).
  const placed = pos !== null
  useEffect(() => {
    if (placed) panel.current?.querySelector<HTMLButtonElement>('button')?.focus()
  }, [placed])
  useEffect(() => {
    if (!open) return
    const down = (e: PointerEvent) => {
      const t = e.target as Node
      if (!panel.current?.contains(t) && !trigger.current?.contains(t)) close()
    }
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        close()
        trigger.current?.focus()
      }
    }
    window.addEventListener('pointerdown', down)
    window.addEventListener('keydown', key, true)
    window.addEventListener('resize', close)
    return () => {
      window.removeEventListener('pointerdown', down)
      window.removeEventListener('keydown', key, true)
      window.removeEventListener('resize', close)
    }
  }, [open])
  return (
    <div className="dz-add-item">
      <button
        ref={trigger}
        className={`icon-button ${open || active ? 'selected' : ''}`}
        aria-label={label}
        title={title}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => (open ? close() : setOpen(true))}
      >
        {icon}
      </button>
      {open &&
        createPortal(
          <div
            ref={panel}
            className={`dz-popover ${wide ? 'is-wide' : ''}`}
            role="dialog"
            aria-label={label}
            style={
              {
                '--menu-x': `${pos?.x ?? 0}px`,
                '--menu-y': `${pos?.y ?? 0}px`,
                visibility: pos ? undefined : 'hidden',
              } as React.CSSProperties
            }
          >
            {children(close)}
          </div>,
          document.body,
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

/** Where a picture comes from: this device or the Media gallery. */
export function ImageChoices({
  onUpload,
  onGallery,
  note = true,
}: {
  onUpload: () => void
  onGallery: () => void
  /** The drop-or-paste reminder. */
  note?: boolean
}) {
  return (
    <div className="dz-pop-list">
      <button className="dz-pop-row" onClick={onUpload}>
        <Upload size={16} aria-hidden="true" />
        <span>
          Upload from device
          <small>PNG, JPEG, WebP or GIF</small>
        </span>
      </button>
      <button className="dz-pop-row" onClick={onGallery}>
        <FolderOpen size={16} aria-hidden="true" />
        <span>
          Media gallery
          <small>Hosts, logos and backgrounds</small>
        </span>
      </button>
      {note && (
        <p className="dz-pop-note">
          <ClipboardPaste size={14} aria-hidden="true" /> You can also drop or paste images on the
          canvas.
        </p>
      )}
    </div>
  )
}

/** The shapes, as tiles; frames show them as outlines waiting for a picture. */
export function ShapeChoices({
  onPick,
  frames = false,
  note,
}: {
  onPick: (preset: ShapePreset) => void
  frames?: boolean
  note: ReactNode
}) {
  return (
    <>
      <div className={`dz-shape-grid ${frames ? 'is-frames' : ''}`}>
        {SHAPES.map((p) => (
          <button
            key={p.id}
            className="dz-shape-tile"
            title={frames ? `${p.name} frame` : p.name}
            onClick={() => onPick(p)}
          >
            <ShapeIcon preset={p} />
            <span>{p.name}</span>
          </button>
        ))}
      </div>
      <p className="dz-pop-note">{note}</p>
    </>
  )
}

/** A frame for a picture: its shape first, then where the picture comes from. */
export function FrameChoices({
  onPick,
}: {
  onPick: (preset: ShapePreset, source: 'upload' | 'gallery') => void
}) {
  const [shape, setShape] = useState<ShapePreset | null>(null)
  if (!shape)
    return (
      <ShapeChoices
        frames
        onPick={setShape}
        note="Pick the frame's shape, then its picture. Drag inside the picture later to frame it."
      />
    )
  return (
    <>
      <button className="dz-pop-back" onClick={() => setShape(null)}>
        <ChevronLeft size={14} aria-hidden="true" /> {shape.name} frame
      </button>
      <ImageChoices
        note={false}
        onUpload={() => onPick(shape, 'upload')}
        onGallery={() => onPick(shape, 'gallery')}
      />
    </>
  )
}

/** Text presets: a heading, a subheading or body text. */
export function TextChoices({
  onPick,
  note,
}: {
  onPick: (preset: TextPreset) => void
  note?: string
}) {
  return (
    <div className="dz-pop-list">
      {(Object.keys(TEXT_PRESETS) as TextPreset[]).map((k) => (
        <button key={k} className={`dz-pop-text is-${k}`} onClick={() => onPick(k)}>
          {TEXT_PRESETS[k].label}
        </button>
      ))}
      {note && <p className="dz-pop-note">{note}</p>}
    </div>
  )
}

/** One look for every "add" icon in the editors' top toolbars. */
export function AddButton({
  label,
  title,
  onClick,
  children,
}: {
  label: string
  title: string
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button className="icon-button" aria-label={label} title={title} onClick={onClick}>
      {children}
    </button>
  )
}

/**
 * Everything that can be added to a design, as icons in the top toolbar, in
 * the same order as the Chyron editor's: chyron, text, shape, line, frame,
 * image. Each opens its choices below it.
 */
export function AddTools({
  tool,
  onUpload,
  onGallery,
  onText,
  onShape,
  onFrame,
  onChyron,
}: AddActions) {
  return (
    <>
      <AddPopover label="Add chyron" title="Chyron" wide icon={<Clapperboard size={18} />}>
        {(close) => (
          <ChyronPicker
            onPick={(style) => {
              close()
              onChyron(style)
            }}
          />
        )}
      </AddPopover>
      <AddPopover
        label="Add text"
        title="Text (T)"
        active={tool === 'text'}
        icon={<Type size={18} />}
      >
        {(close) => (
          <TextChoices
            onPick={(k) => {
              close()
              onText(k)
            }}
            note="Or press T and click on the artboard."
          />
        )}
      </AddPopover>
      <AddPopover
        label="Add shape"
        title="Shape (R, O)"
        active={tool === 'rect' || tool === 'ellipse'}
        icon={<Shapes size={18} />}
      >
        {(close) => (
          <ShapeChoices
            onPick={(p) => {
              close()
              onShape(p)
            }}
            note="R and O draw rectangles and ellipses directly."
          />
        )}
      </AddPopover>
      <AddButton label="Add line" title="Line" onClick={() => onShape(LINE)}>
        <Minus size={18} />
      </AddButton>
      <AddPopover
        label="Add frame"
        title="Frame: a shape waiting for a picture"
        icon={<SquareDashed size={18} />}
      >
        {(close) => (
          <ShapeChoices
            frames
            onPick={(p) => {
              close()
              onFrame(p)
            }}
            note="Frames are masks waiting for a picture. Drop a photo on one, or drag an image layer onto it."
          />
        )}
      </AddPopover>
      <AddPopover label="Add image" title="Image (I)" icon={<ImageIcon size={18} />}>
        {(close) => (
          <ImageChoices
            onUpload={() => {
              close()
              onUpload()
            }}
            onGallery={() => {
              close()
              onGallery()
            }}
          />
        )}
      </AddPopover>
    </>
  )
}
