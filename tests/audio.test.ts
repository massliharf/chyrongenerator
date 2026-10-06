import { describe, expect, it } from 'vitest'
import {
  gainAt,
  joinMusic,
  moveSegment,
  musicEnvelope,
  musicWindow,
  partAt,
  removeSegment,
  segmentsOf,
  songTimeAt,
  splitMusic,
  trimSegment,
} from '../src/studio/audio'
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
    // After the song, or before the music starts: silence.
    expect(songTimeAt(track({ length: 10, trim: 4, loop: false }), 8)).toBeNull()
    expect(songTimeAt(track({ delay: 2 }), 1)).toBeNull()
  })
  it('cuts the music at the playhead into parts that play on in place', () => {
    const t = track({ delay: 1, trim: 5 })
    const r = splitMusic(t, 10, 4)!
    const [a, b] = r.track.segments!
    expect([a.at, a.from, a.length]).toEqual([1, 5, 3])
    expect([b.at, b.from, b.length]).toEqual([4, 8, 6])
    expect(r.id).toBe(b.id)
    // The cut music sounds exactly like before.
    for (const time of [1.5, 3.9, 4.1, 9])
      expect(songTimeAt(r.track, time, 10)).toBeCloseTo(songTimeAt(t, time, 10)!)
    // No sliver parts, and nothing to cut where no music plays.
    expect(splitMusic(t, 10, 1.05)).toBeNull()
    expect(splitMusic(t, 10, 0.5)).toBeNull()
    expect(partAt(r.track, 10, 4.5)?.id).toBe(b.id)
  })
  it('removes a part, trims and moves parts without overlapping, and joins them again', () => {
    const cut = splitMusic(splitMusic(track(), 10, 3)!.track, 10, 6)!
    const [first, middle, last] = cut.track.segments!
    // Cutting out the middle leaves a gap of silence.
    const gap = removeSegment(cut.track, 10, middle.id)!
    expect(gap.segments!.map((x) => x.id)).toEqual([first.id, last.id])
    expect(songTimeAt(gap, 4, 10)).toBeNull()
    expect(musicWindow(gap, 10)).toEqual({ start: 0, end: 10 })
    // Moving the last part left stops at the first one.
    const moved = moveSegment(gap, 10, last.id, 1)
    expect(moved.segments![1].at).toBe(3)
    // Its song moves with it.
    expect(songTimeAt(moved, 3.5, 10)).toBeCloseTo(6.5)
    // Trimming the start cuts into the part; the end can't run past the next part.
    const trimmed = trimSegment(moved, 10, last.id, 'start', 4)
    expect(trimmed.segments![1]).toMatchObject({ at: 4, from: 7, length: 3 })
    const longer = trimSegment(gap, 10, first.id, 'end', 9)
    expect(longer.segments![0].length).toBe(6)
    // The last part gone, the music goes.
    expect(removeSegment(removeSegment(gap, 10, first.id)!, 10, last.id)).toBeNull()
    const joined = joinMusic(trimmed)
    expect(joined.segments).toBeUndefined()
    expect([joined.delay, joined.trim]).toEqual([0, 0])
  })
  it('keeps cut music with the project, parts in order and never overlapping', () => {
    const p = normalizeProject({
      ...DEFAULT_PROJECT,
      audio: track({
        segments: [
          { id: 'b', at: 2, from: 10, length: 3 },
          { id: 'a', at: 0, from: 0, length: 3 },
        ],
      }),
    })
    expect(p.audio!.segments).toEqual([
      { id: 'a', at: 0, from: 0, length: 3 },
      { id: 'b', at: 3, from: 10, length: 3 },
    ])
    expect(segmentsOf(p.audio!, 4).at(-1)!.length).toBe(1)
    expect(normalizeProject(JSON.parse(JSON.stringify(p)))).toEqual(p)
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
