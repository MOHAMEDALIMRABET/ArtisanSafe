#!/bin/bash

# Script de configuration Stripe Connect - Phase 2
# Configure l'environnement de développement pour les webhooks Stripe Connect

echo "🚀 Configuration Stripe Connect - Phase 2"
echo "==========================================="
echo ""

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Fonction pour vérifier si une commande existe
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# 1. Vérifier Stripe CLI installé
echo "📦 Étape 1/5 : Vérification Stripe CLI"
if command_exists stripe; then
    STRIPE_VERSION=$(stripe --version)
    echo -e "${GREEN}✅ Stripe CLI installé : ${STRIPE_VERSION}${NC}"
else
    echo -e "${RED}❌ Stripe CLI non installé${NC}"
    echo ""
    echo "Installation requise :"
    echo "  macOS/Linux : brew install stripe/stripe-cli/stripe"
    echo "  Windows : scoop install stripe"
    echo ""
    echo "Voir : https://stripe.com/docs/stripe-cli"
    exit 1
fi

# 2. Vérifier login Stripe
echo ""
echo "🔐 Étape 2/5 : Vérification authentification Stripe"
if stripe config --list >/dev/null 2>&1; then
    echo -e "${GREEN}✅ Authentifié sur Stripe${NC}"
else
    echo -e "${YELLOW}⚠️  Non authentifié${NC}"
    echo "Lancement de l'authentification..."
    stripe login
fi

# 3. Vérifier fichier .env backend
echo ""
echo "⚙️  Étape 3/5 : Vérification configuration backend"
if [ -f "backend/.env" ]; then
    echo -e "${GREEN}✅ Fichier backend/.env trouvé${NC}"
    
    # Vérifier STRIPE_SECRET_KEY
    if grep -q "STRIPE_SECRET_KEY=sk_test_" backend/.env; then
        echo -e "${GREEN}  ✅ STRIPE_SECRET_KEY configuré${NC}"
    else
        echo -e "${RED}  ❌ STRIPE_SECRET_KEY manquant ou invalide${NC}"
        echo "     Ajouter dans backend/.env : STRIPE_SECRET_KEY=sk_test_..."
    fi
    
    # Vérifier STRIPE_CONNECT_WEBHOOK_SECRET
    if grep -q "STRIPE_CONNECT_WEBHOOK_SECRET=" backend/.env; then
        echo -e "${YELLOW}  ⚠️  STRIPE_CONNECT_WEBHOOK_SECRET déjà configuré${NC}"
        echo "     Si webhooks ne fonctionnent pas, relancer stripe listen pour générer nouveau secret"
    else
        echo -e "${BLUE}  ℹ️  STRIPE_CONNECT_WEBHOOK_SECRET sera configuré à l'étape 5${NC}"
    fi
else
    echo -e "${RED}❌ Fichier backend/.env non trouvé${NC}"
    echo "   Copier backend/.env.example → backend/.env"
    exit 1
fi

# 4. Vérifier fichier .env.local frontend
echo ""
echo "⚙️  Étape 4/5 : Vérification configuration frontend"
if [ -f "frontend/.env.local" ]; then
    echo -e "${GREEN}✅ Fichier frontend/.env.local trouvé${NC}"
    
    if grep -q "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_" frontend/.env.local; then
        echo -e "${GREEN}  ✅ NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY configuré${NC}"
    else
        echo -e "${RED}  ❌ NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY manquant${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  Fichier frontend/.env.local non trouvé${NC}"
    echo "   Créer frontend/.env.local avec NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_..."
fi

# 5. Proposition d'activer webhook listener
echo ""
echo "🎧 Étape 5/5 : Configuration webhook listener"
echo ""
echo -e "${BLUE}Pour recevoir les webhooks Stripe en local :${NC}"
echo ""
echo "1. Ouvrir un NOUVEAU terminal"
echo "2. Lancer la commande :"
echo ""
echo -e "${GREEN}   stripe listen --forward-to localhost:5000/api/v1/stripe/webhook${NC}"
echo ""
echo "3. Copier le webhook secret affiché (whsec_...)"
echo "4. Ajouter dans backend/.env :"
echo ""
echo -e "${GREEN}   STRIPE_CONNECT_WEBHOOK_SECRET=whsec_xxxxxxxxx${NC}"
echo ""
echo "5. Redémarrer le backend"
echo ""

read -p "Voulez-vous lancer stripe listen maintenant ? (y/n) " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo ""
    echo -e "${YELLOW}⚠️  IMPORTANT : Copiez le webhook secret (whsec_...) affiché ci-dessous${NC}"
    echo -e "${YELLOW}   et ajoutez-le dans backend/.env${NC}"
    echo ""
    echo "Lancement de stripe listen..."
    echo ""
    
    # Lancer stripe listen
    stripe listen --forward-to localhost:5000/api/v1/stripe/webhook
else
    echo ""
    echo -e "${BLUE}ℹ️  Vous pouvez lancer stripe listen plus tard avec :${NC}"
    echo "   stripe listen --forward-to localhost:5000/api/v1/stripe/webhook"
fi

echo ""
echo "✅ Configuration terminée !"
echo ""
echo "📚 Prochaines étapes :"
echo "  1. Vérifier que backend et frontend sont lancés"
echo "  2. S'assurer que stripe listen est actif"
echo "  3. Tester onboarding sur http://localhost:3000/artisan/wallet"
echo "  4. Consulter docs/GUIDE_TESTS_STRIPE_CONNECT_PHASE2.md pour tests complets"
echo ""
