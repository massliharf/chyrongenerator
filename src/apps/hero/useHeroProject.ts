import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { DesignDoc, Layer } from '../../designer/model'
import type { DesignEditor } from '../../designer/useDesignDoc'
import { readDraft } from '../../stream/storage'
import type { ImageAsset } from '../../stream/model'
import {
  composeAll,
  copyToOthers,
  defaultSet,
  duplicateArtboard,
  fromStream,
  loadPresetSizes,
  newArtboard,
  parseHero,
  patchLook,
  pruneHeroAssets,
  reconcile,
  resizeArtboard,
  type CustomBackground,
  type HeroSet,
  type HostImage,
  type Look,
} from './model'

const DB = 'chyron-hero'
const STORE = 'sets'
const KEY = 'current'
const LIMIT = 100
/** Changes to the same setting this close together are one undo step (typing, scrubbing). */
const MERGE_MS = 650

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}
async function read(): Promise<string | undefined> {
  const db = await open()
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE).objectStore(STORE).get(KEY)
    req.onsuccess = () => resolve(req.result as string | undefined)
    req.onerror = () => reject(req.error)
  })
}
async function write(value: string) {
  const db = await open()
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).put(value, KEY)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}
export const readAsDataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })

/** The set saved on this device; else the Stream images set from before; else a new set. */
async function load(): Promise<HeroSet | null> {
  await loadPresetSizes()
  const json = await read().catch(() => undefined)
  if (json) {
    try {
      return composeAll(parseHero(json))
    } catch {
      /* An older or broken save: start over below. */
    }
  }
  const stream = await readDraft().catch(() => null)
  if (!stream) return null
  const picture = async (a: ImageAsset) => readAsDataUrl(a.blob)
  return fromStream({
    name: stream.name,
    layouts: stream.layouts,
    host: stream.host ? { ...stream.host, id: stream.host.id, asset: stream.host.id } : null,
    hostSrc: stream.host ? await picture(stream.host) : null,
    backgrounds: await Promise.all(
      stream.backgrounds.map(async (b) => ({
        id: b.id,
        name: b.name,
        width: b.width,
        height: b.height,
        src: await picture(b),
      })),
    ),
  })
}

/** The artboard being edited, as the Designer sees it: its layers with every picture. */
const views = new WeakMap<HeroSet, Map<string, DesignDoc>>()
function viewOf(set: HeroSet, id: string): DesignDoc {
  let byId = views.get(set)
  if (!byId) views.set(set, (byId = new Map()))
  let doc = byId.get(id)
  if (!doc) {
    const board = set.artboards.find((a) => a.id === id) ?? set.artboards[0]
    doc = { ...board.doc, assets: set.assets }
    byId.set(id, doc)
  }
  return doc
}
/** Puts an edited artboard back: its pictures join the set's, its look follows its layers. */
function withDoc(set: HeroSet, id: string, doc: DesignDoc): HeroSet {
  const next = { ...set, assets: doc.assets }
  return {
    ...next,
    artboards: set.artboards.map((a) => (a.id === id ? reconcile(next, a, doc) : a)),
  }
}

/**
 * A hero image set with one undo history for everything: the stream image
 * settings, layers in any artboard, adding and removing artboards. `editor`
 * is the artboard being edited in the Designer's shape, so the Designer's
 * tools work on it.
 */
