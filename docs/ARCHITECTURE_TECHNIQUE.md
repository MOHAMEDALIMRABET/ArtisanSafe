# Architecture Technique - Artisan Dispo

## 🏗️ Vue d'ensemble

Architecture microservices avec séparation claire des responsabilités :
- **Frontend** : Applications mobiles (React Native/Expo) + Web
- **Backend** : API Gateway REST + microservices Node.js
- **Data Layer** : Firebase Firestore + Redis (cache)

---

## 📱 Couche Présentation

### Applications Clientes

#### App Particulier (Mobile)
- **Technologies :** React Native / Expo (ou web)
- **Communication :** HTTPS / WebSocket
- **Fonctionnalités :**
  - Recherche d'artisans
  - Création de demandes
  - Messagerie temps réel
  - Paiement sécurisé
  - Suivi de chantiers

#### App Artisan (Mobile)
- **Technologies :** React Native / Expo (ou web)
- **Communication :** HTTPS / WebSocket
- **Fonctionnalités :**
  - Gestion agenda/disponibilités
  - Réception demandes qualifiées
  - Création de devis
  - Messagerie
  - Suivi paiements

#### Web App (Desktop)
- **Technologies :** Next.js 15 + TypeScript
- **Fonctionnalités :**
  - Accès complet aux fonctionnalités
  - Back-office administrateur
  - Responsive (mobile-first)

---

## 🔌 API Gateway

### Technologies
- **Framework :** Express.js + TypeScript
- **Port :** 5000
- **Protocoles :**
  - REST (API principale)
  - WebSocket (temps réel)
  - JWT (authentification)

### Responsabilités
- **Routage** : redirection vers microservices
- **Authentification** : validation tokens JWT
- **Rate limiting** : protection anti-spam
- **CORS** : gestion origines autorisées
- **Logs centralisés** : traçabilité requêtes

### Endpoints principaux
```
/api/v1/
  ├── /auth/*              → Auth & Users
  ├── /artisans/*          → Core Marketplace
  ├── /demandes/*          → Core Marketplace
  ├── /devis/*             → Core Marketplace
  ├── /messages/*          → Messaging
  ├── /payments/*          → Payments Service
  ├── /admin/*             → Admin Backoffice
```

---

## 🧩 Microservices

### 1️⃣ Auth & Users
**Responsabilités :**
- Authentification (Firebase Auth + sessions)
- Gestion profils utilisateurs
- Vérification identité
- Gestion rôles (RBAC)

**Technologies :**
- Firebase Auth (authentification)
- Sessions Redis (tokens)
- Bcrypt (hashing mots de passe)

**Endpoints :**
```typescript
POST   /auth/register          // Inscription
POST   /auth/login             // Connexion
POST   /auth/logout            // Déconnexion
GET    /auth/me                // Profil actuel
PUT    /users/:id              // Mise à jour profil
GET    /users/:id/verify       // Statut vérification
```

---

### 2️⃣ Core Marketplace
**Responsabilités :**
- Gestion demandes (jobs/quotes/contracts)
- Matching artisans
- Devis & contrats
- Suivi chantiers

**Sous-modules :**

#### Jobs (Demandes)
```typescript
POST   /demandes               // Créer demande
GET    /demandes/:id           // Détails demande
PUT    /demandes/:id           // Modifier demande
DELETE /demandes/:id           // Annuler demande
GET    /demandes/client/:id    // Demandes client
```

#### Quotes (Devis)
```typescript
POST   /devis                  // Créer devis
GET    /devis/:id              // Détails devis
PUT    /devis/:id              // Modifier devis
POST   /devis/:id/accept       // Accepter devis
POST   /devis/:id/reject       // Refuser devis
GET    /devis/artisan/:id      // Devis artisan
```

#### Contracts (Contrats)
```typescript
POST   /contrats               // Créer contrat
GET    /contrats/:id           // Détails contrat
PUT    /contrats/:id/status    // Changer statut
POST   /contrats/:id/complete  // Terminer chantier
GET    /contrats/history       // Historique
```

