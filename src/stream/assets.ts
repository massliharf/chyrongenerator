import type { Bounds, ImageAsset } from './model'
import { generateId } from '../utils/id'

export function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () =>
      reject(new Error('This image could not be opened. Try a PNG, JPEG or WebP file.'))
    image.src = url
  })
}

export async function imageFromBlob(blob: Blob) {
  const url = URL.createObjectURL(blob)
  try {
    return await loadImage(url)
  } finally {
    URL.revokeObjectURL(url)
  }
}

export async function importImage(file: File, trim: boolean): Promise<ImageAsset> {
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type))
    throw new Error('Choose a PNG, JPEG or WebP image.')
  if (file.size > 20 * 1024 * 1024) throw new Error('Choose an image under 20 MB.')
  const image = await imageFromBlob(file)
  const width = image.naturalWidth,
    height = image.naturalHeight
  if (width * height > 24_000_000 || width > 10000 || height > 10000)
    throw new Error('Choose an image up to 24 megapixels and 10,000 pixels per side.')
  let bounds: Bounds = { x: 0, y: 0, width, height }
  if (trim) {
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) throw new Error('Image processing is unavailable in this browser.')
    ctx.drawImage(image, 0, 0)
    const pixels = ctx.getImageData(0, 0, width, height).data
    let left = width,
      top = height,
      right = -1,
      bottom = -1
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (pixels[(y * width + x) * 4 + 3] > 0) {
          left = Math.min(left, x)
          right = Math.max(right, x)
          top = Math.min(top, y)
          bottom = Math.max(bottom, y)
        }
      }
    }
    canvas.width = canvas.height = 1
    if (right < 0)
      throw new Error('This image is completely transparent. Choose a visible host image.')
    bounds = { x: left, y: top, width: right - left + 1, height: bottom - top + 1 }
  }
  return { id: generateId(), name: file.name, blob: file, width, height, bounds }
}
