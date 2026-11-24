// Teste de fumaça no navegador. Pré-requisito: `python manage.py runserver` rodando.
//   npm i -D playwright-core   (uma vez)   e   npm run e2e
// Variáveis: BASE (padrão http://127.0.0.1:8000), CHROME_PATH (caminho do Chrome/Edge).
import { chromium } from 'playwright-core'

const BASE = process.env.BASE || 'http://127.0.0.1:8000'
const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const ARGS = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']

let failed = 0
const ok = (name, cond, extra = '') => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  ' + extra : ''}`); if (!cond) failed++ }

const browser = await chromium.launch({ executablePath: CHROME, args: ARGS })

async function session(init) {
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } })
  if (init) await ctx.addInitScript(init)
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (m) => {
    if (m.type() !== 'error') return
    const t = m.text()
    if (/status of (400|401|404)/.test(t)) return // erros HTTP esperados nos testes de validação
    errors.push(t)
  })
  return { ctx, page, errors }
}

// ---------- 1. fluxo normal ----------
{
  const { ctx, page, errors } = await session()
  const go = async (path) => { await page.goto(BASE + path, { waitUntil: 'networkidle' }); await page.waitForTimeout(700) }

  await go('/')
  ok('Início: KPIs e título', (await page.locator('.kpi').count()) === 4 && (await page.textContent('h2')).includes('Sistema de Monitoramento'))
  ok('Início: gráficos 2D renderizados', (await page.locator('canvas').count()) >= 2)
  await page.locator('.card.world').scrollIntoViewIfNeeded(); await page.waitForTimeout(2500)
  ok('Início: cena 3D (WebGL) montada', (await page.locator('.canvas-wrap canvas').count()) === 1)
  await page.click('.card.selected .steppers button[aria-label="Próxima estação"]')
  ok('Início: seta troca a estação selecionada', (await page.textContent('.card.selected h4')).includes('Vale Verde'))

  await go('/estacoes')
  ok('Estações: 5 cards', (await page.locator('.station-card').count()) === 5)
  await page.fill('.tb-search input', 'verde'); await page.waitForTimeout(900)
  ok('Estações: busca filtra pela API', (await page.locator('.station-card').count()) === 1)
  await page.fill('.tb-search input', 'zzzz'); await page.waitForTimeout(900)
  ok('Estações: estado vazio', (await page.locator('.empty').count()) === 1)
  await page.fill('.tb-search input', '')

  await go('/observacoes')
  ok('Observações: tabela com 100 linhas por página', (await page.locator('.table tbody tr').count()) === 100)
  await page.click('.pager button[aria-label="Próxima página"]'); await page.waitForTimeout(900)
  ok('Observações: paginação', (await page.textContent('.pager div b')).startsWith('2'))
  await page.click('.fp-grid .seg button:has-text("Chuva")'); await page.waitForTimeout(900)
  ok('Observações: filtro de métrica volta à página 1', (await page.textContent('.pager div b')).startsWith('1'))

  await go('/estacoes/EST-01')
  ok('Detalhe: medidor 3D e gráfico', (await page.locator('.gauge-card canvas').count()) === 1 && (await page.locator('.card.big canvas').count()) >= 1)
  await page.click('.seg.mode button:has-text("3D")'); await page.waitForTimeout(2500)
  ok('Detalhe: gráfico 3D', (await page.locator('.chart3d canvas').count()) === 1)

  await go('/estacoes/EST-04')
  ok('Detalhe: estação sem dados não quebra', (await page.locator('.state').count()) >= 1 && !(await page.locator('.state.error').count()))
  await go('/estacoes/NAO-EXISTE')
  ok('Detalhe: estação inexistente mostra erro tratado', (await page.locator('.state.error').count()) === 1)
  await go('/rota-que-nao-existe')
  ok('Rota desconhecida mostra a página 404', (await page.locator('.notfound').count()) === 1 && (await page.title()).includes('não encontrada'))
  await go('/sobre')
  ok('Sobre carrega', (await page.locator('.doc-links a').count()) === 3)

  ok('Sem erros de JavaScript/console', errors.length === 0, errors.slice(0, 3).join(' | '))
  await ctx.close()
}

// ---------- 2. 3D desligado ----------
{
  const { ctx, page, errors } = await session(() => localStorage.setItem('hidro.quality', 'off'))
  await page.goto(BASE + '/', { waitUntil: 'networkidle' }); await page.waitForTimeout(800)
  ok('3D off: não cria canvas 3D', (await page.locator('.canvas-wrap canvas').count()) === 0 && (await page.locator('.fallback3d').count()) === 1)
  await page.click('.fallback3d button'); await page.waitForTimeout(1500)
  ok('3D off: botão "Ativar 3D" religa', (await page.locator('.fallback3d button').count()) === 0)
  ok('3D off: sem erros', errors.length === 0, errors.slice(0, 3).join(' | '))
  await ctx.close()
}

// ---------- 3. navegador sem WebGL ----------
{
  const noGL = () => {
    const orig = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = function (type, ...a) { return /webgl/i.test(type) ? null : orig.call(this, type, ...a) }
  }
  const { ctx, page, errors } = await session(noGL)
  await page.goto(BASE + '/', { waitUntil: 'networkidle' }); await page.waitForTimeout(800)
  ok('Sem WebGL: Início abre com aviso no lugar do 3D', (await page.locator('.kpi').count()) === 4 && (await page.locator('.fallback3d').count()) === 1)
  await page.goto(BASE + '/estacoes/EST-01', { waitUntil: 'networkidle' }); await page.waitForTimeout(800)
  await page.click('.seg.mode button:has-text("3D")'); await page.waitForTimeout(800)
  ok('Sem WebGL: detalhe cai no gráfico 2D', (await page.locator('.card.big canvas').count()) >= 1)
  ok('Sem WebGL: sem erros', errors.length === 0, errors.slice(0, 3).join(' | '))
  await ctx.close()
}

// ---------- 4. API fora do ar ----------
{
  const { ctx, page } = await session()
  await page.route('**/api/**', (r) => r.abort())
  await page.goto(BASE + '/', { waitUntil: 'networkidle' }); await page.waitForTimeout(2500)
  ok('API fora do ar: mostra mensagem de erro (sem tela branca)', (await page.locator('.state.error').count()) >= 1)
  await ctx.close()
}

await browser.close()
console.log(failed ? `\n${failed} teste(s) falharam` : '\nTodos os testes passaram')
process.exit(failed ? 1 : 0)
