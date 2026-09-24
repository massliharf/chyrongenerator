import { test, expect, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

const tags = ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']
const scan = async (page: Page, label: string) =>
  (await new AxeBuilder({ page }).withTags(tags).analyze()).violations.map(
    (v) => `${label}: ${v.id} → ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`,
  )

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
        .locator('.timeline input[type=file]')
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
      await page
        .getByRole('button', { name: /Stream Images/ })
        .first()
        .click()
      found.push(...(await scan(page, 'Stream')))
      expect(found).toEqual([])
    })
  })
}

test('theme toggle switches, persists and follows the system until chosen', async ({ browser }) => {
  const page = await browser.newPage({ colorScheme: 'dark' })
  await page.goto('./')
  const bg = () =>
    page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--panel').trim(),
    )
  expect(await bg()).toBe('#111111')
  await page.emulateMedia({ colorScheme: 'light' })
  expect(await bg()).toBe('#ffffff')
  await page.getByRole('button', { name: 'Switch to dark mode' }).first().click()
  expect(await bg()).toBe('#111111')
  await page.reload()
  expect(await bg()).toBe('#111111')
  await expect(page.getByRole('button', { name: 'Switch to light mode' }).first()).toBeVisible()
  await page.close()
})
