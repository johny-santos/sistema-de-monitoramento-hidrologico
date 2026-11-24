@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"
title HidroMonitor - servidor

echo.
echo   ============================================
echo     HidroMonitor  -  Monitoramento Hidrologico
echo   ============================================
echo.

rem ---- 1. achar o Python (prefere o ambiente .venv do projeto) ----
set "PY="
if exist ".venv\Scripts\python.exe" set "PY=.venv\Scripts\python.exe"
if not defined PY (
  where python >nul 2>nul && set "PY=python"
)
if not defined PY (
  echo   [ERRO] Python nao encontrado. Instale o Python 3.12 em python.org e marque "Add to PATH".
  pause & exit /b 1
)

rem ---- 2. servidor ja esta rodando? so abre o navegador ----
netstat -ano | findstr /R /C:":8000 .*LISTENING" >nul
if not errorlevel 1 (
  echo   O servidor ja esta rodando. Abrindo o navegador...
  start "" http://127.0.0.1:8000/
  timeout /t 3 >nul & exit /b 0
)

rem ---- 3. dependencias (so instala se faltar algo) ----
"%PY%" -c "import django, rest_framework, django_filters, drf_spectacular, yaml" >nul 2>nul
if errorlevel 1 (
  echo   Instalando dependencias ^(so na primeira vez^)...
  "%PY%" -m pip install -r utilities\requirements.txt
  if errorlevel 1 ( echo   [ERRO] Falha ao instalar dependencias. & pause & exit /b 1 )
)

rem ---- 4. banco de dados ----
"%PY%" manage.py migrate --noinput >nul
if errorlevel 1 ( echo   [ERRO] Falha ao preparar o banco. & pause & exit /b 1 )

rem ---- 5. dados novos (opcional):  iniciar.bat dados ----
if /I "%~1"=="dados" (
  echo   Gerando dados de demonstracao das ultimas 72 horas...
  "%PY%" utilities\seed.js\seed.py
  "%PY%" manage.py importar_csv
)

echo.
echo   Site:           http://127.0.0.1:8000/
echo   Documentacao:   http://127.0.0.1:8000/api/docs/
echo   Admin:          http://127.0.0.1:8000/admin/
echo.
echo   Para encerrar: feche esta janela ou pressione Ctrl+C.
echo.

rem abre o navegador depois de alguns segundos (o servidor precisa subir)
start "" cmd /c "timeout /t 5 >nul & start http://127.0.0.1:8000/"

"%PY%" manage.py runserver 127.0.0.1:8000
pause
