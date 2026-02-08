# 🚀 Implémentation Système Escrow (Séquestre) - Partie 1

**Date** : 1er février 2026  
**Objectif** : Implémenter un système de paiement sécurisé avec escrow (séquestre) inspiré de BlaBlaCar/Malt  
**Statut** : ✅ Infrastructure complétée (4/11 tâches)

---

## 📋 Vue d'ensemble

Le système escrow permet de **bloquer l'argent du client** jusqu'à ce que les travaux soient **terminés et validés** par les deux parties. Cela protège à la fois le client (travaux non conformes) et l'artisan (paiement garanti).

### Workflow complet

```
1. Client signe le devis électroniquement
   ↓
2. Client paie avec Stripe (capture_method: manual)
   → Argent BLOQUÉ (pas encore capturé)
   → Création contrat (statut: en_attente_debut)
   ↓
3. Artisan déclare "Début travaux"
   → statut: en_cours
   ↓
4. Artisan déclare "Fin travaux"
   → statut: travaux_termines
   → Délai 48h pour validation client
   ↓
5a. CLIENT VALIDE (< 48h)
    → API /release-escrow capture le paiement
    → statut: termine_valide
    → Argent LIBÉRÉ à l'artisan (- 8% commission)
    ↓
5b. AUTO-VALIDATION (> 48h sans action)
    → Cloud Function autoValiderTravaux s'exécute
    → statut: termine_auto_valide
    → Argent LIBÉRÉ automatiquement
    ↓
5c. CLIENT SIGNALE LITIGE
    → statut: litige
    → Argent BLOQUÉ jusqu'à médiation admin
    → Remboursement partiel/total selon décision

FIN: Contrat terminé, paiement traité
```

---

## ✅ Réalisations (Session actuelle)

### 1. Types TypeScript (Contrat + Escrow)

**Fichier créé** : `frontend/src/types/contrat.ts` (~200 lignes)

**Types principaux** :
- `ContratStatut` : 7 statuts possibles (en_attente_debut → termine_valide/auto_valide)
- `Contrat` : Structure complète avec paiement escrow
- `ValidationTravaux` : Détails validation client
- `Litige` : Gestion litiges avec preuves
- `CreateContratData`, `ValiderTravauxData`, `SignalerLitigeData` : Types helper

**Exemple statut Contrat** :
```typescript
export type ContratStatut = 
  | 'en_attente_debut'      // Paiement bloqué, travaux pas commencés
  | 'en_cours'              // Travaux en cours, paiement toujours bloqué
  | 'travaux_termines'      // Artisan a fini, attente validation client (48h max)
  | 'termine_valide'        // Client a validé, argent libéré à artisan
  | 'termine_auto_valide'   // Auto-validé après 48h, argent libéré
  | 'litige'                // Problème signalé, paiement gelé, médiation admin
  | 'annule_rembourse';     // Annulé, client remboursé
```

**Fichier modifié** : `frontend/src/types/devis.ts`

**Changements** :
- `DevisStatut` : Ajout de `'paye'` avec mention escrow
- `paiement.statut` : Nouveaux statuts `'bloque' | 'libere' | 'rembourse'`
- `paiement.stripe` : Nouveaux champs `paymentIntentId`, `chargeId`, `captureDate`
- `paiement.contratId` : Référence au contrat créé après paiement

---

### 2. API Backend Stripe Escrow

**Fichier créé** : `backend/src/routes/payments.routes.ts` (~360 lignes)

**3 endpoints créés** :

#### A. POST `/api/v1/payments/create-escrow`
**Rôle** : Créer un paiement escrow (argent bloqué)

**Params** :
- `devisId`, `clientId`, `artisanId`, `montantTTC`
- `metadata` (numéro devis, description)

**Stripe API** :
```typescript
const paymentIntent = await stripe.paymentIntents.create({
  amount: Math.round(montantTTC * 100),
  currency: 'eur',
  capture_method: 'manual', // ← ESCROW activé
  automatic_payment_methods: { enabled: true },
  metadata: { devisId, clientId, artisanId, ... }
});
```

**Retour** :
- `clientSecret` : Pour confirmer paiement côté frontend
- `paymentIntentId` : ID du paiement bloqué
- `statut: 'bloque'`

**Vérifications** :
- Devis existe et est en statut `'en_attente_paiement'`
- Montant > 0

---

#### B. POST `/api/v1/payments/release-escrow`
**Rôle** : Libérer l'argent bloqué et le transférer à l'artisan

