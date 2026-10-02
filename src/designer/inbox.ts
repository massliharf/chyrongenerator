import type { GalleryItem } from '../studio/galleryData'

/**
 * Gallery → Designer hand-off. The Designer mounts on first visit, so items
 * sent before then wait here until it drains them.
 */
const pending: GalleryItem[] = []
const EVENT = 'designer:import-gallery-item'

export function sendToDesigner(item: GalleryItem) {
  pending.push(item)
  window.dispatchEvent(new Event(EVENT))
}

export function subscribeDesignerInbox(take: (items: GalleryItem[]) => void) {
  const drain = () => {
    if (pending.length) take(pending.splice(0))
  }
  drain()
  window.addEventListener(EVENT, drain)
  return () => window.removeEventListener(EVENT, drain)
}
