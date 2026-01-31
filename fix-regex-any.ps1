# Script pour renommer avec recherche flexible (n'importe quel caractère entre P et r)
$filePath = "c:\Users\moham\ArtisanSafe\frontend\src\app\artisan\devis\nouveau\page.tsx"
$content = Get-Content $filePath -Raw -Encoding UTF8

# Remplacement COMPLET avec recherche flexible pour tout caractère entre P et r
$content = $content -creplace 'const \[matiereP.remiereTvaRate,\s*setMatiereP.remiereTvaRate\]', 'const [matiereP remiereTvaRate, setMatiereP remiereTvaRate]'
$content = $content -creplace '\{matiereP.remiereTvaRate\}', '{matiereP remiereTvaRate}'
$content = $content -creplace 'setMatiereP.remiereTvaRate\(', 'setMatiereP remiereTvaRate('
$content = $content -creplace '\+\s*matiereP.remiereTvaRate\s*\/\s*100', '+ matiereP remiereTvaRate / 100'

# Sauvegarder
Set-Content -Path $filePath -Value $content -Encoding UTF8
Write-Host "FIXED WITH REGEX!" -ForegroundColor Green
