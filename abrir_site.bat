@echo off
title Abrir site dos professores
cd /d "%~dp0"

where python >nul 2>nul
if errorlevel 1 (
  echo Python nao foi encontrado neste computador.
  echo Abra o arquivo index.html diretamente no navegador.
  pause
  exit /b 1
)

echo Iniciando o site dos professores...
start "Servidor do site dos professores" /min python server.py
timeout /t 2 /nobreak >nul
start "" "http://127.0.0.1:8080/index.html?v=14"

echo.
echo Se o navegador nao abrir, copie este endereco:
echo http://127.0.0.1:8080/index.html?v=14
echo.
echo Login admin local:
echo senha admin123
echo.
echo Os dados ficam salvos no arquivo:
echo dados_professores.json
echo.
echo Pode deixar esta janela aberta enquanto estiver usando o site.
pause
