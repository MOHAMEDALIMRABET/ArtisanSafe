# 🚀 Implémentation Travaux Express - Réalisée ✅

**Date**: 28 janvier 2025  
**Auteur**: GitHub Copilot  
**Statut**: Frontend complet (7/8 étapes), Backend Stripe à implémenter

---

## 📋 Résumé

Le système de **Travaux Express** permet aux clients de demander des interventions rapides (≤150€) sans passer par le processus complet de devis PDF. L'artisan propose directement un prix, le client paie via Stripe (escrow), et l'intervention est réalisée rapidement.

**Différence clé avec Standard**:
- ❌ Pas de PDF devis formel
- ✅ Proposition de prix simple et rapide
- ✅ Paiement séquestre (libéré après intervention)
- ✅ Budget maximum 150€
- ✅ Expiration automatique (48h demandes, 24h propositions)

---

## ✅ Étapes réalisées (7/8)

### **Étape 1 : Types TypeScript** ✅
**Fichier**: `frontend/src/types/firestore.ts`  
**Ajouté**: 160 lignes

**Types créés**:
```typescript
// Statuts
export type DemandeExpressStatut = 
  'en_attente_proposition' | 'proposition_recue' | 'acceptee' | 
  'payee' | 'en_cours' | 'terminee' | 'annulee' | 'expiree';

export type PropositionExpressStatut = 
  'en_attente_acceptation' | 'acceptee' | 'refusee' | 'expiree';

export type PaiementExpressStatut = 
  'en_attente' | 'paye' | 'libere' | 'rembourse' | 'echoue';

// Interfaces
export interface DemandeExpress {
  id: string;
  typeProjet: 'express';
  clientId: string;
  artisanId?: string; // Si demande directe
  categorie: string;
  sousCategorie?: string;
  description: string;
  photos?: string[];
  budgetPropose?: number; // Max 150€
  ville: string;
  codePostal: string;
  adresse?: string;
  coordonneesGPS?: { latitude: number; longitude: number };
  date: string;
  urgence: 'normal' | 'rapide' | 'urgent';
  statut: DemandeExpressStatut;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  expiresAt?: Timestamp; // Auto-expiration 48h
}

export interface PropositionExpress {
  id: string;
  demandeId: string;
  artisanId: string;
  clientId: string;
  montantPropose: number; // Max 150€
  description: string;
  delaiIntervention?: string;
  dateInterventionProposee?: Timestamp;
  statut: PropositionExpressStatut;
  createdAt: Timestamp;
  acceptedAt?: Timestamp;
  refusedAt?: Timestamp;
  motifRefus?: string;
}

export interface PaiementExpress {
  id: string;
  demandeId: string;
  propositionId: string;
  clientId: string;
  artisanId: string;
  stripePaymentIntentId: string;
  stripeChargeId?: string;
  montant: number;
  commission: number; // 10%
  montantArtisan: number; // montant - commission
  statut: PaiementExpressStatut;
  createdAt: Timestamp;
  paidAt?: Timestamp;
  releasedAt?: Timestamp; // Libération séquestre
  refundedAt?: Timestamp;
}
```

---

### **Étape 2 : Service Firestore** ✅
**Fichier**: `frontend/src/lib/firebase/demande-express-service.ts`  
**Lignes**: 456 lignes

**Fonctions créées** (15 au total):

1. **createDemandeExpress()** - Création demande
   - Valide budget ≤150€
   - Auto-expiration +48h
   - Notifie artisan si demande directe

2. **getDemandeExpressById()** - Récupération unique

3. **getDemandesExpressByClient()** - Liste client

4. **getDemandesExpressByArtisan()** - Liste artisan

5. **createPropositionExpress()** - Proposition artisan
   - Valide ≤150€
   - Met à jour statut demande → `proposition_recue`
   - Notifie client

6. **getPropositionExpressById()** - Récupération proposition

7. **getPropositionsByDemande()** - Toutes propositions d'une demande

8. **acceptPropositionExpress()** - Acceptation client
   - Double update (proposition + demande)
   - Notifie artisan

9. **refusePropositionExpress()** - Refus client
   - Enregistre motifRefus
   - Réinitialise demande → `en_attente_proposition`
   - Notifie artisan

10. **markDemandePaid()** - Post-paiement Stripe
    - Appelé par webhook
    - Statut → `payee`
    - Notifie artisan "vous pouvez intervenir"

11. **markInterventionEnCours()** - Début intervention

