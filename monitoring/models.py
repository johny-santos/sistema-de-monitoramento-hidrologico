from django.db import models

class station(models.Model):
    name = models.CharField(max_length=200)
    municipio = models.CharField(max_length=255)
    
