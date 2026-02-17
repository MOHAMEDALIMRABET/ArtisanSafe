# 🔥 Configuration Firebase

## Structure Firestore

### Collections principales

#### 1. **users** (Privé - Données personnelles)
```typescript
{
  uid: string,
  email: string,
  role: 'client' | 'artisan',
  firstName: string,
  lastName: string,
  phone?: string,
  photoURL?: string,
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

#### 2. **artisans** (Public - Profils visibles)
```typescript
{
  uid: string,
  businessName: string,
  metiers: string[], // ['plomberie', 'électricité']
  description: string,
  location: {
    address: string,
    city: string,
    postalCode: string,
    coordinates: { latitude, longitude }
  },
  verified: boolean,
  rating: number,
  reviewCount: number,
  availability: boolean,
  portfolio: PortfolioItem[],
  certifications?: string[],
  siret?: string,
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

#### 3. **devis** (Demandes de devis)
```typescript
{
  id: string,
  clientId: string,
  artisanId: string,
  metier: string,
  description: string,
  status: 'pending' | 'quoted' | 'accepted' | 'rejected' | 'completed',
  estimatedPrice?: number,
  estimatedDuration?: string,
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

#### 4. **avis** (Évaluations artisans)
```typescript
{
  id: string,
  artisanId: string,
  clientId: string,
  devisId: string,
  rating: number, // 1-5
  comment: string,
  response?: { message, respondedAt },
  createdAt: Timestamp
}
```

#### 5. **conversations** & **messages** (Messagerie)

## Règles de sécurité Firestore

À ajouter dans Firebase Console → Firestore Database → Rules:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Helper functions
    function isAuthenticated() {
      return request.auth != null;
    }
    
    function isOwner(uid) {
      return request.auth.uid == uid;
    }
    
    // Users collection (privé)
    match /users/{userId} {
      allow read, write: if isAuthenticated() && isOwner(userId);
    }
    
    // Artisans collection (public en lecture)
    match /artisans/{artisanId} {
      allow read: if true; // Public
      allow write: if isAuthenticated() && isOwner(artisanId);
    }
    
    // Devis collection
    match /devis/{devisId} {
      allow read: if isAuthenticated() && 
        (resource.data.clientId == request.auth.uid || 
         resource.data.artisanId == request.auth.uid);
      allow create: if isAuthenticated();
      allow update: if isAuthenticated() && 
        (resource.data.clientId == request.auth.uid || 
         resource.data.artisanId == request.auth.uid);
    }
    
    // Avis collection (public en lecture)
    match /avis/{avisId} {
      allow read: if true;
      allow create: if isAuthenticated();
      allow update: if isAuthenticated() && resource.data.clientId == request.auth.uid;
    }
  }
}
```

## Index Firestore à créer

Dans Firebase Console → Firestore Database → Indexes:

1. **artisans**
   - `metiers` (array) + `verified` (asc) + `rating` (desc)
   - `location.city` (asc) + `metiers` (array) + `verified` (asc)

2. **devis**
   - `clientId` (asc) + `createdAt` (desc)
   - `artisanId` (asc) + `createdAt` (desc)

## Configuration requise

### 1. Créer un projet Firebase
1. Aller sur https://console.firebase.google.com
2. Créer un nouveau projet "ArtisanSafe"
3. Activer Firebase Authentication (Email/Password)
4. Activer Firestore Database (mode test pour commencer)
5. Activer Storage (pour les images)

### 2. Récupérer les credentials

**Frontend** (Project Settings → General):
```env
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=artisansafe.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=artisansafe
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=artisansafe.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...
```

**Backend** (Project Settings → Service Accounts → Generate new private key):
```env
FIREBASE_PROJECT_ID=artisansafe
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@artisansafe.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

## Utilisation

### Inscription client
```typescript
import { authService } from '@/lib/auth-service';

await authService.signUpClient({
  email: 'client@example.com',
  password: 'securePassword123',
  firstName: 'Jean',
  lastName: 'Dupont',
  role: 'client',
  phone: '0612345678'
});
```

### Inscription artisan
```typescript
await authService.signUpArtisan({
  email: 'artisan@example.com',
  password: 'securePassword123',
  firstName: 'Marie',
  lastName: 'Martin',
  role: 'artisan',
  businessName: 'Plomberie Martin',
  metiers: ['plomberie'],
  location: {
    address: '123 Rue de la Paix',
    city: 'Paris',
    postalCode: '75001'
  }
});
```

### Rechercher des artisans
```typescript
import { artisanService } from '@/lib/firestore-service';

const artisans = await artisanService.searchByMetier('plomberie');
```

## Migration depuis MongoDB (si besoin)

Les services sont prêts - pas besoin de MongoDB. Firebase remplace :
- **MongoDB** → **Firestore** (base de données)
- **JWT custom** → **Firebase Auth** (authentification)
- **AWS S3** → **Firebase Storage** (fichiers)

---

## 📊 Collections supplémentaires - Système Express (< 150€)

### 6. **demandes_express** (Petits travaux rapides)

Workflow simplifié pour interventions urgentes à prix fixe (budget maximum 150€).

```typescript
{
  id: string,
  typeProjet: 'express',
  clientId: string,
  artisanId?: string, // Si demande directe
  categorie: Categorie,
  sousCategorie?: string,
  description: string,
  photos?: string[],
  budgetPropose?: number, // Max 150€
  ville: string,
  codePostal: string,
  adresse?: string,
  coordonneesGPS?: { latitude: number; longitude: number },
  date: string,
  urgence: 'normal' | 'rapide' | 'urgent',
  statut: DemandeExpressStatut,
  createdAt: Timestamp,
  updatedAt: Timestamp,
  expiresAt: Timestamp // 48h par défaut
}

// Statuts
type DemandeExpressStatut = 
  | 'en_attente_proposition'
  | 'proposition_recue'
  | 'acceptee'
  | 'payee'
  | 'en_cours'
  | 'terminee'
  | 'annulee'
  | 'expiree';
```

**Règles Firestore** :
```javascript
match /demandes_express/{demandeId} {
  allow read: if isOwner(resource.data.clientId) || 
                 (isArtisan() && isVerified()) ||
                 isAdmin();
  allow create: if isClient() && 
                   request.auth.uid == request.resource.data.clientId;
  allow update: if isOwner(resource.data.clientId) || isAdmin();
}
```

### 7. **propositions_express** (Réponses artisans Express)

```typescript
{
  id: string,
  demandeId: string,
  artisanId: string,
  clientId: string,
  montantPropose: number, // Max 150€
  description: string,
  delaiIntervention?: string,
  dateInterventionProposee?: Timestamp,
  statut: PropositionExpressStatut,
  createdAt: Timestamp,
  acceptedAt?: Timestamp,
  refusedAt?: Timestamp,
  motifRefus?: string
}

type PropositionExpressStatut = 
  | 'en_attente_acceptation'
  | 'acceptee'
  | 'refusee'
  | 'expiree';
```

**Règles Firestore** :
```javascript
match /propositions_express/{propositionId} {
  allow read: if isOwner(resource.data.clientId) || 
                 isOwner(resource.data.artisanId) ||
                 isAdmin();
  allow create: if isArtisan() && 
                   request.resource.data.montantPropose <= 150;
}
```

### 8. **paiements_express** (Escrow Stripe)

⚠️ **Collection critique** contenant les données financières.

```typescript
{
  id: string,
  demandeId: string,
  propositionId: string,
  clientId: string,
  artisanId: string,
  stripePaymentIntentId: string,
  stripeChargeId?: string,
  montant: number,
  commission: number, // 10%
  montantArtisan: number, // 90%
  statut: PaiementExpressStatut,
  createdAt: Timestamp,
  paidAt?: Timestamp,
  releasedAt?: Timestamp,
  refundedAt?: Timestamp
}

type PaiementExpressStatut = 
  | 'en_attente'
  | 'paye'      // Fonds en séquestre
  | 'libere'    // Transféré à artisan
  | 'rembourse'
  | 'echoue';
```

**Règles Firestore (SÉCURITÉ MAXIMALE)** :
```javascript
match /paiements_express/{paiementId} {
  allow read: if isOwner(resource.data.clientId) || 
                 isOwner(resource.data.artisanId) ||
                 isAdmin();
  allow create: if false; // Uniquement backend via webhook
  allow update: if false; // Uniquement backend
  allow delete: if false; // Jamais supprimer données financières
}
```

**Workflow paiement** :
1. Client accepte proposition → Frontend appelle `POST /stripe-express/create-payment-intent`
2. Backend crée PaymentIntent Stripe (`capture_method: 'manual'`)
3. Client paie avec carte → Webhook `payment_intent.succeeded` → Création document `paiements_express`
4. Artisan termine intervention → Backend `POST /stripe-express/capture-payment` (90%)
5. Statut → `'libere'`, artisan reçoit paiement

---

## 🔐 Résumé règles de sécurité

| Collection | Lecture | Écriture | Suppression |
|-----------|---------|----------|-------------|
| `users` | Propriétaire + Admin | Propriétaire + Admin | Admin |
| `artisans` | Public | Propriétaire + Admin | Admin |
| `demandes` | Propriétaire + Matchés + Admin | Propriétaire + Admin | Propriétaire + Admin |
| `devis` | Client + Artisan + Admin | Client + Artisan + Admin | Artisan + Admin |
| `demandes_express` | Propriétaire + Artisans vérifiés | Propriétaire + Admin | Propriétaire + Admin |
| `propositions_express` | Client + Artisan + Admin | Artisan (create), Client (update) | Artisan + Admin |
| `paiements_express` | Client + Artisan + Admin | ❌ Backend uniquement | ❌ Jamais |

