import { cloneElement, useId, useRef, useState } from 'react'
import type { ReactElement, ReactNode } from 'react'
import { ChevronDown, RotateCcw } from 'lucide-react'

export function Field({
  label,
  children,
  hint,
}: {
  label: string
  children: ReactNode
  hint?: string
}) {
  const id = useId()
  return (
    <div className="field">
      <label className="field-label" htmlFor={id}>
        {label}
      </label>
      {cloneElement(children as ReactElement<{ id: string; 'aria-describedby'?: string }>, {
        id,
        'aria-describedby': hint ? `${id}-hint` : undefined,
      })}
      {hint && (
        <span id={`${id}-hint`} className="field-hint">
          {hint}
        </span>
      )}
    </div>
  )
}

/**
 * Magnific Number Input. Preserves incomplete input while typing and clamps on
 * commit. ↑/↓ step the value (Shift ×10), Enter commits, Escape reverts.
 */
export function NumberInput({
  value,
  onChange,
  min,
  max,
  step = 1,
  label,
  id,
  disabled = false,
  'aria-describedby': describedBy,
}: {
  value: number
  onChange: (value: number) => void
  min: number
  max: number
  step?: number
  label?: string
  id?: string
  disabled?: boolean
  'aria-describedby'?: string
}) {
  const [draft, setDraft] = useState<string | null>(null)
  const clamp = (n: number) => Math.max(min, Math.min(max, n))
  const round = (n: number) => Number((Math.round(n / step) * step).toFixed(4))
  const commit = () => {
    if (draft !== null && draft.trim() && Number.isFinite(Number(draft))) {
      onChange(clamp(Number(draft)))
    }
    setDraft(null)
  }
  return (
    <input
      id={id}
      aria-label={label}
      aria-describedby={describedBy}
      type="number"
      inputMode="decimal"
      disabled={disabled}
      value={draft ?? Number(value.toFixed(2))}
      min={min}
      max={max}
      step={step}
      onChange={(e) => {
        const next = e.currentTarget.value
        setDraft(next)
        const n = Number(next)
        if (next !== '' && Number.isFinite(n) && n >= min && n <= max) onChange(n)
      }}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
          e.preventDefault()
          const base = draft !== null && Number.isFinite(Number(draft)) ? Number(draft) : value
          const delta = (e.key === 'ArrowUp' ? 1 : -1) * step * (e.shiftKey ? 10 : 1)
          setDraft(null)
          onChange(clamp(round(base + delta)))
        }
        if (e.key === 'Enter') e.currentTarget.blur()
        if (e.key === 'Escape') {
          e.preventDefault()
          setDraft(null)
        }
      }}
    />
  )
}

/**
 * Magnific Number Field — replaces slider + number pairs. The label doubles as a
 * scrub handle (drag left/right, Shift for ×10) for quick coarse changes; the
 * input takes exact values.
 */
export function NumberField({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  unit = '',
  hint,
}: {
  label: string
  value: number
  onChange: (n: number) => void
  min: number
  max: number
  step?: number
  unit?: string
  hint?: string
}) {
  const id = useId()
  const scrub = useRef<{ x: number; value: number; moved: boolean } | null>(null)
  const scrubbed = useRef(false)
  return (
    <div className="number-field">
      <label
        className="number-field-label"
        htmlFor={id}
        title="Drag to adjust · Shift for bigger steps"
        onPointerDown={(e) => {
          if (e.button !== 0) return
          e.currentTarget.setPointerCapture(e.pointerId)
          scrub.current = { x: e.clientX, value, moved: false }
        }}
        onPointerMove={(e) => {
          const s = scrub.current
          if (!s) return
          const dx = e.clientX - s.x
          if (!s.moved && Math.abs(dx) < 3) return
          s.moved = true
          const steps = Math.round(dx / 2) * (e.shiftKey ? 10 : 1)
          const next = Math.max(min, Math.min(max, s.value + steps * step))
          onChange(Number(next.toFixed(4)))
        }}
        onPointerUp={() => {
          scrubbed.current = !!scrub.current?.moved
          scrub.current = null
        }}
        onPointerCancel={() => {
          scrub.current = null
        }}
        onClick={(e) => {
          // A scrub is not a click: keep focus where it was.
          if (scrubbed.current) e.preventDefault()
          scrubbed.current = false
        }}
      >
        {label}
      </label>
      <div className="number-field-control">
        <NumberInput
          id={id}
          aria-describedby={hint ? `${id}-hint` : undefined}
          {...{ value, onChange, min, max, step }}
        />
        {unit && (
          <span className="number-field-unit" aria-hidden="true">
            {unit}
          </span>
        )}
      </div>
      {hint && (
        <span id={`${id}-hint`} className="field-hint">
          {hint}
        </span>
      )}
    </div>
  )
}

