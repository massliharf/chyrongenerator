import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Clapperboard,
  FolderOpen,
  GalleryHorizontalEnd,
  LoaderCircle,
  MoreHorizontal,
  PencilLine,
  PenTool,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  X,
} from 'lucide-react'
import { MenuButton } from '../components/Menu'
import { TopBar } from '../components/TopBar'
import { requestNewSavvy, type SavvyKind } from '../utils/savvyFile'
import { supabase } from './client'
import {
  PROJECTS_CHANGED,
  deleteCloudProject,
  listProjects,
  openCloudProject,
  renameCloudProject,
  type CloudProject,
} from './projects'
import { useCloud } from './useCloud'

const KINDS: {
  kind: SavvyKind
  label: string
  create: string
  lead: string
  Icon: typeof Clapperboard
  tone: 'is-video' | 'is-image'
}[] = [
  {
    kind: 'chyron',
    label: 'Chyron',
    create: 'New chyron',
    lead: 'Animated titles with music, exported with alpha.',
    Icon: Clapperboard,
    tone: 'is-video',
  },
  {
    kind: 'design',
    label: 'Design',
    create: 'New design',
    lead: 'A layered image: pictures, text, shapes and frames.',
    Icon: PenTool,
    tone: 'is-image',
  },
  {
    kind: 'hero',
    label: 'Hero set',
    create: 'New hero set',
    lead: 'Hero image, host card and stream image in one go.',
    Icon: GalleryHorizontalEnd,
    tone: 'is-image',
  },
]
const KIND = Object.fromEntries(KINDS.map((k) => [k.kind, k])) as Record<
  SavvyKind,
  (typeof KINDS)[number]
>

const relative = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })
/** “5 minutes ago”, “yesterday”, “3 weeks ago”. */
function ago(iso: string) {
  const seconds = (Date.parse(iso) - Date.now()) / 1000
  const steps: [Intl.RelativeTimeFormatUnit, number][] = [
    ['second', 60],
    ['minute', 60],
    ['hour', 24],
    ['day', 7],
    ['week', 4.35],
    ['month', 12],
    ['year', Infinity],
  ]
  let value = seconds
  for (const [unit, size] of steps) {
    if (Math.abs(value) < size) return relative.format(Math.round(value), unit)
    value /= size
  }
  return ''
}

/**
 * Home: the team's projects, most recently saved first, and the ways to start
 * a new one. Projects get here with "Save to team" in each editor's menu.
 */
