import { test, expect, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']
const selectChyron = (page: Page) => page.locator('.layer-name', { hasText: 'Chyron' }).click()

// User journeys exercise disclosure, keyboard control, persistence and actual output.
test('section disclosure, keyboard tabs and dialog focus', async ({ page }) => {
  await page.goto('./')
  const title = page.getByLabel('Title', { exact: true })
  const text = page.getByRole('button', { name: /^Text/ })
  await text.focus()
  // Space on a focused control activates it instead of playing the timeline.
  await page.keyboard.press('Space')
  await expect(title).toBeHidden()
  await expect(page.getByRole('button', { name: 'Play animation', exact: true })).toBeVisible()
  await page.keyboard.press('Space')
  await expect(title).toBeVisible()
  await page.getByRole('tab', { name: 'Design', exact: true }).focus()
  await page.keyboard.press('ArrowRight')
  await expect(page.getByRole('tab', { name: 'Animate', exact: true })).toBeFocused()
  await expect(page.getByRole('tab', { name: 'Animate', exact: true })).toHaveAttribute(
    'aria-selected',
    'true',
  )
  await page.keyboard.press('ArrowRight')
  await expect(page.getByRole('tab', { name: 'Design', exact: true })).toBeFocused()
  await page.getByRole('button', { name: 'Collapse timeline' }).click()
  await expect(page.getByRole('button', { name: 'Expand timeline' })).toHaveAttribute(
    'aria-expanded',
    'false',
  )
  await page.getByRole('button', { name: 'Expand timeline' }).click()
  await page.getByRole('button', { name: 'Export', exact: true }).click()
  const webm = page.getByRole('radio', { name: /WebM/ })
  await webm.focus()
  await page.keyboard.press('ArrowDown')
  await expect(page.getByRole('radio', { name: /ProRes/ })).toHaveAttribute('aria-checked', 'true')
  await expect(page.getByRole('radio', { name: /ProRes/ })).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('button', { name: 'Export', exact: true })).toBeFocused()
  // Escape clears the selection and shows composition settings.
  await page.locator('.stage-surround').click({ position: { x: 8, y: 8 } })
  await expect(page.getByRole('heading', { name: 'Composition', exact: true })).toBeVisible()
  await page.getByLabel('Transition value').fill('1.6')
  await page.getByLabel('Transition value').press('Tab')
  await selectChyron(page)
  await text.click()
  await page.reload()
  await expect(page.getByRole('button', { name: /^Text/ })).toHaveAttribute(
    'aria-expanded',
    'false',
  )
  await page.getByRole('button', { name: /Canvas settings/ }).click()
  await expect(page.getByLabel('Transition value')).toHaveValue('1.6')
})

test('custom dimensions, hex colors, typography and translucent exports', async ({
  page,
}, testInfo) => {
  await page.goto('./')
  await page.getByLabel('Title', { exact: true }).fill('Aa\nStudio')
  await page.getByRole('button', { name: /^Typography/ }).click()
  await page.getByRole('button', { name: 'Type', exact: true }).click()
  await page.getByLabel('Typeface', { exact: true }).selectOption('Inter')
  await page.getByLabel('Case', { exact: true }).selectOption('original')
  await page.getByLabel('Letter spacing value').fill('12')
  await page.getByRole('button', { name: /^Colors/ }).click()
  const color = page.getByLabel('Lettering hex', { exact: true })
  await color.fill('oops')
  await color.press('Tab')
  await expect(page.getByRole('alert')).toContainText('Use 3 or 6 hex digits')
  await color.fill('#af0')
  await color.press('Tab')
  await expect(color).toHaveValue('#AAFF00')
  await page.getByRole('checkbox', { name: 'Subtitle', exact: true }).uncheck()
  await page.getByLabel('Rotation value', { exact: true }).fill('25')
  await page.getByLabel('Opacity value', { exact: true }).fill('50')
  await page.getByLabel('Opacity value', { exact: true }).press('Tab')
  await page.getByRole('button', { name: /Canvas settings/ }).click()
  const width = page.getByLabel('Width (px)', { exact: true })
  await width.fill('')
  await width.pressSequentially('1000')
  await width.press('Tab')
  await expect(width).toHaveValue('1000')
  await page.getByRole('button', { name: 'Lock aspect ratio', exact: true }).click()
  await width.fill('500')
  await width.press('Tab')
  await expect(page.getByLabel('Height (px)', { exact: true })).toHaveValue('640')
  await page.getByRole('button', { name: 'Swap dimensions', exact: true }).click()
  await expect(width).toHaveValue('640')
  await expect(page.getByLabel('Height (px)', { exact: true })).toHaveValue('500')
  await page.getByRole('button', { name: 'Export', exact: true }).click()
  const paths: Record<string, string> = {}
  for (const format of ['PNG image', 'SVG vector']) {
    await page.getByRole('radio', { name: new RegExp(format) }).click()
    const download = page.waitForEvent('download')
    await page.getByRole('button', { name: `Export ${format}`, exact: true }).click()
    const file = await download
    paths[format] = testInfo.outputPath(file.suggestedFilename())
    await file.saveAs(paths[format])
  }
  const rgba = execFileSync(
    'ffmpeg',
    ['-v', 'error', '-i', paths['PNG image'], '-f', 'rawvideo', '-pix_fmt', 'rgba', '-'],
    { maxBuffer: 4_000_000 },
  )
  let peak = 0
  for (let i = 3; i < rgba.length; i += 4) peak = Math.max(peak, rgba[i])
  expect(peak).toBeGreaterThanOrEqual(127)
  expect(peak).toBeLessThanOrEqual(128)
  expect(rgba[3]).toBe(0)
  const svg = readFileSync(paths['SVG vector'], 'utf8')
  expect(svg).toContain('width="640" height="500"')
  expect(svg).toContain('<g opacity="0.5"')
  expect(svg).toContain('rotate(25 ')
  await page.getByRole('button', { name: 'Close export' }).click()
  await page.getByRole('button', { name: 'Project menu', exact: true }).click()
  const projectDownload = page.waitForEvent('download')
  await page.getByRole('button', { name: /Save project file/ }).click()
  const project = JSON.parse(readFileSync((await (await projectDownload).path())!, 'utf8'))
  expect(project).toMatchObject({
    width: 640,
    height: 500,
    textCase: 'original',
    tracking: 12,
    subtitlePill: false,
    textColor: '#aaff00',
    opacity: 50,
    compositionRotation: 25,
  })
  await selectChyron(page)
  await page.getByRole('button', { name: 'Reset Position', exact: true }).click()
  await expect(page.getByLabel('Opacity value', { exact: true })).toHaveValue('100')
  await page.getByRole('button', { name: 'Undo', exact: true }).click()
  await expect(page.getByLabel('Opacity value', { exact: true })).toHaveValue('50')
})

