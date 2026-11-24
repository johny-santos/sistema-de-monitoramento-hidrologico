// Auditoria profunda no navegador. Requer: runserver rodando + dados de borda Z-1..Z-5 e usuário qa_admin/Qa-admin-12345
// (veja e2e/README.md). Uso: node e2e/deep.mjs
import { chromium } from 'playwright-core'

const BASE = process.env.BASE || 'http://127.0.0.1:8000'
const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const ARGS = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
const USER = 'qa_admin', PASS = 'Qa-admin-12345'

let failed = 0
const results = []
const ok = (name, cond, extra = '') => { results.push([cond, name, extra]); console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  → ' + extra : ''}`); if (!cond) failed++ }

const browser = await chromium.launch({ executablePath: CHROME, args: ARGS })

/** Contexto com coleta de erros, avisos e requisições falhas. */
async function open(opts = {}, init) {
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 }, acceptDownloads: true, ...opts })
  if (init) await ctx.addInitScript(init)
  const page = await ctx.newPage()
  const log = { errors: [], warns: new Set(), bad: [] }
  page.on('pageerror', (e) => log.errors.push('PAGEERROR ' + e.message))
  page.on('console', (m) => {
    const t = m.text()
    if (m.type() === 'error' && !/status of (400|401|404)/.test(t)) log.errors.push(t.slice(0, 200))
    if (m.type() === 'warning' && !/THREE\.Clock/.test(t)) log.warns.add(t.slice(0, 160))
  })
  page.on('response', (r) => { if (r.status() >= 500) log.bad.push(`${r.status()} ${r.url()}`) })
  page.on('requestfailed', (r) => { if (!/aborted|ERR_ABORTED/.test(r.failure()?.errorText || '')) log.bad.push(`FAILED ${r.url()} ${r.failure()?.errorText}`) })
  return { ctx, page, log }
}
const go = async (page, path, wait = 900) => { await page.goto(BASE + path, { waitUntil: 'networkidle' }); await page.waitForTimeout(wait) }
const clean = (log) => log.errors.length === 0 && log.bad.length === 0
const detail = (log) => [...log.errors, ...log.bad].slice(0, 3).join(' | ')

// ======================= A. Rotas diretas, recarregar, voltar/avançar =======================
{
  const { ctx, page, log } = await open()
  const routes = ['/', '/estacoes', '/estacoes/EST-01', '/estacoes/EST-04', '/estacoes/Z-1', '/estacoes/NAO-EXISTE', '/observacoes', '/sobre', '/rota/inexistente']
  for (const r of routes) {
    await go(page, r)
    const body = (await page.textContent('body')) || ''
    ok(`A. Rota direta ${r} renderiza`, body.length > 200 && (await page.locator('.sidebar').count()) === 1)
  }
  ok('A. Rotas diretas sem erros/5xx', clean(log), detail(log))

  await go(page, '/estacoes/EST-01'); await page.reload({ waitUntil: 'networkidle' }); await page.waitForTimeout(700)
  ok('A. F5 na página de detalhe mantém a estação', (await page.textContent('h2')).includes('Aurora'))

  await go(page, '/'); await page.click('a[href="/estacoes"]'); await page.waitForTimeout(500)
  await page.click('.station-card a >> nth=1'); await page.waitForTimeout(900)
  await page.click('a[href="/observacoes"]'); await page.waitForTimeout(600)
  await page.goBack(); await page.waitForTimeout(700)
  ok('A. Voltar leva ao detalhe', page.url().includes('/estacoes/EST-02'))
  await page.goBack(); await page.waitForTimeout(500); await page.goForward(); await page.waitForTimeout(500)
  ok('A. Voltar/avançar sem quebrar', (await page.locator('.sidebar').count()) === 1 && clean(log), detail(log))
  await ctx.close()
}

// ======================= B. Responsivo: sem rolagem horizontal =======================
{
  const sizes = [[360, 740], [390, 844], [768, 1024], [1024, 768], [1280, 720], [1920, 1080]]
  const { ctx, page, log } = await open()
  for (const [w, h] of sizes) {
    await page.setViewportSize({ width: w, height: h })
    for (const r of ['/', '/estacoes', '/estacoes/EST-01', '/observacoes', '/sobre']) {
      await go(page, r, 500)
      const over = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth }))
      ok(`B. ${w}px ${r}: sem rolagem horizontal`, over.sw <= over.iw + 1, `scrollWidth ${over.sw} > ${over.iw}`)
    }
  }
  ok('B. Responsivo sem erros', clean(log), detail(log))
  await ctx.close()
}

