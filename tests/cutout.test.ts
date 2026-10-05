import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import * as ort from 'onnxruntime-web'
import {
  applyMatte,
  borderColor,
  colorKeyMatte,
  matteError,
  matteIoU,
  modelTensor,
  outputMap,
  predictMatte,
  refineMatte,
  resizeMatte,
  type Matte,
  type Pixels,
} from '../src/studio/cutout'

/** A w × h picture: `inside` colour where `shape` is true, `outside` elsewhere. */
function picture(
  w: number,
  h: number,
  shape: (x: number, y: number) => boolean,
  inside: number[],
  outside: (x: number, y: number) => number[],
): { px: Pixels; truth: Matte } {
  const data = new Uint8ClampedArray(w * h * 4)
  const truth = new Uint8ClampedArray(w * h)
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = y * w + x
      const on = shape(x, y)
      const c = on ? inside : outside(x, y)
      data.set([c[0], c[1], c[2], 255], i * 4)
      truth[i] = on ? 255 : 0
    }
  return { px: { data, width: w, height: h }, truth: { data: truth, width: w, height: h } }
}
const disc = (cx: number, cy: number, r: number) => (x: number, y: number) =>
  (x - cx) ** 2 + (y - cy) ** 2 < r * r

describe('colour key', () => {
  it('finds a flat background and removes it around the subject only', () => {
    // A white ring with a white middle, on white: "connected" keeps the middle.
    const ring = (x: number, y: number) => disc(60, 40, 30)(x, y) && !disc(60, 40, 12)(x, y)
    const { px } = picture(120, 80, ring, [200, 30, 30], () => [255, 255, 255])
    expect(borderColor(px).map(Math.round)).toEqual([255, 255, 255])
    const connected = colorKeyMatte(px, [255, 255, 255], 20, 10, true)
    expect(connected.data[0]).toBe(0)
    expect(connected.data[40 * 120 + 60]).toBe(255)
    expect(connected.data[40 * 120 + 60 + 20]).toBe(255)
    const everywhere = colorKeyMatte(px, [255, 255, 255], 20, 10, false)
    expect(everywhere.data[40 * 120 + 60]).toBe(0)
  })
  it('keeps pixels that were already transparent', () => {
    const { px } = picture(
      10,
      10,
      () => false,
      [0, 0, 0],
      () => [0, 200, 0],
    )
    px.data[3] = 0
    const m = colorKeyMatte(px, [255, 0, 255], 10, 10, false)
    expect(m.data[0]).toBe(0)
    expect(m.data[1]).toBe(255)
  })
})

describe('matte helpers', () => {
  it('hardens or shifts an edge, and leaves the matte alone at full softness', () => {
    const m: Matte = { data: new Uint8ClampedArray([0, 64, 140, 192, 255]), width: 5, height: 1 }
    expect(refineMatte(m, 100, 0)).toBe(m)
    const hard = refineMatte(m, 2, 0)
    expect([...hard.data]).toEqual([0, 0, 255, 255, 255])
    expect(refineMatte(m, 50, -20).data[2]).toBeLessThan(128)
  })
  it('resizes, applies and compares mattes', () => {
    const up = resizeMatte(new Float32Array([0, 1, 0, 1]), 2, 2, 4, 4)
    expect(up.data.length).toBe(16)
    expect(up.data[0]).toBe(0)
    expect(up.data[3]).toBe(255)
    const { px, truth } = picture(
      4,
      4,
      (x) => x >= 2,
      [10, 20, 30],
      () => [1, 2, 3],
    )
    const out = applyMatte(px, truth)
    expect(out.data[3]).toBe(0)
    expect(out.data[(2 * 4 + 3) * 4 + 3]).toBe(255)
    expect(matteIoU(truth, truth)).toBe(1)
    expect(matteError(truth, truth)).toBe(0)
  })
  it('prepares a 320 × 320 normalised tensor and stretches the output to 0–1', () => {
    const { px } = picture(
      64,
      32,
      () => false,
      [0, 0, 0],
      () => [255, 128, 0],
    )
    const t = modelTensor(px)
    expect([t.width, t.height, t.data.length]).toEqual([320, 320, 3 * 320 * 320])
    // Red at full brightness: (1 − 0.485) / 0.229.
    expect(t.data[0]).toBeCloseTo((1 - 0.485) / 0.229, 3)
    expect([...outputMap(new Float32Array([2, 4, 6]))]).toEqual([0, 0.5, 1])
  })
})

describe('subject model', () => {
  it('finds a salient subject with the bundled U²-Netp model', async () => {
    ort.env.wasm.numThreads = 1
    const model = await ort.InferenceSession.create(readFileSync('public/models/u2netp.onnx'))
    // An orange disc on a dark, softly striped backdrop.
    const { px, truth } = picture(240, 180, disc(120, 95, 55), [250, 140, 40], (x, y) => [
      20 + ((x >> 4) % 2) * 10,
      30,
      40 + (y % 20),
    ])
    const matte = await predictMatte(px, model, ort)
    expect(matte.width).toBe(240)
    expect(matteIoU(matte, truth)).toBeGreaterThan(0.85)
  }, 60_000)
})
