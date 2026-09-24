import { Clapperboard, FolderOpen, Images } from 'lucide-react'

export type Workspace = 'chyron' | 'stream' | 'gallery'

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
      <button aria-pressed={current === 'gallery'} onClick={() => onChange('gallery')}>
        <FolderOpen size={16} aria-hidden="true" />
        <span className="nav-label">
          Media<span className="nav-extra"> Gallery</span>
        </span>
      </button>
    </nav>
  )
}
