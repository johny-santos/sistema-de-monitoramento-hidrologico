from rest_framework import serializers
from .models import Station, Observation

class StationSerializer(serializers.ModelSerializer):
    class Meta: 
        model = Station
        fields = [
            'id',
            'name',
            'river',
            'municipality'
        ]


class ObservationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Observation
        fields = [
            'id',
            'station_id',
            'metric',
            'observed_at',
            'value',
            'unit',
            'source'
        ]