12. **markInterventionTerminee()** - Fin intervention
    - Notifie client pour avis
    - Trigger backend pour libérer paiement

13. **cancelDemandeExpress()** - Annulation
    - Vérification autorisation
    - Empêche si payée/en_cours/terminée

---

### **Étape 3 : Page Création Demande** ✅
**Fichier**: `frontend/src/app/demande/express/nouvelle/page.tsx`  
**Lignes**: 487 lignes

**Fonctionnalités**:
- Pré-remplissage depuis URL params (artisanId, categorie, sousCategorie, ville, codePostal)
- Sélecteurs categorie/sous-categorie (6 catégories)
- Description (textarea obligatoire)
- Budget optionnel (max 150€)
- Ville + Code postal
- Date souhaitée (min=today)
- Urgence (normal/rapide/urgent)
- Validation auth (client seulement)
- **Geocoding API Gouv** pour coordonnées GPS
- Redirection après création → `/client/demandes-express/${demandeId}`

---

### **Étape 4A : Liste Demandes Artisan** ✅
**Fichier**: `frontend/src/app/artisan/demandes-express/page.tsx`  
**Lignes**: 300+ lignes

**Fonctionnalités**:
- Liste toutes demandes reçues
- Filtrage par statut (badges couleur)
- Affichage: catégorie, ville, date, budget client, urgence
- Liens vers détails
- Compteur demandes reçues

---

### **Étape 4B : Détail & Proposition Artisan** ✅
**Fichier**: `frontend/src/app/artisan/demandes-express/[id]/page.tsx`  
**Lignes**: 450+ lignes

**Fonctionnalités**:
- Affichage complet demande
- Info client
- **Formulaire proposition**:
  - Montant proposé (max 150€)
  - Description prestation
  - Délai intervention (optionnel)
  - Validation budget
- Affichage proposition envoyée (si déjà faite)
- Statuts proposition: en_attente/acceptée/refusée
- **Actions intervention**:
  - Bouton "Marquer comme démarrée" (si statut=payee)
  - Bouton "Marquer comme terminée" (si statut=en_cours)

---

### **Étape 5 : Page Client Détail & Acceptation** ✅
**Fichier**: `frontend/src/app/client/demandes-express/[id]/page.tsx`  
**Lignes**: 450+ lignes

**Fonctionnalités**:
- Affichage demande complète
- Statut dynamique avec badges
- **Si proposition reçue**:
  - Affichage montant/description/délai
  - Bouton "Accepter et payer"
  - Bouton "Refuser" → Modale avec motif
- **Modale refus**:
  - Textarea motif obligatoire
  - Notification artisan automatique
- Navigation statuts:
  - en_attente_proposition → Message attente
  - proposition_recue → Accepter/Refuser
  - acceptee → "Procéder au paiement"
  - payee → "Artisan va intervenir"
  - en_cours → "Intervention en cours"
  - terminee → "Laisser un avis"
- Bouton annuler (si statut ≤ proposition_recue)

---

### **Étape 6 : Page Paiement Stripe (Interface)** ✅
**Fichier**: `frontend/src/app/client/paiement-express/[id]/page.tsx`  
**Lignes**: 330+ lignes

**Fonctionnalités**:
- Récapitulatif complet:
  - Prestation
  - Artisan
  - Description détaillée
  - Délai
  - Montant
  - Commission (10%)
  - Montant artisan (90%)
- Explications séquestre (escrow)
- **TODO**: Intégration Stripe Elements
- **Temporaire**: Message "intégration en cours" + mode test
- Garanties affichées (sécurité, protection, médiation)

---

### **Étape 7 : Mise à jour Recherche** ✅
**Fichier**: `frontend/src/app/petits-travaux-express/recherche/page.tsx`  
**Modifié**: 2 endroits

**Changements**:
1. **Texte bouton**: "📝 Demander un devis" → "⚡ Demander une intervention"
2. **Fonction handleDemanderDevis()**:
   - AVANT: `router.push('/demande/nouvelle?...')`
   - APRÈS: `router.push('/demande/express/nouvelle?artisanId=...&categorie=...&ville=...&codePostal=...')`
3. **Pré-remplissage amélioré**: Ajout ville + code postal dans params

---

## 🔲 Étape 8 : Backend Stripe (À FAIRE)

### **Fichier à créer**: `backend/src/routes/stripe-express.ts`

**Endpoints nécessaires**:

