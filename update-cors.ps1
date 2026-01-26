# Script PowerShell pour mettre à jour les règles CORS Firebase Storage
# Nécessite Google Cloud SDK avec gsutil

Write-Host "🔧 Mise à jour des règles CORS Firebase Storage..." -ForegroundColor Cyan

# Vérifier si gsutil est installé
if (!(Get-Command gsutil -ErrorAction SilentlyContinue)) {
    Write-Host "❌ gsutil n'est pas installé!" -ForegroundColor Red
    Write-Host ""
    Write-Host "📋 Options pour appliquer les règles CORS :" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "OPTION 1: Console Firebase (RECOMMANDÉ)" -ForegroundColor Green
    Write-Host "1. Aller sur https://console.firebase.google.com" -ForegroundColor White
    Write-Host "2. Sélectionner le projet 'artisansafe'" -ForegroundColor White
    Write-Host "3. Aller dans Storage" -ForegroundColor White
    Write-Host "4. Cliquer sur l'onglet 'Rules'" -ForegroundColor White
    Write-Host "5. Ajouter les règles CORS manuellement" -ForegroundColor White
    Write-Host ""
    Write-Host "OPTION 2: Installer Google Cloud SDK" -ForegroundColor Green
    Write-Host "1. Télécharger: https://cloud.google.com/sdk/docs/install" -ForegroundColor White
    Write-Host "2. Installer et initialiser avec: gcloud init" -ForegroundColor White
    Write-Host "3. Réexécuter ce script" -ForegroundColor White
    Write-Host ""
    Write-Host "OPTION 3: Utiliser curl (temporaire)" -ForegroundColor Green
    Write-Host "Les règles CORS doivent inclure:" -ForegroundColor White
    Write-Host '  "origin": ["http://localhost:3000"]' -ForegroundColor White
    Write-Host '  "method": ["GET", "HEAD", "POST", "PUT", "DELETE"]' -ForegroundColor White
    Write-Host '  "maxAgeSeconds": 3600' -ForegroundColor White
    
    exit 1
}

# Appliquer les règles CORS
Write-Host "📤 Application des règles CORS..." -ForegroundColor Cyan
gsutil cors set cors.json gs://artisansafe.appspot.com

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Règles CORS mises à jour avec succès!" -ForegroundColor Green
    Write-Host ""
    Write-Host "📋 Règles appliquées:" -ForegroundColor Yellow
    Get-Content cors.json | Write-Host -ForegroundColor White
    Write-Host ""
    Write-Host "🔄 Redémarrez le serveur frontend pour appliquer les changements" -ForegroundColor Cyan
} else {
    Write-Host "❌ Erreur lors de la mise à jour des règles CORS" -ForegroundColor Red
    exit 1
}
