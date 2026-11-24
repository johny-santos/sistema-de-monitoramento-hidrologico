import { useMutation, useQueryClient } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowDownAZ, Building2, Plus, Radio, Search, SearchX, Waves, X } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Input, SelectPill } from '../components/Field'
import Modal from '../components/Modal'
import Page from '../components/Page'
import StationCard from '../components/StationCard'
import { ErrorBox, Loading } from '../components/States'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'
import { useFeedback } from '../lib/feedback'
import { useTitle } from '../lib/useTitle'
import { useDebounced, useStations } from '../lib/hooks'

const SORTS: Record<string, string> = { id: 'Código', name: 'Nome', river: 'Rio', municipality: 'Município' }

export default function Stations() {
  useTitle('Estações')
  const { authed, openLogin } = useAuth()
  const { confirm, toast } = useFeedback()
  const qc = useQueryClient()
  const [q, setQ] = useState('')
  const [river, setRiver] = useState('')
  const [city, setCity] = useState('')
  const [sort, setSort] = useState('id')
  const [creating, setCreating] = useState(false)
  const search = useDebounced(q.trim())

  // Lista completa (opções dos filtros e índice das fotos) e lista filtrada pela API.
  const all = useStations().data ?? []
  const { data, isLoading, error } = useStations({ search, river, municipality: city, ordering: sort })
  const rivers = [...new Set(all.map((s) => s.river))].sort()
  const cities = [...new Set(all.map((s) => s.municipality))].sort()
  const hasFilters = !!(q || river || city)
  const clear = () => { setQ(''); setRiver(''); setCity('') }

  const remove = useMutation({
    mutationFn: (id: string) => api.deleteStation(id),
    onSuccess: () => { qc.invalidateQueries(); toast('Estação excluída.') },
    onError: (e) => toast((e as Error).message, 'error'),
  })

  return (
    <Page>
      <header className="topbar">
        <div className="hello">
          <div className="hello-icon"><Radio size={26} /></div>
          <div>
            <h2><span>Rede de monitoramento</span><b>Estações Hidrológicas</b></h2>
            <p>Escolha uma estação para ver leituras, gráficos e o medidor 3D.</p>
          </div>
        </div>
        <button className="btn-primary" onClick={() => (authed ? setCreating(true) : openLogin())}>
          <Plus size={18} /> Nova estação
        </button>
      </header>

      <section className="toolbar" aria-label="Filtros de estações">
        <label className="tb-search">
          <Search size={18} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nome, rio ou município…" aria-label="Buscar estação" />
          {q && <button type="button" className="clear-x" onClick={() => setQ('')} aria-label="Limpar busca"><X size={15} /></button>}
        </label>
        <SelectPill icon={<Waves size={17} />} label="Rio" value={river} onChange={(e) => setRiver(e.target.value)}>
          <option value="">Todos</option>
          {rivers.map((r) => <option key={r}>{r}</option>)}
        </SelectPill>
        <SelectPill icon={<Building2 size={17} />} label="Município" value={city} onChange={(e) => setCity(e.target.value)}>
          <option value="">Todos</option>
          {cities.map((c) => <option key={c}>{c}</option>)}
        </SelectPill>
        <SelectPill icon={<ArrowDownAZ size={17} />} label="Ordenar por" value={sort} onChange={(e) => setSort(e.target.value)}>
          {Object.entries(SORTS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </SelectPill>
      </section>

      <div className="result-bar">
        <span><b>{data?.length ?? 0}</b> de {all.length} estações</span>
        <AnimatePresence>
          {hasFilters && (
            <motion.div className="chips-row" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              {q && <span className="fchip">Busca: “{q}”</span>}
              {river && <span className="fchip">Rio: {river}</span>}
              {city && <span className="fchip">Município: {city}</span>}
              <button className="link-btn" onClick={clear}>Limpar filtros</button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {isLoading && <Loading />}
      {error && <ErrorBox error={error} />}
      {data && (
        <>
          <div className="cards">
            {data.map((s, i) => (
              <StationCard
                key={s.id} station={s} index={Math.max(0, all.findIndex((a) => a.id === s.id))} order={i}
                onDelete={authed ? async () => {
                  if (await confirm({ title: 'Excluir estação', message: `Excluir "${s.name}" e todas as suas observações? Esta ação não pode ser desfeita.`, confirmLabel: 'Excluir', danger: true })) remove.mutate(s.id)
                } : undefined}
              />
            ))}
          </div>
          {data.length === 0 && (
            <div className="empty"><SearchX size={34} /><b>Nenhuma estação encontrada</b><span>Ajuste os filtros ou limpe a busca.</span><button className="link-btn" onClick={clear}>Limpar filtros</button></div>
          )}
          {remove.error && <div className="form-error">{(remove.error as Error).message}</div>}
        </>
      )}

      <NewStation open={creating} onClose={() => setCreating(false)} />
    </Page>
  )
}

function NewStation({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient()
  const { toast } = useFeedback()
  const [f, setF] = useState({ id: '', name: '', river: '', municipality: '' })
  const create = useMutation({
    mutationFn: () => api.createStation({ ...f, id: f.id.trim().toUpperCase() }),
    onSuccess: () => { qc.invalidateQueries(); setF({ id: '', name: '', river: '', municipality: '' }); onClose(); toast('Estação cadastrada.') },
  })
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((p) => ({ ...p, [k]: e.target.value }))
  const submit = (e: FormEvent) => { e.preventDefault(); create.mutate() }

  return (
    <Modal open={open} onClose={onClose} title="Nova estação" icon={<Radio size={20} />}>
      <form className="form" onSubmit={submit}>
        <Input label="Código" hint="Até 10 caracteres, ex.: EST-06" value={f.id} onChange={set('id')} maxLength={10} required />
        <Input label="Nome" value={f.name} onChange={set('name')} placeholder="Estação Boa Vista" required />
        <div className="form-row">
          <Input label="Rio" value={f.river} onChange={set('river')} maxLength={50} required />
          <Input label="Município" value={f.municipality} onChange={set('municipality')} required />
        </div>
        {create.error && <div className="form-error">{(create.error as Error).message}</div>}
        <button className="btn-primary" disabled={create.isPending}>{create.isPending ? 'Salvando…' : 'Cadastrar estação'}</button>
      </form>
    </Modal>
  )
}
