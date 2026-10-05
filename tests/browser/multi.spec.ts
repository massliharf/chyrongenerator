import { test, expect, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { DEFAULT_PROJECT } from '../../src/studio/model'

const fixture = (name: string) => fileURLToPath(new URL(`../fixtures/${name}`, import.meta.url))
const probe = (file: string) =>
  execFileSync('ffprobe', [
    '-v',
    'error',
    '-show_entries',
    'stream=codec_name,codec_type:stream_tags=alpha_mode',
    '-of',
    'compact',
    file,
  ]).toString()
const alphaOf = (file: string, at: number) => {
  const raw = execFileSync(
    'ffmpeg',
    ['-v', 'error', '-c:v', 'libvpx-vp9', '-ss', String(at), '-i', file, '-frames:v', '1'].concat([
      '-f',
      'rawvideo',
      '-pix_fmt',
      'rgba',
      '-',
    ]),
    { maxBuffer: 20_000_000 },
  )
  let max = 0
  for (let i = 3; i < raw.length; i += 4) max = Math.max(max, raw[i])
  return max
}

async function exportAs(page: Page, format: string, path: string) {
  await page.getByRole('button', { name: 'Export', exact: true }).click()
  await page.getByRole('radio', { name: new RegExp(format) }).click()
  const download = page.waitForEvent('download', { timeout: 150_000 })
  await page.getByRole('button', { name: `Export ${format}`, exact: true }).click()
  await (await download).saveAs(path)
  await expect(page.getByRole('dialog').getByRole('status')).toContainText('Your export is ready')
  await page.getByRole('button', { name: 'Close export' }).click()
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(
    (p) => {
      if (!sessionStorage.getItem('seeded')) {
        localStorage.setItem('chyron-studio:v2', JSON.stringify(p))
        sessionStorage.setItem('seeded', '1')
      }
    },
    { ...DEFAULT_PROJECT, animationDuration: 0.4, hold: 0.6 },
  )
})

