import { describe, expect, it } from 'vitest'
import { gainAt, musicEnvelope, musicWindow, songTimeAt } from '../src/studio/audio'
import {
  DEFAULT_AUDIO,
  DEFAULT_PROJECT,
  normalizeAudio,
  normalizeProject,
  type AudioTrack,
} from '../src/studio/model'
import { projectAssets, referencedAssets } from '../src/studio/assets'

const track = (over: Partial<AudioTrack> = {}): AudioTrack => ({
  ...DEFAULT_AUDIO,
  assetId: 'song',
  name: 'Song',
  length: 30,
  ...over,
})

describe('music track', () => {
  it('normalizes and round-trips with the project', () => {
    const p = normalizeProject({ ...DEFAULT_PROJECT, audio: track({ volume: 900, trim: 99 }) })
    expect(p.audio).toMatchObject({ volume: 200, trim: 29.9, loop: true })
    expect(normalizeProject(JSON.parse(JSON.stringify(p)))).toEqual(p)
    expect(normalizeAudio({ assetId: '../x', length: 3 })).toBeNull()
    expect(normalizeAudio({ assetId: 'a', length: 0 })).toBeNull()
    // Removing the music clears it.
    expect('audio' in normalizeProject({ ...p, audio: undefined })).toBe(false)
  })
  it('plays from its start time to the end of the clip, or of the song', () => {
    expect(musicWindow(track({ delay: 1 }), 10)).toEqual({ start: 1, end: 10 })
    expect(musicWindow(track({ length: 4, loop: false }), 10)).toEqual({ start: 0, end: 4 })
    expect(musicWindow(track({ length: 4, trim: 1, loop: false }), 10)).toEqual({
      start: 0,
      end: 3,
    })
    expect(musicWindow(track({ muted: true }), 10)).toEqual({ start: 0, end: 0 })
  })
  it('fades in and out, sharing short music between both fades', () => {
    const e = musicEnvelope(track({ fadeIn: 1, fadeOut: 2, volume: 50 }), 10)
    expect(gainAt(e, 0)).toBe(0)
    expect(gainAt(e, 0.5)).toBeCloseTo(0.25)
    expect(gainAt(e, 5)).toBeCloseTo(0.5)
    expect(gainAt(e, 9)).toBeCloseTo(0.25)
    expect(gainAt(e, 10)).toBeCloseTo(0)
    const short = musicEnvelope(track({ fadeIn: 3, fadeOut: 3 }), 2)
    expect(short[1][0]).toBeCloseTo(1)
    expect(gainAt(short, 1)).toBeCloseTo(1)
    expect(musicEnvelope(track({ muted: true }), 10)).toEqual([])
  })
  it('maps clip time to song time with trim and loop', () => {
    expect(songTimeAt(track({ trim: 5, delay: 1 }), 3)).toBe(7)
    expect(songTimeAt(track({ length: 10, trim: 4, loop: true }), 8)).toBe(6)
    expect(songTimeAt(track({ length: 10, trim: 4, loop: false }), 8)).toBe(10)
    expect(songTimeAt(track({ delay: 2 }), 1)).toBe(0)
  })
  it('keeps the music file and removed-background originals from being cleaned up', () => {
    const p = normalizeProject({
      ...DEFAULT_PROJECT,
      audio: track(),
      layers: [
        ...DEFAULT_PROJECT.layers,
        { kind: 'image', id: 'i', assetId: 'cut', originalAssetId: 'orig', aspect: 1 },
      ],
    })
    expect(projectAssets(p).sort()).toEqual(['cut', 'orig', 'song'])
    expect(referencedAssets([p])).toContain('song')
  })
})
