/**
 * Background removal, all on this device. A bundled salient-object model
 * (U²-Netp, Apache-2.0; see public/models/NOTICE.md) finds the subject, people
 * and objects alike, and a colour key removes flat backgrounds. Every step
 * works on plain pixel arrays, so tests run it without a browser.
 */
import type { InferenceSession, Tensor } from 'onnxruntime-web'

export interface Pixels {
  data: Uint8ClampedArray<ArrayBuffer>
  width: number
  height: number
}
/** Alpha 0–255 for every pixel. */
export interface Matte {
  data: Uint8ClampedArray<ArrayBuffer>
  width: number
  height: number
}
const MODEL = { file: 'models/u2netp.onnx', bytes: 4_574_861, size: 320 }
export const MODEL_BYTES = MODEL.bytes

/** Bilinear resize to planar RGB in 0–1. */
export function resizePlanar(src: Pixels, width: number, height: number): Float32Array {
  const out = new Float32Array(3 * width * height)
  const plane = width * height
  const sx = src.width / width,
    sy = src.height / height
  for (let y = 0; y < height; y++) {
    const fy = Math.max(0, (y + 0.5) * sy - 0.5)
    const y0 = Math.min(src.height - 1, Math.floor(fy))
    const y1 = Math.min(src.height - 1, y0 + 1)
    const ty = fy - y0
    for (let x = 0; x < width; x++) {
      const fx = Math.max(0, (x + 0.5) * sx - 0.5)
      const x0 = Math.min(src.width - 1, Math.floor(fx))
      const x1 = Math.min(src.width - 1, x0 + 1)
      const tx = fx - x0
      const i00 = (y0 * src.width + x0) * 4,
        i01 = (y0 * src.width + x1) * 4
      const i10 = (y1 * src.width + x0) * 4,
        i11 = (y1 * src.width + x1) * 4
      for (let c = 0; c < 3; c++) {
        const top = src.data[i00 + c] * (1 - tx) + src.data[i01 + c] * tx
        const bottom = src.data[i10 + c] * (1 - tx) + src.data[i11 + c] * tx
        out[c * plane + y * width + x] = (top * (1 - ty) + bottom * ty) / 255
      }
    }
  }
  return out
}

/** Bilinear resize of a single-channel 0–1 map to a 0–255 matte. */
export function resizeMatte(
  src: Float32Array,
  sw: number,
  sh: number,
  width: number,
  height: number,
): Matte {
  const data = new Uint8ClampedArray(width * height)
  const sx = sw / width,
    sy = sh / height
  for (let y = 0; y < height; y++) {
    const fy = Math.max(0, (y + 0.5) * sy - 0.5)
    const y0 = Math.min(sh - 1, Math.floor(fy))
    const y1 = Math.min(sh - 1, y0 + 1)
    const ty = fy - y0
    for (let x = 0; x < width; x++) {
      const fx = Math.max(0, (x + 0.5) * sx - 0.5)
      const x0 = Math.min(sw - 1, Math.floor(fx))
      const x1 = Math.min(sw - 1, x0 + 1)
      const tx = fx - x0
      const top = src[y0 * sw + x0] * (1 - tx) + src[y0 * sw + x1] * tx
      const bottom = src[y1 * sw + x0] * (1 - tx) + src[y1 * sw + x1] * tx
      data[y * width + x] = (top * (1 - ty) + bottom * ty) * 255
    }
  }
  return { data, width, height }
}

/**
 * Input tensor values: the picture squeezed to 320 × 320, scaled by its
 * brightest value, then normalised with the ImageNet mean and deviation.
 */
export function modelTensor(src: Pixels) {
  const size = MODEL.size
  const rgb = resizePlanar(src, size, size)
  const plane = size * size
  let max = 1e-6
  for (let i = 0; i < rgb.length; i++) if (rgb[i] > max) max = rgb[i]
  const mean = [0.485, 0.456, 0.406],
    std = [0.229, 0.224, 0.225]
  for (let c = 0; c < 3; c++)
    for (let i = 0; i < plane; i++)
      rgb[c * plane + i] = (rgb[c * plane + i] / max - mean[c]) / std[c]
  return { width: size, height: size, data: rgb }
}

