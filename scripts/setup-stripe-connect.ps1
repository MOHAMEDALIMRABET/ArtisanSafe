# Script de configuration Stripe Connect - Phase 2 (Windows PowerShell)
# Configure l'environnement de développement pour les webhooks Stripe Connect

Write-Host "🚀 Configuration Stripe Connect - Phase 2" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# 1. Vérifier Stripe CLI installé
Write-Host "📦 Étape 1/5 : Vérification Stripe CLI" -ForegroundColor Yellow

try {
    $stripeVersion = stripe --version 2>&1
    Write-Host "✅ Stripe CLI installé : $stripeVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Stripe CLI non installé" -ForegroundColor Red
    Write-Host ""
    Write-Host "Installation requise (Windows) :" -ForegroundColor Yellow
    Write-Host "  1. Installer Scoop : https://scoop.sh" -ForegroundColor White
    Write-Host "  2. Lancer : scoop install stripe" -ForegroundColor White
    Write-Host ""
    Write-Host "Voir : https://stripe.com/docs/stripe-cli" -ForegroundColor White
    exit 1
}

# 2. Vérifier login Stripe
Write-Host ""
Write-Host "🔐 Étape 2/5 : Vérification authentification Stripe" -ForegroundColor Yellow

try {
    stripe config --list 2>&1 | Out-Null
    Write-Host "✅ Authentifié sur Stripe" -ForegroundColor Green
} catch {
    Write-Host "⚠️  Non authentifié" -ForegroundColor Yellow
    Write-Host "Lancement de l'authentification..." -ForegroundColor White
    stripe login
}

# 3. Vérifier fichier .env backend
Write-Host ""
Write-Host "⚙️  Étape 3/5 : Vérification configuration backend" -ForegroundColor Yellow

if (Test-Path "backend\.env") {
    Write-Host "✅ Fichier backend\.env trouvé" -ForegroundColor Green
    
    $envContent = Get-Content "backend\.env" -Raw
    
    # Vérifier STRIPE_SECRET_KEY
    if ($envContent -match "STRIPE_SECRET_KEY=sk_test_") {
        Write-Host "  ✅ STRIPE_SECRET_KEY configuré" -ForegroundColor Green
    } else {
        Write-Host "  ❌ STRIPE_SECRET_KEY manquant ou invalide" -ForegroundColor Red
        Write-Host "     Ajouter dans backend\.env : STRIPE_SECRET_KEY=sk_test_..." -ForegroundColor White
    }
    
    # Vérifier STRIPE_CONNECT_WEBHOOK_SECRET
    if ($envContent -match "STRIPE_CONNECT_WEBHOOK_SECRET=") {
        Write-Host "  ⚠️  STRIPE_CONNECT_WEBHOOK_SECRET déjà configuré" -ForegroundColor Yellow
        Write-Host "     Si webhooks ne fonctionnent pas, relancer stripe listen pour générer nouveau secret" -ForegroundColor White
    } else {
        Write-Host "  ℹ️  STRIPE_CONNECT_WEBHOOK_SECRET sera configuré à l'étape 5" -ForegroundColor Cyan
    }
} else {
    Write-Host "❌ Fichier backend\.env non trouvé" -ForegroundColor Red
    Write-Host "   Copier backend\.env.example → backend\.env" -ForegroundColor White
    exit 1
}

# 4. Vérifier fichier .env.local frontend
Write-Host ""
Write-Host "⚙️  Étape 4/5 : Vérification configuration frontend" -ForegroundColor Yellow

if (Test-Path "frontend\.env.local") {
    Write-Host "✅ Fichier frontend\.env.local trouvé" -ForegroundColor Green
    
    $frontendEnv = Get-Content "frontend\.env.local" -Raw
    
    if ($frontendEnv -match "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_") {
        Write-Host "  ✅ NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY configuré" -ForegroundColor Green
    } else {
        Write-Host "  ❌ NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY manquant" -ForegroundColor Red
    }
} else {
    Write-Host "⚠️  Fichier frontend\.env.local non trouvé" -ForegroundColor Yellow
    Write-Host "   Créer frontend\.env.local avec NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_..." -ForegroundColor White
}

# 5. Proposition d'activer webhook listener
Write-Host ""
Write-Host "🎧 Étape 5/5 : Configuration webhook listener" -ForegroundColor Yellow
Write-Host ""
Write-Host "Pour recevoir les webhooks Stripe en local :" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. Ouvrir un NOUVEAU terminal PowerShell" -ForegroundColor White
Write-Host "2. Lancer la commande :" -ForegroundColor White
Write-Host ""
Write-Host "   stripe listen --forward-to localhost:5000/api/v1/stripe/webhook" -ForegroundColor Green
Write-Host ""
Write-Host "3. Copier le webhook secret affiché (whsec_...)" -ForegroundColor White
Write-Host "4. Ajouter dans backend\.env :" -ForegroundColor White
Write-Host ""
Write-Host "   STRIPE_CONNECT_WEBHOOK_SECRET=whsec_xxxxxxxxx" -ForegroundColor Green
Write-Host ""
Write-Host "5. Redémarrer le backend" -ForegroundColor White
Write-Host ""

$response = Read-Host "Voulez-vous lancer stripe listen maintenant ? (y/n)"

if ($response -eq "y" -or $response -eq "Y") {
    Write-Host ""
    Write-Host "⚠️  IMPORTANT : Copiez le webhook secret (whsec_...) affiché ci-dessous" -ForegroundColor Yellow
    Write-Host "   et ajoutez-le dans backend\.env" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Lancement de stripe listen..." -ForegroundColor White
    Write-Host ""
    
    # Lancer stripe listen
    stripe listen --forward-to localhost:5000/api/v1/stripe/webhook
} else {
    Write-Host ""
    Write-Host "ℹ️  Vous pouvez lancer stripe listen plus tard avec :" -ForegroundColor Cyan
    Write-Host "   stripe listen --forward-to localhost:5000/api/v1/stripe/webhook" -ForegroundColor White
}

Write-Host ""
Write-Host "✅ Configuration terminée !" -ForegroundColor Green
Write-Host ""
Write-Host "📚 Prochaines étapes :" -ForegroundColor Cyan
Write-Host "  1. Vérifier que backend et frontend sont lancés" -ForegroundColor White
Write-Host "  2. S'assurer que stripe listen est actif" -ForegroundColor White
Write-Host "  3. Tester onboarding sur http://localhost:3000/artisan/wallet" -ForegroundColor White
Write-Host "  4. Consulter docs\GUIDE_TESTS_STRIPE_CONNECT_PHASE2.md pour tests complets" -ForegroundColor White
Write-Host ""
