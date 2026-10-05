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

/**
 * Autosave state. With `onOpen` it is also the way to find out where the work
 * is kept: clicking it explains the device storage and project files.
 */
export function SaveStatus({
  status,
  error = false,
  onOpen,
}: {
  status: string
  error?: boolean
  onOpen?: () => void
}) {
  const short = error
    ? 'Not saved'
    : /sav(ed|ing)/i.test(status)
      ? status.includes('…')
        ? 'Saving…'
        : 'Saved'
      : status
  const content = (
    <>
      <span className="save-status-dot" aria-hidden="true" />
      <span className="sr-only">{status}</span>
      <span aria-hidden="true">{short}</span>
    </>
  )
  return onOpen ? (
    <span role="status" className="save-status-wrap">
      <button
        className={`save-status is-button ${error ? 'is-error' : ''}`}
        title={`${status} · Where is my work?`}
        aria-label={`${status}. Where is my work?`}
        onClick={onOpen}
      >
        {content}
      </button>
    </span>
  ) : (
    <span className={`save-status ${error ? 'is-error' : ''}`} role="status" title={status}>
      {content}
    </span>
  )
}
