// Cliente da API Django (monitoring/views.py). Em dev o Vite faz proxy de /api.
export interface Station {
  id: string
  name: string
  river: string
  municipality: string
  simulated: boolean
}
export type Metric = 'level' | 'rain'
export interface Observation {
  id: number
  station_id: string
  metric: Metric
  observed_at: string
  value: number
  unit: string
  source: string
  simulated?: boolean
}
export interface Summary extends Station {
  observations_count: number
  latest: { level: Observation | null; rain: Observation | null }
}
export interface Point { observed_at: string; value: number | null; unit: string }
export interface Series {
  simulated: boolean
  station: string
  metric: Metric
  hours: number
  unit: string | null
  count: number
  points: Point[]
}
export interface Paginated<T> { count: number; next: string | null; previous: string | null; results: T[] }

export interface StationFilters { search?: string; river?: string; municipality?: string; ordering?: string }
export interface ObservationFilters {
  station?: string
  metric?: Metric | ''
  source?: string
  observed_after?: string
  observed_before?: string
  ordering?: string
  page?: number
}

export const PAGE_SIZE = 100
const BASE = import.meta.env.VITE_API_URL ?? '/api'

/** Token de autenticação (DRF TokenAuthentication) guardado no navegador. */
export const tokenStore = {
  get: () => { try { return localStorage.getItem('hidro.token') } catch { return null } },
  set: (t: string) => { try { localStorage.setItem('hidro.token', t) } catch { /* ignora */ } },
  clear: () => {
    try { localStorage.removeItem('hidro.token') } catch { /* ignora */ }
    window.dispatchEvent(new Event('hidro:token-cleared'))   // a interface se atualiza (sai do modo logado)
  },
}

export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) { super(message); this.status = status }
}

/** Converte o corpo de erro do DRF ({detail} ou {campo: [msgs]}) em texto legível. */
function errorText(body: unknown, fallback: string) {
  if (body && typeof body === 'object') {
    const o = body as Record<string, unknown>
    if (typeof o.detail === 'string') return o.detail
    const parts = Object.entries(o).map(([k, v]) => {
      let msg = Array.isArray(v) ? v.join(' ') : String(v)
      if (/unique set|conjunto único|set único/i.test(msg)) msg = 'Já existe uma observação desta estação, métrica e horário.'
      else if (/already exists|já existe/i.test(msg)) msg = 'já existe um registro com este valor.'
      else if (/required|may not be (blank|null)|obrigat|em branco|não ser nulo|nulo/i.test(msg)) msg = 'campo obrigatório.'
      else if (/valid number|número válido|número/i.test(msg)) msg = 'informe um número válido.'
      return k === 'non_field_errors' ? msg : `${k}: ${msg}`
    })
    if (parts.length) return parts.join(' · ')
  }
  return fallback
}

async function request<T>(path: string, init: RequestInit = {}, useToken = true): Promise<T> {
  const token = useToken ? tokenStore.get() : null
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Token ${token}` } : {}),
    },
  })
  // Token inválido/expirado derruba até leituras públicas: limpa e repete sem token.
  if (res.status === 401 && token) {
    tokenStore.clear()
    if ((init.method ?? 'GET') === 'GET') return request<T>(path, init, false)
    throw new ApiError('Sessão expirada. Entre novamente.', 401)
  }
  if (!res.ok) {
    let body: unknown = null
    try { body = await res.json() } catch { /* sem corpo */ }
    const fallback = res.status === 401 || res.status === 403 ? 'Entre para realizar esta ação.' : `Erro ${res.status} ao consultar ${path}`
    throw new ApiError(errorText(body, fallback), res.status)
  }
  return res.status === 204 ? (undefined as T) : res.json()
}

const qs = (params: object) => {
  const sp = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== '' && v !== null) sp.set(k, String(v)) })
  const s = sp.toString()
  return s ? `?${s}` : ''
}

/** Garante o formato esperado da resposta; senão vira um erro tratado (mostrado em ErrorBox). */
function expect<T>(data: unknown, ok: (d: Record<string, unknown>) => boolean, what: string): T {
  if (!data || typeof data !== 'object' || !ok(data as Record<string, unknown>)) {
    throw new ApiError(`Resposta inesperada da API (${what}).`, 502)
  }
  return data as T
}

export const api = {
  stations: async (filters: StationFilters = {}): Promise<Station[]> => {
    const data = await request<Station[] | Paginated<Station>>(`/stations/${qs(filters)}`)
    if (Array.isArray(data)) return data
    return expect<Paginated<Station>>(data, (d) => Array.isArray(d.results), 'estações').results
  },
  summary: async (id: string) => expect<Summary>(await request(`/stations/${encodeURIComponent(id)}/summary/`), (d) => typeof d.id === 'string' && !!d.latest && typeof d.latest === 'object', 'resumo'),
  series: async (id: string, metric: Metric, hours: number) =>
    expect<Series>(await request(`/stations/${encodeURIComponent(id)}/series/?metric=${metric}&hours=${hours}`), (d) => Array.isArray(d.points), 'série'),

  observations: async (filters: ObservationFilters = {}) =>
    expect<Paginated<Observation>>(await request(`/observations/${qs(filters)}`), (d) => Array.isArray(d.results) && typeof d.count === 'number', 'observações'),

  login: async (username: string, password: string) => {
    const r = await request<{ token: string }>('/token/', { method: 'POST', body: JSON.stringify({ username, password }) }, false)
    return r.token
  },
  createStation: (s: Pick<Station, 'id' | 'name' | 'river' | 'municipality'>) =>
    request<Station>('/stations/', { method: 'POST', body: JSON.stringify(s) }),
  deleteStation: (id: string) => request<void>(`/stations/${encodeURIComponent(id)}/`, { method: 'DELETE' }),
  createObservation: (o: Pick<Observation, 'station_id' | 'metric' | 'observed_at' | 'value' | 'unit' | 'source'>) =>
    request<Observation>('/observations/', { method: 'POST', body: JSON.stringify(o) }),
  deleteObservation: (id: number) => request<void>(`/observations/${id}/`, { method: 'DELETE' }),
}
