import { useCallback, useEffect, useRef, useState } from 'react'
import { DEFAULT_DOC, parseDoc, pruneAssets, type DesignDoc } from './model'

const DB = 'chyron-designer'
const STORE = 'docs'
const KEY = 'current'
const LIMIT = 100

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

/**
 * Undoable document state.
 * - commit(next): one undo step.
 * - begin() … preview(next) … end(): a gesture (drag, scrub) that becomes one
 *   undo step when it ends, however many frames it previewed.
 */
export function useDesignDoc() {
  const [doc, setDoc] = useState<DesignDoc>(DEFAULT_DOC)
  const [ready, setReady] = useState(false)
  const [saveStatus, setSaveStatus] = useState('Saved on this device')
  const [storageError, setStorageError] = useState(false)
  const past = useRef<DesignDoc[]>([])
  const future = useRef<DesignDoc[]>([])
  const gesture = useRef<DesignDoc | null>(null)
  const current = useRef(doc)
  current.current = doc
  const [, force] = useState(0)

  useEffect(() => {
    let cancelled = false
    read()
      .then((json) => {
        if (!cancelled && json) setDoc(parseDoc(json))
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
      write(JSON.stringify(pruneAssets(doc)))
        .then(() => {
          setSaveStatus('Saved on this device')
          setStorageError(false)
        })
        .catch(() => {
          setSaveStatus('Save a design file to keep your work')
          setStorageError(true)
        })
    }, 500)
    return () => clearTimeout(t)
  }, [doc, ready])

  const commit = useCallback((next: DesignDoc | ((d: DesignDoc) => DesignDoc)) => {
    const prev = current.current
    const value = typeof next === 'function' ? next(prev) : next
    if (value === prev) return
    past.current = [...past.current.slice(-LIMIT + 1), gesture.current ?? prev]
    gesture.current = null
    future.current = []
    current.current = value
    setDoc(value)
  }, [])
  const begin = useCallback(() => {
    gesture.current ??= current.current
  }, [])
  const preview = useCallback((next: DesignDoc | ((d: DesignDoc) => DesignDoc)) => {
    const value = typeof next === 'function' ? next(current.current) : next
    current.current = value
    setDoc(value)
  }, [])
  const end = useCallback(() => {
    const start = gesture.current
    gesture.current = null
    if (start && start !== current.current) {
      past.current = [...past.current.slice(-LIMIT + 1), start]
      future.current = []
      force((n) => n + 1)
    }
  }, [])
  /** Abandons a gesture and restores where it began. */
  const cancel = useCallback(() => {
    const start = gesture.current
    gesture.current = null
    if (start) {
      current.current = start
      setDoc(start)
    }
  }, [])
  const undo = useCallback(() => {
    const prev = past.current.at(-1)
    if (!prev) return
    past.current = past.current.slice(0, -1)
    future.current = [current.current, ...future.current]
    current.current = prev
    setDoc(prev)
  }, [])
  const redo = useCallback(() => {
    const next = future.current[0]
    if (!next) return
    future.current = future.current.slice(1)
    past.current = [...past.current, current.current]
    current.current = next
    setDoc(next)
  }, [])

  return {
    doc,
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
    current,
  }
}
export type DesignEditor = ReturnType<typeof useDesignDoc>
