
import csv
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils.dateparse import parse_datetime

from monitoring.models import Station, Observation


class Command(BaseCommand):
    help = 'Importa estações e observações a partir de um arquivo CSV.'

    def handle(self, *args, **options):
        caminho_csv = Path(settings.BASE_DIR) / 'dados_estacoes_excel.csv'

        if not caminho_csv.exists():
            raise CommandError(f'Arquivo não encontrado: {caminho_csv}')

        total = 0

        try:
            with transaction.atomic():
                with open(caminho_csv, mode='r', encoding='utf-8-sig', newline='') as arquivo:
                    leitor = csv.DictReader(arquivo, delimiter=';')

                    for linha in leitor:
                        # 1. Cadastra ou atualiza a estação
                        station, _ = Station.objects.update_or_create(
                            id=linha['station_id'],
                            defaults={
                                'name': linha['station_name'],
                                'river': linha['river'],
                                'municipality': linha['municipality'],
                            }
                        )

                        # 2. Converte a data para um objeto datetime
                        observed_at = parse_datetime(linha['observed_at'])

                        if observed_at is None:
                            raise CommandError(
                                f"Data inválida: {linha['observed_at']}"
                            )

                        # 3. Cadastra ou atualiza a observação
                        Observation.objects.update_or_create(
                            station=station,
                            metric=linha['metric'],
                            observed_at=observed_at,
                            defaults={
                                'value': float(linha['value']),
                                'unit': linha['unit'],
                                'source': linha['source'],
                            }
                        )

                        total += 1

        except (KeyError, ValueError, ValidationError) as erro:
            raise CommandError(f'Erro ao processar o CSV: {erro}')

        self.stdout.write(
            self.style.SUCCESS(
                f'Importação concluída! {total} linhas processadas.'
            )
        )
