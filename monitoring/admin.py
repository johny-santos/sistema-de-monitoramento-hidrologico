from django.contrib import admin

from .models import Station, Observation


@admin.register(Station)
class StationAdmin(admin.ModelAdmin):
    list_display = ['id', 'name', 'river', 'municipality']
    search_fields = ['id', 'name', 'river', 'municipality']


@admin.register(Observation)
class ObservationAdmin(admin.ModelAdmin):
    list_display = ['station', 'metric', 'observed_at', 'value', 'unit', 'source']
    list_filter = ['metric', 'source']
    date_hierarchy = 'observed_at'
