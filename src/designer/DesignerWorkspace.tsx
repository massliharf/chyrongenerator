import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  ChevronDown,
  ChevronsDown,
  ChevronsUp,
  Circle,
  ClipboardPaste,
  Copy,
  CornerDownRight,
  Crop,
  WandSparkles,
  Download,
  Eye,
  EyeOff,
  FlipHorizontal2,
  FlipVertical2,
  Frame,
  Grid3x3,
  Hand,
  HelpCircle,
  Lock,
  LockOpen,
  Magnet,
  Maximize,
  Minus,
  MousePointer2,
  PanelLeft,
  Plus,
  Redo2,
  Scissors,
  Square,
  SquareDashedMousePointer,
  Trash2,
  Type,
  Undo2,
  X,
  ChevronUp,
} from 'lucide-react'
import { ContextMenu, MenuButton, type MenuEntry } from '../components/Menu'
import { MediaGalleryModal } from '../components/MediaGalleryModal'
import { SaveStatus, TopBar } from '../components/TopBar'
import { fetchGalleryFile, type GalleryItem } from '../studio/galleryData'
import { saveBlob } from '../studio/export'
import { generateId } from '../utils/id'
import { DesignerCanvas, type Tool, type View } from './DesignerCanvas'
import { DesignerExportDialog } from './ExportDialog'
import { BackgroundRemovalDialog } from '../components/BackgroundRemovalDialog'
import {
  SAVVY_ACCEPT,
  SAVVY_TYPE,
  isSavvyFile,
  savvyKind,
  savvyName,
  sendSavvyFile,
  subscribeSavvyFiles,
} from '../utils/savvyFile'
import { center, clampCrop, unionBounds, type Point } from './geometry'
import { Inspector, type InspectorActions } from './Inspector'
import { LeftPanel } from './LeftPanel'
import { AddBar } from './AddBar'
import { renderChyron, withChyronAsset } from './chyron'
import type { ChyronStyle } from '../studio/model'
import {
  CROP_RATIOS,
  createFrame,
  createImage,
  createShape,
  createText,
  isShape,
  SHAPES,
  DEFAULT_DOC,
  fileStem,
  parseDoc,
  pruneAssets,
  type DesignDoc,
  type ImageLayer,
  type Layer,
  type TextPreset,
} from './model'
import {
  addImageAsset,
  addLayer,
  align,
  distribute,
  duplicateLayers,
  importImageFile,
  maskWithShape,
  dropLayer,
  fillFrame,
  fitToMask,
  groupIds,
  putIntoMask,
  releaseAll,
  removeLayers,
  reorder,
  readAsDataURL,
  replaceImage,
  updateLayers,
} from './ops'
import { textHeight, useAssetImages } from './render'
import { useDesignDoc } from './useDesignDoc'
import { subscribeDesignerInbox } from './inbox'

const TOOLS: { id: Tool; label: string; key: string; Icon: typeof Hand }[] = [
  { id: 'select', label: 'Select', key: 'V', Icon: MousePointer2 },
  { id: 'hand', label: 'Hand', key: 'H', Icon: Hand },
  { id: 'text', label: 'Text', key: 'T', Icon: Type },
  { id: 'rect', label: 'Rectangle', key: 'R', Icon: Square },
  { id: 'ellipse', label: 'Ellipse', key: 'O', Icon: Circle },
]

interface Clip {
  layers: Layer[]
  assets: Record<string, string>
}

