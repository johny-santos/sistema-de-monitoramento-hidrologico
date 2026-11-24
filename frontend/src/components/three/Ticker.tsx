import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import { setQuality } from '../../lib/quality'

/** Com frameloop="demand", pede um novo quadro a `fps` por segundo (só enquanto ativo e com a aba visível). fps 0 = cena estática. */
export default function Ticker({ fps, active }: { fps: number; active: boolean }) {
  const invalidate = useThree((s) => s.invalidate)
  useEffect(() => {
    if (!active || fps <= 0) return
    const id = setInterval(() => { if (!document.hidden) invalidate() }, 1000 / fps)
    return () => clearInterval(id)
  }, [fps, active, invalidate])
  return null
}

/** Rede de segurança do modo Alto: se o computador não acompanhar, volta sozinho para o modo Leve. */
export function PerfGuard({ enabled }: { enabled: boolean }) {
  const acc = useRef({ t: 0, n: 0, warm: 0 })
  useFrame((_, dt) => {
    if (!enabled) return
    const a = acc.current
    if (a.warm < 12) { a.warm++; return }          // ignora os primeiros quadros (compilação de shaders)
    a.t += Math.min(dt, 1); a.n++
    if (a.n >= 36) {
      if (a.t / a.n > 0.085) setQuality('low')     // média acima de ~85 ms/quadro (≈ 12 fps)
      a.t = 0; a.n = 0
    }
  })
  return null
}
