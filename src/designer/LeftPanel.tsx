import { useEffect, useRef, useState } from 'react'
import {
  ChevronDown,
  ChevronRight,
  Eye,
  EyeOff,
  Layers as LayersIcon,
  Lock,
  LockOpen,
  X,
} from 'lucide-react'
import { SHAPES, isShape, type DesignDoc, type Layer } from './model'
import type { DropZone } from './ops'
import { clipGroups, drawThumb } from './render'
import { shapePath } from './shapes'

type ShapePreset = (typeof SHAPES)[number]

/* ---------- Small pieces ---------- */

export function ShapeIcon({ preset, size = 22 }: { preset: ShapePreset; size?: number }) {
  const pad = 2
  const box = size - pad * 2
  const h =
    preset.kind === 'arch' ? box : preset.kind === 'rect' && !preset.radius ? box * 0.86 : box
  const w = preset.kind === 'arch' ? box * 0.8 : box
  const d = shapePath(preset.kind, pad + (box - w) / 2, pad + (box - h) / 2, w, h, {
    radius: (preset.radius ?? 0) * box,
    sides: preset.sides,
    points: 5,
    inner: 0.45,
  })
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      <path d={d} />
    </svg>
  )
}

function Thumb({ layer, version }: { layer: Layer; version: number }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    if (ref.current) drawThumb(ref.current, layer)
  }, [layer, version])
  return <canvas ref={ref} width={56} height={56} className="dz-layer-thumb" aria-hidden="true" />
}

/* ---------- Layers ---------- */

const KIND_LABEL: Record<Layer['kind'], string> = {
  image: 'Image',
  text: 'Text',
  rect: 'Rectangle',
  ellipse: 'Ellipse',
  triangle: 'Triangle',
  polygon: 'Polygon',
  star: 'Star',
  heart: 'Heart',
  arch: 'Arch',
}

interface ListProps {
  doc: DesignDoc
  selection: string[]
  imagesVersion: number
  onSelect: (ids: string[]) => void
  onToggle: (id: string, key: 'visible' | 'locked') => void
  onRename: (id: string, name: string) => void
  onDrop: (dragId: string, targetId: string, zone: DropZone) => void
  onContextMenu: (at: { x: number; y: number }, id: string) => void
}

