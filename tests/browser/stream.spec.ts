import { test, expect, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { unzipSync } from 'fflate'
import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'

async function fixture(page: Page, background = false) {
  const data = await page.evaluate((bg) => {
    const canvas = document.createElement('canvas')
    canvas.width = 300
    canvas.height = 400
    const ctx = canvas.getContext('2d')!
    if (bg) {
      ctx.fillStyle = '#225544'
      ctx.fillRect(0, 0, 300, 400)
    } else {
      ctx.fillStyle = '#ffce99'
      ctx.beginPath()
      ctx.arc(150, 110, 55, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#ed4599'
      ctx.beginPath()
      ctx.roundRect(70, 165, 160, 210, [60, 60, 0, 0])
      ctx.fill()
      ctx.fillStyle = '#173eaa'
      ctx.fillRect(80, 220, 25, 70)
    }
    return canvas.toDataURL('image/png').split(',')[1]
  }, background)
  return {
    name: background ? 'custom-green.png' : 'test-host.png',
    mimeType: 'image/png',
    buffer: Buffer.from(data, 'base64'),
  }
}
async function openStream(page: Page) {
  await page.goto('./')
  await page.getByRole('button', { name: 'Stream images', exact: true }).click()
  await expect(page.getByLabel('Stream set name')).toBeEnabled()
  await expect(page.locator('.si-artboard canvas')).toHaveAttribute('data-ready', 'true')
}
async function uploadHost(page: Page) {
  await page.getByLabel('Host image file', { exact: true }).setInputFiles(await fixture(page))
  await expect(page.getByRole('button', { name: 'Download all images as ZIP' })).toBeEnabled()
  await page.getByRole('button', { name: /^Framing/ }).click()
}
function rgba(png: Buffer | Uint8Array) {
  return execFileSync(
    'ffmpeg',
    ['-v', 'error', '-f', 'image2pipe', '-i', 'pipe:0', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-'],
    { input: png, maxBuffer: 10_000_000 },
  )
}

test('one host creates three exact PNGs; custom backgrounds, framing, alpha and reload persist', async ({
  page,
}, testInfo) => {
  await openStream(page)
  await expect(page.getByRole('button', { name: 'Download all images as ZIP' })).toBeDisabled()
  await uploadHost(page)
  await page.getByLabel('Stream set name').fill('Savvy show')
  await page.getByLabel('Host size', { exact: true }).fill('125')
  await page.getByLabel('Host size', { exact: true }).press('Tab')
  await page.getByRole('button', { name: /Edit Host card/ }).click()
  await expect(page.getByLabel('Host size', { exact: true })).toHaveValue('100')
  await page
    .getByLabel('Background image file', { exact: true })
    .setInputFiles(await fixture(page, true))
  await expect(page.getByRole('button', { name: 'Use custom-green.png background' })).toBeVisible()
  await page.getByRole('button', { name: 'Use this background for all 3' }).click()
  const zipDownload = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Download all images as ZIP' }).click()
  const zipFile = await zipDownload
  await zipFile.saveAs(testInfo.outputPath('stream-images.zip'))
  const files = unzipSync(readFileSync(testInfo.outputPath('stream-images.zip')))
  expect(Object.keys(files)).toHaveLength(3)
  for (const [id, width, height] of [
    ['hero', 900, 1200],
    ['host', 1024, 1024],
    ['stream', 1200, 1200],
  ] as const) {
    const key = Object.keys(files).find((k) => k.includes(`-${id}-`))!
    const png = Buffer.from(files[key])
    expect(png.readUInt32BE(16)).toBe(width)
    expect(png.readUInt32BE(20)).toBe(height)
    const pixels = rgba(png)
    expect([...pixels.subarray(0, 4)]).toEqual([34, 85, 68, 255])
    // The hero image darkens its lower half by default (bottom shadow), so only the
    // square formats show the host's untouched color at this point.
    if (id === 'hero') continue
    const center = (Math.floor(height * 0.65) * width + Math.floor(width * 0.5)) * 4
    expect([...pixels.subarray(center, center + 4)]).toEqual([237, 69, 153, 255])
  }
  await page.getByRole('radio', { name: 'None', exact: true }).click()
  const pngDownload = page.waitForEvent('download')
  await page.getByRole('button', { name: 'More download options' }).click()
  await page.getByRole('menuitem', { name: /only/ }).click()
  const pngFile = await pngDownload
  const png = readFileSync((await pngFile.path())!)
  const pixels = rgba(png)
  expect(pixels[3]).toBe(0)
  expect(pixels[(650 * 1024 + 512) * 4 + 3]).toBe(255)
  await expect(page.getByText('Images & edits saved on this device', { exact: true })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('main', { name: 'Stream image previews' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Download all images as ZIP' })).toBeEnabled()
  await expect(page.getByLabel('Stream set name')).toHaveValue('Savvy show')
  await expect(page.getByLabel('Host size', { exact: true })).toHaveValue('125')
  await page.getByRole('button', { name: /Edit Host card/ }).click()
  await expect(page.getByRole('radio', { name: 'None', exact: true })).toHaveAttribute(
    'aria-checked',
    'true',
  )
  await page.getByRole('radio', { name: 'Image', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Use custom-green.png background' })).toBeVisible()
})

test('dragging, keyboard nudging, undo, bad upload recovery and tool switching preserve each project', async ({
  page,
}) => {
  await page.goto('./')
  await page.getByLabel('Title', { exact: true }).fill('Keep my chyron')
  await page.getByRole('button', { name: 'Stream images', exact: true }).click()
  await expect(page.getByLabel('Stream set name')).toBeEnabled()
  await uploadHost(page)
  const canvas = page.locator('.si-artboard canvas')
  await canvas.focus()
  await page.keyboard.press('ArrowRight')
  await expect(page.getByLabel('Host horizontal', { exact: true })).toHaveValue('50.25')
  const box = (await canvas.boundingBox())!
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width * 0.6, box.y + box.height / 2, { steps: 3 })
  await page.mouse.up()
  await expect(page.getByLabel('Host horizontal', { exact: true })).toHaveValue('60.25')
  await page.getByRole('button', { name: 'Reset Framing' }).click()
  await expect(page.getByLabel('Host horizontal', { exact: true })).toHaveValue('50')
  await page.getByRole('button', { name: 'Undo image edit' }).click()
  await expect(page.getByLabel('Host horizontal', { exact: true })).toHaveValue('60.25')
  await page
    .getByLabel('Host image file', { exact: true })
    .setInputFiles({ name: 'bad.png', mimeType: 'image/png', buffer: Buffer.from('not an image') })
  await expect(page.getByRole('alert')).toContainText('could not be opened')
  await expect(page.getByText('test-host.png', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Download all images as ZIP' })).toBeEnabled()
  await page.getByRole('button', { name: 'Dismiss image error' }).click()
  const nav = page.getByRole('navigation', { name: 'Workspaces' })
  await nav.getByRole('button', { name: 'Chyron', exact: true }).click()
  await expect(nav.getByRole('button', { name: 'Chyron', exact: true })).toBeFocused()
  await expect(page.getByLabel('Title', { exact: true })).toHaveValue('Keep my chyron')
  await page.getByRole('button', { name: 'Undo', exact: true }).click()
  await expect(page.getByLabel('Title', { exact: true })).not.toHaveValue('Keep my chyron')
  await page.getByRole('button', { name: 'Stream images', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Stream images', exact: true })).toBeFocused()
  await expect(page.getByLabel('Host horizontal', { exact: true })).toHaveValue('60.25')
  await page.getByRole('button', { name: 'Remove host image' }).click()
  await expect(page.getByRole('button', { name: 'Download all images as ZIP' })).toBeDisabled()
  await page.getByRole('button', { name: 'Undo image edit' }).click()
  await expect(page.getByRole('button', { name: 'Download all images as ZIP' })).toBeEnabled()
})

test('stream images responsive layout and accessibility', async ({ page }, testInfo) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await openStream(page)
  const violations = []
  const scan = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
    .analyze()
  violations.push(
    ...scan.violations.map((v) => ({
      id: v.id,
      nodes: v.nodes.map((n) => ({ target: n.target, html: n.html, failure: n.failureSummary })),
    })),
  )
  await uploadHost(page)
  for (const [width, height] of [
    [1440, 960],
    [1024, 768],
    [768, 1024],
    [393, 852],
    [320, 900],
    [844, 390],
  ]) {
    await page.setViewportSize({ width, height })
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
      .toBe(true)
    await expect(page.getByRole('button', { name: 'Download all images as ZIP' })).toBeVisible()
  }
  await page.setViewportSize({ width: 393, height: 852 })
  await page.getByRole('button', { name: /Edit Host card/ }).click()
  const populated = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
    .analyze()
  violations.push(
    ...populated.violations.map((v) => ({
      id: v.id,
      nodes: v.nodes.map((n) => ({ target: n.target, html: n.html, failure: n.failureSummary })),
    })),
  )
  await page.evaluate(() => {
    ;(document.activeElement as HTMLElement)?.blur()
    window.scrollTo(0, 0)
  })
  await page.screenshot({ path: testInfo.outputPath('stream-mobile.png'), fullPage: true })
  await page.setViewportSize({ width: 1440, height: 960 })
  await page.getByRole('button', { name: /Edit Hero image/ }).click()
  await page.screenshot({ path: testInfo.outputPath('stream-desktop.png') })
  expect(violations).toEqual([])
  expect(errors).toEqual([])
})

test('canvas handles resize, rotate, undo and export the transformed host without controls', async ({
  page,
}) => {
  await openStream(page)
  await uploadHost(page)
  await page.getByRole('radio', { name: 'None', exact: true }).click()
  const canvas = page.locator('.si-artboard canvas')
  const box = (await page.locator('[data-workspace="stream"] .si-transform-box').boundingBox())!
  const corner = page.getByRole('button', { name: 'Resize host from bottom right' })
  const handle = (await corner.boundingBox())!
  const start = { x: handle.x + handle.width / 2, y: handle.y + handle.height / 2 }
  await page.mouse.move(start.x, start.y)
  await page.mouse.down()
  await page.mouse.move(start.x + box.width * 0.2, start.y + box.height * 0.2, { steps: 5 })
  await page.mouse.up()
  expect(Number(await page.getByLabel('Host size', { exact: true }).inputValue())).toBeCloseTo(
    120,
    0,
  )
  await page.getByRole('button', { name: 'Undo image edit' }).click()
  await expect(page.getByLabel('Host size', { exact: true })).toHaveValue('100')
  await expect(page.getByLabel('Host horizontal', { exact: true })).toHaveValue('50')
  const rect = (await canvas.boundingBox())!
  const rotate = page.getByRole('button', { name: 'Rotate host', exact: true })
  const r = (await rotate.boundingBox())!
  const center = { x: rect.x + rect.width / 2, y: rect.y + rect.height * 0.54 }
  const radius = center.y - r.y - r.height / 2
  await page.mouse.move(r.x + r.width / 2, r.y + r.height / 2)
  await page.mouse.down()
  await page.mouse.move(center.x + radius, center.y, { steps: 6 })
  await page.mouse.up()
  await expect(page.getByLabel('Host rotation', { exact: true })).toHaveValue('90')
  await rotate.press('Shift+ArrowRight')
  await expect(page.getByLabel('Host rotation', { exact: true })).toHaveValue('105')
  await page.getByRole('button', { name: 'Reset Framing' }).click()
  await expect(page.getByLabel('Host rotation', { exact: true })).toHaveValue('0')
  await corner.press('Shift+ArrowUp')
  await expect(page.getByLabel('Host size', { exact: true })).toHaveValue('110')
  await rotate.press('Shift+ArrowRight')
  await page.getByRole('button', { name: 'Show image safe area' }).click()
  // Let the last keyboard edit finish rendering before sampling the preview.
  await page.waitForTimeout(500)
  const preview = await canvas.evaluate(
    (node) => (node as HTMLCanvasElement).toDataURL().split(',')[1],
  )
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'More download options' }).click()
  await page.getByRole('menuitem', { name: /only/ }).click()
  const png = readFileSync((await (await download).path())!)
  // Same pixels as the preview; rotated edges may differ by one level of rounding.
  const exported = rgba(png)
  const previewed = rgba(Buffer.from(preview, 'base64'))
  expect(exported.length).toBe(previewed.length)
  expect(exported.every((value, i) => Math.abs(value - previewed[i]) <= 1)).toBe(true)
  expect(rgba(png)[3]).toBe(0)
  await page.getByRole('button', { name: 'Show image controls' }).click()
  await expect(page.getByRole('button', { name: 'Rotate host', exact: true })).toBeHidden()
  await page.getByRole('button', { name: 'Show image controls' }).click()
  await expect(page.getByRole('button', { name: 'Rotate host', exact: true })).toBeVisible()
  await page.getByRole('button', { name: /Edit Host card/ }).click()
  await expect(page.getByLabel('Host size', { exact: true })).toHaveValue('100')
  await expect(page.getByLabel('Host rotation', { exact: true })).toHaveValue('0')
})

test('touch handles resize and rotate on a narrow canvas', async ({ page }) => {
  await page.setViewportSize({ width: 393, height: 852 })
  await openStream(page)
  await uploadHost(page)
  await page.evaluate(() => {
    window.scrollTo(0, 0)
    document.querySelectorAll('.workspace-body').forEach((el) => (el.scrollTop = 0))
  })
  const canvas = page.locator('.si-artboard canvas')
  const cdp = await page.context().newCDPSession(page)
  const touchDrag = async (start: { x: number; y: number }, end: { x: number; y: number }) => {
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ ...start, id: 1 }],
    })
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ ...end, id: 1 }],
    })
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  }
  const box = (await page.locator('[data-workspace="stream"] .si-transform-box').boundingBox())!
  const handle = (await page
    .getByRole('button', { name: 'Resize host from bottom right' })
    .boundingBox())!
  const start = { x: handle.x + handle.width / 2, y: handle.y + handle.height / 2 }
  await touchDrag(start, { x: start.x + box.width * 0.15, y: start.y + box.height * 0.15 })
  expect(Number(await page.getByLabel('Host size', { exact: true }).inputValue())).toBeCloseTo(
    115,
    0,
  )
  await page.getByRole('button', { name: 'Reset Framing' }).click()
  await page.evaluate(() =>
    document.querySelectorAll('.workspace-body').forEach((el) => (el.scrollTop = 0)),
  )
  const rect = (await canvas.boundingBox())!
  const rotate = (await page
    .getByRole('button', { name: 'Rotate host', exact: true })
    .boundingBox())!
  const center = { x: rect.x + rect.width / 2, y: rect.y + rect.height * 0.54 }
  const radius = center.y - rotate.y - rotate.height / 2
  await touchDrag(
    { x: rotate.x + rotate.width / 2, y: rotate.y + rotate.height / 2 },
    { x: center.x + radius, y: center.y },
  )
  await expect(page.getByLabel('Host rotation', { exact: true })).toHaveValue('90')
  await cdp.detach()
})
