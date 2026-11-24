from django.db import models


class Station(models.Model):
    id = models.CharField('Código', max_length=10, primary_key=True)
    name = models.CharField('Nome', max_length=200)
    river = models.CharField('Rio', max_length=50)
    municipality = models.CharField('Município', max_length=255)

    class Meta:
        verbose_name = 'Estação'
        verbose_name_plural = 'Estações'

    def __str__(self):
        return self.name


class Observation(models.Model):

    station = models.ForeignKey(
        Station,
        on_delete=models.CASCADE,
        related_name='observations',
        verbose_name='Estação'
    )

    metric = models.CharField(
        'Métrica',
        max_length=10,
        choices=[
            ('level', 'Nível do rio'),
            ('rain', 'Precipitação')
        ]
    )

    observed_at = models.DateTimeField('Observado em')
    value = models.FloatField('Valor')
    unit = models.CharField('Unidade', max_length=10)
    source = models.CharField('Fonte', max_length=100, default='synthetic')

    def __str__(self):
        return f'{self.station.name} - {self.metric}'

    class Meta:
        verbose_name = 'Observação'
        verbose_name_plural = 'Observações'
        constraints = [
            models.UniqueConstraint(
                fields=['station', 'metric', 'observed_at'],
                name='unique_station_metric_observation'
            )
        ]
        indexes = [
            # Listagens ordenadas por data (padrão da API e do Admin) sem varrer a tabela inteira.
            models.Index(fields=['-observed_at'], name='obs_observed_at_idx'),
        ]
