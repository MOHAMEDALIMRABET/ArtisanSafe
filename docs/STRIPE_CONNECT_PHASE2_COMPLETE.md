# Stripe Connect - Phase 2 : Webhooks & Gestion d'erreurs

## 📋 Résumé de la Phase 2

**Date de réalisation** : 21 février 2026  
**Statut** : ✅ IMPLÉMENTÉ

Cette phase complète l'intégration Stripe Connect avec :
1. ✅ Webhooks Stripe pour mise à jour automatique des statuts
2. ✅ Gestion complète des erreurs et statuts spéciaux
3. ✅ Tests manuels documentés
4. ✅ Scripts de configuration automatiques

---

## 🎯 Objectifs Phase 2

### Objectifs principaux
- [x] Implémenter endpoint webhook `/api/v1/stripe/webhook`
- [x] Gérer événement `account.updated` automatiquement
- [x] Gérer événement `account.application.deauthorized`
- [x] Gérer événement `capability.updated`
- [x] Mapper tous les statuts Stripe vers statuts ArtisanDispo
- [x] Gestion d'erreurs robuste (rejected, restricted, documents_required)
- [x] Guide de tests manuels complet
- [x] Scripts de configuration (Bash + PowerShell)

### Statuts gérés
- [x] `not_started` - Pas encore configuré
- [x] `pending` - Configuration en cours
- [x] `documents_required` - Documents supplémentaires requis
- [x] `under_review` - Vérification en cours par Stripe (24-48h)
- [x] `active` - Compte entièrement vérifié et actif
- [x] `rejected` - Compte rejeté définitivement
- [x] `restricted` - Compte temporairement restreint

---

## 📂 Fichiers créés/modifiés

### Backend - Nouveaux services

1. **`backend/src/services/stripe-webhook-handler.service.ts`** (266 lignes)
   - Handler principal des webhooks Stripe
   - Fonctions :
     - `handleAccountUpdated()` - Gère account.updated
     - `handleAccountDeauthorized()` - Gère déconnexion compte
     - `handleCapabilityUpdated()` - Gère mise à jour capabilities
     - `verifyWebhookSignature()` - Vérifie signature Stripe (sécurité)
     - `mapStripeStatusToWalletStatus()` - Mappe statuts Stripe → ArtisanDispo
     - `handleStripeWebhook()` - Router des événements

2. **`backend/src/services/stripe-connect.service.ts`** (MODIFIÉ)
   - **Ajouté** : `getDetailedAccountStatus()` (100 lignes)
     - Récupère statut détaillé du compte Stripe
     - Mappe vers statuts ArtisanDispo
     - Retourne actions requises et erreurs
   - **Amélioré** : Gestion d'erreurs dans `getStripeAccountStatus()`
     - Détecte `StripeInvalidRequestError`
     - Détecte `account_invalid`
     - Messages d'erreur clairs

### Backend - Routes

3. **`backend/src/routes/stripe.routes.ts`** (MODIFIÉ)
   - **Ajouté** : Import `stripe-webhook-handler.service.ts`
   - **Ajouté** : Endpoint `POST /api/v1/stripe/webhook` (65 lignes)
     - Reçoit webhooks Stripe Connect
     - Vérifie signature avec `STRIPE_CONNECT_WEBHOOK_SECRET`
     - Traite événements de manière asynchrone
     - Répond 200 immédiatement (best practice)

4. **`backend/src/server.ts`** (MODIFIÉ)
   - **Ajouté** : Configuration raw body pour webhooks
     ```javascript
     app.use('/api/v1/stripe/webhook', express.raw({ type: 'application/json' }));
     ```
   - ⚠️ **CRITIQUE** : Doit être AVANT `express.json()` pour Stripe

### Configuration

5. **`backend/.env.example`** (MODIFIÉ)
   - **Ajouté** : Section Stripe Connect webhooks
   - **Ajouté** : Variable `STRIPE_CONNECT_WEBHOOK_SECRET`
   - Documentation détaillée configuration webhook

### Documentation

6. **`docs/GUIDE_TESTS_STRIPE_CONNECT_PHASE2.md`** (500+ lignes)
   - Guide complet de tests manuels
   - 6 scénarios de tests détaillés :
     1. Onboarding complet (statut → active)
     2. Webhooks - Mise à jour automatique
     3. Documents manquants (→ documents_required)
     4. Vérification échouée (→ rejected)
     5. Compte restreint (→ restricted)
     6. Upload de documents (KYC)
   - IBAN de test Stripe fournis
   - Table de correspondance statuts
   - Résolution de problèmes
   - Checklist complète

### Scripts de configuration

7. **`scripts/setup-stripe-connect.sh`** (120 lignes - Bash)
   - Script interactif pour configurer environnement
   - Vérifie Stripe CLI installé
   - Vérifie authentification Stripe
   - Vérifie fichiers .env
   - Lance `stripe listen` automatiquement
   - **Usage** : `bash scripts/setup-stripe-connect.sh`