**Params** :
- `contratId`
- `validePar` : `'client' | 'auto' | 'admin'`
- `commentaire` (optionnel)

**Stripe API** :
```typescript
const paymentIntent = await stripe.paymentIntents.capture(paymentIntentId);
```

**Calculs** :
```typescript
const commission = montantTotal * 0.08; // 8%
const montantArtisan = montantTotal - commission;
```

**Retour** :
- `chargeId` : ID du paiement capturé
- `montantTotal`, `commission`, `montantArtisan`
- `statut: 'libere'`

**Vérifications** :
- Contrat existe et est en statut `'travaux_termines'` ou `'en_cours'`
- Paiement est en statut `'bloque'`

**TODO Phase 2** :
```typescript
// Transférer montantArtisan via Stripe Connect
const transfer = await stripe.transfers.create({
  amount: Math.round(montantArtisan * 100),
  currency: 'eur',
  destination: artisanStripeAccountId, // ← À implémenter
  metadata: { contratId, devisId }
});
```

---

#### C. POST `/api/v1/payments/refund-escrow`
**Rôle** : Annuler le paiement et rembourser le client

**Params** :
- `contratId`
- `motif` : Raison du remboursement
- `montantRembourse` (optionnel, par défaut = total)

**Stripe API** :
```typescript
// Si paiement BLOQUÉ (pas encore capturé)
await stripe.paymentIntents.cancel(paymentIntentId);

// Si paiement LIBÉRÉ (déjà capturé)
const refund = await stripe.refunds.create({
  payment_intent: paymentIntentId,
  amount: Math.round(montantRembourse * 100),
  reason: 'requested_by_customer'
});
```

**Retour** :
- `refundId` : ID du remboursement
- `montantRembourse`
- `statut: 'rembourse'`

**Vérifications** :
- Paiement est en statut `'bloque'` ou `'libere'`

---

### 3. Service Firestore Contrats

**Fichier modifié** : `frontend/src/lib/firebase/contrat-service.ts` (réécriture complète)

**10 fonctions créées** :

#### A. `createContrat(data: CreateContratData): Promise<Contrat>`
**Rôle** : Créer contrat après paiement escrow validé

**Logique** :
```typescript
const contratData = {
  devisId, clientId, artisanId,
  statut: 'en_attente_debut',
  dateCreation: Timestamp.now(),
  paiement: {
    montantTotal,
    commission: montantTotal * 0.08,
    montantArtisan: montantTotal * 0.92,
    stripe: { paymentIntentId },
    statut: 'bloque',
    dateBlocage: Timestamp.now()
  },
  historiqueStatuts: [...]
};
await addDoc(collection(db, 'contrats'), contratData);
```

---

#### B. `getContratById(contratId: string): Promise<Contrat | null>`
**Rôle** : Récupérer un contrat par son ID

---

#### C. `getContratByDevisId(devisId: string): Promise<Contrat | null>`
**Rôle** : Récupérer le contrat associé à un devis

---

#### D. `getContratsClient(clientId: string): Promise<Contrat[]>`
**Rôle** : Liste des contrats d'un client (tri côté client)

**Pattern anti-index composite** :
```typescript
const q = query(
  collection(db, 'contrats'),
  where('clientId', '==', clientId)
  // PAS de orderBy → évite index composite
);
const contrats = snapshot.docs.map(...);

// Tri côté client avec .sort()
return contrats.sort((a, b) => {
  return b.dateCreation.toMillis() - a.dateCreation.toMillis();
});
```

---

#### E. `getContratsArtisan(artisanId: string): Promise<Contrat[]>`
**Rôle** : Liste des contrats d'un artisan

---

#### F. `declarerDebutTravaux(contratId, artisanId): Promise<void>`
**Rôle** : Artisan déclare avoir commencé les travaux

**Vérifications** :
- Artisan = propriétaire du contrat
- Statut actuel = `'en_attente_debut'`

**Mise à jour** :
```typescript
await updateDoc(contratRef, {
  statut: 'en_cours',
  dateDebut: Timestamp.now(),
  historiqueStatuts: [...]
});
```

---

#### G. `declarerFinTravaux(data: DeclareFinTravauxData): Promise<void>`
**Rôle** : Artisan déclare avoir terminé les travaux

**Vérifications** :
- Statut actuel = `'en_cours'`

