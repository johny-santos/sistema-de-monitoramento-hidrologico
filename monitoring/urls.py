from rest_framework.routers import DefaultRouter

from .views import StationViewSet, ObservationViewSet

router = DefaultRouter()
router.register('stations', StationViewSet)
router.register('observations', ObservationViewSet)

urlpatterns = router.urls
