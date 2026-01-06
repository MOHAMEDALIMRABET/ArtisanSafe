@echo off
echo ========================================
echo REDEMARRAGE DU SERVEUR BACKEND
echo ========================================
echo.
echo Arret des processus Node.js existants...
taskkill /F /IM node.exe 2>nul
timeout /t 2 /nobreak >nul
echo.
echo Demarrage du serveur backend...
cd backend
start cmd /k "npm run dev"
echo.
echo ========================================
echo Serveur backend redemarre !
echo Surveillez le nouveau terminal pour les logs.
echo ========================================
pause
