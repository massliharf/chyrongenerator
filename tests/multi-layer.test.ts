import { describe, expect, it } from 'vitest'
import {
  CHYRON_STYLE_KEYS,
  DEFAULT_PROJECT,
  DEFAULT_SHAPE_LAYER,
  HOLD_EFFECTS,
  MAX_CHYRONS,
  MAX_HOLD,
  MOTIONS,
  PRIMARY_CHYRON,
  applyTemplate,
  chyronLayer,
  chyronLayers,
  chyronProject,
  duration,
  effectsFor,
  frameCount,
  frameTime,
  hasArtwork,
  introLength,
  layerTiming,
  normalizeProject,
  restTime,
  styleOf,
  TEMPLATES,
  type ChyronLayer,
  type Project,
  type ShapeLayer,
} from '../src/studio/model'
import {
  chyronStylePatch,
  createChyronLayer,
  createShapeLayer,
  duplicateLayer,
  removeLayer,
} from '../src/studio/layers'
import { chyronGroupPose, imagePoseAt, letterEmphasisAt, poseAt } from '../src/studio/motion'
import { linearGradientLine } from '../src/studio/renderer'
import { shapeOutline } from '../src/studio/crop'

const withLayers = (p: Project, ...steps: ((p: Project) => { layers: Project['layers'] })[]) =>
  steps.reduce((acc, step) => normalizeProject({ ...acc, layers: step(acc).layers }), p)

describe('several chyrons', () => {
  it('keeps the first chyron on the project and gives added ones their own style', () => {
    const p = withLayers(DEFAULT_PROJECT, (p) => createChyronLayer(p, 'chyron'))
    const [first, added] = chyronLayers(p)
    expect(first.id).toBe(PRIMARY_CHYRON)
    expect(first.style).toBeUndefined()
    expect(added.style).toBeDefined()
    // A second chyron matches the first one's look, smaller and in a free band.
    expect(added.style!.font).toBe(p.font)
    expect(added.style!.scale).toBeLessThanOrEqual(60)
    expect(Math.abs(added.style!.y - p.y)).toBeGreaterThanOrEqual(14)
    expect(added.name).toBe('Chyron 2')
    // Its style round-trips through a project file.
    expect(normalizeProject(JSON.parse(JSON.stringify(p)))).toEqual(p)
  })
  it('adds plain text lettering without tiles or subtitle', () => {
    const p = withLayers(DEFAULT_PROJECT, (p) => createChyronLayer(p, 'text'))
    const text = chyronLayers(p)[1]
    expect(styleOf(p, text)).toMatchObject({ mode: 'typography', subtitlePill: false, depth: 0 })
  })
  it('routes style edits to wherever a chyron keeps its style', () => {
    const p = withLayers(DEFAULT_PROJECT, (p) => createChyronLayer(p, 'chyron'))
    const added = chyronLayers(p)[1]
    expect(chyronStylePatch(p, PRIMARY_CHYRON, { text: 'Host' })).toEqual({ text: 'Host' })
    const next = normalizeProject({ ...p, ...chyronStylePatch(p, added.id, { text: 'Guest' }) })
    expect(styleOf(next, chyronLayers(next)[1]).text).toBe('Guest')
    expect(next.text).toBe(p.text)
  })
  it('views each chyron as its own project for scenes, poses and timing', () => {
    const p = withLayers(DEFAULT_PROJECT, (p) => createChyronLayer(p, 'text'))
    const added = chyronLayers(p)[1]
    const view = chyronProject(p, added)
    expect(view.text).toBe(added.style!.text)
    expect(chyronLayer(view)).toBe(added)
    // Composition settings stay shared.
    expect(view.width).toBe(p.width)
    expect(duration(view)).toBe(duration(p))
  })
  it('deletes any chyron, the first and the last included', () => {
    const p = withLayers(DEFAULT_PROJECT, (p) => createChyronLayer(p, 'text'))
    const added = chyronLayers(p)[1]
    const withoutFirst = normalizeProject({ ...p, layers: removeLayer(p, PRIMARY_CHYRON) })
    expect(chyronLayers(withoutFirst).map((l) => l.id)).toEqual([added.id])
    // The added chyron keeps its own words and look.
    expect(styleOf(withoutFirst, chyronLayers(withoutFirst)[0]).mode).toBe('typography')
    const empty = normalizeProject({ ...withoutFirst, layers: removeLayer(withoutFirst, added.id) })
    expect(empty.layers).toEqual([])
    expect(hasArtwork(empty)).toBe(false)
    // An empty composition stays empty when it is saved and reopened.
    expect(normalizeProject(JSON.parse(JSON.stringify(empty))).layers).toEqual([])
  })
  it('puts a chyron added to an empty canvas in the middle at full size', () => {
    const empty = normalizeProject({ ...DEFAULT_PROJECT, layers: [] })
    const { layer } = createChyronLayer(empty, 'chyron')
    expect(layer.style).toMatchObject({ y: empty.y, scale: empty.scale, text: 'Your\nName' })
    expect(createChyronLayer(empty, 'text').layer.style!.y).toBe(50)
  })
  it('duplicates chyrons as added chyrons and limits how many there are', () => {
    const copy = duplicateLayer(DEFAULT_PROJECT, PRIMARY_CHYRON)
    const added = copy.layers.find((l) => l.id === copy.id) as ChyronLayer
    expect(added.style?.text).toBe(DEFAULT_PROJECT.text)
    let p: Project = DEFAULT_PROJECT
    for (let i = 0; i < MAX_CHYRONS + 3; i++)
      p = normalizeProject({ ...p, ...createChyronLayer(p, 'chyron') })
    expect(chyronLayers(p)).toHaveLength(MAX_CHYRONS)
  })
  it('restyles only the chosen chyron with a template', () => {
    const p = withLayers(DEFAULT_PROJECT, (p) => createChyronLayer(p, 'chyron'))
    const restyled = applyTemplate(p, TEMPLATES[4])
    expect(restyled.font).toBe('Bangers')
    expect(styleOf(restyled, chyronLayers(restyled)[1]).font).toBe(DEFAULT_PROJECT.font)
    expect(restyled.layers).toEqual(p.layers)
  })
  it('counts any visible chyron with words as artwork', () => {
    const p = withLayers(DEFAULT_PROJECT, (p) => createChyronLayer(p, 'text'))
    const hidden = normalizeProject({
      ...p,
      layers: p.layers.map((l) => (l.id === PRIMARY_CHYRON ? { ...l, visible: false } : l)),
    })
    expect(hasArtwork(hidden)).toBe(true)
  })
  it('style keys cover every field the chyron needs', () => {
    for (const key of ['text', 'font', 'motion', 'outro', 'x', 'scale'] as const)
      expect(CHYRON_STYLE_KEYS).toContain(key)
    expect(CHYRON_STYLE_KEYS).not.toContain('width')
    expect(CHYRON_STYLE_KEYS).not.toContain('hold')
  })
})

