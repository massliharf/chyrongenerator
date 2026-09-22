import { useEffect, useReducer, useState } from 'react'
import { DEFAULT_PROJECT, migrateLegacy, normalizeProject, type Project } from './model'
import { generateId } from '../utils/id'

const STORAGE_KEY = 'chyron-studio:v2'
const PRESETS_KEY = 'chyron-studio:presets:v2'
export interface SavedPreset {
  id: string
  name: string
  project: Project
}
interface History {
  past: Project[]
  present: Project
  future: Project[]
  lastKey: string
  lastAt: number
}
type Action =
  | { type: 'patch'; patch: Partial<Project>; at: number }
  | { type: 'replace'; project: Project }
  | { type: 'undo' }
  | { type: 'redo' }
function initial(): Project {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) return normalizeProject(JSON.parse(saved))
    if (localStorage.getItem('text')) {
      const raw: Record<string, unknown> = {}
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)!
        try {
          raw[key] = JSON.parse(localStorage.getItem(key)!)
        } catch {
          /* Ignore unrelated storage entries. */
        }
      }
      return migrateLegacy(raw)
    }
  } catch {
    /* A malformed or unavailable draft must not prevent the editor from opening. */
  }
  return { ...DEFAULT_PROJECT }
}
function reducer(state: History, action: Action): History {
  if (action.type === 'undo') {
    if (!state.past.length) return state
    return {
      past: state.past.slice(0, -1),
      present: state.past.at(-1)!,
      future: [state.present, ...state.future],
      lastKey: '',
      lastAt: 0,
    }
  }
  if (action.type === 'redo') {
    if (!state.future.length) return state
    return {
      past: [...state.past, state.present],
      present: state.future[0],
      future: state.future.slice(1),
      lastKey: '',
      lastAt: 0,
    }
  }
  const present = normalizeProject(
    action.type === 'replace' ? action.project : { ...state.present, ...action.patch },
  )
  if (JSON.stringify(present) === JSON.stringify(state.present)) return state
  const key = action.type === 'patch' ? Object.keys(action.patch).sort().join(',') : ''
  const at = action.type === 'patch' ? action.at : 0
  const group = key && key === state.lastKey && at - state.lastAt < 600
  return {
    present,
    past: group ? state.past : [...state.past.slice(-79), state.present],
    future: [],
    lastKey: key,
    lastAt: at,
  }
}
export function useProject() {
  const [history, dispatch] = useReducer(reducer, undefined, () => ({
    present: initial(),
    past: [],
    future: [],
    lastKey: '',
    lastAt: 0,
  }))
  const [savedProject, setSavedProject] = useState<Project | null>(null)
  const [storageError, setStorageError] = useState(false)
  useEffect(() => {
    const timeout = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(history.present))
        setSavedProject(history.present)
        setStorageError(false)
      } catch {
        setStorageError(true)
      }
    }, 250)
    const flush = () => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(history.present))
      } catch {
        /* Status is shown in the editor. */
      }
    }
    window.addEventListener('pagehide', flush)
    return () => {
      clearTimeout(timeout)
      window.removeEventListener('pagehide', flush)
    }
  }, [history.present])
  return {
    project: history.present,
    patch: (patch: Partial<Project>) => dispatch({ type: 'patch', patch, at: Date.now() }),
    replace: (project: Project) => dispatch({ type: 'replace', project }),
    undo: () => dispatch({ type: 'undo' }),
    redo: () => dispatch({ type: 'redo' }),
    canUndo: !!history.past.length,
    canRedo: !!history.future.length,
    saveStatus: storageError
      ? 'Save a project file to keep changes'
      : savedProject === history.present
        ? 'Saved on this device'
        : 'Saving…',
  }
}
export function loadPresets(): SavedPreset[] {
  try {
    const current = localStorage.getItem(PRESETS_KEY)
    if (current) {
      const entries: unknown = JSON.parse(current)
      if (!Array.isArray(entries)) return []
      return entries
        .filter((e) => e && typeof e.id === 'string' && typeof e.name === 'string' && e.project)
        .slice(0, 40)
        .map((e) => ({ id: e.id, name: e.name.slice(0, 80), project: normalizeProject(e.project) }))
    }
    return ['presets', 'typography_presets']
      .flatMap((key) => {
        const entries: unknown = JSON.parse(localStorage.getItem(key) || '[]')
        return Array.isArray(entries)
          ? entries
              .filter((e) => e && typeof e.name === 'string')
              .map((e) => ({
                id: `legacy-${key}-${e.id || generateId()}`,
                name: e.name,
                project: migrateLegacy(e, key === 'typography_presets'),
              }))
          : []
      })
      .slice(0, 40)
  } catch {
    return []
  }
}
export function storePresets(presets: SavedPreset[]) {
  localStorage.setItem(PRESETS_KEY, JSON.stringify(presets))
}
