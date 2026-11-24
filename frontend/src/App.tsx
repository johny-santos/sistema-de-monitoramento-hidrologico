import { AnimatePresence } from 'framer-motion'
import { lazy, Suspense } from 'react'
import { Route, Routes, useLocation } from 'react-router-dom'
import Layout from './components/Layout'
import RouteBoundary from './components/RouteBoundary'
import Dashboard from './pages/Dashboard'
import NotFound from './pages/NotFound'
import Stations from './pages/Stations'
import { Loading } from './components/States'

// Telas secundárias carregam sob demanda (o pacote inicial fica menor).
const StationDetail = lazy(() => import('./pages/StationDetail'))
const About = lazy(() => import('./pages/About'))
const Observations = lazy(() => import('./pages/Observations'))

// Rotas do sistema:
//   /               -> Visão geral (Dashboard)
//   /estacoes       -> Lista de estações
//   /estacoes/:id   -> Detalhamento de uma estação
//   /observacoes    -> Tabela de observações com filtros
//   /sobre          -> Sobre o projeto
export default function App() {
  const location = useLocation()
  return (
    <Layout>
      <Suspense fallback={<Loading />}>
      <AnimatePresence mode="wait">
        <RouteBoundary resetKey={location.pathname}>
        <Routes location={location} key={location.pathname}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/estacoes" element={<Stations />} />
          <Route path="/estacoes/:id" element={<StationDetail />} />
          <Route path="/observacoes" element={<Observations />} />
          <Route path="/sobre" element={<About />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
        </RouteBoundary>
      </AnimatePresence>
      </Suspense>
    </Layout>
  )
}
