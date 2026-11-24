from datetime import datetime, timedelta, timezone

from django.contrib.auth import get_user_model
from rest_framework.authtoken.models import Token
from rest_framework.test import APITestCase

from .models import Observation, Station

UTC = timezone.utc


class ApiBase(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.a = Station.objects.create(id='T-01', name='Estação A', river='Rio Azul', municipality='Cidade A')
        cls.b = Station.objects.create(id='T-02', name='Estação B', river='Rio Verde', municipality='Cidade B')
        cls.empty = Station.objects.create(id='T-03', name='Sem dados', river='Rio Seco', municipality='Cidade C')
        base = datetime(2026, 1, 1, 0, tzinfo=UTC)
        for h in range(0, 100):  # 100 horas de dados na estação A
            t = base + timedelta(hours=h)
            Observation.objects.create(station=cls.a, metric='level', observed_at=t, value=1 + h / 100, unit='m')
            Observation.objects.create(station=cls.a, metric='rain', observed_at=t, value=h % 5, unit='mm/h')
        Observation.objects.create(station=cls.b, metric='level', observed_at=base, value=2.0, unit='m', source='manual')
        cls.user = get_user_model().objects.create_user('admin', password='senha-forte-123')
        cls.token = Token.objects.create(user=cls.user)

    def auth(self):
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.token.key}')


class StationEndpoints(ApiBase):
    def test_list_is_public_and_paginated(self):
        r = self.client.get('/api/stations/')
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data['count'], 3)
        self.assertTrue(all(s['simulated'] for s in r.data['results']))

    def test_filters_and_search(self):
        self.assertEqual(self.client.get('/api/stations/?river=Rio Verde').data['count'], 1)
        self.assertEqual(self.client.get('/api/stations/?municipality=Cidade A').data['count'], 1)
        self.assertEqual(self.client.get('/api/stations/?search=verde').data['count'], 1)
        self.assertEqual(self.client.get('/api/stations/?search=zzz').data['count'], 0)

    def test_sql_injection_in_search_is_inert(self):
        r = self.client.get("/api/stations/", {'search': "' OR 1=1--"})
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data['count'], 0)

    def test_unknown_station_is_404(self):
        self.assertEqual(self.client.get('/api/stations/NOPE/').status_code, 404)
        self.assertEqual(self.client.get('/api/stations/NOPE/summary/').status_code, 404)

    def test_summary_returns_latest_per_metric(self):
        r = self.client.get('/api/stations/T-01/summary/')
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data['observations_count'], 200)
        self.assertEqual(r.data['latest']['level']['value'], 1.99)
        self.assertEqual(r.data['latest']['rain']['unit'], 'mm/h')

    def test_summary_of_station_without_data(self):
        r = self.client.get('/api/stations/T-03/summary/')
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data['observations_count'], 0)
        self.assertEqual(r.data['latest'], {'level': None, 'rain': None})


class SeriesEndpoint(ApiBase):
    def get(self, sid='T-01', **q):
        return self.client.get(f'/api/stations/{sid}/series/', q)

    def test_default_window_is_24h_chronological(self):
        r = self.get(metric='level')
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data['hours'], 24)
        self.assertEqual(r.data['unit'], 'm')
        times = [p['observed_at'] for p in r.data['points']]
        self.assertEqual(times, sorted(times))
        self.assertEqual(r.data['count'], 25)  # janela inclusiva a partir da última leitura

    def test_window_is_counted_from_last_reading(self):
        r = self.get(metric='level', hours=1)
        self.assertEqual(r.data['count'], 2)

    def test_validation(self):
        self.assertEqual(self.get().status_code, 400)
        self.assertEqual(self.get(metric='temp').status_code, 400)
        for bad in ('0', '73', '-5', 'abc', '2.5'):
            self.assertEqual(self.get(metric='level', hours=bad).status_code, 400, bad)
        for ok in ('1', '72'):
            self.assertEqual(self.get(metric='level', hours=ok).status_code, 200, ok)

    def test_station_without_data_returns_empty_series(self):
        r = self.get('T-03', metric='level')
        self.assertEqual(r.status_code, 200)
        self.assertEqual((r.data['count'], r.data['points'], r.data['unit']), (0, [], None))

    def test_unknown_station(self):
        self.assertEqual(self.get('NOPE', metric='level').status_code, 404)


