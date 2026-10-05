import { useEffect, useRef, useState } from 'react'
import { loadAudio, scheduleMusic } from './audio'
import type { AudioTrack } from './model'

/**
 * Plays the music in step with the preview. It starts where the playhead is
 * when playback starts, and restarts whenever the playhead jumps (a loop, a
 * phase preview or a seek), using the same schedule as the export.
 */
export function useMusicPreview(
  track: AudioTrack | undefined,
  total: number,
  playing: boolean,
  time: number,
) {
  const context = useRef<AudioContext | null>(null)
  const timeRef = useRef(time)
  const last = useRef(time)
  const [jump, setJump] = useState(0)
  timeRef.current = time
  const key = track ? JSON.stringify(track) : ''

  // Decode the song ahead of the first play.
  useEffect(() => {
    if (track) void loadAudio(track.assetId)
  }, [track?.assetId]) // eslint-disable-line react-hooks/exhaustive-deps

  // A playhead that moves backwards, or skips ahead, needs the music to follow.
  useEffect(() => {
    const previous = last.current
    last.current = time
    if (playing && (time < previous - 0.05 || time > previous + 0.5)) setJump((n) => n + 1)
  }, [time, playing])

  useEffect(() => {
    if (!playing || !track || track.muted || track.volume <= 0) return
    let cancelled = false
    let stop: (() => void) | null = null
    void loadAudio(track.assetId).then(async (buffer) => {
      if (!buffer || cancelled) return
      const ctx = (context.current ??= new AudioContext())
      if (ctx.state === 'suspended') await ctx.resume().catch(() => {})
      if (cancelled) return
      stop = scheduleMusic(ctx, buffer, track, total, timeRef.current, ctx.currentTime + 0.01)
    })
    return () => {
      cancelled = true
      stop?.()
    }
    // `key` stands for every track setting.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, key, total, jump])

  useEffect(
    () => () => {
      void context.current?.close().catch(() => {})
    },
    [],
  )
}