describe('chyron timing and motion', () => {
  it('gives added chyrons their own intro length', () => {
    const p = withLayers({ ...DEFAULT_PROJECT, hold: 4 }, (p) => createChyronLayer(p, 'text'))
    const added = { ...chyronLayers(p)[1], duration: 0.5 }
    const t = layerTiming(added, p)
    expect(t.length).toBeCloseTo(0.5)
    expect(layerTiming(chyronLayer(p), p).length).toBe(p.animationDuration)
  })
  it('plays a chosen outro and stays transparent at both ends', () => {
    for (const outro of MOTIONS.filter((m) => m !== 'none'))
      for (const fps of [24, 30, 60] as const) {
        const p = normalizeProject({ ...DEFAULT_PROJECT, motion: 'pop', outro, fps })
        expect(poseAt(frameTime(0, p), 0, 4, p).opacity, outro).toBe(0)
        expect(poseAt(frameTime(frameCount(p) - 1, p), 0, 4, p).opacity, outro).toBe(0)
        expect(poseAt(restTime(p), 0, 4, p).opacity, outro).toBe(1)
      }
  })
  it('a still intro with an outro starts visible and leaves', () => {
    const p = normalizeProject({ ...DEFAULT_PROJECT, motion: 'none', outro: 'fade' })
    expect(poseAt(0, 0, 1, p).opacity).toBe(1)
    expect(poseAt(duration(p), 0, 1, p).opacity).toBe(0)
  })
  it('on-screen effects are settled when the intro ends and the outro starts', () => {
    for (const emphasis of effectsFor('chyron')) {
      const p = normalizeProject({
        ...DEFAULT_PROJECT,
        hold: 3,
        layers: [
          { kind: 'chyron', id: 'chyron', emphasis, emphasisStrength: 100, emphasisSpeed: 0.7 },
        ],
      })
      const t = layerTiming(chyronLayer(p), p)
      for (const time of [0, t.introEnd, t.outroStart, duration(p)]) {
        const g = chyronGroupPose(time, p, 600, 300)
        expect(((g.rotation % 360) + 360) % 360, emphasis).toBeCloseTo(0, 6)
        expect(g.scale, emphasis).toBeCloseTo(1, 6)
        expect(g.x + g.y, emphasis).toBeCloseTo(0, 6)
        const letter = letterEmphasisAt(time, 2, 5, p)
        expect(letter.y, emphasis).toBeCloseTo(0, 6)
        expect(letter.scale, emphasis).toBeCloseTo(1, 6)
      }
    }
  })
  it('moves letters one by one with Letter wave and Ripple during the hold', () => {
    for (const emphasis of ['wave', 'ripple'] as const) {
      const p = normalizeProject({
        ...DEFAULT_PROJECT,
        hold: 4,
        layers: [
          { kind: 'chyron', id: 'chyron', emphasis, emphasisStrength: 100, emphasisSpeed: 1 },
        ],
      })
      const moves = Array.from({ length: 6 }, (_, i) => letterEmphasisAt(2.3, i, 6, p))
      const values = moves.map((m) => (emphasis === 'wave' ? m.y : m.scale))
      expect(new Set(values.map((v) => v.toFixed(3))).size, emphasis).toBeGreaterThan(1)
      // The whole chyron stays put; only letters move.
      expect(chyronGroupPose(2.3, p, 600, 300).scale).toBe(1)
    }
  })
  it('shines across the chyron during the hold only', () => {
    const p = normalizeProject({
      ...DEFAULT_PROJECT,
      hold: 4,
      layers: [{ kind: 'chyron', id: 'chyron', emphasis: 'shine', emphasisSpeed: 1 }],
    })
    const sweeps = Array.from(
      { length: 30 },
      (_, i) => chyronGroupPose(1.4 + i * 0.05, p, 1, 1).shine,
    )
    expect(sweeps.some((s) => s >= 0)).toBe(true)
    expect(chyronGroupPose(0.3, p, 1, 1).shine).toBe(-1)
  })
  it('keeps an effect-free chyron exactly as before', () => {
    const p = normalizeProject({ ...DEFAULT_PROJECT, hold: 4 })
    expect(chyronLayer(p)).toEqual({
      id: 'chyron',
      kind: 'chyron',
      name: 'Chyron',
      visible: true,
      delay: 0,
    })
    expect(chyronGroupPose(2, p, 100, 100).shine).toBe(-1)
  })
  it('offers each layer kind the effects that suit it', () => {
    expect(effectsFor('chyron')).toContain('wave')
    expect(effectsFor('chyron')).not.toContain('kenburns')
    expect(effectsFor('image')).toContain('kenburns')
    expect(effectsFor('image')).not.toContain('ripple')
    expect(effectsFor('shape')).not.toContain('kenburns')
    expect(effectsFor('shape')).not.toContain('wave')
    expect(HOLD_EFFECTS.length).toBe(new Set(HOLD_EFFECTS).size)
  })
})

