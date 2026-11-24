import {
  BarElement, CategoryScale, Chart, Filler, LinearScale, LineElement, PointElement, Tooltip, Legend,
} from 'chart.js'

// Chart.js é "tree-shakeable": só registramos o que usamos.
Chart.register(BarElement, CategoryScale, Filler, LinearScale, LineElement, PointElement, Tooltip, Legend)
Chart.defaults.font.family = "'Plus Jakarta Sans', system-ui, sans-serif"
Chart.defaults.font.size = 13
Chart.defaults.color = '#5a7090'