/** Model output stretched to 0–1. */
export function outputMap(out: Float32Array) {
  let lo = Infinity,
    hi = -Infinity
  for (const v of out) {
    if (v < lo) lo = v
    if (v > hi) hi = v
  }
  const range = Math.max(1e-6, hi - lo)
  return out.map((v) => (v - lo) / range)
}

type Ort = typeof import('onnxruntime-web')
let runtime: Promise<Ort> | null = null
/** The ONNX runtime, loaded the first time a subject is detected. */
async function loadRuntime(): Promise<Ort> {
  runtime ??= Promise.all([
    import('onnxruntime-web/wasm'),
    import('onnxruntime-web/ort-wasm-simd-threaded.wasm?url'),
  ])
    .then(([ort, wasm]) => {
      ort.env.wasm.wasmPaths = { wasm: new URL(wasm.default, window.location.href).href }
      // Threads need cross-origin isolation, which static hosting does not give.
      ort.env.wasm.numThreads = globalThis.crossOriginIsolated
        ? Math.min(4, navigator.hardwareConcurrency || 1)
        : 1
      return ort as unknown as Ort
    })
    .catch((error) => {
      runtime = null
      throw error
    })
  return runtime
}
let session: Promise<InferenceSession> | null = null
/** Load (once) and start the model. `progress` reports the download from 0 to 1. */
export function loadModel(
  progress: (fraction: number) => void = () => {},
): Promise<InferenceSession> {
  if (!session) {
    session = (async () => {
      const lib = await loadRuntime()
      const response = await fetch(new URL(MODEL.file, document.baseURI).href)
      if (!response.ok || !response.body) throw new Error('The cut-out model could not be loaded.')
      const reader = response.body.getReader()
      const total = MODEL.bytes
      const bytes = new Uint8Array(total + 1024 * 1024)
      let received = 0
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        if (received + value.length > bytes.length) throw new Error('Unexpected model size.')
        bytes.set(value, received)
        received += value.length
        progress(Math.min(1, received / total))
      }
      return lib.InferenceSession.create(bytes.subarray(0, received), {
        executionProviders: ['wasm'],
      })
    })()
    session.catch(() => {
      session = null
    })
  }
  return session
}

/** Where the subject is, as a 0–1 map at the model's size. `ort` lets tests bring their runtime. */
export async function predictMap(
  src: Pixels,
  model: InferenceSession,
  ort?: Pick<Ort, 'Tensor'>,
): Promise<{ data: Float32Array; width: number; height: number }> {
  const lib = ort ?? (await loadRuntime())
  const input = modelTensor(src)
  const tensor = new lib.Tensor('float32', input.data, [1, 3, input.height, input.width])
  const result = await model.run({ [model.inputNames[0]]: tensor })
  const out = (result[model.outputNames[0]] as Tensor).data as Float32Array
  const data = outputMap(out)
  for (const t of Object.values(result)) (t as Tensor).dispose?.()
  tensor.dispose?.()
  return { data, width: input.width, height: input.height }
}
/** Subject matte at the image's size. */
export async function predictMatte(
  src: Pixels,
  model: InferenceSession,
  ort?: Pick<Ort, 'Tensor'>,
): Promise<Matte> {
  const map = await predictMap(src, model, ort)
  return resizeMatte(map.data, map.width, map.height, src.width, src.height)
}

/** Mean absolute alpha difference, 0–1 (0 = identical). */
export function matteError(a: Matte, b: Matte) {
  let sum = 0
  for (let i = 0; i < a.data.length; i++) sum += Math.abs(a.data[i] - b.data[i])
  return sum / a.data.length / 255
}

/* ---------- Colour key ---------- */

/** The most common colour along the picture's border, a good guess for a flat background. */
export function borderColor(src: Pixels): [number, number, number] {
  const counts = new Map<number, { n: number; r: number; g: number; b: number }>()
  const add = (x: number, y: number) => {
    const i = (y * src.width + x) * 4
    if (src.data[i + 3] < 128) return
    const r = src.data[i],
      g = src.data[i + 1],
      b = src.data[i + 2]
    const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4)
    const e = counts.get(key) ?? { n: 0, r: 0, g: 0, b: 0 }
    e.n++
    e.r += r
    e.g += g
    e.b += b
    counts.set(key, e)
  }
  const step = Math.max(1, Math.floor(Math.max(src.width, src.height) / 400))
  for (let x = 0; x < src.width; x += step) {
    add(x, 0)
    add(x, src.height - 1)
  }
  for (let y = 0; y < src.height; y += step) {
    add(0, y)
    add(src.width - 1, y)
  }
  let best = { n: 0, r: 255, g: 255, b: 255 }
  for (const e of counts.values()) if (e.n > best.n) best = e
  return best.n ? [best.r / best.n, best.g / best.n, best.b / best.n] : [255, 255, 255]
}

