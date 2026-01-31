# Script pour renommer complètement en matiereP remiereTVA
$filePath = "c:\Users\moham\ArtisanSafe\frontend\src\app\artisan\devis\nouveau\page.tsx"
$content = Get-Content $filePath -Raw -Encoding UTF8

# Remplacement complet avec nouveau nom
$content = $content -replace 'const \[matiereP[^\]]*?remiereTVA,\s*setMatiereP[^\]]*?remiereTVA\]', 'const [matiereP remiereTVA, setMatiereP remiereTVA]'
$content = $content -replace '\{matiereP[^\}]*?remiereTVA\}', '{matiereP remiereTVA}'
$content = $content -replace 'setMatiereP[^\(]*?remiereTVA', 'setMatiereP remiereTVA'
$content = $content -replace '\+\s*matiereP[^\s\)\/]*?remiereTVA', '+ matiereP remiereTVA'

# Sauvegarder
Set-Content -Path $filePath -Value $content -Encoding UTF8
Write-Host "Renamed to matiereP remiereTVA!" -ForegroundColor Green