function LayersList({
  doc,
  selection,
  imagesVersion,
  onSelect,
  onToggle,
  onRename,
  onDrop,
  onContextMenu,
}: ListProps) {
  const [renaming, setRenaming] = useState<string | null>(null)
  const [dragId, setDragId] = useState<string | null>(null)
  const [dropAt, setDropAt] = useState<{ id: string; zone: DropZone } | null>(null)
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const anchor = useRef<string | null>(null)

  // Front of the stack first; inside a mask group, contents above their mask.
  const groups = clipGroups(doc.layers).reverse()
  const visualOrder = groups.flatMap((g) => [...[...g.clips].reverse(), g.base])

  if (!doc.layers.length)
    return (
      <div className="dz-empty-layers">
        <LayersIcon size={24} strokeWidth={1.5} aria-hidden="true" />
        <strong>No layers yet</strong>
        <span>
          Use the bar under the artboard to add an image, text, shape, frame or chyron, or drop
          files on the artboard.
        </span>
      </div>
    )

  const select = (id: string, e: React.MouseEvent) => {
    if (e.shiftKey && anchor.current) {
      const a = visualOrder.findIndex((r) => r.id === anchor.current)
      const b = visualOrder.findIndex((r) => r.id === id)
      const [lo, hi] = a < b ? [a, b] : [b, a]
      onSelect(visualOrder.slice(lo, hi + 1).map((r) => r.id))
      return
    }
    anchor.current = id
    if (e.metaKey || e.ctrlKey) {
      onSelect(selection.includes(id) ? selection.filter((s) => s !== id) : [...selection, id])
      return
    }
    onSelect([id])
  }

  const row = (l: Layer, role: 'base' | 'clip' | 'single', clipCount = 0) => {
    const active = selection.includes(l.id)
    const isMask = role === 'base'
    const frame = !!l.maskOnly && isShape(l)
    const sub =
      role === 'clip'
        ? `In ${groups.find((g) => g.clips.includes(l))?.base.name ?? 'mask'}`
        : frame
          ? clipCount
            ? 'Frame'
            : 'Empty frame · drop an image'
          : isMask
            ? `Mask · ${clipCount} inside`
            : l.kind === 'image' && l.chyron
              ? 'Chyron'
              : KIND_LABEL[l.kind]
    const canInto = dragId !== null && dragId !== l.id
    return (
      <li
        key={l.id}
        role="option"
        aria-selected={active}
        className={[
          'dz-layer',
          active ? 'is-selected' : '',
          !l.visible ? 'is-hidden' : '',
          role === 'clip' ? 'is-clipped' : '',
          isMask || frame ? 'is-mask' : '',
          dragId === l.id ? 'is-dragging' : '',
          dropAt?.id === l.id ? `drop-${dropAt.zone}` : '',
        ].join(' ')}
        draggable={renaming !== l.id}
        onDragStart={(e) => {
          setDragId(l.id)
          e.dataTransfer.effectAllowed = 'move'
          e.dataTransfer.setData('text/x-layer', l.id)
        }}
        onDragEnd={() => {
          setDragId(null)
          setDropAt(null)
        }}
        onDragOver={(e) => {
          if (!dragId) return
          e.preventDefault()
          const r = e.currentTarget.getBoundingClientRect()
          const t = (e.clientY - r.top) / r.height
          const zone: DropZone =
            canInto && t > 0.28 && t < 0.72 ? 'into' : t < 0.5 ? 'above' : 'below'
          if (dropAt?.id !== l.id || dropAt.zone !== zone) setDropAt({ id: l.id, zone })
        }}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node) && dropAt?.id === l.id)
            setDropAt(null)
        }}
        onDrop={(e) => {
          e.preventDefault()
          if (dragId && dropAt) onDrop(dragId, dropAt.id, dropAt.zone)
          setDragId(null)
          setDropAt(null)
        }}
        onClick={(e) => select(l.id, e)}
        onContextMenu={(e) => {
          e.preventDefault()
          if (!active) onSelect([l.id])
          onContextMenu({ x: e.clientX, y: e.clientY }, l.id)
        }}
      >
        {isMask ? (
          <button
            className="dz-layer-twisty"
            aria-label={collapsed.has(l.id) ? `Expand ${l.name}` : `Collapse ${l.name}`}
            aria-expanded={!collapsed.has(l.id)}
            onClick={(e) => {
              e.stopPropagation()
              setCollapsed((c) => {
                const n = new Set(c)
                if (n.has(l.id)) n.delete(l.id)
                else n.add(l.id)
                return n
              })
            }}
          >
            {collapsed.has(l.id) ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
          </button>
        ) : (
          <span className="dz-layer-twisty" aria-hidden="true" />
        )}
        <Thumb layer={l} version={imagesVersion} />
        {renaming === l.id ? (
          <input
            className="dz-layer-rename"
            defaultValue={l.name}
            maxLength={80}
            autoFocus
            aria-label="Layer name"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              e.stopPropagation()
              if (e.key === 'Enter') e.currentTarget.blur()
              if (e.key === 'Escape') setRenaming(null)
            }}
            onBlur={(e) => {
              const v = e.currentTarget.value.trim()
              if (v && v !== l.name) onRename(l.id, v)
              setRenaming(null)
            }}
          />
        ) : (
          <span
            className="dz-layer-name"
            title={`${l.name} · double-click to rename`}
            onDoubleClick={(e) => {
              e.stopPropagation()
              setRenaming(l.id)
            }}
          >
            <span>{l.name}</span>
            <small>{sub}</small>
          </span>
        )}
        <span className="dz-layer-actions">
          <button
            className={`icon-button sm ${l.locked ? 'is-on' : ''}`}
            aria-label={l.locked ? `Unlock ${l.name}` : `Lock ${l.name}`}
            aria-pressed={l.locked}
            title={l.locked ? 'Unlock (⇧L)' : 'Lock (⇧L)'}
            onClick={(e) => {
              e.stopPropagation()
              onToggle(l.id, 'locked')
            }}
          >
            {l.locked ? <Lock size={14} /> : <LockOpen size={14} />}
          </button>
          <button
            className={`icon-button sm ${!l.visible ? 'is-on' : ''}`}
            aria-label={l.visible ? `Hide ${l.name}` : `Show ${l.name}`}
            aria-pressed={!l.visible}
            title={l.visible ? 'Hide' : 'Show'}
            onClick={(e) => {
              e.stopPropagation()
              onToggle(l.id, 'visible')
            }}
          >
            {l.visible ? <Eye size={14} /> : <EyeOff size={14} />}
          </button>
        </span>
      </li>
    )
  }

  return (
    <ul className="dz-layers" role="listbox" aria-label="Layers" aria-multiselectable="true">
      {groups.map((g) =>
        g.clips.length ? (
          <li key={g.base.id} className="dz-group" role="presentation">
            <ul role="group" aria-label={`${g.base.name} mask group`}>
              {!collapsed.has(g.base.id) && [...g.clips].reverse().map((c) => row(c, 'clip'))}
              {row(g.base, 'base', g.clips.length)}
            </ul>
          </li>
        ) : (
          row(g.base, 'single')
        ),
      )}
    </ul>
  )
}

/* ---------- Panel ---------- */

export function LeftPanel(props: ListProps & { onClose: () => void }) {
  const { doc } = props
  return (
    <aside className="dz-left" aria-label="Layers">
      <div className="dz-left-head">
        <h2>
          Layers {doc.layers.length > 0 && <span className="count-badge">{doc.layers.length}</span>}
        </h2>
        <span className="dz-left-hint" title="Drag a layer onto another to mask it">
          Drag onto a layer to mask
        </span>
        <button
          className="icon-button sm dz-left-close"
          aria-label="Close panel"
          onClick={props.onClose}
        >
          <X size={16} />
        </button>
      </div>
      <div className="dz-left-body">
        <LayersList {...props} />
      </div>
    </aside>
  )
}
