import { Clapperboard, FolderOpen, LayoutGrid, PenTool } from 'lucide-react'
import { ThemeToggle } from './ThemeToggle'

export type Workspace = 'chyron' | 'designer' | 'gallery' | 'apps'

/** `end`: at the foot of the rail, above the theme switch (last in the bottom bar). */
const WORKSPACES: { id: Workspace; label: string; Icon: typeof Clapperboard; end?: boolean }[] = [
  { id: 'chyron', label: 'Chyron', Icon: Clapperboard },
  { id: 'designer', label: 'Designer', Icon: PenTool },
  { id: 'apps', label: 'Apps', Icon: LayoutGrid },
  { id: 'gallery', label: 'Media gallery', Icon: FolderOpen, end: true },
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
        {WORKSPACES.map(({ id, label, Icon, end }) => (
          <li key={id} className={end ? 'is-end' : undefined}>
            <button
              className="app-nav-item"
              title={label}
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
