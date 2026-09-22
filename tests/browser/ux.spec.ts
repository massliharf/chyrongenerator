import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'

// User journeys exercise disclosure, keyboard control, persistence and actual output.
test('settings disclosure, global search, keyboard tabs and modal focus', async ({ page }) => {
  await page.goto('./')
  const title = page.getByLabel('Title', { exact: true })
  const words = page.getByRole('button', { name: /^Your words/ })
  await words.focus()
  await page.keyboard.press('Space')
  await expect(title).toBeHidden()
  await expect(page.getByRole('button', { name: 'Play animation', exact: true })).toBeVisible()
  await page.keyboard.press('Space')
  await expect(title).toBeVisible()
  await page.getByRole('button', { name: 'Collapse all sections' }).click()
  await expect(title).toBeHidden()
  await page.getByLabel('Search settings').fill('duration')
  await expect(page.getByLabel('Animation duration value')).toBeVisible()
  await page.getByLabel('Animation duration value').fill('1.6')
  await page.getByLabel('Animation duration value').press('Tab')
  await page.getByRole('button', { name: 'Clear settings search' }).click()
  await page.getByRole('tab', { name: 'Design', exact: true }).focus()
  await page.keyboard.press('ArrowRight')
  await expect(page.getByRole('tab', { name: 'Motion', exact: true })).toBeFocused()
  await expect(page.getByRole('tab', { name: 'Motion', exact: true })).toHaveAttribute(
    'aria-selected',
    'true',
  )
  await page.keyboard.press('ArrowRight')
  await expect(page.getByRole('tab', { name: 'Canvas', exact: true })).toBeFocused()
  await page.getByRole('button', { name: 'Expand timeline' }).click()
  await expect(page.getByRole('button', { name: 'Collapse timeline' })).toHaveAttribute(
    'aria-expanded',
    'true',
  )
  await page.getByRole('button', { name: 'Collapse timeline' }).click()
  await page.getByRole('button', { name: 'Templates', exact: true }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('button', { name: 'Templates', exact: true })).toBeFocused()
  await page.getByRole('button', { name: 'Export', exact: true }).click()
  const webm = page.getByRole('radio', { name: /WebM/ })
  await webm.focus()
  await page.keyboard.press('ArrowDown')
  await expect(page.getByRole('radio', { name: /ProRes/ })).toHaveAttribute('aria-checked', 'true')
  await expect(page.getByRole('radio', { name: /ProRes/ })).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('button', { name: 'Export', exact: true })).toBeFocused()
  await page.getByRole('tab', { name: 'Design', exact: true }).click()
  await page.reload()
  await expect(page.getByRole('button', { name: /^Your words/ })).toHaveAttribute(
    'aria-expanded',
    'false',
  )
  await page.getByLabel('Search settings').fill('duration')
  await expect(page.getByLabel('Animation duration value')).toHaveValue('1.6')
})

test('custom dimensions, hex colors, typography and translucent exports', async ({
  page,
}, testInfo) => {
  await page.goto('./')
  await page.getByLabel('Title', { exact: true }).fill('Aa\nStudio')
  await page.getByRole('button', { name: /^Typography/ }).click()
  await page.getByRole('button', { name: 'Type', exact: true }).click()
  await page.getByLabel('Typeface', { exact: true }).selectOption('Inter')
  await page.getByLabel('Letter case', { exact: true }).selectOption('original')
  await page.getByLabel('Letter spacing value').fill('12')
  await page.getByRole('button', { name: /^Colors & palettes/ }).click()
  const color = page.getByLabel('Lettering hex', { exact: true })
  await color.fill('oops')
  await color.press('Tab')
  await expect(page.getByRole('alert')).toContainText('Use 3 or 6 hex digits')
  await color.fill('#af0')
  await color.press('Tab')
  await expect(color).toHaveValue('#AAFF00')
  await page.getByRole('button', { name: /^Subtitle style/ }).click()
  await page.getByRole('checkbox', { name: /Subtitle pill/ }).uncheck()
  await page.getByRole('tab', { name: 'Canvas', exact: true }).click()
  const width = page.getByLabel('Width (px)', { exact: true })
  await width.fill('')
  await width.pressSequentially('1000')
  await width.press('Tab')
  await expect(width).toHaveValue('1000')
  await page.getByRole('checkbox', { name: 'Lock aspect ratio', exact: true }).check()
  await width.fill('500')
  await width.press('Tab')
  await expect(page.getByLabel('Height (px)', { exact: true })).toHaveValue('640')
  await page.getByRole('button', { name: 'Swap dimensions', exact: true }).click()
  await expect(width).toHaveValue('640')
  await expect(page.getByLabel('Height (px)', { exact: true })).toHaveValue('500')
  await page.getByRole('button', { name: /^Composition\s/ }).click()
  await page.getByLabel('Composition rotation value').fill('25')
  await page.getByLabel('Opacity value', { exact: true }).fill('50')
  await page.getByLabel('Opacity value', { exact: true }).press('Tab')
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
  await page.getByRole('button', { name: 'Reset Composition', exact: true }).click()
  await expect(page.getByLabel('Opacity value', { exact: true })).toHaveValue('100')
  await page.getByRole('button', { name: 'Undo', exact: true }).click()
  await expect(page.getByLabel('Opacity value', { exact: true })).toHaveValue('50')
})

