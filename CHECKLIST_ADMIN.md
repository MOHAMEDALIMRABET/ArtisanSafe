# 📦 Checklist Complète - Préparation pour les Testeurs

> **Pour l'administrateur** : Tout ce que vous devez faire avant de partager le projet avec un testeur.

## ✅ Phase 1 : Préparation du projet (FAIT ✓)

- [x] Fichiers de documentation créés :
  - [x] `INSTALLATION.md` - Guide complet d'installation
  - [x] `QUICKSTART.md` - Démarrage rapide (5 min)
  - [x] `docs/FIREBASE_CREDENTIALS_GUIDE.md` - Comment récupérer les credentials
  - [x] `docs/EMAIL_TEMPLATE_CREDENTIALS.md` - Template d'email pré-rempli
  - [x] `docs/ADMIN_CREDENTIALS_SHARING.md` - Instructions pour l'admin

- [x] Fichiers de configuration :
  - [x] `frontend/.env.example` - Template frontend
  - [x] `backend/.env.example` - Template backend
  - [x] `.gitignore` mis à jour (protection credentials)

- [x] Scripts de vérification :
  - [x] `verify-setup.js` - Vérification Node.js
  - [x] `verify-setup.ps1` - Vérification PowerShell (Windows)

- [x] README mis à jour avec lien vers INSTALLATION.md

## 🔑 Phase 2 : Récupération des Credentials Firebase

### Étape 1 : Credentials Frontend (5 min)

