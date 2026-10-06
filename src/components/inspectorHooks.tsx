import { useEffect, useState, type ReactNode } from 'react'
import { Section } from './Controls'

/* Inspector helpers that are not components. */

const OPEN_KEY = 'chyron-studio:groups:v3'
const defaultOpen: Record<string, boolean> = {
  style: true,
  text: true,
  place: true,
  canvas: true,
  timing: true,
  'shape-fill': true,
  'anim-in': true,
  'anim-onscreen': true,
}
const REVEAL = 'chyron-studio:reveal-group'
/** Open a section wherever it is shown (for links that jump to a setting). */
export const revealGroup = (id: string) =>
  window.dispatchEvent(new CustomEvent(REVEAL, { detail: id }))
/** Collapsible sections whose open state is remembered on this device. */
export function useGroups() {
  const [open, setOpen] = useState<Record<string, boolean>>(() => {
    try {
      const raw = JSON.parse(localStorage.getItem(OPEN_KEY) || 'null')
      return raw && typeof raw === 'object' ? { ...defaultOpen, ...raw } : defaultOpen
    } catch {
      return defaultOpen
    }
  })
  const store = (next: Record<string, boolean>) => {
    setOpen(next)
    try {
      localStorage.setItem(OPEN_KEY, JSON.stringify(next))
    } catch {
      /* Optional preference. */
    }
  }
  const toggle = (id: string) => store({ ...open, [id]: !open[id] })
  useEffect(() => {
    const reveal = (e: Event) => {
      const id = (e as CustomEvent<string>).detail
      setOpen((current) => (current[id] ? current : { ...current, [id]: true }))
    }
    window.addEventListener(REVEAL, reveal)
    return () => window.removeEventListener(REVEAL, reveal)
  }, [])
  return (
    id: string,
    title: string,
    summary: string,
    children: ReactNode,
    onReset?: () => void,
  ) => (
    <Section
      key={id}
      title={title}
      summary={summary}
      open={!!open[id]}
      onToggle={() => toggle(id)}
      onReset={onReset}
    >
      {children}
    </Section>
  )
}

/** Seconds as m:ss.s for song positions. */
export const clock = (seconds: number) => {
  const m = Math.floor(seconds / 60)
  const s = seconds - m * 60
  return `${m}:${s.toFixed(1).padStart(4, '0')}`
}
