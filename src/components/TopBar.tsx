import type { ReactNode } from 'react'
import { ThemeToggle } from './ThemeToggle'

/**
 * Magnific Top App Bar used by every workspace: context on the left (title,
 * name field, status), actions on the right. On phones, where the rail becomes
 * a bottom bar, the theme switch moves here.
 */
export function TopBar({ children, actions }: { children: ReactNode; actions?: ReactNode }) {
  return (
    <header className="topbar">
      <div className="topbar-start">{children}</div>
      <div className="topbar-actions">
        <span className="mobile-only">
          <ThemeToggle />
        </span>
        {actions}
      </div>
    </header>
  )
}

export function SaveStatus({ status, error = false }: { status: string; error?: boolean }) {
  const short = error
    ? 'Not saved'
    : /sav(ed|ing)/i.test(status)
      ? status.includes('…')
        ? 'Saving…'
        : 'Saved'
      : status
  return (
    <span className={`save-status ${error ? 'is-error' : ''}`} role="status" title={status}>
      <span className="save-status-dot" aria-hidden="true" />
      <span className="sr-only">{status}</span>
      <span aria-hidden="true">{short}</span>
    </span>
  )
}
