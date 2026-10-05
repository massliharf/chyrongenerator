import { strToU8, Zip, ZipPassThrough } from 'fflate'
import {
  chyronLayers,
  duration,
  fileStem,
  frameCount,
  frameTime,
  hasArtwork,
  imageLayers,
  styleOf,
  type Project,
} from './model'
import { buildScenes, renderComposition, renderSvg } from './renderer'
import { blobToDataUrl, embedAssets, loadProjectImages, readAsset } from './assets'
import { loadFontSet } from './fonts'
import { musicWav } from './audio'

export type ExportFormat = 'webm' | 'mov' | 'sequence' | 'png' | 'svg'
export interface ExportProgress {
  progress: number
  label: string
}
export interface ExportOptions {
  /** Mix the music track into video files and add it to PNG sequences. */
  music?: boolean
}
type Progress = (value: ExportProgress) => void

/*
 * Yield to the browser between frames without timers. Browsers throttle
 * setTimeout in background tabs (to once a second, then once a minute), which
 * used to stall exports as soon as the window lost focus; messages are not
 * throttled, so the export keeps its pace when you switch apps.
 */
let channel: MessageChannel | null = null
const waiting: (() => void)[] = []
export function yieldToBrowser(): Promise<void> {
  if (typeof MessageChannel === 'undefined') return new Promise((r) => setTimeout(r, 0))
  if (!channel) {
    channel = new MessageChannel()
    channel.port1.onmessage = () => waiting.shift()?.()
  }
  return new Promise<void>((resolve) => {
    waiting.push(resolve)
    channel!.port2.postMessage(null)
  })
}

/**
 * Keep the tab working while `run` lasts: a shared Web Lock asks the browser
 * not to freeze or discard it in the background, and a screen wake lock (while
 * visible) stops the display from sleeping during long exports.
 */
export async function keepAwake<T>(run: () => Promise<T>): Promise<T> {
  let wake: { release: () => Promise<void> } | null = null
  const nav = navigator as Navigator & {
    wakeLock?: { request: (type: 'screen') => Promise<{ release: () => Promise<void> }> }
  }
  try {
    if (document.visibilityState === 'visible')
      wake = (await nav.wakeLock?.request('screen')) ?? null
  } catch {
    /* Optional. */
  }
  try {
    if (nav.locks?.request)
      return await nav.locks.request('chyron-studio-export', { mode: 'shared' }, run)
    return await run()
  } finally {
    void wake?.release().catch(() => {})
  }
}

const checkAbort = (signal: AbortSignal) => {
  if (signal.aborted) throw new DOMException('Export cancelled', 'AbortError')
}
export function canvasBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) =>
        blob
          ? resolve(blob)
          : reject(new Error('Unable to render this frame. Try a smaller resolution.')),
      'image/png',
    ),
  )
}
export function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.append(link)
  link.click()
  link.remove()
  // Leave enough time for Safari and large files to start their download.
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

/**
 * Video is encoded in browser memory, so its length is budgeted in pixels ×
 * frames. WebM is encoded in segments that are joined at the end, so only one
 * segment's PNG frames exist at a time: Full HD for 40 seconds at 30 fps,
 * 720 × 1280 for 90. ProRes stores every frame whole, and joining segments
 * would hold the video twice, so it is encoded in one pass with the earlier
 * budget: Full HD for 20 seconds, 720 × 1280 for 45.
 */
const PIXEL_FRAMES = { webm: 1920 * 1080 * 1200, mov: 1920 * 1080 * 600 }
export const MAX_VIDEO_FRAMES = 3600
const MAX_VIDEO_PIXELS = 1920 * 1080
type VideoFormat = keyof typeof PIXEL_FRAMES
/** Frames encoded per WebM segment: about 240 megapixels of PNG input at a time. */
export const segmentFrames = (p: Pick<Project, 'width' | 'height'>) =>
  Math.max(30, Math.floor(240e6 / (p.width * p.height)))
const maxVideoFrames = (p: Project, format: VideoFormat) =>
  Math.floor(Math.min(MAX_VIDEO_FRAMES, PIXEL_FRAMES[format] / (p.width * p.height)))
/** Longest video export, in seconds, at the project's size and frame rate. */
export const maxVideoSeconds = (p: Project, format: VideoFormat = 'webm') =>
  Math.floor(maxVideoFrames(p, format) / p.fps)

export function exportAvailability(format: ExportFormat, p: Project): string | null {
  const video = format === 'mov' || format === 'webm'
  if (video && p.width * p.height > MAX_VIDEO_PIXELS)
    return 'Video exports support up to 1920 × 1080 in the browser. Choose Full HD, or use a PNG sequence for larger frames.'
  if (video && frameCount(p) > maxVideoFrames(p, format))
    return `At ${p.width} × ${p.height} and ${p.fps} fps, ${format === 'mov' ? 'ProRes' : 'WebM'} videos can be up to ${maxVideoSeconds(p, format)} seconds${format === 'mov' && maxVideoSeconds(p, 'webm') > maxVideoSeconds(p, 'mov') ? ` (WebM up to ${maxVideoSeconds(p, 'webm')})` : ''}. Shorten the hold, lower the frame rate or size, or choose a PNG sequence.`
  if (!hasArtwork(p)) return 'Add a title, a subtitle, a shape or a visible image before exporting.'
  return null
}