describe('shapes', () => {
  it('creates bars and badges and round-trips them', () => {
    const bar = createShapeLayer(DEFAULT_PROJECT)
    expect(bar.layer).toMatchObject({ kind: 'shape', shape: 'rect', name: 'Rectangle' })
    const star = createShapeLayer(DEFAULT_PROJECT, 'star')
    expect(star.layer.aspect).toBe(1)
    const p = normalizeProject({ ...DEFAULT_PROJECT, layers: [...bar.layers, star.layer] })
    expect(normalizeProject(JSON.parse(JSON.stringify(p)))).toEqual(p)
    expect(hasArtwork({ ...p, layers: [bar.layer] })).toBe(true)
  })
  it('clamps invalid shape values', () => {
    const p = normalizeProject({
      ...DEFAULT_PROJECT,
      layers: [
        {
          ...DEFAULT_SHAPE_LAYER,
          id: 's',
          name: 'S',
          shape: 'blob',
          fill: 'red',
          gradient: 'conic',
          width: 9000,
        },
      ],
    })
    const s = p.layers[0] as ShapeLayer
    expect(s.shape).toBe('rect')
    expect(s.fill).toBe(DEFAULT_SHAPE_LAYER.fill)
    expect(s.gradient).toBe('none')
    expect(s.width).toBe(400)
  })
  it('animates like an image: transparent at both ends, settled at rest', () => {
    const { layer, layers } = createShapeLayer(DEFAULT_PROJECT)
    const p = normalizeProject({ ...DEFAULT_PROJECT, layers })
    const l = p.layers.find((x) => x.id === layer.id) as ShapeLayer
    expect(imagePoseAt(frameTime(0, p), l, p).opacity).toBe(0)
    expect(imagePoseAt(restTime(p), l, p).opacity).toBe(1)
    expect(introLength(p)).toBeGreaterThan(0)
  })
  it('draws outlines and gradients that span the box', () => {
    expect(shapeOutline('rect', 0, 0, 100, 50, 10)).toMatch(/^M10 0/)
    expect(shapeOutline('circle', 0, 0, 100, 50)).toContain('A')
    const g = linearGradientLine(0, 200, 100, 100, 50)
    expect(g).toEqual({ x1: 0, y1: 50, x2: 200, y2: 50 })
    const v = linearGradientLine(90, 200, 100, 100, 50)
    expect(v.y1).toBeCloseTo(0)
    expect(v.y2).toBeCloseTo(100)
  })
})

describe('longer holds', () => {
  it('accepts holds up to a minute', () => {
    expect(normalizeProject({ ...DEFAULT_PROJECT, hold: 45 }).hold).toBe(45)
    expect(normalizeProject({ ...DEFAULT_PROJECT, hold: 500 }).hold).toBe(MAX_HOLD)
    expect(duration(normalizeProject({ ...DEFAULT_PROJECT, hold: 60 }))).toBe(62)
  })
})
