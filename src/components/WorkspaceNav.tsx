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
        <Clapperboard size={18} /> Chyron
      </button>
      <button aria-pressed={current === 'stream'} onClick={() => onChange('stream')}>
        <Images size={18} /> Stream Images
      </button>
      <span>One studio. Every screen.</span>
    </nav>
  )
}
