import { Clapperboard, Images } from 'lucide-react'

export type Workspace = 'chyron' | 'stream'

export function WorkspaceNav({
  current,
  onChange,
}: {
  current: Workspace
  onChange: (workspace: Workspace) => void
}) {
  return (
    <nav className="workspace-nav" aria-label="Studio tools">
      <button aria-pressed={current === 'chyron'} onClick={() => onChange('chyron')}>
        <Clapperboard size={16} aria-hidden="true" />
        <span className="nav-label">Chyron</span>
      </button>
      <button aria-pressed={current === 'stream'} onClick={() => onChange('stream')}>
        <Images size={16} aria-hidden="true" />
        <span className="nav-label">
          Stream<span className="nav-extra"> Images</span>
        </span>
      </button>
    </nav>
  )
}
