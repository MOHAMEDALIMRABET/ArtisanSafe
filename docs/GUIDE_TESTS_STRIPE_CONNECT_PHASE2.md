# Guide de Tests Manuels - Stripe Connect (Phase 2)

## 📋 Vue d'ensemble

Ce guide détaille les tests manuels à effectuer pour valider l'intégration Stripe Connect complète avec :
- ✅ Onboarding artisan via formulaire ArtisanDispo
- ✅ Webhooks Stripe pour mise à jour automatique des statuts
- ✅ Gestion des erreurs et statuts spéciaux

---

## 🔧 Configuration préalable

### 1. Variables d'environnement

**Backend** `backend/.env` :
```env
# Stripe API
STRIPE_SECRET_KEY=sk_test_51...YOUR_TEST_KEY

# Webhooks (2 secrets différents)
STRIPE_WEBHOOK_SECRET=whsec_...EXPRESS_WEBHOOK           # Pour paiements Express
STRIPE_CONNECT_WEBHOOK_SECRET=whsec_...CONNECT_WEBHOOK   # Pour Connect onboarding
```

**Frontend** `frontend/.env.local` :
```env
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_51...YOUR_TEST_KEY
```

### 2. Installer Stripe CLI (OBLIGATOIRE pour tests locaux)

**Windows** :
```bash
# Via Scoop
scoop bucket add stripe https://github.com/stripe/scoop-stripe-cli.git
scoop install stripe

# Vérifier installation
stripe --version
```

**macOS/Linux** :
```bash
brew install stripe/stripe-cli/stripe
```

**Login Stripe CLI** :
```bash
stripe login
# Ouvre un navigateur pour connecter votre compte Stripe
```

### 3. Démarrer les serveurs

**Terminal 1 - Backend** :
```bash
cd backend
npm run dev
# Serveur sur http://localhost:5000
```

**Terminal 2 - Frontend** :
```bash
cd frontend
npm run dev
# Serveur sur http://localhost:3000
```

**Terminal 3 - Stripe CLI (webhooks)** :
```bash
# Forward webhooks Connect vers backend local
stripe listen --forward-to localhost:5000/api/v1/stripe/webhook

# ⚠️ COPIER le webhook secret affiché :
# whsec_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
# → Mettre dans STRIPE_CONNECT_WEBHOOK_SECRET (.env)
```

---

## ✅ Tests Phase 2

### Test 1 : Onboarding artisan complet (statut → active)

**Objectif** : Tester le flux complet d'onboarding avec IBAN de test valide.

**Étapes** :

1. **Connexion artisan** :
   - Aller sur http://localhost:3000/connexion
   - Se connecter avec un compte artisan (ou en créer un)

2. **Accéder au wallet** :
   - Aller sur http://localhost:3000/artisan/wallet
   - Vérifier statut initial : "🏦 Configurez votre compte bancaire"
   - Cliquer sur "Configurer mon compte bancaire"

3. **Remplir formulaire onboarding** (Étape 1/2) :
   - Prénom : `Test`
   - Nom : `Artisan`
   - Date de naissance : `01/01/1990` (+ de 18 ans)
   - Adresse : `1 rue de test`
   - Complément : (vide ou "Appartement 5")
   - Ville : `Paris`
   - Code postal : `75001`
   - Pays : `France` (par défaut)
   - Cliquer "Suivant"

4. **Remplir informations bancaires** (Étape 2/2) :
   - IBAN : `FR1420041010050500013M02606` (IBAN test Stripe)
   - BIC : `BNPAFRPPXXX` (BNP Paribas)
   - Titulaire : `Test Artisan`
   - Cliquer "Configurer mon compte"

5. **Vérifications après soumission** :
   - Redirection vers `/artisan/wallet?onboarding=success`
   - Message succès : "✅ Compte bancaire configuré avec succès"
   - Statut affiché : "⏳ Vérification en cours" ou "✅ Compte actif"

6. **Vérifier Firestore** :
   ```
   Collection: wallets/{artisanId}
   - stripeAccountId: "acct_xxxxxx"
   - stripeOnboardingStatus: "active" ou "under_review"
   - ibanLast4: "2606"
   - stripeActivatedAt: Timestamp (si active)
   ```