export function Toggle({
  label,
  checked,
  onChange,
  hint,
}: {
  label: string
  checked: boolean
  onChange: (value: boolean) => void
  hint?: string
}) {
  const id = useId()
  return (
    <label className="toggle-field">
      <span>
        <span>{label}</span>
        {hint && <small id={`${id}-hint`}>{hint}</small>}
      </span>
      <input
        type="checkbox"
        aria-describedby={hint ? `${id}-hint` : undefined}
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="switch" aria-hidden="true" />
    </label>
  )
}

export function Color({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (value: string) => void
}) {
  const [draft, setDraft] = useState<string | null>(null)
  const [invalid, setInvalid] = useState(false)
  const id = useId()
  const commit = () => {
    if (draft === null) return
    const hex = draft.replace(/^#/, '').trim()
    if (/^([0-9a-f]{3}|[0-9a-f]{6})$/i.test(hex)) {
      onChange(`#${hex.length === 3 ? [...hex].map((c) => c + c).join('') : hex}`.toLowerCase())
      setDraft(null)
      setInvalid(false)
    } else setInvalid(true)
  }
  return (
    <div className="color-field">
      <label className="field-label" htmlFor={id}>
        {label}
      </label>
      <div className={`color-input ${invalid ? 'invalid' : ''}`}>
        <input
          aria-label={`${label} picker`}
          type="color"
          value={value}
          onChange={(e) => {
            onChange(e.target.value)
            setDraft(null)
            setInvalid(false)
          }}
        />
        <input
          id={id}
          aria-label={`${label} hex`}
          type="text"
          spellCheck={false}
          maxLength={7}
          value={draft ?? value.toUpperCase()}
          aria-invalid={invalid}
          aria-describedby={invalid ? `${id}-error` : undefined}
          onChange={(e) => {
            setDraft(e.target.value)
            setInvalid(false)
          }}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit()
            if (e.key === 'Escape') {
              setDraft(null)
              setInvalid(false)
            }
          }}
        />
      </div>
      {invalid && (
        <span id={`${id}-error`} className="field-error" role="alert">
          Use 3 or 6 hex digits.
        </span>
      )}
    </div>
  )
}

export function Section({
  title,
  summary,
  children,
  extra,
  open,
  onToggle,
  onReset,
}: {
  title: string
  summary?: string
  children: ReactNode
  extra?: ReactNode
  open: boolean
  onToggle: () => void
  onReset?: () => void
}) {
  const id = useId()
  return (
    <section className={`control-section ${open ? 'is-open' : ''}`}>
      <div className="section-heading">
        <h3>
          <button
            id={`${id}-heading`}
            className="section-trigger"
            aria-expanded={open}
            aria-controls={`${id}-content`}
            onClick={onToggle}
          >
            <span>
              <span className="section-title">{title}</span>
              {summary && <span className="section-summary">{summary}</span>}
            </span>
            <ChevronDown size={18} aria-hidden="true" />
          </button>
        </h3>
        {open && onReset && (
          <button
            className="icon-button section-reset"
            aria-label={`Reset ${title}`}
            title="Reset to default"
            onClick={onReset}
          >
            <RotateCcw size={16} />
          </button>
        )}
      </div>
      <div
        id={`${id}-content`}
        role="region"
        aria-labelledby={`${id}-heading`}
        hidden={!open}
        className="section-content"
      >
        {extra && <div className="section-actions">{extra}</div>}
        {children}
      </div>
    </section>
  )
}
