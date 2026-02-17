# 🚀 Guide Installation Stripe - Système de Paiement Express

> **Guide complet** pour configurer Stripe et tester les paiements sécurisés avec séquestre (escrow) dans le système Express d'ArtisanSafe.

## 📋 Vue d'ensemble

**Ce qui a été implémenté** :
- ✅ Backend: Services Firestore (demande-express, paiement-express)
- ✅ Backend: Routes Stripe API (5 endpoints : create, webhook, capture, refund, status)
- ✅ Backend: Webhook signature verification (sécurité)
- ✅ Frontend: Intégration Stripe Elements (PaymentElement)
- ✅ Frontend: Page de paiement avec formulaire carte sécurisé
- ✅ Frontend: Page de succès après redirection Stripe
- ✅ Système escrow: Fonds bloqués jusqu'à `capture_method='manual'`
- ✅ Commission: 10% plateforme, 90% artisan (hardcodé)

**Ce qu'il reste à faire** :
- ⏳ Installer packages NPM
- ⏳ Créer compte Stripe TEST
- ⏳ Configurer variables d'environnement
- ⏳ Configurer webhook endpoint
- ⏳ Tester avec cartes de test
- ⏳ (Optionnel) Configurer mode production

---

## 🔧 ÉTAPE 1 : Installation des packages NPM

### Backend
```bash
cd backend
npm install stripe
```

**Version attendue** : `stripe@^14.0.0` (ou supérieure)

### Frontend
```bash
cd frontend
npm install @stripe/stripe-js @stripe/react-stripe-js
```

**Versions attendues** :
- `@stripe/stripe-js@^2.0.0`
- `@stripe/react-stripe-js@^2.0.0`

**Vérification** :
```bash
# Backend
grep "stripe" backend/package.json

# Frontend
grep "@stripe" frontend/package.json
```

---

## 🏦 ÉTAPE 2 : Créer un compte Stripe TEST

### 2.1. Inscription
1. Aller sur https://dashboard.stripe.com/register
2. Remplir le formulaire :
   - Email professionnel (conseillé)
   - Mot de passe sécurisé
   - Nom de l'entreprise : "ArtisanSafe TEST"
3. Valider l'email

### 2.2. Activer le mode TEST
⚠️ **CRITIQUE** : Vous devez être en mode **TEST** pour le développement

1. Dans le dashboard Stripe, cherchez le toggle en haut à droite
2. Vérifier qu'il affiche **"Mode test"** (devrait être bleu/violet)
3. Si vous voyez "Mode production", cliquer dessus pour basculer en TEST

**Pourquoi mode TEST ?** :
- ✅ Pas de vrais paiements
- ✅ Utilise des cartes de test (4242 4242 4242 4242)
- ✅ Pas besoin de KYC (vérification identité)
- ✅ Développement sans risque

---

## 🔑 ÉTAPE 3 : Récupérer les clés API

### 3.1. Accéder aux clés
1. Dashboard Stripe → Menu gauche : **Developers**
2. Cliquer sur **API keys**
3. Vérifier que vous êtes bien en **Test mode** (bannière violette en haut)

### 3.2. Copier les clés

**Clé PUBLISHABLE (pour frontend)** :
```
Publishable key: pk_test_51...XXXXXXXXXXXXXXXXXX
```
- ✅ Cette clé est **publique** (peut être exposée)
- ✅ Utilisée côté client (frontend)
- ✅ Permet uniquement de collecter infos carte (pas de charges)

**Clé SECRET (pour backend)** :
```
Secret key: sk_test_51...XXXXXXXXXXXXXXXXXX (Afficher/Révéler)
```
- ⚠️ Cette clé est **SECRÈTE** (ne jamais exposer)
- ⚠️ Utilisée côté serveur (backend uniquement)
- ⚠️ Permet de créer des charges réelles

### 3.3. Stocker les clés