class ObservationEndpoints(ApiBase):
    def test_filters(self):
        g = lambda q: self.client.get('/api/observations/', q).data['count']
        self.assertEqual(g({}), 201)
        self.assertEqual(g({'station': 'T-02'}), 1)
        self.assertEqual(g({'metric': 'rain'}), 100)
        self.assertEqual(g({'source': 'manual'}), 1)
        self.assertEqual(g({'station': 'T-01', 'metric': 'level',
                            'observed_after': '2026-01-01T10:00:00Z', 'observed_before': '2026-01-01T12:00:00Z'}), 3)

    def test_invalid_filters_are_400(self):
        for q in ({'metric': 'zzz'}, {'station': 'NOPE'}, {'observed_after': 'lixo'}):
            self.assertEqual(self.client.get('/api/observations/', q).status_code, 400, q)

    def test_ordering(self):
        r = self.client.get('/api/observations/', {'metric': 'level', 'station': 'T-01', 'ordering': '-value'})
        vals = [o['value'] for o in r.data['results']]
        self.assertEqual(vals, sorted(vals, reverse=True))

    def test_pagination(self):
        self.assertEqual(len(self.client.get('/api/observations/').data['results']), 100)
        self.assertEqual(len(self.client.get('/api/observations/?page=3').data['results']), 1)
        self.assertEqual(self.client.get('/api/observations/?page=9').status_code, 404)


class Permissions(ApiBase):
    obs = {'station_id': 'T-02', 'metric': 'rain', 'observed_at': '2026-02-01T00:00:00Z', 'value': 1.2, 'unit': 'mm/h', 'source': 'manual'}

    def test_writes_require_token(self):
        self.assertEqual(self.client.post('/api/observations/', self.obs, format='json').status_code, 401)
        self.assertEqual(self.client.post('/api/stations/', {'id': 'X'}, format='json').status_code, 401)
        self.assertEqual(self.client.delete('/api/stations/T-01/').status_code, 401)
        self.assertEqual(Station.objects.count(), 3)

    def test_invalid_token_is_rejected(self):
        self.client.credentials(HTTP_AUTHORIZATION='Token invalido')
        self.assertEqual(self.client.get('/api/stations/').status_code, 401)

    def test_token_endpoint(self):
        ok = self.client.post('/api/token/', {'username': 'admin', 'password': 'senha-forte-123'}, format='json')
        self.assertEqual(ok.status_code, 200)
        self.assertEqual(ok.data['token'], self.token.key)
        bad = self.client.post('/api/token/', {'username': 'admin', 'password': 'errada'}, format='json')
        self.assertEqual(bad.status_code, 400)

    def test_authenticated_crud(self):
        self.auth()
        r = self.client.post('/api/observations/', self.obs, format='json')
        self.assertEqual(r.status_code, 201)
        dup = self.client.post('/api/observations/', self.obs, format='json')
        self.assertEqual(dup.status_code, 400)  # restrição de unicidade
        self.assertEqual(self.client.delete(f"/api/observations/{r.data['id']}/").status_code, 204)
        s = self.client.post('/api/stations/', {'id': 'T-09', 'name': 'N', 'river': 'R', 'municipality': 'M'}, format='json')
        self.assertEqual(s.status_code, 201)
        self.assertEqual(self.client.delete('/api/stations/T-09/').status_code, 204)

    def test_station_delete_cascades_observations(self):
        self.auth()
        self.client.delete('/api/stations/T-02/')
        self.assertFalse(Observation.objects.filter(station_id='T-02').exists())

    def test_rejects_unknown_station_and_bad_value(self):
        self.auth()
        bad = {**self.obs, 'station_id': 'NOPE'}
        self.assertEqual(self.client.post('/api/observations/', bad, format='json').status_code, 400)
        bad = {**self.obs, 'value': 'abc'}
        self.assertEqual(self.client.post('/api/observations/', bad, format='json').status_code, 400)


class FrontendServing(ApiBase):
    def test_api_root_and_docs(self):
        self.assertEqual(self.client.get('/api/').status_code, 200)
        self.assertEqual(self.client.get('/api/schema/').status_code, 200)
        self.assertEqual(self.client.get('/api/docs/').status_code, 200)

    def test_unknown_api_path_is_not_swallowed_by_spa(self):
        r = self.client.get('/api/nao-existe/')
        self.assertEqual(r.status_code, 404)
        self.assertNotIn('text/html', r.headers.get('Content-Type', '').split(';')[0] if r.status_code == 200 else '')

    def test_spa_never_serves_files_outside_dist(self):
        r = self.client.get('/..%2f..%2fcore/settings.py')
        body = b''.join(r.streaming_content) if r.streaming else r.content
        self.assertNotIn(b'SECRET_KEY', body)