---

### 3️⃣ Verification Service
**Responsabilités :**
- Vérification SIRET/KYC artisans
- Validation documents (Kbis)
- Attribution badges vérifiés
- Vérification identité clients

**Intégrations :**
- API SIRET (INSEE)
- API Kbis (Infogreffe)
- Validation téléphone (SMS)
- Validation email

**Endpoints :**
```typescript
POST   /verification/artisan/:id    // Démarrer vérification
GET    /verification/artisan/:id    // Statut vérification
POST   /verification/documents       // Upload documents
PUT    /verification/:id/approve     // Approuver (admin)
PUT    /verification/:id/reject      // Rejeter (admin)
```

---

### 4️⃣ Matching Engine
**Responsabilités :**
- **Algorithme de matching intelligent**
- Calcul disponibilités artisans
- Scoring artisans (géo + score)
- Filtrage et classement

**Algorithme de scoring :**
```typescript
interface MatchingCriteria {
  metier: string;
  localisation: { lat: number; lng: number };
  datesSouhaitees: {
    dateDebut: string;
    dateFin?: string;
    flexible: boolean;
    urgence: 'normal' | 'rapide' | 'urgent';
  };
  budgetMax?: number;
}

interface MatchingScore {
  artisanId: string;
  score: number;
  breakdown: {
    metierMatch: number;      // 0-100
    distanceScore: number;    // 0-50
    disponibiliteScore: number; // 0-50
    notationScore: number;    // 0-50
    urgenceMatch: number;     // 0-20
  };
}

// Formule de scoring
score = (
  (metierMatch ? 100 : 0) +
  (distance < 10km ? 50 : distance < 20km ? 30 : 10) +
  (disponibiliteExacte ? 50 : disponibiliteFlexible ? 30 : 0) +
  (notation * 10) +
  (urgenceMatch ? 20 : 0)
)
```

**Endpoints :**
```typescript
POST   /matching/find          // Trouver artisans
GET    /matching/:demandeId    // Artisans matchés
POST   /matching/score         // Calculer score manuel
```

**Logique de disponibilité :**
```typescript
// Vérification disponibilité artisan
function checkDisponibilite(
  artisanAgenda: Disponibilite[],
  datesSouhaitees: DateRange,
  flexible: boolean
): boolean {
  if (flexible) {
    // Chercher dans période élargie (+/- X jours)
    return hasAnySlotInRange(artisanAgenda, datesSouhaitees, bufferDays);
  } else {
    // Chercher disponibilité exacte
    return hasExactSlot(artisanAgenda, datesSouhaitees);
  }
}
```

---

### 5️⃣ Messaging Service
**Responsabilités :**
- Chat temps réel (artisan ↔ client)
- Partage fichiers (images, PDF)
- Historique conversations
- **Protection coordonnées** (avant contrat validé)

**Technologies :**
- WebSocket (Socket.io)
- Firebase Firestore (persistance)
- Modération contenu (filtrage coordonnées)

**Endpoints :**
```typescript
// REST
GET    /conversations/:userId      // Liste conversations
GET    /conversations/:id/messages // Historique messages
POST   /messages                   // Envoyer message (fallback)

// WebSocket Events
socket.on('message:send', (data) => {})
socket.on('message:received', (data) => {})
socket.on('conversation:typing', (data) => {})
socket.on('conversation:read', (data) => {})
```

**Filtrage coordonnées :**
```typescript
// Regex pour détecter coordonnées
const patterns = {
  phone: /(\+33|0)[1-9](\d{2}){4}/,
  email: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/,
  address: /(rue|avenue|boulevard|chemin)\s+[a-zA-Z0-9\s]+/i
};

// Bloquer si contrat non validé
if (!contratValide && hasCoordonnees(message)) {
  return {
    error: 'Coordonnées non autorisées avant validation du contrat'
  };
}
```

