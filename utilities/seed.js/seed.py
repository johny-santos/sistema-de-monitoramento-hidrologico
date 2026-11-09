import math
import os
import pandas as pd
import time
from datetime import datetime, timezone

# Lista de estações
stations = [
    {"id": "EST-01", "name": "Estação Aurora", "river": "Rio Aurora", "municipality": "Vila Aurora"},
    {"id": "EST-02", "name": "Estação Vale Verde", "river": "Rio Verde", "municipality": "Vale Verde"},
    {"id": "EST-03", "name": "Estação Campo Alto", "river": "Rio do Campo", "municipality": "Campo Alto"}
]

output_file = "dados_estacoes_excel.csv"

# Arredonda para a hora atual em milissegundos
end_hour = math.floor(time.time() * 1000 / 3600000) * 3600000
dados_lista = []

for index in range(73):
    ts_ms = end_hour - (72 - index) * 3600000
    timestamp = datetime.fromtimestamp(ts_ms / 1000, tz=timezone.utc).isoformat().replace("+00:00", "Z")
    
    for station_index, station in enumerate(stations):
        level = 1.05 + station_index * 0.24 + 0.08 * math.sin(index / 5 + station_index)
        
        if ((index + station_index * 7) % 17) < 3:
            rain = 0.4 + ((index + station_index) % 4) * 0.35
        else:
            rain = 0
            
        dados_lista.append({
            "station_id": station["id"],
            "station_name": station["name"],
            "river": station["river"],
            "municipality": station["municipality"],
            "metric": "level",
            "observed_at": timestamp,
            "value": round(level, 2),
            "unit": "m",
            "source": "synthetic"
        })
        
        dados_lista.append({
            "station_id": station["id"],
            "station_name": station["name"],
            "river": station["river"],
            "municipality": station["municipality"],
            "metric": "rain",
            "observed_at": timestamp,
            "value": round(rain, 2),
            "unit": "mm/h",
            "source": "synthetic"
        })

df = pd.DataFrame(dados_lista)

# AS DUAS MUDANÇAS CRUCIAIS:
# sep=";" separa as colunas direto no Excel nacional
# encoding="utf-8-sig" adiciona o marcador BOM para o Excel ler acentos sem erro
df.to_csv(output_file, index=False, sep=";", encoding="utf-8-sig")

print(f"Sucesso! Arquivo '{output_file}' gerado sob medida para o Excel.")
