from drf_spectacular.utils import extend_schema
from rest_framework.authtoken.views import ObtainAuthToken
from rest_framework.throttling import ScopedRateThrottle


@extend_schema(tags=['auth'], summary='Obter token de acesso')
class ThrottledObtainAuthToken(ObtainAuthToken):
    """Login por token com limite de tentativas (proteção contra adivinhação de senha): 10 por minuto por IP."""

    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'login'
