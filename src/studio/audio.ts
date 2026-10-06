import { generateId } from '../utils/id'
import { putAsset, readAsset } from './assets'
import { MAX_AUDIO_SEGMENTS, type AudioSegment, type AudioTrack } from './model'

/**
 * Music for a composition. The file is stored next to the images in IndexedDB;
 * preview and export schedule it with the same function, so what you hear
 * while editing is what the video contains.
 */
export const MAX_AUDIO_BYTES = 80 * 1024 * 1024
/** Longest song accepted, in seconds. */
export const MAX_AUDIO_SECONDS = 20 * 60
const EXTENSIONS = /\.(mp3|wav|wave|m4a|aac|mp4|ogg|oga|opus|flac|webm)$/i
export const AUDIO_ACCEPT = 'audio/*,.mp3,.wav,.m4a,.aac,.ogg,.oga,.opus,.flac,.webm'
const SAMPLE_RATE = 48_000

export const isAudioFile = (file: File) =>
  file.type.startsWith('audio/') || EXTENSIONS.test(file.name)

const decoded = new Map<string, Promise<AudioBuffer | null>>()
async function decode(blob: Blob): Promise<AudioBuffer> {
  const context = new OfflineAudioContext(2, 1, SAMPLE_RATE)
  return context.decodeAudioData(await blob.arrayBuffer())
}

/** Validate, decode once and store a music file. */
export async function importAudioFile(
  file: File,
): Promise<{ id: string; name: string; length: number }> {
  if (!isAudioFile(file)) throw new Error('Choose an MP3, WAV, M4A, OGG or FLAC file.')
  if (file.size > MAX_AUDIO_BYTES) throw new Error('Choose a music file under 80 MB.')
  let buffer: AudioBuffer
  try {
    buffer = await decode(file)
  } catch {
    throw new Error(`${file.name} could not be played. Try an MP3 or WAV file.`)
  }
  if (buffer.duration > MAX_AUDIO_SECONDS) throw new Error('Choose a song up to 20 minutes long.')
  const id = generateId()
  const name = file.name.replace(/\.[a-z0-9]+$/i, '').slice(0, 80) || 'Music'
  await putAsset({ id, name, blob: file, width: 0, height: 0 })
  decoded.set(id, Promise.resolve(buffer))
  return { id, name, length: Math.round(buffer.duration * 1000) / 1000 }
}

/** The decoded song, shared by the waveform, the preview and every export. */
export function loadAudio(id: string): Promise<AudioBuffer | null> {
  let entry = decoded.get(id)
  if (!entry) {
    entry = readAsset(id)
      .then((stored) => (stored ? decode(stored.blob) : null))
      .catch(() => null)
    decoded.set(id, entry)
    void entry.then((result) => {
      if (!result) decoded.delete(id)
    })
  }
  return entry
}

/** Loudest sample per bucket across all channels, scaled so the loudest bucket is 1. */
export function audioPeaks(buffer: AudioBuffer, buckets: number): Float32Array {
  const peaks = new Float32Array(buckets)
  const size = buffer.length / buckets
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    const data = buffer.getChannelData(c)
    for (let b = 0; b < buckets; b++) {
      let max = peaks[b]
      const end = Math.min(data.length, Math.floor((b + 1) * size))
      // Sampling every few frames is plenty for a 40 px tall waveform.
      for (let i = Math.floor(b * size); i < end; i += 16) {
        const v = Math.abs(data[i])
        if (v > max) max = v
      }
      peaks[b] = max
    }
  }
  let loudest = 0
  for (const v of peaks) if (v > loudest) loudest = v
  if (loudest > 0) for (let b = 0; b < buckets; b++) peaks[b] /= loudest
  return peaks
}

/* ---------- Parts of the song in the clip ---------- */

/**
 * The parts of the song that play, in clip order and inside the clip. Music
 * that was never cut is one part from `trim` at `delay` (repeated while it
 * loops); cut music lists its parts.
 */
export function segmentsOf(track: AudioTrack, total: number): AudioSegment[] {
  const inside = (list: AudioSegment[]) =>
    list
      .filter((s) => s.at < total && s.length > 0)
      .map((s) => ({ ...s, length: Math.min(s.length, total - s.at) }))
  if (track.segments) return inside(track.segments)
  const song = Math.max(0.05, track.length - track.trim)
  const start = Math.min(total, track.delay)
  if (!track.loop) return inside([{ id: 'part-1', at: start, from: track.trim, length: song }])
  const parts: AudioSegment[] = []
  for (let at = start, i = 1; at < total && i <= 200; at += song, i++)
    parts.push({ id: `part-${i}`, at, from: track.trim, length: song })
  return inside(parts)
}

/** Clip seconds during which the music plays. Empty (start = end) when muted. */
export function musicWindow(track: AudioTrack, total: number) {
  const parts = segmentsOf(track, total)
  const start = parts.length ? parts[0].at : Math.min(total, track.delay)
  if (track.muted || !parts.length) return { start, end: start }
  const last = parts.at(-1)!
  return { start, end: Math.max(start, last.at + last.length) }
}