8. **`scripts/setup-stripe-connect.ps1`** (120 lignes - PowerShell)
   - Version Windows du script Bash
   - Mêmes fonctionnalités
   - **Usage** : `.\scripts\setup-stripe-connect.ps1`

---

## 🔄 Workflow des webhooks

### Flux complet

```
1. Artisan configure IBAN → Stripe crée compte
                          ↓
2. Stripe vérifie informations (24-48h)
                          ↓
3. Stripe envoie webhook → account.updated
                          ↓
4. Backend reçoit webhook → Vérifie signature
                          ↓
5. Handler traite événement → Mappe statut
                          ↓
6. Firestore mis à jour → wallets/{artisanId}
                          ↓
7. Frontend affiche nouveau statut (auto-refresh ou reload)
```

### Événements gérés

| Événement Stripe | Action dans ArtisanDispo |
|-----------------|--------------------------|
| `account.updated` | Met à jour `stripeOnboardingStatus` dans Firestore |
| `account.application.deauthorized` | Réinitialise statut → `not_started` |
| `capability.updated` | Met à jour statut selon capabilities |

### Mapping statuts Stripe → ArtisanDispo

| Condition Stripe | Statut ArtisanDispo |
|-----------------|---------------------|
| `charges_enabled=true` + `payouts_enabled=true` | `active` |
| `requirements.currently_due.length > 0` | `documents_required` |
| `requirements.pending_verification.length > 0` | `under_review` |
| `requirements.disabled_reason=rejected.*` | `rejected` |
| `requirements.disabled_reason` (autre) | `restricted` |
| Défaut | `pending` |

---

## 🔒 Sécurité

### Vérification signature webhook

