# ArtisanSafe - Instructions Copilot

## Vue d'ensemble du projet

ArtisanSafe est une plateforme marketplace bilingue (français principal, anglais secondaire) qui connecte les clients avec des artisans qualifiés (plombiers, électriciens, menuisiers, maçons, etc.). La plateforme met l'accent sur la sécurité, la confiance et les transactions transparentes grâce à des profils vérifiés, des paiements sécurisés et une médiation des litiges.

**Stack actuel :**
- Frontend: Next.js 15 + React 19 + TypeScript + TailwindCSS 4
- Backend: Node.js + Express + TypeScript
- Database: Firebase Firestore
- Auth: Firebase Auth
- Storage: Firebase Storage
- Services: SIRENE API (future), OCR Tesseract.js (aide admin), Email (nodemailer)

## 🎨 CHARTE GRAPHIQUE OBLIGATOIRE

### Logo officiel

![Logo ArtisanDispo](https://raw.githubusercontent.com/MOHAMEDALIMRABET/ArtisanSafe/main/docs/assets/logo-artisandispo.png)

**Caractéristiques du logo :**
- Icône maison verte avec marteau (symbolise BTP/artisanat)
- Deux personnes se serrant la main (confiance, partenariat)
- Pin de géolocalisation (proximité locale)
- Typographie : "Artisan" en vert foncé, "Dispo" en orange
- Courbe orange sous le logo (dynamisme, disponibilité)

**Utilisation :**
- Navigation principale : icône circulaire orange avec maison blanche
- Page d'accueil : logo complet avec texte
- Favicon : version simplifiée de l'icône maison
- Réseaux sociaux : logo carré 1024x1024px

### Palette de couleurs (À RESPECTER STRICTEMENT)

**Couleurs principales :**
- **Primary (Orange BTP)**: `#FF6B00` - Boutons CTA, liens, accents importants
- **Secondary (Bleu foncé)**: `#2C3E50` - Headers, navigation, confiance
- **Accent (Jaune sécurité)**: `#FFC107` - Alertes sécurité, highlights

**Couleurs fonctionnelles :**
- **Success**: `#28A745`
- **Danger**: `#DC3545`
- **Warning**: `#FFC107`
- **Info**: `#17A2B8`

**Couleurs neutres :**
- **Gris foncé**: `#6C757D`
- **Gris moyen**: `#95A5A6`
- **Gris clair**: `#E9ECEF`
- **Fond clair**: `#F8F9FA`
- **Blanc**: `#FFFFFF`

**Couleurs de texte :**
- **Texte principal**: `#2C3E50`
- **Texte secondaire**: `#6C757D`
- **Texte sur fond foncé**: `#FFFFFF`

### Règles d'utilisation TailwindCSS

#### Classes TailwindCSS à utiliser :
```tsx
// Couleurs principales
bg-[#FF6B00]     // Fond orange (boutons primaires)
bg-[#2C3E50]     // Fond bleu foncé (headers)
bg-[#FFC107]     // Fond jaune (alertes)

text-[#FF6B00]   // Texte orange (liens)
text-[#2C3E50]   // Texte bleu foncé
text-[#6C757D]   // Texte gris

border-[#FF6B00] // Bordure orange
border-[#2C3E50] // Bordure bleue

hover:bg-[#E56100]  // Orange hover
hover:bg-[#1A3A5C]  // Bleu hover
```

#### Composants UI - Conventions :

**Bouton Primary :**
```tsx
className="bg-[#FF6B00] text-white hover:bg-[#E56100] px-4 py-2 rounded-lg"
```

**Bouton Secondary :**
```tsx
className="border-2 border-[#2C3E50] text-[#2C3E50] hover:bg-[#2C3E50] hover:text-white px-4 py-2 rounded-lg"
```

**Header/Navigation :**
```tsx
className="bg-[#2C3E50] text-white"
```

**Liens :**
```tsx
className="text-[#FF6B00] hover:underline"
```

**Cards :**
```tsx
className="bg-white border border-[#E9ECEF] hover:border-[#FF6B00] rounded-lg shadow-md"
```

### ❌ INTERDICTIONS STRICTES

- ❌ NE JAMAIS utiliser `bg-blue-600`, `bg-blue-500`, `text-blue-600` (sauf pour info)
- ❌ NE JAMAIS utiliser `bg-green-500` comme couleur principale
- ❌ NE JAMAIS inventer de nouvelles couleurs
- ❌ NE JAMAIS utiliser de dégradés autre que orange/bleu
- ✅ TOUJOURS utiliser `bg-[#FF6B00]` pour les boutons d'action
- ✅ TOUJOURS utiliser `bg-[#2C3E50]` pour les headers
- ✅ TOUJOURS utiliser `text-[#FF6B00]` pour les liens

### Contexte métier BTP
- L'orange évoque la sécurité des chantiers
- Le bleu inspire confiance et professionnalisme
- Interface claire, professionnelle et rassurante

## Statut du projet

**Phase actuelle :** MVP avancé - Infrastructure complète et fonctionnalités de base implémentées.

**Fonctionnalités opérationnelles :**
- ✅ Authentification double rôle (clients/artisans) avec vérification email
- ✅ Profils artisans publics avec métiers, localisation, documents (KBIS, décennale)
- ✅ Recherche d'artisans par métier + localisation
- ✅ Système de demandes client → devis artisan → acceptation/refus
- ✅ Messagerie temps réel (Firestore)
- ✅ Notifications en temps réel (badge, dropdown, marquage lu)
- ✅ Vérification KBIS hybride (OCR Tesseract.js pré-remplit + validation manuelle admin)
- ✅ Gestion admin (approbation artisans, historique uploads)
- ✅ Contrats + disponibilités artisans

**En développement :**
- ⏳ Paiement sécurisé (Stripe avec séquestre)
- ⏳ Système d'avis et notations
- ⏳ Géolocalisation avancée (Mapbox)

## Architecture de données (CRITIQUE)

### Collections Firestore

```typescript
// Collection: users (données privées)
{
  uid: string,  // ID Firebase Auth
  email: string,
  role: 'client' | 'artisan' | 'admin',
  nom: string,
  prenom: string,
  representantLegal?: string,  // Artisans uniquement
  telephone: string,
  statut: 'non_verifie' | 'verifie' | 'suspendu',
  emailVerified: boolean,  // Synchronisé depuis Firebase Auth
  createdAt: Timestamp
}

// Collection: artisans (profils publics)
{
  userId: string,  // Référence au document users
  businessName: string,
  siret?: string,
  metiers: string[],  // ['plomberie', 'electricite']
  location: {
    address: string,
    city: string,
    postalCode: string,
    coordinates?: GeoPoint
  },
  description?: string,
  verificationStatus: 'pending' | 'approved' | 'rejected',
  documents: {
    kbis?: { url, uploadedAt, ... },
    decennale?: { url, uploadedAt, ... }
  },
  createdAt: Timestamp
}

// Collection: demandes (demandes clients)
{
  clientId: string,
  metier: string,
  description: string,
  location: { city, postalCode },
  statut: 'publiee' | 'en_attente_devis' | 'devis_recus' | 'acceptee' | 'terminee' | 'annulee',
  devisRecus: number,  // Compteur mis à jour par Cloud Functions
  createdAt: Timestamp
}

// Collection: devis
{
  demandeId: string,
  clientId: string,
  artisanId: string,
  statut: 'brouillon' | 'envoye' | 'accepte' | 'refuse',
  prestations: Array<{ designation, quantite, prixUnitaireHT, tva }>,
  montantHT: number,
  montantTTC: number,
  delaiRealisation?: string,
  dateValidite?: Timestamp,
  motifRefus?: string,  // Si refusé
  createdAt: Timestamp
}

// Collection: contrats
{
  devisId: string,
  clientId: string,
  artisanId: string,
  statut: 'en_cours' | 'termine' | 'annule',
  dateDebut?: Timestamp,
  dateFin?: Timestamp
}

// Collection: conversations + messages
// Messagerie temps réel entre client/artisan

// Collection: notifications
{
  recipientId: string,
  type: 'devis_recu' | 'devis_accepte' | 'devis_refuse' | 'nouveau_message' | ...,
  title: string,
  message: string,
  relatedId?: string,  // ID du devis/message lié
  isRead: boolean,
  createdAt: Timestamp
}
```

### ⚠️ RÈGLE CRITIQUE - Éviter les index composites Firestore

**Problème :**
Les requêtes combinant `where()` + `orderBy()` sur différents champs nécessitent un **index composite** dans Firestore, ce qui bloque le développement jusqu'à la création manuelle de l'index.

**Erreur typique :**
```typescript
// ❌ ÉVITER - Nécessite index composite
const q = query(
  collection(db, 'contrats'),
  where('artisanId', '==', artisanId),
  orderBy('dateCreation', 'desc')  // ← Provoque erreur index
);
```

**Solution - Tri côté client :**
```typescript
// ✅ TOUJOURS FAIRE - Requête simple + tri JavaScript
const q = query(
  collection(db, 'contrats'),
  where('artisanId', '==', artisanId)  // Seul where(), pas d'orderBy
);

const querySnapshot = await getDocs(q);
const contrats = querySnapshot.docs.map(doc => ({
  id: doc.id,
  ...doc.data(),
} as Contrat));

// Tri côté client en JavaScript
return contrats.sort((a, b) => {
  const dateA = a.dateCreation?.toMillis() || 0;
  const dateB = b.dateCreation?.toMillis() || 0;
  return dateB - dateA;  // Ordre décroissant
});
```

**Règle générale :**
- 🚫 NE JAMAIS combiner `where()` + `orderBy()` sur champs différents
- ✅ TOUJOURS faire `where()` uniquement dans Firestore
- ✅ TOUJOURS trier avec `.sort()` en JavaScript après récupération

### Services Firestore (frontend)

Utiliser **TOUJOURS** les services dans `frontend/src/lib/` :
- `firebase/user-service.ts` : CRUD users (createUser, getUserById, updateUser)
- `firebase/artisan-service.ts` : CRUD artisans + recherche
- `firebase/devis-service.ts` : Gestion devis
- `firebase/demande-service.ts` : Gestion demandes
- `firebase/notification-service.ts` : Création/lecture notifications
- `auth-service.ts` : signUpClient, signUpArtisan, signIn, signOut

**Exemple :**
```typescript
import { createUser } from '@/lib/firebase/user-service';
import { createArtisan } from '@/lib/firebase/artisan-service';

// ✅ BON - Utiliser les services
await createUser(userData);
await createArtisan(artisanData);

// ❌ MAUVAIS - Accès direct Firestore
await addDoc(collection(db, 'users'), { ... });  // NE JAMAIS FAIRE
```

## Workflows critiques

### Démarrage développement local

```bash
# Démarrer frontend (port 3000)
cd frontend && npm run dev

# Démarrer backend (port 5000)
cd backend && npm run dev

# Vérifier la config (script utilitaire)
node verify-setup.js
```

### Inscription artisan (workflow complexe)

1. **Formulaire** `/inscription?role=artisan` :
   - Infos personnelles (nom, prénom, email, mot de passe)
   - Infos entreprise (businessName, SIRET, métiers, localisation)

2. **Création compte** (auth-service.ts) :
   ```typescript
   // Créer Firebase Auth user
   await createUserWithEmailAndPassword(auth, email, password)
   
   // Créer document users
   await createUser({ email, nom, prenom, role: 'artisan', ... })
   
   // Créer document artisans (profil public)
   await createArtisan({ userId, businessName, siret, metiers, ... })
   
   // Envoyer email vérification
   await sendEmailVerification(user)
   ```

3. **Validation email OBLIGATOIRE** :
   - ⚠️ Profil artisan **INVISIBLE** tant que `emailVerified = false`
   - Sync automatique via `syncEmailVerificationStatus()` (hook useAuthStatus)
   - Redirection `/email-verified` après validation

4. **Upload documents** (frontend → Firebase Storage) :
   - Upload KBIS, pièce d'identité, RC Pro, Garantie décennale
   - **OCR automatique Tesseract.js** :
     - Extraction SIRET, raison sociale, représentant légal
     - Vérification auto SIRET vs profil
     - Détection QR code INPI
   - Stockage Firebase Storage + métadonnées OCR
   - Mise à jour `artisans.documents` avec URLs et données extraites

5. **Approbation admin (VALIDATION FINALE)** :
   - Page `/admin/verifications`
   - Admin **consulte visuellement** les documents uploadés
   - Champs **pré-remplis par OCR** (aide)
   - **Vérification manuelle finale** : KBIS, identité, RC Pro, Garantie
   - Change `verificationStatus` → 'approved' | 'rejected'
   - ✅ Profil visible dans recherches uniquement si 'approved' + `emailVerified = true`

### Cycle de vie devis

```
1. Client crée demande (/client/nouvelle-demande)
   → Collection: demandes (statut: 'publiee')

2. Artisan trouve demande (/artisan/demandes)
   → Filtre par métier + localisation

3. Artisan crée devis (/artisan/devis/nouveau)
   → Collection: devis (statut: 'brouillon' puis 'envoye')
   → Notification client (type: 'devis_recu')
   → Incrémente demandes.devisRecus

4. Client consulte devis (/client/devis/[id])
   → Accepter: statut → 'accepte'
     • Notification artisan (type: 'devis_accepte')
     • Crée contrat (collection: contrats)
   → Refuser: statut → 'refuse' + motifRefus
     • Notification artisan (type: 'devis_refuse')
```

### Notifications temps réel

**Hook personnalisé** `useNotifications(userId)` :
```typescript
// Écoute Firestore onSnapshot
const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications(user?.uid);

// Création notification (exemple)
await createNotification({
  recipientId: clientId,
  type: 'devis_recu',
  title: 'Nouveau devis reçu',
  message: `${artisan.businessName} vous a envoyé un devis`,
  relatedId: devisId
});
```

**Badge UI** : `<NotificationBadge />` affiche cloche + compteur

### Architecture OCR Documents

**Frontend** : OCR complet Tesseract.js
- Fichier : `frontend/src/lib/firebase/document-parser.ts` (1105 lignes)
- Fonction : `parseKbisDocument(file)`
- Extraction : SIRET, raison sociale, représentant légal, QR code INPI
- Utilisé par : `verification-service.ts` → `verifyKbisDocument()`

**Backend** : Analyse légère
- Fichier : `backend/src/services/document-parser.service.ts` (157 lignes)
- Fonction : `parseKbisDocument(file)`
- Analyse : Métadonnées uniquement (pas de Tesseract.js)
- Endpoint : `/api/v1/documents/parse-kbis`

**Important** : Les deux implémentations coexistent avec des objectifs différents.

## 🎨 CHARTE GRAPHIQUE (STRICTEMENT OBLIGATOIRE)

### Palette de couleurs

**TOUJOURS utiliser ces couleurs exactes :**
```tsx
// Couleurs principales
bg-[#FF6B00]     // Primary (Orange BTP) - Boutons CTA
bg-[#2C3E50]     // Secondary (Bleu foncé) - Headers/navigation
bg-[#FFC107]     // Accent (Jaune sécurité) - Alertes

// Couleurs fonctionnelles
bg-[#28A745]     // Success
bg-[#DC3545]     // Danger
text-[#6C757D]   // Texte secondaire

// États hover
hover:bg-[#E56100]  // Orange hover
hover:bg-[#1A3A5C]  // Bleu hover
```

**INTERDICTIONS :**
- ❌ NE JAMAIS utiliser `bg-blue-600`, `text-blue-500` (réservé info uniquement)
- ❌ NE JAMAIS inventer de nouvelles couleurs
- ✅ TOUJOURS `bg-[#FF6B00]` pour boutons primaires
- ✅ TOUJOURS `bg-[#2C3E50]` pour headers/navigation
- ✅ TOUJOURS `text-[#FF6B00]` pour liens

**Exemples de composants :**
```tsx
// Bouton Primary
<button className="bg-[#FF6B00] text-white hover:bg-[#E56100] px-4 py-2 rounded-lg">

// Bouton Secondary
<button className="border-2 border-[#2C3E50] text-[#2C3E50] hover:bg-[#2C3E50] hover:text-white">

// Card interactive
<div className="bg-white border border-[#E9ECEF] hover:border-[#FF6B00] rounded-lg shadow-md">
```

## Conventions de code

### Nommage
- **Composants :** PascalCase (`ArtisanCard`, `DevisForm`)
- **Fonctions/Variables :** camelCase (`getUserProfile`, `createDevis`)
- **Constantes :** UPPER_SNAKE_CASE (`MAX_FILE_SIZE_MB`)
- **Fichiers :** kebab-case (`artisan-profile.tsx`, `devis-service.ts`)

### Termes métier (français)
- **Artisan** (pas "craftsman")
- **Devis** (quote/estimate)
- **Demande** (request)
- **Métier** (trade: plomberie, électricité, menuiserie, maçonnerie)
- **Prestation** (service)
- **Avis** (review/rating)

### Structure composant React
```tsx
// 1. Imports
import { useState } from 'react';
import { Button } from '@/components/ui';

// 2. Types/Interfaces
interface ArtisanCardProps {
  artisan: Artisan;
  onContact: (id: string) => void;
}

// 3. Composant
export function ArtisanCard({ artisan, onContact }: ArtisanCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  // ...
}
```

### Gestion erreurs
- **Messages utilisateur** : Toujours en français : "Une erreur s'est produite. Veuillez réessayer."
- **Logs serveur** : Détails techniques pour debug
- **Ne jamais** exposer traces de pile ou erreurs internes aux clients
- Utiliser `translateAuthError()` dans auth-service.ts pour erreurs Firebase Auth

## Patterns spécifiques au projet

### Vérification documents (WORKFLOW HYBRIDE)

**Workflow actuel - OCR automatique + validation manuelle** :

1. **Upload artisan** :
   - Frontend upload documents → Firebase Storage
   - **OCR Tesseract.js automatique** (frontend) :
     - Extraction SIRET, raison sociale, représentant légal
     - Comparaison SIRET extrait vs SIRET profil
     - Détection QR code INPI (si présent)
     - Pré-vérification automatique
   - Service utilisé : `frontend/src/lib/firebase/document-parser.ts`

2. **Validation admin (DÉCISION FINALE)** :
   - Admin consulte `/admin/verifications`
   - **Vérification visuelle manuelle** des documents :
     - KBIS (validité, concordance SIRET/raison sociale)
     - Pièce d'identité (représentant légal)
     - RC Pro (assurance responsabilité civile)
     - Garantie décennale (couverture activités)
   - OCR a pré-rempli les champs → Admin vérifie la cohérence
   - **Admin décide** : approuve/rejette → `verificationStatus`

**Architecture technique** :
```typescript
// Frontend - OCR automatique (AIDE)
const parseResult = await parseKbisDocument(file);
// → Tesseract.js extrait : SIRET, raison sociale, représentant légal, QR code

// Backend - Analyse légère (OPTIONNEL)
POST /api/v1/documents/parse-kbis
// → Analyse métadonnées (nom fichier, taille, type)

// API SIRENE - Feature future (NON ACTIVÉE)
POST /api/v1/sirene/verify
Body: { siret: "12345678901234", raisonSociale: "ENTREPRISE SAS" }
// → À activer lors de l'inscription artisan
```

**Important** :
- ✅ OCR = **outil d'aide** pour gagner du temps
- ✅ Admin = **décision finale** (sécurité maximale)
- ✅ Validation manuelle = **obligatoire** pour approuver

### Validation email (AUTOMATIQUE - NE PAS MODIFIER)

**Workflow Firebase Auth** :
```typescript
// 1. Inscription → Email de vérification automatique
await sendEmailVerification(user);

// 2. Utilisateur clique sur lien → Firebase valide
// 3. Sync automatique via syncEmailVerificationStatus()
// 4. Profil artisan visible SI emailVerified = true + verificationStatus = 'approved'
```

⚠️ **IMPORTANT** : Ne pas désactiver l'envoi automatique d'emails de vérification

### Notifications (Pattern observateur)

```typescript
// Fonction helper pour notifier
async function notifyClientDevisRecu(clientId: string, devisId: string, artisan: Artisan) {
  await createNotification({
    recipientId: clientId,
    type: 'devis_recu',
    title: 'Nouveau devis reçu',
    message: `${artisan.businessName} vous a envoyé un devis`,
    relatedId: devisId
  });
}

// Utilisation dans devis-service
await updateDevisStatus(devisId, 'envoye');
await notifyClientDevisRecu(clientId, devisId, artisan);
```

### Double rôle utilisateur (Client/Artisan)

**Règles de visibilité :**
- Profils artisans : **publics** (lecture = true dans firestore.rules)
- Profils clients : **privés** (lecture = isOwner || isAdmin)
- Dashboard artisan : `/artisan/dashboard`
- Dashboard client : `/client/dashboard`
- Routage basé sur `user.role` (hook `useAuthStatus`)

### Recherche artisans

Pattern actuel (frontend) :
```typescript
// Service: searchArtisans(metier?, ville?)
const artisans = await searchArtisans('plomberie', 'Paris');

// Firestore query simple (pas d'index composite)
let q = query(collection(db, 'artisans'));
if (metier) q = query(q, where('metiers', 'array-contains', metier));
if (ville) q = query(q, where('location.city', '==', ville));

// Filtres supplémentaires côté client
return artisans.filter(a => a.verificationStatus === 'approved' && a.emailVerified);
```

## Configuration environnement

**Frontend** `.env.local` :
```env
NEXT_PUBLIC_API_URL=http://localhost:5000/api/v1
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...
```

**Backend** `.env` :
```env
PORT=5000
NODE_ENV=development
FIREBASE_PROJECT_ID=...
FIREBASE_CLIENT_EMAIL=...
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----..."
```

Credentials disponibles via admin - voir `docs/ADMIN_CREDENTIALS_SHARING.md`

## Documentation complémentaire

**Workflows essentiels :**
- `docs/EMAIL_VERIFICATION_WORKFLOW.md` - Validation email client/artisan
- `docs/WORKFLOW_CLIENT_DEVIS.md` - Cycle complet devis
- `docs/WORKFLOW_POST_ACCEPTANCE_SEQUESTRE.md` - Paiement (futur)

**Systèmes techniques :**
- `docs/KBIS_VERIFICATION_AUTOMATIQUE.md` - OCR + validation SIRET
- `docs/SYSTEME_NOTIFICATIONS.md` - Architecture notifications temps réel
- `docs/FIREBASE.md` - Structure Firestore complète
- `docs/ARCHITECTURE_TECHNIQUE.md` - Vue d'ensemble système

**Admin :**
- `docs/ADMIN_UPLOAD_HISTORY.md` - Gestion uploads documents
- `scripts/create-admin.js` - Créer compte admin Firebase

## API Backend - Endpoints disponibles

**Routes actives** :

1. **`/api/v1/documents/parse-kbis`** (Backend - Analyse légère)
   - Analyse métadonnées uniquement (nom fichier, taille, type)
   - **PAS d'OCR** : Version légère sans Tesseract.js
   - Limite : 10MB, formats PDF/JPG/PNG
   - **Note** : OCR Tesseract.js complet utilisé côté frontend

2. **`/api/v1/sirene/verify`** (Feature future)
   - Vérification SIRET + raison sociale
   - API publique : entreprise.data.gouv.fr
   - **Non activé** : À implémenter lors de l'inscription

3. **`/api/v1/sms/send-verification-code`** (Si Twilio configuré)
   - Envoi code vérification téléphone
   - Coût : ~0.05€/SMS
   - Mode simulation si non configuré

4. **`/api/v1/emails/send-pending`** (Admin uniquement)
   - Envoi manuel emails en attente
   - Complément au système automatique Firebase

## Tests et débogage

```bash
# Tester API SIRENE (future feature)
node backend/test-sirene-api.js

# Vérifier config Firebase
node verify-setup.js

# Vérifier notifications
node scripts/verifier-notifications.js

# Redémarrer backend (Windows)
RESTART_BACKEND.bat
```

**Erreurs fréquentes :**
- "Missing index" Firestore → Utiliser tri JavaScript client-side
- "Email not verified" → Vérifier syncEmailVerificationStatus() appelé
- CORS upload → Voir `docs/FIX_CORS_UPLOAD.md` + `update-cors.ps1`
- Boucle infinie → Voir `docs/DEPANNAGE_BOUCLE_INFINIE.md`
- Upload documents échoue → Vérifier Firebase Storage rules et CORS

## Stratégie de tests (À implémenter)

### Structure recommandée

```
ArtisanSafe/
├── frontend/
│   ├── src/
│   │   └── lib/
│   │       └── __tests__/              # Tests unitaires
│   │           ├── validators.test.ts
│   │           └── integration/        # Tests intégration
│   └── e2e/                            # Tests E2E Playwright
│       ├── artisan-inscription.spec.ts
│       └── client-devis.spec.ts
│
├── backend/
│   └── src/
│       └── services/
│           └── __tests__/              # Tests unitaires/intégration
│
└── tests/
    └── fixtures/                       # Données test réutilisables
        ├── artisan.fixture.ts
        └── devis.fixture.ts
```

### Patterns de tests à utiliser

**Pattern AAA (Arrange-Act-Assert)** :
```typescript
test('accepter un devis change le statut', async () => {
  // ARRANGE (Préparer)
  const devis = await createTestDevis({ statut: 'envoye' });
  
  // ACT (Agir)
  await acceptDevis(devis.id);
  
  // ASSERT (Vérifier)
  const devisUpdated = await getDevisById(devis.id);
  expect(devisUpdated.statut).toBe('accepte');
});
```

**Pattern Given-When-Then** :
```typescript
it('devrait créer un contrat quand un devis est accepté', async () => {
  // GIVEN (Étant donné) - État initial
  const devis = await createTestDevis({ statut: 'envoye' });
  
  // WHEN (Quand) - Action
  await acceptDevis(devis.id);
  
  // THEN (Alors) - Résultat attendu
  const contrats = await getContratsByDevis(devis.id);
  expect(contrats).toHaveLength(1);
});
```

### Outils recommandés

**Frontend** :
```bash
npm install --save-dev jest @testing-library/react @testing-library/jest-dom
npm install --save-dev @playwright/test  # E2E
```

**Backend** :
```bash
npm install --save-dev jest supertest
```

**Configuration Jest** (`jest.config.js`) :
```javascript
module.exports = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
};
```

### Phase 1 : Tests prioritaires (MVP)

**Tests critiques à implémenter d'abord** :

1. **Validation SIRET** (unitaire)
```typescript
// frontend/src/lib/__tests__/validators.test.ts
test('accepte SIRET valide 14 chiffres', () => {
  expect(isValidSiret('12345678901234')).toBe(true);
});
```

2. **Authentification** (intégration)
```typescript
// frontend/src/lib/__tests__/auth-service.test.ts
test('signUpArtisan crée user + artisan', async () => {
  const result = await signUpArtisan(mockData);
  expect(result.user).toBeDefined();
  expect(result.artisan).toBeDefined();
});
```

3. **Création devis** (intégration)
```typescript
// frontend/src/lib/firebase/__tests__/devis-service.test.ts
test('createDevis incrémente compteur demande', async () => {
  const devis = await createDevis(mockDevisData);
  const demande = await getDemandeById(devis.demandeId);
  expect(demande.devisRecus).toBe(1);
});
```

4. **Inscription artisan** (E2E)
```typescript
// e2e/artisan-inscription.spec.ts
test('parcours complet inscription', async ({ page }) => {
  await page.goto('/inscription?role=artisan');
  await page.fill('[name="email"]', 'test@artisan.com');
  // ... remplir formulaire
  await page.click('[type="submit"]');
  await expect(page).toHaveURL('/artisan/dashboard');
});
```

### Phase 2 : Extension progressive

**Après MVP, ajouter** :
- Tests notifications temps réel
- Tests recherche artisans (filtres, tri)
- Tests messagerie (envoi, réception)
- Tests upload documents + OCR
- Tests cycle complet devis → contrat
- Tests paiements (quand Stripe intégré)

### Commandes npm

```json
// package.json scripts
{
  "test": "jest",
  "test:watch": "jest --watch",
  "test:coverage": "jest --coverage",
  "test:e2e": "playwright test",
  "test:e2e:ui": "playwright test --ui"
}
```

### Fixtures réutilisables

```typescript
// tests/fixtures/artisan.fixture.ts
export const mockArtisan = {
  userId: 'artisan-123',
  businessName: 'Test Plomberie',
  siret: '12345678901234',
  metiers: ['plomberie'],
  verificationStatus: 'approved',
  emailVerified: true
};

// tests/fixtures/devis.fixture.ts
export const mockDevis = {
  clientId: 'client-123',
  artisanId: 'artisan-123',
  statut: 'envoye',
  montantTTC: 1500
};
```

### Bonnes pratiques

- ✅ **Isoler les tests** : Chaque test doit être indépendant
- ✅ **Nettoyer après** : Supprimer données test (afterEach)
- ✅ **Mocker Firebase** : Éviter vraies écritures en base
- ✅ **Tests rapides** : Unitaires < 1s, E2E < 30s
- ✅ **Nommer clairement** : "devrait créer notification quand devis accepté"
- ❌ **Éviter** : Tests dépendants les uns des autres
- ❌ **Éviter** : Hardcoder des IDs (utiliser fixtures)

## Prochaines étapes (roadmap)

- ⏳ Intégration Stripe (paiement sécurisé + séquestre)
- ⏳ Système avis/notations post-prestation
- ⏳ Mapbox (géolocalisation avancée + rayon recherche)
- ⏳ Messagerie améliorée (pièces jointes, images)
- ⏳ Application mobile React Native
- ⏳ Suite de tests complète (Jest + Playwright)
