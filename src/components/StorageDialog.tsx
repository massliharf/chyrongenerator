import { useEffect, useRef, useState } from 'react'
import { Download, FileJson, FolderOpen, HardDrive, ShieldCheck, X } from 'lucide-react'
import { fileStem, imageLayers, type Project } from '../studio/model'
import { canChooseLocation, type SavedFile } from '../studio/projectFile'

const mb = (bytes: number) =>
  bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / 1024 / 1024).toFixed(1)} MB`

/**
 * "Where is my work?" Autosave lives in this browser on this device; project
 * files go wherever you save them; exports go to the downloads folder.
 */
export function StorageDialog({
  project,
  saveStatus,
  lastSaved,
  onSave,
  onClose,
}: {
  project: Project
  saveStatus: string
  lastSaved: SavedFile | null
  onSave: (choose: boolean) => void
  onClose: () => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [usage, setUsage] = useState<number | null>(null)
  const [persisted, setPersisted] = useState<boolean | null>(null)
  useEffect(() => {
    dialog.current?.showModal()
    void navigator.storage
      ?.estimate?.()
      .then((e) => setUsage(e.usage ?? null))
      .catch(() => {})
    void navigator.storage
      ?.persisted?.()
      .then(setPersisted)
      .catch(() => {})
  }, [])
  const close = () => {
    dialog.current?.close()
    onClose()
  }
  const images = new Set(imageLayers(project).map((l) => l.assetId)).size
  const stored = [
    images ? `${images} ${images === 1 ? 'image' : 'images'}` : '',
    project.audio ? `the music (${project.audio.name})` : '',
  ].filter(Boolean)
  const choose = canChooseLocation()
  return (
    <dialog
      ref={dialog}
      className="dialog dialog-md storage-dialog"
      aria-labelledby="storage-title"
      onCancel={(e) => {
        e.preventDefault()
        close()
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) close()
      }}
    >
      <div className="dialog-header">
        <div>
          <h2 id="storage-title">Where is my work?</h2>
          <p>Nothing is uploaded. Everything stays on this computer until you save or export it.</p>
        </div>
        <button className="icon-button" aria-label="Close" onClick={close}>
          <X size={18} />
        </button>
      </div>
      <div className="dialog-body storage-list">
        <section className="storage-item">
          <span className="storage-icon" aria-hidden="true">
            <HardDrive size={18} />
          </span>
          <div>
            <h3>
              Autosave <span className="storage-badge">{saveStatus}</span>
            </h3>
            <p>
              Every change is kept in this browser&apos;s storage on this device, so it is here when
              you come back. It is not in the cloud: another browser, a private window or clearing
              site data will not have it.
            </p>
            <p className="storage-meta">
              {stored.length ? `${stored.join(' and ')} stored with it` : 'No images or music yet'}
              {usage !== null ? ` · ${mb(usage)} used by Chyron Studio in this browser` : ''}
            </p>
            {persisted === false && (
              <button
                className="button secondary sm"
                onClick={() =>
                  void navigator.storage
                    .persist()
                    .then(setPersisted)
                    .catch(() => {})
                }
              >
                <ShieldCheck size={14} aria-hidden="true" /> Keep it when space runs low
              </button>
            )}
            {persisted === true && (
              <p className="storage-meta">
                <ShieldCheck size={14} aria-hidden="true" /> The browser will not clear it to free
                up space.
              </p>
            )}
          </div>
        </section>
        <section className="storage-item">
          <span className="storage-icon" aria-hidden="true">
            <FileJson size={18} />
          </span>
          <div>
            <h3>Project files</h3>
            <p>
              <strong>Save project file</strong> writes one <code>.chyron.json</code> with every
              image and the music inside, so it opens complete on any computer with{' '}
              <strong>Open project file</strong>.{' '}
              {choose
                ? 'Your browser asks where to put it the first time; later saves update the same file.'
                : 'Your browser puts it in its downloads folder (usually Downloads); move it anywhere you like.'}
            </p>
            <p className="storage-meta">
              {lastSaved
                ? lastSaved.picked
                  ? `Last saved as ${lastSaved.filename}, in the folder you chose.`
                  : `Last saved as ${lastSaved.filename} in your downloads folder.`
                : `Not saved to a file yet. It will be named ${fileStem(project.name)}.chyron.json.`}
            </p>
            <div className="button-row">
              <button className="button primary sm" onClick={() => onSave(false)}>
                <Download size={14} aria-hidden="true" /> Save project file
              </button>
              {choose && (
                <button className="button secondary sm" onClick={() => onSave(true)}>
                  <FolderOpen size={14} aria-hidden="true" /> Save as…
                </button>
              )}
            </div>
          </div>
        </section>
        <section className="storage-item">
          <span className="storage-icon" aria-hidden="true">
            <Download size={18} />
          </span>
          <div>
            <h3>Exports</h3>
            <p>
              Videos, PNG sequences, PNGs and SVGs download to your browser&apos;s downloads folder.
              Exports are renders only; keep the project file to edit again later.
            </p>
          </div>
        </section>
      </div>
      <div className="dialog-footer">
        <span className="dialog-footer-spacer" />
        <button className="button secondary" onClick={close}>
          Done
        </button>
      </div>
    </dialog>
  )
}
