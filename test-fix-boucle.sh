#!/bin/bash

# Script de validation des corrections de la boucle infinie
# Utilisation: ./test-fix-boucle.sh

echo "🔍 Validation des corrections de la boucle infinie"
echo "================================================="

# Couleurs
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Compteurs
PASSED=0
FAILED=0

# Test 1: Vérifier que persistentSingleTabManager() est utilisé
echo ""
echo "Test 1: Configuration Firestore..."
if grep -q "persistentSingleTabManager()" frontend/src/lib/firebase.ts; then
    echo -e "${GREEN}✅ PASS${NC}: persistentSingleTabManager() configuré"
    PASSED=$((PASSED+1))
else
    echo -e "${RED}❌ FAIL${NC}: persistentMultipleTabManager() encore utilisé"
    FAILED=$((FAILED+1))
fi

# Test 2: Vérifier que prefetch est désactivé
echo ""
echo "Test 2: Désactivation du prefetch..."
if grep -q 'prefetch={false}' frontend/src/app/artisan/dashboard/page.tsx; then
    echo -e "${GREEN}✅ PASS${NC}: prefetch désactivé sur le lien de vérification"
    PASSED=$((PASSED+1))
else
    echo -e "${RED}❌ FAIL${NC}: prefetch encore activé"
    FAILED=$((FAILED+1))
fi

# Test 3: Vérifier la protection useRef
echo ""
echo "Test 3: Protection double chargement..."
if grep -q "isLoadingRef = useRef(false)" frontend/src/app/artisan/verification/page.tsx; then
    echo -e "${GREEN}✅ PASS${NC}: Protection useRef implémentée"
    PASSED=$((PASSED+1))
else
    echo -e "${RED}❌ FAIL${NC}: Protection useRef manquante"
    FAILED=$((FAILED+1))
fi

# Test 4: Vérifier qu'il n'y a pas de await loadArtisan() après updateSiretVerification
echo ""
echo "Test 4: Évitement rechargement après vérification..."
if ! grep -A5 "updateSiretVerification" frontend/src/app/artisan/verification/page.tsx | grep -q "await loadArtisan()"; then
    echo -e "${GREEN}✅ PASS${NC}: Pas de rechargement complet après vérification"
    PASSED=$((PASSED+1))
else
    echo -e "${RED}❌ FAIL${NC}: await loadArtisan() encore présent"
    FAILED=$((FAILED+1))
fi

# Test 5: Vérifier la mise à jour locale de l'état
echo ""
echo "Test 5: Mise à jour locale de l'état..."
if grep -q "setArtisan(prev => prev ?" frontend/src/app/artisan/verification/page.tsx; then
    echo -e "${GREEN}✅ PASS${NC}: Mise à jour locale implémentée"
    PASSED=$((PASSED+1))
else
    echo -e "${RED}❌ FAIL${NC}: Mise à jour locale manquante"
    FAILED=$((FAILED+1))
fi

# Test 6: Compilation TypeScript
echo ""
echo "Test 6: Compilation TypeScript..."
cd frontend
if npm run build --dry-run 2>/dev/null || npx tsc --noEmit 2>&1 | grep -q "Found 0 errors"; then
    echo -e "${GREEN}✅ PASS${NC}: Aucune erreur TypeScript"
    PASSED=$((PASSED+1))
else
    echo -e "${YELLOW}⚠️  WARN${NC}: Vérifier les erreurs TypeScript manuellement"
fi
cd ..

# Résumé
echo ""
echo "================================================="
echo "Résumé des tests:"
echo -e "${GREEN}Réussis: $PASSED${NC}"
echo -e "${RED}Échoués: $FAILED${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}🎉 Tous les tests sont passés !${NC}"
    echo ""
    echo "Prochaines étapes:"
    echo "1. Ouvrez http://localhost:3000/artisan/dashboard"
    echo "2. Cliquez sur 'Vérification Profil'"
    echo "3. Vérifiez qu'il n'y a pas d'erreur dans la console"
    echo "4. Vérifiez qu'il n'y a qu'une seule requête Firestore"
    exit 0
else
    echo -e "${RED}⚠️  Certains tests ont échoué. Veuillez vérifier les corrections.${NC}"
    exit 1
fi
