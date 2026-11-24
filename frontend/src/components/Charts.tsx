import type { ChartData, ChartOptions, Plugin } from 'chart.js'
import { Bar, Line } from 'react-chartjs-2'
import { useMemo } from 'react'
import type { Series } from '../lib/api'
import { dayHour, hour, num, stamp } from '../lib/format'
import { useQuality } from '../lib/quality'
import { seriesStats, withGaps } from '../lib/stats'

/** Animação de entrada só no modo Alto (nos outros o gráfico aparece pronto, sem custo). */
const useAnim = (ms: number) => (useQuality() === 'high' ? { duration: ms, easing: 'easeOutCubic' as const } : (false as const))

const tooltip = {
  backgroundColor: 'rgba(6, 26, 63, .95)',
  titleColor: '#8fcbff',
  bodyColor: '#fff',
  footerColor: '#9fd0ff',
  padding: { x: 14, y: 10 },
  cornerRadius: 12,
  displayColors: false,
  caretSize: 7,
  titleFont: { weight: 600, size: 11 },
  bodyFont: { size: 15, weight: 700 },
  footerFont: { size: 11, weight: 600 },
} as const

const grid = { color: 'rgba(30, 80, 150, .09)', lineWidth: 1 }

/** Série preparada para desenhar: lacunas viram quebras e nada é interpolado. */
function usePrepared(series?: Series) {
  return useMemo(() => {
    if (!series) return null
    const points = withGaps(series.points)
    const long = series.hours > 24
    const labels = points.map((p) => (long ? dayHour(p.observed_at) : hour(p.observed_at)))
    const hasData = points.some((p) => p.value != null)
    return { points, labels, hasData }
  }, [series])
}

/** Eixo X: no máx. ~7 rótulos, espaçados de forma regular (estilo 00h, 04h, 08h...). */
const xAxis = (labels: string[]) => ({
  grid: { display: false },
  border: { display: false },
  ticks: {
    padding: 8, maxRotation: 0, autoSkip: false,
    callback(_: unknown, i: number) {
      const step = Math.max(1, Math.round(labels.length / 6))
      return i % step === 0 ? labels[i] : ''
    },
  },
})

/** Escala "bonita" partindo de 0: 0–2 (passo .5) ou 0–N (passo 1). */
function niceMax(max: number) {
  return max <= 1.6 ? 2 : Math.ceil(max * 1.25)
}

export function NoData({ height, text = 'Sem leituras neste período' }: { height: number; text?: string }) {
  return <div className="chart-nodata" style={{ height }}><span>{text}</span></div>
}

/** Linha vertical que acompanha o cursor. */
const crosshair: Plugin<'line'> = {
  id: 'crosshair',
  afterDatasetsDraw(chart) {
    const active = chart.tooltip?.getActiveElements?.() ?? []
    if (!active.length) return
    const { ctx, chartArea } = chart
    const x = active[0].element.x
    ctx.save()
    ctx.strokeStyle = 'rgba(20, 112, 214, .35)'
    ctx.setLineDash([4, 4])
    ctx.beginPath()
    ctx.moveTo(x, chartArea.top)
    ctx.lineTo(x, chartArea.bottom)
    ctx.stroke()
    ctx.restore()
  },
}

/** Linha tracejada da média, com etiqueta. */
const average = (avg: number): Plugin<'line'> => ({
  id: 'average',
  afterDatasetsDraw(chart) {
    const y = chart.scales.y.getPixelForValue(avg)
    const { ctx, chartArea } = chart
    if (!Number.isFinite(y) || y < chartArea.top || y > chartArea.bottom) return
    ctx.save()
    ctx.strokeStyle = 'rgba(217, 138, 0, .75)'
    ctx.lineWidth = 1.5
    ctx.setLineDash([6, 5])
    ctx.beginPath(); ctx.moveTo(chartArea.left, y); ctx.lineTo(chartArea.right, y); ctx.stroke()
    ctx.setLineDash([])
    const text = `média ${num(avg)} m`
    ctx.font = '700 11px "Plus Jakarta Sans", sans-serif'
    const w = ctx.measureText(text).width + 16
    ctx.fillStyle = 'rgba(255, 243, 218, .96)'
    ctx.beginPath(); ctx.roundRect(chartArea.right - w - 4, y - 11, w, 22, 8); ctx.fill()
    ctx.fillStyle = '#9a6200'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText(text, chartArea.right - w / 2 - 4, y + 0.5)
    ctx.restore()
  },
})

