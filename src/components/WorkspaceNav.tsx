import { Clapperboard, FolderOpen, Images } from 'lucide-react'
import { ThemeToggle } from './ThemeToggle'

export type Workspace = 'chyron' | 'stream' | 'gallery'

const WORKSPACES: { id: Workspace; label: string; Icon: typeof Clapperboard }[] = [
  { id: 'chyron', label: 'Chyron', Icon: Clapperboard },
  { id: 'stream', label: 'Stream images', Icon: Images },
  { id: 'gallery', label: 'Media gallery', Icon: FolderOpen },
]

/**
 * Magnific app navigation. One instance for the whole app:
 * Navigation Rail from 768px, Bottom Navigation below it.
 */
export function AppNav({
  current,
  onChange,
}: {
  current: Workspace
  onChange: (workspace: Workspace) => void
}) {
  return (
    <nav className="app-nav" aria-label="Workspaces">
      <span className="app-brand" aria-label="Chyron Studio" role="img">
        <span className="brand-symbol" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
      </span>
      <ul className="app-nav-list">
        {WORKSPACES.map(({ id, label, Icon }) => (
          <li key={id}>
            <button
              className="app-nav-item"
              aria-current={current === id ? 'page' : undefined}
              data-workspace-link={id}
              onClick={() => onChange(id)}
            >
              <span className="app-nav-icon">
                <Icon size={22} aria-hidden="true" />
              </span>
              <span className="app-nav-label">{label}</span>
            </button>
          </li>
        ))}
      </ul>
      <div className="app-nav-footer">
        <ThemeToggle />
      </div>
    </nav>
  )
}