📖 Suivre : [docs/FIREBASE_CREDENTIALS_GUIDE.md](FIREBASE_CREDENTIALS_GUIDE.md#1️⃣-credentials-frontend-firebase-web-sdk)

1. [ ] Aller sur https://console.firebase.google.com/
2. [ ] Sélectionner le projet **ArtisanSafe**
3. [ ] ⚙️ Paramètres du projet → Vos applications → Web
4. [ ] Copier les 6 valeurs :
   - [ ] `apiKey` → `NEXT_PUBLIC_FIREBASE_API_KEY`
   - [ ] `authDomain` → `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
   - [ ] `projectId` → `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
   - [ ] `storageBucket` → `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
   - [ ] `messagingSenderId` → `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
   - [ ] `appId` → `NEXT_PUBLIC_FIREBASE_APP_ID`

### Étape 2 : Credentials Backend (5 min)

📖 Suivre : [docs/FIREBASE_CREDENTIALS_GUIDE.md](FIREBASE_CREDENTIALS_GUIDE.md#2️⃣-credentials-backend-firebase-admin-sdk)

1. [ ] Firebase Console → ⚙️ Paramètres → Comptes de service
2. [ ] Cliquer "Générer une nouvelle clé privée"
3. [ ] Télécharger `serviceAccountKey.json`
4. [ ] Extraire les 3 valeurs :
   - [ ] `project_id` → `FIREBASE_PROJECT_ID`
   - [ ] `client_email` → `FIREBASE_CLIENT_EMAIL`
   - [ ] `private_key` → `FIREBASE_PRIVATE_KEY` (⚠️ garder les `\n`)

## 📧 Phase 3 : Envoi au Testeur

### Option A : Email avec credentials intégrés

📖 Utiliser : [docs/EMAIL_TEMPLATE_CREDENTIALS.md](EMAIL_TEMPLATE_CREDENTIALS.md)

1. [ ] Copier le template d'email
2. [ ] Remplacer `<VOTRE_XXX>` par les vraies valeurs
3. [ ] Vérifier que `FIREBASE_PRIVATE_KEY` contient les `\n` et guillemets
4. [ ] Envoyer par email sécurisé (ProtonMail, email chiffré, etc.)

### Option B : Fichier JSON + Instructions

1. [ ] Envoyer `serviceAccountKey.json` via canal sécurisé
2. [ ] Envoyer les credentials frontend par email
3. [ ] Référencer `INSTALLATION.md` pour les instructions

## 🧪 Phase 4 : Vérification avec le Testeur

### Communication initiale

1. [ ] Confirmer que le testeur a :
   - [ ] Node.js 18+ installé (`node --version`)
   - [ ] Git installé (`git --version`)
   - [ ] Accès au repository GitHub
   - [ ] Reçu les credentials

### Instructions à donner

```bash
# 1. Cloner le projet
git clone https://github.com/MOHAMEDALIMRABET/ArtisanSafe.git
cd ArtisanSafe

# 2. Suivre QUICKSTART.md (5 minutes)
# Créer les fichiers .env avec les credentials fournis

# 3. Vérifier la configuration
node verify-setup.js

# 4. Installer et démarrer
# Terminal 1
cd frontend && npm install && npm run dev

# Terminal 2
cd backend && npm install && npm run dev
```

### Checklist de test à demander

Demander au testeur de confirmer :

- [ ] ✅ Frontend démarre sur http://localhost:3000
- [ ] ✅ Backend démarre sur http://localhost:5000
- [ ] ✅ Page d'accueil s'affiche correctement
- [ ] ✅ Page d'inscription accessible
- [ ] ✅ Inscription d'un **client** fonctionne
- [ ] ✅ Inscription d'un **artisan** fonctionne
- [ ] ✅ Données visibles dans Firebase Console → Authentication
- [ ] ✅ Données visibles dans Firebase Console → Firestore (`users/`)
- [ ] ✅ Données visibles dans Firebase Console → Firestore (`artisans/`) pour artisan

## 🐛 Problèmes Courants et Solutions

### Erreur : "Firebase API key invalid"

**Cause :** Mauvaise valeur `NEXT_PUBLIC_FIREBASE_API_KEY`

**Solution :**
1. Vérifier la valeur dans Firebase Console
2. Pas d'espaces avant/après le `=` dans `.env.local`
3. Redémarrer le frontend : `Ctrl+C` puis `npm run dev`

---

### Erreur : "CORS policy"

**Cause :** `ALLOWED_ORIGINS` mal configuré dans `backend/.env`

**Solution :**
```env
ALLOWED_ORIGINS=http://localhost:3000
```

---

### Erreur : "Failed to connect to backend"

**Cause :** Backend pas démarré ou port différent

**Solution :**
1. Vérifier que le backend tourne : http://localhost:5000
2. Vérifier `NEXT_PUBLIC_API_URL=http://localhost:5000/api/v1`

---

### Erreur : "Firebase Admin SDK initialization failed"

**Cause :** Clé privée mal formatée

**Solution :**
Vérifier dans `backend/.env` :
- ✅ Guillemets doubles autour de la clé : `"-----BEGIN..."`
- ✅ `\n` présents (pas de vrais retours à la ligne)
- ✅ Commence par `"-----BEGIN PRIVATE KEY-----\n`
- ✅ Se termine par `\n-----END PRIVATE KEY-----\n"`

**Exemple correct :**
```env
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvQI...\n-----END PRIVATE KEY-----\n"
```

---

## 📊 Suivi des Testeurs

Créez un tableau pour suivre vos testeurs :

| Nom | Email | Credentials envoyés | Config OK | Tests OK | Notes |
|-----|-------|-------------------|-----------|----------|-------|
| Jean Dupont | jean@... | ✅ 25/12/2025 | ✅ | ✅ | RAS |
| Marie Martin | marie@... | ✅ 26/12/2025 | ⏳ | ❌ | Erreur CORS |

---

## 🔒 Après les Tests

### Révoquer les accès (si nécessaire)

Si vous voulez révoquer l'accès après les tests :

1. [ ] Firebase Console → IAM & Admin → Comptes de service
2. [ ] Supprimer les clés générées
3. [ ] Générer de nouvelles clés pour la production

### Collecter les Retours

Demander au testeur :
- [ ] Capture d'écran de l'inscription réussie
- [ ] Bugs rencontrés (avec captures d'écran)
- [ ] Suggestions d'amélioration
- [ ] Temps total d'installation (pour améliorer la doc)

---

## 📚 Ressources Utiles

**Pour l'administrateur :**
- [docs/FIREBASE_CREDENTIALS_GUIDE.md](docs/FIREBASE_CREDENTIALS_GUIDE.md) - Récupérer les credentials
- [docs/ADMIN_CREDENTIALS_SHARING.md](docs/ADMIN_CREDENTIALS_SHARING.md) - Bonnes pratiques
- [docs/EMAIL_TEMPLATE_CREDENTIALS.md](docs/EMAIL_TEMPLATE_CREDENTIALS.md) - Template email

**Pour le testeur :**
- [INSTALLATION.md](INSTALLATION.md) - Guide complet (15-20 min)
- [QUICKSTART.md](QUICKSTART.md) - Démarrage rapide (5 min)
- [README.md](README.md) - Vue d'ensemble du projet

**Scripts :**
- `node verify-setup.js` - Vérifier la configuration (Node.js)
- `.\verify-setup.ps1` - Vérifier la configuration (PowerShell Windows)

---

## ✅ Checklist Finale

Avant d'envoyer les credentials au testeur :

- [ ] Tous les credentials récupérés (9 valeurs au total)
- [ ] `FIREBASE_PRIVATE_KEY` correctement formaté
- [ ] Template d'email rempli
- [ ] Testeur confirmé avec Node.js 18+
- [ ] Canal de communication sécurisé choisi
- [ ] Instructions claires fournies (QUICKSTART.md)
- [ ] Disponible pour support si problèmes

---

**Temps estimé total :** 15-20 minutes de préparation par testeur

**🎯 Objectif :** Le testeur doit pouvoir installer et tester en moins de 10 minutes !

---

**📅 Dernière mise à jour :** 29 décembre 2025