/** Gain over clip time as [seconds, gain] points joined by straight lines. */
export function musicEnvelope(track: AudioTrack, total: number): [number, number][] {
  const { start, end } = musicWindow(track, total)
  const span = end - start
  if (span <= 0) return []
  const volume = track.volume / 100
  let fadeIn = track.fadeIn,
    fadeOut = track.fadeOut
  // Fades longer than the music share what there is.
  if (fadeIn + fadeOut > span) {
    const k = span / (fadeIn + fadeOut)
    fadeIn *= k
    fadeOut *= k
  }
  return [
    [start, fadeIn > 0 ? 0 : volume],
    [start + fadeIn, volume],
    [end - fadeOut, volume],
    [end, fadeOut > 0 ? 0 : volume],
  ]
}

export function gainAt(envelope: [number, number][], t: number) {
  if (!envelope.length || t < envelope[0][0] || t > envelope.at(-1)![0]) return 0
  for (let i = 1; i < envelope.length; i++) {
    const [t0, g0] = envelope[i - 1],
      [t1, g1] = envelope[i]
    if (t <= t1) return t1 > t0 ? g0 + ((g1 - g0) * (t - t0)) / (t1 - t0) : g1
  }
  return envelope.at(-1)![1]
}

/** Where in the song the clip is at `clipTime`, or null between parts (silence). */
export function songTimeAt(track: AudioTrack, clipTime: number, total = Infinity) {
  const part = segmentsOf(track, total).find((s) => clipTime >= s.at && clipTime < s.at + s.length)
  return part ? part.from + (clipTime - part.at) : null
}

/** A cut is this short a ramp, so parts start and stop without a click. */
const DECLICK = 0.006

/**
 * Play the music from clip time `from`, starting at context time `when`.
 * Used for the live preview and, on an OfflineAudioContext, for the export.
 */
export function scheduleMusic(
  context: BaseAudioContext,
  buffer: AudioBuffer,
  track: AudioTrack,
  total: number,
  from: number,
  when: number,
  destination: AudioNode = context.destination,
) {
  const { end } = musicWindow(track, total)
  const envelope = musicEnvelope(track, total)
  if (from >= end || !envelope.length) return () => {}
  const at = (clip: number) => when + (clip - from)
  // The whole track: volume and the fades at its ends.
  const master = context.createGain()
  master.gain.setValueAtTime(gainAt(envelope, from), at(from))
  for (const [t, g] of envelope) if (t > from) master.gain.linearRampToValueAtTime(g, at(t))
  master.connect(destination)
  const nodes: AudioNode[] = [master]
  const sources: AudioBufferSourceNode[] = []
  for (const part of segmentsOf(track, total)) {
    const partEnd = part.at + part.length
    if (partEnd <= from) continue
    const begin = Math.max(from, part.at)
    const source = context.createBufferSource()
    source.buffer = buffer
    const edge = context.createGain()
    // Each part fades in and out over a few milliseconds where it was cut.
    const ramp = Math.min(DECLICK, part.length / 4)
    edge.gain.setValueAtTime(begin > part.at ? 1 : 0, at(begin))
    if (begin === part.at) edge.gain.linearRampToValueAtTime(1, at(part.at + ramp))
    edge.gain.setValueAtTime(1, at(Math.max(begin, partEnd - ramp)))
    edge.gain.linearRampToValueAtTime(0, at(partEnd))
    source.connect(edge).connect(master)
    source.start(at(begin), Math.min(buffer.duration, part.from + (begin - part.at)))
    source.stop(at(partEnd))
    sources.push(source)
    nodes.push(edge)
  }
  return () => {
    for (const source of sources) {
      try {
        source.stop()
      } catch {
        /* Already stopped. */
      }
      source.disconnect()
    }
    for (const node of nodes) node.disconnect()
  }
}

/* ---------- Cutting ---------- */

/** Shortest part a cut leaves, in seconds. */
export const MIN_PART = 0.1
let partCounter = 0
const partId = () => `part-${Date.now().toString(36)}-${(partCounter++).toString(36)}`

/** The track with its parts written out (cutting starts from what plays now). */
export function withSegments(track: AudioTrack, total: number): AudioTrack {
  if (track.segments) return track
  return {
    ...track,
    loop: false,
    segments: segmentsOf(track, total).map((s) => ({ ...s, id: partId() })),
  }
}
const sorted = (parts: AudioSegment[]) => [...parts].sort((a, b) => a.at - b.at)

/** The part under clip time `time`, if any. */
export function partAt(track: AudioTrack, total: number, time: number) {
  return segmentsOf(track, total).find((s) => time > s.at && time < s.at + s.length) ?? null
}

/**
 * Cuts the music at clip time `time`: the part playing there becomes two.
 * Returns the new track and the id of the right-hand part, or null when no
 * part plays there (or the cut would leave a sliver).
 */
export function splitMusic(track: AudioTrack, total: number, time: number) {
  const full = withSegments(track, total)
  const parts = full.segments!
  const part = parts.find((s) => time > s.at && time < s.at + s.length)
  if (!part || parts.length >= MAX_AUDIO_SEGMENTS) return null
  const left = time - part.at
  if (left < MIN_PART || part.length - left < MIN_PART) return null
  const right: AudioSegment = {
    id: partId(),
    at: time,
    from: part.from + left,
    length: part.length - left,
  }
  return {
    track: {
      ...full,
      segments: sorted([...parts.filter((s) => s !== part), { ...part, length: left }, right]),
    },
    id: right.id,
  }
}

