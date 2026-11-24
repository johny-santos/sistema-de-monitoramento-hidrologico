import { Gauge } from 'lucide-react'
import { setQuality, useQuality, type Quality } from '../../lib/quality'

const OPTS: [Quality, string, string][] = [
  ['low', 'Leve', 'Menos detalhes, mais fluido (recomendado)'],
  ['high', 'Alto', 'Mais detalhes, exige mais da placa de vídeo'],
  ['off', 'Off', 'Desliga o 3D e mostra versão simples'],
]

/** Seletor de desempenho: guarda a escolha no navegador. */
export default function QualityToggle() {
  const q = useQuality()
  return (
    <div className="qtoggle" role="group" aria-label="Qualidade do 3D">
      <Gauge size={14} />
      {OPTS.map(([v, label, tip]) => (
        <button key={v} className={q === v ? 'on' : ''} title={tip} aria-pressed={q === v} onClick={() => setQuality(v)}>{label}</button>
      ))}
    </div>
  )
}
