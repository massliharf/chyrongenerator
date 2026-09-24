import { cloneElement, useId, useState } from 'react'
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

/** Preserve incomplete input while typing; clamp only on commit. */
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
  const commit = () => {
    if (draft !== null && draft.trim() && Number.isFinite(Number(draft))) {
      onChange(Math.max(min, Math.min(max, Number(draft))))
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
        if (e.key === 'Enter') e.currentTarget.blur()
        if (e.key === 'Escape') {
          e.preventDefault()
          setDraft(null)
        }
      }}
    />
  )
}

export function Range({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  unit = '',
}: {
  label: string
  value: number
  onChange: (n: number) => void
  min: number
  max: number
  step?: number
  unit?: string
}) {
  const id = useId()
  return (
    <div className="range-field">
      <div className="range-label">
        <label htmlFor={id}>{label}</label>
        <span className="number-wrap">
          <NumberInput label={`${label} value`} {...{ value, onChange, min, max, step }} />
          {unit && <span aria-hidden="true">{unit}</span>}
        </span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-valuetext={`${Number(value.toFixed(2))}${unit ? ` ${unit}` : ''}`}
        onChange={(e) => onChange(Number(e.target.value))}
        style={
          { '--range-progress': `${((value - min) / (max - min)) * 100}%` } as React.CSSProperties
        }
      />
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
