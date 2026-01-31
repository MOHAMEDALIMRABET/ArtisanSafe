# Script pour renommer la variable correctement
$filePath = "c:\Users\moham\ArtisanSafe\frontend\src\app\artisan\devis\nouveau\page.tsx"
$content = Get-Content $filePath -Raw -Encoding UTF8

# Remplacer partout (même avec espaces)
$content = $content -replace 'matiereP\s*remiereTVA', 'matiereP remiereTVA'
$content = $content -replace 'setmatiereP\s*remiereTVA', 'setMatiereP remiereTVA'

# Sauvegarder
Set-Content -Path $filePath -Value $content -Encoding UTF8
Write-Host "Variable renamed successfully!" -ForegroundColor Green
