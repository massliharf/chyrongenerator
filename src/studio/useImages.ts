import { useEffect, useState } from 'react'
import { imageLayers, type Project } from './model'
import { loadProjectImages, type ImageMap } from './assets'

const empty: ImageMap = new Map()
/** Decoded images for a project's layers. Re-resolves only when the set of assets changes. */
export function useProjectImages(p: Project): ImageMap {
  const key = imageLayers(p)
    .map((l) => l.assetId)
    .sort()
    .join('|')
  const [state, setState] = useState<{ key: string; map: ImageMap }>({ key: '', map: empty })
  useEffect(() => {
    if (!key) return
    let disposed = false
    void loadProjectImages(p).then((map) => {
      if (!disposed) setState({ key, map })
    })
    return () => {
      disposed = true
    }
    // The key captures every asset the project refers to.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  return key ? state.map : empty
}
