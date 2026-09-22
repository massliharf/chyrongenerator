import { useEffect, useReducer, useRef, useState } from 'react'
import {
  newStreamDocument,
  type StreamDocument,
  type FormatId,
  type Layout,
  type ImageAsset,
} from './model'
import { readDraft, writeDraft } from './storage'

type Action =
  | { type: 'hydrate'; document: StreamDocument }
  | { type: 'patch'; id: FormatId; patch: Partial<Layout>; at: number }
  | { type: 'name'; name: string; at: number }
  | { type: 'host'; host: ImageAsset | null }
  | { type: 'background'; asset: ImageAsset; id: FormatId }
  | { type: 'removeBackground'; id: string }
  | { type: 'allBackgrounds'; id: FormatId }
  | { type: 'undo' | 'redo' }
interface History {
  ready: boolean
  past: StreamDocument[]
  present: StreamDocument
  future: StreamDocument[]
  key: string
  at: number
}
function reducer(state: History, action: Action): History {
  if (action.type === 'hydrate') return { ...state, ready: true, present: action.document }
  if (action.type === 'undo')
    return state.past.length
      ? {
          ...state,
          present: state.past.at(-1)!,
          past: state.past.slice(0, -1),
          future: [state.present, ...state.future],
          key: '',
        }
      : state
  if (action.type === 'redo')
    return state.future.length
      ? {
          ...state,
          present: state.future[0],
          past: [...state.past, state.present],
          future: state.future.slice(1),
          key: '',
        }
      : state
  let next = state.present
  let key = '',
    at = 0
  if (action.type === 'patch') {
    const layout = { ...next.layouts[action.id], ...action.patch }
    if (JSON.stringify(layout) === JSON.stringify(next.layouts[action.id])) return state
    next = { ...next, layouts: { ...next.layouts, [action.id]: layout } }
    key = `${action.id}:${Object.keys(action.patch).sort().join(',')}`
    at = action.at
  }
  if (action.type === 'name') {
    if (next.name === action.name) return state
    next = { ...next, name: action.name }
    key = 'name'
    at = action.at
  }
  if (action.type === 'host') next = { ...next, host: action.host }
  if (action.type === 'background')
    next = {
      ...next,
      backgrounds: [...next.backgrounds, action.asset],
      layouts: {
        ...next.layouts,
        [action.id]: {
          ...next.layouts[action.id],
          background: action.asset.id,
          backgroundX: 50,
          backgroundY: 50,
          backgroundZoom: 100,
        },
      },
    }
  if (action.type === 'allBackgrounds') {
    const { background, color, color2, backgroundX, backgroundY, backgroundZoom } =
      next.layouts[action.id]
    const bg = { background, color, color2, backgroundX, backgroundY, backgroundZoom }
    next = {
      ...next,
      layouts: {
        hero: { ...next.layouts.hero, ...bg },
        host: { ...next.layouts.host, ...bg },
        stream: { ...next.layouts.stream, ...bg },
      },
    }
  }
  if (action.type === 'removeBackground') {
    const layouts = { ...next.layouts }
    for (const id of ['hero', 'host', 'stream'] as const) {
      if (layouts[id].background === action.id)
        layouts[id] = { ...layouts[id], background: 'gradient' }
    }
    next = { ...next, backgrounds: next.backgrounds.filter((bg) => bg.id !== action.id), layouts }
  }
  return {
    ...state,
    present: next,
    past:
      key && key === state.key && at - state.at < 650
        ? state.past
        : [...state.past.slice(-29), state.present],
    future: [],
    key,
    at,
  }
}

export function useStreamProject() {
  const [history, dispatch] = useReducer(reducer, undefined, () => ({
    ready: false,
    past: [],
    present: newStreamDocument(),
    future: [],
    key: '',
    at: 0,
  }))
  const [saved, setSaved] = useState<StreamDocument | null>(null)
  const [storageError, setStorageError] = useState(false)
  const queue = useRef(Promise.resolve())
  useEffect(() => {
    let live = true
    readDraft()
      .then((doc) => {
        if (live) {
          dispatch({ type: 'hydrate', document: doc ?? newStreamDocument() })
          if (doc) setSaved(doc)
        }
      })
      .catch(() => {
        if (live) {
          setStorageError(true)
          dispatch({ type: 'hydrate', document: newStreamDocument() })
        }
      })
    return () => {
      live = false
    }
  }, [])
  useEffect(() => {
    if (!history.ready || saved === history.present) return
    const doc = history.present
    const timer = setTimeout(() => {
      queue.current = queue.current
        .then(() => writeDraft(doc))
        .then(() => {
          setSaved(doc)
          setStorageError(false)
        })
        .catch(() => setStorageError(true))
    }, 300)
    return () => clearTimeout(timer)
  }, [history.present, history.ready, saved])
  return {
    document: history.present,
    ready: history.ready,
    patch: (id: FormatId, patch: Partial<Layout>) =>
      dispatch({ type: 'patch', id, patch, at: Date.now() }),
    rename: (name: string) => dispatch({ type: 'name', name, at: Date.now() }),
    setHost: (host: ImageAsset | null) => dispatch({ type: 'host', host }),
    addBackground: (asset: ImageAsset, id: FormatId) => dispatch({ type: 'background', asset, id }),
    applyBackgroundToAll: (id: FormatId) => dispatch({ type: 'allBackgrounds', id }),
    removeBackground: (id: string) => dispatch({ type: 'removeBackground', id }),
    undo: () => dispatch({ type: 'undo' }),
    redo: () => dispatch({ type: 'redo' }),
    canUndo: !!history.past.length,
    canRedo: !!history.future.length,
    storageError,
    saveStatus: !history.ready
      ? 'Opening your set…'
      : storageError
        ? 'Device storage unavailable. This session only.'
        : saved === history.present
          ? 'Images & edits saved on this device'
          : 'Saving images & edits…',
  }
}
