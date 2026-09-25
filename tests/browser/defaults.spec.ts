import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'

test('live preview is the default but never exported; subtitle toggle hides its entire layer', async ({
  page,
}, testInfo) => {
  await page.goto('./')
  const canvas = page.getByRole('img', { name: /Composition preview/ })
  await expect(canvas).toHaveCSS('opacity', '1')
  await expect(page.locator('.stage-canvas')).toHaveClass(/live/)
  await expect(page.locator('.stage-canvas')).toHaveCSS('background-image', /live-preview\.png/)
  const image = await page.request.get('./assets/preview/live-preview.png')
  expect(image.ok()).toBe(true)
  await expect(page.locator('.timecode')).toHaveText('2.20 / 4.40 s')
  await page.screenshot({ path: testInfo.outputPath('studio-blue.png') })
  await page.getByRole('button', { name: /^Typography/ }).click()
  await expect(page.getByLabel('Typeface', { exact: true })).toHaveValue('Fredoka')
  await expect(page.getByLabel('Size', { exact: true })).toHaveValue('128')
  await page.getByRole('button', { name: /^Shape & spacing/ }).click()
  for (const [label, value] of [
    ['Corner radius', '24'],
    ['Letter padding', '16'],
    ['Tile spacing', '8'],
    ['Line spacing', '16'],
    ['Depth', '8'],
  ]) {
    await expect(page.getByLabel(label, { exact: true })).toHaveValue(value)
  }
  await page.getByRole('button', { name: /^Subtitle\s/ }).click()
  for (const [label, value] of [
    ['Subtitle size', '64'],
    ['Subtitle gap', '32'],
    ['Subtitle radius', '24'],
    ['Horizontal padding', '24'],
    ['Vertical padding', '32'],
  ]) {
    await expect(page.getByLabel(label, { exact: true })).toHaveValue(value)
  }
  const download = async (format: string) => {
    await page.getByRole('button', { name: 'Export', exact: true }).click()
    await page.getByRole('radio', { name: new RegExp(format) }).click()
    const pending = page.waitForEvent('download')
    await page.getByRole('button', { name: `Export ${format}`, exact: true }).click()
    const data = readFileSync((await (await pending).path())!)
    await page.getByRole('button', { name: 'Close export' }).click()
    return data
  }
  const png = await download('PNG image')
  expect(png.readUInt32BE(16)).toBe(720)
  expect(png.readUInt32BE(20)).toBe(1280)
  const pixels = execFileSync(
    'ffmpeg',
    ['-v', 'error', '-f', 'image2pipe', '-i', 'pipe:0', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-'],
    { input: png, maxBuffer: 5_000_000 },
  )
  expect(pixels[3]).toBe(0)
  expect(pixels.some((value, index) => index % 4 === 3 && value === 255)).toBe(true)
  const toggle = page.getByRole('checkbox', { name: 'Subtitle', exact: true })
  await toggle.uncheck()
  await expect(page.getByLabel('Subtitle size', { exact: true })).toBeHidden()
  await expect(canvas).not.toHaveAttribute('aria-label', /PUZZLE PAPI/)
  const hiddenSvg = (await download('SVG vector')).toString()
  // A disabled subtitle contributes no paths or spacing to the shared export scene.
  await toggle.check()
  await page.getByLabel('Subtitle text', { exact: true }).fill('')
  const emptySvg = (await download('SVG vector')).toString()
  expect(hiddenSvg).toBe(emptySvg)
  await page.getByLabel('Subtitle text', { exact: true }).fill('PUZZLE PAPI')
  await expect(canvas).toHaveAttribute('aria-label', /PUZZLE PAPI/)
  const enabledSvg = (await download('SVG vector')).toString()
  expect(enabledSvg).not.toBe(emptySvg)
  await page.getByRole('button', { name: /Canvas settings/ }).click()
  await expect(page.getByLabel('Size', { exact: true })).toHaveValue('720x1280')
  await page.getByRole('button', { name: 'Preview options' }).click()
  await expect(page.getByRole('menuitemradio', { name: /Live photo/ })).toHaveAttribute(
    'aria-checked',
    'true',
  )
})