test('saved presets can be restored after removal', async ({ page }) => {
  await page.goto('./')
  await page.getByRole('button', { name: 'Project menu', exact: true }).click()
  await page.getByRole('button', { name: 'Save as preset', exact: true }).click()
  await page.getByLabel('Preset name', { exact: true }).fill('My broadcast')
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByRole('button', { name: 'My broadcast', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Delete preset My broadcast', exact: true }).click()
  await page.getByRole('button', { name: 'Close template panel' }).click()
  await page.getByRole('button', { name: 'Undo removal', exact: true }).click()
  await page.getByRole('button', { name: 'Templates', exact: true }).click()
  await expect(page.getByRole('button', { name: 'My broadcast', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Close template panel' }).click()
  await page.reload()
  await page.getByRole('button', { name: 'Templates', exact: true }).click()
  await page.getByText('Saved presets', { exact: false }).click()
  await expect(page.getByRole('button', { name: 'My broadcast', exact: true })).toBeVisible()
})

test('responsive layout, touch targets, text scaling and accessibility audit', async ({
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
    const small = await page.evaluate(() =>
      [...document.querySelectorAll('button')]
        .filter((el) => {
          const r = el.getBoundingClientRect(),
            style = getComputedStyle(el)
          return (
            r.width > 0 &&
            r.height > 0 &&
            r.top < innerHeight &&
            r.bottom > 0 &&
            style.visibility !== 'hidden' &&
            (r.width < 47.9 || r.height < 47.9)
          )
        })
        .map((el) => ({
          name: el.getAttribute('aria-label') || el.textContent,
          rect: el.getBoundingClientRect().toJSON(),
        })),
    )
    expect(small, `Touch targets at ${width}px`).toEqual([])
  }
  await page.setViewportSize({ width: 1440, height: 960 })
  const violations = []
  for (const tab of ['Design', 'Motion', 'Canvas']) {
    await page.getByRole('tab', { name: tab, exact: true }).click()
    const scan = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze()
    violations.push(
      ...scan.violations.map((v) => ({
        tab,
        id: v.id,
        impact: v.impact,
        nodes: v.nodes.map((n) => n.target),
      })),
    )
  }
  await page.getByRole('tab', { name: 'Design', exact: true }).click()
  await page.getByLabel('Search settings').fill('colors')
  const colorsScan = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
    .analyze()
  violations.push(
    ...colorsScan.violations.map((v) => ({
      tab: 'Colors',
      id: v.id,
      impact: v.impact,
      nodes: v.nodes.map((n) => n.target),
    })),
  )
  await page.getByRole('button', { name: 'Clear settings search' }).click()
  await page.setViewportSize({ width: 393, height: 852 })
  await page.getByRole('button', { name: 'Export', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Export WebM', exact: true })).toBeInViewport()
  const exportScan = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
    .analyze()
  violations.push(
    ...exportScan.violations.map((v) => ({
      tab: 'Export',
      id: v.id,
      impact: v.impact,
      nodes: v.nodes.map((n) => n.target),
    })),
  )
  await page.getByRole('button', { name: 'Close export' }).click()
  await page.getByRole('button', { name: 'Templates', exact: true }).click()
  const templateScan = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
    .analyze()
  violations.push(
    ...templateScan.violations.map((v) => ({
      tab: 'Templates',
      id: v.id,
      impact: v.impact,
      nodes: v.nodes.map((n) => n.target),
    })),
  )
  await page.getByRole('button', { name: 'Close template panel' }).click()
  await page.setViewportSize({ width: 320, height: 900 })
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
