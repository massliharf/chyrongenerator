import { useState, type FormEvent, type ReactNode } from 'react'
import { LoaderCircle, Mail } from 'lucide-react'
import logo from '../assets/brand/savvy-logo-96.png'
import { ThemeToggle } from '../components/ThemeToggle'
import { appUrl, supabase } from './client'

type Mode = 'sign-in' | 'sign-up' | 'link' | 'reset'

const TITLES: Record<Mode, { title: string; lead: string; action: string }> = {
  'sign-in': {
    title: 'Sign in to Savvy Editor',
    lead: 'Your team’s media and projects, on every device.',
    action: 'Sign in',
  },
  'sign-up': {
    title: 'Create your account',
    lead: 'Invited to a team? Use the address the invitation went to.',
    action: 'Create account',
  },
  link: {
    title: 'Sign in with an email link',
    lead: 'We send a link that signs you in, no password needed.',
    action: 'Email me a link',
  },
  reset: {
    title: 'Reset your password',
    lead: 'We send a link to choose a new password.',
    action: 'Send reset link',
  },
}

/** Supabase's English errors, in the studio's words where they are common. */
const explain = (message: string) =>
  /invalid login credentials/i.test(message)
    ? 'That email and password don’t match an account.'
    : /email not confirmed/i.test(message)
      ? 'Confirm your email first: open the link we sent you.'
      : /already registered/i.test(message)
        ? 'An account with this email already exists. Sign in instead.'
        : /rate limit/i.test(message)
          ? 'Too many emails in a short time. Try again in a minute.'
          : message

/** Shown in place of the studio until someone signs in (only when the cloud is configured). */
export function AuthScreen() {
  const [mode, setMode] = useState<Mode>('sign-in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState<string | null>(null)
  const copy = TITLES[mode]

  const switchTo = (next: Mode) => {
    setMode(next)
    setError(null)
    setSent(null)
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!supabase || busy) return
    setBusy(true)
    setError(null)
    setSent(null)
    const address = email.trim().toLowerCase()
    try {
      if (mode === 'sign-in') {
        const { error } = await supabase.auth.signInWithPassword({ email: address, password })
        if (error) throw error
      } else if (mode === 'sign-up') {
        const { data, error } = await supabase.auth.signUp({
          email: address,
          password,
          options: { emailRedirectTo: appUrl() },
        })
        if (error) throw error
        if (!data.session)
          setSent(`Check ${address}: open the link we sent to confirm your account.`)
      } else if (mode === 'link') {
        const { error } = await supabase.auth.signInWithOtp({
          email: address,
          options: { emailRedirectTo: appUrl() },
        })
        if (error) throw error
        setSent(`Check ${address}: the link in that email signs you in.`)
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(address, {
          redirectTo: appUrl(),
        })
        if (error) throw error
        setSent(`Check ${address}: the link in that email lets you choose a new password.`)
      }
    } catch (caught) {
      setError(explain(caught instanceof Error ? caught.message : String(caught)))
    } finally {
      setBusy(false)
    }
  }

  const needsPassword = mode === 'sign-in' || mode === 'sign-up'
  return (
    <AuthFrame>
      <header className="auth-header">
        <h1>{copy.title}</h1>
        <p>{copy.lead}</p>
      </header>
      {(mode === 'sign-in' || mode === 'sign-up') && (
        <div className="segmented auth-tabs" role="group" aria-label="Account">
          <button
            type="button"
            className={mode === 'sign-in' ? 'active' : undefined}
            aria-pressed={mode === 'sign-in'}
            onClick={() => switchTo('sign-in')}
          >
            Sign in
          </button>
          <button
            type="button"
            className={mode === 'sign-up' ? 'active' : undefined}
            aria-pressed={mode === 'sign-up'}
            onClick={() => switchTo('sign-up')}
          >
            Create account
          </button>
        </div>
      )}
      <form className="auth-form" onSubmit={(e) => void submit(e)}>
        <label className="field">
          <span className="field-label">Email</span>
          <input
            type="email"
            name="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        {needsPassword && (
          <label className="field">
            <span className="field-label">Password</span>
            <input
              type="password"
              name="password"
              autoComplete={mode === 'sign-up' ? 'new-password' : 'current-password'}
              required
              minLength={mode === 'sign-up' ? 8 : undefined}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            {mode === 'sign-up' && <span className="field-hint">At least 8 characters.</span>}
          </label>
        )}
        {error && (
          <p className="alert alert-danger" role="alert">
            {error}
          </p>
        )}
        {sent && (
          <p className="alert alert-success" role="status">
            {sent}
          </p>
        )}
        <button type="submit" className="button primary lg full" disabled={busy}>
          {busy && <LoaderCircle size={16} className="spin" aria-hidden="true" />}
          <span>{copy.action}</span>
        </button>
      </form>
      <footer className="auth-footer">
        {mode === 'sign-in' && (
          <>
            <button type="button" className="button ghost sm" onClick={() => switchTo('link')}>
              <Mail size={14} aria-hidden="true" />
              <span>Email me a sign-in link</span>
            </button>
            <button type="button" className="button ghost sm" onClick={() => switchTo('reset')}>
              Forgot password?
            </button>
          </>
        )}
        {(mode === 'link' || mode === 'reset') && (
          <button type="button" className="button ghost sm" onClick={() => switchTo('sign-in')}>
            Back to sign in
          </button>
        )}
      </footer>
    </AuthFrame>
  )
}

/** After following a password reset link: choose the new password. */
export function NewPasswordScreen({ onDone }: { onDone: () => void }) {
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!supabase || busy) return
    setBusy(true)
    setError(null)
    const { error } = await supabase.auth.updateUser({ password })
    setBusy(false)
    if (error) setError(explain(error.message))
    else onDone()
  }
  return (
    <AuthFrame>
      <header className="auth-header">
        <h1>Choose a new password</h1>
        <p>You’ll use it the next time you sign in.</p>
      </header>
      <form className="auth-form" onSubmit={(e) => void submit(e)}>
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
          <span className="field-hint">At least 8 characters.</span>
        </label>
        {error && (
          <p className="alert alert-danger" role="alert">
            {error}
          </p>
        )}
        <button type="submit" className="button primary lg full" disabled={busy}>
          {busy && <LoaderCircle size={16} className="spin" aria-hidden="true" />}
          <span>Save password</span>
        </button>
      </form>
    </AuthFrame>
  )
}

/** While the saved session is being restored. */
export function AuthLoading() {
  return (
    <div className="auth-page" aria-busy="true">
      <LoaderCircle size={24} className="spin" aria-label="Loading" />
    </div>
  )
}

function AuthFrame({ children }: { children: ReactNode }) {
  return (
    <div className="auth-page">
      <span className="auth-theme">
        <ThemeToggle />
      </span>
      <main className="auth-card">
        <img
          className="brand-logo auth-logo"
          src={logo}
          alt="Savvy Editor"
          width={40}
          height={40}
        />
        {children}
      </main>
    </div>
  )
}