// ======================= C. Login e CRUD pela interface =======================
{
  const { ctx, page, log } = await open()
  await go(page, '/estacoes')
  ok('C. Sem login: sem botões de excluir', (await page.locator('.station-card .del').count()) === 0)
  await page.click('.btn-primary:has-text("Nova estação")'); await page.waitForTimeout(400)
  ok('C. "Nova estação" sem login abre o login', (await page.locator('.modal[aria-label^="Entrar"]').count()) === 1)
  await page.fill('input[autocomplete=username]', USER); await page.fill('input[type=password]', 'errada'); await page.click('.modal .btn-primary'); await page.waitForTimeout(900)
  ok('C. Login errado mostra erro claro', (await page.textContent('.form-error')).includes('incorretos'))
  await page.fill('input[type=password]', PASS); await page.click('.modal .btn-primary'); await page.waitForSelector('.side-user .who b:has-text("qa_admin")', { timeout: 15000 }).catch(() => {})
  ok('C. Login correto', (await page.textContent('.side-user .who b')) === USER)
  ok('C. Token salvo e botões de excluir aparecem', (await page.locator('.station-card .del').count()) >= 5)

  // estação: válida, duplicada, inválida
  await page.click('.btn-primary:has-text("Nova estação")'); await page.waitForTimeout(400)
  const fill = async (id, name = 'QA Nova', river = 'Rio N', city = 'Cidade N') => {
    const ins = page.locator('.modal input')
    await ins.nth(0).fill(id); await ins.nth(1).fill(name); await ins.nth(2).fill(river); await ins.nth(3).fill(city)
  }
  await fill('Q-1'); await page.click('.modal .btn-primary'); await page.waitForTimeout(1200)
  ok('C. Cria estação', (await page.locator('.station-card:has-text("QA Nova")').count()) === 1)
  await page.click('.btn-primary:has-text("Nova estação")'); await page.waitForTimeout(400)
  await fill('Q-1'); await page.click('.modal .btn-primary'); await page.waitForTimeout(900)
  ok('C. Estação duplicada: erro amigável (sem 500)', /já existe/i.test((await page.textContent('.form-error')) || ''), await page.textContent('.form-error'))
  await page.keyboard.press('Escape')
  await page.waitForSelector('.modal', { state: 'detached', timeout: 4000 }).catch(() => {})   // espera a animação de saída
  ok('C. Esc fecha o modal', (await page.locator('.modal').count()) === 0)
  await page.click('.station-card:has-text("QA Nova") .del'); await page.click('.modal .btn-danger'); await page.waitForTimeout(1200)
  ok('C. Exclui estação', (await page.locator('.station-card:has-text("QA Nova")').count()) === 0)

  // observação: válida, duplicada, valor inválido
  await go(page, '/observacoes')
  const before = Number((await page.textContent('.mini-stats > div >> nth=0')).replace(/\D/g, '').slice(-4)) || 0
  await page.click('.btn-primary:has-text("Nova observação")'); await page.waitForTimeout(400)
  await page.locator('.modal input[type=datetime-local]').fill('2026-12-01T10:00')
  await page.locator('.modal input[inputmode=decimal]').fill('1,77'); await page.click('.modal .btn-primary'); await page.waitForTimeout(1300)
  ok('C. Cria observação', (await page.locator('.modal').count()) === 0)
  await page.click('.btn-primary:has-text("Nova observação")'); await page.waitForTimeout(400)
  await page.locator('.modal input[type=datetime-local]').fill('2026-12-01T10:00')
  await page.locator('.modal input[inputmode=decimal]').fill('1,77'); await page.click('.modal .btn-primary'); await page.waitForTimeout(900)
  ok('C. Observação duplicada: erro amigável', /Já existe uma observação/.test((await page.textContent('.form-error')) || ''), await page.textContent('.form-error'))
  await page.locator('.modal input[inputmode=decimal]').fill('abc'); await page.locator('.modal input[type=datetime-local]').fill('2026-12-02T10:00')
  await page.click('.modal .btn-primary'); await page.waitForTimeout(900)
  ok('C. Valor inválido: erro amigável', /número válido/i.test((await page.textContent('.form-error')) || ''), await page.textContent('.form-error'))
  await page.keyboard.press('Escape'); await page.waitForTimeout(300)
  await page.click('.table tbody tr:first-child .icon-btn.danger'); await page.click('.modal .btn-danger'); await page.waitForTimeout(1300)
  const stillThere = await page.locator('.table tbody td:has-text("dez")').count()
  ok('C. Exclui a observação criada', stillThere === 0, `linhas de dez: ${stillThere}`)

  // token inválido no navegador: leituras públicas continuam funcionando
  await page.evaluate(() => localStorage.setItem('hidro.token', 'token-invalido'))
  await go(page, '/estacoes')
  ok('C. Token inválido guardado: página ainda carrega (repete sem token)', (await page.locator('.station-card').count()) >= 5)
  ok('C. Token inválido é descartado', (await page.evaluate(() => localStorage.getItem('hidro.token'))) === null)
  await page.evaluate(() => { localStorage.removeItem('hidro.token') })
  ok('C. CRUD sem erros de console/5xx', clean(log), detail(log))
  await ctx.close()
}

