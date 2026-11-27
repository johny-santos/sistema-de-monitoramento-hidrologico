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

    // Card de estação (imagem ilustrativa fictícia + dados reais do summary/).
    cardEstacao(r, indice) {
        function leitura(rotulo, obs) {
            if (!obs) return '<li class="text-muted">' + rotulo + ': sem leituras</li>';
            return '<li>' + rotulo + ': <strong>' + obs.value + ' ' + obs.unit + '</strong> <small class="text-muted">(' +
                Hidro.formatarData(obs.observed_at) + ' UTC)</small></li>';
        }
        const img = (indice % 3) + 1;
        return '<div class="col-12 col-md-6 col-xl-4"><div class="card h-100 shadow-sm">' +
            '<img src="/static/img/estacao-' + img + '.svg" class="card-img-top" alt="Ilustração fictícia da ' + r.name + '">' +
            '<div class="card-body">' +
            '<span class="badge text-bg-primary mb-2">' + r.id + '</span>' +
            '<h5 class="card-title">' + r.name + '</h5>' +
            '<p class="card-text text-muted mb-2"><i class="bi bi-water"></i> ' + r.river +
            '<br><i class="bi bi-geo-alt"></i> ' + r.municipality + '</p>' +
            '<ul class="list-unstyled mb-2">' + leitura('Nível', r.latest.level) + leitura('Chuva', r.latest.rain) + '</ul>' +
            '<small class="text-muted">' + r.observations_count + ' observações</small>' +
            '</div><div class="card-footer bg-white"><a class="btn btn-primary btn-sm" href="/station/' + r.id +
            '/">Saber mais</a></div></div></div>';
    },

    mostrarErro(elemento, erro) {
        elemento.innerHTML = '<div class="alert alert-danger">' + erro.message + '</div>';
    },
};
