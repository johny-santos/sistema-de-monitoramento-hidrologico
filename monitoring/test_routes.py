"""Matriz de rotas: todas as rotas x métodos x (anônimo | autenticado), Admin completo e rotas do React."""
from datetime import datetime

from django.contrib.auth import get_user_model
from django.test import Client, TestCase

from .models import Observation, Station
from .tests import UTC, ApiBase


class RouteMatrix(ApiBase):
    """Garante o status HTTP esperado em TODAS as rotas da API, para todos os métodos."""

    OBS = {'station_id': 'T-02', 'metric': 'rain', 'observed_at': '2026-03-01T00:00:00Z', 'value': 1.5, 'unit': 'mm/h', 'source': 'manual'}

    def status(self, method, url, data=None):
        if method in ('post', 'put', 'patch'):
            return getattr(self.client, method)(url, data, format='json').status_code
        return getattr(self.client, method)(url, data).status_code

    # ---------- leitura pública ----------
    def test_public_reads(self):
        oid = Observation.objects.first().id
        urls = [
            '/api/', '/api/stations/', '/api/stations/T-01/', '/api/stations/T-01/summary/', '/api/stations/T-03/summary/',
            '/api/stations/T-01/series/?metric=level', '/api/stations/T-01/series/?metric=rain&hours=72',
            '/api/stations/T-03/series/?metric=level', '/api/observations/', f'/api/observations/{oid}/',
            '/api/schema/', '/api/docs/', '/api/redoc/',
        ]
        for u in urls:
            for m in ('get', 'head', 'options'):
                self.assertIn(self.status(m, u), (200, 204), f'{m.upper()} {u}')  # 204: OPTIONS em /api/docs/

    def test_format_suffix_and_trailing_slash(self):
        self.assertEqual(self.client.get('/api/stations.json').status_code, 200)
        self.assertEqual(self.client.get('/api/stations/T-01.json').status_code, 200)
        self.assertEqual(self.client.get('/api/stations').status_code, 301)  # redireciona para a barra final
        r = self.client.get('/api/stations/', {'format': 'json'})
        self.assertEqual(r['Content-Type'].split(';')[0], 'application/json')

    # ---------- escrita exige token ----------
    def test_anonymous_writes_are_401_everywhere(self):
        oid = Observation.objects.first().id
        for m, u, d in [
            ('post', '/api/stations/', {'id': 'X', 'name': 'x', 'river': 'r', 'municipality': 'm'}),
            ('put', '/api/stations/T-01/', {'id': 'T-01', 'name': 'x', 'river': 'r', 'municipality': 'm'}),
            ('patch', '/api/stations/T-01/', {'name': 'x'}), ('delete', '/api/stations/T-01/', None),
            ('post', '/api/observations/', self.OBS), ('put', f'/api/observations/{oid}/', self.OBS),
            ('patch', f'/api/observations/{oid}/', {'value': 9}), ('delete', f'/api/observations/{oid}/', None),
        ]:
            self.assertEqual(self.status(m, u, d), 401, f'{m.upper()} {u}')
        self.assertEqual(Station.objects.count(), 3)

    def test_actions_reject_wrong_methods(self):
        self.auth()
        for u in ('/api/stations/T-01/summary/', '/api/stations/T-01/series/?metric=level'):
            for m in ('post', 'put', 'patch', 'delete'):
                self.assertEqual(self.status(m, u, {}), 405, f'{m.upper()} {u}')
        self.assertEqual(self.status('delete', '/api/'), 405)
        self.assertEqual(self.status('post', '/api/schema/'), 405)

    def test_token_route_methods(self):
        self.assertEqual(self.status('get', '/api/token/'), 405)
        self.assertEqual(self.status('post', '/api/token/', {}), 400)
        self.assertEqual(self.status('post', '/api/token/', {'username': 'admin'}), 400)
        self.assertEqual(self.status('post', '/api/token/', {'username': 'x', 'password': 'y'}), 400)

    # ---------- CRUD completo autenticado ----------
    def test_full_station_crud(self):
        self.auth()
        body = {'id': 'T-50', 'name': 'Nova', 'river': 'Rio N', 'municipality': 'Cid N'}
        self.assertEqual(self.status('post', '/api/stations/', body), 201)
        self.assertEqual(self.status('post', '/api/stations/', body), 400)  # id duplicado
        self.assertEqual(self.status('put', '/api/stations/T-50/', {**body, 'name': 'Editada'}), 200)
        self.assertEqual(self.client.get('/api/stations/T-50/').data['name'], 'Editada')
        self.assertEqual(self.status('patch', '/api/stations/T-50/', {'river': 'Outro'}), 200)
        self.assertEqual(self.status('patch', '/api/stations/T-50/', {'river': 'x' * 51}), 400)
        self.assertEqual(self.status('post', '/api/stations/', {**body, 'id': 'ID-MUITO-LONGO-123'}), 400)
        self.assertEqual(self.status('post', '/api/stations/', {'id': 'T-51'}), 400)
        self.assertEqual(self.status('delete', '/api/stations/T-50/'), 204)
        self.assertEqual(self.status('delete', '/api/stations/T-50/'), 404)
        self.assertEqual(self.status('get', '/api/stations/T-50/'), 404)

    def test_full_observation_crud(self):
        self.auth()
        r = self.client.post('/api/observations/', self.OBS, format='json')
        self.assertEqual(r.status_code, 201)
        oid = r.data['id']
        self.assertEqual(self.status('put', f'/api/observations/{oid}/', {**self.OBS, 'value': 2.5}), 200)
        self.assertEqual(self.status('patch', f'/api/observations/{oid}/', {'value': 3.5}), 200)
        self.assertEqual(Observation.objects.get(id=oid).value, 3.5)
        for bad in ({'metric': 'temp'}, {'value': 'abc'}, {'observed_at': 'ontem'}, {'station_id': 'NOPE'}, {'value': None}):
            body = {'observed_at': '2026-03-02T00:00:00Z', **self.OBS, **bad}
            body['observed_at'] = bad.get('observed_at', '2026-03-02T00:00:00Z')
            self.assertEqual(self.status('post', '/api/observations/', body), 400, bad)
        self.assertEqual(self.status('post', '/api/observations/', {}), 400)
        self.assertEqual(self.status('delete', f'/api/observations/{oid}/'), 204)
        self.assertEqual(self.status('get', f'/api/observations/{oid}/'), 404)
        self.assertEqual(self.status('get', '/api/observations/999999/'), 404)
        self.assertEqual(self.status('get', '/api/observations/abc/'), 404)

    # ---------- entradas estranhas ----------
    def test_weird_inputs_never_500(self):
        urls = [
            '/api/stations/%20/', '/api/stations/T-01%2F..%2F/', '/api/stations/T-01/series/?metric=level&hours=%00',
            '/api/stations/T-01/series/?metric=level&hours=99999999999999999999', '/api/stations/T-01/series/?metric[]=level',
            '/api/observations/?page=-1', '/api/observations/?page=0', '/api/observations/?page=1&page=2',
            '/api/observations/?ordering=-value,observed_at', '/api/observations/?ordering=__class__', '/api/observations/?station=%27%3B--',
            '/api/observations/?observed_after=9999-99-99', '/api/observations/?search=%25', '/api/stations/?search=' + 'a' * 5000,
            '/api/stations/?river=' + 'é' * 300, '/api/stations/?ordering=password', '/api/stations/?municipality[]=x',
        ]
        for u in urls:
            self.assertLess(self.client.get(u).status_code, 500, u)

    def test_malformed_bodies_never_500(self):
        self.auth()
        for ct, body in (('application/json', '{"id": '), ('application/json', '[]'), ('application/json', 'null'),
                         ('text/plain', 'oi'), ('application/json', '{"value": {"a": 1}}')):
            for u in ('/api/stations/', '/api/observations/'):
                r = self.client.post(u, body, content_type=ct)
                self.assertIn(r.status_code, (400, 415), f'{u} {ct} {body}')

    def test_large_values_and_unicode(self):
        self.auth()
        r = self.client.post('/api/stations/', {'id': 'U-1', 'name': 'Estação São João – ñ ü 水', 'river': 'Rio Açu', 'municipality': 'Brasília'}, format='json')
        self.assertEqual(r.status_code, 201)
        self.assertEqual(self.client.get('/api/stations/?search=João').data['count'], 1)
        for v in (0, 1e-9, 150):
            rr = self.client.post('/api/observations/', {**self.OBS, 'station_id': 'U-1', 'value': v}, format='json')
            self.assertEqual(rr.status_code, 201, v)
            self.client.delete(f"/api/observations/{rr.data['id']}/")
        for v in (1e308, -5):  # fora do intervalo plausível: rejeitado com 400, nunca 500
            self.assertEqual(self.client.post('/api/observations/', {**self.OBS, 'station_id': 'U-1', 'value': v}, format='json').status_code, 400, v)

    def test_series_single_zero_point(self):
        Observation.objects.create(station=self.b, metric='rain', observed_at=datetime(2026, 1, 1, tzinfo=UTC), value=0.0, unit='mm/h')
        r = self.client.get('/api/stations/T-02/series/?metric=rain&hours=1')
        self.assertEqual((r.status_code, r.data['count']), (200, 1))
        self.assertEqual(r.data['points'][0]['value'], 0.0)


