# ArtisanSafe - Instructions Copilot

## Vue d'ensemble du projet

ArtisanSafe est une plateforme marketplace bilingue (français principal, anglais secondaire) qui connecte les clients avec des artisans qualifiés (plombiers, électriciens, menuisiers, maçons, etc.). La plateforme met l'accent sur la sécurité, la confiance et les transactions transparentes grâce à des profils vérifiés, des paiements sécurisés et une médiation des litiges.

## Statut du projet

**Phase actuelle :** Développement MVP - Infrastructure Firebase configurée.

Le projet utilise :
- **Frontend :** Next.js 15 + TypeScript + TailwindCSS ✅
- **Backend :** Node.js + Express + TypeScript ✅
- **Base de données :** Firebase Firestore ✅
- **Authentification :** Firebase Auth ✅
- **Storage :** Firebase Storage (à venir)
- **Intégrations :** Stripe/PayPal, Mapbox (à venir)

## Structure prévue

```
ArtisanSafe/
├── frontend/          # Application client
├── backend/           # API et logique serveur
├── mobile/            # Application mobile (optionnel, phase future)
├── docs/              # Documentation
├── tests/             # Tests unitaires et d'intégration
└── scripts/           # Scripts utilitaires
```

## Approche de développement

### Priorités MVP (Phase 1)
Lors de l'implémentation des fonctionnalités, prioriser dans cet ordre :
1. Inscription/authentification des utilisateurs (double rôle : clients & artisans)
2. Profils artisans avec présentation du portfolio
3. Fonctionnalité de recherche d'artisans de base
4. Système de demande de devis
5. Messagerie simple entre utilisateurs

