import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { Check, type LucideIcon } from 'lucide-react'

export type MenuEntry =
  | {
      label: string
      Icon?: LucideIcon
      onSelect: () => void
      shortcut?: string
      danger?: boolean
      disabled?: boolean
      hint?: string
      /** Renders as a radio item (one of a set). */
      checked?: boolean
    }
  | 'separator'

/**
 * Magnific Menu. A trigger button opens a list of actions. Desktop: popover
 * anchored to the trigger. Below 768px the same list renders as an action sheet
 * (see components.css). Keyboard: ↑/↓, Home/End, Enter, Escape.
 */
export function MenuButton({
  label,
  items,
  children,
  className = 'icon-button',
  align = 'start',
  placement = 'bottom',
  title,
  disabled,
}: {
  /** Accessible name of the trigger. */
  label: string
  items: MenuEntry[]
  /** Visual content of the trigger. */
  children: ReactNode
  className?: string
  align?: 'start' | 'end'
  placement?: 'bottom' | 'top'
  title?: string
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const trigger = useRef<HTMLButtonElement>(null)
  const list = useRef<HTMLDivElement>(null)
  const id = useId()
  const close = (refocus = true) => {
    setOpen(false)
    if (refocus) trigger.current?.focus()
  }
  useEffect(() => {
    if (open) list.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus()
  }, [open])
  return (
    <div className={`menu-wrap align-${align} placement-${placement}`}>
      <button
        ref={trigger}
        className={className}
        aria-label={label}
        title={title ?? label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        disabled={disabled}
        onClick={() => setOpen(!open)}
      >
        {children}
      </button>
      {open && (
        <>
          <button
            type="button"
            className="menu-scrim"
            tabIndex={-1}
            aria-label={`Close ${label}`}
            onClick={() => close()}
          />
          <div
            className="menu"
            id={id}
            role="menu"
            aria-label={label}
            ref={list}
            onKeyDown={(e) => {
              const buttons = Array.from(
                e.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'),
              )
              const index = buttons.indexOf(document.activeElement as HTMLButtonElement)
              let next: number | undefined
              if (e.key === 'ArrowDown') next = (index + 1) % buttons.length
              if (e.key === 'ArrowUp') next = (index + buttons.length - 1) % buttons.length
              if (e.key === 'Home') next = 0
              if (e.key === 'End') next = buttons.length - 1
              if (next !== undefined) {
                e.preventDefault()
                buttons[next]?.focus()
              }
              if (e.key === 'Escape' || e.key === 'Tab') {
                e.preventDefault()
                e.stopPropagation()
                close()
              }
              e.stopPropagation()
            }}
          >
            {items.map((item, i) =>
              item === 'separator' ? (
                <hr key={`sep-${i}`} className="menu-separator" />
              ) : (
                <button
                  key={item.label}
                  type="button"
                  role={item.checked === undefined ? 'menuitem' : 'menuitemradio'}
                  aria-checked={item.checked}
                  className={`menu-item ${item.danger ? 'is-danger' : ''} ${item.checked ? 'is-checked' : ''}`}
                  disabled={item.disabled}
                  onClick={() => {
                    close(false)
                    item.onSelect()
                  }}
                >
                  {item.Icon && <item.Icon size={18} aria-hidden="true" />}
                  <span className="menu-item-text">
                    <span>{item.label}</span>
                    {item.hint && <small>{item.hint}</small>}
                  </span>
                  {item.shortcut && <kbd>{item.shortcut}</kbd>}
                  {item.checked && <Check size={16} className="menu-check" aria-hidden="true" />}
                </button>
              ),
            )}
          </div>
        </>
      )}
    </div>
  )
}
