# 🚀 DÉMARRAGE RAPIDE - Phase 2 Stripe

> **Pour commencer immédiatement les tests**

---

## ⚡ ÉTAPES RAPIDES (10 minutes)

### 1. Installer dépendances Stripe

```bash
# Terminal 1 - Frontend
cd frontend
npm install @stripe/stripe-js @stripe/react-stripe-js
```

### 2. Créer compte Stripe (si pas encore fait)

1. Aller sur : https://dashboard.stripe.com/register
2. Créer compte (email + mot de passe)
3. ✅ **Mode TEST activé par défaut** (bon pour développement)

### 3. Récupérer clés API Stripe

1. Dashboard Stripe : **Developers** → **API keys**
2. Copier **2 clés** :
   - **Publishable key** (commence par `pk_test_...`)
   - **Secret key** (commence par `sk_test_...`)

### 4. Configurer variables environnement

**Frontend** - Créer `frontend/.env.local` :
```env
NEXT_PUBLIC_API_URL=http://localhost:5000/api/v1
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_51...VOTRE_CLE_ICI
```

**Backend** - Modifier `backend/.env` (ajouter) :
```env
STRIPE_SECRET_KEY=sk_test_51...VOTRE_CLE_ICI
STRIPE_WEBHOOK_SECRET=whsec_...ON_CONFIGURE_CA_APRES
```

### 5. Démarrer serveurs

```bash
# Terminal 1 - Backend
cd backend
npm run dev

# Terminal 2 - Frontend  
cd frontend
npm run dev
```

### 6. Premier test simple

1. **Créer compte artisan** : http://localhost:3000/inscription?role=artisan
2. **Configurer Stripe Connect** : http://localhost:3000/artisan/paiements
   - Cliquer "Créer mon compte"
   - Remplir formulaire Stripe (mode test)
   - IBAN test : `000123456789`
3. **Créer devis** (client → artisan)
4. **Payer devis** (client) :
   - Carte test : `4242 4242 4242 4242`
   - Date : `12/34`
   - CVC : `123`
5. ✅ **Vérifier** : Contrat créé, argent bloqué

---

## 📊 FICHIERS CRÉÉS (Phase 2)

### Code Production
1. ✅ `frontend/src/components/StripePaymentForm.tsx` - Composant paiement Stripe
2. ✅ `frontend/src/app/artisan/paiements/page.tsx` - Onboarding Stripe Connect
3. ✅ `backend/src/routes/webhooks.routes.ts` - Sécurité webhooks
4. ✅ `backend/src/routes/payments.routes.ts` - Modifié (Stripe Connect)
5. ✅ `backend/src/server.ts` - Modifié (routes webhooks)

### Documentation
6. ✅ `docs/GUIDE_TESTS_STRIPE_PHASE2.md` - Guide tests complet (630 lignes)
7. ✅ `docs/INTEGRATION_STRIPE_ELEMENTS.md` - Intégration frontend (420 lignes)
8. ✅ `docs/PHASE2_STRIPE_COMPLETE.md` - Récapitulatif complet
9. ✅ `frontend/.env.example` - Modifié (variables Stripe)
10. ✅ `backend/.env.example` - Modifié (variables Stripe)

---

## 🎯 PROCHAINES ACTIONS

### Option A : Tests rapides (30 min)
Suivre : [`GUIDE_TESTS_STRIPE_PHASE2.md`](./GUIDE_TESTS_STRIPE_PHASE2.md) - Section "TEST 1"

### Option B : Intégration complète (1h)
Suivre : [`INTEGRATION_STRIPE_ELEMENTS.md`](./INTEGRATION_STRIPE_ELEMENTS.md)

### Option C : Webhooks production (30 min)
1. Dashboard Stripe : **Developers** → **Webhooks** → **Add endpoint**
2. URL : `https://votre-domaine.com/api/v1/webhooks/stripe`
3. Événements :
   - ✓ `payment_intent.amount_capturable_updated`
   - ✓ `payment_intent.payment_failed`
   - ✓ `charge.captured`
   - ✓ `transfer.created`
4. Copier **Signing secret** → Variable `STRIPE_WEBHOOK_SECRET`

---

## 💡 CARTES DE TEST STRIPE

| Carte | Résultat |
|-------|----------|
| `4242 4242 4242 4242` | ✅ Paiement réussi |
| `4000 0000 0000 0002` | ❌ Carte refusée |
| `4000 0000 0000 9995` | ❌ Fonds insuffisants |

**Date** : `12/34` (toute date future)  
**CVC** : `123` (3 chiffres quelconques)

---

## 🔍 VÉRIFICATIONS RAPIDES

### Backend démarré ?
```bash
curl http://localhost:5000/api/v1/health
# Attendu : {"status":"success", ...}
```

### Clés Stripe configurées ?
```bash
# Frontend
echo $NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
# Doit afficher : pk_test_...

# Backend
node -e "console.log(process.env.STRIPE_SECRET_KEY)"
# Doit afficher : sk_test_...
```

### Dépendances installées ?
```bash
cd frontend
npm list @stripe/stripe-js
# Si erreur → npm install @stripe/stripe-js @stripe/react-stripe-js
```

---

## ⚠️ PROBLÈMES FRÉQUENTS

### "Stripe is not defined"
```bash
cd frontend
npm install @stripe/stripe-js @stripe/react-stripe-js
npm run dev  # Redémarrer
```

### "Invalid API Key"
Vérifier que clé commence par `pk_test_` (frontend) ou `sk_test_` (backend)

### "Artisan n'a pas configuré son compte"
Artisan doit compléter onboarding : `/artisan/paiements`

### Modal paiement ne s'affiche pas
1. Vérifier console navigateur (F12)
2. Vérifier backend logs
3. Vérifier variable `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`

---

## 📞 RESSOURCES

- **Dashboard Stripe** : https://dashboard.stripe.com/test/dashboard
- **Documentation Stripe** : https://stripe.com/docs/payments
- **Stripe CLI** : https://stripe.com/docs/stripe-cli (pour webhooks locaux)
- **Support Stripe** : support@stripe.com

- **Documentation ArtisanSafe** :
  - [`GUIDE_TESTS_STRIPE_PHASE2.md`](./GUIDE_TESTS_STRIPE_PHASE2.md) - Tests complets
  - [`INTEGRATION_STRIPE_ELEMENTS.md`](./INTEGRATION_STRIPE_ELEMENTS.md) - Intégration
  - [`PHASE2_STRIPE_COMPLETE.md`](./PHASE2_STRIPE_COMPLETE.md) - Récapitulatif

---

## ✅ CHECKLIST

- [ ] Compte Stripe créé
- [ ] Clés API récupérées (pk_test_ + sk_test_)
- [ ] Variables environnement configurées (.env.local + .env)
- [ ] Dépendances npm installées (@stripe/stripe-js)
- [ ] Serveurs démarrés (backend:5000 + frontend:3000)
- [ ] Premier test paiement réussi (carte 4242...)
- [ ] Artisan Stripe Connect configuré
- [ ] Webhooks testés (optionnel pour développement)

---

**🎉 Prêt à tester ! Suivre [`GUIDE_TESTS_STRIPE_PHASE2.md`](./GUIDE_TESTS_STRIPE_PHASE2.md)**