/** Room a part has to move or grow: between its neighbours, inside the clip. */
function room(parts: AudioSegment[], id: string, total: number) {
  const i = parts.findIndex((s) => s.id === id)
  return {
    index: i,
    min: i > 0 ? parts[i - 1].at + parts[i - 1].length : 0,
    max: i < parts.length - 1 ? parts[i + 1].at : total,
  }
}

/** Slides a part along the clip; it stops at its neighbours. */
export function moveSegment(track: AudioTrack, total: number, id: string, at: number) {
  const full = withSegments(track, total)
  const parts = full.segments!
  const { index, min, max } = room(parts, id, total)
  if (index < 0) return track
  const part = parts[index]
  const next = Math.max(min, Math.min(at, max - Math.min(part.length, max - min)))
  return { ...full, segments: parts.map((s) => (s.id === id ? { ...s, at: next } : s)) }
}

/**
 * Moves one end of a part to clip time `time`: the start cuts (or uncovers)
 * the beginning of the part, keeping the rest in place; the end shortens or
 * lengthens it, as far as the song and the neighbours allow.
 */
export function trimSegment(
  track: AudioTrack,
  total: number,
  id: string,
  edge: 'start' | 'end',
  time: number,
) {
  const full = withSegments(track, total)
  const parts = full.segments!
  const { index, min, max } = room(parts, id, total)
  if (index < 0) return track
  const part = parts[index]
  const partEnd = part.at + part.length
  let next: AudioSegment
  if (edge === 'start') {
    // Can't start before the song does, or before the part on the left.
    const at = Math.max(min, part.at - part.from, Math.min(time, partEnd - MIN_PART))
    next = { ...part, at, from: part.from + (at - part.at), length: partEnd - at }
  } else {
    const end = Math.min(
      max,
      part.at + (full.length - part.from),
      Math.max(time, part.at + MIN_PART),
    )
    next = { ...part, length: end - part.at }
  }
  return { ...full, segments: parts.map((s) => (s.id === id ? next : s)) }
}

/** Removes a part; null when it was the last one (the music goes). */
export function removeSegment(track: AudioTrack, total: number, id: string) {
  const full = withSegments(track, total)
  const parts = full.segments!.filter((s) => s.id !== id)
  return parts.length ? { ...full, segments: parts } : null
}

/** One part again: the song from where the first part plays, at its place. */
export function joinMusic(track: AudioTrack): AudioTrack {
  if (!track.segments?.length) return track
  const first = track.segments[0]
  const rest = { ...track }
  delete rest.segments
  return { ...rest, delay: first.at, trim: first.from }
}

/** The music exactly as it sounds in a `seconds`-long clip, at 48 kHz stereo. */
export async function renderMusic(buffer: AudioBuffer, track: AudioTrack, seconds: number) {
  const context = new OfflineAudioContext(
    2,
    Math.max(1, Math.round(seconds * SAMPLE_RATE)),
    SAMPLE_RATE,
  )
  scheduleMusic(context, buffer, track, seconds, 0, 0)
  return context.startRendering()
}

/** 16-bit PCM WAV of an audio buffer. */
export function encodeWav(buffer: AudioBuffer): Uint8Array<ArrayBuffer> {
  const channels = buffer.numberOfChannels
  const frames = buffer.length
  const bytes = new Uint8Array(44 + frames * channels * 2)
  const view = new DataView(bytes.buffer)
  const text = (offset: number, value: string) =>
    [...value].forEach((c, i) => view.setUint8(offset + i, c.charCodeAt(0)))
  text(0, 'RIFF')
  view.setUint32(4, 36 + frames * channels * 2, true)
  text(8, 'WAVE')
  text(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, channels, true)
  view.setUint32(24, buffer.sampleRate, true)
  view.setUint32(28, buffer.sampleRate * channels * 2, true)
  view.setUint16(32, channels * 2, true)
  view.setUint16(34, 16, true)
  text(36, 'data')
  view.setUint32(40, frames * channels * 2, true)
  const data = Array.from({ length: channels }, (_, c) => buffer.getChannelData(c))
  let offset = 44
  for (let i = 0; i < frames; i++)
    for (let c = 0; c < channels; c++) {
      const v = Math.max(-1, Math.min(1, data[c][i]))
      view.setInt16(offset, v < 0 ? v * 0x8000 : v * 0x7fff, true)
      offset += 2
    }
  return bytes
}

/** The mixed music for a clip as a WAV file, or null when there is none to hear. */
export async function musicWav(track: AudioTrack | undefined, seconds: number) {
  if (!track || track.muted || track.volume <= 0) return null
  const buffer = await loadAudio(track.assetId)
  if (!buffer) throw new Error(`${track.name} could not be loaded. Add the music again.`)
  return encodeWav(await renderMusic(buffer, track, seconds))
}
