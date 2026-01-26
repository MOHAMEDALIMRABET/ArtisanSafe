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

### Cloud Functions Firebase (À implémenter - Phase 2)

**Qu'est-ce que c'est ?** Code qui s'exécute **automatiquement** dans le cloud Firebase sans serveur à gérer.

**Statut actuel** : Dossier `functions/` vide - aucune Cloud Function déployée.

#### Cas d'usage recommandés pour ArtisanSafe

**1. Compteur devisRecus automatique** (Priorité HAUTE)
```typescript
// functions/src/index.ts
exports.onDevisCreated = functions.firestore
  .document('devis/{devisId}')
  .onCreate(async (snapshot) => {
    const devis = snapshot.data();
    
    // Incrémenter compteur automatiquement
    await admin.firestore()
      .doc(`demandes/${devis.demandeId}`)
      .update({ 
        devisRecus: admin.firestore.FieldValue.increment(1) 
      });
  });
```

**Pourquoi** : Actuellement géré manuellement dans le code - risque de désynchronisation si erreur.

**2. Notifications automatiques** (Priorité MOYENNE)
```typescript
exports.sendNotificationOnDevisAccepted = functions.firestore
  .document('devis/{devisId}')
  .onUpdate(async (change) => {
    const before = change.before.data();
    const after = change.after.data();
    
    // Si statut passe à 'accepte'
    if (before.statut !== 'accepte' && after.statut === 'accepte') {
      await admin.firestore().collection('notifications').add({
        recipientId: after.artisanId,
        type: 'devis_accepte',
        title: 'Devis accepté !',
        message: 'Votre devis a été accepté',
        relatedId: change.after.id,
        isRead: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
    }
  });
```

**Pourquoi** : Garantit que notifications sont toujours envoyées même si frontend fermé.

**3. Nettoyage automatique** (Priorité BASSE)
```typescript
// Supprimer demandes expirées tous les jours à 3h
exports.cleanupExpiredDemandes = functions.pubsub
  .schedule('every day 03:00')
  .timeZone('Europe/Paris')
  .onRun(async () => {
    const thirtyDaysAgo = admin.firestore.Timestamp.fromDate(
      new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    );
    
    const snapshot = await admin.firestore()
      .collection('demandes')
      .where('createdAt', '<', thirtyDaysAgo)
      .where('statut', '==', 'publiee')
      .get();
    
    const batch = admin.firestore().batch();
    snapshot.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
  });
```

#### Types de triggers disponibles

```typescript
// 1. Firestore triggers (les plus utiles)
onCreate()   // Document créé
onUpdate()   // Document modifié
onDelete()   // Document supprimé

// 2. Auth triggers
functions.auth.user().onCreate()  // Nouvel utilisateur

// 3. Scheduled (Cron jobs)
functions.pubsub.schedule('every day 02:00').onRun()

// 4. HTTP (API endpoints serverless)
functions.https.onRequest()
```

#### Avantages

- ✅ **Automatisation** : Code s'exécute sans intervention
- ✅ **Fiabilité** : Garanti de s'exécuter même si frontend fermé
- ✅ **Sécurité** : Accès privilégié Firebase Admin SDK
- ✅ **Scalabilité** : Gère 1 ou 10000 requêtes automatiquement
- ✅ **Coût** : Gratuit jusqu'à 2 millions d'appels/mois

#### Quand implémenter

**Phase 2** (après MVP) : 
1. Installer Firebase Functions : `firebase init functions`
2. Implémenter compteur devisRecus
3. Déployer : `firebase deploy --only functions`

**Coût estimé** : Gratuit pour usage ArtisanSafe (< 100k appels/mois)

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

## Stratégie de tests

### 🎯 QUAND tester ? (Recommandation ArtisanSafe)

**Approche progressive recommandée** :

#### Phase 1 : **MAINTENANT** - Tests critiques anti-régression (Priorité 1)
**Quand** : Avant tout déploiement production ou modification importante  
**Temps estimé** : 4-6 heures  
**Objectif** : Protéger les fonctionnalités existantes

**✅ À tester EN PRIORITÉ** :

1. **Authentification & Inscription** (CRITIQUE)
   - Inscription client réussie → document `users` créé
   - Inscription artisan → documents `users` + `artisans` créés
   - Email vérification envoyé automatiquement
   - Connexion avec bonnes credentials
   - Déconnexion nettoie la session