---

### 6️⃣ Notifications Service
**Responsabilités :**
- Emails transactionnels
- Push notifications mobiles
- SMS (optionnel)
- Webhooks (événements)

**Événements déclencheurs :**
- Nouvelle demande (artisan)
- Devis reçu (client)
- Paiement effectué
- Chantier terminé
- Message reçu
- Litige ouvert

**Technologies :**
- Email : SendGrid / Mailgun
- Push : Firebase Cloud Messaging (FCM)
- SMS : Twilio (optionnel MVP)

**Endpoints :**
```typescript
POST   /notifications/send      // Envoyer notification
GET    /notifications/:userId   // Historique notifications
PUT    /notifications/:id/read  // Marquer comme lu
PUT    /users/:id/preferences   // Préférences notifs
```

---

### 7️⃣ Payments Service
**Responsabilités :**
- Paiement sécurisé (Stripe)
- **Escrow (séquestre)** argent bloqué
- Calcul commission 8%
- Libération paiement artisan
- Remboursements

**Technologies :**
- Stripe Connect (marketplace payments)
- Webhooks Stripe (événements paiement)

**Flow de paiement :**
```
1. Client paie contrat
   ↓
2. Argent bloqué (escrow) sur Stripe
   ↓
3. Artisan termine chantier
   ↓
4. Client valide (ou délai 7j)
   ↓
5. Commission 8% prélevée
   ↓
6. Artisan reçoit 92% du montant
```

**Endpoints :**
```typescript
POST   /payments/intent         // Créer PaymentIntent
POST   /payments/confirm        // Confirmer paiement
POST   /payments/release        // Libérer paiement artisan
POST   /payments/refund         // Rembourser client
GET    /payments/history/:userId // Historique paiements
POST   /webhooks/stripe         // Webhooks Stripe
```

**Gestion commission :**
```typescript
interface PaiementDetails {
  montantTTC: number;        // 1500€
  commissionRate: number;    // 0.08 (8%)
  commission: number;        // 120€
  montantArtisan: number;    // 1380€
  fraisStripe: number;       // ~1.4% + 0.25€
}

// Calcul automatique
const commission = montantTTC * 0.08;
const montantArtisan = montantTTC - commission;
```

---

### 8️⃣ Admin Backoffice
**Responsabilités :**
- Validation artisans
- Gestion litiges
- Statistiques plateforme
- Modération avis
- Suspension comptes

**Dashboard Admin :**
- **Utilisateurs** : stats, validations en attente
- **Transactions** : volume, commissions
- **Litiges** : queue de médiation
- **Avis** : modération, signalements
- **Stats globales** : KPIs, graphiques

**Endpoints :**
```typescript
// Validation artisans
GET    /admin/artisans/pending     // Artisans en attente
PUT    /admin/artisans/:id/approve // Approuver
PUT    /admin/artisans/:id/reject  // Rejeter

// Gestion litiges
GET    /admin/litiges              // Liste litiges
PUT    /admin/litiges/:id/resolve  // Résoudre litige
POST   /admin/litiges/:id/decision // Décision arbitrage

// Stats
GET    /admin/stats/overview       // Vue d'ensemble
GET    /admin/stats/transactions   // Volume transactions
GET    /admin/stats/users          // Utilisateurs actifs
GET    /admin/stats/commissions    // Commissions générées

// Modération
GET    /admin/avis/reported        // Avis signalés
PUT    /admin/avis/:id/moderate    // Modérer avis
PUT    /admin/users/:id/suspend    // Suspendre compte
```

---

## 💾 Data Layer (100% Firebase pour MVP)

### ✅ Stack de stockage MVP
Toute la donnée et le stockage restent sur **Firebase** :
- **Firebase Firestore** : Base de données NoSQL temps réel
- **Firebase Storage** : Stockage fichiers (images, PDF)
- **Firebase Auth** : Authentification utilisateurs
- **Firebase Functions** : Backend serverless (optionnel)

