import type { LucideIcon } from 'lucide-react'

/* Building blocks shared by every inspector panel. */

export function Chips<T extends string>({
  label,
  items,
  value,
  onChange,
  columns = 4,
}: {
  label: string
  items: { id: T; name: string; Icon: LucideIcon }[]
  value: T
  onChange: (value: T) => void
  columns?: number
}) {
  return (
    <div
      className="chip-grid"
      role="group"
      aria-label={label}
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
    >
      {items.map(({ id, name, Icon }) => (
        <button
          key={id}
          className={value === id ? 'active' : ''}
          aria-pressed={value === id}
          onClick={() => onChange(id)}
        >
          <Icon size={18} aria-hidden="true" />
          <span>{name}</span>
        </button>
      ))}
    </div>
  )
}

export function Segmented<T extends string>({
  label,
  items,
  value,
  onChange,
}: {
  label: string
  items: { id: T; name: string; Icon?: LucideIcon }[]
  value: T
  onChange: (value: T) => void
}) {
  return (
    <div className="segmented" role="group" aria-label={label}>
      {items.map(({ id, name, Icon }) => (
        <button
          key={id}
          className={value === id ? 'active' : ''}
          aria-pressed={value === id}
          aria-label={Icon && !name ? id : undefined}
          onClick={() => onChange(id)}
        >
          {Icon && <Icon size={18} aria-hidden="true" />}
          {name}
        </button>
      ))}
    </div>
  )
}