export default function HomeWorkspace({ active }: { active: boolean }) {
  const { team, user, status } = useCloud()
  const teamId = team?.id ?? null
  const [projects, setProjects] = useState<CloudProject[] | null>(null)
  const [emails, setEmails] = useState<Map<string, string>>(new Map())
  const [filter, setFilter] = useState<SavvyKind | 'all'>('all')
  const [query, setQuery] = useState('')
  const [opening, setOpening] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [reloading, setReloading] = useState(false)

  const load = useCallback(async () => {
    if (!teamId || !supabase) return
    setReloading(true)
    try {
      const [list, members] = await Promise.all([
        listProjects(teamId),
        supabase.from('team_members').select('user_id, email').eq('team_id', teamId),
      ])
      setProjects(list)
      setEmails(
        new Map(
          ((members.data ?? []) as { user_id: string; email: string }[]).map((m) => [
            m.user_id,
            m.email,
          ]),
        ),
      )
      setError(null)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught))
    } finally {
      setReloading(false)
    }
  }, [teamId])

  // Fresh each time Home is shown, and after any save or delete.
  useEffect(() => {
    if (!active || status !== 'signed-in') return
    const timer = setTimeout(() => void load(), 0)
    window.addEventListener(PROJECTS_CHANGED, load)
    return () => {
      clearTimeout(timer)
      window.removeEventListener(PROJECTS_CHANGED, load)
    }
  }, [active, status, load])

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (projects ?? []).filter(
      (p) => (filter === 'all' || p.kind === filter) && (!q || p.name.toLowerCase().includes(q)),
    )
  }, [projects, filter, query])

  const open = async (project: CloudProject) => {
    setOpening(project.id)
    setError(null)
    try {
      await openCloudProject(project)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The project could not be opened.')
    } finally {
      setOpening(null)
    }
  }
  const rename = async (project: CloudProject) => {
    const name = window.prompt('Rename project', project.name)?.trim()
    if (!name || name === project.name) return
    try {
      await renameCloudProject(project, name)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught))
    }
  }
  const remove = async (project: CloudProject) => {
    if (!window.confirm(`Delete “${project.name}” for everyone in ${team?.name}?`)) return
    try {
      await deleteCloudProject(project)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught))
    }
  }
  const canDelete = (p: CloudProject) =>
    p.createdBy === user?.id || team?.role === 'owner' || team?.role === 'admin'
  const who = (id: string | null) =>
    !id ? '' : id === user?.id ? 'you' : (emails.get(id)?.split('@')[0] ?? 'a teammate')
  const first = (user?.email ?? '').split('@')[0]

  return (
    <div className="workspace-root home-root" data-active={active}>
      <TopBar
        actions={
          <MenuButton
            label="New project"
            className="button primary topbar-primary"
            align="end"
            items={KINDS.map((k) => ({
              label: k.create,
              Icon: k.Icon,
              hint: k.lead,
              onSelect: () => requestNewSavvy(k.kind),
            }))}
          >
            <Plus size={18} aria-hidden="true" />
            <span className="label">New</span>
          </MenuButton>
        }
      >
        <h1 className="topbar-title">Home</h1>
        {team && <span className="team-account">{team.name}</span>}
      </TopBar>
      <main className="apps-home home-main" aria-labelledby="home-title">
        <div className="home-inner">
          <header className="home-intro">
            <h2 id="home-title">{first ? `Welcome back, ${first}` : 'Welcome back'}</h2>
            <p>Start something new, or pick up where your team left off.</p>
          </header>

          <ul className="home-starts" aria-label="Start a new project">
            {KINDS.map((k) => (
              <li key={k.kind}>
                <button className="app-card home-start" onClick={() => requestNewSavvy(k.kind)}>
                  <span className={`app-icon ${k.tone}`} aria-hidden="true">
                    <k.Icon size={22} />
                  </span>
                  <span className="app-text">
                    <strong>{k.create}</strong>
                    <span>{k.lead}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>

          <section aria-labelledby="home-recent-title">
            <div className="home-toolbar">
              <h3 id="home-recent-title">Recent projects</h3>
              <div className="segmented home-filter" role="group" aria-label="Show">
                {(['all', ...KINDS.map((k) => k.kind)] as const).map((k) => (
                  <button
                    key={k}
                    type="button"
                    className={filter === k ? 'active' : undefined}
                    aria-pressed={filter === k}
                    onClick={() => setFilter(k)}
                  >
                    {k === 'all' ? 'All' : KIND[k].label}
                  </button>
                ))}
              </div>
              <div className="search-field home-search">
                <Search size={16} className="search-field-icon" aria-hidden="true" />
                <input
                  type="search"
                  placeholder="Search projects"
                  aria-label="Search projects"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                {query && (
                  <button
                    type="button"
                    className="icon-button sm"
                    aria-label="Clear search"
                    onClick={() => setQuery('')}
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
              <button
                type="button"
                className="icon-button"
                aria-label="Refresh"
                title="Refresh"
                disabled={reloading}
                onClick={() => void load()}
              >
                <RefreshCw size={16} className={reloading ? 'spin' : undefined} />
              </button>
            </div>

            {error && (
              <p className="alert alert-danger" role="alert">
                {error}
              </p>
            )}

            {projects === null ? (
              <div className="empty-state">
                <LoaderCircle size={32} className="spin" aria-label="Loading projects" />
              </div>
            ) : shown.length === 0 ? (
              <div className="empty-state">
                <FolderOpen size={48} aria-hidden="true" />
                <strong>{projects.length ? 'No projects match' : 'No projects yet'}</strong>
                <span>
                  {projects.length
                    ? 'Try another name or show every kind.'
                    : `Make something and choose “Save to ${team?.name ?? 'your team'}” in its menu (or press ⌘ S): it shows up here for the whole team.`}
                </span>
              </div>
            ) : (
              <ul className="project-grid">
                {shown.map((p) => {
                  const k = KIND[p.kind]
                  const by = who(p.updatedBy ?? p.createdBy)
                  return (
                    <li key={p.id} className="project-card">
                      <button
                        type="button"
                        className="project-card-main"
                        onClick={() => void open(p)}
                        disabled={opening !== null}
                        aria-label={`Open ${p.name}, ${k.label}`}
                      >
                        <span className="project-thumb">
                          {p.thumbUrl ? (
                            <img src={p.thumbUrl} alt="" loading="lazy" decoding="async" />
                          ) : (
                            <span className={`app-icon ${k.tone}`} aria-hidden="true">
                              <k.Icon size={22} />
                            </span>
                          )}
                          {opening === p.id && (
                            <span className="project-opening">
                              <LoaderCircle size={20} className="spin" aria-label="Opening" />
                            </span>
                          )}
                        </span>
                        <span className="project-text">
                          <strong title={p.name}>{p.name}</strong>
                          <span>
                            <k.Icon size={12} aria-hidden="true" /> {k.label} · {ago(p.updatedAt)}
                            {by ? ` by ${by}` : ''}
                          </span>
                        </span>
                      </button>
                      <MenuButton
                        label={`More for ${p.name}`}
                        className="icon-button sm project-more"
                        align="end"
                        items={[
                          { label: 'Open', Icon: FolderOpen, onSelect: () => void open(p) },
                          { label: 'Rename', Icon: PencilLine, onSelect: () => void rename(p) },
                          ...(canDelete(p)
                            ? [
                                'separator' as const,
                                {
                                  label: 'Delete',
                                  Icon: Trash2,
                                  danger: true,
                                  onSelect: () => void remove(p),
                                },
                              ]
                            : []),
                        ]}
                      >
                        <MoreHorizontal size={16} />
                      </MenuButton>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
        </div>
      </main>
    </div>
  )
}
