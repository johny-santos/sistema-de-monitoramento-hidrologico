// Funções compartilhadas pelas páginas (JavaScript puro).
const Hidro = {
    ROTULOS: { level: 'Nível do rio', rain: 'Precipitação' },

    async getJSON(url) {
        const resp = await fetch(url, { headers: { Accept: 'application/json' } });
        if (!resp.ok) throw new Error('Falha ao consultar ' + url + ' (HTTP ' + resp.status + ')');
        return resp.json();
    },

    // Percorre a paginação do DRF e devolve todos os resultados.
    async getAll(url) {
        let itens = [];
        while (url) {
            const pagina = await Hidro.getJSON(url);
            itens = itens.concat(pagina.results);
            url = pagina.next;
        }
        return itens;
    },

    formatarData(valor) {
        return new Date(valor).toLocaleString('pt-BR', {
            timeZone: 'UTC', day: '2-digit', month: '2-digit',
            hour: '2-digit', minute: '2-digit',
        });
    },

    formatarDataCompleta(valor) {
        return new Date(valor).toLocaleString('pt-BR', { timeZone: 'UTC' }) + ' UTC';
    },

    // Opções comuns de gráfico de linha: eixo X temporal numérico (UTC).
    opcoes(unidade, rotuloY) {
        return {
            responsive: true,
            maintainAspectRatio: false,
            parsing: false,
            interaction: { mode: 'nearest', intersect: false },
            scales: {
                x: {
                    type: 'linear',
                    title: { display: true, text: 'Data e hora (UTC)' },
                    ticks: { maxTicksLimit: 8, callback: (v) => Hidro.formatarData(v) },
                },
                y: { title: { display: true, text: rotuloY + ' (' + unidade + ')' } },
            },
            plugins: {
                tooltip: {
                    callbacks: {
                        title: (itens) => Hidro.formatarDataCompleta(itens[0].parsed.x),
                        label: (item) => item.dataset.label + ': ' + item.parsed.y + ' ' + unidade,
                    },
                },
            },
        };
    },

    pontos(serie) {
        return serie.points.map((p) => ({ x: Date.parse(p.observed_at), y: p.value }));
    },

    mostrarErro(elemento, erro) {
        elemento.innerHTML = '<div class="alert alert-danger">' + erro.message + '</div>';
    },
};
