import {
  ArrowDownToLine,
  ArrowUpToLine,
  ChevronDown,
  ChevronUp,
  Copy,
  Crop,
  Eye,
  EyeOff,
  Lock,
  LockOpen,
  PenLine,
  Replace,
  TextCursorInput,
  Trash2,
  Volume2,
  VolumeX,
  WandSparkles,
} from 'lucide-react'
import type { MenuEntry, MenuPoint } from './Menu'
import type { Project } from '../studio/model'

/** Selection id of the music track. */
export const MUSIC = 'audio'

/** Where a menu opened from a button goes: below it, or above when there is no room. */
export const belowButton = (button: Element): MenuPoint => {
  const r = button.getBoundingClientRect()
  return { x: r.left, y: r.bottom + 4, flipX: r.right, flipY: r.top - 4 }
}

/** What a layer menu can do. Optional commands leave their item out. */
export interface LayerCommands {
  move: (id: string, to: 1 | -1 | 'front' | 'back') => void
  toggleVisible: (id: string) => void
  toggleLock: (id: string) => void
  rename: (id: string) => void
  duplicate: (id: string) => void
  remove: (id: string) => void
  editText?: (id: string) => void
  crop?: (id: string) => void
  removeBackground?: (id: string) => void
  replaceImage?: (id: string) => void
  replaceMusic?: () => void
  toggleMute?: () => void
}

/**
 * Every action for one layer (or the music track), in one order everywhere:
 * the timeline row, a right-click on the canvas or the row, and the ⋯ menu in
 * Properties all show this list.
 */
export function layerMenu(p: Project, id: string, c: LayerCommands): MenuEntry[] {
  if (id === MUSIC) {
    if (!p.audio) return []
    return [
      ...(c.replaceMusic
        ? [{ label: 'Replace music', Icon: Replace, onSelect: c.replaceMusic }]
        : []),
      ...(c.toggleMute
        ? [
            {
              label: p.audio.muted ? 'Unmute' : 'Mute',
              Icon: p.audio.muted ? Volume2 : VolumeX,
              onSelect: c.toggleMute,
            },
          ]
        : []),
      'separator',
      {
        label: 'Remove music',
        Icon: Trash2,
        shortcut: 'Del',
        danger: true,
        onSelect: () => c.remove(MUSIC),
      },
    ]
  }
  const index = p.layers.findIndex((l) => l.id === id)
  const layer = p.layers[index]
  if (!layer) return []
  const front = index === p.layers.length - 1
  const back = index === 0
  const edit: MenuEntry[] = []
  if (layer.kind === 'chyron' && c.editText)
    edit.push({
      label: 'Edit text',
      Icon: PenLine,
      hint: 'Or double-click it',
      onSelect: () => c.editText!(id),
    })
  if (layer.kind === 'image') {
    if (c.crop) edit.push({ label: 'Crop', Icon: Crop, shortcut: 'C', onSelect: () => c.crop!(id) })
    if (c.removeBackground)
      edit.push({
        label: 'Remove background',
        Icon: WandSparkles,
        onSelect: () => c.removeBackground!(id),
      })
    if (c.replaceImage)
      edit.push({ label: 'Replace image…', Icon: Replace, onSelect: () => c.replaceImage!(id) })
  }
  return [
    ...edit,
    ...(edit.length ? (['separator'] as const) : []),
    {
      label: 'Bring to front',
      Icon: ArrowUpToLine,
      shortcut: '⇧ ]',
      disabled: front,
      onSelect: () => c.move(id, 'front'),
    },
    {
      label: 'Bring forward',
      Icon: ChevronUp,
      shortcut: ']',
      disabled: front,
      onSelect: () => c.move(id, 1),
    },
    {
      label: 'Send backward',
      Icon: ChevronDown,
      shortcut: '[',
      disabled: back,
      onSelect: () => c.move(id, -1),
    },
    {
      label: 'Send to back',
      Icon: ArrowDownToLine,
      shortcut: '⇧ [',
      disabled: back,
      onSelect: () => c.move(id, 'back'),
    },
    'separator',
    {
      label: layer.visible ? 'Hide' : 'Show',
      Icon: layer.visible ? EyeOff : Eye,
      shortcut: 'H',
      onSelect: () => c.toggleVisible(id),
    },
    {
      label: layer.locked ? 'Unlock' : 'Lock',
      Icon: layer.locked ? LockOpen : Lock,
      hint: layer.locked ? undefined : 'The canvas ignores it',
      onSelect: () => c.toggleLock(id),
    },
    { label: 'Rename', Icon: TextCursorInput, onSelect: () => c.rename(id) },
    'separator',
    { label: 'Duplicate layer', Icon: Copy, shortcut: '⌘ D', onSelect: () => c.duplicate(id) },
    {
      label: 'Delete layer',
      Icon: Trash2,
      shortcut: 'Del',
      danger: true,
      onSelect: () => c.remove(id),
    },
  ]
}
