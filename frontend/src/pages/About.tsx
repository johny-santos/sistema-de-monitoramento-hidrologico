import { motion } from 'framer-motion'
import {
  AlertTriangle, ArrowRight, BookOpen, Boxes, Check, CloudRain, Copy, Database, FileSpreadsheet, GitBranch, Globe, KeyRound, LayoutDashboard, Lock,
  Radio, Server, Shield, Sparkles, Table2, TestTube2, Users, Waves, Zap,
} from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import Logo from '../components/Logo'
import Page, { stagger } from '../components/Page'
import { useObservations, useStations } from '../lib/hooks'
import { useTitle } from '../lib/useTitle'

/* ---------- dados estáticos da página ---------- */
const STACK = [
  { name: 'Python 3.12 + Django 6', role: 'Framework web, ORM e migrações', tone: 'green' },
  { name: 'Django REST Framework', role: 'API REST, filtros, paginação e token', tone: 'green' },
  { name: 'drf-spectacular', role: 'Swagger UI, Redoc e schema OpenAPI', tone: 'green' },
  { name: 'SQLite', role: 'Banco local (db.sqlite3)', tone: 'green' },
  { name: 'React 19 + TypeScript', role: 'Interface em páginas (SPA)', tone: 'blue' },
  { name: 'Vite', role: 'Build rápido e proxy de desenvolvimento', tone: 'blue' },
  { name: 'Chart.js', role: 'Gráficos 2D de nível e chuva', tone: 'blue' },
  { name: 'Three.js (R3F)', role: 'Vale 3D, medidor e gráfico 3D', tone: 'blue' },
  { name: 'TanStack Query', role: 'Cache e sincronização com a API', tone: 'blue' },
  { name: 'Framer Motion', role: 'Transições de tela', tone: 'blue' },
]

const API_ROUTES: { m: string; path: string; desc: string; auth?: boolean }[] = [
  { m: 'GET', path: '/api/', desc: 'Raiz da API (links para os recursos)' },
  { m: 'GET', path: '/api/stations/', desc: 'Lista estações. Filtros: search, river, municipality, ordering, page' },
  { m: 'POST', path: '/api/stations/', desc: 'Cadastra uma estação', auth: true },
  { m: 'GET', path: '/api/stations/{id}/', desc: 'Detalha uma estação' },
  { m: 'PUT', path: '/api/stations/{id}/', desc: 'Atualiza (também PATCH)', auth: true },
  { m: 'DELETE', path: '/api/stations/{id}/', desc: 'Exclui a estação e suas observações', auth: true },
  { m: 'GET', path: '/api/stations/{id}/summary/', desc: 'Dados da estação + última leitura de cada métrica' },
  { m: 'GET', path: '/api/stations/{id}/series/', desc: 'Série temporal: metric=level|rain e hours=1..72' },
  { m: 'GET', path: '/api/observations/', desc: 'Lista leituras. Filtros: station, metric, source, observed_after, observed_before, ordering, page' },
  { m: 'POST', path: '/api/observations/', desc: 'Registra uma leitura', auth: true },
  { m: 'GET', path: '/api/observations/{id}/', desc: 'Detalha uma leitura' },
  { m: 'PUT', path: '/api/observations/{id}/', desc: 'Atualiza (também PATCH)', auth: true },
  { m: 'DELETE', path: '/api/observations/{id}/', desc: 'Exclui a leitura', auth: true },
  { m: 'POST', path: '/api/token/', desc: 'Troca usuário e senha por um token de acesso' },
  { m: 'GET', path: '/api/schema/', desc: 'Schema OpenAPI (YAML/JSON)' },
  { m: 'GET', path: '/api/docs/', desc: 'Documentação interativa (Swagger UI)' },
  { m: 'GET', path: '/api/redoc/', desc: 'Documentação de referência (Redoc)' },
  { m: 'GET', path: '/admin/', desc: 'Painel administrativo do Django', auth: true },
]

