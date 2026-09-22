import { strToU8, Zip, ZipPassThrough } from 'fflate'
import { duration, fileStem, frameCount, frameTime, type Project } from './model'
import { buildScene, renderFrame, renderSvg } from './renderer'
import { loadFonts } from './fonts'

export type ExportFormat = 'webm' | 'mov' | 'sequence' | 'png' | 'svg'
export interface ExportProgress {
  progress: number
  label: string
}
type Progress = (value: ExportProgress) => void
const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0))
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
export function exportAvailability(format: ExportFormat, p: Project): string | null {
  if ((format === 'mov' || format === 'webm') && p.width * p.height > 1920 * 1080)
    return 'Video exports support up to 1920 × 1080 in the browser. Choose Full HD, or use a PNG sequence for larger frames.'
  if ((format === 'mov' || format === 'webm') && frameCount(p) > 600)
    return 'Keep video exports under 600 frames. Reduce the duration or frame rate, or choose a PNG sequence.'
  if (!p.text.trim() && !p.subtitle.trim()) return 'Add a title or subtitle before exporting.'
  return null
}
export async function exportProject(
  p: Project,
  format: ExportFormat,
  time: number,
  signal: AbortSignal,
  progress: Progress,
): Promise<{ blob: Blob; filename: string }> {
  const unavailable = exportAvailability(format, p)
  if (unavailable) throw new Error(unavailable)
  progress({ progress: 0, label: 'Preparing your composition…' })
  const fonts = await loadFonts(p.font)
  checkAbort(signal)
  const scene = buildScene(p, fonts)
  const name = fileStem(p.name)
  if (format === 'svg')
    return {
      blob: new Blob([renderSvg(scene, p, time)], { type: 'image/svg+xml' }),
      filename: `${name}.svg`,
    }
  const canvas = document.createElement('canvas')
  canvas.width = p.width
  canvas.height = p.height
  const context = canvas.getContext('2d', { alpha: true })
  if (!context)
    throw new Error('Your browser could not create a canvas. Please reload and try again.')
  if (format === 'png') {
    renderFrame(context, scene, p, time)
    return { blob: await canvasBlob(canvas), filename: `${name}.png` }
  }
  const count = frameCount(p)
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
      add('project.chyron.json', strToU8(JSON.stringify(p, null, 2)))
      add(
        'README.txt',
        strToU8(
          `Chyron Studio — RGBA PNG sequence\n${p.width} × ${p.height}, ${p.fps} fps, ${count} frames, ${(count / p.fps).toFixed(3)} seconds.\nImport frame-00000.png as an image sequence at ${p.fps} fps.\nAll frames use straight/unassociated alpha. The preview background is never included.\n\nConvert to ProRes 4444 with FFmpeg:\nffmpeg -framerate ${p.fps} -i frame-%05d.png -c:v prores_ks -profile:v 4 -pix_fmt yuva444p10le -alpha_bits 16 chyron-alpha.mov\n`,
        ),
      )
      for (let i = 0; i < count; i++) {
        checkAbort(signal)
        renderFrame(context, scene, p, frameTime(i, p))
        add(
          `frame-${String(i).padStart(5, '0')}.png`,
          new Uint8Array(await (await canvasBlob(canvas)).arrayBuffer()),
        )
        if (zipError) throw zipError
        progress({ progress: (i + 1) / count, label: `Rendering frame ${i + 1} of ${count}` })
        await tick()
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
    const output = prores ? 'output.mov' : 'output.webm'
    let log = ''
    ffmpeg.on('log', (event) => {
      log = (log + '\n' + event.message).slice(-4000)
    })
    ffmpeg.on('progress', (event) =>
      progress({
        progress: 0.4 + Math.min(1, Math.max(0, event.progress)) * 0.58,
        label: prores ? 'Encoding ProRes 4444 with alpha…' : 'Encoding VP9 with alpha…',
      }),
    )
    try {
      progress({ progress: 0.01, label: 'Loading the video encoder (about 32 MB)…' })
      await ffmpeg.load({
        coreURL: new URL(coreURL, window.location.href).href,
        wasmURL: new URL(wasmURL, window.location.href).href,
      })
      checkAbort(signal)
      for (let i = 0; i < count; i++) {
        checkAbort(signal)
        renderFrame(context, scene, p, frameTime(i, p))
        await ffmpeg.writeFile(
          `frame-${String(i).padStart(5, '0')}.png`,
          new Uint8Array(await (await canvasBlob(canvas)).arrayBuffer()),
        )
        progress({
          progress: 0.03 + ((i + 1) / count) * 0.37,
          label: `Preparing frame ${i + 1} of ${count}`,
        })
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
      const result = await ffmpeg.exec([
        '-framerate',
        String(p.fps),
        '-i',
        'frame-%05d.png',
        ...codec,
        '-threads',
        '1',
        '-y',
        output,
      ])
      checkAbort(signal)
      if (result !== 0) {
        console.error(log)
        throw new Error('Video encoding failed. Try 720p or export a PNG sequence.')
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