2. **Cycle de vie Devis** (CŒUR MÉTIER)
   - Création devis incrémente `demandes.devisRecus`
   - Acceptation devis → statut 'accepte' + création contrat
   - Refus devis → statut 'refuse' + motifRefus enregistré
   - Notification client lors envoi devis
   - Notification artisan lors acceptation/refus

3. **Vérification documents** (SÉCURITÉ)
   - Upload KBIS → stockage Firebase Storage
   - OCR extrait SIRET correct
   - Comparaison SIRET profil vs SIRET document
   - Admin peut approuver/rejeter artisan
   - Profil invisible si non approuvé

4. **Recherche artisans** (FONCTIONNALITÉ CLÉ)
   - Recherche par métier retourne bons résultats
   - Recherche par ville filtre correctement
   - Artisans non approuvés exclus des résultats
   - Artisans emailVerified=false exclus des résultats

#### Phase 2 : **PENDANT nouvelles features** - Tests progressifs (Priorité 2)
**Quand** : Au moment du développement de chaque nouvelle fonctionnalité  
**Temps estimé** : +30% temps développement feature

**À tester lors de l'ajout** :
- **Stripe paiement** → Tests transactions, webhooks, séquestre
- **Système avis** → Tests création, modération, calcul moyenne
- **Mapbox géolocalisation** → Tests rayon recherche, calcul distance
- **Messagerie pièces jointes** → Tests upload, téléchargement, limites

#### Phase 3 : **APRÈS bugs production** - Tests de non-régression (Priorité 3)
**Quand** : Immédiatement après correction d'un bug  
**Temps estimé** : 15-30 minutes par bug

**Processus** :
1. Bug découvert → Noter scénario
2. Corriger le bug
3. Écrire test reproduisant le bug
4. Vérifier que test passe avec correction
5. Commit code + test ensemble

#### Phase 4 : **MAINTENANCE** - Extension couverture (Continu)
**Quand** : 1-2h par semaine  
**Objectif** : Augmenter couverture progressivement

**Plan hebdomadaire** :
- Semaine 1 : Tester notifications
- Semaine 2 : Tester messagerie
- Semaine 3 : Tester disponibilités artisan
- Semaine 4 : Tester contrats

### ✅ QUOI tester exactement ? (Liste exhaustive)

#### Tests Niveau 1 : CRITIQUE (À faire immédiatement)

**Authentification** :
```typescript
✅ signUpClient() crée document users avec role='client'
✅ signUpArtisan() crée users + artisans
✅ sendEmailVerification() appelé automatiquement
✅ signIn() avec credentials valides retourne user
✅ signIn() avec mauvais password échoue avec message français
✅ signOut() nettoie auth.currentUser
```

**Devis** :
```typescript
✅ createDevis() crée document avec statut='brouillon'
✅ sendDevis() change statut → 'envoye' + crée notification client
✅ acceptDevis() change statut → 'accepte' + crée contrat + notifie artisan
✅ refuseDevis() change statut → 'refuse' + enregistre motifRefus
✅ createDevis() incrémente demandes.devisRecus
```

**Vérification KBIS** :
```typescript
✅ parseKbisDocument() extrait SIRET 14 chiffres
✅ compareSiret() détecte concordance profil/document
✅ verifyKbisDocument() retourne success si SIRET matche
✅ Admin approve → verificationStatus='approved'
✅ Profil invisible si verificationStatus='pending'
```

**Recherche** :
```typescript
✅ searchArtisans('plomberie') retourne uniquement plombiers
✅ searchArtisans(null, 'Paris') filtre par ville
✅ Artisans non approuvés exclus des résultats
✅ Artisans emailVerified=false exclus
✅ Tri côté client fonctionne (pas d'index composite Firestore)
```

#### Tests Niveau 2 : IMPORTANT (Semaines 2-4)

**Notifications** :
```typescript
✅ createNotification() crée document Firestore
✅ useNotifications() détecte nouvelles notifications
✅ markAsRead() change isRead → true
✅ markAllAsRead() change toutes notifications
✅ Badge affiche bon compteur unreadCount
```

**Messagerie** :
```typescript
✅ sendMessage() crée message dans conversation
✅ Messages temps réel via onSnapshot
✅ Conversation créée automatiquement si inexistante
✅ Dernier message affiché dans liste conversations
```

**Contrats** :
```typescript
✅ Contrat créé lors acceptation devis
✅ statut='en_cours' par défaut
✅ dateDebut enregistrée
✅ Lien vers devis original préservé
```

