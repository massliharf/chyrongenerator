import { parse, type Font, Path } from 'opentype.js'
import type { FontName } from './model'
import wickedURL from '../assets/fonts/WickedMouse.otf?url'
import interURL from '@fontsource/inter/files/inter-latin-800-normal.woff?url'
import interExtendedURL from '@fontsource/inter/files/inter-latin-ext-800-normal.woff?url'
import antonURL from '@fontsource/anton/files/anton-latin-400-normal.woff?url'
import bangersURL from '@fontsource/bangers/files/bangers-latin-400-normal.woff?url'
import fredokaURL from '@fontsource/fredoka/files/fredoka-latin-700-normal.woff?url'
import oswaldURL from '@fontsource/oswald/files/oswald-latin-700-normal.woff?url'
import chewyURL from '@fontsource/chewy/files/chewy-latin-400-normal.woff?url'
import markerURL from '@fontsource/permanent-marker/files/permanent-marker-latin-400-normal.woff?url'
import ranchersURL from '@fontsource/ranchers/files/ranchers-latin-400-normal.woff?url'
import nunitoURL from '@fontsource/nunito/files/nunito-latin-900-normal.woff?url'

const urls: Record<FontName, string> = {
  'Wicked Mouse': wickedURL,
  Inter: interURL,
  Anton: antonURL,
  Bangers: bangersURL,
  Fredoka: fredokaURL,
  Oswald: oswaldURL,
  Chewy: chewyURL,
  'Permanent Marker': markerURL,
  Ranchers: ranchersURL,
  Nunito: nunitoURL,
}
const cache = new Map<string, Promise<Font>>()
async function load(url: string) {
  if (!cache.has(url))
    cache.set(
      url,
      fetch(url)
        .then(async (response) => {
          if (!response.ok)
            throw new Error('A font could not be loaded. Check your connection and retry.')
          return parse(await response.arrayBuffer())
        })
        .catch((error) => {
          cache.delete(url)
          throw error
        }),
    )
  return cache.get(url)!
}
export interface Fonts {
  main: Font
  subtitle: Font
  extended: Font
}
/** Typefaces that have finished loading, for drawing text without waiting. */
const ready = new Map<FontName, Fonts>()
export const loadedFonts = (name: FontName) => ready.get(name) ?? null
/** For tests, and for fonts parsed elsewhere. */
export const rememberFonts = (name: FontName, fonts: Fonts) => ready.set(name, fonts)
export async function loadFonts(name: FontName): Promise<Fonts> {
  const [main, subtitle, extended] = await Promise.all([
    load(urls[name]),
    load(interURL),
    load(interExtendedURL),
  ])
  const fonts = { main, subtitle, extended }
  ready.set(name, fonts)
  return fonts
}
export function outline(text: string, size: number, fonts: Fonts, subtitle = false) {
  const path = new Path()
  let x = 0
  for (const char of Array.from(text.normalize('NFC'))) {
    const preferred = subtitle ? fonts.subtitle : fonts.main
    const font =
      [preferred, fonts.subtitle, fonts.extended].find((f) => f.charToGlyphIndex(char) !== 0) ||
      fonts.subtitle
    const glyph = font.charToGlyph(char)
    path.extend(glyph.getPath(x, 0, size))
    x += ((glyph.advanceWidth || font.unitsPerEm * 0.6) / font.unitsPerEm) * size
  }
  const box = path.getBoundingBox()
  if (!path.commands.length)
    return { d: '', width: x, advance: x, height: size, left: 0, top: -size * 0.75 }
  return {
    d: path.toPathData(3),
    width: Math.max(x, box.x2) - Math.min(0, box.x1),
    advance: x,
    height: box.y2 - box.y1,
    left: Math.min(0, box.x1),
    top: box.y1,
  }
}
/** Fonts for every name, loaded in parallel. */
export async function loadFontSet(names: Iterable<FontName>): Promise<Map<FontName, Fonts>> {
  const unique = [...new Set(names)]
  const loaded = await Promise.all(unique.map((name) => loadFonts(name)))
  return new Map(unique.map((name, i) => [name, loaded[i]]))
}
