import { test, expect, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { unzipSync } from 'fflate'

const pngSize = (data: Uint8Array) => {
  const view = new DataView(data.buffer, data.byteOffset)
  return [view.getUint32(16), view.getUint32(20)]
}
const openHero = async (page: Page) => {
  await page.getByRole('button', { name: 'Apps' }).first().click()
  const apps = page.locator('[data-workspace="apps"]')
  await apps.getByRole('button', { name: /Hero image generator/ }).click()
  await expect(apps.locator('.hero-panel')).toBeVisible()
  return apps
}

test('the hero image generator frames one host on every artboard, takes layers and downloads the set', async ({
  page,
}, testInfo) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.addInitScript(() =>
    Object.defineProperty(window, 'showSaveFilePicker', { value: undefined, configurable: true }),
  )
  await page.goto('./')
  // Stream images now live in Apps.
  await expect(page.getByRole('button', { name: /Stream images/ })).toHaveCount(0)
  const apps = await openHero(page)
  const panel = apps.locator('.hero-panel')
  const list = apps.locator('.hero-artboard-list')
  const layers = apps.locator('.dz-layers')

  // The stream's three images, the hero image being edited, with its usual look.
  await expect(list.locator('li')).toHaveCount(3)
  await expect(list).toContainText('Hero image900 × 1200')
  await expect(list).toContainText('Host card1024 × 1024')
  await expect(list).toContainText('Stream image1200 × 1200')
  await expect(list.locator('li.is-active')).toContainText('Hero image')
  await expect(panel.getByRole('radio', { name: 'Image' })).toHaveAttribute('aria-checked', 'true')
  await expect(panel.getByRole('button', { name: 'Use Blue grid background' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )

  // One host for every artboard.
  await apps
    .locator('input[aria-label="Host image file"]')
    .setInputFiles('tests/fixtures/host-on-set.jpg')
  await expect(apps.getByText('Host updated on all 3 artboards.', { exact: false })).toBeVisible()
  await expect(panel.locator('.file-card')).toContainText('host-on-set.jpg')
  await expect(layers.locator('li')).toHaveCount(3)
  await expect(layers).toContainText('Host photo')
  await expect(layers).toContainText('Bottom shadow')

  // Framing in the panel: this artboard only.
  await panel.getByRole('button', { name: /^Framing/ }).click()
  await panel.getByLabel('Host size', { exact: true }).fill('130')
  await panel.getByLabel('Host size', { exact: true }).press('Enter')
  await expect(panel.getByRole('button', { name: /^Framing/ })).toContainText('130%')

  // Another artboard on the canvas opens its own settings.
  await apps.locator('.dz-artboard-label.is-neighbor', { hasText: 'Host card' }).click()
  await expect(list.locator('li.is-active')).toContainText('Host card')
  await expect(panel.getByRole('heading', { name: 'Host card' })).toBeVisible()
  await expect(panel.getByRole('button', { name: /^Framing/ })).toContainText('100%')
  await expect(panel.getByRole('radio', { name: 'Gradient' })).toHaveAttribute(
    'aria-checked',
    'true',
  )
  await panel.getByRole('button', { name: 'Use Coral colors' }).click()
  await expect(panel.getByLabel('Background color hex')).toHaveValue('#DC345A')
  await panel.getByRole('button', { name: 'Use this background for all 3' }).click()
  await list.getByRole('button', { name: /^Hero image/ }).click()
  await expect(panel.getByRole('radio', { name: 'Gradient' })).toHaveAttribute(
    'aria-checked',
    'true',
  )
  // …and the hero image kept its own framing.
  await expect(panel.getByRole('button', { name: /^Framing/ })).toContainText('130%')

  // Selecting the host on the layers list opens its framing.
  await layers.locator('li', { hasText: 'Host photo' }).click()
  await expect(panel.getByLabel('Host horizontal', { exact: true })).toBeVisible()

  // Layers on top: a title, copied to every artboard.
  await apps.getByRole('button', { name: 'Add text' }).click()
  await page.getByRole('dialog', { name: 'Add text' }).getByRole('button').first().click()
  await expect(apps.locator('.hero-panel')).toHaveCount(0)
  await expect(layers.locator('li')).toHaveCount(4)
  const title = layers.locator('li').first()
  await title.click({ button: 'right' })
  await page.getByRole('menuitem', { name: /Copy to other artboards/ }).click()
  await expect(apps.getByText(/copied to 2 other artboards/)).toBeVisible()

  // A new size takes the look of the artboard being edited.
  await apps.getByRole('button', { name: 'Add artboard' }).click()
  await page.getByRole('menuitem', { name: /Story \/ Reel/ }).click()
  await expect(list.locator('li')).toHaveCount(4)
  await expect(list.locator('li.is-active')).toContainText('Story / Reel1080 × 1920')
  await apps.locator('.stage-surround, .dz-stage').first().press('Escape')
  await expect(panel.getByRole('radio', { name: 'Gradient' })).toHaveAttribute(
    'aria-checked',
    'true',
  )

  // Download set: every artboard as a full-size PNG, in one ZIP.
  const saving = page.waitForEvent('download')
  await apps.getByRole('button', { name: 'Download set' }).click()
  const zip = await saving
  expect(zip.suggestedFilename()).toBe('untitled-hero-set.zip')
  const zipPath = testInfo.outputPath('hero.zip')
  await zip.saveAs(zipPath)
  const files = unzipSync(readFileSync(zipPath))
  expect(Object.keys(files).sort()).toEqual([
    'untitled-hero-set-hero-image-900x1200.png',
    'untitled-hero-set-host-card-1024x1024.png',
    'untitled-hero-set-story-reel-1080x1920.png',
    'untitled-hero-set-stream-image-1200x1200.png',
  ])
  expect(pngSize(files['untitled-hero-set-hero-image-900x1200.png'])).toEqual([900, 1200])
  expect(pngSize(files['untitled-hero-set-story-reel-1080x1920.png'])).toEqual([1080, 1920])

  // One artboard only, from the split button.
  const one = page.waitForEvent('download')
  await apps.getByRole('button', { name: 'More download options' }).click()
  await page.getByRole('menuitem', { name: /Download Story \/ Reel only/ }).click()
  expect((await one).suggestedFilename()).toBe('untitled-hero-set-story-reel-1080x1920.png')

  // The set saves as .savvy; opened from the Chyron editor it comes back here.
  const setSaving = page.waitForEvent('download')
  await apps.getByRole('button', { name: 'Set menu' }).click()
  await page.getByRole('menuitem', { name: /Save set file/ }).click()
  const setFile = await setSaving
  expect(setFile.suggestedFilename()).toBe('untitled-hero-set.savvy')
  const setPath = testInfo.outputPath('set.savvy')
  await setFile.saveAs(setPath)
  await page.getByRole('button', { name: 'Chyron' }).first().click()
  await page.locator('.chyron-root .topbar input[type=file]').setInputFiles(setPath)
  await expect(apps).toBeVisible()
  await expect(apps.getByText('Opened set.savvy. Undo to go back.')).toBeVisible()
  await expect(apps.locator('.hero-artboard-list li')).toHaveCount(4)
  await expect(panel.locator('.file-card')).toContainText('host-on-set.jpg')
  expect(errors).toEqual([])
})

test('a Stream images set carries over, and the old workspace opens the generator', async ({
  page,
}) => {
  await page.goto('./')
  // What the Stream images workspace kept on this device.
  await page.evaluate(async () => {
    const blob = await (await fetch('/chyrongenerator/assets/stream/grid-blue.png')).blob()
    const host = {
      id: 'h1',
      name: 'monday-host.png',
      blob,
      width: 10,
      height: 10,
      bounds: { x: 0, y: 0, width: 10, height: 10 },
    }
    const layout = (background: string) => ({
      background,
      color: '#7738D9',
      color2: '#F7BBFF',
      backgroundX: 50,
      backgroundY: 50,
      backgroundZoom: 100,
      x: 50,
      y: 54,
      zoom: 100,
      rotation: 0,
      flip: false,
      shadow: 0,
      fade: 0,
      bottomShadow: 0,
    })
    const doc = {
      version: 1,
      name: 'Monday show',
      host,
      backgrounds: [],
      layouts: {
        hero: { ...layout('solid'), zoom: 160 },
        host: layout('gradient'),
        stream: layout('savvy'),
      },
    }
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.open('chyron-stream-images', 1)
      req.onupgradeneeded = () => req.result.createObjectStore('drafts')
      req.onsuccess = () => {
        const tx = req.result.transaction('drafts', 'readwrite')
        tx.objectStore('drafts').put(doc, 'current')
        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error)
      }
    })
    localStorage.setItem('chyron-studio:workspace', 'stream')
  })
  await page.reload()
  const apps = page.locator('[data-workspace="apps"]')
  const panel = apps.locator('.hero-panel')
  await expect(apps.getByRole('textbox', { name: 'Set name' })).toHaveValue('Monday show')
  await expect(panel.locator('.file-card')).toContainText('monday-host.png')
  await expect(panel.getByRole('radio', { name: 'Solid' })).toHaveAttribute('aria-checked', 'true')
  await expect(panel.getByRole('button', { name: /^Framing/ })).toContainText('160%')
})

test('the Media gallery sends a host straight to the generator', async ({ page }) => {
  await page.goto('./')
  await page.getByRole('button', { name: 'Media gallery' }).first().click()
  const gallery = page.locator('[data-workspace="gallery"]')
  await gallery
    .getByRole('button', { name: /Host Images/ })
    .first()
    .click()
  await gallery.locator('.asset-card-main').first().click()
  await page.getByRole('button', { name: /Use in/ }).click()
  await page.getByRole('menuitem', { name: /Use in Hero image generator/ }).click()
  const apps = page.locator('[data-workspace="apps"]')
  await expect(apps.locator('.hero-panel .file-card')).toBeVisible()
  await expect(apps.getByText(/Host updated on all 3 artboards/)).toBeVisible()
})