export default function DesignerWorkspace({ active }: { active: boolean }) {
  const editor = useDesignDoc()
  const { doc, commit } = editor
  const imagesVersion = useAssetImages(doc)
  const [selection, setSelectionRaw] = useState<string[]>([])
  const [tool, setTool] = useState<Tool>('select')
  const [view, setView] = useState<View>({ zoom: 0.5, panX: 0, panY: 0 })
  const [stageSize, setStageSize] = useState({ width: 0, height: 0 })
  const [cropId, setCropId] = useState<string | null>(null)
  /** The image whose background is being removed. */
  const [cutoutId, setCutoutId] = useState<string | null>(null)
  const [cropRatio, setCropRatioId] = useState('free')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [leftOpen, setLeftOpen] = useState(false)
  const [menu, setMenu] = useState<{ at: { x: number; y: number }; hit: string | null } | null>(
    null,
  )
  const closeMenu = useCallback(() => setMenu(null), [])
  const [gallery, setGallery] = useState<'add' | 'replace' | 'frame' | null>(null)
  const pendingFrame = useRef<string | null>(null)
  const [exportOpen, setExportOpen] = useState(false)
  const [help, setHelp] = useState(false)
  const [notice, setNotice] = useState('')
  const [spaceHeld, setSpaceHeld] = useState(false)
  const clipboard = useRef<Clip | null>(null)
  const pasteHandled = useRef(true)
  const cropSnapshot = useRef<ImageLayer | null>(null)
  const uploadInput = useRef<HTMLInputElement>(null)
  const replaceInput = useRef<HTMLInputElement>(null)
  const openInput = useRef<HTMLInputElement>(null)
  const helpDialog = useRef<HTMLDialogElement>(null)
  const liveTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const fitted = useRef(false)

  // Layers removed by undo can no longer stay selected.
  const sel = selection.filter((id) => doc.layers.some((l) => l.id === id))
  const selected = doc.layers.filter((l) => sel.includes(l.id))
  const single = selected.length === 1 ? selected[0] : null
  const setSelection = useCallback((ids: string[]) => setSelectionRaw(ids), [])

  /* ---------- View ---------- */
  const docRef = editor.current
  const fit = useCallback(
    (d: DesignDoc = docRef.current, size = stageSize) => {
      if (!size.width) return
      const pad = size.width < 600 ? 24 : 64
      const zoom = Math.min((size.width - pad * 2) / d.width, (size.height - pad * 2) / d.height, 4)
      setView({
        zoom,
        panX: (size.width - d.width * zoom) / 2,
        panY: (size.height - d.height * zoom) / 2,
      })
    },
    [docRef, stageSize],
  )
  const zoomTo = (zoom: number, focus?: Point) => {
    const z = Math.min(32, Math.max(0.02, zoom))
    const f = focus ?? { x: stageSize.width / 2, y: stageSize.height / 2 }
    setView((v) => ({
      zoom: z,
      panX: f.x - ((f.x - v.panX) / v.zoom) * z,
      panY: f.y - ((f.y - v.panY) / v.zoom) * z,
    }))
  }
  const zoomToSelection = () => {
    const r = unionBounds(selected)
    if (!r || !stageSize.width) return fit()
    const zoom = Math.min((stageSize.width - 160) / r.w, (stageSize.height - 160) / r.h, 8)
    setView({
      zoom,
      panX: stageSize.width / 2 - (r.x + r.w / 2) * zoom,
      panY: stageSize.height / 2 - (r.y + r.h / 2) * zoom,
    })
  }
  useEffect(() => {
    if (editor.ready && stageSize.width && !fitted.current) {
      fitted.current = true
      fit(doc)
    }
  }, [editor.ready, stageSize, fit, doc])
  // A new artboard size refits.
  const lastSize = useRef(`${doc.width}x${doc.height}`)
  useEffect(() => {
    const key = `${doc.width}x${doc.height}`
    if (key !== lastSize.current) {
      lastSize.current = key
      fit(doc)
    }
  }, [doc, fit])

  useEffect(() => {
    if (!notice) return
    const t = setTimeout(() => setNotice(''), 5000)
    return () => clearTimeout(t)
  }, [notice])
  useEffect(() => {
    if (help) helpDialog.current?.showModal()
  }, [help])

  /* ---------- Editing helpers ---------- */
  const live = useCallback(
    (next: (d: DesignDoc) => DesignDoc) => {
      editor.begin()
      editor.preview(next)
      clearTimeout(liveTimer.current)
      liveTimer.current = setTimeout(() => editor.end(), 600)
    },
    [editor],
  )
  const flushLive = () => {
    clearTimeout(liveTimer.current)
    editor.end()
  }
  const viewCenter = (): Point => ({
    x: (stageSize.width / 2 - view.panX) / view.zoom,
    y: (stageSize.height / 2 - view.panY) / view.zoom,
  })
  const placeAtCenter = (l: Layer): Layer => {
    const c = viewCenter()
    const inside = c.x > 0 && c.y > 0 && c.x < doc.width && c.y < doc.height
    return inside ? { ...l, x: Math.round(c.x - l.w / 2), y: Math.round(c.y - l.h / 2) } : l
  }
  const insert = (l: Layer) => {
    flushLive()
    commit((d) => addLayer(d, l))
    setSelection([l.id])
    setTool('select')
    setLeftOpen(false)
  }
  const addText = (preset: TextPreset) => {
    const t = createText(doc, preset)
    t.h = textHeight(t)
    insert(placeAtCenter(t))
  }
  const addShape = (p: (typeof SHAPES)[number]) =>
    insert(
      placeAtCenter(
        createShape(doc, p.kind, {
          radius: p.radius,
          sides: p.sides,
          name: p.name === 'Square' ? 'Rectangle' : p.name,
        }),
      ),
    )
  const addFrame = (p: (typeof SHAPES)[number]) => {
    insert(placeAtCenter(createFrame(doc, p)))
    setNotice('Frame added. Drop a photo on it, or double-click it to choose one.')
  }
  /* ---------- Chyrons ---------- */
  const chyronJob = useRef<{ id: string; style: ChyronStyle } | null>(null)
  const chyronTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const addChyron = async (style: ChyronStyle) => {
    try {
      const asset = await renderChyron(style)
      const d = editor.current.current
      const layer: ImageLayer = {
        ...createImage(d, asset.id, asset.width, asset.height, 'Chyron'),
        chyron: style,
      }
      const placed = placeAtCenter(layer)
      flushLive()
      commit((x) => addLayer({ ...x, assets: { ...x.assets, [asset.id]: asset.src } }, placed))
      setSelection([placed.id])
      setTool('select')
      setLeftOpen(false)
      setNotice('Chyron added. Type its words on the right, or double-click it.')
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'The chyron could not be drawn.')
    }
  }
  /**
   * New words or look for a chyron. The style changes at once (one undo step
   * while typing); the picture is drawn again a moment later and slots into the
   * same step. A result that no longer matches (undone, typed over) is dropped.
   */
  const updateChyron = (id: string, values: Partial<ChyronStyle>) => {
    const layer = editor.current.current.layers.find((l) => l.id === id)
    if (layer?.kind !== 'image' || !layer.chyron) return
    const style: ChyronStyle = { ...layer.chyron, ...values }
    live((d) => updateLayers(d, [id], { chyron: style } as Partial<Layer>))
    chyronJob.current = { id, style }
    clearTimeout(chyronTimer.current)
    if (!style.text.trim() && !(style.subtitlePill && style.subtitle.trim())) return
    chyronTimer.current = setTimeout(async () => {
      try {
        const asset = await renderChyron(style)
        if (chyronJob.current?.style !== style) return
        editor.preview((d) => {
          const current = d.layers.find((l) => l.id === id)
          return current?.kind === 'image' && current.chyron === style
            ? withChyronAsset(d, id, asset)
            : d
        })
      } catch (e) {
        setNotice(e instanceof Error ? e.message : 'The chyron could not be drawn.')
      }
    }, 150)
  }
  /** A chyron's words are typed in the panel: double-click selects them there. */
  const editChyronWords = (id: string) => {
    setSelection([id])
    requestAnimationFrame(() => {
      const field = document.querySelector<HTMLTextAreaElement>('[data-chyron-title]')
      field?.focus()
      field?.select()
    })
  }
  const isEmptyFrame = (d: DesignDoc, id: string | null | undefined) => {
    const l = d.layers.find((x) => x.id === id)
    return !!l && !l.clip && !!l.maskOnly && isShape(l) && groupIds(d.layers, l.id).length === 1
  }

  const addFiles = async (files: File[], at?: Point, frameId: string | null = null) => {
    const images = files.filter((f) => f.type.startsWith('image/'))
    const json = files.find(isSavvyFile)
    if (!images.length && json) return openFile(json)
    if (!images.length) return setNotice('Drop a PNG, JPEG, WebP or GIF image.')
    let next = editor.current.current
    const ids: string[] = []
    const errors: string[] = []
    // A frame target takes the first picture; a filled frame swaps its picture.
    let frame = frameId ?? pendingFrame.current
    pendingFrame.current = null
    for (const [i, file] of images.entries()) {
      try {
        const asset = await importImageFile(file)
        if (frame) {
          const inside = groupIds(next.layers, frame).slice(1)
          const picture = next.layers.find((l) => inside.includes(l.id) && l.kind === 'image')
          if (isEmptyFrame(next, frame)) {
            const r = fillFrame(next, frame, asset)
            next = r.doc
            ids.push(frame)
          } else if (picture) {
            next = replaceImage(next, picture.id, asset)
            next = fitToMask(next, picture.id)
            ids.push(frame)
          }
          frame = null
          if (ids.length) continue
        }
        const point = at ? { x: at.x + i * 24, y: at.y + i * 24 } : undefined
        const r = addImageAsset(next, asset, point)
        next = r.doc
        ids.push(r.layer.id)
      } catch (e) {
        errors.push(e instanceof Error ? e.message : `${file.name} could not be added.`)
      }
    }
    if (ids.length) {
      flushLive()
      commit(next)
      setSelection(ids)
      setTool('select')
      setLeftOpen(false)
    }
    setNotice(errors[0] ?? (ids.length > 1 ? `${ids.length} images added.` : ''))
  }

  const replaceWith = async (file: File) => {
    if (!single || single.kind !== 'image') return
    try {
      const asset = await importImageFile(file)
      commit((d) => replaceImage(d, single.id, asset))
      setNotice('Image replaced. Frame and crop kept.')
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'This image could not be used.')
    }
  }

  /** Opens a .savvy design (or an older .design.json); Chyron projects go to the Chyron editor. */
  const openFile = async (file: File) => {
    try {
      if (file.size > 300 * 1024 * 1024) throw new Error('Choose a design file under 300 MB.')
      const text = await file.text()
      let raw: unknown = null
      try {
        raw = JSON.parse(text)
      } catch {
        /* parseDoc explains. */
      }
      if (savvyKind(raw) === 'chyron') return sendSavvyFile('chyron', file)
      const next = parseDoc(text)
      commit(next)
      setSelection([])
      fit(next)
      setNotice('Design opened. Undo to go back.')
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'This file could not be opened.')
    }
  }
  const saveFile = () =>
    saveBlob(
      new Blob([JSON.stringify(pruneAssets(doc))], { type: SAVVY_TYPE }),
      savvyName(fileStem(doc.name)),
    )

  const onGallery = async (item: GalleryItem) => {
    const target = gallery
    setGallery(null)
    try {
      setNotice(`Adding ${item.name}…`)
      const file = await fetchGalleryFile(item)
      if (target === 'replace') await replaceWith(file)
      else await addFiles([file], undefined, target === 'frame' ? pendingFrame.current : null)
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'Could not load gallery asset.')
    }
  }

  const addFilesRef = useRef(addFiles)
  addFilesRef.current = addFiles
  const openFileRef = useRef(openFile)
  openFileRef.current = openFile
  // Design files opened in another editor that belong here.
  useEffect(() => subscribeSavvyFiles('design', (file) => void openFileRef.current(file)), [])
  useEffect(() => {
    if (!editor.ready) return
    return subscribeDesignerInbox((items) => {
      void Promise.all(items.map(fetchGalleryFile))
        .then((files) => addFilesRef.current(files))
        .catch(() => setNotice('Could not load gallery asset.'))
    })
  }, [editor.ready])

  /* ---------- Clipboard ---------- */
  const copy = (cut = false) => {
    if (!selected.length) return
    const assets: Record<string, string> = {}
    for (const l of selected)
      if (l.kind === 'image')
        for (const id of [l.asset, l.originalAsset]) if (id) assets[id] = doc.assets[id]
    clipboard.current = { layers: structuredClone(selected), assets }
    if (cut) {
      commit((d) => removeLayers(d, sel))
      setSelection([])
    }
    setNotice(
      `${selected.length > 1 ? `${selected.length} layers` : selected[0].name} ${cut ? 'cut' : 'copied'}.`,
    )
  }
  const paste = () => {
    const c = clipboard.current
    if (!c) return false
    const pasted = c.layers.map((l) => ({
      ...structuredClone(l),
      id: generateId(),
      x: l.x + 24,
      y: l.y + 24,
    }))
    clipboard.current = { ...c, layers: pasted }
    commit((d) => ({
      ...d,
      assets: { ...d.assets, ...c.assets },
      layers: [...d.layers, ...pasted],
    }))
    setSelection(pasted.map((l) => l.id))
    return true
  }

  /* ---------- Remove background ---------- */
  const removeBackground = (id = single?.id) => {
    const l = doc.layers.find((x): x is ImageLayer => x.id === id && x.kind === 'image')
    if (!l) return
    // A chyron is already lettering on transparency.
    if (l.chyron) return setNotice('Chyrons have no background to remove.')
    if (l.locked) return setNotice('Unlock the layer to remove its background.')
    flushLive()
    setSelection([l.id])
    setCutoutId(l.id)
  }
  const cutoutLayer = doc.layers.find(
    (l): l is ImageLayer => l.id === cutoutId && l.kind === 'image',
  )
  const restoreOriginal = (id: string) =>
    commit((d) =>
      updateLayers(d, [id], (l) =>
        l.kind === 'image' && l.originalAsset
          ? ({ asset: l.originalAsset, originalAsset: undefined } as Partial<Layer>)
          : {},
      ),
    )

  /* ---------- Crop ---------- */
  const startCrop = (id = single?.id) => {
    const l = doc.layers.find((x): x is ImageLayer => x.id === id && x.kind === 'image')
    if (!l) return
    // A chyron's picture is redrawn from its words, so it is edited, not cropped.
    if (l.chyron) return editChyronWords(l.id)
    if (l.locked) return setNotice('Unlock the layer to crop it.')
    flushLive()
    cropSnapshot.current = l
    setCropRatioId('free')
    setSelection([l.id])
    setTool('select')
    setCropId(l.id)
  }
  const applyCrop = () => {
    cropSnapshot.current = null
    setCropId(null)
  }
  const cancelCrop = () => {
    const snap = cropSnapshot.current
    if (snap) commit((d) => ({ ...d, layers: d.layers.map((l) => (l.id === snap.id ? snap : l)) }))
    cropSnapshot.current = null
    setCropId(null)
  }
  const resetCrop = () => {
    const l = doc.layers.find(
      (x): x is ImageLayer => x.id === (cropId ?? single?.id) && x.kind === 'image',
    )
    if (!l) return
    // Show the whole picture at its current scale, around the same centre.
    const sx = l.w / l.crop.w,
      sy = l.h / l.crop.h
    const w = l.naturalW * sx,
      h = l.naturalH * sy
    const c = center(l)
    commit((d) =>
      updateLayers(d, [l.id], {
        crop: { x: 0, y: 0, w: l.naturalW, h: l.naturalH },
        x: c.x - w / 2,
        y: c.y - h / 2,
        w,
        h,
      } as Partial<Layer>),
    )
    setCropRatioId('free')
  }
  const setCropRatio = (id: string) => {
    setCropRatioId(id)
    const preset = CROP_RATIOS.find((r) => r.id === id)
    const l = doc.layers.find((x): x is ImageLayer => x.id === cropId && x.kind === 'image')
    if (!preset?.ratio || !l) return
    const sx = l.w / l.crop.w,
      sy = l.h / l.crop.h
    const ratio = preset.ratio === -1 ? (l.naturalW * sx) / (l.naturalH * sy) : preset.ratio
    // Largest box of that ratio inside the whole image, centred on the current crop.
    let w = l.w,
      h = l.h
    if (w / h > ratio) w = h * ratio
    else h = w / ratio
    const k = Math.min(1, (l.naturalW * sx) / w, (l.naturalH * sy) / h)
    w *= k
    h *= k
    const cx = l.crop.x + l.crop.w / 2,
      cy = l.crop.y + l.crop.h / 2
    const crop = clampCrop(
      { x: cx - w / sx / 2, y: cy - h / sy / 2, w: w / sx, h: h / sy },
      l.naturalW,
      l.naturalH,
    )
    const c = center(l)
    commit((d) =>
      updateLayers(d, [l.id], { crop, x: c.x - w / 2, y: c.y - h / 2, w, h } as Partial<Layer>),
    )
  }
  const ratioValue = (() => {
    const preset = CROP_RATIOS.find((r) => r.id === cropRatio)
    const l = doc.layers.find((x): x is ImageLayer => x.id === cropId && x.kind === 'image')
    if (!preset?.ratio || !l) return null
    if (preset.ratio === -1)
      return (l.naturalW * (l.w / l.crop.w)) / (l.naturalH * (l.h / l.crop.h))
    return preset.ratio
  })()
  // Selecting something else ends cropping.
  useEffect(() => {
    if (cropId && (sel.length !== 1 || sel[0] !== cropId)) applyCrop()
  }, [sel, cropId])

  /* ---------- Text edit ---------- */
  const onEditText = (id: string | null) => {
    if (id === null && editingId) {
      const l = editor.current.current.layers.find((x) => x.id === editingId)
      if (l?.kind === 'text' && !l.text.trim()) {
        commit((d) => removeLayers(d, [editingId]))
        setSelection([])
      }
    }
    setEditingId(id)
  }

  /* ---------- Actions ---------- */
  const toggleClip = () => {
    if (!single) return
    const index = doc.layers.indexOf(single)
    if (!single.clip && index === 0)
      return setNotice('Clipping needs a layer below to use as the mask.')
    commit((d) => updateLayers(d, [single.id], { clip: !single.clip }))
  }
  const actions: InspectorActions = {
    update: (values) => live((d) => updateLayers(d, sel, values)),
    updateDoc: (values) => live((d) => ({ ...d, ...values })),
    align: (how) => commit((d) => align(d, sel, how)),
    distribute: (axis) => {
      if (sel.length < 3) return setNotice('Select three or more layers to distribute.')
      commit((d) => distribute(d, sel, axis))
    },
    duplicate: () => {
      const r = duplicateLayers(doc, sel)
      commit(r.doc)
      setSelection(r.ids)
    },
    remove: () => {
      if (!sel.length) return
      commit((d) => removeLayers(d, sel))
      setNotice(
        `${sel.length > 1 ? `${sel.length} layers` : selected[0].name} deleted. Undo to bring back.`,
      )
      setSelection([])
    },
    reorder: (dir) => commit((d) => reorder(d, new Set(sel), dir)),
    startCrop: () => startCrop(),
    applyCrop,
    cancelCrop,
    resetCrop,
    setCropRatio,
    maskWith: (preset) => {
      if (!single) return
      const r = maskWithShape(doc, single.id, preset)
      commit(r.doc)
      setNotice('Masked. Select the mask layer below to move or reshape it.')
    },
    replaceImage: () => setGallery('replace'),
    removeBackground: () => removeBackground(),
    restoreOriginal: () => single && restoreOriginal(single.id),
    updateChyron: (values) => single && updateChyron(single.id, values),
    updateLayer: (id, values) => live((d) => updateLayers(d, [id], values)),
    select: (ids) => setSelection(ids),
    releaseAll: (id) => {
      commit((d) => releaseAll(d, id))
      setNotice('Released. The layers keep their place.')
    },
    fitToMask: (id) => commit((d) => fitToMask(d, id)),
    fillFrame: (id, source) => {
      pendingFrame.current = id
      if (source === 'gallery') setGallery('frame')
      else uploadInput.current?.click()
    },
    fitToArtboard: (mode) => {
      if (!single) return
      const k =
        mode === 'fit'
          ? Math.min(doc.width / single.w, doc.height / single.h)
          : Math.max(doc.width / single.w, doc.height / single.h)
      const w = single.w * k,
        h = single.h * k
      commit((d) =>
        updateLayers(d, [single.id], {
          w,
          h,
          x: (doc.width - w) / 2,
          y: (doc.height - h) / 2,
          rotation: 0,
        }),
      )
    },
  }

  const nudge = (dx: number, dy: number) => {
    const movable = selected.filter((l) => !l.locked)
    if (!movable.length) return
    live((d) =>
      updateLayers(
        d,
        movable.map((l) => l.id),
        (l) => ({ x: l.x + dx, y: l.y + dy }),
      ),
    )
  }

  /* ---------- Keyboard ---------- */
  useEffect(() => {
    if (!active) return
    const down = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      const typing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName) || t.isContentEditable
      if (exportOpen || help || gallery || menu) return
      const mod = e.metaKey || e.ctrlKey
      const k = e.key.toLowerCase()
      if (mod && k === 's') {
        e.preventDefault()
        saveFile()
        return
      }
      if (mod && k === 'e') {
        e.preventDefault()
        setExportOpen(true)
        return
      }
      if (typing) return
      if (e.code === 'Space' && !e.repeat) {
        e.preventDefault()
        setSpaceHeld(true)
        return
      }
      if (cropId) {
        if (e.key === 'Enter') {
          e.preventDefault()
          applyCrop()
        }
        if (e.key === 'Escape') {
          e.preventDefault()
          cancelCrop()
        }
        return
      }
      if (mod && k === 'z') {
        e.preventDefault()
        flushLive()
        if (e.shiftKey) editor.redo()
        else editor.undo()
        return
      }
      if (mod && k === 'y') {
        e.preventDefault()
        editor.redo()
        return
      }
      if (mod && k === 'a') {
        e.preventDefault()
        setSelection(doc.layers.filter((l) => l.visible && !l.locked).map((l) => l.id))
        return
      }
      if (mod && k === 'd') {
        e.preventDefault()
        actions.duplicate()
        return
      }
      if (mod && k === 'c') {
        copy()
        return
      }
      if (mod && k === 'x') {
        copy(true)
        return
      }
      if (mod && k === 'v') {
        // The paste event normally handles this (it also carries images from
        // other apps). If the browser fires none, paste our own layers.
        pasteHandled.current = false
        setTimeout(() => {
          if (!pasteHandled.current) paste()
        }, 60)
        return
      }
      if (mod && e.altKey && k === 'g') {
        e.preventDefault()
        toggleClip()
        return
      }
      if (mod && (k === '0' || k === '=' || k === '+' || k === '-' || k === '1' || k === '2')) {
        e.preventDefault()
        if (k === '0') fit()
        if (k === '1') zoomTo(1)
        if (k === '2') zoomToSelection()
        if (k === '=' || k === '+') zoomTo(view.zoom * 1.25)
        if (k === '-') zoomTo(view.zoom / 1.25)
        return
      }
      if (mod && k === "'") {
        e.preventDefault()
        commit((d) => ({ ...d, grid: { ...d.grid, show: !d.grid.show } }))
        return
      }
      if (mod) return
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault()
        actions.remove()
        return
      }
      if (e.key === 'Escape') {
        if (tool !== 'select') setTool('select')
        else setSelection([])
        return
      }
      if (e.key === 'Enter' && single) {
        e.preventDefault()
        if (single.kind === 'text') setEditingId(single.id)
        if (single.kind === 'image') startCrop(single.id)
        return
      }
      if (e.key.startsWith('Arrow') && selected.length) {
        e.preventDefault()
        const step = e.shiftKey ? 10 : 1
        nudge(
          e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0,
          e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0,
        )
        return
      }
      if (e.key === ']' || e.key === '[') {
        e.preventDefault()
        actions.reorder(e.shiftKey ? (e.key === ']' ? 'front' : 'back') : e.key === ']' ? 1 : -1)
        return
      }
      if (e.key === '}' || e.key === '{') {
        e.preventDefault()
        actions.reorder(e.key === '}' ? 'front' : 'back')
        return
      }
      if (e.shiftKey && k === 'h' && selected.length) {
        commit((d) => updateLayers(d, sel, (l) => ({ flipX: !l.flipX })))
        return
      }
      if (e.shiftKey && k === 'v' && selected.length) {
        commit((d) => updateLayers(d, sel, (l) => ({ flipY: !l.flipY })))
        return
      }
      if (e.shiftKey && k === 'l' && selected.length) {
        commit((d) => updateLayers(d, sel, (l) => ({ locked: !l.locked })))
        return
      }
      if (e.shiftKey && k === 'g') {
        commit((d) => ({ ...d, grid: { ...d.grid, show: !d.grid.show } }))
        return
      }
      if (e.key === '?') {
        setHelp(true)
        return
      }
      if (k === 'c' && single?.kind === 'image') {
        startCrop(single.id)
        return
      }
      if (k === 'i') {
        uploadInput.current?.click()
        return
      }
      const toolKey = TOOLS.find((x) => x.key.toLowerCase() === k)
      if (toolKey && !e.shiftKey) setTool(toolKey.id)
    }
    const up = (e: KeyboardEvent) => {
      if (e.code === 'Space') setSpaceHeld(false)
    }
    const pasteEvent = (e: ClipboardEvent) => {
      pasteHandled.current = true
      // Paste into a focused text field stays there. (The event target is not
      // reliable: Chromium can report a hidden input.)
      const a = document.activeElement as HTMLElement | null
      const editable =
        a &&
        (a.isContentEditable ||
          a.tagName === 'TEXTAREA' ||
          (a.tagName === 'INPUT' &&
            !['file', 'checkbox', 'radio', 'color', 'button'].includes(
              (a as HTMLInputElement).type,
            )))
      if (editable) return
      const files = Array.from(e.clipboardData?.files ?? []).filter((f) =>
        f.type.startsWith('image/'),
      )
      if (files.length) {
        e.preventDefault()
        void addFiles(files)
        return
      }
      if (paste()) e.preventDefault()
    }
    const blur = () => setSpaceHeld(false)
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('paste', pasteEvent)
    window.addEventListener('blur', blur)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      window.removeEventListener('paste', pasteEvent)
      window.removeEventListener('blur', blur)
    }
  })

  /* ---------- Context menu ---------- */
  const contextItems = (): MenuEntry[] => {
    if (!menu?.hit || !selected.length)
      return [
        {
          label: 'Paste',
          Icon: ClipboardPaste,
          shortcut: '⌘ V',
          disabled: !clipboard.current,
          onSelect: () => void paste(),
        },
        {
          label: 'Select all',
          Icon: SquareDashedMousePointer,
          shortcut: '⌘ A',
          onSelect: () =>
            setSelection(doc.layers.filter((l) => l.visible && !l.locked).map((l) => l.id)),
        },
        'separator',
        {
          label: doc.grid.show ? 'Hide grid' : 'Show grid',
          Icon: Grid3x3,
          shortcut: '⇧ G',
          onSelect: () => commit((d) => ({ ...d, grid: { ...d.grid, show: !d.grid.show } })),
        },
        { label: 'Zoom to fit', Icon: Maximize, shortcut: '⌘ 0', onSelect: () => fit() },
      ]
    const anyLocked = selected.some((l) => l.locked)
    const anyHidden = selected.some((l) => !l.visible)
    return [
      { label: 'Cut', Icon: Scissors, shortcut: '⌘ X', onSelect: () => copy(true) },
      { label: 'Copy', Icon: Copy, shortcut: '⌘ C', onSelect: () => copy() },
      {
        label: 'Paste',
        Icon: ClipboardPaste,
        shortcut: '⌘ V',
        disabled: !clipboard.current,
        onSelect: () => void paste(),
      },
      { label: 'Duplicate', Icon: Copy, shortcut: '⌘ D', onSelect: actions.duplicate },
      'separator',
      {
        label: 'Bring to front',
        Icon: ChevronsUp,
        shortcut: '⇧ ]',
        onSelect: () => actions.reorder('front'),
      },
      {
        label: 'Bring forward',
        Icon: ChevronUp,
        shortcut: ']',
        onSelect: () => actions.reorder(1),
      },
      {
        label: 'Send backward',
        Icon: ChevronDown,
        shortcut: '[',
        onSelect: () => actions.reorder(-1),
      },
      {
        label: 'Send to back',
        Icon: ChevronsDown,
        shortcut: '⇧ [',
        onSelect: () => actions.reorder('back'),
      },
      'separator',
      ...(single
        ? ([
            {
              label: single.clip ? 'Release clipping mask' : 'Clip to layer below',
              Icon: CornerDownRight,
              shortcut: '⌥⌘ G',
              onSelect: toggleClip,
            },
            ...(!single.clip && groupIds(doc.layers, single.id).length === 1
              ? [
                  {
                    label: 'Mask with circle',
                    Icon: Circle,
                    onSelect: () => actions.maskWith('Circle'),
                  },
                ]
              : []),
            ...(single.clip
              ? [
                  {
                    label: 'Fit to mask',
                    Icon: Maximize,
                    onSelect: () => actions.fitToMask(single.id),
                  },
                ]
              : groupIds(doc.layers, single.id).length > 1
                ? [
                    {
                      label: 'Release all from mask',
                      Icon: CornerDownRight,
                      onSelect: () => actions.releaseAll(single.id),
                    },
                  ]
                : []),
            ...(single.kind === 'image' && !single.chyron
              ? [
                  {
                    label: 'Crop',
                    Icon: Crop,
                    shortcut: 'C',
                    onSelect: () => startCrop(single.id),
                  },
                  {
                    label: 'Remove background',
                    Icon: WandSparkles,
                    onSelect: () => removeBackground(single.id),
                  },
                ]
              : []),
          ] as MenuEntry[])
        : []),
      {
        label: 'Flip horizontal',
        Icon: FlipHorizontal2,
        shortcut: '⇧ H',
        onSelect: () => commit((d) => updateLayers(d, sel, (l) => ({ flipX: !l.flipX }))),
      },
      {
        label: 'Flip vertical',
        Icon: FlipVertical2,
        shortcut: '⇧ V',
        onSelect: () => commit((d) => updateLayers(d, sel, (l) => ({ flipY: !l.flipY }))),
      },
      {
        label: anyLocked ? 'Unlock' : 'Lock',
        Icon: anyLocked ? LockOpen : Lock,
        shortcut: '⇧ L',
        onSelect: () => commit((d) => updateLayers(d, sel, { locked: !anyLocked })),
      },
      {
        label: anyHidden ? 'Show' : 'Hide',
        Icon: anyHidden ? Eye : EyeOff,
        onSelect: () => commit((d) => updateLayers(d, sel, { visible: anyHidden })),
      },
      'separator',
      { label: 'Delete', Icon: Trash2, shortcut: 'Del', danger: true, onSelect: actions.remove },
    ]
  }

  const zoomPct = Math.round(view.zoom * 100)

  return (
    <div className="workspace-root designer-root">
      <a className="skip-link" href="#dz-props">
        Skip to properties
      </a>
      <TopBar
        actions={
          <>
            <div className="history-actions">
              <button
                className="icon-button"
                aria-label="Undo"
                title="Undo (⌘/Ctrl Z)"
                disabled={!editor.canUndo}
                onClick={() => {
                  flushLive()
                  editor.undo()
                }}
              >
                <Undo2 size={20} />
              </button>
              <button
                className="icon-button"
                aria-label="Redo"
                title="Redo (⌘/Ctrl Shift Z)"
                disabled={!editor.canRedo}
                onClick={editor.redo}
              >
                <Redo2 size={20} />
              </button>
            </div>
            <button
              className="button primary topbar-primary"
              aria-label="Export"
              title="Export (⌘/Ctrl E)"
              onClick={() => setExportOpen(true)}
            >
              <Download size={18} aria-hidden="true" /> <span className="label">Export</span>
            </button>
          </>
        }
      >
        <h1 className="sr-only">Designer</h1>
        <div className="document-title">
          <input
            aria-label="Design name"
            className="document-name"
            value={doc.name}
            maxLength={80}
            onChange={(e) => live((d) => ({ ...d, name: e.target.value }))}
          />
          <MenuButton
            label="Design menu"
            items={[
              {
                label: 'Save design file',
                Icon: ArrowDownToLine,
                shortcut: '⌘ S',
                onSelect: saveFile,
              },
              {
                label: 'Open design file',
                Icon: ArrowUpFromLine,
                onSelect: () => openInput.current?.click(),
              },
              {
                label: 'New design',
                Icon: Plus,
                onSelect: () => {
                  commit({ ...DEFAULT_DOC, grid: { ...doc.grid } })
                  setSelection([])
                  setNotice('New design. Undo to return to your previous work.')
                },
              },
              'separator',
              {
                label: 'Guide & shortcuts',
                Icon: HelpCircle,
                shortcut: '?',
                onSelect: () => setHelp(true),
              },
            ]}
          >
            <ChevronDown size={18} />
          </MenuButton>
        </div>
        <SaveStatus status={editor.saveStatus} error={editor.storageError} />
      </TopBar>

      <div className={`workspace-body dz-body ${leftOpen ? 'left-open' : ''}`}>
        <LeftPanel
          doc={doc}
          selection={sel}
          imagesVersion={imagesVersion}
          onSelect={(ids) => setSelection(ids)}
          onToggle={(id, key) => commit((d) => updateLayers(d, [id], (l) => ({ [key]: !l[key] })))}
          onRename={(id, name) => commit((d) => updateLayers(d, [id], { name }))}
          onDrop={(dragId, targetId, zone) => {
            commit((d) => dropLayer(d, dragId, targetId, zone))
            if (zone === 'into') setNotice('Masked. Drag it out of the group to release.')
          }}
          onContextMenu={(at, id) => setMenu({ at, hit: id })}
          onClose={() => setLeftOpen(false)}
        />

        <main className="editor-main" aria-label="Artboard">
          <div className="canvas-toolbar">
            <div className="dz-toolbar-start">
              <button
                className="icon-button dz-left-toggle"
                aria-label="Show layers"
                onClick={() => setLeftOpen(true)}
              >
                <PanelLeft size={20} />
              </button>
              <button
                className="canvas-size"
                aria-label={`Artboard settings: ${doc.width} by ${doc.height}`}
                aria-pressed={sel.length === 0}
                title="Artboard size, background and grid"
                onClick={() => setSelection([])}
              >
                <Frame size={16} aria-hidden="true" />
                <span>
                  {doc.width} × {doc.height}
                </span>
              </button>
            </div>
            <div className="dz-tools" role="toolbar" aria-label="Tools">
              {TOOLS.map(({ id, label, key, Icon }) => (
                <button
                  key={id}
                  className={`icon-button ${tool === id ? 'selected' : ''}`}
                  aria-label={label}
                  aria-pressed={tool === id}
                  title={`${label} (${key})`}
                  onClick={() => setTool(id)}
                >
                  <Icon size={18} />
                </button>
              ))}
              <span className="dz-align-sep" aria-hidden="true" />
              <button
                className={`icon-button ${cropId ? 'selected' : ''}`}
                aria-label="Crop image"
                aria-pressed={!!cropId}
                title="Crop (C)"
                disabled={single?.kind !== 'image' || !!single.chyron}
                onClick={() => (cropId ? applyCrop() : startCrop())}
              >
                <Crop size={18} />
              </button>
              <button
                className="icon-button"
                aria-label="Remove background"
                title="Remove background: cut out the subject or a colour, on this device"
                disabled={single?.kind !== 'image' || !!single.chyron || !!cropId}
                onClick={() => removeBackground()}
              >
                <WandSparkles size={18} />
              </button>
            </div>
            <div className="canvas-tools">
              <button
                className={`icon-button ${doc.grid.show ? 'selected' : ''}`}
                aria-label="Show grid"
                aria-pressed={doc.grid.show}
                title="Grid (⇧ G)"
                onClick={() => commit((d) => ({ ...d, grid: { ...d.grid, show: !d.grid.show } }))}
              >
                <Grid3x3 size={18} />
              </button>
              <MenuButton
                label="Snapping"
                align="end"
                title="Snapping"
                className={`icon-button ${doc.grid.snapToGrid || doc.grid.snapToObjects ? 'selected' : ''}`}
                items={[
                  {
                    label: 'Snap to objects',
                    checked: doc.grid.snapToObjects,
                    onSelect: () =>
                      commit((d) => ({
                        ...d,
                        grid: { ...d.grid, snapToObjects: !d.grid.snapToObjects },
                      })),
                  },
                  {
                    label: 'Snap to grid',
                    checked: doc.grid.snapToGrid,
                    onSelect: () =>
                      commit((d) => ({
                        ...d,
                        grid: { ...d.grid, snapToGrid: !d.grid.snapToGrid },
                      })),
                  },
                  'separator',
                  ...[8, 10, 20, 40, 50, 100].map((size) => ({
                    label: `${size} px grid`,
                    checked: doc.grid.size === size,
                    onSelect: () => commit((d) => ({ ...d, grid: { ...d.grid, size } })),
                  })),
                ]}
              >
                <Magnet size={18} />
              </MenuButton>
              <span className="dz-align-sep" aria-hidden="true" />
              <button
                className="icon-button"
                aria-label="Zoom out"
                title="Zoom out (⌘ −)"
                onClick={() => zoomTo(view.zoom / 1.25)}
              >
                <Minus size={16} />
              </button>
              <MenuButton
                label={`Zoom ${zoomPct}%`}
                align="end"
                className="dz-zoom-button"
                items={[
                  { label: 'Zoom to fit', shortcut: '⌘ 0', onSelect: () => fit() },
                  {
                    label: 'Zoom to selection',
                    shortcut: '⌘ 2',
                    disabled: !selected.length,
                    onSelect: zoomToSelection,
                  },
                  'separator',
                  ...[25, 50, 100, 200, 400].map((z) => ({
                    label: `${z}%`,
                    shortcut: z === 100 ? '⌘ 1' : undefined,
                    onSelect: () => zoomTo(z / 100),
                  })),
                ]}
              >
                <span>{zoomPct}%</span>
              </MenuButton>
              <button
                className="icon-button"
                aria-label="Zoom in"
                title="Zoom in (⌘ +)"
                onClick={() => zoomTo(view.zoom * 1.25)}
              >
                <Plus size={16} />
              </button>
            </div>
          </div>
          <DesignerCanvas
            editor={editor}
            doc={doc}
            selection={sel}
            onSelect={setSelection}
            tool={tool}
            onTool={setTool}
            view={view}
            onView={setView}
            onStageSize={setStageSize}
            cropId={cropId}
            cropRatio={ratioValue}
            onCrop={(id) => (id ? startCrop(id) : applyCrop())}
            editingId={editingId}
            onEditText={onEditText}
            spaceHeld={spaceHeld}
            imagesVersion={imagesVersion}
            onContextMenu={(at, hit) => setMenu({ at, hit })}
            onDropFiles={(files, at, frameId) => void addFiles(files, at, frameId)}
            onFillFrame={(frameId) => {
              setSelection([frameId])
              pendingFrame.current = frameId
              uploadInput.current?.click()
            }}
            onDropIntoFrame={(layerId, frameId) => {
              commit((d) => putIntoMask(d, layerId, frameId))
              setSelection([frameId])
              setNotice('Placed in frame. Double-click to adjust the picture inside.')
            }}
          />
          {/* Everything that can be added floats over the artboard. */}
          <AddBar
            onUpload={() => uploadInput.current?.click()}
            onGallery={() => setGallery('add')}
            onText={addText}
            onShape={addShape}
            onFrame={addFrame}
            onChyron={(style) => void addChyron(style)}
          />
        </main>

        <div className="inspector-slot">
          <Inspector
            doc={doc}
            selection={sel}
            actions={actions}
            cropping={!!cropId}
            cropRatio={cropRatio}
            onRename={(name) => live((d) => updateLayers(d, sel, { name }))}
          />
        </div>
      </div>

      <input
        ref={uploadInput}
        type="file"
        hidden
        multiple
        accept="image/png,image/jpeg,image/webp,image/gif"
        onChange={(e) => {
          const files = Array.from(e.currentTarget.files ?? [])
          e.currentTarget.value = ''
          if (files.length) void addFiles(files)
        }}
      />
      <input
        ref={replaceInput}
        type="file"
        hidden
        accept="image/png,image/jpeg,image/webp,image/gif"
        onChange={(e) => {
          const f = e.currentTarget.files?.[0]
          e.currentTarget.value = ''
          if (f) void replaceWith(f)
        }}
      />
      <input
        ref={openInput}
        type="file"
        hidden
        accept={SAVVY_ACCEPT}
        onChange={(e) => {
          const f = e.currentTarget.files?.[0]
          e.currentTarget.value = ''
          if (f) void openFile(f)
        }}
      />

      {menu && (
        <ContextMenu
          at={menu.at}
          label={menu.hit ? 'Layer actions' : 'Canvas actions'}
          items={contextItems()}
          onClose={closeMenu}
        />
      )}
      {exportOpen && <DesignerExportDialog doc={doc} onClose={() => setExportOpen(false)} />}
      {cutoutLayer && (
        <BackgroundRemovalDialog
          load={async () => {
            // Always from the original, even after an earlier cut-out.
            const src = doc.assets[cutoutLayer.originalAsset ?? cutoutLayer.asset]
            if (!src) throw new Error('This image is no longer in the design. Add it again.')
            return { blob: await (await fetch(src)).blob(), name: cutoutLayer.name }
          }}
          onApply={async (result) => {
            const id = generateId()
            const src = await readAsDataURL(result.blob)
            flushLive()
            commit((d) => ({
              ...updateLayers(d, [cutoutLayer.id], (l) =>
                l.kind === 'image'
                  ? ({ asset: id, originalAsset: l.originalAsset ?? l.asset } as Partial<Layer>)
                  : {},
              ),
              assets: { ...d.assets, [id]: src },
            }))
            setCutoutId(null)
            setNotice('Background removed. Restore the original from the Image section any time.')
          }}
          onClose={() => setCutoutId(null)}
        />
      )}
      <MediaGalleryModal
        open={gallery !== null}
        onClose={() => {
          if (gallery === 'frame') pendingFrame.current = null
          setGallery(null)
        }}
        onSelect={(item) => void onGallery(item)}
        onUploadClick={() => {
          const target = gallery
          setGallery(null)
          if (target === 'replace') replaceInput.current?.click()
          else if (target === 'frame') uploadInput.current?.click()
          else uploadInput.current?.click()
        }}
      />
      {notice && (
        <div className="toast" role="status">
          <span>{notice}</span>
          <button
            className="icon-button"
            aria-label="Dismiss notification"
            onClick={() => setNotice('')}
          >
            <X size={16} />
          </button>
        </div>
      )}
      {help && (
        <dialog
          className="dialog dialog-md help-dialog"
          ref={helpDialog}
          aria-labelledby="dz-help-title"
          onCancel={(e) => {
            e.preventDefault()
            helpDialog.current?.close()
            setHelp(false)
          }}
        >
          <div className="dialog-header">
            <h2 id="dz-help-title">Designer guide & shortcuts</h2>
            <button
              className="icon-button"
              aria-label="Close guide"
              onClick={() => {
                helpDialog.current?.close()
                setHelp(false)
              }}
            >
              <X size={18} />
            </button>
          </div>
          <div className="dialog-body">
            <ol className="help-steps">
              <li>
                <strong>Layers stack bottom to top.</strong> Drag rows in Layers to reorder; the eye
                hides, the lock protects from clicks.
              </li>
              <li>
                <strong>Mask anything.</strong> Drag a layer onto another in Layers, pick a shape in
                the Mask section, or add a Frame and drop a photo on it. Double-click a frame to
                adjust the picture inside; ⌘-click reaches inside too.
              </li>
              <li>
                <strong>Crop by double-clicking an image.</strong> Drag handles to frame, drag
                inside to move the picture, pick a ratio on the right.
              </li>
              <li>
                <strong>Snapping guides you.</strong> Edges and centres snap to the artboard and
                other layers; turn on the grid for even spacing. Hold Alt to move freely.
              </li>
            </ol>
            <h3 className="shortcut-title">Shortcuts</h3>
            <dl className="shortcuts">
              {[
                ['V H T R O', 'Select, hand, text, rectangle, ellipse'],
                ['Space drag', 'Pan the canvas'],
                ['⌘ wheel / pinch', 'Zoom at the pointer'],
                ['⌘ 0 / 1 / 2', 'Fit, 100 %, zoom to selection'],
                ['C or Enter', 'Crop image / edit text'],
                ['I', 'Upload an image'],
                ['⌘ C X V D', 'Copy, cut, paste, duplicate'],
                ['[ ]  ⇧[ ⇧]', 'Backward, forward, to back, to front'],
                ['⌥⌘ G', 'Clip to layer below'],
                ['⇧ H / ⇧ V', 'Flip horizontal / vertical'],
                ['⇧ L', 'Lock / unlock'],
                ['⇧ G', 'Show grid'],
                ['Arrows', 'Nudge 1 px (⇧ 10 px)'],
                ['Shift drag', 'Keep ratio · constrain · 15° steps'],
                ['Alt drag', 'Resize from centre · no snapping'],
                ['⌘ Z / ⇧⌘ Z', 'Undo / redo'],
                ['⌘ S / ⌘ E', 'Save design file / export'],
              ].map(([keys, what]) => (
                <div key={keys}>
                  <dt>
                    <kbd>{keys}</kbd>
                  </dt>
                  <dd>{what}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div className="dialog-footer">
            <span className="dialog-footer-spacer" />
            <button
              className="button primary"
              onClick={() => {
                helpDialog.current?.close()
                setHelp(false)
              }}
            >
              Done
            </button>
          </div>
        </dialog>
      )}
    </div>
  )
}