export function useHeroProject() {
  const [set, setSet] = useState<HeroSet>(defaultSet)
  const [activeId, setActiveId] = useState(() => set.artboards[0].id)
  const [ready, setReady] = useState(false)
  const [saveStatus, setSaveStatus] = useState('Opening your set…')
  const [storageError, setStorageError] = useState(false)
  const past = useRef<HeroSet[]>([])
  const future = useRef<HeroSet[]>([])
  const gesture = useRef<HeroSet | null>(null)
  const current = useRef(set)
  const merge = useRef({ key: '', at: 0 })
  const [, force] = useState(0)
  // An artboard removed by undo hands over to the first one.
  const active = set.artboards.some((a) => a.id === activeId) ? activeId : set.artboards[0].id
  const activeRef = useRef(active)
  useEffect(() => {
    activeRef.current = active
  }, [active])

  useEffect(() => {
    let cancelled = false
    load()
      .then((saved) => {
        if (cancelled) return
        // Built-in backgrounds are measured now: draw them.
        const next = saved ?? composeAll(current.current)
        current.current = next
        setSet(next)
        setActiveId(next.artboards[0].id)
      })
      .catch(() => {})
      .finally(() => !cancelled && setReady(true))
    return () => {
      cancelled = true
    }
  }, [])
  useEffect(() => {
    if (!ready) return
    setSaveStatus('Saving…')
    const t = setTimeout(() => {
      write(JSON.stringify(pruneHeroAssets(set)))
        .then(() => {
          setSaveStatus('Saved on this device')
          setStorageError(false)
        })
        .catch(() => {
          setSaveStatus('Save the set as a file to keep your work')
          setStorageError(true)
        })
    }, 500)
    return () => clearTimeout(t)
  }, [set, ready])

  /* ---------- History over the whole set ---------- */
  const apply = (next: HeroSet) => {
    current.current = next
    setSet(next)
  }
  /** One undo step; with `key`, quick changes to the same setting share one. */
  const commitSet = useCallback((next: HeroSet | ((s: HeroSet) => HeroSet), key = '') => {
    const prev = current.current
    const value = typeof next === 'function' ? next(prev) : next
    if (value === prev) return
    const now = Date.now()
    const same = key && merge.current.key === key && now - merge.current.at < MERGE_MS
    merge.current = { key, at: now }
    if (!same) past.current = [...past.current.slice(-LIMIT + 1), gesture.current ?? prev]
    gesture.current = null
    future.current = []
    apply(value)
  }, [])
  const undo = useCallback(() => {
    const prev = past.current.at(-1)
    if (!prev) return
    past.current = past.current.slice(0, -1)
    future.current = [current.current, ...future.current]
    merge.current.key = ''
    apply(prev)
  }, [])
  const redo = useCallback(() => {
    const next = future.current[0]
    if (!next) return
    future.current = future.current.slice(1)
    past.current = [...past.current, current.current]
    merge.current.key = ''
    apply(next)
  }, [])

  /* ---------- The artboard being edited, for the Designer ---------- */
  const docRef = useMemo(
    () => ({
      get current() {
        return viewOf(current.current, activeRef.current)
      },
      set current(_doc: DesignDoc) {
        /* Read-only view: changes go through commit and preview. */
      },
    }),
    [],
  )
  const commit = useCallback(
    (next: DesignDoc | ((d: DesignDoc) => DesignDoc)) => {
      const s = current.current
      const d = viewOf(s, activeRef.current)
      const value = typeof next === 'function' ? next(d) : next
      if (value === d) return
      commitSet(withDoc(s, activeRef.current, value))
    },
    [commitSet],
  )
  const begin = useCallback(() => {
    gesture.current ??= current.current
  }, [])
  const preview = useCallback((next: DesignDoc | ((d: DesignDoc) => DesignDoc)) => {
    const s = current.current
    const d = viewOf(s, activeRef.current)
    const value = typeof next === 'function' ? next(d) : next
    apply(withDoc(s, activeRef.current, value))
  }, [])
  const end = useCallback(() => {
    const start = gesture.current
    gesture.current = null
    if (start && start !== current.current) {
      past.current = [...past.current.slice(-LIMIT + 1), start]
      future.current = []
      merge.current.key = ''
      force((n) => n + 1)
    }
  }, [])
  const cancel = useCallback(() => {
    const start = gesture.current
    gesture.current = null
    if (start) apply(start)
  }, [])

  const editor: DesignEditor = {
    doc: viewOf(set, active),
    ready,
    saveStatus,
    storageError,
    commit,
    begin,
    preview,
    end,
    cancel,
    undo,
    redo,
    canUndo: past.current.length > 0,
    canRedo: future.current.length > 0,
    current: docRef,
  }

  /* ---------- The stream image settings ---------- */
  const look = {
    /** Changes the artboard being edited (or every artboard with `all`). */
    patch: (values: Partial<Look>, all = false) =>
      commitSet(
        (s) => patchLook(s, all ? s.artboards.map((a) => a.id) : [activeRef.current], values),
        `${all ? '*' : activeRef.current}:${Object.keys(values).sort().join()}`,
      ),
    /** A new host photo for every artboard (each keeps its framing), or none. */
    setHost: (host: HostImage | null, src?: string) =>
      commitSet((s) =>
        composeAll({
          ...s,
          host,
          assets: host && src ? { ...s.assets, [host.asset]: src } : s.assets,
          // A new host shows everywhere again.
          artboards: s.artboards.map((a) => ({ ...a, look: { ...a.look, hostOff: false } })),
        }),
      ),
    /** A background picture added to the set, used on the artboard being edited. */
    addBackground: (bg: CustomBackground, src: string) =>
      commitSet((s) =>
        patchLook(
          { ...s, backgrounds: [...s.backgrounds, bg], assets: { ...s.assets, [bg.id]: src } },
          [activeRef.current],
          { background: bg.id, backgroundX: 50, backgroundY: 50, backgroundZoom: 100 },
        ),
      ),
    /** Removes an added background; artboards using it get the gradient. */
    removeBackground: (id: string) =>
      commitSet((s) => {
        const users = s.artboards.filter((a) => a.look.background === id).map((a) => a.id)
        return patchLook({ ...s, backgrounds: s.backgrounds.filter((b) => b.id !== id) }, users, {
          background: 'gradient',
        })
      }),
    resize: (width: number, height: number) =>
      commitSet(
        (s) => resizeArtboard(s, activeRef.current, width, height),
        `${activeRef.current}:size`,
      ),
  }

  /* ---------- Artboards ---------- */
  const select = (id: string) => {
    activeRef.current = id
    setActiveId(id)
  }
  const artboards = {
    select,
    /** A new artboard with the look of the one being edited. */
    add: (name: string, width: number, height: number) => {
      const s = current.current
      const from = s.artboards.find((a) => a.id === activeRef.current) ?? s.artboards[0]
      const board = newArtboard(s, name, width, height, { ...from.look })
      commitSet({ ...s, artboards: [...s.artboards, board] })
      select(board.id)
    },
    duplicate: (id: string) => {
      const r = duplicateArtboard(current.current, id)
      commitSet(r.set)
      select(r.id)
    },
    remove: (id: string) => {
      const s = current.current
      if (s.artboards.length < 2) return false
      const index = s.artboards.findIndex((a) => a.id === id)
      const rest = s.artboards.filter((a) => a.id !== id)
      commitSet({ ...s, artboards: rest })
      if (id === activeRef.current) select(rest[Math.max(0, index - 1)].id)
      return true
    },
    rename: (id: string, name: string) =>
      commitSet((s) => ({
        ...s,
        artboards: s.artboards.map((a) => (a.id === id ? { ...a, doc: { ...a.doc, name } } : a)),
      })),
    /** Moves an artboard one place left (-1) or right (1) in the row. */
    move: (id: string, by: -1 | 1) =>
      commitSet((s) => {
        const i = s.artboards.findIndex((a) => a.id === id)
        const j = i + by
        if (i < 0 || j < 0 || j >= s.artboards.length) return s
        const list = [...s.artboards]
        ;[list[i], list[j]] = [list[j], list[i]]
        return { ...s, artboards: list }
      }),
    copyToOthers: (layers: Layer[]) => commitSet((s) => copyToOthers(s, activeRef.current, layers)),
  }
  const setName = (name: string) => commitSet((s) => ({ ...s, name }), 'name')
  /** Opens a saved set or starts a new one; undo goes back. */
  const replace = (next: HeroSet) => {
    commitSet(composeAll(next))
    select(next.artboards[0].id)
  }

  return { set, active, editor, look, artboards, setName, replace }
}
