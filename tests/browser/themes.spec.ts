import { test, expect, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

const tags = ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']
const scan = async (page: Page, label: string) => {
  // Dialogs and menus fade in; measure contrast once they are fully shown.
  await page.evaluate(() =>
    Promise.all(
      document
        .getAnimations()
        .filter((a) => a.effect?.getTiming().iterations !== Infinity)
        .map((a) => a.finished.catch(() => {})),
    ),
  )
  return (await new AxeBuilder({ page }).withTags(tags).analyze()).violations.map(
    (v) => `${label}: ${v.id} → ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`,
  )
}

for (const scheme of ['light', 'dark'] as const) {
  test.describe(`${scheme} theme`, () => {
    test.use({ colorScheme: scheme })
    test(`${scheme} theme passes accessibility checks across the editor`, async ({ page }) => {
      await page.goto('./')
      await expect(page.getByRole('img', { name: /Composition preview/ })).toHaveCSS('opacity', '1')
      const found: string[] = []
      found.push(...(await scan(page, 'Chyron design')))
      await page.getByRole('tab', { name: 'Animate', exact: true }).click()
      found.push(...(await scan(page, 'Chyron animate')))
      await page.getByRole('button', { name: /Canvas settings/ }).click()
      found.push(...(await scan(page, 'Composition')))
      await page
        .getByLabel('Image files')
        .setInputFiles(['tests/fixtures/affidavit.jpg', 'tests/fixtures/showdown-logo.png'])
      await expect(page.locator('.layer-label')).toHaveCount(3)
      await page.getByRole('button', { name: 'Dismiss notification' }).click()
      for (const tab of ['Design', 'Animate']) {
        await page.getByRole('tab', { name: tab, exact: true }).click()
        found.push(...(await scan(page, `Image ${tab}`)))
      }
      await page.getByLabel('Preview options').click()
      found.push(...(await scan(page, 'Preview menu')))
      await page.keyboard.press('Escape')
      await page.getByRole('button', { name: 'Export', exact: true }).click()
      found.push(...(await scan(page, 'Export')))
      await page.getByRole('button', { name: 'Close export' }).click()
      await page.getByRole('button', { name: 'Apps' }).first().click()
      found.push(...(await scan(page, 'Apps')))
      await page.getByRole('button', { name: /Hero image generator/ }).click()
      await expect(page.locator('.hero-panel')).toBeVisible()
      found.push(...(await scan(page, 'Hero image generator')))
      expect(found).toEqual([])
    })
  })
}

test('theme toggle switches, persists and follows the system until chosen', async ({ browser }) => {
  const page = await browser.newPage({ colorScheme: 'dark' })
  await page.goto('./')
  // The app background follows the theme; the top bar floats on it.
  const bg = () => page.evaluate(() => getComputedStyle(document.body).backgroundColor)
  expect(await bg()).toBe('rgb(10, 10, 10)')
  await page.emulateMedia({ colorScheme: 'light' })
  expect(await bg()).toBe('rgb(240, 240, 240)')
  await page.getByRole('button', { name: 'Switch to dark mode' }).first().click()
  expect(await bg()).toBe('rgb(10, 10, 10)')
  await page.reload()
  expect(await bg()).toBe('rgb(10, 10, 10)')
  await expect(page.getByRole('button', { name: 'Switch to light mode' }).first()).toBeVisible()
  await page.close()
})