**👉 Pas d'AWS, pas de Redis pour le MVP - Stack 100% Firebase**

### Firebase Firestore
**Choix technique :** Base NoSQL documentaire, temps réel, scalable

#### Collections principales

##### `users`
```typescript
{
  uid: string;
  email: string;
  role: 'client' | 'artisan' | 'admin';
  nom: string;
  prenom: string;
  telephone: string;
  adresse?: {
    rue: string;
    ville: string;
    codePostal: string;
    latitude: number;
    longitude: number;
  };
  dateCreation: Timestamp;
  statut: 'non_verifie' | 'verifie' | 'suspendu';
  preferencesNotifications: {
    email: boolean;
    push: boolean;
    sms: boolean;
  };
}
```

##### `artisans`
```typescript
{
  userId: string;
  siret: string;
  raisonSociale: string;
  formeJuridique: 'auto_entrepreneur' | 'eurl' | 'sarl' | 'sas';
  metiers: string[]; // ['plomberie', 'electricite']
  zonesIntervention: {
    ville: string;
    rayon: number; // km
    latitude: number;
    longitude: number;
  }[];
  disponibilites: {
    date: string; // YYYY-MM-DD
    disponible: boolean;
    capacite: number; // 1 chantier par jour
  }[];
  tarifHoraire?: number;
  notation: number; // 0-5
  nombreAvis: number;
  documentsVerifies: boolean;
  badgeVerifie: boolean;
  dateVerification?: Timestamp;
  compteBancaire?: {
    stripeAccountId: string; // Stripe Connect
  };
}
```

##### `demandes`
```typescript
{
  id: string;
  clientId: string;
  categorie: 'plomberie' | 'electricite' | 'peinture' | 'menuiserie' | 'maconnerie' | 'autre';
  titre: string;
  description: string;
  localisation: {
    adresse: string;
    ville: string;
    codePostal: string;
    latitude: number;
    longitude: number;
  };
  datesSouhaitees: {
    dateDebut: string;
    dateFin?: string;
    flexible: boolean;
    flexibiliteDays?: number; // +/- X jours
    urgence: 'normal' | 'rapide' | 'urgent';
  };
  budgetIndicatif?: number;
  photos: string[]; // URLs Firebase Storage
  statut: 'brouillon' | 'publiee' | 'matchee' | 'en_cours' | 'terminee' | 'annulee';
  artisansMatches?: string[]; // IDs artisans matchés
  devisRecus?: number;
  dateCreation: Timestamp;
  dateModification: Timestamp;
}
```

##### `devis`
```typescript
{
  id: string;
  demandeId: string;
  artisanId: string;
  clientId: string;
  montantHT: number;
  montantTVA: number;
  montantTTC: number;
  description: string;
  detailsTravaux: string;
  delaiRealisation: number; // jours
  validiteDevis: number; // jours (30 par défaut)
  conditions?: string;
  statut: 'brouillon' | 'envoye' | 'accepte' | 'refuse' | 'expire';
  dateCreation: Timestamp;
  dateEnvoi?: Timestamp;
  dateValidation?: Timestamp;
  version: number; // Historique versions
}
```

##### `contrats`
```typescript
{
  id: string;
  devisId: string;
  artisanId: string;
  clientId: string;
  montantTTC: number;
  commission: number; // 8% = montantTTC * 0.08
  montantArtisan: number; // montantTTC - commission
  dateDebut: string;
  dateFinEstimee: string;
  dateFinReelle?: string;
  statut: 'signe' | 'en_cours' | 'termine' | 'annule' | 'litige';
  paiementStatut: 'attente' | 'paye' | 'bloque_escrow' | 'libere' | 'rembourse';
  paiementId?: string; // Stripe PaymentIntent ID
  conditionsGenerales: string;
  signatureClient: {
    date: Timestamp;
    ip: string;
  };
  signatureArtisan: {
    date: Timestamp;
    ip: string;
  };
  dateCreation: Timestamp;
  dateSignature: Timestamp;
}
```

