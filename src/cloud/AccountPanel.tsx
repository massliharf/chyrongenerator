import { useState, type FormEvent } from 'react'
import { KeyRound, LoaderCircle, LogOut, Mail, Trash2 } from 'lucide-react'
import { MEDIA_BUCKET, appUrl, supabase } from './client'
import { PROJECT_BUCKET } from './projects'
import { useCloud } from './useCloud'

const message = (error: unknown) => (error instanceof Error ? error.message : String(error))

/** Removes paths from a bucket in batches (Storage takes up to 1000 at once). */
async function removeAll(bucket: string, paths: string[]) {
  if (!supabase) return
  for (let i = 0; i < paths.length; i += 900)
    await supabase.storage.from(bucket).remove(paths.slice(i, i + 900))
}

/** Your account: email, password, sessions, and deleting it. */
export function AccountPanel() {
  const cloud = useCloud()
  const { user, teams } = cloud
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [again, setAgain] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const owned = teams.filter((t) => t.role === 'owner')

  const run = async (what: string, change: () => Promise<string | void>) => {
    setBusy(what)
    setError(null)
    setNotice(null)
    try {
      const done = await change()
      if (done) setNotice(done)
    } catch (caught) {
      setError(message(caught))
    } finally {
      setBusy(null)
    }
  }

  const changeEmail = (event: FormEvent) => {
    event.preventDefault()
    const next = email.trim().toLowerCase()
    if (!supabase || !next) return
    const client = supabase
    void run('email', async () => {
      const { error } = await client.auth.updateUser({ email: next }, { emailRedirectTo: appUrl() })
      if (error) throw error
      setEmail('')
      return `Check ${next} (and your current inbox): the change happens once you confirm it.`
    })
  }

  const changePassword = (event: FormEvent) => {
    event.preventDefault()
    if (!supabase) return
    if (password !== again) {
      setError('The two passwords are different.')
      return
    }
    const client = supabase
    void run('password', async () => {
      const { error } = await client.auth.updateUser({ password })
      if (error) throw error
      setPassword('')
      setAgain('')
      return 'Password changed. Use it the next time you sign in.'
    })
  }

  const signOutEverywhere = () => {
    if (!supabase) return
    const client = supabase
    void run('sessions', async () => {
      const { error } = await client.auth.signOut({ scope: 'global' })
      if (error) throw error
    })
  }

  const deleteAccount = (event: FormEvent) => {
    event.preventDefault()
    if (!supabase || !user || confirm.trim().toLowerCase() !== user.email?.toLowerCase()) return
    const client = supabase
    const me = user.id
    void run('delete', async () => {
      // Files first: the rows that point at them go with the account.
      const ownedIds = new Set(owned.map((t) => t.id))
      const media = await client.from('media').select('storage_path, team_id, uploaded_by')
      const projects = await client
        .from('projects')
        .select('storage_path, thumb_path, team_id, created_by')
      if (media.error) throw media.error
      if (projects.error) throw projects.error
      await removeAll(
        MEDIA_BUCKET,
        (media.data ?? [])
          .filter((m) => ownedIds.has(m.team_id) || m.uploaded_by === me)
          .map((m) => m.storage_path as string),
      )
      await removeAll(
        PROJECT_BUCKET,
        (projects.data ?? [])
          .filter((p) => ownedIds.has(p.team_id) || p.created_by === me)
          .flatMap((p) => [
            p.storage_path as string,
            ...(p.thumb_path ? [p.thumb_path as string] : []),
          ]),
      )
      const { error } = await client.rpc('delete_my_account')
      if (error) throw error
      await client.auth.signOut({ scope: 'local' })
    })
  }

  return (
    <div className="team-details">
      <div className="page-header">
        <h2 id="team-title">Account</h2>
        <span>{user?.email}</span>
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

      <section className="team-section" aria-labelledby="account-email-title">
        <h3 id="account-email-title">Email</h3>
        <p className="team-section-lead">
          You sign in with <strong>{user?.email}</strong>. Invitations to teams go to this address.
        </p>
        <form className="team-inline-form" onSubmit={changeEmail}>
          <label className="field">
            <span className="field-label">New email</span>
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <button
            type="submit"
            className="button outline"
            disabled={busy !== null || !email.trim()}
          >
            {busy === 'email' ? (
              <LoaderCircle size={16} className="spin" aria-hidden="true" />
            ) : (
              <Mail size={16} aria-hidden="true" />
            )}
            <span>Change email</span>
          </button>
        </form>
      </section>

      <section className="team-section" aria-labelledby="account-password-title">
        <h3 id="account-password-title">Password</h3>
        <form className="team-inline-form" onSubmit={changePassword}>
          <label className="field">
            <span className="field-label">New password</span>
            <input
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          <label className="field">
            <span className="field-label">Repeat it</span>
            <input
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={again}
              onChange={(e) => setAgain(e.target.value)}
            />
          </label>
          <button
            type="submit"
            className="button outline"
            disabled={busy !== null || password.length < 8 || !again}
          >
            {busy === 'password' ? (
              <LoaderCircle size={16} className="spin" aria-hidden="true" />
            ) : (
              <KeyRound size={16} aria-hidden="true" />
            )}
            <span>Change password</span>
          </button>
        </form>
        <span className="field-hint">At least 8 characters.</span>
      </section>

      <section className="team-section" aria-labelledby="account-sessions-title">
        <h3 id="account-sessions-title">Sessions</h3>
        <p className="team-section-lead">
          Signed in on a shared computer, or lost a device? Sign out everywhere, this browser
          included.
        </p>
        <div className="team-form-actions">
          <button type="button" className="button outline" onClick={() => void cloud.signOut()}>
            <LogOut size={16} aria-hidden="true" />
            <span>Sign out</span>
          </button>
          <button
            type="button"
            className="button outline"
            disabled={busy !== null}
            onClick={signOutEverywhere}
          >
            {busy === 'sessions' && <LoaderCircle size={16} className="spin" aria-hidden="true" />}
            <span>Sign out on every device</span>
          </button>
        </div>
      </section>

      <section className="team-section" aria-labelledby="account-delete-title">
        <h3 id="account-delete-title">Delete account</h3>
        <p className="team-section-lead">
          Deletes your account for good: you leave every team, and the media and projects you added
          go with it.
          {owned.length > 0 &&
            ` You own ${owned.map((t) => t.name).join(', ')}: ${owned.length === 1 ? 'that team is' : 'those teams are'} deleted for everyone, with all ${owned.length === 1 ? 'its' : 'their'} media and projects.`}{' '}
          This can’t be undone.
        </p>
        <form className="team-inline-form" onSubmit={deleteAccount}>
          <label className="field">
            <span className="field-label">Type your email to confirm</span>
            <input
              type="email"
              autoComplete="off"
              placeholder={user?.email}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </label>
          <button
            type="submit"
            className="button outline danger-text"
            disabled={busy !== null || confirm.trim().toLowerCase() !== user?.email?.toLowerCase()}
          >
            {busy === 'delete' ? (
              <LoaderCircle size={16} className="spin" aria-hidden="true" />
            ) : (
              <Trash2 size={16} aria-hidden="true" />
            )}
            <span>Delete my account</span>
          </button>
        </form>
      </section>
    </div>
  )
}
