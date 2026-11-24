import { useSyncExternalStore } from 'react'

/** Qualidade das cenas 3D. "low" é o padrão: cena estática, só redesenha quando você interage. "off" desliga o WebGL. */
export type Quality = 'high' | 'low' | 'off'
const KEY = 'hidro.quality'

function read(): Quality {
  try {
    const v = localStorage.getItem(KEY)
    if (v === 'high' || v === 'low' || v === 'off') return v
  } catch { /* sem storage */ }
  return 'low'
}

let current: Quality = read()
const subs = new Set<() => void>()
const apply = () => { if (typeof document !== 'undefined') document.documentElement.dataset.quality = current }
apply()

export function setQuality(q: Quality) {
  current = q
  try { localStorage.setItem(KEY, q) } catch { /* ignora */ }
  apply()
  subs.forEach((f) => f())
}

export const getQuality = () => current

export const useQuality = () =>
  useSyncExternalStore((cb) => { subs.add(cb); return () => { subs.delete(cb) } }, () => current)

/**
 * Parâmetros por nível.
 * low  : cena estática (fps 0) — não gasta GPU parada, só desenha ao arrastar/zoom.
 * high : animada (água com reflexo, chuva, rotação) com troca automática para "low" se ficar lenta.
 */
export const PRESET = {
  low: { dpr: 1, seg: 56, trees: 240, village: 7, rain: 380, mirror: 0, fps: 0, env: false, aa: false, spin: false },
  high: { dpr: 1.35, seg: 110, trees: 650, village: 12, rain: 1100, mirror: 256, fps: 24, env: true, aa: true, spin: true },
} as const
