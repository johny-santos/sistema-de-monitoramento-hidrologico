document.addEventListener('DOMContentLoaded', async function () {
    const selHoras = document.getElementById('filtro-horas');
    const aviso = document.getElementById('sem-dados');
    const areaGrafico = document.getElementById('area-grafico');
    const cores = ['#2563eb', '#16a34a', '#dc2626', '#d97706', '#7c3aed', '#0891b2'];
    let grafico = null;
    let estacoes = [];

    async function carregarGrafico() {
        try {
            const series = await Promise.all(estacoes.map((e) =>
                Hidro.getJSON('/api/stations/' + e.id + '/series/?metric=level&hours=' + selHoras.value)));
            if (grafico) { grafico.destroy(); grafico = null; }
            const datasets = series.map((s, i) => ({
                label: estacoes[i].name, data: Hidro.pontos(s), borderColor: cores[i % cores.length],
                backgroundColor: cores[i % cores.length], tension: 0.2, pointRadius: 1.5, fill: false,
            })).filter((d) => d.data.length);
            if (!datasets.length) {
                aviso.classList.remove('d-none');
                areaGrafico.classList.add('d-none');
                return;
            }
            aviso.classList.add('d-none');
            areaGrafico.classList.remove('d-none');
            grafico = new Chart(document.getElementById('grafico'), {
                type: 'line', data: { datasets: datasets }, options: Hidro.opcoes('m', 'Nível do rio'),
            });
        } catch (erro) {
            Hidro.mostrarErro(areaGrafico, erro);
        }
    }

    try {
        estacoes = await Hidro.getAll('/api/stations/');
        const resumos = await Promise.all(estacoes.map((e) => Hidro.getJSON('/api/stations/' + e.id + '/summary/')));
        document.getElementById('total-estacoes').textContent = resumos.length;
        document.getElementById('total-observacoes').textContent =
            resumos.reduce((soma, r) => soma + r.observations_count, 0);
        document.getElementById('cards-estacoes').innerHTML = resumos.map((r, i) => Hidro.cardEstacao(r, i)).join('');
        document.getElementById('tabela-estacoes').innerHTML = resumos.map((r) => {
            const n = r.latest.level, c = r.latest.rain;
            return '<tr><td><a href="/station/' + r.id + '/">' + r.name + '</a></td><td>' + r.river + '</td><td>' +
                (n ? n.value + ' ' + n.unit : '—') + '</td><td>' + (c ? c.value + ' ' + c.unit : '—') + '</td></tr>';
        }).join('');
        selHoras.addEventListener('change', carregarGrafico);
        if (estacoes.length) carregarGrafico();
        else { aviso.classList.remove('d-none'); areaGrafico.classList.add('d-none'); }
    } catch (erro) {
        Hidro.mostrarErro(areaGrafico, erro);
    }
});
