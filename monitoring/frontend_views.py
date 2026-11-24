from pathlib import Path

from django.conf import settings
from django.http import Http404
from django.views.static import serve

# Build do React (npm run build) gerado em frontend/dist.
DIST = Path(settings.BASE_DIR) / 'frontend' / 'dist'


def _cache_header(path: str) -> str:
    """Arquivos em /assets têm hash no nome (nunca mudam): cache de 1 ano. Fotos: 7 dias. HTML: sempre revalida."""
    if path.startswith('assets/'):
        return 'public, max-age=31536000, immutable'
    if path.startswith('img/'):
        return 'public, max-age=604800'
    return 'no-cache'


def spa(request, path=''):
    """Serve arquivos do build do frontend; qualquer outra rota cai no index.html (React Router)."""
    if not (DIST / 'index.html').exists():
        raise Http404('Frontend não buildado. Rode: cd frontend && npm install && npm run build')
    target = (DIST / path).resolve()
    if path and target.is_file() and DIST.resolve() in target.parents:
        response = serve(request, path, document_root=DIST)
        response['Cache-Control'] = _cache_header(path)
        return response
    response = serve(request, 'index.html', document_root=DIST)
    response['Cache-Control'] = 'no-cache'
    return response
