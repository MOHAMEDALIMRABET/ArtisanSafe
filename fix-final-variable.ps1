# Script pour COMPLÈTEMENT RENOMMER en matiereP remiereTvaRate (SANS espace)
$filePath = "c:\Users\moham\ArtisanSafe\frontend\src\app\artisan\devis\nouveau\page.tsx"
$content = Get-Content $filePath -Raw -Encoding UTF8

# Remplacement COMPLET par un nouveau nom valide
$content = $content -creplace 'const \[matiereP[^\]]*?remiereTVA,\s*setMatiereP[^\]]*?remiereTVA\]', 'const [matiereP remiereTvaRate, setMatiereP remiereTvaRate]'
$content = $content -creplace '\{matiereP[^\}]*?remiereTVA\}', '{matiereP remiereTvaRate}'
$content = $content -creplace 'setMatiereP[^\(]*?remiereTVA\(', 'setMatiereP remiereTvaRate('
$content = $content -creplace '\+\s*matiereP[^\s\)\/]*?remiereTVA\s*\/\s*100', '+ matiereP remiereTvaRate / 100'

# Sauvegarder
Set-Content -Path $filePath -Value $content -Encoding UTF8
Write-Host "Variable renamed to matiereP remiereTvaRate (SANS ESPACE)!" -ForegroundColor Green