const SITE_ROUTES = [
  { to: '/', icon: LayoutDashboard, name: 'Início', desc: 'Visão geral: indicadores, Vale 3D, gráficos de 24 h e estação selecionada.' },
  { to: '/estacoes', icon: Radio, name: 'Estações', desc: 'Todas as estações com busca, filtros por rio e município e ordenação.' },
  { to: '/estacoes/EST-01', icon: Waves, name: 'Detalhe da estação', desc: 'Medidor 3D, nível e chuva por 12, 24, 48 ou 72 h, em 2D ou 3D.', path: '/estacoes/:id' },
  { to: '/observacoes', icon: Table2, name: 'Observações', desc: 'Tabela de leituras com filtros, período, ordenação, paginação e CSV.' },
  { to: '/sobre', icon: BookOpen, name: 'Sobre', desc: 'Esta página: arquitetura, rotas e regras do projeto.' },
] as { to: string; icon: typeof Radio; name: string; desc: string; path?: string }[]

const RULES = [
  ['Horários em UTC', 'Sempre em ISO 8601; o site converte para o seu fuso ao exibir.'],
  ['Unidades fixas', 'Nível em metros (m) e chuva em milímetros por hora (mm/h), nunca misturadas.'],
  ['Janela de 1 a 72 horas', 'A série é contada a partir da última leitura da estação, não da hora atual.'],
  ['Lacunas não são inventadas', 'Leituras ausentes ficam vazias: sem preenchimento nem interpolação.'],
  ['Transparência dos dados', 'Tudo traz simulated: true. Os dados são sintéticos e não servem para alertas.'],
  ['Leitura pública, escrita com token', 'Qualquer pessoa consulta; cadastrar, editar e excluir exige login.'],
  ['Sem duplicidade', 'Uma estação não pode ter duas leituras da mesma métrica no mesmo instante.'],
]

const STEPS = [
  { t: 'Instale as dependências', c: 'pip install -r utilities/requirements.txt' },
  { t: 'Crie o banco e carregue os dados', c: 'python manage.py migrate\npython utilities/seed.js/seed.py\npython manage.py importar_csv' },
  { t: 'Crie um administrador', c: 'python manage.py createsuperuser' },
  { t: 'Suba tudo com um só comando', c: 'python manage.py runserver' },
]

const TEAM = [
  { name: 'Johny Oliveira Santos', user: 'johny-santos' },
  { name: 'Ana Luisa Santos de Oliveira', user: 'Nalu006' },
  { name: 'Victor Hugo da Silva Sousa', user: 'VictorHugodaSilvaSousa' },
]

const GithubMark = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z" /></svg>
)

/* ---------- peças pequenas ---------- */
function Section({ icon, title, sub, children, i = 0 }: { icon: ReactNode; title: string; sub?: string; children: ReactNode; i?: number }) {
  return (
    <motion.section className="ab-section" {...stagger(Math.min(i, 3))}>
      <header className="ab-head">
        <div className="ab-ico">{icon}</div>
        <div><h3>{title}</h3>{sub && <p>{sub}</p>}</div>
      </header>
      {children}
    </motion.section>
  )
}

function Code({ children }: { children: string }) {
  const [ok, setOk] = useState(false)
  const copy = () => {
    navigator.clipboard?.writeText(children).then(() => { setOk(true); setTimeout(() => setOk(false), 1400) }).catch(() => undefined)
  }
  return (
    <div className="code-block">
      <pre>{children}</pre>
      <button onClick={copy} aria-label="Copiar comando">{ok ? <Check size={15} /> : <Copy size={15} />}</button>
    </div>
  )
}

const FLOW = [
  { icon: FileSpreadsheet, t: 'seed.py', s: 'Gera 72 h de leituras sintéticas em observations.csv' },
  { icon: Database, t: 'importar_csv', s: 'Carrega estações e leituras no SQLite sem duplicar' },
  { icon: Server, t: 'Django + DRF', s: 'API REST com filtros, token, Swagger e Redoc' },
  { icon: Globe, t: 'React + 3D', s: 'Interface com gráficos, tabela e Vale 3D' },
]

