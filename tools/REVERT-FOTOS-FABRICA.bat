@echo off
chcp 65001 >nul
setlocal

set "SITE=%~dp0.."
set "BACKUP=%SITE%backups\fotos-fabrica-20260711"
set "PHOTOS=%SITE%assets\photos\empresa"

echo.
echo  Reverter integracao das fotos da fabrica Stoffus
echo  =================================================
echo.

if not exist "%BACKUP%\empresa.html" (
  echo [ERRO] Backup nao encontrado em:
  echo   %BACKUP%
  echo.
  pause
  exit /b 1
)

echo A restaurar ficheiros HTML e CSS...
copy /Y "%BACKUP%\empresa.html" "%SITE%\empresa.html" >nul
copy /Y "%BACKUP%\tecidos.html" "%SITE%\tecidos.html" >nul
copy /Y "%BACKUP%\site.css" "%SITE%\css\site.css" >nul

echo A remover fotos adicionadas nesta integracao...
for %%F in (
  producao-cnc.png
  armazem-tecidos.png
  corte-tecidos.png
  costura-atelier.png
  costura-detalhe.png
) do (
  if exist "%PHOTOS%\%%F" del "%PHOTOS%\%%F"
)

echo.
echo [OK] Site revertido ao estado anterior as fotos da fabrica.
echo      A foto fabrica-stoffus.png na Historia foi mantida.
echo      Abra http://127.0.0.1:8080/empresa.html e faca Ctrl+F5.
echo.
pause
