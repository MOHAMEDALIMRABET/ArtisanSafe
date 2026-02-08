@echo off
echo ========================================
echo REDEMARRAGE DES SERVEURS
echo ========================================
echo.
echo Arret des processus Node.js existants...
taskkill /F /IM node.exe 2>nul
timeout /t 2 /nobreak >nul
echo.
echo Demarrage du serveur backend...
cd backend
start "Backend Server" cmd /k "npm run dev"
cd ..
echo.
echo Demarrage du serveur frontend...
cd frontend
start "Frontend Server" cmd /k "npm run dev"
cd ..
echo.
echo ========================================
echo Les deux serveurs ont ete redemarres !
echo Backend: http://localhost:5000
echo Frontend: http://localhost:3000
echo ========================================
echo.
pause
