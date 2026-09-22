import type { StreamDocument } from './model'

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('chyron-stream-images', 1)
    request.onupgradeneeded = () => request.result.createObjectStore('drafts')
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
    request.onblocked = () => reject(new Error('Storage is busy in another tab.'))
  })
}
export async function readDraft(): Promise<StreamDocument | null> {
  const db = await openDatabase()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('drafts', 'readonly')
    const request = tx.objectStore('drafts').get('current')
    tx.oncomplete = () => {
      db.close()
      const doc = request.result as StreamDocument | undefined
      resolve(
        doc?.version === 1 &&
          doc.layouts?.hero &&
          doc.layouts?.host &&
          doc.layouts?.stream &&
          Array.isArray(doc.backgrounds)
          ? doc
          : null,
      )
    }
    tx.onerror = () => {
      db.close()
      reject(tx.error)
    }
    tx.onabort = () => {
      db.close()
      reject(tx.error)
    }
  })
}
export async function writeDraft(doc: StreamDocument): Promise<void> {
  const db = await openDatabase()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('drafts', 'readwrite')
    tx.objectStore('drafts').put(doc, 'current')
    tx.oncomplete = () => {
      db.close()
      resolve()
    }
    tx.onerror = () => {
      db.close()
      reject(tx.error)
    }
    tx.onabort = () => {
      db.close()
      reject(tx.error)
    }
  })
}