class AdminPages(TestCase):
    """Admin: lista, filtros, busca, adicionar, editar, excluir, histórico."""

    @classmethod
    def setUpTestData(cls):
        cls.su = get_user_model().objects.create_superuser('root', 'r@r.com', 'senha-forte-123')
        s = Station.objects.create(id='A-1', name='Estação A', river='Rio A', municipality='Cid A')
        Station.objects.create(id='A-2', name='Sem dados', river='Rio B', municipality='Cid B')
        cls.o = Observation.objects.create(station=s, metric='level', observed_at=datetime(2026, 1, 1, tzinfo=UTC), value=1.2, unit='m')
        Observation.objects.create(station=s, metric='rain', observed_at=datetime(2026, 1, 1, tzinfo=UTC), value=0.4, unit='mm/h', source='manual')

    def setUp(self):
        self.client.force_login(self.su)

    def ok(self, url, code=200):
        r = self.client.get(url)
        self.assertEqual(r.status_code, code, url)
        return r

    def test_login_page_and_redirects(self):
        anon = Client()
        self.assertEqual(anon.get('/admin/').status_code, 302)
        self.assertEqual(anon.get('/admin/login/').status_code, 200)
        self.assertEqual(anon.get('/admin/monitoring/station/').status_code, 302)

    def test_index_with_stats(self):
        r = self.ok('/admin/')
        self.assertContains(r, 'Visão geral do sistema')
        self.assertEqual(r.context['hm_stats']['observations'], 2)
        self.assertEqual(r.context['hm_stats']['stations_with_data'], 1)

    def test_all_pages(self):
        pk = self.o.pk
        for url in (
            '/admin/monitoring/station/', '/admin/monitoring/station/add/', '/admin/monitoring/station/A-1/change/',
            '/admin/monitoring/station/A-1/delete/', '/admin/monitoring/station/A-1/history/',
            '/admin/monitoring/observation/', '/admin/monitoring/observation/add/', f'/admin/monitoring/observation/{pk}/change/',
            f'/admin/monitoring/observation/{pk}/delete/', f'/admin/monitoring/observation/{pk}/history/',
            '/admin/authtoken/tokenproxy/', '/admin/authtoken/tokenproxy/add/', '/admin/auth/user/', '/admin/auth/group/',
        ):
            self.ok(url)

    def test_filters_search_and_date_hierarchy(self):
        for q in ('?metric=level', '?metric=rain&source=manual', '?station__id__exact=A-1', '?q=Estação', '?q=zzz', '?o=-3',
                  '?observed_at__year=2026', '?observed_at__year=2026&observed_at__month=1',
                  '?observed_at__year=2026&observed_at__month=1&observed_at__day=1'):
            self.ok('/admin/monitoring/observation/' + q)
        for q in ('?river=Rio A', '?municipality=Cid B', '?q=Sem', '?o=-6'):
            self.ok('/admin/monitoring/station/' + q)

    def test_station_list_shows_counts_and_status(self):
        r = self.ok('/admin/monitoring/station/')
        self.assertContains(r, 'com leituras')
        self.assertContains(r, 'sem leituras')

    def test_create_edit_delete_through_admin_forms(self):
        data = {'id': 'A-9', 'name': 'Nova', 'river': 'R', 'municipality': 'M'}
        self.assertEqual(self.client.post('/admin/monitoring/station/add/', data).status_code, 302)
        self.assertTrue(Station.objects.filter(id='A-9').exists())
        self.assertEqual(self.client.post('/admin/monitoring/station/A-9/change/', {**data, 'name': 'Editada'}).status_code, 302)
        self.assertEqual(Station.objects.get(id='A-9').name, 'Editada')
        self.assertEqual(self.client.post('/admin/monitoring/station/A-9/delete/', {'post': 'yes'}).status_code, 302)
        self.assertFalse(Station.objects.filter(id='A-9').exists())

    def test_autocomplete_endpoint(self):
        r = self.client.get('/admin/autocomplete/', {'term': 'Esta', 'app_label': 'monitoring', 'model_name': 'observation', 'field_name': 'station'})
        self.assertEqual(r.status_code, 200)


