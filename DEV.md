# 🛠️ ArtisanSafe - Guide de Développement

## 📦 Structure du Projet

```
ArtisanSafe/
├── frontend/              # Application Next.js (TypeScript + TailwindCSS)
│   ├── src/
│   │   ├── app/          # Pages et layouts (App Router)
│   │   ├── components/   # Composants React réutilisables
│   │   ├── lib/          # Utilitaires et API client
│   │   └── types/        # Types TypeScript
│   ├── .env.example      # Variables d'environnement frontend
│   └── package.json
│
├── backend/               # API Express (TypeScript + MongoDB/PostgreSQL)
│   ├── src/
│   │   ├── routes/       # Routes API
│   │   ├── controllers/  # Logique des contrôleurs
│   │   ├── models/       # Schémas de base de données
│   │   ├── services/     # Logique métier
│   │   ├── middleware/   # Middleware Express
│   │   └── types/        # Types TypeScript
│   ├── .env.example      # Variables d'environnement backend
│   └── package.json
│
└── .github/
    └── copilot-instructions.md
```

## 🚀 Installation et Démarrage

### Prérequis

- Node.js 18+ et npm
- Git

### 1. Cloner le repository

```bash
git clone https://github.com/MOHAMEDALIMRABET/ArtisanSafe.git
cd ArtisanSafe
```

### 2. Configuration du Backend

```bash
cd backend

# Installer les dépendances
npm install

# Configurer les variables d'environnement
cp .env.example .env
# Éditer .env avec vos configurations

# Démarrer le serveur de développement
npm run dev
```

Le backend sera disponible sur **http://localhost:5000**

### 3. Configuration du Frontend

```bash
cd frontend

# Installer les dépendances
npm install

# Configurer les variables d'environnement
cp .env.example .env.local
# Éditer .env.local avec vos configurations

# Démarrer le serveur de développement
npm run dev
```

Le frontend sera disponible sur **http://localhost:3000**

## 🛠️ Commandes Disponibles

### Frontend

```bash
npm run dev      # Démarrer en mode développement
npm run build    # Build de production
npm start        # Démarrer le serveur de production
npm run lint     # Linter le code
```

### Backend

```bash
npm run dev      # Démarrer avec nodemon (hot reload)
npm run build    # Compiler TypeScript vers JavaScript
npm start        # Démarrer le serveur compilé
```

## 📝 Variables d'Environnement

### Backend (.env)

```env
PORT=5000
NODE_ENV=development
DATABASE_URL=postgresql://user:password@localhost:5432/artisansafe
MONGODB_URI=mongodb://localhost:27017/artisansafe
JWT_SECRET=your-secret-key
```

### Frontend (.env.local)

```env
NEXT_PUBLIC_API_URL=http://localhost:5000/api/v1
```

## 🎯 Prochaines Étapes de Développement

### Phase 1 - MVP (En cours)

- [ ] **Authentification**
  - Inscription utilisateurs (clients + artisans)
  - Connexion/Déconnexion
  - Protection des routes

- [ ] **Profils Artisans**
  - Formulaire de création de profil
  - Upload de photos portfolio
  - Gestion des métiers et compétences

- [ ] **Recherche d'Artisans**
  - Recherche par métier
  - Filtrage par localisation
  - Affichage des résultats

- [ ] **Système de Devis**
  - Demande de devis par les clients
  - Réponse des artisans
  - Gestion du statut

- [ ] **Messagerie**
  - Chat entre clients et artisans
  - Notifications en temps réel

## 🧪 Tests

```bash
# Frontend
cd frontend
npm test

# Backend
cd backend
npm test
```

## 📚 Technologies Utilisées

### Frontend
- **Framework:** Next.js 15 (App Router)
- **Language:** TypeScript
- **Styling:** TailwindCSS
- **État:** React Context API / Zustand (à venir)

### Backend
- **Runtime:** Node.js
- **Framework:** Express.js
- **Language:** TypeScript
- **Bases de données:** MongoDB (portfolios) + PostgreSQL (transactions)
- **Auth:** JWT (Firebase Auth à venir)

### Services Tiers (À intégrer)
- **Paiements:** Stripe
- **Maps:** Mapbox
- **Storage:** Cloudinary
- **Auth:** Firebase Auth

## 🤝 Contribution

1. Créer une branche: `git checkout -b feature/ma-fonctionnalite`
2. Commit: `git commit -m 'feat: ajout de ma fonctionnalité'`
3. Push: `git push origin feature/ma-fonctionnalite`
4. Créer une Pull Request

## 📄 Licence

MIT - Voir [LICENSE](LICENSE)

## 👨‍💻 Auteur

**MOHAMEDALIMRABET** - [GitHub](https://github.com/MOHAMEDALIMRABET)