/** Marca o ponto máximo com um balão fixo (some quando o cursor está sobre o gráfico). */
const peak: Plugin<'line'> = {
  id: 'peak',
  afterDatasetsDraw(chart) {
    const meta = chart.getDatasetMeta(0)
    const data = chart.data.datasets[0].data as (number | null)[]
    let idx = -1
    data.forEach((v, i) => { if (v != null && (idx < 0 || v > (data[idx] as number))) idx = i })
    if (idx < 0 || !meta.data[idx]) return
    if ((chart.tooltip?.getActiveElements?.() ?? []).length) return
    const { x, y } = meta.data[idx]
    const { ctx, chartArea } = chart
    const text = `${num(data[idx] as number)} m`
    ctx.save()
    ctx.font = '700 12px "Plus Jakarta Sans", sans-serif'
    const w = ctx.measureText(text).width + 22
    const bx = Math.min(Math.max(x - w / 2, chartArea.left), chartArea.right - w)
    const by = Math.max(y - 40, chartArea.top - 6)
    ctx.fillStyle = 'rgba(6, 26, 63, .94)'
    ctx.beginPath()
    ctx.roundRect(bx, by, w, 26, 9)
    ctx.fill()
    ctx.beginPath()
    ctx.moveTo(x - 5, by + 26); ctx.lineTo(x + 5, by + 26); ctx.lineTo(x, by + 32); ctx.fill()
    ctx.fillStyle = '#fff'
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText(text, bx + w / 2, by + 13.5)
    ctx.beginPath(); ctx.arc(x, y, 5.5, 0, Math.PI * 2)
    ctx.fillStyle = '#0a2a5e'; ctx.fill()
    ctx.lineWidth = 2.5; ctx.strokeStyle = '#fff'; ctx.stroke()
    ctx.restore()
  },
}

export function LevelChart({ series, height = 260, showAverage = true }: { series?: Series; height?: number; showAverage?: boolean }) {
  const animation = useAnim(800)
  const prep = usePrepared(series)
  const st = useMemo(() => seriesStats(series), [series])
  if (!series || !prep) return <div className="chart-empty" style={{ height }} />
  if (!prep.hasData || !st) return <NoData height={height} />

  // Eixo com zoom no intervalo dos dados (em quartos de metro), mantendo variações legíveis.
  const lo = Math.max(0, Math.floor((st.min - 0.25) * 4) / 4)
  const hi = Math.max(Math.ceil((st.max + 0.25) * 4) / 4, lo + 1)
  const single = st.n <= 2
  const data: ChartData<'line'> = {
    labels: prep.labels,
    datasets: [
      {
        label: 'Nível',
        data: prep.points.map((p) => p.value),
        borderColor: '#1473e6',
        borderWidth: 3,
        tension: 0.42,
        pointRadius: single ? 6 : 0,
        pointBackgroundColor: '#1473e6',
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
        pointHoverRadius: 7,
        pointHoverBackgroundColor: '#0a2a5e',
        pointHoverBorderColor: '#fff',
        pointHoverBorderWidth: 3,
        fill: true,
        spanGaps: false,           // lacunas ficam visíveis
        backgroundColor: (ctx) => {
          const { ctx: c, chartArea } = ctx.chart
          if (!chartArea) return 'rgba(20,115,230,.2)'
          const g = c.createLinearGradient(0, chartArea.top, 0, chartArea.bottom)
          g.addColorStop(0, 'rgba(20,115,230,.34)')
          g.addColorStop(0.7, 'rgba(56,168,245,.08)')
          g.addColorStop(1, 'rgba(56,168,245,0)')
          return g
        },
      },
    ],
  }
  const options: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    layout: { padding: { top: 30, right: 6 } },
    interaction: { mode: 'index', intersect: false },
    animation,
    plugins: {
      legend: { display: false },
      tooltip: {
        ...tooltip,
        filter: (item) => item.parsed.y != null,
        callbacks: {
          title: (items) => stamp(prep.points[items[0].dataIndex]?.observed_at),
          label: (c) => `${num(c.parsed.y)} m`,
          footer: (items) => {
            const i = items[0].dataIndex
            const prev = [...prep.points.slice(0, i)].reverse().find((p) => p.value != null)
            const cur = prep.points[i]?.value
            if (!prev || cur == null || prev.value == null) return ''
            const d = cur - prev.value
            return `${d >= 0 ? '▲ +' : '▼ '}${num(d)} m vs. leitura anterior`
          },
        },
      },
    },
    scales: {
      x: { ...xAxis(prep.labels), offset: single },   // 1 leitura: ponto centralizado
      y: {
        min: lo, max: hi, grid, border: { display: false },
        ticks: { stepSize: hi - lo <= 1.25 ? 0.25 : 0.5, padding: 10, callback: (v) => `${num(Number(v), 2)} m` },
      },
    },
  }
  const plugins = showAverage && st.n > 3 && st.max - st.min > 0.005 ? [crosshair, average(st.avg), peak] : [crosshair, peak]
  return (
    <div style={{ height }}>
      <Line data={data} options={options} plugins={plugins} aria-label={`Gráfico do nível do rio: mínimo ${num(st.min)} m, máximo ${num(st.max)} m, média ${num(st.avg)} m`} />
    </div>
  )
}

