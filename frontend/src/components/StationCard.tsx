import { motion } from 'framer-motion'
import { ArrowRight, CloudRain, MapPin, Trash2, Waves } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { Station } from '../lib/api'
import { num, stamp } from '../lib/format'
import { useSummary } from '../lib/hooks'
import { photo } from '../lib/useCountUp'
import Tilt from './Tilt'

export default function StationCard({ station, index, order = index, onDelete }: {
  station: Station; index: number; order?: number; onDelete?: () => void
}) {
  const { data } = useSummary(station.id)
  const last = data?.latest.level?.observed_at ?? data?.latest.rain?.observed_at
  const empty = data && !data.latest.level && !data.latest.rain
  return (
    <Tilt>
      <motion.article
        className="station-card"
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: Math.min(0.05 * order, 0.3), duration: 0.35, ease: 'easeOut' }}
      >
        <div className="photo">
          <img src={photo(index)} alt={`Rio em ${station.municipality}`} loading="lazy" decoding="async" />
          <span className="code">{station.id}</span>
          <span className={`status ${empty ? 'idle' : ''}`}><i /> {empty ? 'Sem leituras' : 'Ativa'}</span>
          {onDelete && <button className="del" onClick={onDelete} aria-label={`Excluir ${station.name}`}><Trash2 size={16} /></button>}
        </div>
        <div className="sc-body">
          <h3>{station.name}</h3>
          <p className="loc"><MapPin size={15} fill="currentColor" /> {station.river} <span>·</span> {station.municipality}</p>
          <div className="sc-stats">
            <div><Waves size={16} /><small>Nível</small><b>{data?.latest.level ? `${num(data.latest.level.value)} m` : '—'}</b></div>
            <div><CloudRain size={16} /><small>Chuva</small><b>{data?.latest.rain ? `${num(data.latest.rain.value, 1)} mm/h` : '—'}</b></div>
          </div>
          <p className="sc-time">{last ? `Última leitura: ${stamp(last)}` : 'Nenhuma leitura registrada'}</p>
          <Link to={`/estacoes/${station.id}`} className="btn-dark">Ver Detalhes <ArrowRight size={16} /></Link>
        </div>
      </motion.article>
    </Tilt>
  )
}
