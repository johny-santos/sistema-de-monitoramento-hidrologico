import { motion } from 'framer-motion'
import { BarChart3, Box, CheckCircle2, ChevronLeft, ChevronRight, CloudRain, Droplet, MapPin, Settings, Waves } from 'lucide-react'
import { lazy, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import QualityToggle from '../components/three/QualityToggle'
import Safe3D from '../components/three/Safe3D'
import { LevelChart, NoData, RainChart } from '../components/Charts'
import Logo from '../components/Logo'
import Page, { stagger } from '../components/Page'
import { ErrorBox, Loading } from '../components/States'
import { num, stamp } from '../lib/format'
import { useSeries, useStations, useSummaries } from '../lib/hooks'
import { photo, useCountUp } from '../lib/useCountUp'
import { useTitle } from '../lib/useTitle'

function Count({ value, digits = 0 }: { value: number | null; digits?: number }) {
  const v = useCountUp(value)
  return <>{num(v, digits)}</>
}

const ValleyScene = lazy(() => import('../components/three/ValleyScene'))

export default function Dashboard() {
  useTitle('Início')
  const stations = useStations()
  const list = stations.data ?? []
  const summaries = useSummaries(list.map((s) => s.id))
  const [selectedIdx, setSelectedIdx] = useState(0)
  const idx = list.length ? ((selectedIdx % list.length) + list.length) % list.length : 0
  const selected = list[idx]

  const level = useSeries(selected?.id, 'level', 24)
  const rain = useSeries(selected?.id, 'rain', 24)

  const stats = useMemo(() => {
    const done = summaries.map((q) => q.data).filter((d) => !!d)
    const avg = (vals: number[]) => (vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null)
    const lv = done.flatMap((d) => (d.latest.level ? [d.latest.level.value] : []))
    const rn = done.flatMap((d) => (d.latest.rain ? [d.latest.rain.value] : []))
    const times = done.flatMap((d) => [d.latest.level?.observed_at, d.latest.rain?.observed_at]).filter(Boolean) as string[]
    return { level: avg(lv), rain: avg(rn), updated: times.sort().at(-1) }
  }, [summaries])

  // Chave estável: só recalcula (e só re-renderiza a cena 3D) quando algum nível realmente muda.
  const levelKey = summaries.map((q) => q.data?.latest.level?.value ?? '-').join('|')
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const levels = useMemo(() => Object.fromEntries(list.map((st, i) => [st.id, summaries[i]?.data?.latest.level?.value ?? null])), [list.length, levelKey])

  if (stations.isLoading) return <Page><Loading /></Page>
  if (stations.error) return <Page><ErrorBox error={stations.error} /></Page>

  return (
    <Page>
      <header className="topbar">
        <div className="hello">
          <div className="hello-icon"><Logo size={38} /></div>
          <div>
            <h2><span>Olá, bem-vindo ao</span><b>Sistema de Monitoramento Hidrológico!</b></h2>
            <p>Acompanhe em tempo real os dados das nossas estações.</p>
          </div>
        </div>
        <div className="top-right">
          <div className="pill"><i className="dot" /> Última leitura: {stamp(stats.updated)}</div>
          <Link to="/sobre" className="gear" aria-label="Configurações e sobre"><Settings size={20} /></Link>
        </div>
      </header>

      <section className="kpis">
        <motion.div className="kpi kpi-primary" {...stagger(0)}>
          <div className="kpi-icon"><Waves size={40} strokeWidth={2.2} /></div>
          <div><strong><Count value={list.length} /></strong><span>Estações Ativas</span></div>
        </motion.div>
        <motion.div className="kpi" {...stagger(1)}>
          <div className="kpi-icon soft"><Droplet size={30} fill="currentColor" strokeWidth={0} /></div>
          <div><strong><Count value={stats.level} digits={2} /> m</strong><span>Nível Médio do Rio</span></div>
        </motion.div>
        <motion.div className="kpi" {...stagger(2)}>
          <div className="kpi-icon soft"><CloudRain size={30} fill="currentColor" strokeWidth={0} /></div>
          <div><strong><Count value={stats.rain} digits={1} /> mm/h</strong><span>Chuva Média</span></div>
        </motion.div>
        <motion.div className="kpi kpi-sim" {...stagger(3)}>
          <div className="kpi-icon ok"><CheckCircle2 size={34} /></div>
          <div><strong>Dados Simulados</strong><span>Não representam medições reais</span></div>
        </motion.div>
      </section>

      <motion.section className="card world" {...stagger(4)}>
        <div className="world-head">
          <h3 className="card-title"><Box size={18} /> Vale 3D das estações</h3>
          <QualityToggle />
        </div>
        <Safe3D>
          <ValleyScene
            stations={list} selectedId={selected?.id} levels={levels} rain={Math.round((stats.rain ?? 0) * 10) / 10} height={480}
            onSelect={(id) => setSelectedIdx(Math.max(0, list.findIndex((x) => x.id === id)))}
          />
        </Safe3D>
        <p className="hint tight">Arraste para girar · role para aproximar · clique num pino para selecionar a estação</p>
        <div className="world-legend">
          <span><i className="lg pin" /> Estação</span>
          <span><i className="lg sel" /> Selecionada</span>
          <span><i className="lg rain" /> Chuva: {stats.rain != null && stats.rain > 0 ? `${num(stats.rain, 1)} mm/h (média)` : 'sem chuva'}</span>
          <span className="sim">Cena ilustrativa · dados simulados</span>
        </div>
      </motion.section>

      <section className="grid-dash">
        <motion.div className="card" {...stagger(5)}>
          <h3 className="card-title"><BarChart3 size={18} /> Nível do Rio — Últimas 24h</h3>
          {level.error ? <NoData height={330} text="Não foi possível carregar o gráfico" /> : <LevelChart series={level.data} height={330} />}
        </motion.div>
        <motion.div className="card" {...stagger(5)}>
          <h3 className="card-title"><CloudRain size={18} fill="currentColor" strokeWidth={0} /> Chuva — Últimas 24h</h3>
          {rain.error ? <NoData height={330} text="Não foi possível carregar o gráfico" /> : <RainChart series={rain.data} height={330} />}
        </motion.div>
        <motion.div className="card selected" {...stagger(6)}>
          <h3 className="card-title plain">Estação Selecionada</h3>
          <div className="sel-photo">
            <img key={selected?.id} src={photo(idx)} alt={`Rio em ${selected?.municipality}`} />
          </div>
          <h4>{selected?.name}</h4>
          <p className="loc"><MapPin size={15} fill="currentColor" /> {selected?.river}</p>
          <div className="sel-actions">
            <Link to={`/estacoes/${selected?.id}`} className="btn-dark">Ver Detalhes →</Link>
            <div className="steppers">
              <button onClick={() => setSelectedIdx(idx - 1)} aria-label="Estação anterior"><ChevronLeft size={18} /></button>
              <span>{idx + 1}/{list.length}</span>
              <button onClick={() => setSelectedIdx(idx + 1)} aria-label="Próxima estação"><ChevronRight size={18} /></button>
            </div>
          </div>
        </motion.div>
      </section>
    </Page>
  )
}
