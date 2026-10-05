import { useEffect, useMemo, useState } from 'react'
import { loadFontSet, type Fonts } from './fonts'
import { chyronLayers, styleOf, type FontName, type Project } from './model'
import { buildScenes, type SceneMap } from './renderer'

/**
 * Scenes for every chyron in the project. Fonts load once per typeface; until
 * every chyron's font has loaded, `ready` is false and the previous scenes stay.
 */
export function useScenes(p: Project, retry = 0) {
  const fontKey = [...new Set(chyronLayers(p).map((l) => styleOf(p, l).font))].sort().join('|')
  const [fonts, setFonts] = useState<{ key: string; map: Map<FontName, Fonts> } | null>(null)
  const [error, setError] = useState('')
  useEffect(() => {
    let disposed = false
    loadFontSet(fontKey.split('|').filter(Boolean) as FontName[])
      .then((map) => {
        if (disposed) return
        setFonts({ key: fontKey, map })
        setError('')
      })
      .catch((e) => {
        if (!disposed) setError(e instanceof Error ? e.message : 'Font could not be loaded.')
      })
    return () => {
      disposed = true
    }
  }, [fontKey, retry])
  const scenes: SceneMap = useMemo(
    () => (fonts ? buildScenes(p, fonts.map) : new Map()),
    [fonts, p],
  )
  return { scenes, ready: fonts?.key === fontKey, error }
}
