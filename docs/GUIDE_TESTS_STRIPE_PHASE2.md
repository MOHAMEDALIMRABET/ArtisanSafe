# 🧪 Guide de Tests Phase 2 - Stripe Paiements

> **Objectif** : Tester le système de paiement complet avec escrow (séquestre) Stripe  
> **Temps estimé** : 2-3 heures  
> **Prérequis** : Compte Stripe configuré en mode test  

---

## 📋 CHECKLIST PRÉALABLE

### 1. Installation dépendances

```bash
# Frontend
cd frontend
npm install @stripe/stripe-js @stripe/react-stripe-js

# Backend (déjà installé)
# Stripe déjà dans package.json
```

### 2. Configuration variables d'environnement

**Frontend** (`frontend/.env.local`) :
```env
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_51...
```

**Backend** (`backend/.env`) :
```env
STRIPE_SECRET_KEY=sk_test_51...
STRIPE_WEBHOOK_SECRET=whsec_...
```

### 3. Vérifier serveurs démarrés

```bash
# Terminal 1 - Backend
cd backend
npm run dev
# Doit afficher : 🚀 Serveur démarré sur http://localhost:5000

# Terminal 2 - Frontend
cd frontend
npm run dev
# Doit afficher : ✓ Ready on http://localhost:3000
```

---

## 🎯 TEST 1 : Paiement Escrow Complet (Scénario nominal)

### Étape 1 : Inscription artisan + Stripe Connect

1. **Créer compte artisan**
   - Aller sur `http://localhost:3000/inscription?role=artisan`
   - Remplir formulaire (email, mot de passe, infos entreprise)
   - Valider email Firebase
   - Upload KBIS (admin validera après)

2. **Configurer paiements Stripe**
   - Se connecter comme artisan
   - Aller sur `http://localhost:3000/artisan/paiements`
   - Cliquer "Créer mon compte de paiement"
   - ✅ **Attendu** : Redirection vers Stripe onboarding
   - Compléter formulaire Stripe (mode test) :
     - Informations bancaires test : **000123456789** (IBAN test)
     - Date naissance : **01/01/1990**
     - Adresse : Adresse test valide
   - Cliquer "Submit" sur Stripe
   - ✅ **Attendu** : Retour sur `/artisan/paiements` avec message "✅ Compte Stripe configuré"

### Étape 2 : Client crée demande + artisan envoie devis

3. **Créer demande client**
   - Se connecter comme client
   - Aller sur `http://localhost:3000/client/nouvelle-demande`
   - Créer demande (ex: plomberie, Paris 75001, urgence fuite)
   - ✅ **Vérifier** : Demande créée avec statut `publiee`

4. **Artisan envoie devis**
   - Se connecter comme artisan
   - Rechercher demande
   - Créer devis (ex: 1000€ TTC)
   - Envoyer devis
   - ✅ **Vérifier** : Notification client "Nouveau devis reçu"

### Étape 3 : Signature électronique

5. **Client signe devis**
   - Se connecter comme client
   - Ouvrir devis reçu
   - Cliquer "Accepter ce devis"
   - Modal signature s'ouvre
   - Dessiner signature dans le canvas
   - Cliquer "Valider la signature"
   - ✅ **Attendu** : 
     - Signature enregistrée
     - Statut devis → `en_attente_paiement`
     - Modal paiement s'ouvre (Stripe Elements)

### Étape 4 : Paiement Stripe (ESCROW)

6. **Client paie avec Stripe**
   - **Carte de test** : `4242 4242 4242 4242`
   - **Date expiration** : `12/34`
   - **CVC** : `123`
   - **Code postal** : `75001`
   - Cliquer "Payer 1000€"
   - ⏳ **Attendre** : Traitement Stripe (2-5 secondes)
   - ✅ **Attendu** :
     - Paiement autorisé (escrow bloqué)
     - Statut devis → `paye`
     - Notification artisan "💰 Devis payé"
     - Contrat créé automatiquement

7. **Vérifier Firestore**
   - Ouvrir Firebase Console → Firestore
   - Collection `devis` → Document du devis
   - ✅ **Vérifier champs** :
     ```json
     {
       "statut": "paye",
       "paiement": {
         "statut": "bloque",
         "stripe": {
           "paymentIntentId": "pi_..."
         }
       }
     }
     ```
   - Collection `contrats` → Document du contrat
   - ✅ **Vérifier champs** :
     ```json
     {
       "statut": "en_attente_debut",
       "paiement": {
         "montantTotal": 1000,
         "commission": 80,
         "montantArtisan": 920,
         "statut": "bloque"
       }
     }
     ```

8. **Vérifier Stripe Dashboard**
   - Aller sur `https://dashboard.stripe.com/test/payments`
   - Trouver PaymentIntent créé
   - ✅ **Vérifier** :
     - Montant : **1000.00 EUR**
     - Statut : **Requires capture**
     - Metadata : `devisId`, `clientId`, `artisanId`