test('saved styles can be restored after removal', async ({ page }) => {
  await page.goto('./')
  await page.getByRole('button', { name: 'Save current style' }).click()
  await page.getByLabel('Style name', { exact: true }).fill('My broadcast')
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByRole('button', { name: 'My broadcast', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Delete style My broadcast', exact: true }).click()
  await expect(page.getByRole('button', { name: 'My broadcast', exact: true })).toBeHidden()
  await page.getByRole('button', { name: 'Undo', exact: true }).last().click()
  await expect(page.getByRole('button', { name: 'My broadcast', exact: true })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('button', { name: 'My broadcast', exact: true })).toBeVisible()
})

const smallTargets = (page: Page, min: number) =>
  page.evaluate(
    (min) =>
      [...document.querySelectorAll('button, summary, [role=tab]')]
        .filter((el) => {
          const r = el.getBoundingClientRect(),
            style = getComputedStyle(el)
          return (
            r.width > 0 &&
            r.height > 0 &&
            r.top < innerHeight &&
            r.bottom > 0 &&
            style.visibility !== 'hidden' &&
            (r.width < min - 0.1 || r.height < min - 0.1)
          )
        })
        .map((el) => ({
          name: el.getAttribute('aria-label') || el.textContent,
          rect: el.getBoundingClientRect().toJSON(),
        })),
    min,
  )

test('responsive layout, target sizes, text scaling and accessibility audit', async ({
  page,
}, testInfo) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto('./')
  await expect(page.getByRole('img', { name: /Composition preview/ })).toHaveCSS('opacity', '1')
  for (const [width, height] of [
    [1440, 960],
    [1024, 768],
    [768, 1024],
    [393, 852],
    [360, 740],
    [320, 900],
    [844, 390],
  ]) {
    await page.setViewportSize({ width, height })
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
      .toBe(true)
    // WCAG 2.2 AA target size (2.5.8) for mouse and trackpad.
    expect(await smallTargets(page, 24), `Targets at ${width}px`).toEqual([])
  }
  await page.setViewportSize({ width: 1440, height: 960 })
  const violations: unknown[] = []
  const scan = async (label: string) =>
    violations.push(
      ...(await new AxeBuilder({ page }).withTags(TAGS).analyze()).violations.map((v) => ({
        label,
        id: v.id,
        nodes: v.nodes.map((n) => n.target),
      })),
    )
  await page.getByRole('button', { name: /^Colors/ }).click()
  await scan('Chyron design')
  await page.getByRole('tab', { name: 'Animate', exact: true }).click()
  await scan('Chyron animate')
  await page.getByRole('button', { name: /Canvas settings/ }).click()
  await scan('Composition')
  await page.setViewportSize({ width: 393, height: 852 })
  await page.getByRole('button', { name: 'Export', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Export WebM', exact: true })).toBeInViewport()
  await scan('Export')
  await page.getByRole('button', { name: 'Close export' }).click()
  await page.setViewportSize({ width: 320, height: 900 })
  await selectChyron(page)
  await page.getByRole('tab', { name: 'Design', exact: true }).click()
  await page.evaluate(() => (document.documentElement.style.fontSize = '32px'))
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    .toBe(true)
  await page.getByLabel('Title', { exact: true }).fill('Readable at 200%')
  await page.screenshot({ path: testInfo.outputPath('text-200-percent.png') })
  await testInfo.attach('accessibility-audit', {
    body: JSON.stringify(violations, null, 2),
    contentType: 'application/json',
  })
  expect(violations).toEqual([])
  expect(errors).toEqual([])
})

test.describe('touch screens', () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 393, height: 852 } })
  test('touch targets are at least 44 px', async ({ page }) => {
    await page.goto('./')
    await expect(page.getByRole('img', { name: /Composition preview/ })).toHaveCSS('opacity', '1')
    expect(await smallTargets(page, 44)).toEqual([])
    await page.getByRole('tab', { name: 'Animate', exact: true }).click()
    expect(await smallTargets(page, 44)).toEqual([])
  })
})
