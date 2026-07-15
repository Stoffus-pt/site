@echo off
cd /d "%~dp0..\.."
set SRC=site\assets\inbox\aro-sem-fundo.png
if not exist "%SRC%" (
  echo.
  echo  Coloque a imagem em:
  echo  site\assets\inbox\aro-sem-fundo.png
  echo.
  pause
  exit /b 1
)
node site\tools\publish-model-photo.mjs aro "%CD%\%SRC%" 2
node site\tools\rebuild-card-thumbs.mjs aro
echo.
echo  Aro slot 2 publicado. Capa do catalogo = foto sem fundo.
echo  Actualize o site com Ctrl+F5.
echo.
pause
