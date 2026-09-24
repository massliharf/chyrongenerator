import { test, expect } from '@playwright/test'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { unzipSync } from 'fflate'
import { DEFAULT_PROJECT, duration, frameCount } from '../../src/studio/model'

const alphaVisible = (canvas: import('@playwright/test').Locator) =>
  canvas.evaluate((node) => {
    const element = node as HTMLCanvasElement
    return element
      .getContext('2d')!
      .getImageData(0, 0, element.width, element.height)
      .data.some((value, i) => i % 4 === 3 && value > 0)
  })

test('portrait 720p defaults and linked intro/outro previews', async ({ page }, testInfo) => {
  await page.goto('./')
  const canvas = page.getByRole('img', { name: /Composition preview/ })
  await expect(canvas).toHaveCSS('opacity', '1')
  // The chyron starts selected; composition settings are one click away.
  await expect(page.getByRole('heading', { name: 'Chyron', exact: true })).toBeVisible()
  await page.getByRole('button', { name: /Canvas settings/ }).click()
  await expect(page.getByRole('heading', { name: 'Composition', exact: true })).toBeVisible()
  await expect(page.getByLabel('Size', { exact: true })).toHaveValue('720x1280')
  await expect(page.getByLabel('Transition value', { exact: true })).toHaveValue('1')
  await page.locator('.layer-name', { hasText: 'Chyron' }).click()
  await page.getByRole('tab', { name: 'Animate', exact: true }).click()
  await page.getByRole('button', { name: 'Flip', exact: true }).click()
  await page.getByRole('button', { name: 'Preview in', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Play animation', exact: true })).toBeVisible()
  await expect(page.locator('.timecode')).toHaveText('1.00 / 4.40 s')
  expect(await alphaVisible(canvas)).toBe(true)
  await page.screenshot({ path: testInfo.outputPath('motion-720p.png') })
  await page.keyboard.press('Escape')
  await page.getByLabel('Transition value', { exact: true }).fill('1.5')
  await expect(page.locator('.clip-in')).toHaveAttribute('title', 'Intro · 1.5s')
  await expect(page.locator('.clip-out')).toHaveAttribute('title', 'Outro · 1.5s')
  await page.locator('.layer-name', { hasText: 'Chyron' }).click()
  await page.getByRole('button', { name: 'Preview in', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Play animation', exact: true })).toBeVisible()
  await expect(page.locator('.timecode')).toHaveText('1.50 / 5.40 s')
  // A phase preview plays once even when full-clip looping is enabled.
  await expect(page.getByRole('button', { name: 'Loop playback' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await page.getByRole('button', { name: 'Preview out', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Play animation', exact: true })).toBeVisible()
  await expect(page.locator('.timecode')).toHaveText('5.40 / 5.40 s')
  expect(await alphaVisible(canvas)).toBe(false)
  await page.getByRole('button', { name: 'Replay animation', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Pause animation', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Pause animation', exact: true }).click()
  await expect(page.getByText('Saved on this device', { exact: true })).toBeAttached()
  await page.reload()
  await page.getByRole('tab', { name: 'Animate', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Flip', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await page.getByRole('button', { name: 'Still', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Preview in', exact: true })).toBeHidden()
  await page.getByRole('button', { name: /Canvas settings/ }).click()
  await expect(page.getByLabel('Transition value', { exact: true })).toHaveValue('1.5')
})

test('editing, undo, persistence, project files and responsive layout', async ({
  page,
}, testInfo) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto('./')
  await expect(page.getByRole('img', { name: /Composition preview/ })).toHaveCSS('opacity', '1')
  await page.screenshot({ path: testInfo.outputPath('desktop.png') })
  await page.getByLabel('Title', { exact: true }).fill('ALPHA\nSTUDIO')
  await page.getByLabel('Subtitle text', { exact: true }).fill('TRANSPARENT BY DESIGN')
  await page.getByRole('button', { name: 'Undo', exact: true }).click()
  await expect(page.getByLabel('Subtitle text', { exact: true })).toHaveValue('PUZZLE PAPI')
  await page.getByRole('button', { name: 'Redo', exact: true }).click()
  await expect(page.getByLabel('Subtitle text', { exact: true })).toHaveValue(
    'TRANSPARENT BY DESIGN',
  )
  await page.getByRole('tab', { name: 'Animate', exact: true }).click()
  await page.getByRole('button', { name: 'Reveal', exact: true }).click()
  await page.getByRole('button', { name: 'Replay animation' }).click()
  await expect(page.getByRole('button', { name: 'Pause animation' })).toBeVisible()
  await page.getByRole('button', { name: 'Pause animation' }).click()
  await page.getByRole('tab', { name: 'Design', exact: true }).click()
  await expect(page.getByText('Saved on this device', { exact: true })).toBeAttached()
  await page.reload()
  await expect(page.getByLabel('Title', { exact: true })).toHaveValue('ALPHA\nSTUDIO')
  await page.getByRole('button', { name: 'Project menu', exact: true }).click()
  const projectDownload = page.waitForEvent('download')
  await page.getByRole('button', { name: /Save project file/ }).click()
  const file = await projectDownload
  const project = JSON.parse(readFileSync((await file.path())!, 'utf8'))
  expect(project).toMatchObject({ version: 2, text: 'ALPHA\nSTUDIO', motion: 'wipe' })
  await page.setViewportSize({ width: 393, height: 852 })
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
    .toBe(true)
  await page.screenshot({ path: testInfo.outputPath('mobile.png'), animations: 'disabled' })
  // Styles restyle the chyron without touching its words.
  await page.getByRole('button', { name: 'Apply Acid house style' }).click()
  await expect(page.getByLabel('Title', { exact: true })).toHaveValue('ALPHA\nSTUDIO')
  await page.getByRole('button', { name: 'Export', exact: true }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await expect
    .poll(() => page.getByRole('dialog').evaluate((node) => node.scrollHeight <= node.clientHeight))
    .toBe(true)
  await page.screenshot({ path: testInfo.outputPath('mobile-export.png') })
  await page.getByRole('button', { name: 'Close export' }).click()
  expect(errors).toEqual([])
})

test('actual PNG, SVG, sequence, VP9 alpha and ProRes exports', async ({ page }, testInfo) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  const project = {
    ...DEFAULT_PROJECT,
    motion: 'flip' as const,
    animationDuration: 0.3,
    hold: 0.4,
  }
  await page.addInitScript(
    (p) => localStorage.setItem('chyron-studio:v2', JSON.stringify(p)),
    project,
  )
  await page.goto('./')
  await expect(page.getByRole('img', { name: /Composition preview/ })).toHaveCSS('opacity', '1')
  await page.getByRole('button', { name: 'Export', exact: true }).click()
  await page.screenshot({ path: testInfo.outputPath('export-dialog.png') })
  const files: Record<string, string> = {}
  for (const format of ['PNG image', 'SVG vector', 'PNG sequence', 'WebM', 'ProRes 4444']) {
    await page.getByRole('radio', { name: new RegExp(format) }).click()
    const download = page.waitForEvent('download', { timeout: 150_000 })
    await page.getByRole('button', { name: `Export ${format}`, exact: true }).click()
    const file = await download
    const path = testInfo.outputPath(file.suggestedFilename())
    await file.saveAs(path)
    files[format] = path
    await expect(page.getByRole('dialog').getByRole('status')).toContainText('Your export is ready')
  }
  const png = execFileSync(
    'ffmpeg',
    ['-v', 'error', '-i', files['PNG image'], '-f', 'rawvideo', '-pix_fmt', 'rgba', '-'],
    { maxBuffer: 4_000_000 },
  )
  expect(png[3]).toBe(0)
  const alpha = [...png].filter((_, i) => i % 4 === 3)
  expect(alpha.some((value) => value === 255)).toBe(true)
  expect(alpha.filter((a) => a === 255).length).toBeGreaterThan(1000)
  const svg = readFileSync(files['SVG vector'], 'utf8')
  expect(svg).toContain('<path')
  expect(svg).not.toContain('<text')
  expect(svg).not.toContain('foreignObject')
  const archive = unzipSync(readFileSync(files['PNG sequence']))
  expect(Object.keys(archive).filter((name) => name.endsWith('.png'))).toHaveLength(
    frameCount(project),
  )
  expect(Object.keys(archive)).toContain('project.chyron.json')
  for (const format of ['WebM', 'ProRes 4444']) {
    const probe = JSON.parse(
      execFileSync(
        'ffprobe',
        [
          '-v',
          'error',
          '-count_frames',
          '-show_streams',
          '-show_format',
          '-of',
          'json',
          files[format],
        ],
        { encoding: 'utf8' },
      ),
    )
    expect(probe.streams[0].width).toBe(720)
    expect(probe.streams[0].height).toBe(1280)
    expect(Number(probe.streams[0].nb_read_frames)).toBe(frameCount(project))
    expect(Number(probe.format.duration)).toBeCloseTo(duration(project), 2)
    expect(probe.streams[0].codec_name).toBe(format === 'WebM' ? 'vp9' : 'prores')
    const decoder = format === 'WebM' ? ['-c:v', 'libvpx-vp9'] : []
    // Inspect decoded alpha, not metadata alone: blank loop boundaries, transparent background,
    // opaque artwork, and anti-aliased intermediate values must all survive encoding.
    const planes = execFileSync(
      'ffmpeg',
      [
        '-v',
        'error',
        ...decoder,
        '-i',
        files[format],
        '-vf',
        'alphaextract',
        '-f',
        'rawvideo',
        '-pix_fmt',
        'gray',
        '-',
      ],
      { maxBuffer: 40_000_000 },
    )
    const pixels = project.width * project.height
    const first = planes.subarray(0, pixels),
      last = planes.subarray(29 * pixels, 30 * pixels),
      middle = planes.subarray(15 * pixels, 16 * pixels)
    expect(first.some((value) => value !== 0)).toBe(false)
    expect(last.some((value) => value !== 0)).toBe(false)
    expect(middle[0]).toBe(0)
    expect(middle.some((value) => value === 255)).toBe(true)
    expect(middle.some((value) => value > 0 && value < 255)).toBe(true)
  }
  expect(errors).toEqual([])
})

test('cancellation releases the encoder and a subsequent export works', async ({ page }) => {
  await page.addInitScript((p) => localStorage.setItem('chyron-studio:v2', JSON.stringify(p)), {
    ...DEFAULT_PROJECT,
    width: 640,
    height: 360,
  })
  await page.goto('./')
  await page.getByRole('button', { name: 'Export', exact: true }).click()
  await page.getByRole('button', { name: 'Export WebM', exact: true }).click()
  await expect(page.locator('.export-progress')).toContainText(/Preparing frame|Encoding/, {
    timeout: 30000,
  })
  await expect(page.getByRole('button', { name: 'Cancel export', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Cancel export', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Export WebM', exact: true })).toBeVisible()
  await page.getByRole('radio', { name: /PNG image/ }).click()
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export PNG image', exact: true }).click()
  expect((await download).suggestedFilename()).toMatch(/\.png$/)
})
