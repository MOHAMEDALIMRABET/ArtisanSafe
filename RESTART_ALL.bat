@echo off
echo ========================================
echo REDEMARRAGE ARTISANDISPO
echo ========================================
echo.

REM Verifier si PM2 est installe
where pm2 >nul 2>&1
if %errorlevel% == 0 (
    echo [PM2] Redemarrage backend via PM2...
    cd backend
    pm2 restart artisandispo-backend 2>nul || pm2 start ecosystem.config.js
    cd ..
    echo.
    pm2 status
) else (
    echo [WARN] PM2 non installe. Installer : npm install -g pm2
    echo Demarrage classique...
    taskkill /F /IM node.exe 2>nul
    timeout /t 2 /nobreak >nul
    cd backend
    start "Backend Server" cmd /k "npm run dev"
    cd ..
)
echo.
echo Demarrage du serveur frontend...
cd frontend
start "Frontend Server" cmd /k "npm run dev"
cd ..
echo.
echo ========================================
echo Serveurs demarres !
echo Backend  : http://localhost:5000
echo Frontend : http://localhost:3000
echo Health   : http://localhost:5000/api/v1/health
echo ========================================
echo.
pause
