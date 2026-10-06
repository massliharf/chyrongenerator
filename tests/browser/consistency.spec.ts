import { test, expect, type Locator, type Page } from '@playwright/test'

const BLUE = 'rgb(59, 111, 232)'
const style = (l: Locator, ...keys: string[]) =>
  l.evaluate(
    (el, keys) =>
      Object.fromEntries(keys.map((k) => [k, getComputedStyle(el).getPropertyValue(k)])),
    keys,
  )
/** The menu or panel is drawn above the page and nothing covers its items. */
const fullyShown = async (page: Page, panel: Locator) => {
  const box = (await panel.boundingBox())!
  const view = page.viewportSize()!
  expect(box.x).toBeGreaterThanOrEqual(0)
  expect(box.y).toBeGreaterThanOrEqual(0)
  expect(box.x + box.width).toBeLessThanOrEqual(view.width)
  expect(box.y + box.height).toBeLessThanOrEqual(view.height)
  // The last item, scrolled into view inside a long menu.
  const last = panel.locator('button').last()
  await last.scrollIntoViewIfNeeded()
  const b = (await last.boundingBox())!
  expect(
    await page.evaluate(
      ([x, y]) => document.elementFromPoint(x, y)?.closest('.menu, .dz-popover') !== null,
      [b.x + b.width / 2, b.y + b.height / 2],
    ),
  ).toBe(true)
}

test('selection handles, guides and the logo look the same in every editor', async ({ page }) => {
  await page.goto('./')
  await expect(page.getByRole('img', { name: /Composition preview/ })).toHaveCSS('opacity', '1')
  // The logo is the show's glasses icon, loaded.
  const logo = page.locator('.app-brand img')
  await expect(logo).toHaveAttribute('alt', 'Chyron Studio')
  expect(await logo.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0)

  // Chyron editor: the chyron is selected.
  const chyronBox = page.locator('.si-transform-box')
  await expect(chyronBox).toBeVisible()
  const chyronCorner = page.locator('.si-resize-handle span').first()
  const chyronRotate = page.locator('.si-rotate-handle span')
  const corner = await style(
    chyronCorner,
    'width',
    'height',
    'border-top-color',
    'background-color',
    'border-radius',
  )
  const rotate = await style(chyronRotate, 'width', 'border-top-color', 'background-color')
  expect((await style(chyronBox, 'border-top-color'))['border-top-color']).toBe(BLUE)

  // Designer: a shape, selected.
  await page.getByRole('button', { name: 'Designer' }).first().click()
  const designer = page.locator('.designer-root')
  await designer.getByRole('button', { name: 'Add shape' }).click()
  await page
    .getByRole('dialog', { name: 'Add shape' })
    .getByRole('button', { name: 'Rectangle' })
    .click()
  const designerCorner = designer.locator('.dz-handle.h-nw')
  await expect(designerCorner).toBeVisible()
  expect(
    await style(
      designerCorner,
      'width',
      'height',
      'border-top-color',
      'background-color',
      'border-radius',
    ),
  ).toEqual(corner)
  expect(
    await style(designer.locator('.dz-rotate'), 'width', 'border-top-color', 'background-color'),
  ).toEqual(rotate)
  expect(
    (await style(designer.locator('.dz-transform'), 'border-top-color'))['border-top-color'],
  ).toBe(BLUE)
})

test('Chyron, Designer and the hero generator add the same things from the top toolbar', async ({
  page,
}) => {
  await page.goto('./')
  await expect(page.getByRole('img', { name: /Composition preview/ })).toHaveCSS('opacity', '1')
  const order = ['Add chyron', 'Add text', 'Add shape', 'Add line', 'Add frame', 'Add image']
  const names = (bar: Locator) =>
    bar
      .locator('[aria-label^="Add "]')
      .evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')))
  const chyronBar = page.getByRole('toolbar', { name: 'Add' })
  expect(await names(chyronBar)).toEqual([...order, 'Add music'])

  // Shapes: the same picker, Line included as its own tool.
  await chyronBar.getByRole('button', { name: 'Add shape' }).click()
  const shapes = page.getByRole('dialog', { name: 'Add shape' })
  await fullyShown(page, shapes)
  const chyronShapes = await shapes.locator('.dz-shape-tile span').allTextContents()
  expect(chyronShapes).toEqual([
    'Rectangle',
    'Circle',
    'Arch',
    'Triangle',
    'Hexagon',
    'Star',
    'Heart',
  ])
  await page.keyboard.press('Escape')
  const rows = page.locator('.layer-labels .layer-name span')
  await chyronBar.getByRole('button', { name: 'Add line' }).click()
  await expect(rows.filter({ hasText: /^Line$/ })).toHaveCount(1)
  await expect(
    page.getByRole('group', { name: 'Shape' }).getByRole('button', { name: 'Line' }),
  ).toHaveAttribute('aria-pressed', 'true')

  // Frame: a shape, then its picture.
  await chyronBar.getByRole('button', { name: 'Add frame' }).click()
  await page
    .getByRole('dialog', { name: 'Add frame' })
    .getByRole('button', { name: 'Circle' })
    .click()
  const chooser = page.waitForEvent('filechooser')
  await page
    .getByRole('dialog', { name: 'Add frame' })
    .getByRole('button', { name: /Upload from device/ })
    .click()
  await (await chooser).setFiles('tests/fixtures/affidavit.jpg')
  await expect(rows.filter({ hasText: 'affidavit' })).toHaveCount(1)
  await expect(page.getByRole('button', { name: /^Shape & frame/ })).toContainText('Circle')

  // The Designer and the hero generator: the same icons, in the same order.
  await page.getByRole('button', { name: 'Designer' }).first().click()
  const tools = page.locator('.designer-root').getByRole('toolbar', { name: 'Tools' })
  expect(await names(tools)).toEqual(order)
  await tools.getByRole('button', { name: 'Add line' }).click()
  await expect(page.locator('.designer-root .dz-layers')).toContainText('Line')
  await tools.getByRole('button', { name: 'Add shape' }).click()
  expect(
    await page
      .getByRole('dialog', { name: 'Add shape' })
      .locator('.dz-shape-tile span')
      .allTextContents(),
  ).toEqual(chyronShapes)
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Apps' }).first().click()
  await page.getByRole('button', { name: /Hero image generator/ }).click()
  const heroTools = page.locator('[data-workspace="apps"]').getByRole('toolbar', { name: 'Tools' })
  expect(await names(heroTools)).toEqual(order)
})

test('menus open above the panels that hold their buttons', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 700 })
  await page.goto('./')
  await page.getByRole('button', { name: 'Apps' }).first().click()
  const apps = page.locator('[data-workspace="apps"]')
  await apps.getByRole('button', { name: /Hero image generator/ }).click()
  // The last artboard's menu, at the bottom of the scrolling artboards list.
  await apps.getByRole('button', { name: 'Actions for Stream image' }).click()
  const menu = page.getByRole('menu', { name: 'Actions for Stream image' })
  await fullyShown(page, menu)
  await page.keyboard.press('Escape')
  await apps.getByRole('button', { name: 'Add artboard' }).click()
  await fullyShown(page, page.getByRole('menu', { name: 'Add artboard' }))
  await page.keyboard.press('Escape')
  // A layer's ⋯ in the timeline, low on the screen, opens upwards.
  await page.getByRole('button', { name: 'Chyron' }).first().click()
  await page.locator('.layer-label').first().hover()
  await page
    .locator('.layer-label')
    .first()
    .getByRole('button', { name: /Actions for|More/ })
    .first()
    .click()
  await fullyShown(page, page.getByRole('menu').last())
})
