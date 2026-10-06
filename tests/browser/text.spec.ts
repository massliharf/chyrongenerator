import { test, expect } from '@playwright/test'

test('text in the Chyron editor is plain text, as in the Designer', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto('./')
  await expect(page.getByRole('img', { name: /Composition preview/ })).toHaveCSS('opacity', '1')
  const chyrons = page.locator('.title-clip')
  const before = await chyrons.count()

  // T offers the Designer's presets; the words are ready to type over.
  await page.getByRole('toolbar', { name: 'Add' }).getByRole('button', { name: 'Add text' }).click()
  await page
    .getByRole('dialog', { name: 'Add text' })
    .getByRole('button', { name: 'Subheading' })
    .click()
  const words = page.getByLabel('Words', { exact: true })
  await expect(words).toBeFocused()
  await page.keyboard.type('Season finale')
  await expect(page.locator('.text-clip')).toContainText('Season finale')

  // Its own kind of layer: no chyron styles, no new chyron.
  await expect(page.getByLabel('Layer name')).toHaveValue('Text')
  await expect(page.getByRole('button', { name: 'Play it bold' })).toHaveCount(0)
  await expect(chyrons).toHaveCount(before)
  await expect(page.getByLabel('Typeface', { exact: true })).toHaveValue('Inter')

  // A corner scales the letters with the box; the sides only make it wider or narrower.
  const size = page.getByLabel('Size (px)', { exact: true })
  const start = Number(await size.inputValue())
  await expect(page.locator('.si-side-handle')).toHaveCount(2)
  const corner = (await page.locator('.si-resize-handle.bottom-right').boundingBox())!
  await page.mouse.move(corner.x + corner.width / 2, corner.y + corner.height / 2)
  await page.mouse.down()
  await page.mouse.move(corner.x + 60, corner.y + 30, { steps: 8 })
  await page.mouse.up()
  await expect.poll(async () => Number(await size.inputValue())).toBeGreaterThan(start)

  // Double-clicking it on the canvas brings back its words.
  await page.getByLabel('Typeface', { exact: true }).focus()
  const box = (await page.locator('.si-transform-box').boundingBox())!
  await page.mouse.dblclick(box.x + box.width / 2, box.y + box.height / 2)
  await expect(words).toBeFocused()
  expect(errors).toEqual([])
})