```typescript
// 1. Créer PaymentIntent
POST /api/v1/stripe-express/create-payment-intent
Body: { propositionId: string }
Response: { clientSecret: string, paymentIntentId: string }

// 2. Webhook Stripe
POST /api/v1/stripe-express/webhook
Headers: { stripe-signature: string }
Body: Stripe Event
Actions:
  - payment_intent.succeeded → markDemandePaid()
  - charge.refunded → Update paiement statut

// 3. Capture paiement (libérer séquestre)
POST /api/v1/stripe-express/capture-payment
Body: { demandeId: string }
Condition: statut = 'terminee'
Actions:
  - Stripe capture payment
  - Update paiement → 'libere'

// 4. Remboursement (litige)
POST /api/v1/stripe-express/refund-payment
Body: { demandeId: string, reason: string }
Actions:
  - Stripe refund
  - Update paiement → 'rembourse'
```

**Configuration Stripe**:
```typescript
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// PaymentIntent avec séquestre
const paymentIntent = await stripe.paymentIntents.create({
  amount: montant * 100, // Centimes
  currency: 'eur',
  capture_method: 'manual', // ← CRITIQUE pour escrow
  metadata: {
    propositionId,
    demandeId,
    clientId,
    artisanId,
  },
});

// Capture après intervention terminée
await stripe.paymentIntents.capture(paymentIntentId, {
  amount_to_capture: montantArtisan * 100, // 90% (moins commission)
});
```

**Webhook signature vérification**:
```typescript
const sig = req.headers['stripe-signature'];
const event = stripe.webhooks.constructEvent(
  req.body,
  sig,
  process.env.STRIPE_WEBHOOK_SECRET
);
```

---

## 🔒 Firestore Rules à ajouter

**Fichier**: `firestore.rules`

```javascript
// Collection: demandes_express
match /demandes_express/{demandeId} {
  allow read: if isAuthenticated();
  
  allow create: if isClient() && 
                   request.resource.data.typeProjet == 'express' &&
                   request.resource.data.clientId == request.auth.uid &&
                   (!request.resource.data.keys().hasAny(['budgetPropose']) || 
                    request.resource.data.budgetPropose <= 150);
  
  allow update: if isOwner(resource.data.clientId) || 
                   isOwner(resource.data.artisanId);
  
  allow delete: if isOwner(resource.data.clientId) &&
                   resource.data.statut in ['en_attente_proposition', 'proposition_recue'];
}

// Collection: propositions_express
match /propositions_express/{propositionId} {
  allow read: if isAuthenticated();
  
  allow create: if isArtisan() &&
                   request.resource.data.artisanId == request.auth.uid &&
                   request.resource.data.montantPropose <= 150;
  
  allow update: if isOwner(resource.data.clientId) || 
                   isOwner(resource.data.artisanId);
  
  allow delete: if false; // Pas de suppression
}

// Collection: paiements_express
match /paiements_express/{paiementId} {
  allow read: if isOwner(resource.data.clientId) || 
                 isOwner(resource.data.artisanId);
  
  allow create: if false; // Seul backend crée
  allow update: if false; // Seul backend met à jour
  allow delete: if false;
}

// Helpers
function isAuthenticated() {
  return request.auth != null;
}

function isClient() {
  return isAuthenticated() && 
         get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'client';
}

function isArtisan() {
  return isAuthenticated() && 
         get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'artisan';
}

function isOwner(userId) {
  return isAuthenticated() && request.auth.uid == userId;
}
```

---

## 🧪 Plan de tests recommandé

### **Test 1 : Création demande express (Client)**
1. Chercher artisan sur `/petits-travaux-express/recherche`
2. Cliquer "⚡ Demander une intervention"
3. Vérifier pré-remplissage (artisanId, categorie, ville, codePostal)
4. Remplir description + budget optionnel (≤150€)
5. Soumettre
6. **Attendu**: Redirection `/client/demandes-express/{demandeId}`
7. **Vérifier Firestore**: Document créé avec expiresAt (+48h)

### **Test 2 : Proposition artisan**
1. Artisan → `/artisan/demandes-express`
2. Cliquer sur demande
3. Remplir proposition (montant ≤150€, description)
4. Soumettre
5. **Attendu**: Notification client + demande.statut='proposition_recue'
6. **Vérifier**: Proposition visible côté client

### **Test 3 : Acceptation + Paiement client**
1. Client → `/client/demandes-express/{demandeId}`
2. Voir proposition affichée
3. Cliquer "Accepter et payer"
4. **Attendu**: Redirection `/client/paiement-express/{propositionId}`
5. Affichage récapitulatif correct (montant, commission, artisan)
6. Cliquer "Payer" (mode test)
7. **TODO Backend**: Intégrer Stripe réel

