import { Clapperboard, FolderOpen, LayoutGrid, PenTool } from 'lucide-react'
import { ThemeToggle } from './ThemeToggle'
import logo from '../assets/brand/savvy-logo-96.png'

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
      <span className="app-brand">
        <img className="brand-logo" src={logo} alt="Savvy Editor" width={32} height={32} />
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
