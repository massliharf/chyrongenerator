import type { GalleryItem } from '../../studio/galleryData'

/** A Media gallery picture on its way to the Hero image generator, as the host or a background. */
export interface HeroPick {
  item: GalleryItem
  target: 'host' | 'background'
}

const EVENT = 'hero:gallery-pick'
let pending: HeroPick | null = null

/** Sends a gallery picture to the Hero image generator (which may mount only now). */
export function sendToHero(pick: HeroPick) {
  pending = pick
  window.dispatchEvent(new Event(EVENT))
}

/** Receives picks, including one sent before the listener existed. */
export function subscribeHeroPicks(take: (pick: HeroPick) => void) {
  const drain = () => {
    if (!pending) return
    const pick = pending
    pending = null
    take(pick)
  }
  drain()
  window.addEventListener(EVENT, drain)
  return () => window.removeEventListener(EVENT, drain)
}
/** Whether a pick is waiting (the Apps launcher opens the generator for it). */
export const hasHeroPick = () => pending !== null
export const HERO_PICK_EVENT = EVENT
