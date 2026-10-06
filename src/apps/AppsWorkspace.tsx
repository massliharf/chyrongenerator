import { useCallback, useEffect, useState } from 'react'
import { ArrowRight, GalleryHorizontalEnd } from 'lucide-react'
import { TopBar } from '../components/TopBar'
import { subscribeSavvyFiles } from '../utils/savvyFile'
import { HeroApp } from './hero/HeroApp'
import { HERO_PICK_EVENT, hasHeroPick } from './hero/handoff'

type AppId = 'hero'
const KEY = 'chyron-studio:app'

const readApp = (): AppId | null => {
  try {
    return localStorage.getItem(KEY) === 'hero' ? 'hero' : null
  } catch {
    return null
  }
}

/**
 * Apps: small tools built on the studio's editors. The launcher lists them;
 * an open app fills the workspace, with a way back to the list.
 */
export default function AppsWorkspace({ active }: { active: boolean }) {
  // A picture sent from the Media gallery opens the generator.
  const [app, setAppState] = useState<AppId | null>(() => (hasHeroPick() ? 'hero' : readApp()))
  const [incoming, setIncoming] = useState<File | null>(null)
  const setApp = (next: AppId | null) => {
    setAppState(next)
    try {
      if (next) localStorage.setItem(KEY, next)
      else localStorage.removeItem(KEY)
    } catch {
      /* Optional preference. */
    }
  }
  // A hero set opened in another editor comes here.
  useEffect(
    () =>
      subscribeSavvyFiles('hero', (file) => {
        setAppState('hero')
        setIncoming(file)
      }),
    [],
  )
  useEffect(() => {
    const open = () => setAppState('hero')
    window.addEventListener(HERO_PICK_EVENT, open)
    return () => window.removeEventListener(HERO_PICK_EVENT, open)
  }, [])
  const done = useCallback(() => setIncoming(null), [])

  if (app === 'hero')
    return (
      <HeroApp
        active={active}
        onBack={() => setApp(null)}
        incoming={incoming}
        onIncomingDone={done}
      />
    )

  return (
    <div className="workspace-root apps-root">
      <TopBar>
        <h1 className="topbar-title">Apps</h1>
      </TopBar>
      <main className="apps-home">
        <div className="apps-intro">
          <h2>Apps</h2>
          <p>Ready-made tools for the things a show needs every week.</p>
        </div>
        <ul className="apps-grid">
          <li>
            <button className="app-card" onClick={() => setApp('hero')}>
              <span className="app-icon is-image" aria-hidden="true">
                <GalleryHorizontalEnd size={24} />
              </span>
              <span className="app-text">
                <strong>Hero image generator</strong>
                <span>
                  Your stream images, upgraded: one host photo framed for the hero image, host card
                  and stream image side by side. Add any size, put text, logos and shapes on top,
                  download the whole set at once.
                </span>
              </span>
              <span className="app-open">
                Open <ArrowRight size={14} aria-hidden="true" />
              </span>
            </button>
          </li>
        </ul>
      </main>
    </div>
  )
}
