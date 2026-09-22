import { useEffect, useState } from 'react'
import { imageFromBlob, loadImage } from './assets'
import {
  assetUrl,
  BACKGROUNDS,
  coverRect,
  hostRect,
  type Format,
  type ImageAsset,
  type Layout,
  type StreamDocument,
} from './model'

export interface StreamImages {
  host: HTMLImageElement | null
  backgrounds: Record<string, HTMLImageElement>
}
const uploaded = new WeakMap<ImageAsset, Promise<HTMLImageElement>>()
const builtins = new Map<string, Promise<HTMLImageElement>>()
function uploadedImage(asset: ImageAsset) {
  let promise = uploaded.get(asset)
  if (!promise) {
    promise = imageFromBlob(asset.blob).catch((error) => {
      uploaded.delete(asset)
      throw error
    })
    uploaded.set(asset, promise)
  }
  return promise
}
async function prepareImages(
  host: ImageAsset | null,
  backgrounds: ImageAsset[],
): Promise<StreamImages> {
  const entries = await Promise.all([
    ...BACKGROUNDS.map(async (bg) => {
      let promise = builtins.get(bg.id)
      if (!promise) {
        promise = loadImage(assetUrl(bg.file)).catch((error) => {
          builtins.delete(bg.id)
          throw error
        })
        builtins.set(bg.id, promise)
      }
      return [bg.id, await promise] as const
    }),
    ...backgrounds.map(async (asset) => [asset.id, await uploadedImage(asset)] as const),
  ])
  return { host: host ? await uploadedImage(host) : null, backgrounds: Object.fromEntries(entries) }
}
export function useStreamImages(document: StreamDocument, retry: number) {
  const { host, backgrounds } = document
  const [state, setState] = useState<{
    host: ImageAsset | null
    backgrounds: ImageAsset[]
    images: StreamImages | null
    error: string
    attempt: number
  } | null>(null)
  useEffect(() => {
    let live = true
    prepareImages(host, backgrounds)
      .then((images) => {
        if (live) setState({ host, backgrounds, images, error: '', attempt: retry })
      })
      .catch((error) => {
        if (live)
          setState({
            host,
            backgrounds,
            images: null,
            error: error instanceof Error ? error.message : 'Unable to load images.',
            attempt: retry,
          })
      })
    return () => {
      live = false
    }
  }, [host, backgrounds, retry])
  return state?.host === host && state?.backgrounds === backgrounds && state?.attempt === retry
    ? { images: state.images, error: state.error }
    : { images: null, error: '' }
}

function drawHost(
  ctx: CanvasRenderingContext2D,
  format: Format,
  layout: Layout,
  asset: ImageAsset,
  image: HTMLImageElement,
) {
  const rect = hostRect(format, layout, asset.bounds)
  ctx.save()
  ctx.translate(rect.x, rect.y)
  ctx.rotate((layout.rotation * Math.PI) / 180)
  ctx.scale(layout.flip ? -1 : 1, 1)
  if (layout.shadow) {
    // Canvas shadow lengths ignore the transform; scale them for thumbnails too.
    const pixelScale = ctx.canvas.width / format.width
    ctx.shadowColor = `rgba(0, 0, 0, ${layout.shadow / 140})`
    ctx.shadowBlur = format.width * 0.035 * pixelScale
    ctx.shadowOffsetY = format.height * 0.015 * pixelScale
  }
  const b = asset.bounds
  ctx.drawImage(
    image,
    b.x,
    b.y,
    b.width,
    b.height,
    -rect.width / 2,
    -rect.height / 2,
    rect.width,
    rect.height,
  )
  ctx.restore()
}

/** One renderer for previews, thumbnails and exact-size PNG exports. */
export function drawStream(
  ctx: CanvasRenderingContext2D,
  format: Format,
  layout: Layout,
  host: ImageAsset | null,
  images: StreamImages,
) {
  const { width, height } = format
  const scale = ctx.canvas.width / width
  ctx.resetTransform()
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height)
  ctx.save()
  ctx.scale(scale, scale)
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  if (layout.background !== 'transparent') {
    if (layout.background === 'gradient') {
      const gradient = ctx.createLinearGradient(width * 0.15, height, width * 0.85, 0)
      gradient.addColorStop(0, layout.color)
      gradient.addColorStop(1, layout.color2)
      ctx.fillStyle = gradient
    } else ctx.fillStyle = layout.color
    ctx.fillRect(0, 0, width, height)
    const image = images.backgrounds[layout.background]
    if (image) {
      const r = coverRect(image.naturalWidth, image.naturalHeight, format, layout)
      ctx.drawImage(image, r.x, r.y, r.width, r.height)
    }
  }
  if (host && images.host) {
    if (!layout.fade) drawHost(ctx, format, layout, host, images.host)
    else {
      const layer = document.createElement('canvas')
      layer.width = ctx.canvas.width
      layer.height = ctx.canvas.height
      const overlay = layer.getContext('2d')!
      overlay.scale(scale, scale)
      drawHost(overlay, format, layout, host, images.host)
      overlay.globalCompositeOperation = 'destination-in'
      const gradient = overlay.createLinearGradient(0, height * (1 - layout.fade / 100), 0, height)
      gradient.addColorStop(0, '#000')
      gradient.addColorStop(1, '#0000')
      overlay.fillStyle = gradient
      overlay.fillRect(0, 0, width, height)
      ctx.drawImage(layer, 0, 0, width, height)
      layer.width = layer.height = 1
    }
  }
  ctx.restore()
}
