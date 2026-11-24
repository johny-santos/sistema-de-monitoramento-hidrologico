"""
URL configuration for core project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/6.1/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.http import HttpResponse
from django.urls import include, path, re_path
from monitoring.frontend_views import spa
from monitoring.auth_views import ThrottledObtainAuthToken
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView, SpectacularRedocView 


class DocsSwaggerView(SpectacularSwaggerView):
    """OPTIONS na página de docs estourava 500 (a view HTML não tem template para a resposta de metadados)."""

    def options(self, request, *args, **kwargs):
        return HttpResponse(status=204, headers={'Allow': 'GET, HEAD, OPTIONS'})


urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include('monitoring.urls')),
    path('api/token/', ThrottledObtainAuthToken.as_view(), name='api_token_auth'),
    path('api/schema/', SpectacularAPIView.as_view(), name='schema'), 
    path('api/docs/', DocsSwaggerView.as_view(url_name='schema'), name='swagger-ui'), 
    path('api/redoc/', SpectacularRedocView.as_view(url='/api/schema/?format=json'), name='redoc'),
    # Frontend React (deve ser o último: captura tudo que não for API/admin/static).
    re_path(r'^(?!api/|admin/|static/)(?P<path>.*)$', spa),
]
