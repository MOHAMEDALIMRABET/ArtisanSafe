# 📧 Template Email - Envoi des Credentials

## Pour l'administrateur

Copiez ce template et remplacez les valeurs `<XXX>` par les vraies credentials Firebase.

---

**Objet :** ArtisanSafe - Credentials de test

---

Bonjour [Nom du testeur],

Voici les credentials pour tester l'application **ArtisanSafe** localement.

## 📚 Documentation

- **Guide d'installation complet** : `INSTALLATION.md`
- **Démarrage rapide (5 min)** : `QUICKSTART.md`

## 🔑 Credentials à copier

### 1️⃣ Frontend - Fichier `frontend/.env.local`

```env
NEXT_PUBLIC_API_URL=http://localhost:5000/api/v1

NEXT_PUBLIC_FIREBASE_API_KEY=<VOTRE_API_KEY>
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=<VOTRE_PROJECT_ID>.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=<VOTRE_PROJECT_ID>
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=<VOTRE_PROJECT_ID>.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=<VOTRE_SENDER_ID>
NEXT_PUBLIC_FIREBASE_APP_ID=<VOTRE_APP_ID>
```

### 2️⃣ Backend - Fichier `backend/.env`

```env
PORT=5000
NODE_ENV=development

FIREBASE_PROJECT_ID=<VOTRE_PROJECT_ID>
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@<VOTRE_PROJECT_ID>.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n<VOTRE_CLE_PRIVEE>\n-----END PRIVATE KEY-----\n"

ALLOWED_ORIGINS=http://localhost:3000
```

⚠️ **ATTENTION pour `FIREBASE_PRIVATE_KEY` :**
- Conserver les guillemets `"`
- Conserver tous les `\n`
- Format : `"-----BEGIN PRIVATE KEY-----\n...clé...\n-----END PRIVATE KEY-----\n"`

## 🚀 Étapes d'installation

```bash
# 1. Cloner le projet
git clone https://github.com/MOHAMEDALIMRABET/ArtisanSafe.git
cd ArtisanSafe

# 2. Suivre le guide
Ouvrir le fichier QUICKSTART.md et suivre les étapes

# 3. Vérifier la configuration
node verify-setup.js

# 4. Démarrer l'app
# Terminal 1 : cd frontend && npm run dev
# Terminal 2 : cd backend && npm run dev
```

## 🧪 Test d'inscription

1. Ouvrir http://localhost:3000
2. Aller sur "Inscription"
3. Créer un compte (client ou artisan)
4. Vérifier les données dans [Firebase Console](https://console.firebase.google.com/)

## 🔒 Sécurité

- ❌ **NE JAMAIS** commit les fichiers `.env` ou `.env.local`
- ❌ **NE JAMAIS** partager ces credentials publiquement
- ✅ Les fichiers sont déjà dans `.gitignore`

## 📞 Besoin d'aide ?

Si tu rencontres des problèmes :
1. Consulter la section "Problèmes courants" dans `INSTALLATION.md`
2. M'envoyer :
   - Capture d'écran de l'erreur
   - Logs du terminal (frontend et backend)
   - Contenu des fichiers .env (masquer la clé privée !)

Bon test ! 🚀

Cordialement,
[Votre nom]

---

**📌 Raccourcis utiles :**
- Frontend : http://localhost:3000
- Backend : http://localhost:5000
- Firebase Console : https://console.firebase.google.com/
- GitHub : https://github.com/MOHAMEDALIMRABET/ArtisanSafe

---

## 📝 Pour l'administrateur : Où trouver les valeurs ?

### Frontend (Firebase Web SDK)

1. Firebase Console → Projet ArtisanSafe
2. ⚙️ Paramètres du projet
3. Section "Vos applications" → SDK
4. Copier les valeurs de `firebaseConfig`

### Backend (Firebase Admin SDK)

1. Firebase Console → Projet ArtisanSafe
2. ⚙️ Paramètres du projet → Comptes de service
3. Cliquer "Générer une nouvelle clé privée"
4. Télécharger `serviceAccountKey.json`
5. Extraire les valeurs :
   - `project_id` → `FIREBASE_PROJECT_ID`
   - `client_email` → `FIREBASE_CLIENT_EMAIL`
   - `private_key` → `FIREBASE_PRIVATE_KEY` (garder les `\n`)

---