**Mise à jour** :
```typescript
await updateDoc(contratRef, {
  statut: 'travaux_termines',
  dateFinTravaux: Timestamp.now(),
  delaiValidationRestant: 48, // 48h pour validation client
  historiqueStatuts: [...]
});
```

**TODO** : Notification client (travaux terminés, 48h pour valider)

---

#### H. `validerTravaux(data: ValiderTravauxData): Promise<void>`
**Rôle** : Client valide les travaux (appelle API backend)

**Vérifications** :
- Client = propriétaire du contrat
- Statut actuel = `'travaux_termines'`

**Appel API** :
```typescript
const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/payments/release-escrow`, {
  method: 'POST',
  body: JSON.stringify({
    contratId,
    validePar: 'client',
    commentaire, note
  })
});
```

**Résultat** : API backend capture le paiement Stripe et met à jour Firestore

---

#### I. `signalerLitige(data: SignalerLitigeData): Promise<void>`
**Rôle** : Client signale un problème (bloque la libération)

**Mise à jour** :
```typescript
await updateDoc(contratRef, {
  statut: 'litige',
  litige: {
    dateOuverture: Timestamp.now(),
    motif,
    preuves: [],
    statutLitige: 'ouvert'
  },
  historiqueStatuts: [...]
});
```

**TODO** : Upload preuves (photos) + notification admin

---

#### J. `getContratsAutoValidation(): Promise<Contrat[]>`
**Rôle** : Liste des contrats à auto-valider (> 48h depuis fin travaux)

**Logique** :
```typescript
const q = query(
  collection(db, 'contrats'),
  where('statut', '==', 'travaux_termines')
);
const snapshot = await getDocs(q);

const now = Date.now();
const DELAY_48H = 48 * 60 * 60 * 1000;

return snapshot.docs
  .filter(contrat => {
    const dateFinTravaux = contrat.dateFinTravaux?.toMillis() || 0;
    return (now - dateFinTravaux) >= DELAY_48H;
  });
```

**Usage** : Cloud Function quotidienne

---

### 4. Firestore Rules pour Contrats

**Fichier modifié** : `firestore.rules`

**Section ajoutée** : `match /contrats/{contratId}`

**Permissions** :

```javascript
// LECTURE : Client, Artisan ou Admin
allow read: if isAdmin() ||
               isOwner(resource.data.clientId) ||
               isOwner(resource.data.artisanId);

// CRÉATION : Client après paiement
allow create: if isAuthenticated() && 
                 request.auth.uid == request.resource.data.clientId;

// MISE À JOUR : Selon rôle
allow update: if isAdmin() ||
                 // Artisan → déclarer début/fin travaux
                 (isOwner(resource.data.artisanId) && 
                  request.resource.data.statut in ['en_cours', 'travaux_termines']) ||
                 // Client → valider travaux ou litige
                 (isOwner(resource.data.clientId) && 
                  request.resource.data.statut in ['termine_valide', 'litige']);

// SUPPRESSION : Admin uniquement
allow delete: if isAdmin();
```

**Validations** :
```javascript
// Statut valide
allow write: if request.resource.data.statut in [
  'en_attente_debut',
  'en_cours',
  'travaux_termines',
  'termine_valide',
  'termine_auto_valide',
  'litige',
  'annule_rembourse'
];

// Paiement.statut valide
allow write: if request.resource.data.paiement.statut in [
  'bloque',
  'libere',
  'rembourse'
];
```

---

## 📁 Fichiers créés/modifiés

### Créés
- ✅ `frontend/src/types/contrat.ts` (~200 lignes)
- ✅ `backend/src/routes/payments.routes.ts` (~360 lignes)

### Modifiés
- ✅ `frontend/src/types/devis.ts` (+ statuts/champs escrow)
- ✅ `frontend/src/lib/firebase/contrat-service.ts` (réécriture complète ~270 lignes)
- ✅ `firestore.rules` (+ section contrats)

**Total** : ~1100 lignes de code production

---

## ⏳ Étapes suivantes (TODO)

### Phase 1 : Frontend UI (Priorité HAUTE)

#### 5. Modifier PaymentForm pour Stripe Escrow
**Fichier** : `frontend/src/components/devis/PaymentForm.tsx`

**Changements nécessaires** :
```typescript
// ANCIEN (simulation)
const handleSimulatedPayment = async () => {
  await updateDevis(devisId, {
    statut: 'paye',
    paiement: { ... }
  });
};

