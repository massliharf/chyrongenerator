import { useEffect, useState } from 'react'
import { Moon, Sun } from 'lucide-react'

type Theme = 'light' | 'dark'
const KEY = 'chyron-studio:theme'
const media = () => window.matchMedia('(prefers-color-scheme: light)')

function current(): Theme {
  const chosen = document.documentElement.dataset.theme
  if (chosen === 'light' || chosen === 'dark') return chosen
  return media().matches ? 'light' : 'dark'
}

/** Light/dark switch. Until someone picks a theme, the app follows the system. */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(current)
  useEffect(() => {
    const sync = () => setTheme(current())
    const query = media()
    query.addEventListener('change', sync)
    // Keep both workspace headers in step.
    window.addEventListener('chyron-theme', sync)
    return () => {
      query.removeEventListener('change', sync)
      window.removeEventListener('chyron-theme', sync)
    }
  }, [])
  const next: Theme = theme === 'dark' ? 'light' : 'dark'
  return (
    <button
      className="icon-button theme-toggle"
      aria-label={`Switch to ${next} mode`}
      title={`Switch to ${next} mode`}
      onClick={() => {
        document.documentElement.dataset.theme = next
        try {
          localStorage.setItem(KEY, next)
        } catch {
          /* The choice still applies for this session. */
        }
        window.dispatchEvent(new Event('chyron-theme'))
      }}
    >
      {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  )
}
