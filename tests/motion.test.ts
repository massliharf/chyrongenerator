import { describe, expect, it } from 'vitest'
import {
  DEFAULT_PROJECT,
  duration,
  frameCount,
  frameTime,
  normalizeProject,
  parseProject,
  migrateLegacy,
  applyTemplate,
  TEMPLATES,
  type Motion,
} from '../src/studio/model'
import { poseAt } from '../src/studio/motion'

describe('frame-accurate animation contract', () => {
  for (const motion of ['pop', 'flip', 'slide', 'wipe', 'typewriter', 'fade'] as Motion[]) {
    it(`${motion}: all 160 elements finish their entrance`, () => {
      const p = { ...DEFAULT_PROJECT, motion, stagger: 0.8 }
      for (let index = 0; index < 160; index++) {
        const pose = poseAt(p.animationDuration, index, 160, p)
        for (const [key, expected] of Object.entries({
          opacity: 1,
          x: 0,
          y: 0,
          scale: 1,
          scaleX: 1,
          rotation: 0,
          reveal: 1,
        })) {
          expect(pose[key as keyof typeof pose]).toBeCloseTo(expected, 8)
        }
      }
    })
    it(`${motion}: first and last encoded frames are transparent at every frame rate`, () => {
      for (const fps of [24, 30, 60] as const) {
        const p = { ...DEFAULT_PROJECT, motion, fps, animationDuration: 1.3, hold: 2.3 }
        for (const index of [0, 40, 159]) {
          expect(poseAt(frameTime(0, p), index, 160, p).opacity).toBe(0)
          expect(poseAt(frameTime(frameCount(p) - 1, p), index, 160, p).opacity).toBe(0)
        }
        expect(Math.abs(frameCount(p) / fps - duration(p))).toBeLessThanOrEqual(0.5 / fps + 1e-9)
      }
    })
    it(`${motion}: the outro exactly retraces the intro at any duration and frame rate`, () => {
      for (const animationDuration of [0.2, 1, 2.7, 4]) {
        for (const fps of [24, 30, 60] as const) {
          for (const hold of [0, 2.4]) {
            const p = { ...DEFAULT_PROJECT, motion, fps, animationDuration, hold, stagger: 0.8 }
            for (const index of [0, 80, 159]) {
              for (const fraction of [0, 0.025, 0.2, 0.5, 0.8, 1]) {
                const time = animationDuration * fraction
                const intro = poseAt(time, index, 160, p)
                const outro = poseAt(duration(p) - time, index, 160, p)
                for (const key of Object.keys(intro) as (keyof typeof intro)[]) {
                  expect(outro[key]).toBeCloseTo(intro[key], 8)
                }
              }
            }
          }
        }
      }
    })
  }
  it('seeking gives identical poses regardless of playback direction', () => {
    const forward = [0.2, 0.6, 1.5, 3.9].map((t) => poseAt(t, 5, 30, DEFAULT_PROJECT))
    const backward = [3.9, 1.5, 0.6, 0.2].map((t) => poseAt(t, 5, 30, DEFAULT_PROJECT)).reverse()
    expect(forward).toEqual(backward)
  })
  it('still compositions remain visible at all times', () => {
    for (const time of [0, 2, duration(DEFAULT_PROJECT)])
      expect(poseAt(time, 159, 160, { ...DEFAULT_PROJECT, motion: 'none' }).opacity).toBe(1)
  })
})