##### `conversations`
```typescript
{
  id: string;
  participants: string[]; // [clientId, artisanId]
  demandeId?: string;
  contratId?: string;
  dernierMessage: {
    contenu: string;
    senderId: string;
    date: Timestamp;
  };
  contratValide: boolean; // Coordonnées autorisées si true
  dateCreation: Timestamp;
  dateModification: Timestamp;
}
```

##### `messages`
```typescript
{
  id: string;
  conversationId: string;
  senderId: string;
  receiverId: string;
  contenu: string;
  type: 'texte' | 'document' | 'image';
  fichierUrl?: string;
  fichierNom?: string;
  lu: boolean;
  modere: boolean; // true si contient coordonnées filtrées
  dateEnvoi: Timestamp;
  dateLecture?: Timestamp;
}
```

##### `avis`
```typescript
{
  id: string;
  contratId: string;
  artisanId: string;
  clientId: string;
  note: number; // 1-5
  commentaire: string;
  points_forts?: string[]; // ['ponctuel', 'soigneux', 'rapide']
  points_amelioration?: string[];
  photos?: string[]; // Photos résultat
  reponseArtisan?: {
    contenu: string;
    date: Timestamp;
  };
  dateCreation: Timestamp;
  modere: boolean;
  signale: boolean;
  visible: boolean;
}
```

##### `litiges`
```typescript
{
  id: string;
  contratId: string;
  declarantId: string;
  declarantRole: 'client' | 'artisan';
  motif: 'non_conformite' | 'retard' | 'abandon' | 'qualite' | 'paiement' | 'autre';
  description: string;
  preuves: string[]; // URLs photos/documents
  statut: 'ouvert' | 'en_mediation' | 'resolu' | 'clos';
  adminId?: string; // Admin en charge
  echanges: {
    auteurId: string;
    message: string;
    date: Timestamp;
  }[];
  decision?: {
    type: 'paiement_artisan' | 'remboursement_client' | 'partage';
    montantArtisan: number;
    montantClient: number;
    justification: string;
    dateDecision: Timestamp;
  };
  paiementBloque: boolean;
  dateCreation: Timestamp;
  dateResolution?: Timestamp;
}
```

##### `notifications`
```typescript
{
  id: string;
  userId: string;
  type: 'nouvelle_demande' | 'devis_recu' | 'paiement' | 'message' | 'avis' | 'litige';
  titre: string;
  contenu: string;
  lien?: string; // Deep link vers l'élément concerné
  lu: boolean;
  dateCreation: Timestamp;
  dateLecture?: Timestamp;
}
```

##### `transactions`
```typescript
{
  id: string;
  contratId: string;
  artisanId: string;
  clientId: string;
  type: 'paiement' | 'remboursement' | 'commission';
  montant: number;
  commission: number;
  statut: 'pending' | 'succeeded' | 'failed' | 'refunded';
  stripePaymentIntentId: string;
  stripeChargeId?: string;
  metadata: {
    description: string;
    [key: string]: any;
  };
  dateCreation: Timestamp;
  dateCompletion?: Timestamp;
}
```

---

### Redis (Cache & Rate Limiting) - ⚠️ PHASE 2
**Note :** Redis sera intégré en Phase 2 pour optimisation. MVP fonctionne 100% Firebase.

**Usage futur :**
- Cache données fréquentes
- Sessions tokens
- Rate limiting avancé
- Queues asynchrones

---

### Firebase Storage
**Structure fichiers :**
```
/users/{userId}/
  /profil/
    avatar.jpg
  /documents/
    siret.pdf
    kbis.pdf
    assurance.pdf

/demandes/{demandeId}/
  /photos/
    photo1.jpg
    photo2.jpg
    photo3.jpg

/litiges/{litigeId}/
  /preuves/
    preuve1.jpg
    preuve2.jpg

/contrats/{contratId}/
  /documents/
    devis_signe.pdf
    contrat_signe.pdf
    facture.pdf

/messages/{conversationId}/
  /fichiers/
    document.pdf
    image.jpg
```