#### Tests Niveau 3 : OPTIONNEL (Mois 2+)

**Upload documents** :
```typescript
✅ Upload fichier < 10MB accepté
✅ Upload fichier > 10MB rejeté
✅ Formats PDF/JPG/PNG acceptés
✅ Format .doc rejeté
✅ URL Firebase Storage générée correctement
```

**Disponibilités** :
```typescript
✅ Artisan peut bloquer dates
✅ Dates passées non modifiables
✅ Recherche exclut artisans indisponibles
```

**Admin** :
```typescript
✅ Seul role='admin' accède /admin
✅ Liste artisans pending affichée
✅ Approbation met à jour verificationStatus
✅ Historique uploads accessible
```

### 📅 Planning recommandé (Semaines 1-8)

**Semaine 1 : Configuration + Tests Auth**
```bash
Lundi : Installation Jest + config
Mardi-Mercredi : Tests signUpClient, signUpArtisan, signIn
Jeudi : Tests email vérification
Vendredi : Tests signOut + erreurs
```

**Semaine 2 : Tests Devis (Cœur métier)**
```bash
Lundi-Mardi : Tests createDevis + sendDevis
Mercredi : Tests acceptDevis + création contrat
Jeudi : Tests refuseDevis
Vendredi : Tests incrémentation compteur
```

**Semaine 3 : Tests KBIS + Recherche**
```bash
Lundi-Mardi : Tests OCR parseKbisDocument
Mercredi : Tests comparaison SIRET
Jeudi : Tests searchArtisans
Vendredi : Tests filtres + exclusions
```

**Semaine 4 : Tests E2E (Parcours complets)**
```bash
Lundi : Setup Playwright
Mardi : Test inscription artisan E2E
Mercredi : Test cycle devis complet E2E
Jeudi : Test upload documents E2E
Vendredi : Test recherche + contact E2E
```

**Semaines 5-8 : Tests progressifs**
- Notifications (semaine 5)
- Messagerie (semaine 6)
- Contrats + disponibilités (semaine 7)
- Admin + edge cases (semaine 8)

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

## Scripts de migration Firestore

Le projet utilise **3 patterns de migration distincts** pour gérer l'évolution des données.

### Pattern 1 : Data Normalization (migrate-metiers.ts)

**Objectif** : Normaliser données existantes après changement de contraintes.

**Fichier** : `frontend/scripts/migrate-metiers.ts`

**Use cases** :
- Harmoniser format (accents, casse, structure)
- Convertir types (objet → tableau)
- Dédupliquer valeurs

**Pattern technique** :
```typescript
// 1. Mapping ancien → nouveau
const METIERS_MIGRATION: Record<string, string> = {
  'Électricité': 'electricite',
  'Plomberie': 'plomberie',
  'Menuiserie': 'menuiserie'
};

// 2. Lecture collection complète avec Firebase Admin SDK
const snapshot = await db.collection('artisans').get();

// 3. Pour chaque document
for (const docSnap of snapshot.docs) {
  const metiers = docSnap.data().metiers;
  
  // 4. Normalisation
  const normalizedMetiers = metiersArray
    .map(m => METIERS_MIGRATION[m] || m.toLowerCase())
    .filter((m, i, arr) => arr.indexOf(m) === i); // Dédupliquer
  
  // 5. Comparaison avant/après (évite updates inutiles)
  const needsMigration = JSON.stringify(metiers) !== JSON.stringify(normalizedMetiers);
  
  // 6. Update sélectif
  if (needsMigration) {
    await db.collection('artisans').doc(docSnap.id).update({
      metiers: normalizedMetiers
    });
  }
}
```

**Pourquoi Firebase Admin SDK ?**
- ✅ Bypass security rules Firestore
- ✅ Accès direct en écriture
- ✅ Batch operations performantes

**Exécution** :
```bash
cd frontend/scripts
npx ts-node migrate-metiers.ts
```

**Logs détaillés** :
```
🚀 Démarrage de la migration des métiers...
📊 15 artisan(s) trouvé(s)

👤 Artisan: PLOMBERIE DUPONT
   Métiers actuels: ['Plomberie', 'Électricité']
   ✅ Migration nécessaire
   Avant: ['Plomberie', 'Électricité']
   Après: ['plomberie', 'electricite']
   💾 Sauvegardé dans Firestore

✨ Migration terminée !
   ✅ 12 artisan(s) migré(s)
   ⏭️  3 artisan(s) ignoré(s)
```