const frameName = (i: number) => `frame-${String(i).padStart(5, '0')}.png`

export async function exportProject(
  p: Project,
  format: ExportFormat,
  time: number,
  signal: AbortSignal,
  progress: Progress,
  options: ExportOptions = {},
): Promise<{ blob: Blob; filename: string }> {
  const unavailable = exportAvailability(format, p)
  if (unavailable) throw new Error(unavailable)
  progress({ progress: 0, label: 'Preparing your composition…' })
  const fonts = await loadFontSet(chyronLayers(p).map((l) => styleOf(p, l).font))
  checkAbort(signal)
  const scenes = buildScenes(p, fonts)
  const name = fileStem(p.name)
  const visibleImages = imageLayers(p).filter((l) => l.visible)
  if (format === 'svg') {
    const urls = new Map<string, string>()
    for (const l of visibleImages) {
      if (urls.has(l.assetId)) continue
      const stored = await readAsset(l.assetId)
      if (stored) urls.set(l.assetId, await blobToDataUrl(stored.blob))
    }
    checkAbort(signal)
    return {
      blob: new Blob([renderSvg(scenes, p, time, urls)], { type: 'image/svg+xml' }),
      filename: `${name}.svg`,
    }
  }
  const images = await loadProjectImages(p)
  checkAbort(signal)
  const lost = visibleImages.filter((l) => !images.has(l.assetId))
  if (lost.length)
    throw new Error(
      `${lost.map((l) => l.name).join(', ')} could not be loaded. Upload the image again, or hide that layer.`,
    )
  const canvas = document.createElement('canvas')
  canvas.width = p.width
  canvas.height = p.height
  const context = canvas.getContext('2d', { alpha: true })
  if (!context)
    throw new Error('Your browser could not create a canvas. Please reload and try again.')
  const render = (t: number) => renderComposition(context, scenes, p, t, images)
  const framePng = async (i: number) => {
    render(frameTime(i, p))
    return new Uint8Array(await (await canvasBlob(canvas)).arrayBuffer())
  }
  if (format === 'png') {
    render(time)
    return { blob: await canvasBlob(canvas), filename: `${name}.png` }
  }
  const count = frameCount(p)
  const seconds = count / p.fps
  let music: Uint8Array<ArrayBuffer> | null = null
  if (options.music !== false && p.audio) {
    progress({ progress: 0.01, label: 'Mixing the music…' })
    music = await musicWav(p.audio, seconds)
  }
  checkAbort(signal)
  let cancelEncoder: (() => void) | undefined
  signal.addEventListener('abort', () => cancelEncoder?.(), { once: true })
  try {
    if (format === 'sequence') {
      const chunks: Uint8Array<ArrayBuffer>[] = []
      let zipError: Error | null = null
      const zip = new Zip((error, data) => {
        if (error) zipError = error
        else chunks.push(new Uint8Array(data))
      })
      const add = (filename: string, data: Uint8Array) => {
        const entry = new ZipPassThrough(filename)
        zip.add(entry)
        entry.push(data, true)
      }
      const assets = imageLayers(p).length || p.audio ? await embedAssets(p) : undefined
      add('project.chyron.json', strToU8(JSON.stringify({ ...p, assets }, null, 2)))
      if (music) add('music.wav', music)
      const withMusic = music ? ' -i music.wav -c:a pcm_s16le' : ''
      add(
        'README.txt',
        strToU8(
          `Chyron Studio — RGBA PNG sequence\n${p.width} × ${p.height}, ${p.fps} fps, ${count} frames, ${seconds.toFixed(3)} seconds.\nImport frame-00000.png as an image sequence at ${p.fps} fps.\nAll frames use straight/unassociated alpha. The preview background is never included.\n${music ? 'music.wav is the music track, trimmed and faded exactly as in the editor, and as long as the frames.\n' : ''}\nConvert to ProRes 4444 with FFmpeg:\nffmpeg -framerate ${p.fps} -i frame-%05d.png${withMusic} -c:v prores_ks -profile:v 4 -pix_fmt yuva444p10le -alpha_bits 16 chyron-alpha.mov\n`,
        ),
      )
      for (let i = 0; i < count; i++) {
        checkAbort(signal)
        add(frameName(i), await framePng(i))
        if (zipError) throw zipError
        progress({ progress: (i + 1) / count, label: `Rendering frame ${i + 1} of ${count}` })
        await yieldToBrowser()
      }
      checkAbort(signal)
      zip.end()
      if (zipError) throw zipError
      return {
        blob: new Blob(chunks, { type: 'application/zip' }),
        filename: `${name}-png-sequence.zip`,
      }
    }
    const [{ FFmpeg }, { default: coreURL }, { default: wasmURL }] = await Promise.all([
      import('@ffmpeg/ffmpeg'),
      import('@ffmpeg/core?url'),
      import('@ffmpeg/core/wasm?url'),
    ])
    checkAbort(signal)
    const ffmpeg = new FFmpeg()
    cancelEncoder = () => ffmpeg.terminate()
    const prores = format === 'mov'
    const ext = prores ? 'mov' : 'webm'
    const output = `output.${ext}`
    const codecName = prores ? 'ProRes 4444' : 'VP9'
    let log = ''
    ffmpeg.on('log', (event) => {
      log = (log + '\n' + event.message).slice(-4000)
    })
    // Each segment is rendered (40 % of its share) then encoded (60 %).
    const perSegment = prores ? count : segmentFrames(p)
    const segments = Math.ceil(count / perSegment)
    let segment = 0
    const report = (fraction: number, label: string) =>
      progress({ progress: 0.03 + (0.95 * (segment + fraction)) / segments, label })
    ffmpeg.on('progress', (event) =>
      report(
        0.4 + Math.min(1, Math.max(0, event.progress || 0)) * 0.6,
        `Encoding ${codecName} with alpha…${segments > 1 ? ` (part ${segment + 1} of ${segments})` : ''}`,
      ),
    )
    const run = async (args: string[]) => {
      const result = await ffmpeg.exec(args)
      checkAbort(signal)
      if (result !== 0) {
        console.error(log)
        throw new Error('Video encoding failed. Try 720p or export a PNG sequence.')
      }
    }
    const codec = prores
      ? ['-c:v', 'prores_ks', '-profile:v', '4', '-pix_fmt', 'yuva444p10le', '-alpha_bits', '16']
      : [
          '-c:v',
          'libvpx-vp9',
          '-pix_fmt',
          'yuva420p',
          '-lossless',
          '1',
          '-deadline',
          'good',
          '-cpu-used',
          '4',
        ]
    // libopus crashes in this FFmpeg build; Vorbis is WebM's other standard audio codec.
    const audioCodec = prores ? ['-c:a', 'pcm_s16le'] : ['-c:a', 'libvorbis', '-q:a', '6']
    try {
      progress({ progress: 0.01, label: 'Loading the video encoder (about 32 MB)…' })
      await ffmpeg.load({
        coreURL: new URL(coreURL, window.location.href).href,
        wasmURL: new URL(wasmURL, window.location.href).href,
      })
      checkAbort(signal)
      if (music) await ffmpeg.writeFile('music.wav', music)
      const parts: string[] = []
      for (; segment < segments; segment++) {
        const first = segment * perSegment
        const last = Math.min(count, first + perSegment)
        for (let i = first; i < last; i++) {
          checkAbort(signal)
          await ffmpeg.writeFile(frameName(i), await framePng(i))
          report(((i - first + 1) / (last - first)) * 0.4, `Preparing frame ${i + 1} of ${count}`)
          await yieldToBrowser()
        }
        const single = segments === 1
        const target = single ? output : `part-${segment}.${ext}`
        await run([
          '-framerate',
          String(p.fps),
          '-start_number',
          String(first),
          '-i',
          'frame-%05d.png',
          ...(single && music ? ['-i', 'music.wav', '-map', '0:v', '-map', '1:a'] : []),
          '-frames:v',
          String(last - first),
          ...codec,
          ...(single && music ? audioCodec : []),
          '-threads',
          '1',
          '-y',
          target,
        ])
        for (let i = first; i < last; i++) await ffmpeg.deleteFile(frameName(i))
        parts.push(target)
      }
      if (segments > 1) {
        segment = segments - 1
        progress({ progress: 0.98, label: 'Joining the parts…' })
        await ffmpeg.writeFile(
          'parts.txt',
          strToU8(parts.map((part) => `file '${part}'`).join('\n') + '\n'),
        )
        await run([
          '-f',
          'concat',
          '-safe',
          '0',
          '-i',
          'parts.txt',
          ...(music ? ['-i', 'music.wav', '-map', '0:v', '-map', '1:a', ...audioCodec] : []),
          '-c:v',
          'copy',
          '-y',
          output,
        ])
        for (const part of parts) await ffmpeg.deleteFile(part)
      }
      const bytes = await ffmpeg.readFile(output)
      if (typeof bytes === 'string') throw new Error('The encoder returned an invalid file.')
      return {
        blob: new Blob([new Uint8Array(bytes)], {
          type: prores ? 'video/quicktime' : 'video/webm',
        }),
        filename: prores ? `${name}-prores4444.mov` : `${name}-alpha.webm`,
      }
    } finally {
      ffmpeg.terminate()
      cancelEncoder = undefined
    }
  } finally {
    canvas.width = 0
    canvas.height = 0
  }
}
export const exportDescription = (p: Project) =>
  `${p.width} × ${p.height} · ${p.fps} fps · ${duration(p).toFixed(1)} s`
