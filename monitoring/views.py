from django_filters import rest_framework as filters
from rest_framework import viewsets

from .models import Station, Observation
from .serializers import StationSerializer, ObservationSerializer


class StationViewSet(viewsets.ModelViewSet):
    queryset = Station.objects.all().order_by('id')
    serializer_class = StationSerializer
    filterset_fields = ['river', 'municipality']
    search_fields = ['name', 'river', 'municipality']


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
