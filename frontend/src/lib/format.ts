import { format } from 'date-fns'

export const num = (v: number | null | undefined, digits = 2) =>
  v == null ? '—' : v.toLocaleString('pt-BR', { minimumFractionDigits: digits, maximumFractionDigits: digits })

export const stamp = (iso?: string | null) => (iso ? format(new Date(iso), 'dd/MM/yyyy • HH:mm') : '—')
export const hour = (iso: string) => format(new Date(iso), "HH'h'")
export const dayHour = (iso: string) => format(new Date(iso), 'dd/MM HH:mm')
