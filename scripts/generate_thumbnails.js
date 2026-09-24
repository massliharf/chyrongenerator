import fs from 'node:fs'
import path from 'node:path'
import { execSync } from 'node:child_process'

const SOURCE_DIR = path.resolve('public/gallery')
const TARGET_DIR = path.resolve('public/gallery_thumbs')

function walkDir(dir) {
  let files = []
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      files = files.concat(walkDir(fullPath))
    } else {
      files.push(fullPath)
    }
  }
  return files
}

console.log('Scanning', SOURCE_DIR)
const files = walkDir(SOURCE_DIR)
console.log(`Found ${files.length} assets to generate thumbnails for.`)

let totalOrigBytes = 0
let totalThumbBytes = 0
let processed = 0

for (const file of files) {
  const relative = path.relative(SOURCE_DIR, file)
  const targetPath = path.join(TARGET_DIR, relative)
  const targetDir = path.dirname(targetPath)

  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true })
  }

  const stat = fs.statSync(file)
  totalOrigBytes += stat.size

  const ext = path.extname(file).toLowerCase()
  if (ext === '.svg') {
    // SVGs are vectors; copy directly
    fs.copyFileSync(file, targetPath)
  } else {
    // Use macOS sips to resize preserving aspect ratio with max dimension 256px
    try {
      execSync(`sips -Z 256 "${file}" --out "${targetPath}"`, { stdio: 'ignore' })
    } catch (err) {
      console.warn(`sips failed for ${file}, falling back to copy`, err.message)
      fs.copyFileSync(file, targetPath)
    }
  }

  const thumbStat = fs.statSync(targetPath)
  totalThumbBytes += thumbStat.size
  processed++
}

const origMB = (totalOrigBytes / (1024 * 1024)).toFixed(1)
const thumbMB = (totalThumbBytes / (1024 * 1024)).toFixed(1)
const ratio = ((1 - totalThumbBytes / totalOrigBytes) * 100).toFixed(1)

console.log(`Successfully generated ${processed} thumbnails in public/gallery_thumbs/`)
console.log(`Original size: ${origMB} MB`)
console.log(`Thumbnail size: ${thumbMB} MB (${ratio}% reduction!)`)