### Étape 5 : Début travaux

9. **Artisan déclare début travaux**
   - Se connecter comme artisan
   - Aller sur `/artisan/contrats`
   - Cliquer sur contrat
   - Cliquer "Déclarer début des travaux"
   - ✅ **Attendu** : Statut contrat → `en_cours`

### Étape 6 : Fin travaux

10. **Artisan déclare fin travaux**
    - Cliquer "Déclarer fin des travaux"
    - Ajouter commentaire (optionnel)
    - ✅ **Attendu** : 
      - Statut contrat → `travaux_termines`
      - Timer 48h démarre pour validation client

### Étape 7 : Validation client + Libération escrow

11. **Client valide travaux**
    - Se connecter comme client
    - Aller sur `/client/contrats`
    - Cliquer sur contrat
    - Cliquer "Valider les travaux"
    - Ajouter note/commentaire
    - ✅ **Attendu** :
      - Appel API `/release-escrow`
      - Paiement Stripe capturé
      - Transfert Stripe Connect vers artisan
      - Statut contrat → `termine_valide`
      - Notification artisan "💸 Paiement reçu"

12. **Vérifier transfert Stripe**
    - Dashboard Stripe : `https://dashboard.stripe.com/test/transfers`
    - ✅ **Vérifier** :
      - Montant transféré : **920.00 EUR** (92% de 1000€)
      - Destination : Compte Stripe Connect artisan
      - Statut : **Paid**
      - Metadata : `contratId`, `artisanId`

13. **Vérifier commission plateforme**
    - Dashboard Stripe : `https://dashboard.stripe.com/test/balance/overview`
    - ✅ **Vérifier** :
      - Balance augmentée de **80.00 EUR** (8% commission)
      - Moins frais Stripe (~14€) = **66€ net**

---

## 🧪 TEST 2 : Auto-validation 48h (Cloud Function)

### Scénario

Client ne valide PAS les travaux pendant 48h → Validation automatique

### Étapes

1. Suivre **TEST 1** jusqu'à l'étape 10 (fin travaux déclarée)
2. **Attendre 48h** (ou modifier Cloud Function pour 2 minutes en test)
3. Cloud Function `autoValiderTravaux` s'exécute
4. ✅ **Attendu** :
   - Statut contrat → `termine_auto_valide`
   - Paiement capturé automatiquement
   - Transfert artisan effectué

### Test accéléré (option)

**Modifier Cloud Function** (`functions/src/index.ts`) :
```typescript
// Change 48h → 2 minutes pour test
const delaiValidation = 2 * 60 * 1000; // 2 minutes au lieu de 48h
```

---

## 🔴 TEST 3 : Échec Paiement (Carte refusée)

### Cartes de test Stripe

| Carte | Résultat |
|-------|----------|
| `4242 4242 4242 4242` | ✅ Succès |
| `4000 0000 0000 0002` | ❌ Carte refusée |
| `4000 0000 0000 9995` | ❌ Fonds insuffisants |
| `4000 0025 0000 3155` | 🔐 Authentification 3DS requise |

### Étapes

1. Suivre **TEST 1** jusqu'à l'étape 6 (modal paiement)
2. Utiliser carte **`4000 0000 0000 0002`** (refusée)
3. Cliquer "Payer"
4. ✅ **Attendu** :
   - Message erreur : "Your card was declined"
   - Statut devis reste `en_attente_paiement`
   - Notification client "❌ Paiement échoué"
   - Possibilité de réessayer avec autre carte

---

## 🔙 TEST 4 : Annulation / Remboursement

### Scénario A : Client annule avant fin travaux

1. Client paie devis (escrow bloqué)
2. Artisan déclare début travaux
3. Client signale problème → Litige
4. Admin décide remboursement complet
5. API `/refund-escrow` appelée
6. ✅ **Attendu** :
   - PaymentIntent annulé (argent jamais capturé)
   - Statut contrat → `annule_rembourse`
   - Client remboursé intégralement

### Scénario B : Remboursement partiel après travaux

1. Client valide travaux (paiement capturé)
2. Client signale défaut mineur
3. Admin décide remboursement 50%
4. API `/refund-escrow` avec `montantRembourse: 500`
5. ✅ **Attendu** :
   - Refund Stripe créé : **500.00 EUR**
   - Artisan garde **420€** (840€ - 420€)
   - Client remboursé **500€**

---

## 🔐 TEST 5 : Webhooks Stripe

### Configuration webhook local (Stripe CLI)

```bash
# Installer Stripe CLI : https://stripe.com/docs/stripe-cli
stripe login

# Écouter webhooks et forwarding vers backend local
stripe listen --forward-to localhost:5000/api/v1/webhooks/stripe
```

### Vérifier événements reçus