// NOUVEAU (API escrow réelle)
const handleRealPayment = async () => {
  // 1. Appeler API create-escrow
  const response = await fetch('/api/v1/payments/create-escrow', {
    method: 'POST',
    body: JSON.stringify({
      devisId,
      clientId: user.uid,
      artisanId,
      montantTTC: devis.totaux.totalTTC,
      metadata: {
        numeroDevis: devis.numeroDevis,
        description: devis.titre
      }
    })
  });
  
  const { clientSecret, paymentIntentId } = await response.json();
  
  // 2. Confirmer paiement avec Stripe Elements
  const { error } = await stripe.confirmPayment({
    elements,
    confirmParams: {
      return_url: `${window.location.origin}/client/devis/${devisId}/confirmation`
    }
  });
  
  // 3. Si succès, créer contrat
  if (!error) {
    const contrat = await createContrat({
      devisId,
      clientId: user.uid,
      artisanId,
      montantTotal: devis.totaux.totalTTC,
      paymentIntentId
    });
    
    // 4. Mettre à jour devis
    await updateDevis(devisId, {
      statut: 'paye',
      paiement: {
        montant: devis.totaux.totalTTC,
        date: Timestamp.now(),
        methode: 'carte_bancaire',
        stripe: { paymentIntentId },
        statut: 'bloque',
        contratId: contrat.id
      }
    });
  }
};
```

**Dépendances** :
- Installer `@stripe/stripe-js` et `@stripe/react-stripe-js`
- Configurer Stripe Elements (CardElement)

---

#### 6. Composant ValidationTravauxClient
**Fichier à créer** : `frontend/src/components/contrat/ValidationTravauxClient.tsx`

**Props** :
```typescript
interface Props {
  contrat: Contrat;
  onValidate: () => void;
}
```

**UI** :
```jsx
<div className="border border-[#FFC107] bg-yellow-50 p-6 rounded-lg">
  <h3 className="font-bold text-xl">✅ Valider les travaux</h3>
  <p>L'artisan a déclaré avoir terminé les travaux le {dateFinTravaux}.</p>
  <p className="text-sm text-gray-600">
    Délai restant : <strong>{heuresRestantes}h</strong> 
    (auto-validation dans 48h si aucune action)
  </p>
  
  <textarea 
    placeholder="Commentaire (optionnel)"
    value={commentaire}
    onChange={(e) => setCommentaire(e.target.value)}
  />
  
  <div className="flex gap-4 mt-4">
    <button 
      onClick={handleValider}
      className="bg-[#28A745] text-white px-6 py-3 rounded-lg"
    >
      ✅ Tout est conforme
    </button>
    
    <button 
      onClick={handleSignalerProbleme}
      className="bg-[#DC3545] text-white px-6 py-3 rounded-lg"
    >
      ⚠️ Signaler un problème
    </button>
  </div>
</div>
```

**Logique** :
```typescript
const handleValider = async () => {
  await validerTravaux({
    contratId: contrat.id,
    clientId: user.uid,
    commentaire,
    note: 5 // TODO: ajouter système notation
  });
  
  toast.success('Travaux validés ! L\'artisan va recevoir le paiement.');
  onValidate();
};
```

---

#### 7. Page Artisan - Déclaration Fin Travaux
**Fichier à créer** : `frontend/src/app/artisan/contrats/[id]/page.tsx`

**UI principale** :
```jsx
{contrat.statut === 'en_cours' && (
  <button
    onClick={handleDeclareFinTravaux}
    className="bg-[#FF6B00] text-white px-6 py-3 rounded-lg"
  >
    ✅ Déclarer travaux terminés
  </button>
)}

{contrat.statut === 'travaux_termines' && (
  <div className="bg-blue-50 p-4 rounded">
    <p>⏳ En attente de validation client</p>
    <p className="text-sm">
      Le client a {contrat.delaiValidationRestant}h pour valider.
      Auto-validation dans {heuresRestantes}h.
    </p>
  </div>
)}

{contrat.statut === 'termine_valide' && (
  <div className="bg-green-50 p-4 rounded">
    <p>✅ Travaux validés par le client !</p>
    <p>Vous allez recevoir <strong>{contrat.paiement.montantArtisan}€</strong></p>
    <p className="text-sm text-gray-600">
      (Commission plateforme : {contrat.paiement.commission}€)
    </p>
  </div>
)}
```

---

### Phase 2 : Cloud Function Auto-validation

#### 8. Cloud Function `autoValiderTravaux`
**Fichier à créer** : `functions/src/scheduledJobs/autoValiderTravaux.ts`

**Cron schedule** : Quotidien à 3h du matin
```typescript
import * as functions from 'firebase-functions';
import { getContratsAutoValidation } from '../services/contrat-service';
import fetch from 'node-fetch';

