import { zipSync } from 'fflate'
import { canvasBlob } from '../studio/export'
import { fileStem } from '../studio/model'
import { FORMATS, type Format, type StreamDocument } from './model'
import { drawStream, type StreamImages } from './renderer'

export async function exportStreamPng(
  document: StreamDocument,
  format: Format,
  images: StreamImages,
) {
  if (!document.host || !images.host) throw new Error('Add your host image before exporting.')
  const canvas = window.document.createElement('canvas')
  canvas.width = format.width
  canvas.height = format.height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Unable to create an image. Please try again.')
  drawStream(ctx, format, document.layouts[format.id], document.host, images)
  const blob = await canvasBlob(canvas)
  canvas.width = canvas.height = 1
  return {
    blob,
    filename: `${fileStem(document.name)}-${format.id}-${format.width}x${format.height}.png`,
  }
}
export async function exportStreamSet(
  document: StreamDocument,
  images: StreamImages,
  progress: (message: string) => void,
) {
  const files: Record<string, Uint8Array> = {}
  for (const format of FORMATS) {
    progress(`Preparing ${format.name.toLowerCase()}…`)
    const result = await exportStreamPng(document, format, images)
    files[result.filename] = new Uint8Array(await result.blob.arrayBuffer())
    await new Promise((resolve) => setTimeout(resolve, 0))
  }
  return {
    blob: new Blob([new Uint8Array(zipSync(files, { level: 0 }))], { type: 'application/zip' }),
    filename: `${fileStem(document.name)}-stream-images.zip`,
  }
}