describe('project validation and legacy migration', () => {
  it('keeps older projects visually compatible when adding customization fields', () => {
    expect(
      parseProject('{"version":2,"text":"Existing","width":1920,"height":1080}'),
    ).toMatchObject({
      text: 'Existing',
      width: 1920,
      height: 1080,
      textCase: 'upper',
      tracking: 0,
      subtitlePill: true,
      opacity: 100,
      compositionRotation: 0,
    })
  })
  it('validates imported text, opacity and rotation options', () => {
    expect(
      normalizeProject({
        textCase: 'unknown',
        tracking: -99,
        opacity: -50,
        compositionRotation: 999,
        subtitlePill: 'yes',
      }),
    ).toMatchObject({
      textCase: 'upper',
      tracking: -4,
      opacity: 0,
      compositionRotation: 180,
      subtitlePill: true,
    })
  })
  it('applying a style keeps the user’s words, timing, canvas and placement', () => {
    const project = {
      ...DEFAULT_PROJECT,
      text: 'Keep me',
      subtitle: 'My role',
      animationDuration: 1.8,
      hold: 3,
      stagger: 0.6,
      width: 800,
      height: 1000,
      scale: 80,
      x: 40,
      y: 70,
      opacity: 65,
      compositionRotation: 15,
    }
    for (const template of TEMPLATES) {
      expect(applyTemplate(project, template)).toMatchObject({
        text: 'Keep me',
        subtitle: 'My role',
        animationDuration: 1.8,
        hold: 3,
        stagger: 0.6,
        width: 800,
        height: 1000,
        scale: 80,
        x: 40,
        y: 70,
        opacity: 65,
        compositionRotation: 15,
      })
    }
  })
  it('starts with the app canvas at portrait 720p and a one-second intro and outro', () => {
    expect(normalizeProject({})).toMatchObject({ width: 720, height: 1280, animationDuration: 1 })
    expect(duration(DEFAULT_PROJECT)).toBe(4.4)
    expect(duration({ ...DEFAULT_PROJECT, animationDuration: 1.5 })).toBe(5.4)
  })
  it('rejects non-project and unsupported-version imports', () => {
    for (const json of ['null', '[]', '{"version":3,"text":"test"}', '{}'])
      expect(() => parseProject(json)).toThrow()
  })
  it('keeps legitimate zero values and empty subtitles', () => {
    expect(normalizeProject({ hold: 0, gap: 0, depth: 0, subtitle: '' })).toMatchObject({
      hold: 0,
      gap: 0,
      depth: 0,
      subtitle: '',
    })
  })
  it('bounds dimensions, malformed fonts and numerical values from imported files', () => {
    const p = normalizeProject({
      width: 100000,
      height: 1079,
      animationDuration: 0,
      font: 'malicious',
      accent: '<script>',
      text: 'x'.repeat(1000),
    })
    expect(p.width).toBe(3840)
    expect(p.height).toBe(1080)
    expect(p.animationDuration).toBe(0.2)
    expect(normalizeProject({ animationDuration: NaN }).animationDuration).toBe(1)
    expect(p.font).toBe(DEFAULT_PROJECT.font)
    expect(p.accent).toBe(DEFAULT_PROJECT.accent)
    expect(p.text.length).toBe(160)
  })
  it('migrates earlier v2 durations without changing a saved canvas or overriding the new field', () => {
    const old = { version: 2, text: 'Saved', width: 1920, height: 1080, entrance: 1.7, exit: 0.6 }
    expect(parseProject(JSON.stringify(old))).toMatchObject({
      width: 1920,
      height: 1080,
      text: 'Saved',
      animationDuration: 1.7,
    })
    expect(normalizeProject({ ...old, animationDuration: 0.8 }).animationDuration).toBe(0.8)
    expect(normalizeProject({ entrance: NaN, exit: 0.6 }).animationDuration).toBe(0.6)
    expect(normalizeProject({ entrance: NaN, exit: Infinity }).animationDuration).toBe(1)
  })
  it('migrates legacy scale units, colors, animation and subtitle controls', () => {
    const migrated = migrateLegacy({
      text: 'Legacy',
      tileSize: 1.4,
      subtitleSize: 2,
      subTileColor: '#abcdef',
      subtitlePadding: { x: 26, y: 6 },
      animationPreset: 'slide',
      animationDuration: 1.6,
      tileGap: 0,
      fontFamily: 'Fredoka One',
    })
    expect(migrated).toMatchObject({
      text: 'Legacy',
      tileSize: 89.6,
      subtitleSize: 32,
      accent: '#abcdef',
      subtitlePaddingX: 26,
      subtitlePaddingY: 6,
      motion: 'slide',
      animationDuration: 1.6,
      gap: 0,
      font: 'Fredoka',
    })
  })
})
