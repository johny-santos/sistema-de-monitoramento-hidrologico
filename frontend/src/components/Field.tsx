import { ChevronDown } from 'lucide-react'
import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react'

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  )
}

export function Select({ label, children, ...rest }: { label: string } & SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <Field label={label}>
      <div className="select">
        <select {...rest}>{children}</select>
        <ChevronDown size={16} />
      </div>
    </Field>
  )
}

/** Seletor compacto com ícone à esquerda (usado nas barras de filtro). */
export function SelectPill({ icon, label, children, ...rest }: { icon: ReactNode; label: string } & SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <label className={`pill-select ${rest.value ? 'has-value' : ''}`} aria-label={label}>
      <span className="ps-icon">{icon}</span>
      <span className="ps-text">
        <small>{label}</small>
        <select {...rest}>{children}</select>
      </span>
      <ChevronDown size={16} className="ps-chev" />
    </label>
  )
}

export function Input({ label, hint, ...rest }: { label: string; hint?: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <Field label={label} hint={hint}>
      <input className="input" {...rest} />
    </Field>
  )
}
