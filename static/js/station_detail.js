document.addEventListener('DOMContentLoaded', function () {
    const id = document.getElementById('station-detail').dataset.stationId;
    const selMetrica = document.getElementById('filtro-metrica');
    const selHoras = document.getElementById('filtro-horas');
    const aviso = document.getElementById('sem-dados');
    const areaGrafico = document.getElementById('area-grafico');
    const corpoTabela = document.getElementById('tabela-leituras');
    const tendencia = document.getElementById('tendencia');
    let grafico = null;

    // Apresentação apenas: compara a última leitura da janela com a primeira.
    function mostrarTendencia(pontos) {
        if (pontos.length < 2) { tendencia.innerHTML = ''; return; }
        const delta = Math.round((pontos[pontos.length - 1].y - pontos[0].y) * 100) / 100;
        if (delta > 0) tendencia.innerHTML = '<span class="badge text-bg-danger"><i class="bi bi-arrow-up-right"></i> Elevação (+' + delta + ')</span>';
        else if (delta < 0) tendencia.innerHTML = '<span class="badge text-bg-success"><i class="bi bi-arrow-down-right"></i> Redução (' + delta + ')</span>';
        else tendencia.innerHTML = '<span class="badge text-bg-secondary"><i class="bi bi-dash"></i> Estável</span>';
    }

    async function carregarSerie() {
        const metrica = selMetrica.value;
        try {
            const serie = await Hidro.getJSON('/api/stations/' + id + '/series/?metric=' + metrica + '&hours=' + selHoras.value);
            if (grafico) { grafico.destroy(); grafico = null; }
            corpoTabela.innerHTML = '';
            tendencia.innerHTML = '';
            if (serie.count === 0) {
                aviso.classList.remove('d-none');
                areaGrafico.classList.add('d-none');
                return;
            }
            aviso.classList.add('d-none');
            areaGrafico.classList.remove('d-none');
            const pontos = Hidro.pontos(serie);
            grafico = new Chart(document.getElementById('grafico'), {
                type: 'line',
                data: { datasets: [{
                    label: Hidro.ROTULOS[metrica], data: pontos,
                    borderColor: '#2563eb', backgroundColor: 'rgba(37,99,235,.15)',
                    fill: true, tension: 0.2, pointRadius: 2,
                }] },
                options: Hidro.opcoes(serie.unit, Hidro.ROTULOS[metrica]),
            });
            mostrarTendencia(pontos);
            corpoTabela.innerHTML = serie.points.slice(-10).reverse().map((p) =>
                '<tr><td>' + Hidro.formatarDataCompleta(p.observed_at) + '</td><td>' + p.value + ' ' + p.unit + '</td></tr>'
            ).join('');
        } catch (erro) {
            Hidro.mostrarErro(areaGrafico, erro);
        }
    }

    async function carregarEstacao() {
        try {
            const r = await Hidro.getJSON('/api/stations/' + id + '/summary/');
            document.getElementById('estacao-nome').textContent = r.name + ' (' + r.id + ')';
            document.getElementById('estacao-local').textContent = r.river + ' — ' + r.municipality;
            document.getElementById('estacao-total').textContent = r.observations_count;
            ['level', 'rain'].forEach(function (m) {
                const o = r.latest[m];
                document.getElementById('ultimo-' + m).textContent = o ? o.value + ' ' + o.unit : 'sem leituras';
            });
        } catch (erro) {
            Hidro.mostrarErro(document.getElementById('estacao-nome'), erro);
        }
    }

    selMetrica.addEventListener('change', carregarSerie);
    selHoras.addEventListener('change', carregarSerie);
    carregarEstacao();
    carregarSerie();
});
