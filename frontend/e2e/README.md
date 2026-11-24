# Testes de navegador

Usam `playwright-core` com o Chrome/Edge já instalado (sem baixar navegador).

| Script | O que cobre | Comando |
|---|---|---|
| `smoke.mjs` | Fluxo principal: rotas, filtros, 3D ligado/desligado, sem WebGL, API fora do ar | `npm run e2e` |
| `deep.mjs` | Auditoria profunda: rotas diretas, F5/voltar, responsivo (360 a 1920 px), login e CRUD, filtros combinados, CSV, gráficos com dados de borda, falhas de rede, acessibilidade, vazamento de memória | `node e2e/deep.mjs` |

Pré-requisito: `python manage.py runserver` rodando.

O `deep.mjs` precisa de dados de borda (estações `Z-1`…`Z-5`) e do usuário `qa_admin`.
Crie-os antes e remova depois (não mexe nas suas estações reais):

```
python utilities/qa_data.py setup
node e2e/deep.mjs
python utilities/qa_data.py cleanup
```

Variáveis: `BASE` (padrão `http://127.0.0.1:8000`) e `CHROME_PATH`.
