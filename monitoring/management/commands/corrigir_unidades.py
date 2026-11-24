from django.core.management.base import BaseCommand

from monitoring.models import Observation
from monitoring.serializers import UNIT_BY_METRIC


class Command(BaseCommand):
    help = 'Mostra (e opcionalmente corrige) leituras cuja unidade não bate com a métrica (nível = m, chuva = mm/h).'

    def add_arguments(self, parser):
        parser.add_argument('--aplicar', action='store_true', help='Grava a correção. Sem isso, apenas lista (simulação).')

    def handle(self, *args, **opts):
        total = 0
        for metric, unit in UNIT_BY_METRIC.items():
            bad = Observation.objects.filter(metric=metric).exclude(unit=unit)
            for o in bad.select_related('station'):
                self.stdout.write(f'#{o.pk} {o.station_id} {metric} {o.observed_at:%Y-%m-%d %H:%M} valor={o.value} unidade="{o.unit}" -> "{unit}"')
            n = bad.count()
            total += n
            if opts['aplicar'] and n:
                bad.update(unit=unit)
        if not total:
            self.stdout.write(self.style.SUCCESS('Nenhuma unidade inconsistente.'))
        elif opts['aplicar']:
            self.stdout.write(self.style.SUCCESS(f'{total} leitura(s) corrigida(s).'))
        else:
            self.stdout.write(self.style.WARNING(f'{total} leitura(s) inconsistente(s). Rode com --aplicar para corrigir.'))