**👉 Firebase Storage reste l'outil actuel (pas de changement)**

---

## 🔐 Sécurité & Conformité

### Authentification
- **Firebase Auth** : gestion identités
- **JWT tokens** : authentification API
- **Sessions Redis** : tokens actifs
- **Refresh tokens** : renouvellement automatique

### Protection données
- **RGPD** : consentement, export, suppression
- **Chiffrement** : TLS/SSL (HTTPS)
- **Données sensibles** : chiffrement AES-256 (SIRET, IBAN)
- **Logs audit** : traçabilité complète

### Rate Limiting
```typescript
// Limites par endpoint
const limits = {
  '/auth/login': { max: 5, window: '15m' },
  '/demandes': { max: 10, window: '1h' },
  '/messages': { max: 100, window: '15m' },
  default: { max: 100, window: '15m' }
};
```

### Validation inputs
- **Sanitization** : protection XSS
- **Validation Joi/Zod** : schémas stricts
- **File upload** : types autorisés, scan malware
- **SQL/NoSQL injection** : requêtes paramétrées

---

## 🔄 PSP Marketplace Provider (Stripe)

### Stripe Connect
**Architecture :**
- **Platform account** : Artisan Dispo (commission 8%)
- **Connected accounts** : Artisans individuels
- **Payment flow** : Client → Platform → Artisan

### Flow paiement complet
```
1. Artisan crée compte Stripe Connect
   ↓
2. Client paie via Stripe Checkout
   ↓
3. Platform reçoit paiement (escrow)
   ↓
4. Commission 8% prélevée automatiquement
   ↓
5. Artisan termine chantier
   ↓
6. Client valide (ou délai 7j expire)
   ↓
7. Paiement libéré → compte artisan
```

### Webhooks Stripe
```typescript
// Événements écoutés
const stripeEvents = [
  'payment_intent.succeeded',
  'payment_intent.payment_failed',
  'charge.refunded',
  'account.updated',           // Artisan vérifié
  'payout.paid',               // Artisan payé
  'payout.failed'
];

// Handler webhook
POST /webhooks/stripe
{
  type: 'payment_intent.succeeded',
  data: {
    object: {
      id: 'pi_xxx',
      amount: 150000, // 1500€ en centimes
      metadata: {
        contratId: 'xxx',
        artisanId: 'xxx',
        clientId: 'xxx'
      }
    }
  }
}
```

---

## 📊 Performance & Scalabilité

### Optimisations (MVP Firebase)
- **Cache Firestore** : persistence automatique offline
- **CDN Firebase** : assets statiques automatique
- **Lazy loading** : pagination résultats (limit/offset)
- **Compression** : Gzip automatique Firebase
- **Database indexing** : index composites Firestore

### Optimisations (Phase 2)
- Redis cache externe
- CDN Cloudflare
- APM monitoring

### Monitoring (MVP)
- **Firebase Console** : Analytics intégré
- **Logs** : Firebase Functions logs
- **Crashlytics** : Erreurs mobile (Firebase)

### Monitoring (Phase 2)
- APM : New Relic / Datadog
- Logs centralisés : CloudWatch / LogRocket
- Métriques avancées

### Scalabilité (MVP Firebase)
- **Auto-scaling Firebase** : géré automatiquement par Google
- **Firestore** : scalabilité horizontale native
- **Firebase Functions** : scaling automatique
- **Firebase Storage** : CDN global intégré

### Scalabilité (Phase 2 - Si besoin)
- Backend séparé (Node.js standalone)
- Load balancing Nginx / AWS ALB
- Microservices déployés séparément

---

## 🚀 Déploiement (MVP - 100% Firebase)

