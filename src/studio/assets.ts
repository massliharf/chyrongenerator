import { generateId } from '../utils/id'
import { imageLayers, type Project } from './model'

/**
 * Uploaded images live in IndexedDB, separately from the autosaved project JSON, so
 * large photos never hit the localStorage quota. Layers reference them by asset id.
 */
const DB_NAME = 'chyron-studio-assets'
const STORE = 'images'
export const MAX_IMAGE_BYTES = 25 * 1024 * 1024
const MAX_SIDE = 4096
const TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif']

export interface StoredImage {
  id: string
  name: string
  blob: Blob
  width: number
  height: number
}

let database: Promise<IDBDatabase> | null = null
function openDatabase(): Promise<IDBDatabase> {
  database ??= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = () => request.result.createObjectStore(STORE)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
    request.onblocked = () => reject(new Error('Storage is busy in another tab.'))
  }).catch((error) => {
    database = null
    throw error
  })
  return database
}
async function transact<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T> | void,
): Promise<T | undefined> {
  const db = await openDatabase()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode)
    const request = run(tx.objectStore(STORE))
    tx.oncomplete = () => resolve(request ? request.result : undefined)
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error)
  })
}
export const putAsset = (image: StoredImage) =>
  transact('readwrite', (store) => store.put(image, image.id))
export const readAsset = (id: string) =>
  transact<StoredImage | undefined>('readonly', (store) => store.get(id))
export const assetKeys = () =>
  transact<IDBValidKey[]>('readonly', (store) => store.getAllKeys()).then((k) => k ?? [])
export const deleteAsset = (id: string) => transact('readwrite', (store) => store.delete(id))

/** Remove stored images that no project, preset or history entry refers to anymore. */
export async function collectUnusedAssets(keep: Iterable<string>) {
  const used = new Set(keep)
  for (const key of await assetKeys())
    if (typeof key === 'string' && !used.has(key)) await deleteAsset(key)
}
export const referencedAssets = (projects: Project[]) =>
  projects.flatMap((p) => imageLayers(p).map((l) => l.assetId))

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number) {
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('This image could not be resized.'))),
      type,
      quality,
    ),
  )
}

/** Validate, downscale oversized images to 4096 px and store the result. */
export async function importImageFile(file: File): Promise<StoredImage> {
  if (!TYPES.includes(file.type)) throw new Error('Choose a PNG, JPEG, WebP or GIF image.')
  if (file.size > MAX_IMAGE_BYTES) throw new Error('Choose an image under 25 MB.')
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    throw new Error(`${file.name} could not be opened. Try a PNG, JPEG or WebP file.`)
  }
  let blob: Blob = file
  let { width, height } = bitmap
  if (width * height > 40_000_000) {
    bitmap.close()
    throw new Error('Choose an image up to 40 megapixels.')
  }
  if (Math.max(width, height) > MAX_SIDE) {
    const factor = MAX_SIDE / Math.max(width, height)
    width = Math.round(width * factor)
    height = Math.round(height * factor)
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Image processing is unavailable in this browser.')
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(bitmap, 0, 0, width, height)
    const opaque = file.type === 'image/jpeg'
    blob = await canvasToBlob(canvas, opaque ? 'image/jpeg' : 'image/png', 0.92)
    canvas.width = canvas.height = 0
  }
  bitmap.close()
  const image = { id: generateId(), name: file.name.slice(0, 80), blob, width, height }
  await putAsset(image)
  bitmaps.delete(image.id)
  return image
}

/* Decoded images are shared by the preview, thumbnails and every export. */
const bitmaps = new Map<string, Promise<ImageBitmap | null>>()
export function loadBitmap(id: string): Promise<ImageBitmap | null> {
  let entry = bitmaps.get(id)
  if (!entry) {
    entry = readAsset(id)
      .then((stored) => (stored ? createImageBitmap(stored.blob) : null))
      .catch(() => null)
    bitmaps.set(id, entry)
    // Retry a missing image the next time it is requested.
    void entry.then((result) => {
      if (!result) bitmaps.delete(id)
    })
  }
  return entry
}
export type ImageMap = ReadonlyMap<string, CanvasImageSource & { width: number; height: number }>
export async function loadProjectImages(p: Project): Promise<Map<string, ImageBitmap>> {
  const map = new Map<string, ImageBitmap>()
  await Promise.all(
    imageLayers(p).map(async (l) => {
      const bitmap = await loadBitmap(l.assetId)
      if (bitmap) map.set(l.assetId, bitmap)
    }),
  )
  return map
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}
export async function dataUrlToBlob(url: string): Promise<Blob> {
  if (!/^data:image\/(png|jpeg|webp|gif);base64,/.test(url)) throw new Error('Invalid image data.')
  return (await fetch(url)).blob()
}

/** Portable project files carry their images so they reopen complete on any device. */
export interface EmbeddedAsset {
  name: string
  width: number
  height: number
  data: string
}
export async function embedAssets(p: Project): Promise<Record<string, EmbeddedAsset>> {
  const out: Record<string, EmbeddedAsset> = {}
  for (const l of imageLayers(p)) {
    if (out[l.assetId]) continue
    const stored = await readAsset(l.assetId)
    if (stored)
      out[l.assetId] = {
        name: stored.name,
        width: stored.width,
        height: stored.height,
        data: await blobToDataUrl(stored.blob),
      }
  }
  return out
}
export async function restoreEmbeddedAssets(raw: unknown) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return 0
  let restored = 0
  for (const [id, entry] of Object.entries(raw as Record<string, unknown>)) {
    if (!/^[\w-]{1,80}$/.test(id) || !entry || typeof entry !== 'object') continue
    const asset = entry as Partial<EmbeddedAsset>
    if (typeof asset.data !== 'string') continue
    const blob = await dataUrlToBlob(asset.data)
    await putAsset({
      id,
      name: typeof asset.name === 'string' ? asset.name.slice(0, 80) : 'Image',
      blob,
      width: Number(asset.width) || 0,
      height: Number(asset.height) || 0,
    })
    bitmaps.delete(id)
    restored++
  }
  return restored
}
