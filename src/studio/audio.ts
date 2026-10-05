import { generateId } from '../utils/id'
import { putAsset, readAsset } from './assets'
import type { AudioTrack } from './model'

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

/** Clip seconds during which the music plays. Empty (start = end) when muted. */
export function musicWindow(track: AudioTrack, total: number) {
  const start = Math.min(total, track.delay)
  if (track.muted) return { start, end: start }
  const song = Math.max(0, track.length - track.trim)
  const end = track.loop ? total : Math.min(total, start + song)
  return { start, end: Math.max(start, end) }
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

/** Where in the song the clip is at `clipTime` (looping back to `trim` when it runs out). */
export function songTimeAt(track: AudioTrack, clipTime: number) {
  const elapsed = Math.max(0, clipTime - track.delay)
  const song = Math.max(0.001, track.length - track.trim)
  return track.trim + (track.loop ? elapsed % song : Math.min(elapsed, song))
}

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
  const { start, end } = musicWindow(track, total)
  const envelope = musicEnvelope(track, total)
  if (from >= end || !envelope.length) return () => {}
  const begin = Math.max(from, start)
  const at = (clip: number) => when + (clip - from)
  const source = context.createBufferSource()
  source.buffer = buffer
  if (track.loop) {
    source.loop = true
    source.loopStart = track.trim
    source.loopEnd = Math.min(buffer.duration, track.length)
  }
  const gain = context.createGain()
  gain.gain.setValueAtTime(gainAt(envelope, begin), at(begin))
  for (const [t, g] of envelope) if (t > begin) gain.gain.linearRampToValueAtTime(g, at(t))
  source.connect(gain).connect(destination)
  source.start(at(begin), songTimeAt(track, begin))
  source.stop(at(end))
  return () => {
    try {
      source.stop()
    } catch {
      /* Already stopped. */
    }
    source.disconnect()
    gain.disconnect()
  }
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
