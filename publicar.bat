@echo off
echo Publicando cambios en GitHub...
cd /d "%~dp0"
git add client.json manifest.json icon-192.png icon-512.png daniel_finance_v6.html sw.js
git commit -m "update: config y assets actualizados"
git push
echo.
echo ✓ Listo! Los cambios estaran en la app en 1-2 minutos.
echo   Abre la app y recarga con: Menu > Mas herramientas > Borrar datos
pause