### **Test 4 : Workflow intervention complète**
1. Client accepte + paie (statut='payee')
2. Artisan → "Marquer comme démarrée" (statut='en_cours')
3. Artisan → "Marquer comme terminée" (statut='terminee')
4. **TODO Backend**: Capture Stripe payment
5. Client reçoit notification "Laisser un avis"

### **Test 5 : Refus proposition**
1. Client → "Refuser"
2. Modale motif → Remplir texte
3. Confirmer
4. **Attendu**: 
   - proposition.statut='refusee'
   - demande.statut='en_attente_proposition'
   - Notification artisan avec motif

### **Test 6 : Annulation demande**
1. Client crée demande
2. Avant proposition → Cliquer "Annuler"
3. **Attendu**: demande.statut='annulee'
4. **Vérifier**: Impossible si statut ≥ payee

### **Test 7 : Validation budget 150€**
1. Tenter créer demande avec budget > 150€
2. **Attendu**: Erreur frontend "Maximum 150€"
3. Tenter proposition artisan > 150€
4. **Attendu**: Erreur service layer
5. **TODO**: Tester avec Firestore rules (doit bloquer aussi)

---

## 📊 Collections Firestore créées

**Structure attendue**:

```
demandes_express/
└── {demandeId}
    ├── typeProjet: "express"
    ├── clientId: "uid_client"
    ├── artisanId?: "uid_artisan" (si direct)
    ├── categorie: "plomberie"
    ├── sousCategorie: "Débouchage WC"
    ├── description: "..."
    ├── budgetPropose?: 120
    ├── ville: "Paris"
    ├── codePostal: "75001"
    ├── coordonneesGPS: { latitude: 48.8, longitude: 2.3 }
    ├── date: "2025-02-01"
    ├── urgence: "rapide"
    ├── statut: "proposition_recue"
    ├── createdAt: Timestamp
    ├── updatedAt: Timestamp
    └── expiresAt: Timestamp (+48h)

propositions_express/
└── {propositionId}
    ├── demandeId: "xxx"
    ├── artisanId: "uid_artisan"
    ├── clientId: "uid_client"
    ├── montantPropose: 130
    ├── description: "Débouchage + produit + déplacement"
    ├── delaiIntervention: "Intervention sous 48h"
    ├── statut: "en_attente_acceptation"
    ├── createdAt: Timestamp
    └── acceptedAt?: Timestamp

paiements_express/
└── {paiementId}
    ├── demandeId: "xxx"
    ├── propositionId: "xxx"
    ├── clientId: "uid_client"
    ├── artisanId: "uid_artisan"
    ├── stripePaymentIntentId: "pi_..."
    ├── montant: 130
    ├── commission: 13 (10%)
    ├── montantArtisan: 117
    ├── statut: "paye"
    ├── createdAt: Timestamp
    ├── paidAt: Timestamp
    ├── releasedAt?: Timestamp (après terminee)
    └── refundedAt?: Timestamp (si litige)
```

---

## 🔄 Flux complet workflow

```
1. CLIENT cherche artisan
   └─> Recherche par categorie + ville
   
2. CLIENT clique "⚡ Demander une intervention"
   └─> Formulaire pré-rempli
   
3. CLIENT soumet demande
   └─> Collection: demandes_express (statut='en_attente_proposition')
   └─> expiresAt = +48h
   └─> Si artisanId fourni: notification artisan
   
4. ARTISAN voit demande
   └─> Liste: /artisan/demandes-express
   └─> Détail: /artisan/demandes-express/{id}
   
5. ARTISAN fait proposition
   └─> Collection: propositions_express (statut='en_attente_acceptation')
   └─> Update demandes_express.statut = 'proposition_recue'
   └─> Notification CLIENT
   
6. CLIENT accepte proposition
   └─> Update propositions_express.statut = 'acceptee'
   └─> Update demandes_express.statut = 'acceptee'
   └─> Notification ARTISAN
   └─> Redirect: /client/paiement-express/{propositionId}
   
7. CLIENT paie (Stripe escrow)
   └─> Backend: Create PaymentIntent (capture_method='manual')
   └─> Stripe webhook: payment_intent.succeeded
   └─> markDemandePaid() → statut = 'payee'
   └─> Collection: paiements_express (statut='paye')
   └─> Notification ARTISAN: "Vous pouvez intervenir"
   
8. ARTISAN marque "Intervention démarrée"
   └─> Update demandes_express.statut = 'en_cours'
   
9. ARTISAN marque "Intervention terminée"
   └─> Update demandes_express.statut = 'terminee'
   └─> Notification CLIENT: "Laisser un avis"
   └─> Backend: Capture Stripe payment (montantArtisan = 90%)
   └─> Update paiements_express.statut = 'libere'
   
10. CLIENT laisse avis (optionnel)
    └─> Collection: avis
```

