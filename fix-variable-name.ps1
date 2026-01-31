# Script pour nettoyer le nom de variable avec espace invisible
$filePath = "c:\Users\moham\ArtisanSafe\frontend\src\app\artisan\devis\nouveau\page.tsx"
$content = Get-Content $filePath -Raw -Encoding UTF8

# Remplacer toutes les occurrences avec regex
$content = $content -replace 'matiereP\s+remiereTVA', 'matiereP remiereTVA'

# Sauvegarder
Set-Content -Path $filePath -Value $content -Encoding UTF8
Write-Host "Fixed!" -ForegroundColor Green
