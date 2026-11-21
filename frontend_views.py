from django.shortcuts import render

def dashboard(request):
    return render(request, 'dashboard.html')

def stations(request):
    return render(request, 'stations.html')

def station_detail(request, station_id):
    return render(request, 'station_detail.html')

def about(request): 
    return render(request, 'about.html')