from django.db import models


class Station(models.Model):
    id = models.CharField(max_length=10, primary_key=True)
    name = models.CharField(max_length=200)
    river = models.CharField(max_length=50)
    municipality = models.CharField(max_length=255)

    def __str__(self):
        return self.name


class Observation(models.Model):

    station = models.ForeignKey(
        Station,
        on_delete=models.CASCADE,
        related_name='observations'
    )

    metric = models.CharField(
        max_length=10,
        choices=[
            ('level', 'Nível do rio'),
            ('rain', 'Precipitação')
        ]
    )

    observed_at = models.DateTimeField()
    value = models.FloatField()
    unit = models.CharField(max_length=10)
    source = models.CharField(max_length=100, default='synthetic')

    def __str__(self):
        return f'{self.station.name} - {self.metric}'

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['station', 'metric', 'observed_at'],
                name='unique_station_metric_observation'
            )
        ]