export function RainChart({ series, height = 260 }: { series?: Series; height?: number }) {
  const animation = useAnim(700)
  const prep = usePrepared(series)
  const st = useMemo(() => seriesStats(series), [series])
  if (!series || !prep) return <div className="chart-empty" style={{ height }} />
  if (!prep.hasData || !st) return <NoData height={height} />

  const max = Math.max(st.max, 0.0001)
  const top = niceMax(max)
  const data: ChartData<'bar'> = {
    labels: prep.labels,
    datasets: [
      {
        label: 'Chuva',
        data: prep.points.map((p) => p.value),
        borderRadius: 7,
        borderSkipped: false,
        maxBarThickness: 18,
        minBarLength: 3,            // chuva 0,0 ainda aparece como um traço (distingue de "sem leitura")
        backgroundColor: (ctx) => {
          const { ctx: c, chartArea } = ctx.chart
          const v = (ctx.raw as number | null) ?? 0
          const t = v / max
          if (!chartArea) return '#38a8f5'
          const g = c.createLinearGradient(0, chartArea.bottom, 0, chartArea.top)
          g.addColorStop(0, `rgba(56,168,245,${0.55 + 0.3 * t})`)
          g.addColorStop(1, `rgba(${Math.round(20 - 14 * t)},${Math.round(115 - 40 * t)},${Math.round(230 - 30 * t)},1)`)
          return g
        },
        hoverBackgroundColor: '#0a2a5e',
      },
    ],
  }
  const options: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    animation,
    plugins: {
      legend: { display: false },
      tooltip: {
        ...tooltip,
        filter: (item) => item.parsed.y != null,
        callbacks: {
          title: (items) => stamp(prep.points[items[0].dataIndex]?.observed_at),
          label: (c) => `${num(c.parsed.y, 1)} mm/h`,
        },
      },
    },
    scales: {
      x: xAxis(prep.labels),
      y: {
        min: 0, max: top, grid, border: { display: false },
        ticks: { stepSize: top <= 2 ? 0.5 : 1, padding: 10, callback: (v) => `${num(Number(v), 1)} mm/h` },
      },
    },
  }
  return (
    <div style={{ height }}>
      <Bar data={data} options={options} aria-label={`Gráfico de chuva: máximo ${num(st.max, 1)} mm/h, média ${num(st.avg, 1)} mm/h`} />
    </div>
  )
}

/** Faixa de estatísticas do período exibido (abaixo do gráfico). */
export function StatsStrip({ series, metric }: { series?: Series; metric: 'level' | 'rain' }) {
  const st = useMemo(() => seriesStats(series), [series])
  if (!st) return null
  const d = metric === 'level' ? 2 : 1
  const u = metric === 'level' ? 'm' : 'mm/h'
  const items: [string, string, string?][] = metric === 'level'
    ? [['Mínimo', `${num(st.min, d)} ${u}`, stamp(st.minAt)], ['Média', `${num(st.avg, d)} ${u}`], ['Máximo', `${num(st.max, d)} ${u}`, stamp(st.maxAt)],
       ['Variação', `${st.delta >= 0 ? '+' : ''}${num(st.delta, d)} ${u}`, 'do início ao fim'], ['Leituras', String(st.n)]]
    : [['Pico', `${num(st.max, d)} ${u}`, stamp(st.maxAt)], ['Média', `${num(st.avg, d)} ${u}`], ['Total no período', `${num(st.sum, 1)} mm`, 'soma das leituras horárias'],
       ['Leituras', String(st.n)]]
  return (
    <div className="stats-strip">
      {items.map(([k, v, sub]) => (
        <div key={k}><span>{k}</span><b>{v}</b>{sub && <small>{sub}</small>}</div>
      ))}
    </div>
  )
}

/** Mini gráfico sem eixos, para listas e cards. */
export function Sparkline({ series, color = '#1473e6' }: { series?: Series; color?: string }) {
  const prep = usePrepared(series)
  if (!series || !prep || !prep.hasData) return <div className="spark-empty" />
  const data: ChartData<'line'> = {
    labels: prep.points.map((p) => p.observed_at),
    datasets: [
      {
        data: prep.points.map((p) => p.value),
        borderColor: color, borderWidth: 2, tension: 0.45, pointRadius: prep.points.length <= 2 ? 3 : 0, fill: true, spanGaps: false,
        backgroundColor: (ctx) => {
          const { ctx: c, chartArea } = ctx.chart
          if (!chartArea) return 'transparent'
          const g = c.createLinearGradient(0, chartArea.top, 0, chartArea.bottom)
          g.addColorStop(0, `${color}44`); g.addColorStop(1, `${color}00`)
          return g
        },
      },
    ],
  }
  const options: ChartOptions<'line'> = {
    responsive: true, maintainAspectRatio: false, events: [],
    animation: false,
    plugins: { legend: { display: false }, tooltip: { enabled: false } },
    scales: { x: { display: false }, y: { display: false } },
    layout: { padding: 2 },
  }
  return <div className="spark" aria-hidden><Line data={data} options={options} role="presentation" /></div>
}
