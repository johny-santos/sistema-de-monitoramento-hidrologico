// Auditoria de acessibilidade (WCAG 2.x A/AA) com axe-core. Requer o servidor rodando.
import { chromium } from 'playwright-core'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const BASE = process.env.BASE || 'http://127.0.0.1:8000'
const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const axePath = require.resolve('axe-core/axe.min.js')
const b = await chromium.launch({ executablePath: CHROME })
const p = await b.newPage({ viewport: { width: 1366, height: 900 } })
let total = 0
for (const r of ['/', '/estacoes', '/estacoes/EST-01', '/observacoes', '/sobre']) {
  await p.goto(BASE + r, { waitUntil: 'networkidle' }); await p.waitForTimeout(1200)
  await p.addScriptTag({ path: axePath })
  const res = await p.evaluate(() => window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'] } }))
  console.log(`\n${r}: ${res.violations.length} tipo(s) de problema`)
  for (const v of res.violations) {
    total += v.nodes.length
    console.log(`  [${v.impact}] ${v.id}: ${v.help} (${v.nodes.length}x)`)
    v.nodes.slice(0, 2).forEach((n) => console.log('      ' + n.target.join(' ').slice(0, 90) + (n.any[0]?.message ? ' | ' + n.any[0].message.slice(0, 110) : '')))
  }
}
await b.close()
console.log(`\nTotal de elementos com problema: ${total}`)
process.exit(total ? 1 : 0)