class FrontendRoutes(TestCase):
    """Todas as rotas do React devolvem o index.html; arquivos estáticos com cache e tipo corretos."""

    def setUp(self):
        from .frontend_views import DIST
        self.dist = DIST
        if not (DIST / 'index.html').exists():
            self.skipTest('frontend não buildado')

    def test_every_spa_route_serves_index(self):
        for path in ('/', '/estacoes', '/estacoes/', '/estacoes/EST-01', '/estacoes/NAO-EXISTE', '/observacoes', '/sobre', '/qualquer/coisa/aqui'):
            r = self.client.get(path)
            self.assertEqual(r.status_code, 200, path)
            self.assertIn('text/html', r['Content-Type'], path)
            self.assertEqual(r['Cache-Control'], 'no-cache', path)

    def test_assets_cache_and_types(self):
        asset = sorted((self.dist / 'assets').glob('*.js'))[0].name
        r = self.client.get(f'/assets/{asset}')
        self.assertEqual(r.status_code, 200)
        self.assertIn('immutable', r['Cache-Control'])
        self.assertIn('javascript', r['Content-Type'])
        self.assertEqual(self.client.get('/img/s1.jpg')['Content-Type'], 'image/jpeg')
        self.assertEqual(self.client.get('/favicon.svg')['Content-Type'], 'image/svg+xml')
        self.assertEqual(self.client.get('/img/nao-existe.jpg').status_code, 200)  # cai no index.html (SPA)
