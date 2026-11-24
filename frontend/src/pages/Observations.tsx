import { useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import {
  ArrowDown, ArrowRight, ArrowUp, ArrowUpDown, CalendarClock, ChevronLeft, ChevronRight, CloudRain, Database, Download, Filter, Layers,
  MapPin, Plus, SearchX, Table2, Trash2, Waves, X,
} from 'lucide-react'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Input, SelectPill } from '../components/Field'
import Modal from '../components/Modal'
import Page from '../components/Page'
import { ErrorBox, Loading } from '../components/States'
import { api, PAGE_SIZE, type Metric, type Observation, type ObservationFilters } from '../lib/api'
import { useAuth } from '../lib/auth'
import { useFeedback } from '../lib/feedback'
import { useTitle } from '../lib/useTitle'
import { num, stamp } from '../lib/format'
import { useObservations, useStations } from '../lib/hooks'

const UNIT: Record<Metric, string> = { level: 'm', rain: 'mm/h' }
const LABEL: Record<Metric, string> = { level: 'Nível do rio', rain: 'Chuva' }
const toIso = (local: string) => (local ? new Date(local).toISOString() : undefined)
/** Date -> valor aceito por <input type="datetime-local">, no fuso local. */
const toLocalInput = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
const PRESETS: [string, number | null][] = [['Tudo', null], ['Últimas 24h', 24], ['Últimas 48h', 48], ['Últimas 72h', 72]]

const initials = (name: string) => name.replace(/^Esta[çc][ãa]o\s+/i, '').split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase()
const dateParts = (iso: string) => {
  const d = new Date(iso)
  return {
    day: d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }).replace('.', ''),
    time: d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
  }
}

function SortIcon({ ordering, field }: { ordering: string; field: string }) {
  return ordering === field ? <ArrowUp size={14} /> : ordering === `-${field}` ? <ArrowDown size={14} /> : <ArrowUpDown size={14} className="dim" />
}