**Backend** : `backend/.env`
```bash
# Copier le template
cp backend/.env.example backend/.env

# Éditer backend/.env (remplacer les valeurs)
STRIPE_SECRET_KEY=sk_test_51...VOTRE_CLE_SECRETE_ICI
STRIPE_WEBHOOK_SECRET=whsec_...ON_LE_RECUPERERA_A_L_ETAPE_4
```

**Frontend** : `frontend/.env.local`
```bash
# Copier le template
cp frontend/.env.local.example frontend/.env.local

# Éditer frontend/.env.local (remplacer la valeur)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_51...VOTRE_CLE_PUBLIQUE_ICI
NEXT_PUBLIC_API_URL=http://localhost:5000/api/v1
```

**⚠️ IMPORTANT** : Ne jamais committer `.env` ou `.env.local` !

Vérifier `.gitignore` :
```bash
# Devrait contenir :
backend/.env
frontend/.env.local
.env
```

---

## 🪝 ÉTAPE 4 : Configurer le Webhook

### Pourquoi un webhook ?
Le webhook permet à Stripe de **notifier votre backend** quand un événement se produit (paiement réussi, remboursement effectué).

### 4.1. Créer l'endpoint webhook

**Dashboard Stripe** → **Developers** → **Webhooks** → **Add endpoint**

### 4.2. URL du webhook

#### Option A : Développement LOCAL avec ngrok (recommandé)

**Installer ngrok** :
1. Télécharger : https://ngrok.com/download
2. Dézipper
3. Lancer backend :
   ```bash
   cd backend
   npm run dev
   ```
4. Dans un nouveau terminal, lancer ngrok :
   ```bash
   ngrok http 5000
   ```
5. Copier l'URL HTTPS affichée :
   ```
   Forwarding: https://abcd-1234-efgh-5678.ngrok-free.app → http://localhost:5000
   ```

**URL webhook à entrer dans Stripe** :
```
https://abcd-1234-efgh-5678.ngrok-free.app/api/v1/stripe-express/webhook
```

⚠️ **Note** : L'URL ngrok change à chaque redémarrage ! Pensez à mettre à jour le webhook.

#### Option B : Développement LOCAL avec Stripe CLI (alternative)

**Installer Stripe CLI** :
1. Instructions : https://stripe.com/docs/stripe-cli
2. Lancer :
   ```bash
   stripe login
   stripe listen --forward-to localhost:5000/api/v1/stripe-express/webhook
   ```
3. Le CLI affiche le webhook secret :
   ```
   Ready! Your webhook signing secret is whsec_1234567890abcdef
   ```
4. Copier ce secret → `backend/.env` → `STRIPE_WEBHOOK_SECRET`

#### Option C : Production (HTTPS requis)

**URL webhook (remplacer par votre domaine)** :
```
https://api.artisansafe.com/api/v1/stripe-express/webhook
```

### 4.3. Sélectionner les événements

⚠️ **IMPORTANT** : Seuls **2 événements** sont gérés dans le code backend

Cocher uniquement :
- ✅ `payment_intent.succeeded` (paiement réussi)
- ✅ `charge.refunded` (remboursement)

**Ne PAS cocher** les autres événements (ils ne sont pas gérés).

### 4.4. Récupérer le Signing Secret

1. Cliquer **Add endpoint**
2. Stripe affiche le webhook créé
3. Cliquer sur le webhook pour voir les détails
4. Copier **Signing secret** :
   ```
   whsec_1234567890abcdefghijklmnopqrstuvwxyz
   ```

### 4.5. Mettre à jour backend/.env

```bash
# Éditer backend/.env
STRIPE_WEBHOOK_SECRET=whsec_1234567890abcdefghijklmnopqrstuvwxyz
```

**⚠️ Redémarrer le backend après modification** :
```bash
cd backend
# Ctrl+C pour arrêter
npm run dev
```

---

## 🧪 ÉTAPE 5 : Tester le système de paiement

### 5.1. Lancer les serveurs

**Terminal 1 - Backend** :
```bash
cd backend
npm run dev
# Devrait afficher : Server running on port 5000
```

