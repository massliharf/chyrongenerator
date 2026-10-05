import { describe, expect, it, vi } from 'vitest'
import {
  CHYRON_LAYER,
  DEFAULT_AUDIO,
  DEFAULT_IMAGE_LAYER,
  DEFAULT_PROJECT,
  DEFAULT_SHAPE_LAYER,
  type Layer,
  type Project,
} from '../src/studio/model'
import { layerMenu, MUSIC, type LayerCommands } from '../src/components/layerMenu'
import type { MenuEntry } from '../src/components/Menu'

const shape: Layer = { ...DEFAULT_SHAPE_LAYER, id: 'bar', name: 'Bar' }
const image: Layer = {
  ...DEFAULT_IMAGE_LAYER,
  id: 'logo',
  assetId: 'asset-1',
  name: 'Logo',
  aspect: 0.5,
}
// Back to front: shape, chyron, image.
const project: Project = { ...DEFAULT_PROJECT, layers: [shape, CHYRON_LAYER, image] }

const commands = (): LayerCommands => ({
  move: vi.fn(),
  toggleVisible: vi.fn(),
  toggleLock: vi.fn(),
  rename: vi.fn(),
  duplicate: vi.fn(),
  remove: vi.fn(),
  editText: vi.fn(),
  crop: vi.fn(),
  removeBackground: vi.fn(),
  replaceImage: vi.fn(),
  replaceMusic: vi.fn(),
  toggleMute: vi.fn(),
})
const labels = (items: MenuEntry[]) => items.map((i) => (i === 'separator' ? '—' : i.label))
const item = (items: MenuEntry[], label: string) => {
  const found = items.find((i) => i !== 'separator' && i.label === label)
  if (!found || found === 'separator') throw new Error(`No ${label}`)
  return found
}

describe('layer menu', () => {
  it('lists the same arrange, visibility and edit actions for every layer', () => {
    const common = [
      'Bring to front',
      'Bring forward',
      'Send backward',
      'Send to back',
      '—',
      'Hide',
      'Lock',
      'Rename',
      '—',
      'Duplicate layer',
      'Delete layer',
    ]
    expect(labels(layerMenu(project, 'bar', commands()))).toEqual(common)
    expect(labels(layerMenu(project, CHYRON_LAYER.id, commands()))).toEqual([
      'Edit text',
      '—',
      ...common,
    ])
    expect(labels(layerMenu(project, 'logo', commands()))).toEqual([
      'Crop',
      'Remove background',
      'Replace image…',
      '—',
      ...common,
    ])
  })

  it('disables moves past the front or the back of the stack', () => {
    const back = layerMenu(project, 'bar', commands())
    expect(item(back, 'Send backward').disabled).toBe(true)
    expect(item(back, 'Send to back').disabled).toBe(true)
    expect(item(back, 'Bring to front').disabled).toBe(false)
    const front = layerMenu(project, 'logo', commands())
    expect(item(front, 'Bring forward').disabled).toBe(true)
    expect(item(front, 'Bring to front').disabled).toBe(true)
    expect(item(front, 'Send to back').disabled).toBe(false)
  })

  it('runs the command for the layer it was opened on', () => {
    const c = commands()
    const items = layerMenu(project, CHYRON_LAYER.id, c)
    item(items, 'Send to back').onSelect()
    expect(c.move).toHaveBeenCalledWith(CHYRON_LAYER.id, 'back')
    item(items, 'Bring forward').onSelect()
    expect(c.move).toHaveBeenCalledWith(CHYRON_LAYER.id, 1)
    item(items, 'Delete layer').onSelect()
    expect(c.remove).toHaveBeenCalledWith(CHYRON_LAYER.id)
    item(items, 'Rename').onSelect()
    expect(c.rename).toHaveBeenCalledWith(CHYRON_LAYER.id)
    expect(item(items, 'Delete layer').danger).toBe(true)
  })

  it('offers Show and Unlock for hidden and locked layers', () => {
    const hidden = { ...project, layers: [{ ...shape, visible: false, locked: true }] }
    const items = layerMenu(hidden, 'bar', commands())
    expect(labels(items)).toContain('Show')
    expect(labels(items)).toContain('Unlock')
    expect(labels(items)).not.toContain('Hide')
  })

  it('leaves out actions the editor does not provide', () => {
    const { crop, removeBackground, replaceImage, ...rest } = commands()
    void crop
    void removeBackground
    void replaceImage
    expect(labels(layerMenu(project, 'logo', rest))[0]).toBe('Bring to front')
  })

  it('has its own menu for the music track', () => {
    const withMusic: Project = {
      ...project,
      audio: { ...DEFAULT_AUDIO, assetId: 'song', name: 'Song', length: 30 },
    }
    const c = commands()
    const items = layerMenu(withMusic, MUSIC, c)
    expect(labels(items)).toEqual(['Replace music', 'Mute', '—', 'Remove music'])
    item(items, 'Remove music').onSelect()
    expect(c.remove).toHaveBeenCalledWith(MUSIC)
    expect(layerMenu(project, MUSIC, c)).toEqual([])
  })

  it('is empty for a layer that no longer exists', () => {
    expect(layerMenu(project, 'gone', commands())).toEqual([])
  })
})
