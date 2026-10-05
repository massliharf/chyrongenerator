import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
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
  const [autoAlign, setAutoAlign] = useState<'start' | 'end'>(align)
  const trigger = useRef<HTMLButtonElement>(null)
  const list = useRef<HTMLDivElement>(null)
  const id = useId()
  const close = (refocus = true) => {
    setOpen(false)
    if (refocus) trigger.current?.focus()
  }

  const toggle = () => {
    if (!open && trigger.current) {
      const triggerRect = trigger.current.getBoundingClientRect()
      const container = trigger.current.closest<HTMLElement>(
        '.inspector, .dialog, aside, [data-menu-container]',
      )
      const containerRect = container?.getBoundingClientRect()
      const minLeft = (containerRect ? Math.max(containerRect.left, 0) : 0) + 8
      const maxRight =
        (containerRect ? Math.min(containerRect.right, window.innerWidth) : window.innerWidth) - 8
      const menuWidth = 240

      if (align === 'start') {
        if (triggerRect.left + menuWidth > maxRight && triggerRect.right - menuWidth >= minLeft) {
          setAutoAlign('end')
        } else {
          setAutoAlign('start')
        }
      } else {
        if (triggerRect.right - menuWidth < minLeft && triggerRect.left + menuWidth <= maxRight) {
          setAutoAlign('start')
        } else {
          setAutoAlign('end')
        }
      }
    } else {
      setAutoAlign(align)
    }
    setOpen((prev) => !prev)
  }

  useEffect(() => {
    if (open) list.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus()
  }, [open])

  const effectiveAlign = open ? autoAlign : align

  return (
    <div className={`menu-wrap align-${effectiveAlign} placement-${placement}`}>
      <button
        ref={trigger}
        className={className}
        aria-label={label}
        title={title ?? label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        disabled={disabled}
        onClick={toggle}
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
            onKeyDown={(e) => menuKeys(e, () => close())}
          >
            <MenuItems items={items} onPick={() => close(false)} />
          </div>
        </>
      )}
    </div>
  )
}

/** ↑/↓, Home/End move between items; Escape and Tab close. Enter and Space press the item. */
function menuKeys(e: KeyboardEvent<HTMLElement>, close: () => void) {
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
    close()
  }
  // Keys used inside a menu never reach the editor's shortcuts.
  e.stopPropagation()
}

function MenuItems({ items, onPick }: { items: MenuEntry[]; onPick: () => void }) {
  return items.map((item, i) =>
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
          onPick()
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
  )
}

export type MenuPoint = { x: number; y: number; flipX?: number; flipY?: number }

/**
 * The same menu opened at the pointer (right-click) instead of under a button.
 * Phones show it as an action sheet like every other menu. Focus returns to
 * where it was when the menu closes.
 */
export function ContextMenu({
  at,
  items,
  label,
  title,
  onClose,
}: {
  /**
   * Viewport point the menu opens from. flipX / flipY are the edges it opens
   * from when it has to open to the left or upwards (a button's other side).
   */
  at: MenuPoint
  items: MenuEntry[]
  /** Accessible name of the menu. */
  label: string
  /** Names what the actions apply to, above the items. */
  title?: ReactNode
  onClose: () => void
}) {
  const list = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState(at)
  const opener = useRef<Element | null>(null)
  const dismiss = useRef(onClose)
  useEffect(() => {
    dismiss.current = onClose
  })
  useLayoutEffect(() => {
    const el = list.current
    if (!el) return
    const r = el.getBoundingClientRect()
    // Like system menus: open right and down, or left and up where there is no room.
    const x = at.x + r.width > window.innerWidth - 8 ? (at.flipX ?? at.x) - r.width : at.x
    const y = at.y + r.height > window.innerHeight - 8 ? (at.flipY ?? at.y) - r.height : at.y
    setPos({
      x: Math.max(8, Math.min(x, window.innerWidth - r.width - 8)),
      y: Math.max(8, Math.min(y, window.innerHeight - r.height - 8)),
    })
  }, [at])
  useEffect(() => {
    opener.current = document.activeElement
    list.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus()
    const resize = () => dismiss.current()
    window.addEventListener('resize', resize)
    return () => window.removeEventListener('resize', resize)
  }, [])
  const close = (refocus = true) => {
    onClose()
    if (refocus && opener.current instanceof HTMLElement) opener.current.focus()
  }
  return createPortal(
    <>
      <div
        className="menu-scrim"
        onPointerDown={() => close()}
        onContextMenu={(e) => {
          e.preventDefault()
          close()
        }}
      />
      <div
        ref={list}
        className="menu context-menu"
        role="menu"
        aria-label={label}
        style={{ '--menu-x': `${pos.x}px`, '--menu-y': `${pos.y}px` } as React.CSSProperties}
        onKeyDown={(e) => menuKeys(e, () => close())}
        onContextMenu={(e) => e.preventDefault()}
      >
        {title && <div className="menu-title">{title}</div>}
        <MenuItems items={items} onPick={() => close()} />
      </div>
    </>,
    document.body,
  )
}