**Cas alternatifs**:
- **CLIENT refuse proposition** → propositions_express.statut='refusee', demandes_express.statut='en_attente_proposition'
- **Expiration 48h** → demandes_express.statut='expiree' (TODO: Cloud Function)
- **Litige** → Stripe refund, paiements_express.statut='rembourse'

---

## 📝 TODO Backend Phase 2

### **Priorités**:

1. **Routes Stripe** (CRITIQUE)
   - `POST /stripe-express/create-payment-intent`
   - `POST /stripe-express/webhook`
   - `POST /stripe-express/capture-payment`
   - `POST /stripe-express/refund-payment`

2. **Cloud Functions** (IMPORTANT)
   - Expiration auto demandes (48h)
   - Expiration auto propositions (24h)
   - Capture paiement auto après intervention terminée

3. **Firestore Rules** (SÉCURITÉ)
   - Validation budget ≤150€ côté serveur
   - Protection modifications statuts
   - Vérification rôles (client/artisan)

4. **Tests E2E** (QUALITÉ)
   - Cypress/Playwright
   - Workflow complet client→artisan→paiement
   - Edge cases (refus, annulation, expiration)

---

## 🎨 Design Notes

**Couleurs utilisées** (Respect charte ArtisanSafe):
- Primary: `bg-[#FF6B00]` (Orange boutons CTA)
- Secondary: `bg-[#2C3E50]` (Headers)
- Success: `bg-green-100` (payée, terminée)
- Warning: `bg-yellow-100` (en attente)
- Info: `bg-blue-100` (proposition reçue)
- Danger: `bg-red-100` (annulée, urgent)
- Purple: `bg-purple-100` (en cours)

**Icons**:
- ⚡ Express/Intervention
- 💬 Proposition
- 💳 Paiement
- 🚀 Démarrer
- ✅ Terminée/Acceptée
- ❌ Refusée/Annulée
- ⏳ En attente

---

## 🐛 Bugs connus / Limitations

1. **Pas d'intégration Stripe réelle**
   - Page paiement affiche message "en cours de développement"
   - Mode test manuel disponible
   
2. **Pas d'expiration automatique**
   - Demandes/propositions ne s'auto-expirent pas
   - Nécessite Cloud Function cron job
   
3. **Une seule proposition par demande**
   - Architecture actuelle: 1 demande = 1 proposition max
   - Si besoin de plusieurs: modifier `createPropositionExpress()`
   
4. **Notifications pas en temps réel**
   - Rafraîchissement manuel nécessaire
   - Solution: useEffect + onSnapshot Firestore
   
5. **Pas de gestion litiges**
   - Pas d'interface pour demander remboursement
   - Pas de modération admin

---

## 📚 Documentation complémentaire

**Fichiers à consulter**:
- `docs/WORKFLOW_TRAVAUX_EXPRESS.md` (ce fichier)
- `frontend/src/types/firestore.ts` (types complets)
- `frontend/src/lib/firebase/demande-express-service.ts` (logique métier)
- `.github/copilot-instructions.md` (architecture globale)

**Ressources externes**:
- [Stripe Escrow Documentation](https://stripe.com/docs/payments/capture-later)
- [Firestore Security Rules](https://firebase.google.com/docs/firestore/security/rules-structure)
- [Next.js App Router](https://nextjs.org/docs/app)

---

## ✅ Checklist Déploiement

Avant de pousser en production :

- [ ] Tester workflow complet en local
- [ ] Implémenter Stripe backend
- [ ] Ajouter Firestore rules
- [ ] Créer Cloud Functions expiration
- [ ] Tests E2E Cypress
- [ ] Vérifier notifications fonctionnelles
- [ ] Documentation utilisateur (FAQ)
- [ ] Formation équipe support client
- [ ] Monitoring erreurs (Sentry?)
- [ ] Analytics tracking (GA4?)

---

**🎉 Félicitations ! Le système Express est prêt à être testé et intégré avec Stripe.**
