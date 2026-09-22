import { useCallback, useEffect, useRef, useState } from 'react'
import { duration, restTime, type Project } from './model'

export function usePlayback(project: Project) {
  const [time, setTime] = useState(() => restTime(project))
  const [playing, setPlaying] = useState(false)
  const [loop, setLoop] = useState(true)
  const [run, setRun] = useState(0)
  const [phase, setPhase] = useState<'intro' | 'outro' | null>(null)
  const timeRef = useRef(time)
  const total = duration(project)
  const transitionDuration = project.animationDuration
  const seek = useCallback(
    (value: number) => {
      const next = Math.max(0, Math.min(total, value))
      timeRef.current = next
      setTime(next)
      setPlaying(false)
      setPhase(null)
    },
    [total],
  )
  const play = useCallback(
    (restart = false) => {
      setPhase(null)
      if (restart || timeRef.current >= total - 1 / project.fps) {
        timeRef.current = 0
        setTime(0)
      }
      if (restart) setRun((value) => value + 1)
      setPlaying(true)
    },
    [total, project.fps],
  )
  const previewPhase = useCallback(
    (nextPhase: 'intro' | 'outro') => {
      const start = nextPhase === 'intro' ? 0 : total - transitionDuration
      timeRef.current = start
      setTime(start)
      setPhase(nextPhase)
      setRun((value) => value + 1)
      setPlaying(true)
    },
    [total, transitionDuration],
  )
  useEffect(() => {
    if (!playing) return
    let id = 0
    let start: number | undefined
    const startTime = phase === 'outro' ? total - transitionDuration : 0
    const endTime = phase === 'intro' ? transitionDuration : total
    const shouldLoop = loop && phase === null
    const initialTime = Math.max(startTime, Math.min(endTime, timeRef.current))
    const animate = (now: number) => {
      start ??= now
      const elapsed = initialTime + (now - start) / 1000
      const value = shouldLoop ? elapsed % total : Math.min(endTime, elapsed)
      timeRef.current = value
      setTime(value)
      if (!shouldLoop && elapsed >= endTime) {
        setPlaying(false)
        return
      }
      id = requestAnimationFrame(animate)
    }
    id = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(id)
  }, [playing, loop, total, run, phase, transitionDuration])
  return {
    time: time > total ? restTime(project) : time,
    playing,
    loop,
    setLoop,
    seek,
    play,
    previewPhase,
    pause: () => setPlaying(false),
    toggle: () => (playing ? setPlaying(false) : play()),
  }
}
