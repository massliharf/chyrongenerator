import { test, expect, type Page } from '@playwright/test'
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { unzipSync } from 'fflate'
import { DEFAULT_PROJECT, frameCount } from '../../src/studio/model'

const fixture = (name: string) => fileURLToPath(new URL(`../fixtures/${name}`, import.meta.url))
const rgba = (file: string) =>
  execFileSync('ffmpeg', ['-v', 'error', '-i', file, '-f', 'rawvideo', '-pix_fmt', 'rgba', '-'], {
    maxBuffer: 20_000_000,
  })
const pixel = (data: Buffer, width: number, x: number, y: number) => [
  ...data.subarray((y * width + x) * 4, (y * width + x) * 4 + 4),
]

async function exportAs(page: Page, format: string, path: string) {
  await page.getByRole('button', { name: 'Export', exact: true }).click()
  await page.getByRole('radio', { name: new RegExp(format) }).click()
  const download = page.waitForEvent('download', { timeout: 150_000 })
  await page.getByRole('button', { name: `Export ${format}`, exact: true }).click()
  await (await download).saveAs(path)
  await expect(page.getByRole('dialog').getByRole('status')).toContainText('Your export is ready')
  await page.getByRole('button', { name: 'Close export' }).click()
}

test('image layers: upload, arrange, animate, export and reopen', async ({ page }, testInfo) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.addInitScript(
    (p) => {
      if (!sessionStorage.getItem('seeded')) {
        localStorage.setItem('chyron-studio:v2', JSON.stringify(p))
        sessionStorage.setItem('seeded', '1')
      }
    },
    { ...DEFAULT_PROJECT, animationDuration: 0.4, hold: 0.6 },
  )
  await page.goto('./')
  const canvas = page.getByRole('img', { name: /Composition preview/ })
  await expect(canvas).toHaveCSS('opacity', '1')

  // Upload the Affidavit photo and the SHOWDOWN logo in one go.
  await page
    .locator('.timeline input[type=file]')
    .setInputFiles([fixture('affidavit.jpg'), fixture('showdown-logo.png')])
  const rows = page.locator('.layer-label')
  await expect(rows).toHaveCount(3)
  // Front to back: logo, chyron, full-bleed photo.
  await expect(rows.nth(0)).toContainText('showdown-logo')
  await expect(rows.nth(1)).toContainText('Chyron')
  await expect(rows.nth(2)).toContainText('affidavit')
  // A new image opens selected, on its Animate tab, with its name in the header.
  await expect(rows.nth(0)).toHaveClass(/selected/)
  await expect(page.getByRole('tab', { name: 'Animate', exact: true })).toHaveAttribute(
    'aria-selected',
    'true',
  )
  await expect(page.getByLabel('Layer name', { exact: true })).toHaveValue('showdown-logo')
  await page.getByRole('tab', { name: 'Design', exact: true }).click()

  // The photo covers the frame: the canvas corner is opaque at rest.
  const cornerAlpha = () =>
    canvas.evaluate((node) => {
      const c = node as HTMLCanvasElement
      return c.getContext('2d')!.getImageData(2, 2, 1, 1).data[3]
    })
  await expect.poll(cornerAlpha).toBe(255)

  // Drag the logo to the right on the canvas.
  const before = Number(await page.getByLabel('X (%)').inputValue())
  const box = (await page.locator('.composition-transform-box').boundingBox())!
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width / 2 + 40, box.y + box.height / 2 + 5, { steps: 5 })
  await page.mouse.up()
  const after = Number(await page.getByLabel('X (%)').inputValue())
  expect(after).toBeGreaterThan(before + 5)

  // Advanced motion and a staggered start.
  await page.getByRole('tab', { name: 'Animate', exact: true }).click()
  await page.getByRole('button', { name: 'Burst', exact: true }).click()
  await page.getByLabel('Out', { exact: true }).selectOption('slide-right')
  await page.getByLabel('Delay (s)').fill('0.3')
  await page.getByLabel('Delay (s)').press('Tab')
  await expect(page.getByRole('button', { name: 'Burst', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await expect(page.locator('.image-clip')).toHaveCount(2)
  await page.screenshot({ path: testInfo.outputPath('layers-desktop.png') })

  // Hide the chyron for an image-only intermission graphic, then bring it back.
  await page.getByRole('button', { name: 'Hide Chyron' }).click()
  await expect(page.getByRole('button', { name: 'Show Chyron' })).toBeVisible()
  await page.getByRole('button', { name: 'Show Chyron' }).click()

  // Still PNG: the photo is composited under the chyron and logo.
  const png = testInfo.outputPath('layers.png')
  await exportAs(page, 'PNG image', png)
  const still = rgba(png)
  expect(still.length).toBe(720 * 1280 * 4)
  expect(pixel(still, 720, 1, 1)[3]).toBe(255)
  expect(pixel(still, 720, 718, 1278)[3]).toBe(255)

  // Sequence: transparent first/last frames, opaque photo at rest, images embedded.
  const zipPath = testInfo.outputPath('layers.zip')
  await exportAs(page, 'PNG sequence', zipPath)
  const archive = unzipSync(readFileSync(zipPath))
  const frames = Object.keys(archive)
    .filter((n) => n.endsWith('.png'))
    .sort()
  const count = frameCount({ ...DEFAULT_PROJECT, animationDuration: 0.4, hold: 0.6 })
  expect(frames).toHaveLength(count)
  const decode = (name: string) => {
    const path = testInfo.outputPath(name)
    writeFileSync(path, archive[name])
    return rgba(path)
  }
  expect([...decode(frames[0])].filter((_, i) => i % 4 === 3).every((a) => a === 0)).toBe(true)
  expect([...decode(frames.at(-1)!)].filter((_, i) => i % 4 === 3).every((a) => a === 0)).toBe(true)
  expect(pixel(decode(frames[Math.floor(count / 2)]), 720, 1, 1)[3]).toBe(255)
  const packed = JSON.parse(new TextDecoder().decode(archive['project.chyron.json']))
  expect(Object.keys(packed.assets)).toHaveLength(2)

  // SVG embeds both images.
  const svgPath = testInfo.outputPath('layers.svg')
  await exportAs(page, 'SVG vector', svgPath)
  const svg = readFileSync(svgPath, 'utf8')
  expect(svg.match(/<image /g)).toHaveLength(2)
  expect(svg).toContain('<path')

  // Portable project file carries its images.
  await page.getByRole('button', { name: 'Project menu' }).click()
  const saving = page.waitForEvent('download')
  await page.getByRole('button', { name: /Save project file/ }).click()
  const projectPath = testInfo.outputPath('layers.chyron.json')
  await (await saving).saveAs(projectPath)
  const saved = JSON.parse(readFileSync(projectPath, 'utf8'))
  expect(saved.layers).toHaveLength(3)
  expect(Object.values(saved.assets as Record<string, { data: string }>)[0].data).toMatch(
    /^data:image\//,
  )

  // Delete + undo restores the layer.
  await rows.nth(0).locator('.layer-name').click()
  await rows.nth(0).locator('.layer-name').click()
  await page.getByRole('button', { name: 'Delete layer' }).click()
  await expect(rows).toHaveCount(2)
  await page.getByRole('button', { name: 'Undo', exact: true }).click()
  await expect(rows).toHaveCount(3)

  // Reload: layers and images persist on this device.
  await page.waitForTimeout(400)
  await page.reload()
  await expect(canvas).toHaveCSS('opacity', '1')
  await expect.poll(cornerAlpha).toBe(255)

  // New composition, then reopen the portable file.
  await page.getByRole('button', { name: 'Project menu' }).click()
  await page.getByRole('button', { name: /New composition/ }).click()
  await expect.poll(cornerAlpha).toBe(0)
  await page.locator('header input[type=file]').setInputFiles(projectPath)
  await expect(page.getByText('Project opened.')).toBeVisible()
  await expect.poll(cornerAlpha).toBe(255)

  // Mobile layout keeps working with layers.
  await page.setViewportSize({ width: 393, height: 852 })
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
    .toBe(true)
  await page.screenshot({ path: testInfo.outputPath('layers-mobile.png') })
  expect(errors).toEqual([])
})

test('WebM export keeps alpha around a photo layer', async ({ page }, testInfo) => {
  // A small canvas keeps lossless VP9 encoding of photographic content quick.
  const project = { ...DEFAULT_PROJECT, width: 320, height: 568, animationDuration: 0.3, hold: 0.2 }
  await page.addInitScript(
    (p) => localStorage.setItem('chyron-studio:v2', JSON.stringify(p)),
    project,
  )
  await page.goto('./')
  await expect(page.getByRole('img', { name: /Composition preview/ })).toHaveCSS('opacity', '1')
  await page.locator('.timeline input[type=file]').setInputFiles(fixture('affidavit.jpg'))
  await expect(page.locator('.layer-label')).toHaveCount(2)
  const webm = testInfo.outputPath('layers.webm')
  await page.getByRole('button', { name: 'Export', exact: true }).click()
  await expect(page.getByText(/Photos make lossless video slower/)).toBeVisible()
  await page.getByRole('button', { name: 'Close export' }).click()
  await exportAs(page, 'WebM', webm)
  const planes = execFileSync(
    'ffmpeg',
    [
      '-v',
      'error',
      '-c:v',
      'libvpx-vp9',
      '-i',
      webm,
      '-vf',
      'alphaextract',
      '-f',
      'rawvideo',
      '-pix_fmt',
      'gray',
      '-',
    ],
    { maxBuffer: 50_000_000 },
  )
  const size = project.width * project.height
  const count = frameCount(project)
  expect(planes.length).toBe(size * count)
  expect(planes.subarray(0, size).every((a) => a === 0)).toBe(true)
  expect(planes.subarray((count - 1) * size).every((a) => a === 0)).toBe(true)
  expect(planes[Math.floor(count / 2) * size]).toBe(255)
})

test('timeline drag, reorder, shortcuts, shared animation and live previews', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto('./')
  await expect(page.getByRole('img', { name: /Composition preview/ })).toHaveCSS('opacity', '1')
  await page
    .locator('.timeline input[type=file]')
    .setInputFiles([fixture('affidavit.jpg'), fixture('showdown-logo.png')])
  const labels = page.locator('.layer-label')
  await expect(labels).toHaveCount(3)
  await page.getByRole('button', { name: 'Dismiss notification' }).click()

  // Choosing a style plays it, then returns to the fully visible rest frame.
  await page.getByRole('button', { name: 'Slam', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Pause animation' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Play animation' })).toBeVisible()
  await expect(page.locator('.timecode')).toHaveText('2.20 / 4.40 s')

  // Drag the logo's bar to the right: its delay follows the pointer, snapped to frames.
  const delay = page.getByLabel('Delay (s)')
  await expect(delay).toHaveValue('0')
  const clip = page.locator('.track').first().locator('.clip')
  const box = (await clip.boundingBox())!
  const tracks = (await page.locator('.tracks').boundingBox())!
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(
    box.x + box.width / 2 + tracks.width * (0.5 / 4.4),
    box.y + box.height / 2,
    {
      steps: 6,
    },
  )
  await page.mouse.up()
  await expect.poll(async () => Number(await delay.inputValue())).toBeCloseTo(0.5, 1)

  // Drag the transition edge to lengthen the intro.
  const length = page.getByLabel('Length (s)')
  const handle = (await page.locator('.track').first().locator('.clip-handle').boundingBox())!
  await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2)
  await page.mouse.down()
  await page.mouse.move(handle.x + handle.width / 2 + tracks.width * (0.3 / 4.4), handle.y + 5, {
    steps: 6,
  })
  await page.mouse.up()
  await expect.poll(async () => Number(await length.inputValue())).toBeCloseTo(1.3, 1)

  // Share the animation with the other image.
  await page.getByRole('button', { name: 'Use this animation on 1 other image' }).click()
  await labels.nth(2).locator('.layer-name').click()
  await expect(page.getByRole('button', { name: 'Slam', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  )

  // Shortcuts: hide, duplicate, reorder.
  await page.locator('.stage-surround').click({ position: { x: 8, y: 8 } })
  await labels.nth(0).locator('.layer-name').click()
  await page.keyboard.press('h')
  await expect(labels.nth(0)).toHaveClass(/is-hidden/)
  await page.keyboard.press('h')
  await expect(labels.nth(0)).not.toHaveClass(/is-hidden/)
  await page.keyboard.press('ControlOrMeta+d')
  await expect(labels).toHaveCount(4)
  await expect(labels.nth(0)).toContainText('showdown-logo copy')
  await page.keyboard.press('[')
  await expect(labels.nth(1)).toContainText('showdown-logo copy')

  // Drag a layer name to the top of the stack.
  await labels.nth(3).dragTo(labels.nth(0))
  await expect(labels.nth(0)).toContainText('affidavit')

  // The guide lists the shortcuts.
  await page.keyboard.press('?')
  await expect(page.getByRole('dialog')).toContainText('Duplicate image')
  await page.getByRole('button', { name: 'Close tour' }).click()
  expect(errors).toEqual([])
})
