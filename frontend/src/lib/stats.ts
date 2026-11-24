import type { Point, Series } from './api'

export interface SeriesStats {
  n: number
  min: number
  max: number
  avg: number
  sum: number
  first: number
  last: number
  delta: number
  minAt: string
  maxAt: string
}

/** Estatísticas de uma série (ignora lacunas/valores nulos). Retorna null se não houver leituras. */
export function seriesStats(series?: Series): SeriesStats | null {
  const pts = (series?.points ?? []).filter((p): p is Point & { value: number } => p.value != null && Number.isFinite(p.value))
  if (!pts.length) return null
  let min = pts[0], max = pts[0], sum = 0
  for (const p of pts) {
    if (p.value < min.value) min = p
    if (p.value > max.value) max = p
    sum += p.value
  }
  return {
    n: pts.length, min: min.value, max: max.value, avg: sum / pts.length, sum,
    first: pts[0].value, last: pts[pts.length - 1].value, delta: pts[pts.length - 1].value - pts[0].value,
    minAt: min.observed_at, maxAt: max.observed_at,
  }
}

/**
 * Insere um ponto nulo no meio de qualquer buraco grande (mais de 2,2x o intervalo típico),
 * para o gráfico mostrar a lacuna em vez de ligar com uma linha: lacunas não são inventadas.
 */
export function withGaps(points: Point[]): Point[] {
  if (points.length < 4) return points
  const t = points.map((p) => new Date(p.observed_at).getTime())
  const deltas = t.slice(1).map((v, i) => v - t[i]).filter((d) => d > 0).sort((a, b) => a - b)
  if (!deltas.length) return points
  const median = deltas[Math.floor(deltas.length / 2)]
  const out: Point[] = [points[0]]
  for (let i = 1; i < points.length; i++) {
    if (t[i] - t[i - 1] > median * 2.2) {
      out.push({ observed_at: new Date(t[i - 1] + (t[i] - t[i - 1]) / 2).toISOString(), value: null, unit: points[i].unit })
    }
    out.push(points[i])
  }
  return out
}
