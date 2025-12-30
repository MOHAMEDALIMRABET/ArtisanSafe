# Script de vérification de la configuration - Windows PowerShell
# Usage: .\verify-setup.ps1

Write-Host "`n🔍 Vérification de la configuration ArtisanSafe...`n" -ForegroundColor Cyan

$hasErrors = $false

# Fonction de vérification
function Check-EnvFile {
    param(
        [string]$FilePath,
        [string[]]$RequiredVars
    )
    
    $fileName = Split-Path $FilePath -Leaf
    
    if (-Not (Test-Path $FilePath)) {
        Write-Host "❌ $fileName - MANQUANT" -ForegroundColor Red
        Write-Host "   Créez le fichier : $FilePath`n" -ForegroundColor Yellow
        return $false
    }
    
    Write-Host "✅ $fileName - TROUVÉ" -ForegroundColor Green
    
    $content = Get-Content $FilePath -Raw
    $missingVars = @()
    
    foreach ($varName in $RequiredVars) {
        if ($content -notmatch "(?m)^$varName=.+") {
            $missingVars += $varName
        }
    }
    
    if ($missingVars.Count -gt 0) {
        Write-Host "   ⚠️  Variables manquantes ou vides :" -ForegroundColor Yellow
        foreach ($v in $missingVars) {
            Write-Host "      - $v" -ForegroundColor Yellow
        }
        return $false
    } else {
        Write-Host "   ✅ Toutes les variables requises sont présentes" -ForegroundColor Green
    }
    
    Write-Host ""
    return $true
}

# Vérification Frontend
Write-Host "📱 FRONTEND" -ForegroundColor Cyan
Write-Host ("=" * 50)
$frontendOk = Check-EnvFile `
    -FilePath "frontend\.env.local" `
    -RequiredVars @(
        "NEXT_PUBLIC_API_URL",
        "NEXT_PUBLIC_FIREBASE_API_KEY",
        "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
        "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
        "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",
        "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
        "NEXT_PUBLIC_FIREBASE_APP_ID"
    )

if (-Not $frontendOk) { $hasErrors = $true }

# Vérification Backend
Write-Host "🖥️  BACKEND" -ForegroundColor Cyan
Write-Host ("=" * 50)
$backendOk = Check-EnvFile `
    -FilePath "backend\.env" `
    -RequiredVars @(
        "PORT",
        "NODE_ENV",
        "FIREBASE_PROJECT_ID",
        "FIREBASE_CLIENT_EMAIL",
        "FIREBASE_PRIVATE_KEY",
        "ALLOWED_ORIGINS"
    )

if (-Not $backendOk) { $hasErrors = $true }

# Vérification des dépendances
Write-Host "📦 DÉPENDANCES" -ForegroundColor Cyan
Write-Host ("=" * 50)

if (Test-Path "frontend\node_modules") {
    Write-Host "✅ frontend\node_modules - INSTALLÉ`n" -ForegroundColor Green
} else {
    Write-Host "❌ frontend\node_modules - MANQUANT" -ForegroundColor Red
    Write-Host "   Exécutez : cd frontend; npm install`n" -ForegroundColor Yellow
    $hasErrors = $true
}

if (Test-Path "backend\node_modules") {
    Write-Host "✅ backend\node_modules - INSTALLÉ`n" -ForegroundColor Green
} else {
    Write-Host "❌ backend\node_modules - MANQUANT" -ForegroundColor Red
    Write-Host "   Exécutez : cd backend; npm install`n" -ForegroundColor Yellow
    $hasErrors = $true
}

# Résultat final
Write-Host ("=" * 50)
if ($hasErrors) {
    Write-Host "`n❌ CONFIGURATION INCOMPLÈTE`n" -ForegroundColor Red
    Write-Host "Veuillez corriger les erreurs ci-dessus avant de démarrer l'application." -ForegroundColor Yellow
    Write-Host "Consultez le fichier INSTALLATION.md pour plus d'informations.`n" -ForegroundColor Yellow
    exit 1
} else {
    Write-Host "`n✅ CONFIGURATION VALIDE`n" -ForegroundColor Green
    Write-Host "Vous pouvez démarrer l'application :" -ForegroundColor Cyan
    Write-Host "  1. Terminal 1 : cd frontend; npm run dev" -ForegroundColor White
    Write-Host "  2. Terminal 2 : cd backend; npm run dev`n" -ForegroundColor White
    exit 0
}