// ======================= D. Filtros combinados, ordenação e CSV =======================
{
  const { ctx, page, log } = await open()
  await go(page, '/observacoes')
  const total = async () => Number((await page.textContent('.mini-stats > div >> nth=0 >> b')).replace(/\./g, ''))
  const all = await total()
  await page.selectOption('.fp-grid label.pill-select >> nth=0 >> select', 'EST-01'); await page.waitForTimeout(900)
  const est1 = await total()
  await page.click('.fp-grid .seg button:has-text("Chuva")'); await page.waitForTimeout(900)
  const rain1 = await total()
  ok('D. Filtros estação + métrica reduzem o total', all > est1 && est1 > rain1 && rain1 > 0, `${all} > ${est1} > ${rain1}`)
  await page.click('.presets button:has-text("Últimas 24h")'); await page.waitForTimeout(1000)
  const h24 = await total()
  ok('D. Atalho 24h restringe o período', h24 > 0 && h24 <= 25, `registros: ${h24}`)
  await page.click('.table thead th:nth-child(4) button'); await page.waitForTimeout(800)
  const vals = await page.$$eval('.table tbody tr td:nth-child(4) b', (els) => els.map((e) => Number(e.textContent.replace(',', '.'))))
  ok('D. Ordenar por valor (desc) está correto', vals.every((v, i) => i === 0 || vals[i - 1] >= v), vals.slice(0, 5).join(', '))
  await page.click('.table thead th:nth-child(4) button'); await page.waitForTimeout(800)
  const vals2 = await page.$$eval('.table tbody tr td:nth-child(4) b', (els) => els.map((e) => Number(e.textContent.replace(',', '.'))))
  ok('D. Ordenar por valor (asc) está correto', vals2.every((v, i) => i === 0 || vals2[i - 1] <= v))
  // CSV
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 20000 }), page.click('button:has-text("Exportar CSV")')])
  const path = await dl.path()
  const { readFileSync } = await import('node:fs')
  const csv = readFileSync(path, 'utf8').split('\n').filter(Boolean)
  ok('D. CSV exportado tem cabeçalho e todas as linhas filtradas', csv.length === h24 + 1 && csv[0].startsWith('\ufeffestacao;metrica'), `${csv.length - 1} linhas vs ${h24}`)
  await page.click('.fp-head .link-btn'); await page.waitForTimeout(900)
  ok('D. "Limpar tudo" volta ao total', (await total()) === all)
  // período invertido / vazio
  await page.locator('.dt input >> nth=0').fill('2030-01-01T00:00'); await page.waitForTimeout(900)
  ok('D. Período sem dados: estado vazio', (await page.locator('.table-card .empty').count()) === 1)
  // paginação até o fim e volta
  await page.click('.fp-head .link-btn'); await page.waitForTimeout(800)
  const pages = Number((await page.textContent('.pager div b')).split('/')[1])
  for (let i = 1; i < pages; i++) await page.click('.pager button[aria-label="Próxima página"]')
  await page.waitForTimeout(900)
  ok('D. Última página: botão "próxima" desabilita', await page.locator('.pager button[aria-label="Próxima página"]').isDisabled())
  // estações: combinações
  await go(page, '/estacoes')
  await page.selectOption('.toolbar label >> nth=1 >> select', 'Rio Verde'); await page.waitForTimeout(800)
  ok('D. Estações: filtro por rio', (await page.locator('.station-card').count()) === 1)
  await page.selectOption('.toolbar label >> nth=2 >> select', 'Campo Alto'); await page.waitForTimeout(800)
  ok('D. Estações: rio + município sem interseção = vazio', (await page.locator('.empty').count()) === 1)
  await page.click('.result-bar .link-btn'); await page.waitForTimeout(800)
  await page.selectOption('.toolbar label >> nth=3 >> select', 'name'); await page.waitForTimeout(800)
  const names = await page.$$eval('.station-card h3', (e) => e.map((x) => x.textContent))
  ok('D. Estações: ordenar por nome', names.join('|') === [...names].sort((a, b) => a.localeCompare(b, 'pt')).join('|'), names.join(', '))
  await page.fill('.tb-search input', "' OR 1=1 --<script>alert(1)</script>"); await page.waitForTimeout(900)
  ok('D. Busca com SQL/HTML malicioso é inofensiva', (await page.locator('.empty').count()) === 1 && (await page.locator('script:has-text("alert")').count()) === 0)
  ok('D. Filtros sem erros', clean(log), detail(log))
  await ctx.close()
}