### Langue & Localisation
- **Langue principale :** Français (tout le texte de l'interface, documentation, contenu de la base de données)
- **Code :** Anglais (variables, fonctions, commentaires, messages de commit)
- Utiliser i18n dès le début pour supporter l'expansion multilingue future
- Garder les clés de traduction descriptives : `artisan.profile.skills` et non `ap.s`

### Focus sur la sécurité et la confiance
La proposition de valeur fondamentale de cette plateforme est la sécurité et la confiance. Lors de l'implémentation :
- **Authentification :** Implémenter une vérification d'identité robuste dès le jour 1
- **Paiements :** Ne jamais manipuler les données brutes de carte ; utiliser exclusivement les SDKs Stripe/PayPal
- **Protection des données :** Hasher les mots de passe (bcrypt min 12 rounds), assainir toutes les entrées
- **Avis :** Assurer l'authenticité des avis (uniquement post-transaction, un par transaction)
- **Téléchargement de fichiers :** Valider les types de fichiers, scanner les malwares, imposer des limites de taille

### Architecture à double utilisateur
Chaque fonctionnalité doit considérer les deux types d'utilisateurs (client vs artisan) :
- Vues et permissions séparées basées sur les rôles
- Les profils artisans sont publics ; les profils clients sont privés
- Les fonctionnalités du tableau de bord diffèrent selon le rôle (artisans : demandes de travail, calendrier ; clients : historique de services, artisans sauvegardés)

### Patterns de conception API
Lors de la construction des APIs backend :
- Conventions RESTful : `/api/v1/artisans`, `/api/v1/quotes`
- Utiliser les méthodes HTTP et codes de statut appropriés
- Paginer les endpoints de liste (par défaut 20 éléments, max 100)
- Filtrage/recherche : `/api/v1/artisans?skills=plomberie&location=Paris&available=true`
- Réponses d'erreur standardisées : `{ "error": { "code": "INVALID_QUOTE", "message": "..." } }`

### Conventions de base de données

**Firebase Firestore** est utilisé pour toutes les données :

#### Collections principales
- **users** : Données privées (clients + artisans) - accès restreint par UID
- **artisans** : Profils publics des artisans - lecture publique
- **devis** : Demandes de devis - accès client/artisan uniquement
- **avis** : Évaluations - lecture publique, création par clients
- **conversations** + **messages** : Messagerie temps réel

#### Bonnes pratiques
- Utiliser les services dans `frontend/src/lib/` :
### Configuration de l'environnement
Variables d'environnement requises :

**Frontend** (`.env.local`) :
```bash
NEXT_PUBLIC_API_URL=http://localhost:5000/api/v1
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...
```

**Backend** (`.env`) :
```bash
PORT=5000
NODE_ENV=development
FIREBASE_PROJECT_ID=...
FIREBASE_CLIENT_EMAIL=...
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----..."
STRIPE_SECRET_KEY=...
MAPBOX_ACCESS_TOKEN=...
```

Voir `docs/FIREBASE.md` pour la configuration complète.uth
JWT_SECRET=...
AUTH_PROVIDER=firebase|auth0

# Payments
STRIPE_SECRET_KEY=...
STRIPE_PUBLISHABLE_KEY=...

# Maps
GOOGLE_MAPS_API_KEY=...

# Storage
AWS_S3_BUCKET=...
AWS_ACCESS_KEY_ID=...
```

## Directives de style de code

### Conventions de nommage
- **Composants :** PascalCase (`ArtisanCard`, `QuoteRequestForm`)
- **Fonctions/Variables :** camelCase (`getUserProfile`, `isAvailable`)
- **Constantes :** UPPER_SNAKE_CASE (`MAX_FILE_SIZE_MB`, `DEFAULT_SEARCH_RADIUS_KM`)
- **Fichiers :** kebab-case (`artisan-profile.tsx`, `quote-service.ts`)

### Termes du domaine en français (utiliser de manière cohérente)
- Artisan (pas "craftsman" ou "tradesperson")
- Devis (quote/estimate)
- Métier (trade/skill: plomberie, électricité, menuiserie, maçonnerie)
- Prestation (service/job)
- Avis (review/rating)

### Structure des composants (Frontend)
```tsx
// Ordre : imports, types, composant, exports
import { useState } from 'react';
import { Button } from '@/components/ui';

interface ArtisanCardProps {
  artisan: Artisan;
  onContact: (id: string) => void;
}

export function ArtisanCard({ artisan, onContact }: ArtisanCardProps) {
  // Logique ici
}
```

### Gestion des erreurs
- Toujours fournir des messages en français conviviaux : "Une erreur s'est produite. Veuillez réessayer."
- Journaliser les détails techniques côté serveur pour le débogage
- Ne jamais exposer les traces de pile ou erreurs internes aux clients

## Workflows clés

### Configuration du développement local
```bash
# Configuration initiale
git clone https://github.com/MOHAMEDALIMRABET/ArtisanSafe.git
cd ArtisanSafe

# Configuration frontend (une fois implémenté)
cd frontend && npm install
cp .env.example .env  # Configurer avec les clés locales
npm run dev  # S'exécute sur http://localhost:3000

# Configuration backend (une fois implémenté)
cd backend && npm install
cp .env.example .env
npm run dev  # S'exécute sur http://localhost:5000
```

### Workflow Git
## Questions à clarifier

1. ✅ **Backend :** Node.js + Express choisi
2. ✅ **Authentification :** Firebase Auth choisi
3. ✅ **Base de données :** Firebase Firestore choisi
4. ⏳ **Storage fichiers :** Firebase Storage (à configurer)
5. ⏳ **Fournisseur de cartes :** Mapbox (à intégrer)
6. ⏳ **Paiements :** Stripe (à intégrer)

Voir `docs/FIREBASE.md` pour la documentation complète Firebase.
4. **Fournisseur de cartes :** Google Maps API ou Mapbox ?
5. **Préférences d'hébergement :** Vercel/Netlify pour le frontend, AWS/Heroku pour le backend ?

Une fois ces choix effectués, mettre à jour ce fichier et créer la structure initiale du projet.
