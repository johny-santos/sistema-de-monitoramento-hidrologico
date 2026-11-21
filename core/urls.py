from django.contrib import admin
from django.urls import include, path
from django.views.generic import RedirectView
from rest_framework.authtoken.views import obtain_auth_token
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView, SpectacularRedocView 

import frontend_views

urlpatterns = [
###Back-end
    path('', RedirectView.as_view(url='/api/')),
    path('admin/', admin.site.urls),
    path('api/', include('monitoring.urls')),
    path('api/token/', obtain_auth_token, name='api_token_auth'),
    path('api/schema/', SpectacularAPIView.as_view(), name='schema'), 
    path('api/docs/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'), 
    path('api/redoc/', SpectacularRedocView.as_view(url='/api/schema/?format=json'), name='redoc'), 
###Front-end
    path('dashboard/', frontend_views.dashboard, name='dashboard'),
    path('stations/', frontend_views.stations, name='stations'),
    path('station/<slug:station_id>/', frontend_views.station_detail, name='station_detail'),
    path('about/', frontend_views.about, name='about'),
]