**Pourquoi** : S'assurer que l'événement vient bien de Stripe (pas d'un attaquant)

**Comment** :
```typescript
const event = stripe.webhooks.constructEvent(
  req.body,        // Raw body (Buffer)
  signature,       // Header 'stripe-signature'
  webhookSecret    // STRIPE_CONNECT_WEBHOOK_SECRET
);
```

**Si signature invalide** :
- Webhook rejeté avec erreur 400
- Événement non traité
- Log d'erreur généré

### Variables d'environnement sensibles

**À NE JAMAIS commiter** :
- `STRIPE_SECRET_KEY` - Clé API Stripe (sk_test_...)
- `STRIPE_CONNECT_WEBHOOK_SECRET` - Secret webhook (whsec_...)

**Bonnes pratiques** :
- Utiliser `.env.example` comme modèle
- Ajouter `.env` dans `.gitignore`
- Générer nouveau webhook secret par environnement (dev/staging/production)

---

## 🧪 Configuration de test local

### Prérequis

1. **Stripe CLI installé**
   ```bash
   # macOS/Linux
   brew install stripe/stripe-cli/stripe
   
   # Windows
   scoop install stripe
   ```

2. **Authentification Stripe**
   ```bash
   stripe login
   ```

3. **Variables d'environnement configurées**
   - `backend/.env` : `STRIPE_SECRET_KEY`
   - `backend/.env` : `STRIPE_CONNECT_WEBHOOK_SECRET` (généré par stripe listen)
   - `frontend/.env.local` : `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`

### Lancement

**Terminal 1 - Backend** :
```bash
cd backend
npm run dev
```

**Terminal 2 - Frontend** :
```bash
cd frontend
npm run dev
```

**Terminal 3 - Stripe webhooks** :
```bash
stripe listen --forward-to localhost:5000/api/v1/stripe/webhook
# Copier le whsec_xxxxx affiché → STRIPE_CONNECT_WEBHOOK_SECRET
```

### Test rapide

1. Aller sur http://localhost:3000/artisan/wallet
2. Cliquer "Configurer mon compte bancaire"
3. Remplir formulaire avec IBAN test : `FR1420041010050500013M02606`
4. Soumettre
5. Vérifier logs backend : webhook `account.updated` reçu
6. Vérifier Firestore : `stripeOnboardingStatus` mis à jour

---

## 📊 Données stockées dans Firestore

### Collection `wallets/{artisanId}`

```typescript
{
  // Identifiant Stripe (référence)
  stripeAccountId: "acct_xxxxx",
  
  // Statut onboarding (mis à jour par webhooks)
  stripeOnboardingStatus: "active" | "pending" | "documents_required" | "under_review" | "rejected" | "restricted",
  
  // IBAN (4 derniers chiffres uniquement)
  ibanLast4: "2606",
  
  // Métadonnées de synchronisation
  lastStripeSync: Timestamp,
  stripeActivatedAt: Timestamp,  // Date d'activation
  
  // Si documents requis
  stripeRequirements: {
    currentlyDue: ["individual.verification.document"],
    eventuallyDue: [],
    errors: []
  },
  
  // Si compte rejeté/restreint
  stripeDisabledReason: "rejected.fraud" | "requirements.past_due" | ...
}
```

**Champs JAMAIS stockés** :
- ❌ IBAN complet
- ❌ BIC
- ❌ Informations bancaires sensibles

**Stockés uniquement dans Stripe** :
- ✅ IBAN complet (chiffré)
- ✅ BIC
- ✅ Documents de vérification

---

## 🐛 Résolution de problèmes courants

### Webhook non reçu

**Symptôme** : Statut ne se met pas à jour dans Firestore

**Causes possibles** :
1. Stripe CLI non lancé
2. Mauvais webhook secret dans `.env`
3. Backend non redémarré après changement `.env`

**Solutions** :
1. Vérifier `stripe listen` actif
2. Copier nouveau `whsec_xxxxx` dans `STRIPE_CONNECT_WEBHOOK_SECRET`
3. Redémarrer backend : `npm run dev`

### Erreur "Webhook signature verification failed"

**Cause** : Signature webhook invalide ou webhook secret incorrect

**Solution** :
1. Relancer `stripe listen --forward-to localhost:5000/api/v1/stripe/webhook`
2. Copier le **NOUVEAU** `whsec_xxxxx` affiché
3. Remplacer dans `backend/.env`
4. Redémarrer backend

### Statut reste "pending" indéfiniment

**Cause** : Documents manquants non détectés

**Solution** :
1. Appeler `/api/v1/stripe/account-status/{accountId}`
2. Vérifier `currentlyDue` dans la réponse
3. Upload documents via `/api/v1/stripe/upload-document`

### Compte rejeté immédiatement

**Cause** : Informations invalides (IBAN test frauduleux, date de naissance < 18 ans)

**Solution** :
1. Utiliser IBAN valide : `FR1420041010050500013M02606`
2. Vérifier date de naissance > 18 ans
3. Recréer compte avec bonnes infos

---

## 📈 Améliorations futures (Phase 3)

### Gestion des transferts automatiques
- [ ] Implémenter transferts Stripe → compte artisan
- [ ] Calendrier de paiements (hebdo/mensuel)
- [ ] Historique des transferts dans Firestore

### Notifications artisan
- [ ] Email quand statut → `active`
- [ ] Email si documents requis
- [ ] Email si compte rejeté/restreint

### Dashboard admin
- [ ] Vue globale des comptes Stripe Connect
- [ ] Statistiques onboarding (taux succès)
- [ ] Liste comptes en attente de vérification

### Webhook retry logic
- [ ] Réessayer en cas d'échec traitement
- [ ] Queue d'événements (Redis/Bull)
- [ ] Dead letter queue pour erreurs permanentes

---

## 📚 Ressources

### Documentation officielle
- **Stripe Connect** : https://stripe.com/docs/connect
- **Webhooks** : https://stripe.com/docs/webhooks
- **Test Connect** : https://stripe.com/docs/connect/testing
- **Stripe CLI** : https://stripe.com/docs/stripe-cli

### Documentation ArtisanDispo
- **Guide tests Phase 2** : `docs/GUIDE_TESTS_STRIPE_CONNECT_PHASE2.md`
- **Phase 1 (Onboarding)** : `README_PHASE2_STRIPE.md`
- **Scripts config** : `scripts/setup-stripe-connect.sh` | `.ps1`

---

## ✅ Checklist Phase 2

### Implémentation
- [x] Service webhook handler créé
- [x] Endpoint webhook implémenté
- [x] Vérification signature webhook
- [x] Gestion event `account.updated`
- [x] Gestion event `account.application.deauthorized`
- [x] Gestion event `capability.updated`
- [x] Mapping statuts Stripe → ArtisanDispo
- [x] Gestion erreurs robuste
- [x] Fonction `getDetailedAccountStatus()`

### Documentation
- [x] Guide de tests manuels complet
- [x] IBAN de test fournis
- [x] Résolution de problèmes
- [x] Scripts de configuration (Bash + PowerShell)
- [x] Documentation webhooks

### Configuration
- [x] Variable `STRIPE_CONNECT_WEBHOOK_SECRET` ajoutée
- [x] Configuration raw body dans server.ts
- [x] .env.example mis à jour

### Tests
- [x] Test onboarding complet
- [x] Test webhook account.updated
- [x] Test documents_required
- [x] Test rejected/restricted
- [x] Test upload document

---

## 🎉 Résultat final

**✅ Phase 2 complète et opérationnelle**

Fonctionnalités disponibles :
1. ✅ Onboarding artisan via formulaire ArtisanDispo
2. ✅ IBAN jamais stocké dans notre base (sécurité maximale)
3. ✅ Webhooks Stripe mettent à jour statuts automatiquement
4. ✅ 7 statuts gérés (not_started → active)
5. ✅ Gestion complète des erreurs Stripe
6. ✅ Tests manuels documentés
7. ✅ Scripts configuration automatiques

**Temps de développement** : ~2-3 heures  
**Lignes de code** : ~800 lignes (backend + docs + scripts)  
**Fichiers modifiés/créés** : 8 fichiers

---

**Auteur** : ArtisanDispo Dev Team  
**Date** : 21 février 2026  
**Version** : Phase 2 - Production Ready
