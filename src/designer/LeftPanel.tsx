import { useEffect, useRef, useState } from 'react'
import {
  CornerDownRight,
  Eye,
  EyeOff,
  FolderOpen,
  Heading1,
  Heading2,
  Image as ImageIcon,
  Lock,
  LockOpen,
  Square,
  Circle,
  Type,
  Upload,
  Layers as LayersIcon,
} from 'lucide-react'
import type { DesignDoc, Layer, TextPreset } from './model'
import { drawThumb } from './render'

function Thumb({ layer, version }: { layer: Layer; version: number }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    if (ref.current) drawThumb(ref.current, layer)
  }, [layer, version])
  return <canvas ref={ref} width={56} height={56} className="dz-layer-thumb" aria-hidden="true" />
}

const KIND_LABEL: Record<Layer['kind'], string> = {
  image: 'Image',
  text: 'Text',
  rect: 'Rectangle',
  ellipse: 'Ellipse',
}

export function LayersList({
  doc,
  selection,
  imagesVersion,
  onSelect,
  onToggle,
  onRename,
  onMove,
  onContextMenu,
}: {
  doc: DesignDoc
  selection: string[]
  imagesVersion: number
  onSelect: (ids: string[]) => void
  onToggle: (id: string, key: 'visible' | 'locked') => void
  onRename: (id: string, name: string) => void
  onMove: (id: string, index: number) => void
  onContextMenu: (at: { x: number; y: number }, id: string) => void
}) {
  const [renaming, setRenaming] = useState<string | null>(null)
  const [dragId, setDragId] = useState<string | null>(null)
  const [dropAt, setDropAt] = useState<{ id: string; after: boolean } | null>(null)
  const anchor = useRef<string | null>(null)
  // Top of the list is the front of the stack.
  const rows = [...doc.layers].reverse()

  if (!rows.length)
    return (
      <div className="dz-empty-layers">
        <LayersIcon size={28} strokeWidth={1.5} aria-hidden="true" />
        <strong>No layers yet</strong>
        <span>Add an image, text or a shape from Insert, or drop files on the artboard.</span>
      </div>
    )

  const select = (id: string, e: React.MouseEvent) => {
    if (e.shiftKey && anchor.current) {
      const a = rows.findIndex((r) => r.id === anchor.current)
      const b = rows.findIndex((r) => r.id === id)
      const [lo, hi] = a < b ? [a, b] : [b, a]
      onSelect(rows.slice(lo, hi + 1).map((r) => r.id))
      return
    }
    if (e.metaKey || e.ctrlKey) {
      onSelect(selection.includes(id) ? selection.filter((s) => s !== id) : [...selection, id])
      anchor.current = id
      return
    }
    anchor.current = id
    onSelect([id])
  }

  return (
    <ul className="dz-layers" role="listbox" aria-label="Layers" aria-multiselectable="true">
      {rows.map((l) => {
        const active = selection.includes(l.id)
        return (
          <li
            key={l.id}
            role="option"
            aria-selected={active}
            className={[
              'dz-layer',
              active ? 'is-selected' : '',
              !l.visible ? 'is-hidden' : '',
              l.clip ? 'is-clipped' : '',
              dragId === l.id ? 'is-dragging' : '',
              dropAt?.id === l.id ? (dropAt.after ? 'drop-after' : 'drop-before') : '',
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
              setDropAt({ id: l.id, after: e.clientY > r.top + r.height / 2 })
            }}
            onDrop={(e) => {
              e.preventDefault()
              if (!dragId || !dropAt) return
              // Rows are reversed: "after" in the list is "below" in the stack.
              const without = doc.layers.filter((x) => x.id !== dragId)
              const target = without.findIndex((x) => x.id === dropAt.id)
              onMove(dragId, dropAt.after ? target : target + 1)
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
            {l.clip && (
              <CornerDownRight
                size={14}
                className="dz-clip-icon"
                aria-label="Clipped to the layer below"
              />
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
                <small>{l.clip ? 'Clipped' : l.maskOnly ? 'Mask' : KIND_LABEL[l.kind]}</small>
              </span>
            )}
            <span className="dz-layer-actions">
              <button
                className={`icon-button sm ${l.locked ? 'is-on' : ''}`}
                aria-label={l.locked ? `Unlock ${l.name}` : `Lock ${l.name}`}
                aria-pressed={l.locked}
                title={l.locked ? 'Unlock' : 'Lock'}
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
                title={l.visible ? 'Hide (H)' : 'Show (H)'}
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
      })}
    </ul>
  )
}

export function InsertPanel({
  onUpload,
  onGallery,
  onText,
  onShape,
}: {
  onUpload: () => void
  onGallery: () => void
  onText: (preset: TextPreset) => void
  onShape: (kind: 'rect' | 'ellipse') => void
}) {
  return (
    <div className="dz-insert">
      <section>
        <h3 className="panel-block-title">Images</h3>
        <div className="dz-insert-grid">
          <button className="dz-insert-tile" onClick={onUpload}>
            <Upload size={20} aria-hidden="true" />
            <span>Upload</span>
            <small>PNG, JPEG, WebP, GIF</small>
          </button>
          <button className="dz-insert-tile" onClick={onGallery}>
            <FolderOpen size={20} aria-hidden="true" />
            <span>Media gallery</span>
            <small>Hosts & backgrounds</small>
          </button>
        </div>
        <p className="field-hint">You can also drop or paste images onto the artboard.</p>
      </section>
      <section>
        <h3 className="panel-block-title">Text</h3>
        <div className="dz-text-presets">
          <button className="dz-text-preset is-heading" onClick={() => onText('heading')}>
            <Heading1 size={18} aria-hidden="true" /> Add a heading
          </button>
          <button className="dz-text-preset is-sub" onClick={() => onText('subheading')}>
            <Heading2 size={18} aria-hidden="true" /> Add a subheading
          </button>
          <button className="dz-text-preset" onClick={() => onText('body')}>
            <Type size={18} aria-hidden="true" /> Add body text
          </button>
        </div>
      </section>
      <section>
        <h3 className="panel-block-title">Shapes</h3>
        <div className="dz-insert-grid">
          <button className="dz-insert-tile" onClick={() => onShape('rect')}>
            <Square size={20} aria-hidden="true" />
            <span>Rectangle</span>
            <small>R</small>
          </button>
          <button className="dz-insert-tile" onClick={() => onShape('ellipse')}>
            <Circle size={20} aria-hidden="true" />
            <span>Ellipse</span>
            <small>O</small>
          </button>
        </div>
        <p className="field-hint">
          Shapes double as masks: put one under an image and choose{' '}
          <ImageIcon size={12} aria-hidden="true" /> Clip to layer below.
        </p>
      </section>
    </div>
  )
}