---

### Pattern 2 : Cascade Deletion (delete-user-data.js)

**Objectif** : Supprimer TOUTES les données liées à un UID (conformité RGPD).

**Fichier** : `backend/scripts/delete-user-data.js`

**Use cases** :
- Droit à l'effacement utilisateur (RGPD Art. 17)
- Nettoyage données orphelines
- Reset environnement test

**Pattern technique** :
```typescript
// 1. Helper pour suppression par référence
async function deleteCollectionDocs(collection, field, value) {
  const snap = await db.collection(collection)
    .where(field, '==', value)
    .get();
  
  // Batch delete (max 500 docs/batch)
  const batch = db.batch();
  snap.forEach(doc => batch.delete(doc.ref));
  await batch.commit();
  
  console.log(`Supprimé ${snap.size} documents de ${collection}`);
}

// 2. Suppression directe (document ID = UID)
await db.collection('users').doc(UID).delete();
await db.collection('artisans').doc(UID).delete();

// 3. Suppression par références (where clause)
await deleteCollectionDocs('devis', 'clientId', UID);
await deleteCollectionDocs('devis', 'artisanId', UID);
await deleteCollectionDocs('avis', 'clientId', UID);
await deleteCollectionDocs('avis', 'artisanId', UID);
await deleteCollectionDocs('conversations', 'participants', UID);
await deleteCollectionDocs('messages', 'authorId', UID);
await deleteCollectionDocs('contrats', 'clientId', UID);
await deleteCollectionDocs('contrats', 'artisanId', UID);
await deleteCollectionDocs('disponibilites', 'artisanId', UID);
```

**⚠️ ATTENTION** : Ce script supprime **DÉFINITIVEMENT** les données (pas de soft delete).

**Exécution** :
```bash
cd backend/scripts
node delete-user-data.js <UID>
```

**Exemple** :
```bash
node delete-user-data.js abc123xyz456
# Supprimé 5 documents de devis où clientId == abc123xyz456
# Supprimé 2 documents de avis où clientId == abc123xyz456
# Supprimé 3 documents de conversations où participants == abc123xyz456
# Suppression terminée pour UID: abc123xyz456
```

**TODO** : Voir `backend/TODO_SUPPRESSION_CASCADE.md` pour implémenter soft delete.

---

### Pattern 3 : User Creation with Custom Claims (create-admin.js)

**Objectif** : Créer utilisateur Firebase Auth + Firestore avec rôle spécial.

**Fichier** : `scripts/create-admin.js`

**Use cases** :
- Créer premier compte admin (bootstrap)
- Setup rôles spéciaux (modérateur, super-admin)
- Import utilisateurs en masse

**Pattern technique** :
```typescript
const readline = require('readline');

// 1. Interface interactive
const email = await question('📧 Email admin: ');
const password = await question('🔑 Mot de passe: ');

// 2. Créer Firebase Auth user
let userRecord;
try {
  userRecord = await auth.createUser({
    email: email,
    password: password,
    displayName: `${prenom} ${nom}`,
    emailVerified: true // Admin pré-vérifié
  });
} catch (error) {
  // 3. Gérer email déjà existant (idempotence)
  if (error.code === 'auth/email-already-exists') {
    userRecord = await auth.getUserByEmail(email);
    console.log('⚠️  Email existe déjà, mise à jour...');
  } else {
    throw error;
  }
}

// 4. Créer document Firestore avec role spécial
await db.collection('users').doc(userRecord.uid).set({
  uid: userRecord.uid,
  email: email,
  role: 'admin', // ← Role spécial
  nom: nom,
  prenom: prenom,
  telephone: telephone,
  dateCreation: admin.firestore.FieldValue.serverTimestamp(),
  statut: 'verifie',
  actif: true,
  permissions: {
    approveArtisans: true,
    viewReports: true,
    manageUsers: true
  }
});

// 5. (Optionnel) Custom claims pour Firebase Auth
await auth.setCustomUserClaims(userRecord.uid, {
  admin: true
});
```

**Idempotence** : Le script détecte si l'email existe déjà et met à jour au lieu d'échouer.

**Exécution** :
```bash
cd scripts
node create-admin.js
```