/* ---------- página ---------- */
export default function About() {
  useTitle('Sobre o projeto')
  const stations = useStations().data
  const obs = useObservations({ page: 1 }).data

  return (
    <Page>
      {/* Hero */}
      <motion.section className="ab-hero" {...stagger(0)}>
        <div className="ab-hero-text">
          <span className="eyebrow"><Sparkles size={14} /> Desafio de Monitoramento Hidrológico · Cogmo Technology</span>
          <h2>HidroMonitor</h2>
          <p>
            Sistema que acompanha o <b>nível da água</b> e a <b>chuva</b> de rios em estações de medição: uma API REST em Django,
            uma interface web com gráficos e um vale em 3D onde cada estação aparece em seu lugar no rio.
          </p>
          <div className="ab-badges">
            {['Django 6', 'DRF', 'React 19', 'Three.js', 'Chart.js', 'SQLite', '24 testes de API', '24 testes de interface'].map((b) => <span key={b}>{b}</span>)}
          </div>
        </div>
        <div className="ab-hero-side">
          <div className="ab-logo"><Logo size={92} /></div>
          <div className="ab-numbers">
            <div><b>{stations?.length ?? '—'}</b><span>estações</span></div>
            <div><b>{obs ? obs.count.toLocaleString('pt-BR') : '—'}</b><span>leituras</span></div>
            <div><b>2</b><span>métricas</span></div>
            <div><b>72 h</b><span>de janela</span></div>
          </div>
        </div>
      </motion.section>

      <motion.div className="ab-warn" {...stagger(1)}>
        <AlertTriangle size={22} />
        <div>
          <strong>Dados simulados</strong>
          <p>Todas as estações e leituras são fictícias. Elas não representam rios reais e não devem ser usadas em alertas ou decisões de segurança.</p>
        </div>
      </motion.div>

      {/* Arquitetura */}
      <Section i={1} icon={<GitBranch size={20} />} title="Como funciona" sub="Do dado gerado até a tela, em quatro passos.">
        <ol className="flow">
          {FLOW.map(({ icon: Icon, t, s }, i) => (
            <li key={t}>
              <div className="flow-card"><span className="flow-n">{i + 1}</span><Icon size={24} /><b>{t}</b><small>{s}</small></div>
              {i < FLOW.length - 1 && <ArrowRight className="flow-arrow" size={20} />}
            </li>
          ))}
        </ol>
      </Section>

      {/* Modelo de dados */}
      <Section i={2} icon={<Database size={20} />} title="Modelo de dados" sub="Uma estação possui muitas observações (1:N).">
        <div className="erd">
          <div className="entity">
            <header><Radio size={16} /> Station</header>
            <ul>
              <li><b>id</b><i>PK</i><span>texto (até 10)</span></li>
              <li><b>name</b><span>texto</span></li>
              <li><b>river</b><span>texto</span></li>
              <li><b>municipality</b><span>texto</span></li>
            </ul>
          </div>
          <div className="rel"><span>1</span><i /><span>N</span></div>
          <div className="entity">
            <header><Table2 size={16} /> Observation</header>
            <ul>
              <li><b>id</b><i>PK</i><span>inteiro</span></li>
              <li><b>station</b><i className="fk">FK</i><span>→ Station</span></li>
              <li><b>metric</b><span>level | rain</span></li>
              <li><b>observed_at</b><span>data e hora (UTC)</span></li>
              <li><b>value</b><span>decimal</span></li>
              <li><b>unit</b><span>m | mm/h</span></li>
              <li><b>source</b><span>padrão: synthetic</span></li>
            </ul>
          </div>
        </div>
        <p className="ab-note"><Lock size={14} /> Restrição única em (station, metric, observed_at): evita duas leituras iguais no mesmo instante.</p>
      </Section>

      {/* Rotas da API */}
      <Section i={3} icon={<Server size={20} />} title="Rotas da API" sub="Todas as rotas disponíveis. O cadeado indica que exige token.">
        <div className="routes-table">
          {API_ROUTES.map((r, i) => (
            <div className="rt-row" key={r.m + r.path + i}>
              <span className={`method ${r.m.toLowerCase()}`}>{r.m}</span>
              <code>{r.path}</code>
              <span className="rt-desc">{r.desc}</span>
              <span className={`rt-auth ${r.auth ? 'locked' : ''}`}>{r.auth ? <><Lock size={13} /> token</> : 'público'}</span>
            </div>
          ))}
        </div>
        <p className="ab-note"><KeyRound size={14} /> Autenticação: envie o cabeçalho <code>Authorization: Token &lt;sua_chave&gt;</code>, obtido em <code>POST /api/token/</code>.</p>
        <Code>{`curl "http://127.0.0.1:8000/api/stations/EST-01/series/?metric=level&hours=24"`}</Code>
      </Section>

      {/* Rotas do site */}
      <Section i={4} icon={<Globe size={20} />} title="Telas do site" sub="Cada endereço do menu e o que ele mostra.">
        <div className="site-routes">
          {SITE_ROUTES.map(({ to, icon: Icon, name, desc, path }) => (
            <Link to={to} key={to} className="sr-card">
              <span className="sr-ico"><Icon size={20} /></span>
              <div><b>{name}</b><code>{path ?? to}</code><p>{desc}</p></div>
              <ArrowRight size={16} className="sr-go" />
            </Link>
          ))}
        </div>
      </Section>

      {/* Documentação e admin */}
      <Section i={5} icon={<BookOpen size={20} />} title="Documentação e administração" sub="Ferramentas prontas para explorar e gerir a API.">
        <div className="doc-links">
          <a href="/api/docs/" target="_blank" rel="noreferrer"><BookOpen size={20} /><b>Swagger UI</b><small>Teste os endpoints no navegador</small></a>
          <a href="/api/redoc/" target="_blank" rel="noreferrer"><Boxes size={20} /><b>Redoc</b><small>Referência completa da API</small></a>
          <a href="/admin/" target="_blank" rel="noreferrer"><Shield size={20} /><b>Painel Admin</b><small>Gerencie estações e leituras</small></a>
        </div>
      </Section>

      {/* Tecnologias */}
      <Section i={6} icon={<Boxes size={20} />} title="Tecnologias" sub="Backend em Python e frontend em React.">
        <div className="stack">
          {STACK.map((s) => (
            <div key={s.name} className={`stack-item ${s.tone}`}><b>{s.name}</b><small>{s.role}</small></div>
          ))}
        </div>
      </Section>

      {/* Regras */}
      <Section i={7} icon={<Shield size={20} />} title="Regras de negócio" sub="O que o sistema garante sobre os dados.">
        <ul className="rules">
          {RULES.map(([t, d]) => <li key={t}><Check size={16} /><div><b>{t}</b><span>{d}</span></div></li>)}
        </ul>
      </Section>

      {/* Desempenho e qualidade */}
      <Section i={8} icon={<Zap size={20} />} title="Desempenho e qualidade" sub="Feito para abrir leve e não travar na apresentação.">
        <div className="perf">
          <div><Zap size={20} /><b>Vale 3D em 3 níveis</b><span>Leve (estático, padrão), Alto (animado, volta ao Leve sozinho se ficar lento) e Off.</span></div>
          <div><CloudRain size={20} /><b>Dados vivos na cena</b><span>A chuva média e o nível da estação selecionada mudam a cena 3D.</span></div>
          <div><TestTube2 size={20} /><b>Testado</b><span>24 testes de API e 24 de navegador cobrem rotas, filtros, login e falhas.</span></div>
        </div>
      </Section>

      {/* Como rodar */}
      <Section i={9} icon={<Zap size={20} />} title="Como rodar" sub="Do zero até o sistema no ar.">
        <ol className="steps">
          {STEPS.map((s, i) => (
            <li key={s.t}><span className="step-n">{i + 1}</span><div><b>{s.t}</b><Code>{s.c}</Code></div></li>
          ))}
        </ol>
        <p className="ab-note">Abra <code>http://127.0.0.1:8000/</code>. O comando <code>runserver</code> também compila o frontend sozinho.</p>
      </Section>

      {/* Equipe */}
      <Section i={10} icon={<Users size={20} />} title="Equipe" sub="Grupo responsável pelo backend; o frontend segue a mesma identidade.">
        <div className="team">
          {TEAM.map((m) => (
            <a key={m.user} className="member" href={`https://github.com/${m.user}`} target="_blank" rel="noreferrer" aria-label={`GitHub de ${m.name}`}>
              <span className="avatar-s big">{m.name.split(' ').slice(0, 2).map((w) => w[0]).join('')}</span>
              <div><b>{m.name}</b><small><GithubMark /> @{m.user}</small></div>
              <ArrowRight size={16} className="sr-go" />
            </a>
          ))}
        </div>
      </Section>

      <p className="credits">
        Fotos: Bureau of Land Management (Oregon e Washington), domínio público, via Wikimedia Commons
        (séries “North Umpqua”, “Rogue” e “Klamath Wild and Scenic River”). Imagens ilustrativas: não correspondem às estações simuladas.
      </p>
    </Page>
  )
}
