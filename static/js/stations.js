document.addEventListener('DOMContentLoaded', async function () {
    const grade = document.getElementById('stations-grid');

    try {
        const estacoes = await Hidro.getAll('/api/stations/');
        if (!estacoes.length) {
            grade.innerHTML = '<div class="col-12"><div class="alert alert-info">Nenhuma estação cadastrada.</div></div>';
            return;
        }
        const resumos = await Promise.all(estacoes.map((e) => Hidro.getJSON('/api/stations/' + e.id + '/summary/')));
        grade.innerHTML = resumos.map((r, i) => Hidro.cardEstacao(r, i)).join('');
    } catch (erro) {
        Hidro.mostrarErro(grade, erro);
    }
});