**Exemple interactif** :
```
🔧 Initialisation Firebase Admin SDK...

📧 Email admin: admin@artisandispo.fr
🔑 Mot de passe: SuperSecure123!
👤 Nom: Admin
👤 Prénom: ArtisanDispo
📱 Téléphone: +33600000000

⏳ Création du compte admin...
✅ Utilisateur créé dans Firebase Auth
   UID: abc123xyz456
✅ Document Firestore créé
   Collection: users/abc123xyz456
✅ Permissions admin accordées

🎉 Compte admin créé avec succès !
```

**Sécurité** : Utilise Firebase Admin SDK (credentials via FIREBASE_PRIVATE_KEY).

---

### Pattern 4 : Soft Delete (✅ IMPLÉMENTÉ)

**Objectif** : Suppression réversible avec période de rétention (conformité RGPD).

**Fichier** : `frontend/src/lib/firebase/soft-delete.ts`

**Use cases** :
- Suppression compte utilisateur (récupérable 30 jours)
- Exclure documents supprimés des recherches
- Statistiques suppressions (admin)
- Nettoyage automatique après délai

**Pattern technique** :
```typescript
import { softDelete, restoreSoftDeleted, excludeDeleted } from '@/lib/firebase/soft-delete';

// 1. Soft delete (au lieu de deleteDoc())
await softDelete(db, 'artisans', artisanId, adminUid, 'Compte inactif');
// Ajoute: { deleted: true, deletedAt: Timestamp, deletedBy: uid, deletionReason: string }

// 2. Exclure supprimés dans queries
const q = query(
  collection(db, 'artisans'),
  where('metiers', 'array-contains', 'plomberie'),
  excludeDeleted()  // ← Filtre automatique
);

// 3. Alternative : Filtre côté client (évite index composite)
const snapshot = await getDocs(query(...));
const artisans = snapshot.docs
  .map(doc => ({ id: doc.id, ...doc.data() }))
  .filter(isNotDeleted);  // ← Filtre JavaScript

// 4. Admin : Voir documents supprimés
const q = query(collection(db, 'artisans'), onlyDeleted());

// 5. Restaurer
await restoreSoftDeleted(db, 'artisans', artisanId);

// 6. Nettoyage automatique (Cloud Function recommandée)
const deleted = await cleanupExpiredSoftDeleted(db, 'artisans', 30);
// Supprime définitivement docs > 30 jours
```