1. Effectuer paiement test (TEST 1)
2. Console Stripe CLI doit afficher :
   ```
   --> payment_intent.amount_capturable_updated [evt_...]
   <-- [200] POST http://localhost:5000/api/v1/webhooks/stripe
   
   --> charge.captured [evt_...]
   <-- [200] POST http://localhost:5000/api/v1/webhooks/stripe
   
   --> transfer.created [evt_...]
   <-- [200] POST http://localhost:5000/api/v1/webhooks/stripe
   ```

3. Vérifier logs backend :
   ```
   📨 Webhook reçu: payment_intent.amount_capturable_updated
   ✅ Paiement autorisé (webhook): pi_... - Devis: ...
   ✅ Devis ... mis à jour: statut=paye
   ```

### Tester sécurité webhook

4. Envoyer webhook SANS signature (curl) :
   ```bash
   curl -X POST http://localhost:5000/api/v1/webhooks/stripe \
     -H "Content-Type: application/json" \
     -d '{"type":"payment_intent.succeeded"}'
   ```
   
   ✅ **Attendu** : Réponse **400** "Signature manquante"

5. Envoyer webhook avec MAUVAISE signature :
   ```bash
   curl -X POST http://localhost:5000/api/v1/webhooks/stripe \
     -H "Content-Type: application/json" \
     -H "stripe-signature: t=123,v1=fake" \
     -d '{"type":"payment_intent.succeeded"}'
   ```
   
   ✅ **Attendu** : Réponse **400** "Webhook signature invalide"

---

## 📊 TEST 6 : Vérification Commission 8%

### Calcul complet

**Client paie** : 1000€ TTC

```
Montant total :        1000.00€
Commission plateforme: -  80.00€  (8%)
Montant artisan :      = 920.00€  (92%)
```

**Frais Stripe** :
```
Frais carte EU :       -  14.25€  (1.4% + 0.25€)
Revenu net plateforme: =  65.75€  (80€ - 14.25€)
```

### Vérifications

1. **Firestore contrat** :
   ```json
   {
     "paiement": {
       "montantTotal": 1000,
       "commission": 80,
       "montantArtisan": 920
     }
   }
   ```

2. **Stripe Transfer** :
   - Montant : **920.00 EUR**

3. **Stripe Balance** :
   - Commission perçue : **80.00 EUR**
   - Frais Stripe : **~14.25 EUR**
   - Net : **~65.75 EUR**

---

## 🛠️ DEBUGGING

### Problèmes fréquents

#### 1. "Stripe is not defined"
**Cause** : Dépendances non installées  
**Solution** :
```bash
cd frontend
npm install @stripe/stripe-js @stripe/react-stripe-js
```

#### 2. "Invalid API Key"
**Cause** : Variable environnement incorrecte  
**Solution** : Vérifier `.env.local` et redémarrer serveur

#### 3. "Artisan n'a pas configuré son compte"
**Cause** : Onboarding Stripe Connect non terminé  
**Solution** : Artisan doit compléter `/artisan/paiements`

#### 4. "Webhook signature invalide"
**Cause** : `STRIPE_WEBHOOK_SECRET` incorrect  
**Solution** : Copier le bon secret depuis Stripe Dashboard

#### 5. Paiement bloqué à "requires_capture"
**Cause** : Normal ! C'est l'escrow  
**Action** : Valider travaux pour déclencher capture

---

## ✅ CHECKLIST FINALE

Cocher si testé avec succès :

- [ ] **Installation** : Dépendances npm installées
- [ ] **Config** : Variables Stripe configurées
- [ ] **Onboarding** : Artisan Stripe Connect activé
- [ ] **Signature** : Signature électronique fonctionne
- [ ] **Paiement** : Carte test acceptée (escrow bloqué)
- [ ] **Contrat** : Contrat créé automatiquement
- [ ] **Notifications** : Artisan notifié du paiement
- [ ] **Libération** : Validation capture + transfert
- [ ] **Commission** : 8% calculé correctement (920€ artisan)
- [ ] **Webhooks** : Événements Stripe reçus
- [ ] **Sécurité** : Signature webhook validée
- [ ] **Échec** : Carte refusée gérée
- [ ] **Remboursement** : Refund fonctionne
- [ ] **Dashboard** : Stripe Dashboard affiche transactions

---

## 📈 PROCHAINES ÉTAPES

Après validation tests :

1. **Activer mode production Stripe**
   - Compléter KYC entreprise
   - Copier clés `pk_live_` et `sk_live_`
   - Mettre à jour `.env` production

2. **Configurer webhook production**
   - URL : `https://artisandispo.com/api/v1/webhooks/stripe`
   - Événements : Même liste que test
   - Copier `whsec_` production

3. **Déployer**
   - Frontend : Vercel/Netlify
   - Backend : Railway/Render/Heroku
   - Cloud Functions : Firebase

4. **Tester en production**
   - Petit montant réel (1€)
   - Vérifier transfert artisan
   - Vérifier webhooks

---

**🎉 Félicitations ! Le système de paiement Phase 2 est fonctionnel.**
