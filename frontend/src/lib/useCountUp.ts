import { useEffect, useState } from 'react'

/** Anima um número de 0 até `target` (easeOutCubic). */
export function useCountUp(target: number | null | undefined, ms = 1100) {
  const [v, setV] = useState(0)
  useEffect(() => {
    if (target == null) return
    let raf = 0
    const t0 = performance.now()
    const tick = (t: number) => {
      const k = Math.min(1, (t - t0) / ms)
      setV(target * (1 - Math.pow(1 - k, 3)))
      if (k < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, ms])
  return target == null ? null : v
}

export const photo = (i: number) => `/img/s${(((i % 5) + 5) % 5) + 1}.jpg`
