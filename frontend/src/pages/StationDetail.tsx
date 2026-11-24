import { motion } from 'framer-motion'
import { ArrowLeft, Box, ChartLine, CloudRain, TrendingDown, TrendingUp, Waves } from 'lucide-react'
import { lazy, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import QualityToggle from '../components/three/QualityToggle'
import Safe3D from '../components/three/Safe3D'
import { LevelChart, RainChart, StatsStrip } from '../components/Charts'
import Page, { stagger } from '../components/Page'
import { ErrorBox, Loading } from '../components/States'
import type { Metric, Series } from '../lib/api'
import { num, stamp } from '../lib/format'
import { useSeries, useSummary } from '../lib/hooks'
import { useTitle } from '../lib/useTitle'

const RANGES = [12, 24, 48, 72]
const WaterGauge3D = lazy(() => import('../components/three/WaterGauge3D'))
const Chart3D = lazy(() => import('../components/three/Chart3D'))

// Diferença entre as duas últimas leituras válidas da série.
function delta(s?: Series) {
  const v = s?.points.map((p) => p.value).filter((x): x is number => x != null) ?? []
  return v.length >= 2 ? v[v.length - 1] - v[v.length - 2] : null
}

function Delta({ d, unit, digits }: { d: number | null; unit: string; digits: number }) {
  if (d == null) return null
  const up = d >= 0
  const Icon = up ? TrendingUp : TrendingDown
  return (
    <span className={`delta ${up ? 'up' : 'down'}`}>
      <Icon size={14} /> {up ? '+' : ''}{num(d, digits)} {unit}
    </span>
  )
}

export default function StationDetail() {
  const { id } = useParams()
  const [hours, setHours] = useState(24)
  const [metric, setMetric] = useState<Metric>('level')
  const [mode, setMode] = useState<'2d' | '3d'>('2d')
  const summary = useSummary(id)
  useTitle(summary.data?.name ?? `Estação ${id ?? ''}`)
  const level = useSeries(id, 'level', hours)
  const rain = useSeries(id, 'rain', hours)

  if (summary.isLoading) return <Page><Loading /></Page>
  if (summary.error) return <Page><ErrorBox error={summary.error} /></Page>
  const s = summary.data!
  const activeQuery = metric === 'level' ? level : rain
  const active = activeQuery.data

  return (
    <Page>
      <header className="topbar">
        <div className="hello">
          <Link to="/estacoes" className="back" aria-label="Voltar"><ArrowLeft size={20} /></Link>
          <div>
            <h2><b>{s.name}</b> <span className="badge inline"><i /> Ativa</span></h2>
            <p>{s.river} • {s.municipality} • Dados de demonstração</p>
          </div>
        </div>
        <div className="seg">
          {RANGES.map((h) => (
            <button key={h} className={h === hours ? 'on' : ''} onClick={() => setHours(h)}>{h}h</button>
          ))}
        </div>
      </header>

      <div className="detail-top">
        <motion.div className="card gauge-card" {...stagger(0)}>
          <h3 className="card-title"><Box size={18} /> Medidor de nível 3D</h3>
          <Safe3D>
            <WaterGauge3D level={s.latest.level?.value} height={300} />
          </Safe3D>
        </motion.div>
        <section className="kpis stack">
        <motion.div className="kpi wide" {...stagger(0)}>
          <div className="kpi-icon soft"><Waves size={30} /></div>
          <div>
            <span>Nível do Rio</span>
            <strong>{num(s.latest.level?.value)} m</strong>
          </div>
          <Delta d={delta(level.data)} unit="m" digits={2} />
        </motion.div>
        <motion.div className="kpi wide" {...stagger(1)}>
          <div className="kpi-icon soft"><CloudRain size={28} /></div>
          <div>
            <span>Chuva</span>
            <strong>{num(s.latest.rain?.value, 1)} mm/h</strong>
          </div>
          <Delta d={delta(rain.data)} unit="mm/h" digits={1} />
        </motion.div>
        </section>

      </div>

      <motion.section className="card big" {...stagger(2)}>
        <div className="tabs">
          <button className={metric === 'level' ? 'on' : ''} onClick={() => setMetric('level')}><Waves size={16} /> Nível do Rio</button>
          <button className={metric === 'rain' ? 'on' : ''} onClick={() => setMetric('rain')}><CloudRain size={16} /> Chuva</button>
          <div className="seg mode">
            <button className={mode === '2d' ? 'on' : ''} onClick={() => setMode('2d')}><ChartLine size={15} /> 2D</button>
            <button className={mode === '3d' ? 'on' : ''} onClick={() => setMode('3d')}><Box size={15} /> 3D</button>
          </div>
          {mode === '3d' && <QualityToggle />}
          <span className="meta">Última leitura: {stamp(s.latest[metric]?.observed_at)} · {s.observations_count} {s.observations_count === 1 ? 'observação' : 'observações'}</span>
        </div>
        {activeQuery.error ? <ErrorBox error={activeQuery.error} /> : !active ? <Loading /> : active.count === 0
          ? <div className="state">Sem leituras nessa janela.</div>
          : mode === '3d'
            ? <Safe3D fallback={metric === 'level' ? <LevelChart series={active} height={340} /> : <RainChart series={active} height={340} />}>
                <Chart3D series={active} metric={metric} height={400} />
              </Safe3D>
            : metric === 'level' ? <LevelChart series={active} height={340} /> : <RainChart series={active} height={340} />}
        {active && active.count > 0 && <StatsStrip series={active} metric={metric} />}
      </motion.section>
    </Page>
  )
}
