import { useQueries, useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { api, type Metric, type ObservationFilters, type StationFilters } from './api'

export const useStations = (filters: StationFilters = {}) =>
  useQuery({ queryKey: ['stations', filters], queryFn: () => api.stations(filters), placeholderData: (prev) => prev })

export const useSummary = (id?: string) =>
  useQuery({ queryKey: ['summary', id], queryFn: () => api.summary(id!), enabled: !!id })

export const useSeries = (id: string | undefined, metric: Metric, hours: number) =>
  useQuery({ queryKey: ['series', id, metric, hours], queryFn: () => api.series(id!, metric, hours), enabled: !!id })

export const useSummaries = (ids: string[]) =>
  useQueries({ queries: ids.map((id) => ({ queryKey: ['summary', id], queryFn: () => api.summary(id) })) })

export const useObservations = (filters: ObservationFilters) =>
  useQuery({ queryKey: ['observations', filters], queryFn: () => api.observations(filters), placeholderData: (prev) => prev })

/** Atrasa a propagação de um valor (campo de busca). */
export function useDebounced<T>(value: T, ms = 300) {
  const [v, setV] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return v
}