**Fonctions disponibles** :
- `softDelete()` - Marquer comme supprimé
- `restoreSoftDeleted()` - Annuler suppression
- `permanentDelete()` - Supprimer définitivement (vérifie deleted=true d'abord)
- `batchSoftDelete()` - Soft delete en masse
- `excludeDeleted()` - QueryConstraint pour queries
- `onlyDeleted()` - QueryConstraint pour admin
- `isNotDeleted()` / `isDeleted()` - Filtres client-side
- `cleanupExpiredSoftDeleted()` - Nettoyage automatique
- `getSoftDeleteStats()` - Statistiques détaillées

**Exemple intégration service** :
```typescript
// artisan-service.ts
export async function deleteArtisan(artisanId: string, adminUid: string) {
  // Au lieu de deleteDoc()
  await softDelete(db, 'artisans', artisanId, adminUid, 'Compte suspendu');
}

export async function searchArtisans(metier: string) {
  const q = query(
    collection(db, 'artisans'),
    where('metiers', 'array-contains', metier),
    excludeDeleted()  // ← Exclut automatiquement supprimés
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}
```

**Avantages** :
- ✅ Récupération possible pendant 30 jours
- ✅ Conformité RGPD (droit à l'effacement avec délai)
- ✅ Historique suppressions (qui, quand, pourquoi)
- ✅ Rollback facilité
- ✅ Pas de perte données accidentelle

**Documentation complète** : `frontend/src/lib/firebase/PATTERNS_README.md`

---

### Pattern 5 : Schema Versioning (✅ IMPLÉMENTÉ)

**Objectif** : Gérer l'évolution des structures de données sans casser anciennes versions.

**Fichier** : `frontend/src/lib/firebase/schema-versioning.ts`

**Use cases** :
- Migration progressive sans downtime
- Code défensif gérant plusieurs versions simultanément
- Évolution structure (ajout champs, changement types)
- Rollback facilité si nouvelle version bugge

**Le problème résolu** :
```typescript
// ❌ SANS versioning : Code casse si coordinates absent
const lat = artisan.location.coordinates.lat;  // TypeError!

// ✅ AVEC versioning : Code défensif
if (artisan.schemaVersion === 1) {
  // Ancien format : géocoder l'adresse
  const coords = await geocodeAddress(artisan.location.city);
} else {
  // Nouveau format : coordinates déjà présentes
  const lat = artisan.location.coordinates.lat;  // Safe
}
```

**Pattern technique** :
```typescript
import { createMigrationChain, artisanMigrationChain } from '@/lib/firebase/schema-versioning';

// 1. Définir versions
interface ArtisanV1 {
  schemaVersion: 1;
  location: { city: string; postalCode: string; };
}

interface ArtisanV2 extends ArtisanV1 {
  schemaVersion: 2;
  location: {
    city: string;
    postalCode: string;
    coordinates: { lat: number; lng: number; };  // ← Nouveau
    region: string;  // ← Nouveau
  };
}

// 2. Fonction migration
async function migrateV1toV2(artisan: ArtisanV1, db: Firestore): Promise<ArtisanV2> {
  return {
    ...artisan,
    schemaVersion: 2,
    location: {
      ...artisan.location,
      coordinates: await geocodeAddress(artisan.location.city),
      region: detectRegion(artisan.location.postalCode),
    },
  };
}

// 3. Créer chaîne de migration
const artisanMigration = createMigrationChain<ArtisanV2>([
  { from: 1, to: 2, migrate: migrateV1toV2, description: 'Ajout géolocalisation' }
]);

// 4. Utiliser dans service (migration automatique à la lecture)
export async function getArtisanById(id: string): Promise<ArtisanV2> {
  const docSnap = await getDoc(doc(db, 'artisans', id));
  const artisan = docSnap.data() as ArtisanV1 | ArtisanV2;

  // Migrer si version ancienne
  if (artisanMigration.needsMigration(artisan)) {
    console.log(`🔄 Migration artisan ${id} v1 → v2`);
    
    return await artisanMigration.migrate(artisan, db, {
      persistToFirestore: true,  // Sauvegarder migration
      collectionName: 'artisans',
      documentId: id,
    });
  }

  return artisan as ArtisanV2;
}
```

**Migrations prédéfinies** :

1. **Artisan V1 → V2** (géolocalisation)
```typescript
import { artisanMigrationChain } from '@/lib/firebase/schema-versioning';

const migrated = await artisanMigrationChain.migrate(artisan, db, {
  persistToFirestore: true,
  collectionName: 'artisans',
  documentId: artisanId,
});
// Ajoute : location.coordinates, location.region
```

2. **Devis V1 → V2** (TVA détaillée par prestation)
```typescript
import { devisMigrationChain } from '@/lib/firebase/schema-versioning';

const migrated = await devisMigrationChain.migrate(devis, db, {
  persistToFirestore: true,
  collectionName: 'devis',
  documentId: devisId,
});
// Ajoute : tauxTVA, montantTVA, prixTTC par prestation
```

**Métadonnées migration** :
```typescript
{
  schemaVersion: 2,
  lastMigrationDate: Timestamp("2026-01-26T10:30:00Z"),
  lastMigrationFrom: 1,
  lastMigrationTo: 2,
  migrationHistory: [
    { from: 1, to: 2, date: Timestamp }
  ]
}
```

**Fonctions disponibles** :
- `createMigrationChain()` - Créer chaîne de migrations
- `MigrationChain.migrate()` - Migrer document vers dernière version
- `MigrationChain.needsMigration()` - Vérifier si migration nécessaire
- `isUpToDate()` - Vérifier version document
- `migrateCollection()` - Migration batch de toute une collection

**Exemple migration custom** :
```typescript
// Ajouter photos aux avis
interface AvisV1 { schemaVersion: 1; note: number; commentaire: string; }
interface AvisV2 extends AvisV1 { schemaVersion: 2; photos?: string[]; }

const avisV1toV2: MigrationStep<AvisV1, AvisV2> = {
  from: 1,
  to: 2,
  description: 'Ajout photos',
  migrate: (avis: AvisV1): AvisV2 => ({
    ...avis,
    schemaVersion: 2,
    photos: [],  // Vide par défaut
  }),
};

export const avisMigration = createMigrationChain<AvisV2>([avisV1toV2]);
```

**Avantages** :
- ✅ Migration progressive sans casser production
- ✅ Code défensif gérant plusieurs versions
- ✅ Migration lazy (seulement à la lecture)
- ✅ Rollback facilité si bugs
- ✅ Debug simplifié (version visible)

**Quand utiliser** :
- ✅ Ajout champs obligatoires (anciens docs n'ont pas)
- ✅ Changement structure (objet → tableau)
- ✅ Migration > 100 documents
- ✅ Éviter downtime lors évolutions

**Documentation complète** : `frontend/src/lib/firebase/PATTERNS_README.md`

---

### Pattern 6 : Combinaison Soft Delete + Versioning

**Fichier** : `frontend/src/lib/firebase/pattern-examples.ts`

```typescript
import { ArtisanServiceWithPatterns } from '@/lib/firebase/pattern-examples';

const service = new ArtisanServiceWithPatterns();

// Recherche (gère versions + exclut supprimés)
const artisans = await service.search('plomberie');
// → Migre automatiquement v1→v2 + exclut deleted=true

// Récupération par ID
const artisan = await service.getById(artisanId);
// → null si deleted=true, migre si schemaVersion < 2

// Suppression (soft delete)
await service.delete(artisanId, adminUid, 'Compte inactif');

// Restauration
await service.restore(artisanId);
```

---

### 🧪 Tests des patterns

```bash
# Tester les patterns Soft Delete + Schema Versioning
cd frontend/scripts
npx ts-node test-patterns.ts

# Tests inclus :
# ✅ Soft delete → exclusion → restauration
# ✅ Migration V1 → V2 avec métadonnées
# ✅ Combinaison des deux patterns
```

### 📁 Fichiers créés

```
frontend/src/lib/firebase/
├── soft-delete.ts              # Pattern 4 : Soft Delete (428 lignes)
├── schema-versioning.ts        # Pattern 5 : Schema Versioning (529 lignes)
├── pattern-examples.ts         # Exemples intégration (546 lignes)
└── PATTERNS_README.md          # Documentation complète

frontend/scripts/
└── test-patterns.ts            # Tests automatisés (275 lignes)
```

Total : **~1800 lignes** de code production + documentation

---

### Commandes utiles

```bash
# Normaliser métiers
cd frontend/scripts && npx ts-node migrate-metiers.ts

# Supprimer données utilisateur (RGPD)
cd backend/scripts && node delete-user-data.js <UID>

# Créer admin
cd scripts && node create-admin.js

# Vérifier artisan après migration
cd frontend/scripts && npx ts-node verifier-artisan.ts <UID>

# Tester patterns Soft Delete + Schema Versioning
cd frontend/scripts && npx ts-node test-patterns.ts
```

### Bonnes pratiques migrations

- ✅ **Toujours** utiliser Firebase Admin SDK (bypass security rules)
- ✅ **Toujours** comparer avant/après (éviter updates inutiles)
- ✅ **Toujours** logger progrès (console.log détaillés)
- ✅ **Toujours** gérer erreurs (try/catch + process.exit(1))
- ✅ **Toujours** tester sur petit échantillon d'abord
- ✅ **Toujours** backup Firestore avant migration importante
- ❌ **Jamais** hardcoder credentials (utiliser .env)
- ❌ **Jamais** migrer en production sans test local

## Prochaines étapes (roadmap)

- ⏳ Intégration Stripe (paiement sécurisé + séquestre)
- ⏳ Système avis/notations post-prestation
- ⏳ Mapbox (géolocalisation avancée + rayon recherche)
- ⏳ Messagerie améliorée (pièces jointes, images)
- ⏳ Application mobile React Native

---

## ⚠️ RAPPEL IMPORTANT - Tests à implémenter

**TODO : Implémenter les tests (Voir section "Stratégie de tests" ci-dessus)**

**Action prioritaire** :
1. Installer Jest : `npm install --save-dev jest @testing-library/react @testing-library/jest-dom`
2. Créer premier test : `frontend/src/lib/__tests__/validators.test.ts`
3. Tester validation SIRET (test le plus simple pour démarrer)

**Temps estimé Phase 1** : 4-6 heures pour tests critiques  
**ROI** : Protection contre régressions + confiance déploiement production

**Planning recommandé** :
- Semaine 1 : Tests Auth (signUp, signIn, emailVerification)
- Semaine 2 : Tests Devis (createDevis, acceptDevis, notifications)
- Semaine 3 : Tests KBIS + Recherche
- Semaine 4 : Tests E2E Playwright

**Référence complète** : Voir section "Stratégie de tests" pour détails exhaustifs.
