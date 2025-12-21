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
