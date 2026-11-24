import { BookOpen, Info, LayoutDashboard, LogIn, LogOut, PanelLeftClose, PanelLeftOpen, Radio, Table2, UserRound } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import LoginModal from './LoginModal'
import Logo from './Logo'

const links = [
  { to: '/', label: 'Início', icon: LayoutDashboard, end: true },
  { to: '/estacoes', label: 'Estações', icon: Radio, end: false },
  { to: '/observacoes', label: 'Observações', icon: Table2, end: false },
  { to: '/sobre', label: 'Sobre', icon: Info, end: true },
]

export default function Layout({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false)
  const { authed, username, openLogin, logout } = useAuth()
  const { pathname } = useLocation()
  const main = useRef<HTMLElement>(null)
  // Nova tela: volta ao topo e leva o foco ao conteúdo (leitor de tela anuncia a página; teclado não fica perdido).
  const first = useRef(true)
  useEffect(() => {
    if (first.current) { first.current = false; return }   // no carregamento inicial não mexe no foco (o "Pular" continua sendo o 1º Tab)
    window.scrollTo(0, 0); main.current?.focus({ preventScroll: true })
  }, [pathname])
  return (
    <div className={`shell ${collapsed ? 'is-collapsed' : ''}`}>
      <a className="skip" href="#main">Pular para o conteúdo</a>
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-drop"><Logo size={68} /></div>
          <h1>HidroMonitor</h1>
          <p>Monitoramento<br />Hidrológico</p>
        </div>
        <nav>
          {links.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <Icon size={20} /> <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="side-bottom">
          <div className="side-user">
            <div className="avatar"><UserRound size={18} /></div>
            <div className="who">
              <b>{authed ? username ?? 'Administrador' : 'Visitante'}</b>
              <small>{authed ? 'Pode cadastrar e excluir' : 'Somente leitura'}</small>
            </div>
            <button onClick={authed ? logout : openLogin} aria-label={authed ? 'Sair' : 'Entrar'} title={authed ? 'Sair' : 'Entrar'}>
              {authed ? <LogOut size={17} /> : <LogIn size={17} />}
            </button>
          </div>
          <a className="side-docs" href="/api/docs/" target="_blank" rel="noreferrer"><BookOpen size={15} /> <span>Documentação da API</span></a>
        </div>

        <div className="waves" aria-hidden>
          <svg viewBox="0 0 480 120" preserveAspectRatio="none">
            <path className="w1" d="M0 50 C80 10 160 90 240 50 S400 10 480 50 V120 H0Z" />
            <path className="w2" d="M0 70 C80 30 160 110 240 70 S400 30 480 70 V120 H0Z" />
            <path className="w3" d="M0 90 C80 60 160 120 240 90 S400 60 480 90 V120 H0Z" />
          </svg>
        </div>
        <button className="collapse" onClick={() => setCollapsed((c) => !c)} aria-label="Recolher menu">
          {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
        </button>
      </aside>
      <main className="content" id="main" tabIndex={-1} ref={main}>{children}</main>
      <LoginModal />
    </div>
  )
}
