# 🌊 Sistema de Monitoramento Hidrológico — API (Backend)

API REST em **Python + Django** que simula o monitoramento de rios e lagos em **estações fictícias**, expondo leituras de **nível da água** e **chuva** ao longo do tempo. Desenvolvida como resposta ao *Desafio de Monitoramento Hidrológico* da **Cogmo Technology** (trilha **backend**).

> ⚠️ **Dados simulados.** Todas as estações e observações são sintéticas. Elas **não representam rios reais** e **não devem** ser usadas para alertas ou decisões de segurança.

## Sumário

1. [Sobre o projeto](#sobre-o-projeto)
2. [Tecnologias](#tecnologias)
3. [Estrutura do projeto](#estrutura-do-projeto)
4. [Como executar](#como-executar)
5. [Dados de demonstração (seed)](#dados-de-demonstração-seed)
6. [Autenticação de Admin](#autenticação-de-admin)
7. [Documentação da API](#documentação-da-api)
8. [Endpoints](#endpoints)
9. [Regras de negócio](#regras-de-negócio)
10. [Modelo de dados (MER + DER)](#modelo-de-dados-mer--der)
11. [Testes](#testes)
12. [Equipe](#equipe)

---

## Sobre o projeto

O desafio original foi proposto em Node.js/Express/SQLite; nesta versão ele foi realizado em **Python + Django**. A API:

- lista as estações disponíveis;
- retorna o resumo de uma estação (local e últimas leituras);
- retorna a série histórica de **nível (m)** ou **chuva (mm/h)** em uma janela de 1 a 72 horas;
- valida os parâmetros e responde com erros HTTP claros;
- é documentada automaticamente com **drf-spectacular** (Swagger/Redoc).

O script `seed.js` do desafio foi **adaptado para Python puro** (`seed.py`) e gera os dados sintéticos em **CSV**.

**Fora do escopo:** previsão por IA, sensores reais, alertas de risco, deploy e infraestrutura. O frontend (React) é uma trilha independente, feita por outra equipe.

---

## Tecnologias

| Tecnologia | Uso |
|---|---|
| Python 3.12 | Linguagem |
| Django | Framework web, ORM e migrações |
| Django REST Framework | Construção da API |
| drf-spectacular | Schema OpenAPI, Swagger UI e Redoc |
| SQLite | Banco de dados local (`db.sqlite3`) |

> As versões exatas das dependências estão em `utilities/requirements.txt`.

---

## Estrutura do projeto

```text
sistema-de-monitoramento-hidrologico/
├── manage.py
├── db.sqlite3                    # Banco SQLite local
├── dados_estacoes_excel.csv      # Dados gerados pelo seed
│
├── core/                         # Configuração do projeto Django
│   ├── settings.py
│   ├── urls.py                   # Rotas principais
│   ├── asgi.py
│   └── wsgi.py
│
├── monitoring/                   # App principal da API
│   ├── models.py                 # Modelos (tabelas)
│   ├── serializers.py            # Conversão modelo <-> JSON
│   ├── views.py                  # Endpoints
│   ├── urls.py                   # Rotas da app
│   ├── admin.py                  # Painel administrativo
│   ├── tests.py                  # Testes
│   ├── management/commands/      # Comandos personalizados do manage.py
│   └── migrations/               # Scripts de migração
│
├── docs/
│   └── img/                      # Imagens do MER e do DER
│
└── utilities/
    ├── requirements.txt          # Dependências
    └── seed.js/                  # Seed adaptado para Python
        └── seed.py
```

---

## Como executar

### Pré-requisitos

- **Python 3.12** (`python --version`)
- **Git** (`git --version`)

Não é necessária nenhuma chave de API, senha ou serviço externo.

### 1. Clonar o repositório

```bash
git clone https://github.com/johny-santos/sistema-de-monitoramento-hidrologico.git
cd sistema-de-monitoramento-hidrologico
```

### 2. Criar e ativar o ambiente virtual

**Windows (PowerShell):**

```powershell
python -m venv venv
venv\Scripts\Activate.ps1
```

> Se o PowerShell bloquear o script: `Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned`

**Linux / macOS:**

```bash
python3 -m venv venv
source venv/bin/activate
```

### 3. Instalar as dependências

```bash
pip install -r utilities/requirements.txt
```

### 4. Aplicar as migrações

```bash
python manage.py migrate
```

### 5. Carregar os dados de demonstração

Veja [Dados de demonstração (seed)](#dados-de-demonstração-seed).

### 6. Criar um usuário administrador

```bash
python manage.py createsuperuser
```

### 7. Iniciar o servidor

```bash
python manage.py runserver
```

A API ficará em **http://127.0.0.1:8000/**.

---

## Dados de demonstração (seed)

O `seed.js` original foi adaptado para Python em `utilities/seed.js/seed.py`. Ele gera as **estações fictícias** e suas **observações sintéticas** (horários em ISO 8601 / UTC) e exporta tudo para um arquivo **CSV**.

```bash
python utilities/seed.js/seed.py
```

> 📝 **CONFIRMAR:** nome e local do CSV gerado (hoje há `dados_estacoes_excel.csv` na raiz; o desafio pede `observations.csv`) e o comando que carrega o CSV no banco, por exemplo: `python manage.py <nome_do_comando>` (arquivo em `monitoring/management/commands/`).

As leituras ausentes (lacunas) **não são inventadas**: ficam como valor nulo.

---

## Autenticação de Admin

O projeto possui lógica de autenticação de administrador aplicada às rotas.

> 📝 **CONFIRMAR e preencher:** quais rotas exigem autenticação, como se autenticar (sessão do Django Admin, token, etc.) e um exemplo de requisição autenticada.

O painel administrativo do Django fica em **http://127.0.0.1:8000/admin/**.

---

## Documentação da API

> 📝 **CONFIRMAR as URLs** em `core/urls.py` (as abaixo são as convenções do drf-spectacular).

| Interface | URL |
|---|---|
| Swagger UI | http://127.0.0.1:8000/api/docs/ |
| Redoc | http://127.0.0.1:8000/api/redoc/ |
| Schema OpenAPI | http://127.0.0.1:8000/api/schema/ |

---

## Endpoints

| Método | Rota | Descrição |
|---|---|---|
| `GET` | `/api/stations` | Lista as estações |
| `GET` | `/api/stations/{id}/summary` | Local e últimas leituras da estação |
| `GET` | `/api/stations/{id}/series?metric=level&hours=24` | Histórico de nível (m) |
| `GET` | `/api/stations/{id}/series?metric=rain&hours=24` | Histórico de chuva (mm/h) |

**Parâmetros de `series`:**

| Parâmetro | Obrigatório | Valores | Padrão |
|---|---|---|---|
| `metric` | Sim | `level` ou `rain` | — |
| `hours` | Não | inteiro de 1 a 72 | 24 |

**Exemplo de resposta** (`/api/stations/1/series?metric=level&hours=24`):

```json
{
  "simulated": true,
  "station_id": 1,
  "metric": "level",
  "unit": "m",
  "hours": 24,
  "points": [
    { "observed_at": "2026-01-01T13:00:00Z", "value": 2.35 }
  ]
}
```

**Erros:**

| Status | Quando |
|---|---|
| `400` | `metric` ausente/inválida ou `hours` fora de 1–72 |
| `404` | Estação inexistente |

> 📝 **CONFIRMAR:** prefixo das rotas, nomes dos campos e formato dos erros, comparando com `monitoring/urls.py`, `views.py` e `serializers.py`.

---

## Regras de negócio

- **Horários** sempre em UTC, formato ISO 8601.
- **Unidades:** nível em metros (m); chuva em milímetros por hora (mm/h). Nunca misturadas.
- **Janela:** `hours` entre 1 e 72.
- **Ordenação:** séries em ordem cronológica crescente.
- **Lacunas:** leituras ausentes não são preenchidas nem interpoladas.
- **Transparência:** toda resposta identifica a amostra como simulada.
- **Consultas seguras:** acesso ao banco via ORM do Django (consultas parametrizadas).

---

## Modelo de dados (MER + DER)

**Resumo:** uma **Estação** possui muitas **Observações** (1:N); cada observação pertence a uma única estação.

### MER (Modelo Entidade-Relacionamento)

![MER do sistema de monitoramento hidrológico](docs/img/mer.png)

### DER (Diagrama Entidade-Relacionamento)

![DER do sistema de monitoramento hidrológico](docs/img/der.png)

> 📝 **CONFIRMAR:** salvar as imagens em `docs/img/mer.png` e `docs/img/der.png` (ou ajustar os caminhos acima) e conferir se os nomes das tabelas e campos nas imagens batem com `monitoring/models.py`.

---

## Testes

```bash
python manage.py test
```

Os testes estão em `monitoring/tests.py`.

---

## Equipe

Grupo responsável pela trilha **backend**:

- Johny Oliveira Santos
- Ana Luisa Santos de Oliveira
- Victor Hugo da Silva Sousa

**Desafio proposto por:** Cogmo Technology