/**
 * Remove a colour. `tolerance` and `softness` are 0–100; `connected` only
 * removes the colour where it touches the border (so a white logo on a white
 * background keeps its inside), otherwise it is removed everywhere.
 */
export function colorKeyMatte(
  src: Pixels,
  key: [number, number, number],
  tolerance: number,
  softness: number,
  connected: boolean,
): Matte {
  const { width, height, data } = src
  const n = width * height
  const threshold = (tolerance / 100) * 160
  const ramp = Math.max(1, (softness / 100) * 90)
  const alpha = new Uint8ClampedArray(n)
  const distance = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    const dr = data[i * 4] - key[0],
      dg = data[i * 4 + 1] - key[1],
      db = data[i * 4 + 2] - key[2]
    distance[i] = Math.sqrt(dr * dr + dg * dg + db * db)
  }
  const keyed = (d: number) =>
    d <= threshold ? 0 : d >= threshold + ramp ? 255 : ((d - threshold) / ramp) * 255
  if (!connected) {
    for (let i = 0; i < n; i++) alpha[i] = Math.min(data[i * 4 + 3], keyed(distance[i]))
    return { data: alpha, width, height }
  }
  alpha.fill(255)
  // Flood from the border through pixels close enough to the key colour.
  const limit = threshold + ramp
  const seen = new Uint8Array(n)
  const stack = new Int32Array(n)
  let top = 0
  const push = (i: number) => {
    if (!seen[i] && distance[i] < limit) {
      seen[i] = 1
      stack[top++] = i
    }
  }
  for (let x = 0; x < width; x++) {
    push(x)
    push((height - 1) * width + x)
  }
  for (let y = 0; y < height; y++) {
    push(y * width)
    push(y * width + width - 1)
  }
  while (top) {
    const i = stack[--top]
    alpha[i] = keyed(distance[i])
    const x = i % width
    if (x > 0) push(i - 1)
    if (x < width - 1) push(i + 1)
    if (i >= width) push(i - width)
    if (i < n - width) push(i + width)
  }
  for (let i = 0; i < n; i++) alpha[i] = Math.min(alpha[i], data[i * 4 + 3])
  return { data: alpha, width, height }
}

/**
 * Edge controls: `softness` 0–100 (0 = a hard cut, 100 = the matte as found)
 * and `shift` −50…50 (negative pulls the edge in, positive lets more through).
 */
export function refineMatte(matte: Matte, softness: number, shift: number): Matte {
  const width = Math.max(0.02, softness / 100)
  const center = 0.5 - shift / 100
  const lo = center - width / 2,
    hi = center + width / 2
  if (Math.abs(lo) < 1e-6 && Math.abs(hi - 1) < 1e-6) return matte
  const lut = new Uint8ClampedArray(256)
  for (let v = 0; v < 256; v++)
    lut[v] = Math.round(Math.min(1, Math.max(0, (v / 255 - lo) / (hi - lo))) * 255)
  const data = new Uint8ClampedArray(matte.data.length)
  for (let i = 0; i < data.length; i++) data[i] = lut[matte.data[i]]
  return { ...matte, data }
}

/** The picture with the matte as its alpha (keeping any transparency it already had). */
export function applyMatte(src: Pixels, matte: Matte): Pixels {
  const data = new Uint8ClampedArray(src.data)
  for (let i = 0; i < matte.data.length; i++)
    data[i * 4 + 3] = Math.round((data[i * 4 + 3] * matte.data[i]) / 255)
  return { data, width: src.width, height: src.height }
}

/** Overlap of two mattes thresholded at half (1 = identical). */
export function matteIoU(a: Matte, b: Matte) {
  let both = 0,
    either = 0
  for (let i = 0; i < a.data.length; i++) {
    const x = a.data[i] >= 128,
      y = b.data[i] >= 128
    if (x && y) both++
    if (x || y) either++
  }
  return either ? both / either : 1
}
