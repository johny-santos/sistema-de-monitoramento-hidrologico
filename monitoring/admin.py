from django.contrib import admin
from django.db.models import Count, Max
from django.utils.html import format_html
from rest_framework.authtoken.models import Token

from .models import Observation, Station

# Identidade do painel (o tema visual está em static/monitoring/admin.css).
admin.site.site_header = 'HidroMonitor'
admin.site.site_title = 'HidroMonitor'
admin.site.index_title = 'Visão geral do sistema'


@admin.register(Station)
class StationAdmin(admin.ModelAdmin):
    list_display = ['id', 'name', 'river', 'municipality', 'total_observations', 'status']
    list_filter = ['river', 'municipality']
    search_fields = ['id', 'name', 'river', 'municipality']
    ordering = ['id']
    list_per_page = 25

    def get_queryset(self, request):
        return super().get_queryset(request).annotate(_obs=Count('observations'))

    @admin.display(description='Observações', ordering='_obs')
    def total_observations(self, obj):
        return format_html('<span class="hm-num">{}</span>', obj._obs)

    @admin.display(description='Situação')
    def status(self, obj):
        # format_html exige argumentos (Django 6): passa a classe e o texto como parâmetros.
        css, label = ('ok', 'com leituras') if obj._obs else ('idle', 'sem leituras')
        return format_html('<span class="hm-badge {}">{}</span>', css, label)


@admin.register(Observation)
class ObservationAdmin(admin.ModelAdmin):
    list_display = ['observed_at', 'station', 'metric_badge', 'value_fmt', 'unit', 'source_badge']
    list_filter = ['metric', 'source', 'station']
    search_fields = ['station__name', 'station__id', 'source']
    date_hierarchy = 'observed_at'
    ordering = ['-observed_at']
    list_select_related = ['station']
    autocomplete_fields = ['station']
    list_per_page = 50
    show_full_result_count = False  # evita COUNT(*) caro a cada página

    @admin.display(description='Métrica', ordering='metric')
    def metric_badge(self, obj):
        label = 'Nível do rio' if obj.metric == 'level' else 'Chuva'
        return format_html('<span class="hm-badge {}">{}</span>', obj.metric, label)

    @admin.display(description='Valor', ordering='value')
    def value_fmt(self, obj):
        return format_html('<span class="hm-num">{}</span>', f'{obj.value:.2f}'.replace('.', ','))

    @admin.display(description='Fonte', ordering='source')
    def source_badge(self, obj):
        css = 'sim' if obj.source == 'synthetic' else 'ok'
        label = 'simulado' if obj.source == 'synthetic' else obj.source
        return format_html('<span class="hm-badge {}">{}</span>', css, label)


admin.site.register(Token)


# ---------- Indicadores na página inicial do admin ----------
_original_index = admin.site.index


def _index_with_stats(request, extra_context=None):
    obs = Observation.objects
    stats = {
        'stations': Station.objects.count(),
        'stations_with_data': Station.objects.filter(observations__isnull=False).distinct().count(),
        'observations': obs.count(),
        'level': obs.filter(metric='level').count(),
        'rain': obs.filter(metric='rain').count(),
        'latest': obs.aggregate(m=Max('observed_at'))['m'],
        'tokens': Token.objects.count(),
    }
    return _original_index(request, {**(extra_context or {}), 'hm_stats': stats})


admin.site.index = _index_with_stats