### Stack MVP recommandée
1. **Frontend** : Vercel (Next.js) ✅
2. **Backend API** : Vercel Serverless Functions OU Firebase Functions
3. **Database** : Firebase Firestore ✅
4. **Storage** : Firebase Storage ✅
5. **Auth** : Firebase Auth ✅
6. **Paiements** : Stripe (externe) ✅

**👉 Aucun serveur à gérer, scaling automatique, coûts optimisés**

### Environnements
- **Development** : local (localhost:3000 / 5000)
- **Staging** : tests pré-production
- **Production** : plateforme live

### Infrastructure (MVP - 100% Firebase)
- **Frontend** : Vercel (Next.js) ou Firebase Hosting
- **Backend** : Firebase Functions ou Vercel Serverless
- **Database** : Firebase Firestore ✅
- **Storage** : Firebase Storage ✅
- **Auth** : Firebase Auth ✅
- **CDN** : Firebase CDN intégré
- **CI/CD** : GitHub Actions

### Infrastructure (Phase 2 - Optimisation)
- Backend : AWS EC2 / Heroku (si besoin scaling)
- Cache : Redis Cloud / AWS ElastiCache
- Monitoring : New Relic / Datadog

### Variables d'environnement (MVP Firebase)
```bash
# Backend (.env)
NODE_ENV=production
PORT=5000

# Firebase (TOUT le stockage)
FIREBASE_PROJECT_ID=artisansafe
FIREBASE_PRIVATE_KEY=...
FIREBASE_CLIENT_EMAIL=...
FIREBASE_STORAGE_BUCKET=artisansafe.appspot.com

# Stripe (Paiements)
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# CORS
ALLOWED_ORIGINS=https://artisandispo.fr
```

### Variables supplémentaires (Phase 2)
```bash
# Redis (cache) - Phase 2 uniquement
REDIS_URL=redis://...

# AWS (si migration partielle) - Phase 2 uniquement
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_S3_BUCKET=...
```

---

## 📱 Architecture Mobile (React Native)

### Structure apps
```
/apps/
  /particulier/
    /src/
      /screens/      # Écrans
      /components/   # Composants UI
      /services/     # API calls
      /store/        # State management (Redux/Zustand)
      /navigation/   # React Navigation
  
  /artisan/
    # Même structure
```

### Technologies
- **Framework** : React Native + Expo
- **Navigation** : React Navigation
- **State** : Redux Toolkit / Zustand
- **API** : Axios + React Query
- **Temps réel** : Socket.io client
- **Push** : Expo Notifications + FCM

---

## 🎯 Prochaines étapes techniques (MVP Firebase)

### Phase 2 - Développement Core (Semaines 3-4)
1. ⏳ Implémenter services Firebase (demandes, devis, contrats)
2. ⏳ Développer Matching Engine (algorithme scoring)
3. ⏳ Créer collections Firestore avec règles sécurité
4. ⏳ Implémenter recherche artisans (geo-queries)

### Phase 3 - Intégrations (Semaines 5-6)
1. ⏳ Intégration Stripe Connect (paiements + escrow)
2. ⏳ Messagerie temps réel (Firestore subcollections)
3. ⏳ Notifications (Firebase Cloud Messaging)
4. ⏳ Upload fichiers Firebase Storage

### Phase 4 - Production (Semaines 7-8)
1. ⏳ Admin backoffice (Firebase Admin SDK)
2. ⏳ Système litiges
3. ⏳ Tests end-to-end
4. ⏳ Déploiement production (Vercel + Firebase)

### Phase 5 - Optimisation (Post-MVP, si besoin)
1. ⏳ Intégration Redis (cache)
2. ⏳ Migration backend vers serveur dédié
3. ⏳ CDN Cloudflare
4. ⏳ Monitoring avancé (Datadog)

---

**📌 Document créé le 26/12/2025**
**Version 1.0 - Architecture technique détaillée**
