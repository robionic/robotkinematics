from django.urls import path

from . import views


urlpatterns = [
    path("", views.home, name="home"),
    path("api/derive/", views.derive, name="derive"),
    path("api/import-robot/", views.import_robot, name="import-robot"),
]