export default function Observations() {
  useTitle('Observações')
  const { authed, openLogin } = useAuth()
  const { confirm, toast } = useFeedback()
  const qc = useQueryClient()
  const stations = useStations().data ?? []
  const nameOf = useMemo(() => Object.fromEntries(stations.map((s) => [s.id, s.name])), [stations])

  const [station, setStation] = useState('')
  const [metric, setMetric] = useState<Metric | ''>('')
  const [source, setSource] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [preset, setPreset] = useState<number | null>(null)
  const [ordering, setOrdering] = useState('-observed_at')
  const [page, setPage] = useState(1)
  const [creating, setCreating] = useState(false)

  const filters: ObservationFilters = { station, metric, source, ordering, page, observed_after: toIso(from), observed_before: toIso(to) }
  const { data, isLoading, isFetching, error } = useObservations(filters)
  // Página inexistente (ex.: excluiu o último item da última página): volta para a 1.
  useEffect(() => { if (page > 1 && (error as { status?: number } | null)?.status === 404) setPage(1) }, [error, page])

  // Fontes existentes (sem filtro) e última leitura DO FILTRO ATUAL (base dos atalhos de período).
  const base = useObservations({ ordering: '-observed_at' }).data
  const sources = [...new Set([...(base?.results ?? []).map((o) => o.source), 'manual'])]
  const scoped = useObservations({ station, metric, source, ordering: '-observed_at' }).data
  const latest = scoped?.results[0]?.observed_at

  const remove = useMutation({
    mutationFn: (id: number) => api.deleteObservation(id),
    onSuccess: () => { qc.invalidateQueries(); toast('Observação excluída.') },
    onError: (e) => toast((e as Error).message, 'error'),
  })

  const reset = (fn: () => void) => { fn(); setPage(1) }
  // Trocar estação/métrica/fonte invalida um atalho de período já aplicado (ele dependia do filtro anterior).
  const scope = (fn: () => void) => reset(() => { fn(); if (preset !== null) { setPreset(null); setFrom(''); setTo('') } })
  const hasFilters = !!(station || metric || source || from || to)
  const clear = () => { setStation(''); setMetric(''); setSource(''); setFrom(''); setTo(''); setPreset(null); setPage(1) }
  const applyPreset = (hours: number | null) => {
    setPreset(hours); setPage(1); setTo('')
    setFrom(hours && latest ? toLocalInput(new Date(new Date(latest).getTime() - hours * 3600_000)) : '')
  }

  const sortBy = (field: 'observed_at' | 'value') => {
    setOrdering((o) => (o === field ? `-${field}` : o === `-${field}` ? field : `-${field}`))
    setPage(1)
  }

  const rows = data?.results ?? []
  const count = data?.count ?? 0
  const pages = Math.max(1, Math.ceil(count / PAGE_SIZE))
  const first = count ? (page - 1) * PAGE_SIZE + 1 : 0
  const last = Math.min(page * PAGE_SIZE, count)
  const maxByMetric = useMemo(() => {
    const m: Record<string, number> = { level: 0.0001, rain: 0.0001 }
    rows.forEach((o) => { m[o.metric] = Math.max(m[o.metric], o.value) })
    return m
  }, [rows])
  const newest = rows.reduce<string | null>((a, o) => (!a || o.observed_at > a ? o.observed_at : a), null)
  const avg = metric && rows.length ? rows.reduce((s, o) => s + o.value, 0) / rows.length : null

  // Exporta TODOS os registros que batem com os filtros (percorre as páginas).
  const [exporting, setExporting] = useState(false)
  const exportCsv = async () => {
    setExporting(true)
    try {
      const all: Observation[] = []
      for (let p = 1; p <= Math.ceil(count / PAGE_SIZE); p++) all.push(...(await api.observations({ ...filters, page: p })).results)
      const head = 'estacao;metrica;observado_em;valor;unidade;fonte'
      const body = all.map((o) => [o.station_id, o.metric, o.observed_at, String(o.value).replace('.', ','), UNIT[o.metric], o.source].join(';'))
      const blob = new Blob(['﻿' + [head, ...body].join('\n')], { type: 'text/csv;charset=utf-8' })
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob); a.download = 'observacoes.csv'; a.click()
      URL.revokeObjectURL(a.href)
    } finally { setExporting(false) }
  }

  return (
    <Page>
      <header className="topbar">
        <div className="hello">
          <div className="hello-icon"><Table2 size={26} /></div>
          <div>
            <h2><span>Histórico de leituras</span><b>Observações</b></h2>
            <p>Todas as medições registradas: filtre por estação, período e métrica; ordene e exporte.</p>
          </div>
        </div>
        <div className="top-right">
          <button className="btn-ghost" onClick={exportCsv} disabled={!count || exporting}><Download size={17} /> {exporting ? 'Exportando…' : 'Exportar CSV'}</button>
          <button className="btn-primary" onClick={() => (authed ? setCreating(true) : openLogin())}><Plus size={18} /> Nova observação</button>
        </div>
      </header>

      {/* ---------- Filtros ---------- */}
      <section className="fpanel" aria-label="Filtros de observações">
        <div className="fp-head">
          <span><Filter size={16} /> Filtros</span>
          {hasFilters && <button className="link-btn" onClick={clear}><X size={14} /> Limpar tudo</button>}
        </div>

        <div className="fp-grid">
          <SelectPill icon={<MapPin size={17} />} label="Estação" value={station} onChange={(e) => scope(() => setStation(e.target.value))}>
            <option value="">Todas as estações</option>
            {stations.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </SelectPill>

          <SelectPill icon={<Database size={17} />} label="Fonte" value={source} onChange={(e) => scope(() => setSource(e.target.value))}>
            <option value="">Todas as fontes</option>
            {sources.map((s) => <option key={s} value={s}>{s === 'synthetic' ? 'synthetic (simulado)' : s}</option>)}
          </SelectPill>

          <div className="fp-block">
            <small>Métrica</small>
            <div className="seg full">
              {([['', 'Todas', Layers], ['level', 'Nível', Waves], ['rain', 'Chuva', CloudRain]] as const).map(([v, l, Icon]) => (
                <button key={v} type="button" className={metric === v ? 'on' : ''} onClick={() => scope(() => setMetric(v))}><Icon size={15} /> {l}</button>
              ))}
            </div>
          </div>
        </div>

        <div className="fp-period">
          <div className="fp-block">
            <small><CalendarClock size={13} /> Período</small>
            <div className="presets">
              {PRESETS.map(([l, h]) => (
                <button key={l} type="button" className={preset === h && (h !== null || (!from && !to)) ? 'on' : ''} disabled={h !== null && !latest} onClick={() => applyPreset(h)}>{l}</button>
              ))}
            </div>
          </div>
          <div className="range">
            <label className="dt"><small>De</small><input type="datetime-local" value={from} onChange={(e) => { setPreset(null); reset(() => setFrom(e.target.value)) }} /></label>
            <ArrowRight size={16} className="arrow" />
            <label className="dt"><small>Até</small><input type="datetime-local" value={to} onChange={(e) => { setPreset(null); reset(() => setTo(e.target.value)) }} /></label>
          </div>
          {latest && <p className="fp-note">Os atalhos contam a partir da última leitura do filtro atual ({stamp(latest)}).</p>}
        </div>
      </section>

      {/* ---------- Resumo ---------- */}
      <section className="mini-stats">
        <div><Database size={18} /><span>Registros encontrados</span><b>{count.toLocaleString('pt-BR')}</b></div>
        <div><CalendarClock size={18} /><span>Leitura mais recente (página)</span><b>{newest ? stamp(newest) : '—'}</b></div>
        <div><Layers size={18} /><span>{metric ? `Média desta página (${UNIT[metric]})` : 'Média desta página'}</span><b>{avg != null ? num(avg, metric === 'level' ? 2 : 1) : 'escolha uma métrica'}</b></div>
      </section>

      {isLoading && <Loading />}
      {error && !(page > 1 && (error as { status?: number }).status === 404) && <ErrorBox error={error} />}
      {data && (
        <motion.section className={`card table-card ${isFetching ? 'is-fetching' : ''}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          {count === 0 ? (
            <div className="empty"><SearchX size={34} /><b>Nenhuma observação encontrada</b><span>Tente ampliar o período ou remover filtros.</span>{hasFilters && <button className="link-btn" onClick={clear}>Limpar filtros</button>}</div>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th><button onClick={() => sortBy('observed_at')}>Data e hora <SortIcon ordering={ordering} field="observed_at" /></button></th>
                    <th>Estação</th>
                    <th>Métrica</th>
                    <th className="num"><button onClick={() => sortBy('value')}>Valor <SortIcon ordering={ordering} field="value" /></button></th>
                    <th>Fonte</th>
                    {authed && <th aria-label="Ações" />}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((o) => {
                    const d = dateParts(o.observed_at)
                    return (
                      <tr key={o.id}>
                        <td className="dt-cell"><b>{d.day}</b><small>{d.time}</small></td>
                        <td>
                          <div className="st-cell">
                            <span className="avatar-s">{initials(nameOf[o.station_id] ?? o.station_id)}</span>
                            <div><b>{nameOf[o.station_id] ?? o.station_id}</b><small>{o.station_id}</small></div>
                          </div>
                        </td>
                        <td><span className={`mtag ${o.metric}`}>{o.metric === 'level' ? <Waves size={14} /> : <CloudRain size={14} />} {LABEL[o.metric]}</span></td>
                        <td className="num">
                          <div className="val-cell">
                            <span><b>{num(o.value, o.metric === 'level' ? 2 : 1)}</b><small>{UNIT[o.metric]}</small></span>
                            <i className={`bar ${o.metric}`} style={{ width: `${Math.max(4, (o.value / maxByMetric[o.metric]) * 100)}%` }} />
                          </div>
                        </td>
                        <td><span className={`stag ${o.source === 'synthetic' ? 'sim' : ''}`}>{o.source === 'synthetic' ? 'simulado' : o.source}</span></td>
                        {authed && (
                          <td className="act">
                            <button className="icon-btn danger" aria-label="Excluir observação"
                              onClick={async () => { if (await confirm({ title: 'Excluir observação', message: `Excluir a leitura de ${nameOf[o.station_id] ?? o.station_id} em ${stamp(o.observed_at)}?`, confirmLabel: 'Excluir', danger: true })) remove.mutate(o.id) }}><Trash2 size={16} /></button>
                          </td>
                        )}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
          {remove.error && <div className="form-error">{(remove.error as Error).message}</div>}
          {count > 0 && (
            <footer className="pager">
              <span>Mostrando <b>{first.toLocaleString('pt-BR')}–{last.toLocaleString('pt-BR')}</b> de {count.toLocaleString('pt-BR')}</span>
              <div>
                <button className="icon-btn" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} aria-label="Página anterior"><ChevronLeft size={18} /></button>
                <b>{page} / {pages}</b>
                <button className="icon-btn" disabled={page >= pages} onClick={() => setPage((p) => p + 1)} aria-label="Próxima página"><ChevronRight size={18} /></button>
              </div>
            </footer>
          )}
        </motion.section>
      )}

      <NewObservation open={creating} onClose={() => setCreating(false)} />
    </Page>
  )
}

function NewObservation({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient()
  const { toast } = useFeedback()
  const stations = useStations().data ?? []
  const nowLocal = () => toLocalInput(new Date())
  const [f, setF] = useState({ station_id: '', metric: 'level' as Metric, observed_at: nowLocal(), value: '', source: 'manual' })

  const create = useMutation({
    mutationFn: () => api.createObservation({
      station_id: f.station_id || stations[0]?.id, metric: f.metric, observed_at: new Date(f.observed_at).toISOString(),
      value: Number(f.value.replace(',', '.')), unit: UNIT[f.metric], source: f.source.trim() || 'manual',
    }),
    onSuccess: () => { qc.invalidateQueries(); setF((p) => ({ ...p, value: '', observed_at: nowLocal() })); onClose(); toast('Observação registrada.') },
  })
  const [localErr, setLocalErr] = useState('')
  const submit = (e: FormEvent) => {
    e.preventDefault()
    const v = Number(f.value.replace(',', '.'))
    if (f.value.trim() === '' || !Number.isFinite(v)) { setLocalErr('Informe um número válido para o valor (ex.: 1,25).'); return }
    if (v < 0) { setLocalErr('O valor não pode ser negativo.'); return }
    setLocalErr(''); create.mutate()
  }

  return (
    <Modal open={open} onClose={onClose} title="Nova observação" icon={<Table2 size={20} />}>
      <form className="form" onSubmit={submit}>
        <SelectPill icon={<MapPin size={17} />} label="Estação" value={f.station_id || stations[0]?.id || ''} onChange={(e) => setF({ ...f, station_id: e.target.value })}>
          {stations.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </SelectPill>
        <div className="fp-block">
          <small>Métrica</small>
          <div className="seg full">
            {(['level', 'rain'] as const).map((m) => (
              <button key={m} type="button" className={f.metric === m ? 'on' : ''} onClick={() => setF({ ...f, metric: m })}>{LABEL[m]} ({UNIT[m]})</button>
            ))}
          </div>
        </div>
        <div className="form-row">
          <Input label="Data e hora" type="datetime-local" value={f.observed_at} onChange={(e) => setF({ ...f, observed_at: e.target.value })} required />
          <Input label={`Valor (${UNIT[f.metric]})`} inputMode="decimal" value={f.value} onChange={(e) => setF({ ...f, value: e.target.value })} placeholder="1,25" required />
        </div>
        <Input label="Fonte" value={f.source} onChange={(e) => setF({ ...f, source: e.target.value })} maxLength={100} />
        {(localErr || create.error) && <div className="form-error">{localErr || (create.error as Error).message}</div>}
        <button className="btn-primary" disabled={create.isPending}>{create.isPending ? 'Salvando…' : 'Registrar observação'}</button>
      </form>
    </Modal>
  )
}
