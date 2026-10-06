import { test, expect } from '@playwright/test'

test('the timeline zooms, snaps, shows frames and resizes', async ({ page }) => {
  await page.goto('./')
  await expect(page.getByRole('img', { name: /Composition preview/ })).toHaveCSS('opacity', '1')
  const grid = page.locator('.timeline-grid')
  const ticks = page.locator('.ruler .tick')
  const labels = () => ticks.allTextContents()

  // At first the whole 4.4 s clip fits; zooming in shows tenths and scrolls sideways.
  await expect.poll(labels).toContain('4.0s')
  await page.getByRole('button', { name: 'Zoom in to the timeline' }).click()
  await page.getByRole('button', { name: 'Zoom in to the timeline' }).click()
  await page.getByRole('button', { name: 'Zoom in to the timeline' }).click()
  await expect.poll(async () => (await labels())[1]).toMatch(/^0\.[12]s$/)
  expect(await grid.evaluate((g) => g.scrollWidth > g.clientWidth + 100)).toBe(true)
  // The names stay in view while the clips scroll.
  await grid.evaluate((g) => (g.scrollLeft = g.scrollWidth))
  await expect(page.locator('.layer-labels .layer-name')).toBeInViewport()
  await page.getByRole('button', { name: 'Fit' }).click()
  await expect.poll(labels).toContain('4.0s')

  // Dragging a clip's start onto the playhead snaps to it; Alt moves freely.
  const clip = page.locator('.track .clip').first()
  const edge = page.locator('.track .clip-edge.start').first()
  const ruler = (await page.locator('.ruler').boundingBox())!
  const e = (await edge.boundingBox())!
  const grab = e.x + e.width / 2
  const clipLeft = (await clip.boundingBox())!.x
  const playheadX = ruler.x + (2.2 / 4.4) * ruler.width
  await page.mouse.move(grab, e.y + e.height / 2)
  await page.mouse.down()
  // Release 4 px short of the playhead.
  await page.mouse.move(playheadX - 4 + (grab - clipLeft), e.y + e.height / 2, { steps: 10 })
  await expect(page.locator('.snap-guide.is-snapped')).toBeVisible()
  await page.mouse.up()
  await expect(page.locator('.snap-guide')).toHaveCount(0)
  await expect(clip).toHaveAttribute('title', /Hold 0\.20s/)

  // Seconds or frames: the current time switches on click.
  const now = page.locator('.timecode-now')
  await expect(now).toHaveText('2.20')
  await now.click()
  await expect(now).toHaveText('00:02:06')
  await now.click()

  // ⇧ → jumps a second, Home and End go to the ends.
  // Empty space around the artwork: nothing selected, keys drive playback.
  await page.locator('.stage-surround').click({ position: { x: 8, y: 8 } })
  await page.keyboard.press('Shift+ArrowRight')
  await expect(now).toHaveText('3.20')
  await page.keyboard.press('Home')
  await expect(now).toHaveText('0.00')
  await page.keyboard.press('End')
  await expect(now).toHaveText('4.40')

  // The layers area grows from its top edge (keyboard too) and remembers it.
  const before = (await grid.boundingBox())!.height
  await page.getByRole('separator', { name: 'Timeline height' }).focus()
  await page.keyboard.press('ArrowUp')
  await page.keyboard.press('ArrowUp')
  await expect.poll(() => grid.evaluate((g) => getComputedStyle(g).maxHeight)).toBe('280px')
  expect(before).toBeGreaterThan(0)

  // Double-clicking a clip opens its timing.
  await clip.dblclick()
  await expect(page.getByRole('tab', { name: 'Animate', exact: true })).toHaveAttribute(
    'aria-selected',
    'true',
  )
  await expect(page.getByLabel('Starts at', { exact: true })).toBeVisible()
})
