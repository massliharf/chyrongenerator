import { useState, type ReactNode } from 'react'
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
}
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
  const toggle = (id: string) => {
    const next = { ...open, [id]: !open[id] }
    setOpen(next)
    try {
      localStorage.setItem(OPEN_KEY, JSON.stringify(next))
    } catch {
      /* Optional preference. */
    }
  }
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