**Terminal 2 - Frontend** :
```bash
cd frontend
npm run dev
# Devrait afficher : ▲ Next.js ready on http://localhost:3000
```

**Terminal 3 - ngrok (si utilisé)** :
```bash
ngrok http 5000
# Noter l'URL HTTPS
```

### 5.2. Workflow complet de test

#### Étape 1 : Créer une demande Express
1. Se connecter comme **Client**
2. Aller sur `/petits-travaux-express/recherche`
3. Cliquer **"Nouvelle demande Express"**
4. Remplir le formulaire :
   - Catégorie : ex. "Électricité"
   - Problème : ex. "Prise ne fonctionne plus"
   - Adresse : ex. "15 rue Jean Jaurès, 75011 Paris"
   - Prix proposé : ex. 80€
5. Valider → Demande créée avec statut `publiee`

#### Étape 2 : Artisan fait une proposition
1. Se déconnecter → Se connecter comme **Artisan**
2. Aller sur `/petits-travaux-express/demandes-disponibles`
3. Trouver la demande créée
4. Cliquer **"Faire une proposition"**
5. Remplir :
   - Prix : ex. 80€ (ou négocier)
   - Message : ex. "Je peux intervenir aujourd'hui"
6. Valider → Proposition envoyée

#### Étape 3 : Client accepte la proposition
1. Se déconnecter → Se connecter comme **Client**
2. Aller sur dashboard client → Mes demandes Express
3. Cliquer sur la demande
4. Voir la proposition artisan
5. Cliquer **"Accepter cette proposition"**
6. **Confirmation** → Redirection automatique vers `/client/paiement-express/[propositionId]`

#### Étape 4 : Payer avec Stripe
1. La page de paiement affiche :
   - Résumé intervention
   - Formulaire carte (Stripe Elements)
   - Montant total
2. Entrer **carte de test Stripe** :
   ```
   Numéro : 4242 4242 4242 4242
   Date expiration : 12/25 (ou n'importe quelle date future)
   CVC : 123 (ou n'importe quel 3 chiffres)
   Code postal : 12345
   ```
3. Cliquer **"Payer X€"**
4. Attendre (2-5 secondes) → Stripe traite le paiement
5. **Redirection automatique** → `/client/paiement-success?demandeId=...`
6. Page de succès affiche :
   - ✅ Paiement réussi
   - Infos séquestre
   - Étapes suivantes

### 5.3. Vérifications backend (logs)

**Dans le terminal backend**, vous devriez voir :
```
🔔 Stripe webhook reçu : payment_intent.succeeded
💳 Création paiement Express : Paiement-ABC123
✅ Paiement créé : { statut: 'paye', montant: 8000 }
💰 Montant artisan (90%): 7200 centimes
📢 Commission plateforme (10%): 800 centimes
✅ Demande marquée comme payée : demandeId=...
```

### 5.4. Vérifications Firestore

**Console Firebase** → **Firestore Database**

1. Collection `paiements_express` → Nouveau document :
   ```json
   {
     "id": "Paiement-ABC123",
     "propositionId": "...",
     "demandeId": "...",
     "clientId": "...",
     "artisanId": "...",
     "montant": 8000,
     "montantArtisan": 7200,
     "commission": 800,
     "statut": "paye",
     "stripePaymentIntentId": "pi_...",
     "createdAt": Timestamp
   }
   ```

2. Collection `demandes_express` → Document modifié :
   ```json
   {
     "statut": "payee"  // ← Changé de 'acceptee' à 'payee'
   }
   ```

### 5.5. Tester la capture de paiement (libération fonds)

#### Scénario : Artisan termine l'intervention

1. Se connecter comme **Artisan**
2. Aller sur `/artisan/interventions-express`
3. Trouver l'intervention payée
4. Cliquer **"Marquer comme terminée"**
5. Backend détecte `statut='terminee'`
6. **Optionnel** : Appel manuel API capture :
   ```bash
   curl -X POST http://localhost:5000/api/v1/stripe-express/capture-payment \
     -H "Content-Type: application/json" \
     -d '{"demandeId": "votre-demande-id"}'
   ```

