document.addEventListener('DOMContentLoaded', async function () {
    const grade = document.getElementById('stations-grid');

    function leitura(rotulo, obs) {
        if (!obs) return '<li class="text-muted">' + rotulo + ': sem leituras</li>';
        return '<li>' + rotulo + ': <strong>' + obs.value + ' ' + obs.unit + '</strong> <small class="text-muted">(' +
            Hidro.formatarData(obs.observed_at) + ' UTC)</small></li>';
    }

    try {
        const estacoes = await Hidro.getAll('/api/stations/');
        if (!estacoes.length) {
            grade.innerHTML = '<div class="col-12"><div class="alert alert-info">Nenhuma estação cadastrada.</div></div>';
            return;
        }
        const resumos = await Promise.all(estacoes.map((e) => Hidro.getJSON('/api/stations/' + e.id + '/summary/')));
        grade.innerHTML = resumos.map((r) =>
            '<div class="col-12 col-md-6 col-xl-4"><div class="card h-100 shadow-sm"><div class="card-body">' +
            '<span class="badge text-bg-primary mb-2">' + r.id + '</span>' +
            '<h5 class="card-title">' + r.name + '</h5>' +
            '<p class="card-text text-muted mb-2"><i class="bi bi-water"></i> ' + r.river +
            '<br><i class="bi bi-geo-alt"></i> ' + r.municipality + '</p>' +
            '<ul class="list-unstyled mb-2">' + leitura('Nível', r.latest.level) + leitura('Chuva', r.latest.rain) + '</ul>' +
            '<small class="text-muted">' + r.observations_count + ' observações</small>' +
            '</div><div class="card-footer bg-white"><a class="btn btn-primary btn-sm" href="/station/' + r.id +
            '/">Ver detalhes</a></div></div></div>'
        ).join('');
    } catch (erro) {
        Hidro.mostrarErro(grade, erro);
    }
});
