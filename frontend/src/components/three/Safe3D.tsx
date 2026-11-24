import { Box } from 'lucide-react'
import { Component, Suspense, type ReactNode } from 'react'
import { setQuality, useQuality } from '../../lib/quality'
import { webglSupported } from '../../lib/webgl'

class Boundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  componentDidCatch(err: unknown) { console.warn('[3D] cena desativada por erro:', err) }
  render() { return this.state.failed ? this.props.fallback : this.props.children }
}

export const Fallback3D = ({ label = 'Visualização 3D indisponível neste dispositivo.', enable = false }: { label?: string; enable?: boolean }) => (
  <div className="fallback3d">
    <Box size={30} /><span>{label}</span>
    {enable && <button className="btn-ghost" onClick={() => setQuality('low')}>Ativar 3D</button>}
  </div>
)

export const Loading3D = () => (
  <div className="fallback3d"><div className="spinner" /><span>Carregando cena 3D…</span></div>
)

/** Isola qualquer cena 3D: sem WebGL ou com erro, mostra um fallback em vez de quebrar a página. */
export default function Safe3D({ children, fallback }: { children: ReactNode; fallback?: ReactNode }) {
  const q = useQuality()
  const alt = fallback ?? <Fallback3D />
  if (q === 'off') return <>{fallback ?? <Fallback3D label="3D desligado para economizar desempenho." enable />}</>
  if (!webglSupported()) return <>{alt}</>
  return (
    <Boundary fallback={alt}>
      <Suspense fallback={<Loading3D />}>{children}</Suspense>
    </Boundary>
  )
}
