"""Cria (setup) ou remove (cleanup) dados de borda usados só nos testes de QA."""
import os
import sys
from datetime import datetime, timedelta, timezone

sys.path.insert(0, os.getcwd())
import django

os.environ['DJANGO_SETTINGS_MODULE'] = 'core.settings'
django.setup()

from django.contrib.auth import get_user_model  # noqa: E402
from monitoring.models import Observation, Station  # noqa: E402

U = get_user_model()
IDS = ['Z-1', 'Z-2', 'Z-3', 'Z-4', 'Z-5']
base = datetime(2026, 11, 5, 0, tzinfo=timezone.utc)

if sys.argv[1] == 'setup':
    U.objects.filter(username='qa_admin').delete()
    U.objects.create_superuser('qa_admin', 'qa@qa.com', 'Qa-admin-12345')
    Station.objects.filter(id__in=IDS).delete()
    mk = lambda i, n: Station.objects.create(id=i, name=n, river='Rio QA', municipality='QA City')
    z1, z2, z3, z4, z5 = (mk('Z-1', 'QA uma leitura'), mk('Z-2', 'QA serie plana'), mk('Z-3', 'QA valores enormes'),
                          mk('Z-4', 'QA so chuva com buracos'), mk('Z-5', 'QA pico isolado com um nome de estacao realmente muito comprido para testar quebra'))
    O = Observation.objects.create
    O(station=z1, metric='level', observed_at=base, value=1.2, unit='m')
    for h in range(24):
        t = base + timedelta(hours=h)
        O(station=z2, metric='level', observed_at=t, value=2.0, unit='m')
        O(station=z2, metric='rain', observed_at=t, value=0.0, unit='mm/h')
        O(station=z3, metric='level', observed_at=t, value=14.8 + h * 0.04, unit='m')
        O(station=z3, metric='rain', observed_at=t, value=40 + (h % 7) * 3, unit='mm/h')
        if h % 3:  # buracos
            O(station=z4, metric='rain', observed_at=t, value=(h % 5) * 0.7, unit='mm/h')
        O(station=z5, metric='level', observed_at=t, value=9.99 if h == 12 else 1.0 + (h % 4) * 0.01, unit='m')
    print('QA data criada')
else:
    Station.objects.filter(id__in=IDS).delete()
    U.objects.filter(username='qa_admin').delete()
    print('QA data removida | estacoes', Station.objects.count(), '| observacoes', Observation.objects.count(), '| users', list(U.objects.values_list('username', flat=True)))