test('chyrons, text, a shape and music build one composition and export together', async ({
  page,
}, testInfo) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto('./')
  await expect(page.getByRole('img', { name: /Composition preview/ })).toHaveCSS('opacity', '1')
  const add = async (item: RegExp) => {
    await page.getByRole('button', { name: 'Add layer' }).click()
    await page.getByRole('menuitem', { name: item }).click()
  }
  // A second chyron opens with its words selected, ready to type over.
  await add(/^Chyron/)
  await page.keyboard.type('Guest\nStar')
  await expect(page.getByLabel('Title', { exact: true })).toHaveValue('Guest\nStar')
  await expect(page.getByRole('heading', { name: 'Chyron 2' })).toBeVisible()
  await add(/^Text/)
  await add(/^Shape/)
  const rows = page.locator('.layer-labels .layer-label')
  await expect(rows).toHaveCount(4)
  // The first chyron keeps its own words.
  await expect(page.locator('.title-clip', { hasText: 'Scott Rogowsky' })).toBeVisible()
  await expect(page.locator('.title-clip', { hasText: 'Guest Star' })).toBeVisible()
  await expect(page.locator('.shape-clip')).toHaveCount(1)

  // Text animates letter by letter and shares the on-screen effects.
  await page.locator('.layer-name', { hasText: 'Chyron 2' }).click()
  await page.getByRole('tab', { name: 'Animate', exact: true }).click()
  await page.getByRole('button', { name: 'Shine', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Shine', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await expect(page.getByRole('button', { name: 'Letter wave', exact: true })).toBeVisible()

  // Music: one track under the layers, with its own settings.
  await page.locator('input[aria-label="Music file"]').setInputFiles(fixture('tone.mp3'))
  await expect(page.locator('.music-label')).toContainText('tone')
  await expect(page.getByLabel('Music name')).toHaveValue('tone')
  await page.getByLabel('Fade in', { exact: true }).fill('0.2')
  await page.getByLabel('Fade in', { exact: true }).press('Tab')
  await page.screenshot({ path: testInfo.outputPath('multi-layers.png') })

  const webm = testInfo.outputPath('multi.webm')
  await exportAs(page, 'WebM', webm)
  const streams = probe(webm)
  expect(streams).toContain('codec_name=vp9')
  expect(streams).toContain('alpha_mode=1')
  expect(streams).toContain('codec_name=vorbis')
  expect(alphaOf(webm, 0)).toBe(0)
  expect(alphaOf(webm, 0.7)).toBe(255)

  const mov = testInfo.outputPath('multi.mov')
  await exportAs(page, 'ProRes 4444', mov)
  expect(probe(mov)).toContain('codec_name=pcm_s16le')
  expect(errors).toEqual([])
})

test('background removal cuts out the subject and can be undone', async ({ page }) => {
  await page.goto('./')
  await expect(page.getByRole('img', { name: /Composition preview/ })).toHaveCSS('opacity', '1')
  await page.locator('.timeline input[type=file]').setInputFiles(fixture('host-on-set.jpg'))
  await expect(page.locator('.toast')).toContainText('Double-click it to crop')
  await page.getByRole('tab', { name: 'Design', exact: true }).click()
  await page.getByRole('button', { name: 'Remove background' }).click()
  const dialog = page.locator('dialog.cutout-dialog')
  await expect(dialog.getByRole('button', { name: 'Apply' })).toBeEnabled({ timeout: 60_000 })
  // The preview is transparent around the subject and opaque on it.
  const preview = dialog.getByRole('img', { name: /without its background/ })
  const alphaAt = (fx: number, fy: number) =>
    preview.evaluate(
      (node, [x, y]) => {
        const c = node as HTMLCanvasElement
        return c
          .getContext('2d')!
          .getImageData(Math.floor(c.width * x), Math.floor(c.height * y), 1, 1).data[3]
      },
      [fx, fy],
    )
  expect(await alphaAt(0.03, 0.03)).toBeLessThan(30)
  expect(await alphaAt(0.5, 0.6)).toBeGreaterThan(220)
  await dialog.getByRole('button', { name: 'Apply' }).click()
  await expect(dialog).toBeHidden({ timeout: 60_000 })
  await expect(page.locator('.picture-note')).toContainText('Background removed')
  await page.getByRole('button', { name: 'Restore original' }).click()
  await expect(page.locator('.picture-note')).toHaveCount(0)
})

test('the save status explains where work is kept', async ({ page }) => {
  await page.goto('./')
  await page.getByRole('button', { name: /Where is my work/ }).click()
  const dialog = page.getByRole('dialog', { name: 'Where is my work?' })
  await expect(dialog).toContainText("this browser's storage on this device")
  await expect(dialog).toContainText('.chyron.json')
  await expect(dialog.getByRole('button', { name: 'Save project file' })).toBeVisible()
  await dialog.getByRole('button', { name: 'Done' }).click()
  await expect(dialog).toBeHidden()
})

test('every layer can be deleted, the starting chyron included', async ({ page }) => {
  await page.goto('./')
  const canvas = page.getByRole('img', { name: /Composition preview/ })
  await expect(canvas).toHaveCSS('opacity', '1')
  const rows = page.locator('.layer-labels .layer-label')
  await expect(rows).toHaveCount(1)
  // The chyron starts selected; delete it like any other element.
  await page.getByRole('button', { name: 'Layer actions' }).click()
  await page.getByRole('menuitem', { name: /Delete layer/ }).click()
  await expect(rows).toHaveCount(0)
  await expect(page.getByText('Nothing to show yet')).toBeVisible()
  await expect(canvas).toHaveAccessibleName(/Composition preview: empty/)
  // Undo brings it back; deleting with the keyboard works too.
  await page.getByRole('button', { name: 'Undo', exact: true }).click()
  await expect(rows).toHaveCount(1)
  await page.locator('.layer-name', { hasText: 'Chyron' }).click()
  await page.keyboard.press('Delete')
  await expect(rows).toHaveCount(0)
  // A chyron added to the empty canvas takes the middle, ready to type.
  await page.getByRole('button', { name: 'Add layer' }).click()
  await page.getByRole('menuitem', { name: /^Chyron/ }).click()
  await page.keyboard.type('Fresh\nStart')
  await expect(rows).toHaveCount(1)
  await expect(page.locator('.title-clip', { hasText: 'Fresh Start' })).toBeVisible()
  await expect(page.getByText('Nothing to show yet')).toHaveCount(0)
  // The empty state survives a reload.
  await page.locator('.stage-surround').click({ position: { x: 8, y: 8 } })
  await page.locator('.layer-name', { hasText: 'Chyron' }).click()
  await page.keyboard.press('Delete')
  await page.waitForTimeout(400)
  await page.reload()
  await expect(page.getByText('Nothing to show yet')).toBeVisible()
  await expect(rows).toHaveCount(0)
})

test('right-clicking a layer opens its actions, on the canvas and in the timeline', async ({
  page,
}) => {
  await page.goto('./')
  const canvas = page.getByRole('img', { name: /Composition preview/ })
  await expect(canvas).toHaveCSS('opacity', '1')
  const rows = page.locator('.layer-labels .layer-label')
  const names = () => rows.locator('.layer-name span').allTextContents()
  await page.getByRole('button', { name: 'Add layer' }).click()
  await page.getByRole('menuitem', { name: /^Shape/ }).click()
  // The new shape goes in under the selected chyron, and is selected.
  await expect.poll(names).toEqual(['Chyron', 'Rectangle'])

  // A row's right-click menu is named after its layer and selects it.
  await rows.filter({ hasText: 'Chyron' }).click({ button: 'right' })
  const menu = page.getByRole('menu', { name: 'Layer actions' })
  await expect(menu.locator('.menu-title')).toHaveText('Chyron')
  await expect(page.getByRole('textbox', { name: 'Layer name' })).toHaveValue('Chyron')
  await expect(menu.getByRole('menuitem').first()).toBeFocused()
  // Scan once the menu has finished fading in.
  await menu.evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished)))
  const scan = await new AxeBuilder({ page })
    .include('.context-menu')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
    .analyze()
  expect(
    scan.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.failureSummary).join(' | ')}`),
  ).toEqual([])
  // Escape closes it and keeps the selection.
  await page.keyboard.press('Escape')
  await expect(menu).toBeHidden()
  await expect(page.getByRole('textbox', { name: 'Layer name' })).toHaveValue('Chyron')
  await rows.filter({ hasText: 'Rectangle' }).click({ button: 'right' })
  await menu.getByRole('menuitem', { name: /Bring to front/ }).click()
  await expect(menu).toBeHidden()
  await expect.poll(names).toEqual(['Rectangle', 'Chyron'])

  // ⋯ on a row opens the same list; Rename selects the name in Properties.
  await page.getByRole('button', { name: 'Actions for Rectangle' }).click()
  await page.getByRole('menuitem', { name: 'Rename' }).click()
  await expect(page.getByRole('textbox', { name: 'Layer name' })).toBeFocused()
  await page.keyboard.type('Bar')
  await expect.poll(names).toEqual(['Bar', 'Chyron'])

  // Right-click the bar on the canvas, then delete it from there; undo restores it.
  const box = (await canvas.boundingBox())!
  await canvas.click({ button: 'right', position: { x: box.width / 2, y: box.height * 0.75 } })
  await expect(menu.locator('.menu-title')).toHaveText('Bar')
  await menu.getByRole('menuitem', { name: /Delete layer/ }).click()
  await expect.poll(names).toEqual(['Chyron'])
  await page.getByRole('button', { name: 'Undo', exact: true }).click()
  await expect.poll(names).toEqual(['Bar', 'Chyron'])

  // Shift+[ sends the selected layer to the back.
  await rows.filter({ hasText: 'Bar' }).locator('.layer-name').click()
  await page.keyboard.press('Shift+BracketLeft')
  await expect.poll(names).toEqual(['Chyron', 'Bar'])
})

test('Space plays right after clicking a layer, and shortcuts draw no focus ring', async ({
  page,
}) => {
  await page.goto('./')
  await expect(page.getByRole('img', { name: /Composition preview/ })).toHaveCSS('opacity', '1')
  await page.getByRole('button', { name: 'Add layer' }).click()
  await page.getByRole('menuitem', { name: /^Shape/ }).click()
  const names = () => page.locator('.layer-labels .layer-name span').allTextContents()
  await expect.poll(names).toEqual(['Chyron', 'Rectangle'])
  const chyron = page.locator('.layer-name', { hasText: 'Chyron' })
  await chyron.click()
  await page.keyboard.press('[')
  await expect.poll(names).toEqual(['Rectangle', 'Chyron'])
  // The clicked row keeps its highlight, without a focus ring.
  await expect(chyron).toBeFocused()
  await expect(chyron).toHaveCSS('outline-style', 'none')
  // Space plays and pauses instead of pressing the focused row.
  await page.keyboard.press('Space')
  await expect(page.getByRole('button', { name: 'Pause animation' })).toBeVisible()
  await expect(chyron).toHaveAttribute('aria-pressed', 'true')
  await page.keyboard.press('Space')
  await expect(page.getByRole('button', { name: 'Play animation', exact: true })).toBeVisible()
  // Moving on with Tab shows focus rings again.
  await page.keyboard.press('Tab')
  await expect(page.locator(':focus')).toHaveCSS('outline-style', 'solid')
})

test('the video length is typed in the timeline or grown from a layer Hold', async ({ page }) => {
  await page.goto('./')
  await expect(page.getByRole('img', { name: /Composition preview/ })).toHaveCSS('opacity', '1')
  // This file starts from a 1.4 s clip: 0.4 s in, 0.6 s hold, 0.4 s out.
  const length = page.getByLabel('Video length in seconds')
  await expect(length).toHaveValue('1.4')
  await length.fill('10')
  await length.press('Enter')
  await expect(length).toHaveValue('10')
  await page.getByRole('tab', { name: 'Animate', exact: true }).click()
  // In, Out, Timing and While on screen are all named; Timing opens from its summary.
  const timing = page.getByRole('button', { name: /^Timing/ })
  await expect(timing).toContainText('9.2 s hold')
  await expect(page.getByRole('button', { name: /^While on screen/ })).toBeVisible()
  await timing.click()
  const hold = page.getByLabel('Hold', { exact: true })
  await hold.fill('30')
  await hold.press('Enter')
  await expect(length).toHaveValue('30.8')
  await expect(timing).toContainText('30 s hold')
  // Composition › Timing has the same length, ready to type.
  await page.getByRole('button', { name: 'Clip length and frame rate' }).click()
  await expect(page.getByRole('heading', { name: 'Composition', exact: true })).toBeVisible()
  await expect(page.getByLabel('Length', { exact: true })).toBeFocused()
  await expect(page.getByLabel('Length', { exact: true })).toHaveValue('30.8')
})
