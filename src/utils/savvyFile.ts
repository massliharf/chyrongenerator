/**
 * Project files: every editor saves `<name>.savvy`, a JSON document with its
 * images (and music) inside. What is in the file says which editor it belongs
 * to, so a file opened in the other editor is handed over to the right one.
 * Files saved by earlier versions (.chyron.json, .design.json) still open.
 */
export const SAVVY_EXTENSION = '.savvy'
/** For downloads and the save dialog; not text/JSON, so browsers keep the name. */
export const SAVVY_TYPE = 'application/x-savvy'
/** What open dialogs accept: .savvy files and the .json files of earlier versions. */
export const SAVVY_ACCEPT = '.savvy,.json,application/json'

export type SavvyKind = 'chyron' | 'design' | 'hero'

export const savvyName = (stem: string) => `${stem}${SAVVY_EXTENSION}`
export const isSavvyFile = (file: File) => /\.(savvy|json)$/i.test(file.name)

/** Which editor a parsed project file belongs to, or null when it is neither. */
export function savvyKind(raw: unknown): SavvyKind | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const r = raw as Record<string, unknown>
  if (r.version === 2 && typeof r.text === 'string') return 'chyron'
  if (r.kind === 'hero' && Array.isArray(r.artboards)) return 'hero'
  if (r.version === 1 && Array.isArray(r.layers) && typeof r.width === 'number') return 'design'
  return null
}

/* ---------- Hand-off between editors ---------- */

const pending = new Map<SavvyKind, File>()
const EVENT = 'savvy:open-file'
let showEditor: ((kind: SavvyKind) => void) | null = null

/** The app shell shows the editor a handed-over file belongs to. */
export function onSavvyHandOff(show: (kind: SavvyKind) => void) {
  showEditor = show
}

/** Opens a project file in its own editor (which may mount only now). */
export function sendSavvyFile(kind: SavvyKind, file: File) {
  pending.set(kind, file)
  showEditor?.(kind)
  window.dispatchEvent(new Event(EVENT))
}

/** An editor receives files handed over to it, including ones sent before it mounted. */
export function subscribeSavvyFiles(kind: SavvyKind, open: (file: File) => void) {
  const drain = () => {
    const file = pending.get(kind)
    if (!file) return
    pending.delete(kind)
    open(file)
  }
  drain()
  window.addEventListener(EVENT, drain)
  return () => window.removeEventListener(EVENT, drain)
}
