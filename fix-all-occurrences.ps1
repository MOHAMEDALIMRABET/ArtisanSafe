# Script pour renommer matiereP*remiereTVA en matiereP remiereTVA (sans espace)
$filePath = "c:\Users\moham\ArtisanSafe\frontend\src\app\artisan\devis\nouveau\page.tsx"
$content = Get-Content $filePath -Raw -Encoding UTF8

# Remplacements
$content = $content -replace 'const \[matiereP[^\]]+remiereTVA,\s*set[^\]]+remiereTVA\]', 'const [matiereP remiereTVA, setMatiereP remiereTVA]'
$content = $content -replace 'value=\{matiereP[^\}]+remiereTVA\}', 'value={matiereP remiereTVA}'
$content = $content -replace 'setMatiereP[^\(]+remiereTVA', 'setMatiereP remiereTVA'
$content = $content -replace 'matiereP[^\s\)]+remiereTVA', 'matiereP remiereTVA'

# Sauvegarder
Set-Content -Path $filePath -Value $content -Encoding UTF8
Write-Host "Fixed all occurrences!" -ForegroundColor Green
