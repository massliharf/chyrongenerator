import { test, expect } from '@playwright/test'

test('the Designer adds from a floating bar, chyrons included, and redraws them as you type', async ({
  page,
}) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto('./')
  await page.getByRole('button', { name: 'Designer' }).first().click()
  const designer = page.locator('.designer-root')
  // One add bar, over the artboard; the left panel only lists layers.
  const bar = designer.getByRole('toolbar', { name: 'Add to design' })
  await expect(bar).toBeVisible()
  await expect(designer.locator('.dz-left').getByRole('toolbar')).toHaveCount(0)
  await expect(designer.getByText('Start with an image, text or a shape')).toHaveCount(0)
  for (const name of ['Image', 'Text', 'Shape', 'Frame', 'Chyron'])
    await expect(bar.getByRole('button', { name, exact: true })).toBeVisible()

  // A chyron in the Chyron editor's lettering, with its words in the panel.
  await bar.getByRole('button', { name: 'Chyron', exact: true }).click()
  await designer.getByRole('button', { name: 'Add a chyron: Play it bold' }).click()
  await expect(designer.locator('.dz-layers')).toContainText('Chyron')
  const title = designer.getByLabel('Title', { exact: true })
  await expect(title).toHaveValue('Your\nName')
  const width = designer.getByLabel('W', { exact: true })
  const before = Number(await width.inputValue())
  expect(before).toBeGreaterThan(0)

  // Longer words draw a wider picture; undo brings back both the words and the picture.
  await title.fill('A much longer name')
  await expect.poll(async () => Number(await width.inputValue())).toBeGreaterThan(before + 50)
  await title.blur()
  await page.waitForTimeout(700)
  await designer.getByRole('button', { name: 'Undo' }).first().click()
  await expect(title).toHaveValue('Your\nName')
  await expect.poll(async () => Number(await width.inputValue())).toBe(before)
  expect(errors).toEqual([])
})

test('the Designer removes an image background and can restore the original', async ({ page }) => {
  await page.goto('./')
  await page.getByRole('button', { name: 'Designer' }).first().click()
  const designer = page.locator('.designer-root')
  await designer
    .locator('input[type=file][multiple][accept*="image/png"]')
    .setInputFiles('tests/fixtures/showdown-logo.png')
  await expect(designer.locator('.dz-layers')).toContainText('showdown-logo')
  // From the Image section (also on the toolbar and in the right-click menu).
  await expect(designer.getByRole('button', { name: 'Remove background' })).toHaveCount(2)
  await designer
    .locator('.control-section')
    .getByRole('button', { name: 'Remove background' })
    .click()
  const dialog = page.getByRole('dialog', { name: 'Remove background' })
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: /Colour/ }).click()
  await dialog.getByRole('button', { name: 'Apply' }).click()
  await expect(dialog).toBeHidden()
  await expect(designer.getByText('Background removed', { exact: true })).toBeVisible()
  await designer.getByRole('button', { name: 'Restore original' }).click()
  await expect(designer.getByText('Background removed', { exact: true })).toHaveCount(0)
})
