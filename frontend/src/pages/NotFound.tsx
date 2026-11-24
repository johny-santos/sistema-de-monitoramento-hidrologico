import { Compass, Home, Radio } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import Page from '../components/Page'
import { useTitle } from '../lib/useTitle'

export default function NotFound() {
  const { pathname } = useLocation()
  useTitle('Página não encontrada')
  return (
    <Page>
      <section className="notfound" aria-labelledby="nf-title">
        <div className="nf-code" aria-hidden>404</div>
        <Compass size={44} className="nf-ico" />
        <h2 id="nf-title">Página não encontrada</h2>
        <p>O endereço <code>{pathname}</code> não existe neste sistema.</p>
        <div className="nf-actions">
          <Link to="/" className="btn-primary"><Home size={17} /> Ir para o início</Link>
          <Link to="/estacoes" className="btn-ghost"><Radio size={17} /> Ver estações</Link>
        </div>
      </section>
    </Page>
  )
}
