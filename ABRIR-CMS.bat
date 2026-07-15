@echo off

cd /d "%~dp0"

set PHP=C:\xampp\php\php.exe

if not exist "%PHP%" (
  echo Nao encontrei o PHP do XAMPP em C:\xampp\php\php.exe
  echo Instale o XAMPP ou ajuste o caminho neste ficheiro.
  pause
  exit /b 1
)

echo.
echo  Stoffus Site + CMS (local)
echo  ==========================
echo  Site:  http://127.0.0.1:8080/index.html
echo  CMS:   http://127.0.0.1:8080/cms/
echo.
echo  Prima Ctrl+C para parar.
echo.

start "" "http://127.0.0.1:8080/index.html"

"%PHP%" -S 127.0.0.1:8080 router.php

pause
