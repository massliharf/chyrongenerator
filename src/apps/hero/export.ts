import { zipSync } from 'fflate'
import { fileStem, type DesignDoc } from '../../designer/model'
import { loadAssets, loadFont, renderArtboard } from '../../designer/render'
import type { Artboard, HeroSet } from './model'

export type ImageFormat = 'png' | 'jpeg' | 'webp'
export const IMAGE_FORMATS: { id: ImageFormat; name: string; mime: string }[] = [
  { id: 'png', name: 'PNG', mime: 'image/png' },
  { id: 'jpeg', name: 'JPEG', mime: 'image/jpeg' },
  { id: 'webp', name: 'WebP', mime: 'image/webp' },
]

/** Fonts and pictures ready before drawing. */
const ready = (doc: DesignDoc) =>
  Promise.all([
    ...doc.layers.flatMap((l) => (l.kind === 'text' ? [loadFont(l)] : [])),
    loadAssets(doc),
  ])

export async function renderImage(doc: DesignDoc, format: ImageFormat, scale: number) {
  await ready(doc)
  // JPEG has no transparency: transparent artboards get their colour.
  const canvas = renderArtboard(doc, scale, format === 'jpeg' ? { transparent: false } : {})
  const mime = IMAGE_FORMATS.find((f) => f.id === format)!.mime
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('The image could not be made.'))),
      mime,
      0.92,
    ),
  )
  canvas.width = canvas.height = 1
  return blob
}

/** `show-hero-image-900x1200.png`: the set, the artboard and the pixel size. */
export const imageName = (set: HeroSet, doc: DesignDoc, format: ImageFormat, scale: number) =>
  `${fileStem(set.name)}-${fileStem(doc.name)}-${doc.width * scale}x${doc.height * scale}.${format === 'jpeg' ? 'jpg' : format}`

/**
 * Makes the chosen artboards' images: one image as it is, several in one ZIP.
 * `progress` hears which artboard is being drawn.
 */
export async function exportImages(
  set: HeroSet,
  boards: Artboard[],
  {
    format = 'png',
    scale = 1,
    progress,
  }: { format?: ImageFormat; scale?: number; progress?: (name: string) => void } = {},
) {
  const docs = boards.map((a) => ({ ...a.doc, assets: set.assets }))
  if (docs.length === 1) {
    progress?.(docs[0].name)
    return {
      blob: await renderImage(docs[0], format, scale),
      filename: imageName(set, docs[0], format, scale),
    }
  }
  const files: Record<string, Uint8Array> = {}
  for (const doc of docs) {
    progress?.(doc.name)
    files[imageName(set, doc, format, scale)] = new Uint8Array(
      await (await renderImage(doc, format, scale)).arrayBuffer(),
    )
    // Let the page breathe between big images.
    await new Promise((resolve) => setTimeout(resolve, 0))
  }
  return {
    blob: new Blob([zipSync(files, { level: 0 }) as Uint8Array<ArrayBuffer>], {
      type: 'application/zip',
    }),
    filename: `${fileStem(set.name)}.zip`,
  }
}
