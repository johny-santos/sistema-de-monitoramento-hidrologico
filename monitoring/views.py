from datetime import timedelta

from django_filters import rest_framework as filters
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from .models import Station, Observation
from .serializers import StationSerializer, ObservationSerializer


class StationViewSet(viewsets.ModelViewSet):
    queryset = Station.objects.all().order_by('id')
    serializer_class = StationSerializer
    filterset_fields = ['river', 'municipality']
    search_fields = ['name', 'river', 'municipality']

    @extend_schema(summary='Resumo da estação com a última leitura de cada métrica')
    @action(detail=True, methods=['get'])
    def summary(self, request, pk=None):
        station = self.get_object()
        latest = {}
        for metric, _ in Observation._meta.get_field('metric').choices:
            obs = station.observations.filter(metric=metric).order_by('-observed_at').first()
            latest[metric] = ObservationSerializer(obs).data if obs else None
        return Response({
            **StationSerializer(station).data,
            'observations_count': station.observations.count(),
            'latest': latest,
        })

    @extend_schema(
        summary='Série temporal de uma métrica',
        parameters=[
            OpenApiParameter('metric', str, enum=['level', 'rain'], required=True),
            OpenApiParameter('hours', int, description='Janela em horas (1-72, padrão 24), contada a partir da última leitura'),
        ],
    )
    @action(detail=True, methods=['get'])
    def series(self, request, pk=None):
        station = self.get_object()
        metric = request.query_params.get('metric')
        if metric not in dict(Observation._meta.get_field('metric').choices):
            raise ValidationError({'metric': 'Use "level" ou "rain".'})
        try:
            hours = int(request.query_params.get('hours', 24))
        except ValueError:
            raise ValidationError({'hours': 'Deve ser um inteiro.'})
        if not 1 <= hours <= 72:
            raise ValidationError({'hours': 'Deve estar entre 1 e 72.'})

        qs = station.observations.filter(metric=metric)
        last = qs.order_by('-observed_at').first()
        points = []
        if last:
            since = last.observed_at - timedelta(hours=hours)
            points = list(
                qs.filter(observed_at__gte=since)
                .order_by('observed_at')
                .values('observed_at', 'value', 'unit')
            )
        return Response({
            'simulated': True,
            'station': station.id,
            'metric': metric,
            'hours': hours,
            'unit': last.unit if last else None,
            'count': len(points),
            'points': points,
        })


class ObservationFilter(filters.FilterSet):
    observed_after = filters.DateTimeFilter(field_name='observed_at', lookup_expr='gte')
    observed_before = filters.DateTimeFilter(field_name='observed_at', lookup_expr='lte')

    class Meta:
        model = Observation
        fields = ['station', 'metric', 'source', 'observed_after', 'observed_before']


class ObservationViewSet(viewsets.ModelViewSet):
    queryset = Observation.objects.all().order_by('-observed_at')
    serializer_class = ObservationSerializer
    filterset_class = ObservationFilter
    ordering_fields = ['observed_at', 'value']
