"""Validação de dados, limite de tentativas de login e comando de correção de unidades."""
from io import StringIO

from django.core.cache import cache
from django.core.management import call_command

from .models import Observation, Station
from .tests import ApiBase


class DataValidation(ApiBase):
    OBS = {'station_id': 'T-02', 'metric': 'level', 'observed_at': '2026-05-01T00:00:00Z', 'value': 1.5, 'unit': 'm', 'source': 'manual'}

    def setUp(self):
        self.auth()

    def post(self, **over):
        body = {**self.OBS, **over}
        return self.client.post('/api/observations/', body, format='json')

    # ---------- ids de estação ----------
    def test_station_id_must_be_url_safe(self):
        for bad in ('A.B', 'A B', 'A/B', '..', '<b>x</b>', 'ç-1', 'a?b', 'a#b'):
            r = self.client.post('/api/stations/', {'id': bad, 'name': 'n', 'river': 'r', 'municipality': 'm'}, format='json')
            self.assertEqual(r.status_code, 400, bad)
        for good in ('EST-9', 'est_9', 'A1', '12345'):
            r = self.client.post('/api/stations/', {'id': good, 'name': 'n', 'river': 'r', 'municipality': 'm'}, format='json')
            self.assertEqual(r.status_code, 201, good)
            self.assertEqual(self.client.get(f'/api/stations/{good}/').status_code, 200, good)  # alcançável

    # ---------- unidade x métrica ----------
    def test_unit_must_match_metric(self):
        self.assertEqual(self.post(metric='level', unit='mm/h').status_code, 400)
        self.assertEqual(self.post(metric='rain', unit='m', observed_at='2026-05-02T00:00:00Z').status_code, 400)
        self.assertEqual(self.post(unit='banana').status_code, 400)
        self.assertEqual(self.post(metric='rain', unit='mm/h', observed_at='2026-05-03T00:00:00Z').status_code, 201)

    def test_unit_is_filled_when_omitted(self):
        body = {k: v for k, v in self.OBS.items() if k != 'unit'}
        r = self.client.post('/api/observations/', {**body, 'metric': 'rain', 'observed_at': '2026-05-04T00:00:00Z'}, format='json')
        self.assertEqual(r.status_code, 201)
        self.assertEqual(r.data['unit'], 'mm/h')

    def test_patch_cannot_break_unit_rule(self):
        oid = self.post().data['id']
        self.assertEqual(self.client.patch(f'/api/observations/{oid}/', {'unit': 'mm/h'}, format='json').status_code, 400)
        self.assertEqual(self.client.patch(f'/api/observations/{oid}/', {'metric': 'rain'}, format='json').status_code, 400)  # unidade m não serve p/ chuva
        self.assertEqual(self.client.patch(f'/api/observations/{oid}/', {'value': 2.0}, format='json').status_code, 200)

    # ---------- valores ----------
    def test_value_range(self):
        self.assertEqual(self.post(value=-1, observed_at='2026-06-01T00:00:00Z').status_code, 400)
        self.assertEqual(self.post(value=0, observed_at='2026-06-02T00:00:00Z').status_code, 201)
        self.assertEqual(self.post(value=200, observed_at='2026-06-03T00:00:00Z').status_code, 201)
        self.assertEqual(self.post(value=200.5, observed_at='2026-06-04T00:00:00Z').status_code, 400)
        self.assertEqual(self.post(metric='rain', unit='mm/h', value=1e12, observed_at='2026-06-05T00:00:00Z').status_code, 400)
        for bad in ('NaN', 'Infinity', '-Infinity', 'abc', None):
            self.assertEqual(self.post(value=bad, observed_at='2026-06-06T00:00:00Z').status_code, 400, bad)


class LoginThrottle(ApiBase):
    def setUp(self):
        cache.clear()

    def tearDown(self):
        cache.clear()

    def test_login_is_rate_limited(self):
        codes = [self.client.post('/api/token/', {'username': 'admin', 'password': f'x{i}'}, format='json').status_code for i in range(14)]
        self.assertEqual(codes[:10], [400] * 10)
        self.assertEqual(set(codes[10:]), {429})
        self.assertIn('Retry-After', self.client.post('/api/token/', {}, format='json'))

    def test_reads_are_not_limited(self):
        for _ in range(40):
            self.assertEqual(self.client.get('/api/stations/').status_code, 200)


class FixUnitsCommand(ApiBase):
    def test_dry_run_then_apply(self):
        bad = Observation.objects.create(station=self.b, metric='rain', observed_at='2026-07-01T00:00:00Z', value=2.0, unit='mm')
        out = StringIO()
        call_command('corrigir_unidades', stdout=out)
        self.assertIn('inconsistente', out.getvalue())
        bad.refresh_from_db()
        self.assertEqual(bad.unit, 'mm')  # simulação não altera nada
        call_command('corrigir_unidades', '--aplicar', stdout=StringIO())
        bad.refresh_from_db()
        self.assertEqual(bad.unit, 'mm/h')
        out = StringIO()
        call_command('corrigir_unidades', stdout=out)
        self.assertIn('Nenhuma', out.getvalue())


class SchemaFiles(ApiBase):
    def test_station_verbose_names_in_portuguese(self):
        self.assertEqual(Station._meta.get_field('river').verbose_name, 'Rio')
        self.assertEqual(Observation._meta.get_field('observed_at').verbose_name, 'Observado em')
