import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { parse } from 'opentype.js'
import {
  DEFAULT_PROJECT,
  MAX_CHYRONS,
  MAX_TEXTS,
  chyronLayers,
  effectsFor,
  isElement,
  normalizeProject,
  textLayers,
  type Project,
  type TextLayer,
} from '../src/studio/model'
import {
  LIMIT_MESSAGE,
  canAdd,
  createChyronLayer,
  createTextLayer,
  duplicateLayer,
} from '../src/studio/layers'
import { rememberFonts } from '../src/studio/fonts'
import { textLayout } from '../src/studio/textLayout'
import { imageBox, renderSvg } from '../src/studio/renderer'

const font = (file: string) => {
  const data = readFileSync(`node_modules/@fontsource/inter/files/${file}`)
  return parse(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength))
}
const inter = font('inter-latin-800-normal.woff')
rememberFonts('Inter', {
  main: inter,
  subtitle: inter,
  extended: font('inter-latin-ext-800-normal.woff'),
})

const addText = (p: Project, preset?: Parameters<typeof createTextLayer>[1]) =>
  normalizeProject({ ...p, layers: createTextLayer(p, preset).layers })

describe('text layers', () => {
  it('are plain text, apart from chyrons, with the Designer’s presets', () => {
    const p = addText(DEFAULT_PROJECT)
    const [text] = textLayers(p)
    expect(text).toMatchObject({
      kind: 'text',
      name: 'Text',
      text: 'Add a heading',
      align: 'center',
    })
    expect(isElement(text)).toBe(true)
    // The chyron count is untouched.
    expect(chyronLayers(p)).toHaveLength(chyronLayers(DEFAULT_PROJECT).length)
    // Heading, subheading and body follow the Designer's sizes on the shorter side.
    const px = (l: TextLayer) => (l.size / 100) * p.width
    expect(px(text)).toBeCloseTo((96 / 1080) * Math.min(p.width, p.height), 1)
    const body = textLayers(addText(p, 'body'))[1]
    expect(px(body)).toBeLessThan(px(text))
    expect(body.text).toBe('Add a little bit of body text')
  })

  it('has its own limit, so text never uses up chyrons', () => {
    let p: Project = DEFAULT_PROJECT
    for (let i = 0; i < MAX_TEXTS + 2; i++) p = addText(p)
    expect(textLayers(p)).toHaveLength(MAX_TEXTS)
    expect(canAdd(p, 'text')).toBe(false)
    expect(canAdd(p, 'chyron')).toBe(true)
    for (let i = 0; i < MAX_CHYRONS; i++)
      p = normalizeProject({ ...p, layers: createChyronLayer(p).layers })
    expect(chyronLayers(p)).toHaveLength(MAX_CHYRONS)
    expect(LIMIT_MESSAGE.chyron).not.toMatch(/text/)
  })

  it('round-trips through a project file and duplicates like any element', () => {
    const p = addText(DEFAULT_PROJECT)
    const text = { ...textLayers(p)[0], text: 'Live\nTonight', uppercase: true, letterSpacing: 0.1 }
    const edited = normalizeProject({
      ...p,
      layers: p.layers.map((l) => (l.kind === 'text' ? text : l)),
    })
    expect(normalizeProject(JSON.parse(JSON.stringify(edited)))).toEqual(edited)
    const copy = duplicateLayer(edited, text.id)
    expect(textLayers({ layers: copy.layers })).toHaveLength(2)
    // On-screen effects: no Ken Burns, no letter-by-letter effects.
    expect(effectsFor('text')).not.toContain('kenburns')
    expect(effectsFor('text')).not.toContain('wave')
  })

  it('wraps words at the box’s width and grows the box with its lines', () => {
    const p = addText({ ...DEFAULT_PROJECT, width: 1000, height: 1000 })
    const base = { ...textLayers(p)[0], size: 5, width: 40 }
    const one = textLayout({ ...base, text: 'Hello' }, p)
    expect(one.lines).toEqual(['Hello'])
    expect(one.ready).toBe(true)
    expect(one.d.length).toBeGreaterThan(20)
    const wrapped = textLayout({ ...base, text: 'The quick brown fox jumps over the lazy dog' }, p)
    expect(wrapped.lines.length).toBeGreaterThan(1)
    expect(wrapped.height).toBeCloseTo(wrapped.lines.length * base.lineHeight * 50)
    // New lines are kept; capitals follow All caps.
    expect(textLayout({ ...base, text: 'a\nb', uppercase: true }, p).lines).toEqual(['A', 'B'])
    // The layer's box is as tall as its lines.
    const l = { ...base, text: 'The quick brown fox jumps over the lazy dog' }
    expect(imageBox(l, p).h).toBeCloseTo(wrapped.height)
  })

  it('draws the same letters in SVG exports', () => {
    const p = addText({ ...DEFAULT_PROJECT, layers: [] })
    const svg = renderSvg(new Map(), p, 2)
    expect(svg).toMatch(/<path d="M/)
    expect(svg).toContain('fill="#ffffff"')
  })
})
