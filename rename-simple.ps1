# Renommer en mpTvaRate (SIMPLE ET SANS ESPACE)
$filePath = "c:\Users\moham\ArtisanSafe\frontend\src\app\artisan\devis\nouveau\page.tsx"
$content = Get-Content $filePath -Raw -Encoding UTF8

# NOUVEAU NOM SIMPLE : mpTvaRate
$content = $content -replace 'const \[matiereP.{1,10}remiereTvaRate,\s*setMatiereP.{1,10}remiereTvaRate\]', 'const [mpTvaRate, setMpTvaRate]'
$content = $content -replace '\{matiereP.{1,10}remiereTvaRate\}', '{mpTvaRate}'
$content = $content -replace 'setMatiereP.{1,10}remiereTvaRate\(', 'setMpTvaRate('
$content = $content -replace '\+\s*matiereP.{1,10}remiereTvaRate\s*\/\s*100', '+ mpTvaRate / 100'

# Sauvegarder
Set-Content -Path $filePath -Value $content -Encoding UTF8
Write-Host "RENAMED TO mpTvaRate!" -ForegroundColor Green