**Logs backend attendus** :
```
💰 Capture de 7200 centimes (90% de 8000)
✅ Paiement libéré : ch_1234567890
💸 Artisan a reçu 72.00€
🏦 Commission plateforme : 8.00€
```

**Firestore - `paiements_express` mis à jour** :
```json
{
  "statut": "libere",  // ← Changé de 'paye' à 'libere'
  "stripeChargeId": "ch_1234567890",
  "dateLiberationFonds": Timestamp
}
```

### 5.6. Tester le remboursement (annulation)

#### Scénario : Client annule avant intervention

**⚠️ Condition** : Paiement doit être `statut='paye'` (PAS encore `libere`)

```bash
curl -X POST http://localhost:5000/api/v1/stripe-express/refund-payment \
  -H "Content-Type: application/json" \
  -d '{"demandeId": "votre-demande-id"}'
```

**Logs backend attendus** :
```
💸 Remboursement de 8000 centimes
✅ Remboursement effectué : re_1234567890
💳 Client a été remboursé : 80.00€
```

**Firestore - `paiements_express` mis à jour** :
```json
{
  "statut": "rembourse",  // ← Changé à 'rembourse'
  "stripeRefundId": "re_1234567890",
  "dateRemboursement": Timestamp
}
```

---

## 🧾 Cartes de test Stripe

### Cartes de succès
```
Carte normale (succès immédiat):
4242 4242 4242 4242

Visa (succès):
4000 0566 5566 5556

Mastercard (succès):
5555 5555 5555 4444
```

### Cartes d'échec
```
Carte refusée (insufficient_funds):
4000 0000 0000 9995

Carte refusée (generic decline):
4000 0000 0000 0002

Carte expirée:
4000 0000 0000 0069
```

### 3D Secure (authentification forte)
```
3DS requis (authentification réussie):
4000 0027 6000 3184

3DS requis (authentification échouée):
4000 0082 6000 3178
```

**Pour toutes les cartes** :
- **Date expiration** : N'importe quelle date future (ex: 12/25, 05/28)
- **CVC** : N'importe quel 3 chiffres (ex: 123, 456, 789)
- **Code postal** : N'importe quel code (ex: 75001, 12345)

**Documentation complète** : https://stripe.com/docs/testing

---

## 🔍 Débogage

### Logs Stripe Dashboard

1. Dashboard → **Developers** → **Logs**
2. Filtrer par :
   - API calls : Voir toutes les requêtes backend → Stripe
   - Webhooks : Voir tous les événements reçus
   - Errors : Voir les erreurs

### Vérifier signature webhook

**Symptôme** : Erreur 400 "Invalid signature"

**Causes possibles** :
1. `STRIPE_WEBHOOK_SECRET` incorrect dans `.env`
2. Webhook non configuré dans Stripe Dashboard
3. Middleware `express.raw()` manquant (déjà implémenté)

**Solution** :
```bash
# Vérifier le webhook secret
cat backend/.env | grep STRIPE_WEBHOOK_SECRET

# Doit correspondre au secret dans Stripe Dashboard → Webhooks
```

### Test manuel du webhook

**Stripe Dashboard** → **Developers** → **Webhooks** → Votre endpoint → **Send test webhook**

Sélectionner : `payment_intent.succeeded`

Vérifier les logs backend pour confirmation.

### Endpoints de débogage

**Vérifier statut paiement** :
```bash
curl http://localhost:5000/api/v1/stripe-express/payment-status/votre-demande-id
```

**Réponse attendue** :
```json
{
  "demandeId": "...",
  "paiement": {
    "id": "Paiement-ABC123",
    "statut": "paye",
    "montant": 8000,
    "stripePaymentIntentId": "pi_...",
    "createdAt": "..."
  }
}
```

---

## 📊 Dashboard Stripe - Points clés

