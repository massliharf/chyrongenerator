import { Path, type Font } from 'opentype.js'
import { loadedFonts, type Fonts } from './fonts'
import type { Project, TextLayer } from './model'

/**
 * A text layer laid out in its box: lines wrapped at the box's width and drawn
 * as one vector path, so the preview, every image and video export and SVG
 * show exactly the same letters. Units are composition pixels, with 0,0 at the
 * box's top left.
 */
export interface TextLayout {
  /** SVG path data of every letter. Empty until the typeface has loaded. */
  d: string
  /** Box height: the lines times the line spacing. */
  height: number
  lines: string[]
  /** The typeface has loaded (otherwise sizes are estimates and nothing is drawn). */
  ready: boolean
  key: string
}

const cache = new Map<string, TextLayout>()

/** The glyph for a character: the layer's typeface, else Inter, else Inter's extended set. */
function glyphFont(fonts: Fonts, char: string): Font {
  return (
    [fonts.main, fonts.subtitle, fonts.extended].find((f) => f.charToGlyphIndex(char) !== 0) ||
    fonts.subtitle
  )
}

export function textLayout(l: TextLayer, p: Pick<Project, 'width'>): TextLayout {
  const fonts = loadedFonts(l.font)
  const boxW = Math.max(1, (l.width / 100) * p.width)
  const size = Math.max(1, (l.size / 100) * p.width)
  const key = [
    fonts ? 1 : 0,
    l.font,
    l.text,
    l.uppercase ? 1 : 0,
    boxW.toFixed(2),
    size.toFixed(2),
    l.align,
    l.lineHeight,
    l.letterSpacing,
  ].join('|')
  const hit = cache.get(key)
  if (hit) return hit

  const tracking = l.letterSpacing * size
  const advance = (char: string) => {
    if (!fonts) return size * 0.55
    const font = glyphFont(fonts, char)
    const glyph = font.charToGlyph(char)
    return ((glyph.advanceWidth || font.unitsPerEm * 0.6) / font.unitsPerEm) * size
  }
  const measure = (line: string) => {
    const chars = Array.from(line)
    return chars.reduce((w, c) => w + advance(c), 0) + tracking * Math.max(0, chars.length - 1)
  }

  // Wrap each paragraph at the box's width; a single long word keeps its line.
  const content = (l.uppercase ? l.text.toUpperCase() : l.text).normalize('NFC')
  const lines: string[] = []
  for (const paragraph of content.split('\n')) {
    let line = ''
    for (const word of paragraph.split(' ')) {
      const next = line ? `${line} ${word}` : word
      if (line && measure(next) > boxW) {
        lines.push(line)
        line = word
      } else line = next
    }
    lines.push(line)
  }

  const lineHeight = l.lineHeight * size
  const height = Math.max(1, lines.length * lineHeight)
  let d = ''
  if (fonts) {
    const main = fonts.main
    const ascent = (main.ascender / main.unitsPerEm) * size
    const descent = (-main.descender / main.unitsPerEm) * size
    const path = new Path()
    lines.forEach((line, i) => {
      const width = measure(line)
      let x = l.align === 'left' ? 0 : l.align === 'right' ? boxW - width : (boxW - width) / 2
      // The letters sit in the middle of their line, as in the Designer.
      const baseline = i * lineHeight + (lineHeight - (ascent + descent)) / 2 + ascent
      for (const char of Array.from(line)) {
        const font = glyphFont(fonts, char)
        path.extend(font.charToGlyph(char).getPath(x, baseline, size))
        x += advance(char) + tracking
      }
    })
    d = path.toPathData(2)
  }
  const layout = { d, height, lines, ready: !!fonts, key }
  cache.set(key, layout)
  // Typing makes a new layout per keystroke: keep the cache small.
  while (cache.size > 200) cache.delete(cache.keys().next().value!)
  return layout
}
