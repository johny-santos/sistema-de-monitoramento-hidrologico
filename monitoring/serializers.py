import math
import re

from rest_framework import serializers

from .models import Observation, Station

# Unidade esperada para cada métrica (regra de negócio: unidades nunca são misturadas).
UNIT_BY_METRIC = {'level': 'm', 'rain': 'mm/h'}
# Limites de sanidade: acima disso é quase certamente erro de digitação.
MAX_BY_METRIC = {'level': 200.0, 'rain': 1000.0}

STATION_ID_RE = re.compile(r'^[A-Za-z0-9_-]+$')


class StationSerializer(serializers.ModelSerializer):
    simulated = serializers.BooleanField(default=True, read_only=True)

    class Meta:
        model = Station
        fields = [
            'id',
            'name',
            'river',
            'municipality',
            'simulated'
        ]

    def validate_id(self, value):
        # O código vai na URL (/api/stations/{id}/): só letras, números, hífen e sublinhado.
        # Com ponto, barra ou espaço a estação ficaria inalcançável (404) e impossível de excluir.
        if not STATION_ID_RE.match(value):
            raise serializers.ValidationError('Use apenas letras, números, hífen (-) e sublinhado (_), sem espaços.')
        return value


class ObservationSerializer(serializers.ModelSerializer):
    station_id = serializers.PrimaryKeyRelatedField(
        source='station',
        queryset=Station.objects.all()
    )

    simulated = serializers.BooleanField(default=True, read_only=True)
    unit = serializers.CharField(max_length=10, required=False)

    class Meta:
        model = Observation
        fields = [
            'id',
            'station_id',
            'metric',
            'observed_at',
            'value',
            'unit',
            'source',
            'simulated'
        ]

    def validate_value(self, value):
        if not math.isfinite(value):
            raise serializers.ValidationError('Informe um número finito.')
        if value < 0:
            raise serializers.ValidationError('O valor não pode ser negativo.')
        return value

    def validate(self, attrs):
        # Em PATCH, métrica/unidade/valor podem vir só em parte: completa com o que já existe.
        inst = self.instance
        metric = attrs.get('metric', getattr(inst, 'metric', None))
        unit = attrs.get('unit', getattr(inst, 'unit', None))
        value = attrs.get('value', getattr(inst, 'value', None))
        expected = UNIT_BY_METRIC.get(metric)
        if expected:
            if unit is None:
                attrs['unit'] = expected  # unidade omitida: assume a da métrica
            elif unit != expected:
                raise serializers.ValidationError({'unit': f'Para a métrica "{metric}" a unidade deve ser "{expected}".'})
            if value is not None and value > MAX_BY_METRIC[metric]:
                raise serializers.ValidationError({'value': f'Valor acima do limite plausível ({MAX_BY_METRIC[metric]:g} {expected}).'})
        return attrs