### Paiements
**Dashboard** → **Payments**

Vous verrez :
- Tous les PaymentIntents créés
- Statut : `succeeded`, `requires_capture`, `canceled`
- Montants
- Customer email (si fourni)

### Metadata
Cliquer sur un paiement → Onglet **Metadata**

Devrait afficher :
```json
{
  "propositionId": "...",
  "demandeId": "...",
  "clientId": "...",
  "artisanId": "...",
  "categorie": "Électricité"
}
```

**Utilité** : Relier paiements Stripe ↔ données Firestore

### Balance
**Dashboard** → **Balance**

Voir :
- Fonds disponibles (après capture)
- Fonds en attente (capture manuelle)
- Historique payouts (virements vers compte bancaire)

---

## 🚀 Passage en production

### ⚠️ Prérequis

1. **KYC Stripe complété** :
   - Dashboard → **Settings** → **Business details**
   - Fournir : SIRET, représentant légal, justificatifs
   - Validation : 24-48h

2. **HTTPS obligatoire** :
   - Frontend : `https://artisansafe.com`
   - Backend : `https://api.artisansafe.com`
   - Certificat SSL valide (Let's Encrypt gratuit)

3. **Webhook production** :
   - URL : `https://api.artisansafe.com/api/v1/stripe-express/webhook`
   - Nouveau signing secret (différent du test)

### Activer mode production

**Dashboard Stripe** → Toggle **"Mode production"** (en haut à droite)

**Récupérer nouvelles clés** :
- Publishable key : `pk_live_51...`
- Secret key : `sk_live_51...`
- Webhook secret : `whsec_...` (nouveau)

**Mettre à jour environnement production** :

Backend :
```bash
# backend/.env (production)
STRIPE_SECRET_KEY=sk_live_51...
STRIPE_WEBHOOK_SECRET=whsec_...NOUVEAU_SECRET_PRODUCTION
```

Frontend :
```bash
# frontend/.env.local (production)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_51...
```

### Tester en production

1. Utiliser une **vraie carte bancaire**
2. Montants minimums : 0.50€ (50 centimes)
3. Vérifier réception email Stripe
4. Vérifier webhook production fonctionne
5. Tester capture + refund avec petits montants

---

## 📚 Documentation supplémentaire

- **Stripe Docs** : https://stripe.com/docs
- **PaymentIntents** : https://stripe.com/docs/payments/payment-intents
- **Webhooks** : https://stripe.com/docs/webhooks
- **Elements** : https://stripe.com/docs/stripe-js
- **Testing** : https://stripe.com/docs/testing

---

## ✅ Checklist finale

- [ ] Compte Stripe TEST créé
- [ ] Mode TEST activé (bannière violette)
- [ ] Clés API récupérées (pk_test_... et sk_test_...)
- [ ] Packages NPM installés (stripe, @stripe/stripe-js, @stripe/react-stripe-js)
- [ ] Variables environnement configurées (.env et .env.local)
- [ ] Webhook créé dans Stripe Dashboard
- [ ] Signing secret récupéré (whsec_...)
- [ ] Backend démarré (port 5000)
- [ ] Frontend démarré (port 3000)
- [ ] ngrok lancé (si webhook local) ou Stripe CLI
- [ ] Test paiement réussi avec 4242 4242 4242 4242
- [ ] Redirection page succès fonctionnelle
- [ ] Webhook reçu dans terminal backend
- [ ] Document paiements_express créé dans Firestore
- [ ] Statut demande passé à 'payee'
- [ ] Test capture (libération fonds) réussi
- [ ] Test refund (remboursement) réussi

---

**🎉 Félicitations !** Votre système de paiement Express avec séquestre est opérationnel.

**Prochaines étapes** :
1. Tests utilisateurs (beta testers)
2. Monitoring erreurs (Sentry)
3. Optimisation UX (animations, feedback)
4. Documentation utilisateur finale
5. Déploiement production

---

*Dernière mise à jour : 2026-01-26*
