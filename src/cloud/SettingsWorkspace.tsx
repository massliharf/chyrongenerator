import { useCallback, useEffect, useState, type FormEvent } from 'react'
import {
  LoaderCircle,
  LogOut,
  Mail,
  Plus,
  Smartphone,
  Trash2,
  UserRound,
  Users,
  X,
} from 'lucide-react'
import { AccountPanel } from './AccountPanel'
import { TopBar } from '../components/TopBar'
import { appUrl, supabase, type TeamRole } from './client'
import { useCloud } from './useCloud'

interface Member {
  user_id: string
  email: string
  role: TeamRole
}
interface Invite {
  id: string
  email: string
  role: Exclude<TeamRole, 'owner'>
}

const ROLE_LABEL: Record<TeamRole, string> = { owner: 'Owner', admin: 'Admin', member: 'Member' }
const message = (error: unknown) => (error instanceof Error ? error.message : String(error))

type View = 'account' | 'team' | 'new' | 'prototype'

/**
 * Settings: your profile and security, the teams you belong to (members and
 * invitations), and the mobile prototype of the design system. Without a
 * Supabase project only the prototype is here.
 */
export default function SettingsWorkspace({ active }: { active: boolean }) {
  const cloud = useCloud()
  const { team, teams, user } = cloud
  const signedIn = cloud.status === 'signed-in'
  const [chosen, setView] = useState<View>('account')
  const view: View = signedIn ? chosen : 'prototype'
  // The prototype loads on first view and then stays, so its unlock is kept.
  const [prototypeShown, setPrototypeShown] = useState(view === 'prototype')
  if (view === 'prototype' && !prototypeShown) setPrototypeShown(true)

  const item = (id: View, label: string, Icon: typeof UserRound) => (
    <li>
      <button
        type="button"
        className="gallery-category"
        aria-current={view === id ? 'true' : undefined}
        onClick={() => setView(id)}
      >
        <span className="team-nav-label">
          <Icon size={16} aria-hidden="true" /> {label}
        </span>
      </button>
    </li>
  )

  return (
    <div className="workspace-root team-root" data-active={active}>
      <TopBar
        actions={
          signedIn && (
            <button type="button" className="button ghost" onClick={() => void cloud.signOut()}>
              <LogOut size={16} aria-hidden="true" />
              <span className="label">Sign out</span>
            </button>
          )
        }
      >
        <h1 className="topbar-title">Settings</h1>
        {signedIn && (
          <span className="team-account" title={user?.email ?? undefined}>
            {user?.email}
          </span>
        )}
      </TopBar>
      <div className="workspace-body gallery-body">
        <nav className="gallery-categories" aria-label="Settings">
          {signedIn && (
            <>
              <span className="gallery-categories-title" aria-hidden="true">
                Account
              </span>
              <ul>{item('account', 'Profile & security', UserRound)}</ul>
              <span className="gallery-categories-title team-nav-heading" aria-hidden="true">
                Your teams
              </span>
              <ul>
                {teams.map((t) => (
                  <li key={t.id}>
                    <button
                      type="button"
                      className="gallery-category"
                      aria-current={view === 'team' && team?.id === t.id ? 'true' : undefined}
                      onClick={() => {
                        cloud.selectTeam(t.id)
                        setView('team')
                      }}
                    >
                      <span>{t.name}</span>
                      <span className="count">{ROLE_LABEL[t.role]}</span>
                    </button>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                className="button ghost full team-new"
                onClick={() => setView('new')}
              >
                <Plus size={16} aria-hidden="true" />
                <span>New team</span>
              </button>
            </>
          )}
          <span
            className={`gallery-categories-title ${signedIn ? 'team-nav-heading' : ''}`}
            aria-hidden="true"
          >
            Design system
          </span>
          <ul>{item('prototype', 'Mobile prototype', Smartphone)}</ul>
        </nav>
        <main
          className={`gallery-main team-main ${view === 'prototype' ? 'is-prototype' : ''}`}
          aria-labelledby={view === 'prototype' ? undefined : 'team-title'}
          aria-label={view === 'prototype' ? 'Mobile prototype' : undefined}
        >
          {/* The design system’s mobile prototype. */}
          {prototypeShown && (
            <iframe
              className="demo-frame"
              title="Mobile prototype"
              hidden={view !== 'prototype'}
              src={`${import.meta.env.BASE_URL}designsystemcheck/index.html`}
            />
          )}
          {view === 'account' ? (
            <AccountPanel />
          ) : view === 'prototype' ? null : view === 'new' || !team ? (
            <CreateTeam
              first={teams.length === 0}
              onCancel={teams.length ? () => setView('team') : undefined}
              onCreated={() => setView('team')}
            />
          ) : (
            <TeamDetails key={team.id} />
          )}
        </main>
      </div>
    </div>
  )
}

function CreateTeam({
  first,
  onCancel,
  onCreated,
}: {
  first: boolean
  onCancel?: () => void
  onCreated: () => void
}) {
  const { createTeam } = useCloud()
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (busy || !name.trim()) return
    setBusy(true)
    setError(null)
    try {
      await createTeam(name.trim())
      onCreated()
    } catch (caught) {
      setError(message(caught))
    } finally {
      setBusy(false)
    }
  }
  return (
    <section className="team-create">
      <Users size={40} aria-hidden="true" />
      <h2 id="team-title">{first ? 'Create your first team' : 'New team'}</h2>
      <p>
        A team shares one media library: everything uploaded to its Media gallery is there for every
        member, on any device.
        {first &&
          ' Waiting for an invitation? Sign in with the address it went to and it appears here.'}
      </p>
      <form className="team-inline-form" onSubmit={(e) => void submit(e)}>
        <label className="field">
          <span className="field-label">Team name</span>
          <input
            value={name}
            maxLength={80}
            required
            placeholder="e.g. Morning show"
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <div className="team-form-actions">
          {onCancel && (
            <button type="button" className="button outline" onClick={onCancel}>
              Cancel
            </button>
          )}
          <button type="submit" className="button primary" disabled={busy || !name.trim()}>
            {busy && <LoaderCircle size={16} className="spin" aria-hidden="true" />}
            <span>Create team</span>
          </button>
        </div>
      </form>
      {error && (
        <p className="alert alert-danger" role="alert">
          {error}
        </p>
      )}
    </section>
  )
}

function TeamDetails() {
  const cloud = useCloud()
  const team = cloud.team!
  const me = cloud.user?.id
  const isAdmin = team.role === 'owner' || team.role === 'admin'
  const [members, setMembers] = useState<Member[]>([])
  const [invites, setInvites] = useState<Invite[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [name, setName] = useState(team.name)
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<Invite['role']>('member')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    if (!supabase) return
    const [m, i] = await Promise.all([
      supabase
        .from('team_members')
        .select('user_id, email, role')
        .eq('team_id', team.id)
        .order('created_at'),
      isAdmin
        ? supabase
            .from('team_invites')
            .select('id, email, role')
            .eq('team_id', team.id)
            .order('created_at')
        : Promise.resolve({ data: [], error: null }),
    ])
    setLoading(false)
    if (m.error || i.error) {
      setError(message(m.error ?? i.error))
      return
    }
    setMembers((m.data ?? []) as Member[])
    setInvites((i.data ?? []) as Invite[])
  }, [team.id, isAdmin])

  useEffect(() => {
    const timer = setTimeout(() => void load(), 0)
    return () => clearTimeout(timer)
  }, [load])

  /** Runs one change, shows its error, then reloads the lists. */
  const run = async (change: () => PromiseLike<{ error: unknown }>, done?: string) => {
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      const { error } = await change()
      if (error) throw error
      if (done) setNotice(done)
      await load()
    } catch (caught) {
      setError(message(caught))
    } finally {
      setBusy(false)
    }
  }

  const invite = async (event: FormEvent) => {
    event.preventDefault()
    const address = email.trim().toLowerCase()
    if (!supabase || !address) return
    if (members.some((m) => m.email === address)) {
      setError(`${address} is already in ${team.name}.`)
      return
    }
    const client = supabase
    await run(async () => {
      const added = await client
        .from('team_invites')
        .upsert({ team_id: team.id, email: address, role }, { onConflict: 'team_id,email' })
      if (added.error) return added
      // A sign-in link from Supabase Auth: following it signs them in and they join the team.
      await client.auth.signInWithOtp({ email: address, options: { emailRedirectTo: appUrl() } })
      return { error: null }
    }, `Invited ${address}. They join ${team.name} when they sign in with that address.`)
    setEmail('')
  }

  const rename = (event: FormEvent) => {
    event.preventDefault()
    const next = name.trim()
    if (!supabase || !next || next === team.name) return
    const client = supabase
    void run(async () => {
      const result = await client.from('teams').update({ name: next }).eq('id', team.id)
      if (!result.error) await cloud.refreshTeams()
      return result
    }, 'Team renamed.')
  }

  const leave = async () => {
    if (!supabase || !me) return
    if (!window.confirm(`Leave ${team.name}? Its media stays with the team.`)) return
    const { error } = await supabase
      .from('team_members')
      .delete()
      .eq('team_id', team.id)
      .eq('user_id', me)
    if (error) setError(message(error))
    else await cloud.refreshTeams()
  }

  const deleteTeam = async () => {
    if (!supabase) return
    if (
      !window.confirm(
        `Delete ${team.name} for everyone? Its member list goes, and so does its media library.`,
      )
    )
      return
    const client = supabase
    // Storage files first: the table rows only point at them.
    const { data } = await client.from('media').select('storage_path').eq('team_id', team.id)
    const paths = (data ?? []).map((row: { storage_path: string }) => row.storage_path)
    if (paths.length) await client.storage.from('team-media').remove(paths)
    const { error } = await client.from('teams').delete().eq('id', team.id)
    if (error) setError(message(error))
    else await cloud.refreshTeams()
  }

  return (
    <div className="team-details">
      <div className="page-header">
        <h2 id="team-title">{team.name}</h2>
        <span>
          {loading
            ? 'Loading…'
            : `${members.length} ${members.length === 1 ? 'member' : 'members'}`}{' '}
          · You are {ROLE_LABEL[team.role].toLowerCase()}
        </span>
      </div>

      {error && (
        <p className="alert alert-danger" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="alert alert-success" role="status">
          {notice}
        </p>
      )}

      {isAdmin && (
        <section className="team-section" aria-labelledby="team-invite-title">
          <h3 id="team-invite-title">Invite people</h3>
          <p className="team-section-lead">
            They get an email with a sign-in link and join as soon as they sign in with that
            address.
          </p>
          <form className="team-inline-form" onSubmit={(e) => void invite(e)}>
            <label className="field">
              <span className="field-label">Email</span>
              <input
                type="email"
                required
                value={email}
                placeholder="name@example.com"
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            <label className="field team-role-field">
              <span className="field-label">Role</span>
              <select value={role} onChange={(e) => setRole(e.target.value as Invite['role'])}>
                <option value="member">Member</option>
                <option value="admin">Admin</option>
              </select>
            </label>
            <button type="submit" className="button primary" disabled={busy || !email.trim()}>
              <Mail size={16} aria-hidden="true" />
              <span>Invite</span>
            </button>
          </form>
          {invites.length > 0 && (
            <ul className="team-list" aria-label="Pending invitations">
              {invites.map((inv) => (
                <li key={inv.id}>
                  <span className="team-avatar is-pending" aria-hidden="true">
                    <Mail size={14} />
                  </span>
                  <span className="team-person">
                    <strong>{inv.email}</strong>
                    <span>Invited · {ROLE_LABEL[inv.role]}</span>
                  </span>
                  <button
                    type="button"
                    className="icon-button danger"
                    aria-label={`Cancel the invitation for ${inv.email}`}
                    title="Cancel invitation"
                    disabled={busy}
                    onClick={() =>
                      void run(() => supabase!.from('team_invites').delete().eq('id', inv.id))
                    }
                  >
                    <X size={16} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <section className="team-section" aria-labelledby="team-members-title">
        <h3 id="team-members-title">Members</h3>
        {loading ? (
          <LoaderCircle size={20} className="spin" aria-label="Loading members" />
        ) : (
          <ul className="team-list">
            {members.map((member) => {
              const self = member.user_id === me
              const canRemove = !self && isAdmin && member.role !== 'owner'
              return (
                <li key={member.user_id}>
                  <span className="team-avatar" aria-hidden="true">
                    {member.email.slice(0, 1).toUpperCase()}
                  </span>
                  <span className="team-person">
                    <strong>
                      {member.email}
                      {self && ' (you)'}
                    </strong>
                    {!(team.role === 'owner' && !self && member.role !== 'owner') && (
                      <span>{ROLE_LABEL[member.role]}</span>
                    )}
                  </span>
                  {team.role === 'owner' && !self && member.role !== 'owner' && (
                    <label className="field team-role-field">
                      <span className="sr-only">Role of {member.email}</span>
                      <select
                        value={member.role}
                        disabled={busy}
                        onChange={(e) =>
                          void run(() =>
                            supabase!
                              .from('team_members')
                              .update({ role: e.target.value })
                              .eq('team_id', team.id)
                              .eq('user_id', member.user_id),
                          )
                        }
                      >
                        <option value="member">Member</option>
                        <option value="admin">Admin</option>
                      </select>
                    </label>
                  )}
                  {canRemove && (
                    <button
                      type="button"
                      className="icon-button danger"
                      aria-label={`Remove ${member.email} from the team`}
                      title="Remove from team"
                      disabled={busy}
                      onClick={() => {
                        if (!window.confirm(`Remove ${member.email} from ${team.name}?`)) return
                        void run(() =>
                          supabase!
                            .from('team_members')
                            .delete()
                            .eq('team_id', team.id)
                            .eq('user_id', member.user_id),
                        )
                      }}
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {isAdmin && (
        <section className="team-section" aria-labelledby="team-settings-title">
          <h3 id="team-settings-title">Settings</h3>
          <form className="team-inline-form" onSubmit={rename}>
            <label className="field">
              <span className="field-label">Team name</span>
              <input value={name} maxLength={80} onChange={(e) => setName(e.target.value)} />
            </label>
            <button
              type="submit"
              className="button outline"
              disabled={busy || !name.trim() || name.trim() === team.name}
            >
              Rename
            </button>
          </form>
        </section>
      )}

      <section className="team-section" aria-labelledby="team-leave-title">
        <h3 id="team-leave-title">{team.role === 'owner' ? 'Delete team' : 'Leave team'}</h3>
        <p className="team-section-lead">
          {team.role === 'owner'
            ? 'Removes the team, its members and its whole media library for everyone. This can’t be undone.'
            : 'You lose access to its media library. An admin can invite you again.'}
        </p>
        <div>
          {team.role === 'owner' ? (
            <button
              type="button"
              className="button outline danger-text"
              onClick={() => void deleteTeam()}
            >
              <Trash2 size={16} aria-hidden="true" />
              <span>Delete {team.name}</span>
            </button>
          ) : (
            <button
              type="button"
              className="button outline danger-text"
              onClick={() => void leave()}
            >
              <LogOut size={16} aria-hidden="true" />
              <span>Leave {team.name}</span>
            </button>
          )}
        </div>
      </section>
    </div>
  )
}