7. **Vérifier Stripe Dashboard** :
   - Aller sur https://dashboard.stripe.com/test/connect/accounts
   - Trouver le compte créé (email de l'artisan)
   - Vérifier statut : "Active" ou "Pending"

**Résultat attendu** :
- ✅ Compte Stripe créé
- ✅ IBAN ajouté (jamais stocké dans Firestore)
- ✅ Statut `active` ou `under_review` dans Firestore
- ✅ Webhook reçu (voir logs Stripe CLI)

---

### Test 2 : Webhooks - Mise à jour automatique du statut

**Objectif** : Tester que les webhooks Stripe mettent à jour automatiquement le statut dans Firestore.

**Étapes** :

1. **Créer un compte** (comme Test 1)

2. **Simuler événement account.updated** :
   ```bash
   # Dans terminal Stripe CLI
   stripe trigger account.updated
   ```

3. **Vérifier logs backend** :
   ```
   📡 Webhook Stripe reçu: account.updated
   ✅ Webhook vérifié: account.updated
   📊 Nouveau statut pour {artisanId}: active
   ✅ Wallet mis à jour pour {artisanId}: active
   ```

4. **Vérifier Firestore** :
   ```
   wallets/{artisanId}
   - stripeOnboardingStatus: "active"
   - lastStripeSync: Timestamp (mis à jour)
   ```

5. **Vérifier frontend** :
   - Rafraîchir `/artisan/wallet`
   - Statut affiché doit correspondre à Firestore

**Résultat attendu** :
- ✅ Webhook reçu et vérifié (signature)
- ✅ Statut mis à jour automatiquement dans Firestore
- ✅ Pas d'action manuelle requise

---

### Test 3 : Documents manquants (statut → documents_required)

**Objectif** : Tester le cas où Stripe demande des documents supplémentaires.

**Étapes** :

1. **Créer un compte test** (comme Test 1)

2. **Simuler demande de documents** via Stripe Dashboard :
   - Aller sur https://dashboard.stripe.com/test/connect/accounts
   - Sélectionner le compte créé
   - Actions → "Request information"
   - Sélectionner "Identity document" (pièce d'identité)
   - Soumettre

3. **Vérifier webhook reçu** :
   ```bash
   # Logs backend
   📡 Webhook: account.updated pour acct_xxxxx
   📊 Nouveau statut: documents_required
   - currently_due: 1
   ```

4. **Vérifier Firestore** :
   ```
   wallets/{artisanId}
   - stripeOnboardingStatus: "documents_required"
   - stripeRequirements: {
       currentlyDue: ["individual.verification.document"],
       eventuallyDue: [],
       errors: []
     }
   ```

5. **Vérifier frontend** :
   - Rafraîchir `/artisan/wallet`
   - Message affiché : "📄 Documents supplémentaires requis"
   - Bouton "Ajouter des documents"

**Résultat attendu** :
- ✅ Statut change automatiquement à `documents_required`
- ✅ Liste des documents requis stockée dans Firestore
- ✅ Frontend affiche le bon message

---

### Test 4 : Vérification échouée (statut → rejected)

**Objectif** : Tester le cas de rejet du compte par Stripe.

**⚠️ Note** : Difficile à simuler en environnement test. Utiliser Stripe CLI :

**Étapes** :

1. **Créer compte avec IBAN frauduleux (simulation)** :
   - Utiliser IBAN : `FR1420041010050500013M02607` (modifier dernier chiffre)
   - Stripe peut marquer comme suspect

2. **OU simuler via Stripe Dashboard** :
   - Dashboard → Connect → Accounts → Sélectionner compte
   - Actions → "Reject account"
   - Raison : "rejected.fraud"

3. **Vérifier webhook** :
   ```bash
   📡 Webhook: account.updated
   📊 Nouveau statut: rejected
   - disabled_reason: rejected.fraud
   ```

4. **Vérifier Firestore** :
   ```
   wallets/{artisanId}
   - stripeOnboardingStatus: "rejected"
   - stripeDisabledReason: "rejected.fraud"
   ```

5. **Vérifier frontend** :
   - Message : "❌ Compte rejeté"
   - Explication : "Votre compte a été rejeté par Stripe"

**Résultat attendu** :
- ✅ Statut `rejected` dans Firestore
- ✅ Raison du rejet stockée
- ✅ Artisan ne peut plus recevoir de paiements

---

### Test 5 : Compte restreint (statut → restricted)

**Objectif** : Tester les restrictions temporaires.

**Étapes** :

1. **Simuler restriction** via Dashboard :
   - Dashboard → Connect → Accounts
   - Sélectionner compte
   - Actions → "Restrict account"
   - Raison : "requirements.past_due" (délai dépassé)

2. **Vérifier webhook** :
   ```
   📊 Nouveau statut: restricted
   - disabled_reason: requirements.past_due
   ```

3. **Vérifier Firestore** :
   ```
   wallets/{artisanId}
   - stripeOnboardingStatus: "restricted"
   - stripeDisabledReason: "requirements.past_due"
   ```

4. **Vérifier frontend** :
   - Message : "⚠️ Compte restreint"
   - Action requise affichée

**Résultat attendu** :
- ✅ Statut `restricted` (différent de `rejected`)
- ✅ Raison de restriction stockée
- ✅ Message explicatif pour l'artisan

---

### Test 6 : Upload de documents (KYC)

**Objectif** : Tester l'upload de documents de vérification.

**Étapes** :

1. **Préparer documents test** :
   - Créer un fichier PDF : `piece-identite.pdf`
   - Ou image JPG : `carte-identite.jpg`

2. **Appeler endpoint upload** :
   ```bash
   curl -X POST http://localhost:5000/api/v1/stripe/upload-document \
     -F "stripeAccountId=acct_xxxxx" \
     -F "documentType=identity_document" \
     -F "file=@piece-identite.pdf"
   ```

3. **Vérifier réponse** :
   ```json
   {
     "success": true,
     "message": "Document uploadé avec succès"
   }
   ```

4. **Vérifier Stripe Dashboard** :
   - Dashboard → Connect → Accounts → Sélectionner compte
   - Onglet "Files uploaded"
   - Document doit apparaître

5. **Vérifier webhook account.updated** :
   - Si document valide → statut peut passer à `under_review`
   - Si document invalide → reste `documents_required`

**Résultat attendu** :
- ✅ Document uploadé sur Stripe
- ✅ Webhook mis à jour automatiquement
- ✅ Statut change si tous docs fournis

---

## 🧪 IBAN de test Stripe

### IBAN valides (France)

```
FR1420041010050500013M02606  ✅ Compte valide (recommandé)
FR7630006000011234567890189  ✅ Compte valide alternatif
```

### IBAN pour tester erreurs

```
FR1420041010050500013M02607  ❌ Compte invalide (erreur validation)
FR0000000000000000000000000  ❌ Format invalide
```

### BIC de test

```
BNPAFRPPXXX  ✅ BNP Paribas (valide)
SOGEFRPPXXX  ✅ Société Générale (valide)
CEPAFRPP340  ✅ Caisse d'Épargne (valide)
```

---

## 📊 Vérification des statuts

### Table de correspondance

| Statut Stripe | Statut ArtisanDispo | Description |
|--------------|---------------------|-------------|
| `charges_enabled=true` + `payouts_enabled=true` | `active` | Compte entièrement vérifié |
| `currently_due.length > 0` | `documents_required` | Documents manquants |
| `pending_verification.length > 0` | `under_review` | Vérification en cours (24-48h) |
| `disabled_reason=rejected.*` | `rejected` | Compte rejeté définitivement |
| `disabled_reason=other` | `restricted` | Compte temporairement restreint |
| Défaut | `pending` | Configuration en cours |

### Commandes de vérification

**Vérifier compte Stripe via CLI** :
```bash
stripe accounts retrieve acct_xxxxx
```

**Vérifier webhooks reçus** :
```bash
stripe events list --limit 10
```

**Tester webhook manuellement** :
```bash
stripe trigger account.updated
stripe trigger capability.updated
```

---

## 🚨 Checklist de tests

### ✅ Tests obligatoires

- [ ] Onboarding complet avec IBAN valide → statut `active`
- [ ] Webhook `account.updated` met à jour Firestore
- [ ] Documents manquants → statut `documents_required`
- [ ] Upload de document fonctionne
- [ ] IBAN invalide → erreur affichée
- [ ] Date de naissance < 18 ans → erreur

### ✅ Tests optionnels (Edge cases)

- [ ] Compte rejeté → statut `rejected`
- [ ] Compte restreint → statut `restricted`
- [ ] Webhook signature invalide → erreur 400
- [ ] Déconnexion compte (deauthorized)
- [ ] Capability.updated event

---

## 🐛 Résolution de problèmes

### Webhook non reçu

**Symptôme** : Statut ne se met pas à jour automatiquement

**Solutions** :
1. Vérifier Stripe CLI actif : `stripe listen --forward-to localhost:5000/api/v1/stripe/webhook`
2. Vérifier logs backend : doit afficher "📡 Webhook reçu"
3. Vérifier `STRIPE_CONNECT_WEBHOOK_SECRET` dans `.env`
4. Tester manuellement : `stripe trigger account.updated`

### Erreur "Webhook signature verification failed"

**Cause** : Mauvais webhook secret

**Solution** :
1. Relancer `stripe listen`
2. Copier le nouveau `whsec_xxxxx` affiché
3. Mettre à jour `STRIPE_CONNECT_WEBHOOK_SECRET` dans `.env`
4. Redémarrer backend

### IBAN refusé alors qu'il est valide

**Cause** : Format avec espaces ou mauvais BIC

**Solution** :
1. Enlever espaces de l'IBAN : `FR1420041010050500013M02606`
2. Utiliser BIC valide : `BNPAFRPPXXX`
3. Vérifier pays = `FR`

### Statut bloqué sur "pending"

**Cause** : Documents manquants détectés par Stripe

**Solution** :
1. Appeler endpoint `/api/v1/stripe/account-status/{accountId}`
2. Vérifier `currentlyDue` dans la réponse
3. Upload documents requis via `/api/v1/stripe/upload-document`

---

## 📝 Logs à surveiller

### Backend (console)

```
✅ À voir :
📡 Webhook Stripe reçu: account.updated
✅ Webhook vérifié: account.updated
📊 Nouveau statut pour {id}: active
✅ Wallet mis à jour pour {id}: active

❌ Erreurs possibles :
❌ Webhook: Signature manquante
❌ Webhook signature verification failed
❌ Aucun artisan trouvé avec stripeAccountId
```

### Stripe CLI

```
✅ Normal :
→ POST /api/v1/stripe/webhook [200]
← account.updated [evt_xxxxx]

❌ Problèmes :
→ POST /api/v1/stripe/webhook [400]  (signature invalide)
→ POST /api/v1/stripe/webhook [500]  (erreur serveur)
```

### Firestore (Collections à surveiller)

```
wallets/{artisanId}
  - stripeAccountId: "acct_xxxxx"
  - stripeOnboardingStatus: "active"
  - lastStripeSync: Timestamp
  - ibanLast4: "2606"
  
artisans/{artisanId}
  - stripeAccountId: "acct_xxxxx"
```

---

## 🎯 Critères de succès Phase 2

✅ **Fonctionnel** :
- Onboarding artisan fonctionne de bout en bout
- Webhooks mettent à jour les statuts automatiquement
- Tous les statuts (active, documents_required, rejected, restricted) sont gérés
- Upload de documents fonctionne

✅ **Sécurité** :
- IBAN jamais stocké dans Firestore
- Webhooks signés et vérifiés
- Erreurs Stripe gérées proprement

✅ **UX** :
- Messages clairs pour chaque statut
- Actions requises indiquées à l'artisan
- Bouton "💡 Processus de configuration" aide à comprendre

---

## 📚 Ressources

- **Stripe Connect Docs** : https://stripe.com/docs/connect
- **Webhooks Connect** : https://stripe.com/docs/connect/webhooks
- **Test data** : https://stripe.com/docs/connect/testing
- **Stripe CLI** : https://stripe.com/docs/stripe-cli

---

**Auteur** : ArtisanDispo Dev Team  
**Date** : 21 février 2026  
**Version** : Phase 2 - Webhooks + Gestion erreurs
