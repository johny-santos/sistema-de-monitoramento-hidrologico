# Roteiro para a apresentação (10 minutos)

## Antes (5 min antes de começar)
1. Dê **dois cliques em `iniciar.bat`**. Ele prepara tudo e abre o site em http://127.0.0.1:8000/
   (se quiser dados mais recentes: `iniciar.bat dados`).
2. Deixe o 3D no modo **Leve** (já é o padrão). Se o computador for fraco, use **Off**.
3. Abra uma aba com a documentação: http://127.0.0.1:8000/api/docs/ e outra com `/admin/`.
4. Tenha o usuário e a senha do admin à mão (o mesmo do `createsuperuser`).

## Sequência sugerida
| Tempo | Tela | O que mostrar |
|---|---|---|
| 0:00 | **Início** | Problema e objetivo. Indicadores, gráficos de 24 h e o aviso de dados simulados. |
| 1:30 | **Vale 3D** | Estações com casinhas no rio; clique numa casa e veja os gráficos mudarem. Mencione Leve/Alto/Off. |
| 3:00 | **Estações** | Busca e filtros por rio e município; cards com nível e chuva. |
| 4:00 | **Detalhe** | Medidor 3D de nível, janelas 12/24/48/72 h, 2D e 3D, estatísticas (mín/média/máx). |
| 5:30 | **Observações** | Filtros, atalhos de período, ordenação, exportar CSV. |
| 6:30 | **Login** | Entrar como administrador, cadastrar uma observação, ver o aviso e excluir. |
| 8:00 | **Sobre** | Arquitetura, modelo de dados, rotas da API. |
| 9:00 | **Swagger** | Testar `GET /api/stations/{id}/series/` ao vivo. Fechar com testes (53 + 24). |

## Se algo der errado
- **Página em branco / "Não foi possível carregar"**: o servidor parou. Rode `iniciar.bat` de novo.
- **3D lento**: botão **Off** no card do Vale (a versão 2D continua completa).
- **Porta 8000 ocupada**: feche outras janelas do servidor; o `iniciar.bat` reaproveita o que já está rodando.
- **Atualizar a página**: Ctrl+F5.
