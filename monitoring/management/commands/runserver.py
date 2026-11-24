import subprocess
from pathlib import Path

from django.conf import settings
from django.contrib.staticfiles.management.commands.runserver import Command as BaseCommand

FRONTEND = Path(settings.BASE_DIR) / 'frontend'


def _needs_build():
    index = FRONTEND / 'dist' / 'index.html'
    if not index.exists():
        return True
    newest_src = max(
        (p.stat().st_mtime for p in (FRONTEND / 'src').rglob('*') if p.is_file()),
        default=0,
    )
    newest_src = max(newest_src, (FRONTEND / 'index.html').stat().st_mtime)
    return newest_src > index.stat().st_mtime


class Command(BaseCommand):
    """`python manage.py runserver` também builda o frontend (se preciso) e o serve em /."""

    def add_arguments(self, parser):
        super().add_arguments(parser)
        parser.add_argument('--skip-frontend', action='store_true', help='Não builda o frontend.')

    def handle(self, *args, **options):
        # Em modo autoreload o handle roda duas vezes; builda só no processo pai.
        import os
        if not options['skip_frontend'] and os.environ.get('RUN_MAIN') != 'true' and FRONTEND.exists():
            self._build_frontend()
        super().handle(*args, **options)

    def _build_frontend(self):
        if not _needs_build():
            self.stdout.write('Frontend já está atualizado.')
            return
        try:
            if not (FRONTEND / 'node_modules').exists():
                self.stdout.write('Instalando dependências do frontend (npm install)...')
                subprocess.run('npm install', cwd=FRONTEND, shell=True, check=True)
            self.stdout.write('Buildando o frontend (npm run build)...')
            subprocess.run('npm run build', cwd=FRONTEND, shell=True, check=True)
        except subprocess.CalledProcessError:
            self.stderr.write(self.style.WARNING(
                'Falha ao buildar o frontend (Node/npm instalado?). Subindo só a API.'))