export const autoValiderTravaux = functions.pubsub
  .schedule('every day 03:00')
  .timeZone('Europe/Paris')
  .onRun(async () => {
    console.log('🔄 Début auto-validation travaux...');
    
    // 1. Récupérer contrats > 48h depuis fin travaux
    const contrats = await getContratsAutoValidation();
    
    console.log(`📊 ${contrats.length} contrat(s) à auto-valider`);
    
    // 2. Pour chaque contrat, appeler API release-escrow
    for (const contrat of contrats) {
      try {
        const response = await fetch(`${process.env.API_URL}/api/v1/payments/release-escrow`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contratId: contrat.id,
            validePar: 'auto',
            commentaire: 'Auto-validation après 48h sans action client'
          })
        });
        
        if (response.ok) {
          console.log(`✅ Contrat ${contrat.id} auto-validé`);
        } else {
          console.error(`❌ Erreur contrat ${contrat.id}:`, await response.text());
        }
      } catch (error) {
        console.error(`❌ Erreur contrat ${contrat.id}:`, error);
      }
    }
    
    console.log('✨ Auto-validation terminée');
  });
```

**Déploiement** :
```bash
cd functions
npm install
npm run build
firebase deploy --only functions:autoValiderTravaux
```

---

### Phase 3 : Litige Management

#### 9. Système Litige Client
**Composant à créer** : `frontend/src/components/contrat/SignalerLitigeForm.tsx`

**UI** :
```jsx
<form onSubmit={handleSubmit}>
  <h3>⚠️ Signaler un problème</h3>
  
  <textarea
    required
    placeholder="Décrivez le problème en détail..."
    value={motif}
    onChange={(e) => setMotif(e.target.value)}
  />
  
  <input
    type="file"
    multiple
    accept="image/*"
    onChange={handleFileChange}
  />
  <p className="text-sm text-gray-600">
    Ajoutez des photos pour illustrer le problème
  </p>
  
  <button type="submit" className="bg-[#DC3545] text-white">
    Envoyer le litige
  </button>
</form>
```

**Logique** :
```typescript
const handleSubmit = async (e) => {
  e.preventDefault();
  
  await signalerLitige({
    contratId: contrat.id,
    clientId: user.uid,
    motif,
    preuves: uploadedFiles // TODO: upload Firebase Storage
  });
  
  // Notification admin
  await createNotification({
    recipientId: 'ADMIN_UID',
    type: 'litige_ouvert',
    title: 'Nouveau litige',
    message: `Litige ouvert sur contrat ${contrat.id}`,
    relatedId: contrat.id
  });
  
  toast.warning('Litige signalé. Un admin va examiner votre demande.');
};
```

---

## 📊 Statistiques Session

**Temps estimé** : 3 heures  
**Lignes de code** : ~1100 lignes  
**Fichiers créés** : 2  
**Fichiers modifiés** : 3  
**Tâches complétées** : 4/11 (36%)

---

## 🎯 Prochaine session

**Focus** : Frontend UI (tâches 5-7)

**Plan** :
1. Modifier PaymentForm avec Stripe Elements (2h)
2. Composant ValidationTravauxClient (1h)
3. Page artisan déclaration fin travaux (1h)

**Total estimé** : 4 heures

---

## 💡 Notes importantes

### Commission plateforme
Actuellement : **8%** (configurable via `COMMISSION_RATE`)

### Délai auto-validation
Actuellement : **48 heures** (ajustable dans Cloud Function)

### Stripe Connect
**Phase 2** : Transfert automatique à l'artisan via Stripe Connect  
Nécessite : 
- Création compte Stripe Connect par artisan
- Stockage `stripeAccountId` dans collection `artisans`
- Modification API `/release-escrow` pour appeler `stripe.transfers.create()`

### Tests recommandés
1. Créer devis test
2. Signer + payer (mode test Stripe)
3. Vérifier contrat créé avec `statut: 'bloque'`
4. Déclarer début/fin travaux
5. Valider travaux (client)
6. Vérifier paiement libéré + montant correct

---

**🔐 Sécurité** : Tous les appels API Stripe sont côté backend (clé secrète), jamais exposée côté client.

**📝 Documentation complète** : À créer dans `docs/WORKFLOW_ESCROW_PAIEMENT.md` (tâche 11)
