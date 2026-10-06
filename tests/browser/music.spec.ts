import { test, expect, type Page } from '@playwright/test'

const parts = (page: Page) => page.locator('.music-part')
const setTime = async (page: Page, seconds: number) => {
  await page.locator('.timeline-scrubber').fill(String(seconds))
  await expect(page.locator('.timecode-now')).toHaveText(seconds.toFixed(2))
}

test('music cuts at the playhead, trims, fades, sets its level and loses a part', async ({
  page,
}, testInfo) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto('./')
  await expect(page.getByRole('img', { name: /Composition preview/ })).toHaveCSS('opacity', '1')
  await page.locator('input[aria-label="Music file"]').setInputFiles('tests/fixtures/tone.mp3')
  await expect(page.locator('.music-label')).toContainText('tone')
  await expect(parts(page)).toHaveCount(1)
  const cutButton = page.getByRole('button', { name: 'Cut the music at the playhead' })

  // S cuts where the playhead is; the part after the cut is picked.
  await setTime(page, 1.5)
  await page.locator('.stage-surround').click({ position: { x: 8, y: 8 } })
  await page.keyboard.press('s')
  await expect(parts(page)).toHaveCount(2)
  await expect(page.getByText(/Music cut at 1\.50s/)).toBeVisible()
  await expect(page.locator('.music-part.is-picked')).toHaveCount(1)
  // The ✂ button cuts too.
  await setTime(page, 3)
  await cutButton.click()
  await expect(parts(page)).toHaveCount(3)
  const panel = page.getByRole('group', { name: 'Parts of the music' })
  await expect(panel.getByRole('button')).toHaveCount(3)

  // Delete removes only the picked part: silence in its place.
  await panel.getByRole('button', { name: /^Part 2/ }).click()
  await expect(panel.getByRole('button', { name: /^Part 2/ })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await page.getByRole('button', { name: 'Delete this part' }).click()
  await expect(parts(page)).toHaveCount(2)
  await expect(page.getByText('Part of the music removed. Undo to bring it back.')).toBeVisible()

  // Dragging a part's end trims it.
  const first = parts(page).first()
  const before = (await first.boundingBox())!.width
  const end = first.locator('.clip-edge.end')
  const e = (await end.boundingBox())!
  await page.mouse.move(e.x + e.width / 2, e.y + e.height / 2)
  await page.mouse.down()
  await page.mouse.move(e.x - 40, e.y + e.height / 2, { steps: 8 })
  await page.mouse.up()
  expect((await first.boundingBox())!.width).toBeLessThan(before - 20)

  // The fade-in dot drags sideways; the level bar up and down.
  await page.locator('.music-label .layer-name').click()
  const fade = page.locator('.fade-handle.in')
  const f = (await fade.boundingBox())!
  await page.mouse.move(f.x + f.width / 2, f.y + f.height / 2)
  await page.mouse.down()
  await page.mouse.move(f.x + 60, f.y + f.height / 2, { steps: 8 })
  await page.mouse.up()
  expect(Number(await page.getByLabel('Fade in', { exact: true }).inputValue())).toBeGreaterThan(0)
  const level = page.locator('.volume-handle')
  const v = (await level.boundingBox())!
  await page.mouse.move(v.x + v.width / 2, v.y + v.height / 2)
  await page.mouse.down()
  await page.mouse.move(v.x + v.width / 2, v.y + 12, { steps: 6 })
  await page.mouse.up()
  expect(Number(await page.getByLabel('Volume', { exact: true }).inputValue())).toBeLessThan(100)
  await page.screenshot({ path: testInfo.outputPath('music-cut.png') })

  // Join puts the music back in one piece; undo brings the cuts back.
  await page.getByRole('button', { name: 'Join the parts' }).click()
  await expect(parts(page)).toHaveCount(1)
  await page.keyboard.press('ControlOrMeta+z')
  await expect(parts(page)).toHaveCount(2)
  expect(errors).toEqual([])
})

test('Alt + arrows move the selected clip a frame at a time', async ({ page }) => {
  await page.goto('./')
  await expect(page.getByRole('img', { name: /Composition preview/ })).toHaveCSS('opacity', '1')
  // Give the chyron room: it starts a second in.
  const clip = page.locator('.track .clip').first()
  // Double-clicking a clip opens its timing.
  await clip.dblclick()
  await page.getByLabel('Starts at', { exact: true }).fill('1')
  await page.getByLabel('Starts at', { exact: true }).press('Enter')
  await expect.poll(async () => (await clip.boundingBox())!.x).toBeGreaterThan(300)
  const x = (await clip.boundingBox())!.x
  await page.locator('.layer-labels .layer-name').first().focus()
  await page.keyboard.press('Alt+Shift+ArrowLeft')
  await expect.poll(async () => (await clip.boundingBox())!.x).toBeLessThan(x - 20)
  await expect(page.getByLabel('Starts at', { exact: true })).toHaveValue('0')
})
