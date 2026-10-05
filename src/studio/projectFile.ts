import { embedAssets } from './assets'
import { fileStem, imageLayers, type Project } from './model'
import { saveBlob } from './export'

/**
 * Project files: one .chyron.json with every image and the music embedded, so
 * it reopens complete on any device. Where the browser can show a save dialog
 * (Chrome, Edge), you pick the folder once and later saves go to the same file;
 * elsewhere the file downloads to the browser's downloads folder.
 */
interface WritableHandle {
  name: string
  createWritable: () => Promise<{
    write: (data: Blob) => Promise<void>
    close: () => Promise<void>
  }>
}
type SavePicker = (options: {
  suggestedName: string
  id?: string
  types: { description: string; accept: Record<string, string[]> }[]
}) => Promise<WritableHandle>

let handle: WritableHandle | null = null
const picker = () => (window as unknown as { showSaveFilePicker?: SavePicker }).showSaveFilePicker
/** True when the browser lets you choose where project files go. */
export const canChooseLocation = () => typeof picker() === 'function'
/** Forget the file a project was saved to (after New or Open). */
export function forgetProjectFile() {
  handle = null
}

export interface SavedFile {
  filename: string
  /** Saved through the browser's save dialog to a place you chose. */
  picked: boolean
  /** Some images or music could not be embedded. */
  missing: boolean
}

/** Save the project. `choose` asks for a new location even when there is one. */
export async function saveProjectFile(p: Project, choose = false): Promise<SavedFile | null> {
  let assets: Awaited<ReturnType<typeof embedAssets>> | undefined
  let missing = false
  if (imageLayers(p).length || p.audio) {
    try {
      assets = await embedAssets(p)
    } catch {
      missing = true
    }
  }
  const blob = new Blob([JSON.stringify({ ...p, assets }, null, 2)], {
    type: 'application/json',
  })
  const filename = `${fileStem(p.name)}.chyron.json`
  const show = picker()
  if (show) {
    try {
      if (choose || !handle)
        handle = await show({
          suggestedName: filename,
          id: 'chyron-projects',
          types: [
            { description: 'Chyron Studio project', accept: { 'application/json': ['.json'] } },
          ],
        })
      const writable = await handle.createWritable()
      await writable.write(blob)
      await writable.close()
      return { filename: handle.name, picked: true, missing }
    } catch (error) {
      // Closing the dialog is not an error.
      if (error instanceof DOMException && error.name === 'AbortError') return null
      handle = null
      // Fall back to a download when the file system refuses.
    }
  }
  saveBlob(blob, filename)
  return { filename, picked: false, missing }
}
