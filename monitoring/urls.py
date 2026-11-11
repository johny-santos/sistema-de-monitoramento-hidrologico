from rest_framework.routers import DefaultRouter
from .views import StationViewSet, ObservationViewSet
from rest_framework.authtoken.views import obtain_auth_token

router = DefaultRouter()
router.register('stations', StationViewSet)
router.register('observations', ObservationViewSet)

urlpatterns = router.urls
