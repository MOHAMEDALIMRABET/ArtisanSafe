# ⚡ Démarrage Rapide - ArtisanSafe

> Guide express pour démarrer l'application en 5 minutes

## 📋 Prérequis

- ✅ Node.js 18+ installé
- ✅ Git installé
- ✅ Credentials Firebase reçus de l'admin

## 🚀 Installation Express

### Étape 1 : Cloner et vérifier

```bash
git clone https://github.com/MOHAMEDALIMRABET/ArtisanSafe.git
cd ArtisanSafe
node verify-setup.js  # Vérifie la config (échouera, c'est normal)
```

### Étape 2 : Configuration Frontend

```bash
cd frontend
npm install

# Créer le fichier .env.local
# Windows PowerShell :
New-Item -Path .env.local -ItemType File

# macOS/Linux :
touch .env.local
```

Copier dans `frontend/.env.local` :
```env
NEXT_PUBLIC_API_URL=http://localhost:5000/api/v1
NEXT_PUBLIC_FIREBASE_API_KEY=<demander à l'admin>
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=<demander à l'admin>
NEXT_PUBLIC_FIREBASE_PROJECT_ID=<demander à l'admin>
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=<demander à l'admin>
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=<demander à l'admin>
NEXT_PUBLIC_FIREBASE_APP_ID=<demander à l'admin>
```

### Étape 3 : Configuration Backend

```bash
cd ../backend
npm install

# Créer le fichier .env
# Windows PowerShell :
New-Item -Path .env -ItemType File

# macOS/Linux :
touch .env
```

Copier dans `backend/.env` :
```env
PORT=5000
NODE_ENV=development
FIREBASE_PROJECT_ID=<demander à l'admin>
FIREBASE_CLIENT_EMAIL=<demander à l'admin>
FIREBASE_PRIVATE_KEY="<demander à l'admin>"
ALLOWED_ORIGINS=http://localhost:3000
```

### Étape 4 : Vérifier et démarrer

```bash
# Retour à la racine
cd ..

# Vérifier la configuration
node verify-setup.js  # Doit afficher "✅ CONFIGURATION VALIDE"

# Démarrer le frontend (Terminal 1)
cd frontend && npm run dev

# Démarrer le backend (Terminal 2, nouveau terminal)
cd backend && npm run dev
```

### Étape 5 : Tester

1. Ouvrir http://localhost:3000
2. Cliquer sur "Inscription"
3. Créer un compte (client ou artisan)
4. Vérifier dans [Firebase Console](https://console.firebase.google.com/)

## 🎯 Ports utilisés

- **Frontend** : http://localhost:3000
- **Backend** : http://localhost:5000

## ❓ Besoin d'aide ?

- 📖 Guide complet : [INSTALLATION.md](INSTALLATION.md)
- 🔧 Problèmes courants : Voir section "Problèmes courants" dans INSTALLATION.md
- 📧 Contacter l'admin pour les credentials

## ✅ Checklist

- [ ] Node.js 18+ installé
- [ ] Projet cloné
- [ ] `npm install` frontend OK
- [ ] `npm install` backend OK
- [ ] `.env.local` créé avec les bonnes valeurs
- [ ] `.env` créé avec les bonnes valeurs
- [ ] `verify-setup.js` valide la config
- [ ] Frontend démarre sur :3000
- [ ] Backend démarre sur :5000
- [ ] Inscription fonctionne
- [ ] Données visibles dans Firebase

---

**Temps estimé** : 5-10 minutes (hors téléchargement des dépendances)