// ======================= E. Gráficos e 3D com dados de borda =======================
{
  const { ctx, page, log } = await open()
  const cases = [
    ['EST-01', 'normal'], ['EST-03', 'unidade mm misturada'], ['EST-04', 'sem nenhuma leitura'],
    ['Z-1', 'uma única leitura'], ['Z-2', 'série plana (valores iguais)'], ['Z-3', 'valores enormes'],
    ['Z-4', 'só chuva, com buracos'], ['Z-5', 'pico isolado + nome enorme'],
  ]
  for (const [id, what] of cases) {
    for (const mode of ['2D', '3D']) {
      for (const metric of ['Nível do Rio', 'Chuva']) {
        await go(page, `/estacoes/${id}`, 500)
        await page.click(`.seg.mode button:has-text("${mode}")`)
        await page.click(`.tabs button:has-text("${metric}")`)
        await page.waitForTimeout(mode === '3D' ? 1800 : 600)
        const hasCard = (await page.locator('.card.big').count()) === 1
        const noCrash = (await page.locator('.state.error').count()) === 0
        ok(`E. ${id} (${what}) ${mode} ${metric}`, hasCard && noCrash && log.errors.length === 0, log.errors.slice(0, 1).join(''))
        log.errors.length = 0
      }
    }
    // todas as janelas
    for (const h of [12, 24, 48, 72]) {
      await page.click(`.seg:not(.mode) button:has-text("${h}h")`); await page.waitForTimeout(350)
    }
    ok(`E. ${id}: trocar janelas 12/24/48/72h sem erro`, log.errors.length === 0, log.errors.join('|').slice(0, 150))
    log.errors.length = 0
  }
  // gráficos do Início com estação sem dados
  await go(page, '/')
  for (let i = 0; i < 6; i++) { await page.click('.card.selected .steppers button[aria-label="Próxima estação"]'); await page.waitForTimeout(250) }
  ok('E. Início: percorrer todas as estações (incluindo sem dados)', log.errors.length === 0, log.errors.slice(0, 2).join('|'))
  ok('E. Gráficos sem erros/5xx', clean(log), detail(log))
  ok('E. Nenhum aviso inesperado do console', log.warns.size === 0, [...log.warns].slice(0, 3).join(' | '))
  await ctx.close()
}

