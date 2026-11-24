import { useRef, type ReactNode } from 'react'
import { getQuality } from '../lib/quality'
import { prefersReducedMotion } from '../lib/webgl'

/** Inclinação 3D que segue o mouse. Só no modo Alto (nos outros, não gasta nada). */
export default function Tilt({ children, max = 6, className = '' }: { children: ReactNode; max?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const move = (e: React.MouseEvent) => {
    const el = ref.current
    if (!el || getQuality() !== 'high' || prefersReducedMotion()) return
    const r = el.getBoundingClientRect()
    const px = (e.clientX - r.left) / r.width - 0.5
    const py = (e.clientY - r.top) / r.height - 0.5
    el.style.setProperty('--rx', `${(-py * max).toFixed(2)}deg`)
    el.style.setProperty('--ry', `${(px * max).toFixed(2)}deg`)
  }
  const leave = () => {
    const el = ref.current
    if (!el) return
    el.style.setProperty('--rx', '0deg'); el.style.setProperty('--ry', '0deg')
  }
  return <div ref={ref} className={`tilt ${className}`} onMouseMove={move} onMouseLeave={leave}>{children}</div>
}
