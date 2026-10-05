import { useEffect, useState } from 'react'
import { audioPeaks, loadAudio } from './audio'

const cache = new Map<string, Float32Array>()
/** Waveform peaks of a stored song, computed once per song. */
export function useAudioPeaks(assetId: string | undefined) {
  const [loaded, setLoaded] = useState<{ id: string; peaks: Float32Array } | null>(null)
  useEffect(() => {
    if (!assetId || cache.has(assetId)) return
    let disposed = false
    void loadAudio(assetId).then((buffer) => {
      if (!buffer || disposed) return
      const peaks = audioPeaks(buffer, 2400)
      cache.set(assetId, peaks)
      setLoaded({ id: assetId, peaks })
    })
    return () => {
      disposed = true
    }
  }, [assetId])
  if (!assetId) return null
  return cache.get(assetId) ?? (loaded?.id === assetId ? loaded.peaks : null)
}