// ======================= F. Falhas de rede e API lenta =======================
{
  const { ctx, page, log } = await open()
  await page.route('**/api/observations/**', (r) => r.abort())
  await go(page, '/observacoes', 1500)
  ok('F. Observações com API caída: erro visível (sem tela branca)', (await page.locator('.state.error').count()) >= 1)
  await page.unroute('**/api/observations/**')
  await page.route('**/api/stations/**', (r) => r.fulfill({ status: 500, contentType: 'application/json', body: '{"detail":"boom"}' }))
  await go(page, '/estacoes', 2000)
  ok('F. Estações com API 500: erro visível', (await page.locator('.state.error').count()) >= 1)
  await page.unroute('**/api/stations/**')
  await page.route('**/api/stations/**', async (r) => { await new Promise((s) => setTimeout(s, 2500)); try { await r.continue() } catch { /* rota já removida */ } })
  await page.goto(BASE + '/estacoes'); await page.waitForTimeout(800)
  ok('F. API lenta: mostra "carregando"', (await page.locator('.spinner').count()) >= 1)
  await page.waitForTimeout(4500)
  ok('F. API lenta: conteúdo aparece depois', (await page.locator('.station-card').count()) >= 5)
  await page.unroute('**/api/stations/**')
  await page.route('**/api/stations/*/series/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"oops":true}' }))
  await go(page, '/estacoes/EST-01', 1500)
  ok('F. Resposta com formato inesperado: erro tratado, sem tela branca', (await page.locator('.sidebar').count()) === 1 && (await page.locator('.state.error').count()) >= 1)
  await ctx.close()
}

// ======================= G. Acessibilidade básica =======================
{
  const { ctx, page } = await open()
  for (const r of ['/', '/estacoes', '/observacoes', '/sobre', '/estacoes/EST-01']) {
    await go(page, r, 700)
    const issues = await page.evaluate(() => {
      const out = []
      document.querySelectorAll('img').forEach((i) => { if (!i.hasAttribute('alt')) out.push('img sem alt: ' + i.src.split('/').pop()) })
      document.querySelectorAll('button').forEach((b) => { if (!(b.textContent || '').trim() && !b.getAttribute('aria-label') && !b.title) out.push('botão sem nome') })
      document.querySelectorAll('a').forEach((a) => { if (!(a.textContent || '').trim() && !a.getAttribute('aria-label')) out.push('link sem nome: ' + a.getAttribute('href')) })
      document.querySelectorAll('input:not([type=hidden]), select').forEach((el) => {
        const named = el.getAttribute('aria-label') || el.closest('label') || (el.id && document.querySelector(`label[for="${el.id}"]`))
        if (!named) out.push('campo sem rótulo: ' + (el.getAttribute('placeholder') || el.tagName))
      })
      if (!document.title) out.push('sem <title>')
      if (!document.documentElement.lang) out.push('sem lang')
      return out
    })
    ok(`G. Acessibilidade ${r}`, issues.length === 0, issues.slice(0, 4).join('; '))
  }
  await go(page, '/estacoes'); await page.keyboard.press('Tab')
  const focusVisible = await page.evaluate(() => document.activeElement && document.activeElement !== document.body)
  ok('G. Teclado: Tab move o foco', focusVisible)
  await ctx.close()
}

// ======================= H. Vazamento: navegar muito =======================
{
  const { ctx, page, log } = await open()
  await go(page, '/')
  const heap0 = await page.evaluate(() => performance.memory?.usedJSHeapSize || 0)
  const routes = ['/estacoes', '/estacoes/EST-01', '/observacoes', '/sobre', '/']
  for (let i = 0; i < 4; i++) {
    for (const r of routes) {
      await page.evaluate((p) => { history.pushState({}, '', p); dispatchEvent(new PopStateEvent('popstate')) }, r)
      await page.waitForTimeout(350)
    }
  }
  await page.waitForTimeout(800)
  const canv = await page.locator('canvas').count()
  const heap1 = await page.evaluate(() => performance.memory?.usedJSHeapSize || 0)
  ok('H. 20 navegações: sem canvases acumulados', canv <= 4, `${canv} canvases`)
  ok('H. 20 navegações: memória JS estável (<60 MB de crescimento)', heap1 - heap0 < 60e6, `+${((heap1 - heap0) / 1e6).toFixed(1)} MB`)
  ok('H. Navegação intensa sem erros', clean(log), detail(log))
  ok('H. Sem aviso de "Too many WebGL contexts"', ![...log.warns].some((w) => /WebGL/i.test(w)), [...log.warns].join('|').slice(0, 150))
  await ctx.close()
}

await browser.close()
console.log(failed ? `\n${failed} verificação(ões) falharam de ${results.length}` : `\nTodas as ${results.length} verificações passaram`)
process.exit(failed ? 1 : 0)
