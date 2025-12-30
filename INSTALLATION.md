# 🚀 Guide d'Installation - ArtisanSafe

> **Pour les testeurs** : Ce guide vous permet de configurer l'application ArtisanSafe sur votre ordinateur pour tester l'inscription et les fonctionnalités Firebase.

## 📋 Prérequis

Avant de commencer, assurez-vous d'avoir installé :

- ✅ **Node.js 18+** : [Télécharger ici](https://nodejs.org/)
- ✅ **Git** : [Télécharger ici](https://git-scm.com/)
- ✅ **Un éditeur de code** (VS Code recommandé)

Vérifiez les installations :
```bash
node --version  # Doit afficher v18.x.x ou supérieur
npm --version   # Doit afficher 9.x.x ou supérieur
git --version   # Doit afficher 2.x.x ou supérieur
```

## 📥 Étape 1 : Cloner le projet

```bash
# Cloner le repository
git clone https://github.com/MOHAMEDALIMRABET/ArtisanSafe.git

# Accéder au dossier
cd ArtisanSafe
```

## 🔧 Étape 2 : Configuration Frontend

### 2.1 Installer les dépendances

```bash
cd frontend
npm install
```

### 2.2 Configurer les variables d'environnement

Créez un fichier `.env.local` dans le dossier `frontend/` :

```bash
# Windows (PowerShell)
New-Item -Path .env.local -ItemType File

# macOS/Linux
touch .env.local
```

Copiez le contenu suivant dans `frontend/.env.local` :

```env
# ⚠️ IMPORTANT : Remplacer les valeurs par celles fournies par l'administrateur

# URL de l'API Backend
NEXT_PUBLIC_API_URL=http://localhost:5000/api/v1

# Configuration Firebase (Frontend)
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSy...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=artisansafe-xxxxx.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=artisansafe-xxxxx
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=artisansafe-xxxxx.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789012
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789012:web:abcdef123456
```

> **📧 Demandez les vraies valeurs Firebase à l'administrateur du projet !**

### 2.3 Démarrer le frontend

```bash
npm run dev
```

✅ Le frontend devrait démarrer sur **http://localhost:3000**

## 🖥️ Étape 3 : Configuration Backend

### 3.1 Installer les dépendances

Ouvrez un **nouveau terminal** (gardez le frontend en cours) :

```bash
cd backend
npm install
```

### 3.2 Configurer les variables d'environnement

Créez un fichier `.env` dans le dossier `backend/` :

```bash
# Windows (PowerShell)
New-Item -Path .env -ItemType File

# macOS/Linux
touch .env
```

Copiez le contenu suivant dans `backend/.env` :

```env
# Serveur
PORT=5000
NODE_ENV=development

# Firebase Admin SDK
# ⚠️ IMPORTANT : Remplacer par les vraies valeurs
FIREBASE_PROJECT_ID=artisansafe-xxxxx
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@artisansafe-xxxxx.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nVOTRE_CLE_PRIVEE_ICI\n-----END PRIVATE KEY-----\n"

# CORS (autoriser le frontend)
ALLOWED_ORIGINS=http://localhost:3000

# Stripe (optionnel pour les tests)
STRIPE_SECRET_KEY=
STRIPE_PUBLISHABLE_KEY=
```

> **🔑 Récupération de la clé privée Firebase :**
> 
> L'administrateur doit vous fournir le fichier `serviceAccountKey.json`. Voici comment extraire les valeurs :
> 
> 1. Ouvrir `serviceAccountKey.json`
> 2. Copier `project_id` → `FIREBASE_PROJECT_ID`
> 3. Copier `client_email` → `FIREBASE_CLIENT_EMAIL`
> 4. Copier `private_key` → `FIREBASE_PRIVATE_KEY` (⚠️ Garder les `\n` et les guillemets)

### 3.3 Démarrer le backend

```bash
npm run dev
```

✅ Le backend devrait démarrer sur **http://localhost:5000**

## 🧪 Étape 4 : Tester l'inscription

### 4.1 Vérifier que tout fonctionne

1. **Ouvrir le navigateur** : http://localhost:3000
2. **Cliquer sur "Inscription"** (ou accéder à http://localhost:3000/inscription)
3. **Remplir le formulaire** :
   - Email : `test@example.com`
   - Mot de passe : `Test123456!`
   - Prénom : `Jean`
   - Nom : `Dupont`
   - Rôle : **Client** ou **Artisan**

### 4.2 Vérifier dans Firebase Console

1. Accéder à [Firebase Console](https://console.firebase.google.com/)
2. Sélectionner le projet **ArtisanSafe**
3. Aller dans **Authentication** → Vérifier que l'utilisateur est créé
4. Aller dans **Firestore Database** → Vérifier les collections :
   - `users/[uid]` : Données privées de l'utilisateur
   - `artisans/[uid]` : Profil public (si rôle = artisan)

## ❗ Problèmes courants

### Erreur "Firebase API key invalid"

➡️ **Solution :** Vérifiez que les valeurs dans `.env.local` sont correctes

### Erreur "CORS policy"

➡️ **Solution :** Vérifiez que `ALLOWED_ORIGINS` dans `backend/.env` contient `http://localhost:3000`

### Erreur "Failed to connect to backend"

➡️ **Solution :** 
- Vérifier que le backend est démarré sur le port 5000
- Vérifier `NEXT_PUBLIC_API_URL=http://localhost:5000/api/v1` dans `frontend/.env.local`

### Erreur "Firebase Admin SDK initialization failed"

➡️ **Solution :** Vérifiez la clé privée dans `backend/.env` :
- Elle doit être entre guillemets `"`
- Les `\n` doivent être conservés
- Format : `"-----BEGIN PRIVATE KEY-----\n...clé...\n-----END PRIVATE KEY-----\n"`

### Port 3000 ou 5000 déjà utilisé

➡️ **Solution :** 
```bash
# Windows (PowerShell - exécuter en tant qu'administrateur)
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# macOS/Linux
lsof -ti:3000 | xargs kill -9
```

## 📞 Support

Si vous rencontrez des problèmes :

1. **Vérifier les logs** dans les terminaux du frontend et backend
2. **Contacter l'administrateur** avec :
   - Message d'erreur exact
   - Capture d'écran
   - Fichier de logs (si disponible)

## ✅ Checklist de test

- [ ] Frontend démarre sur http://localhost:3000
- [ ] Backend démarre sur http://localhost:5000
- [ ] Page d'inscription accessible
- [ ] Inscription d'un client fonctionne
- [ ] Inscription d'un artisan fonctionne
- [ ] Utilisateur créé dans Firebase Authentication
- [ ] Document créé dans Firestore `users/`
- [ ] Document créé dans Firestore `artisans/` (pour artisan)

## 🔐 Fichiers Firebase à demander à l'administrateur

Pour une installation complète, l'administrateur doit vous fournir :

1. **`serviceAccountKey.json`** (Backend)
   - Contient les credentials Firebase Admin SDK
   - À placer dans `backend/` (⚠️ Ne JAMAIS commit ce fichier)

2. **Valeurs Firebase Frontend** (à copier dans `.env.local`)
   - `NEXT_PUBLIC_FIREBASE_API_KEY`
   - `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
   - `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
   - `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
   - `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
   - `NEXT_PUBLIC_FIREBASE_APP_ID`

---

**📅 Dernière mise à jour :** 29 décembre 2025
