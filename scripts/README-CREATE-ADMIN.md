# Script de Création Admin

Ce script crée automatiquement un compte administrateur dans Firebase.

## 📦 Prérequis

### 1. Installer Firebase Admin SDK

```bash
cd /c/Users/moham/ArtisanSafe
npm install firebase-admin --save-dev
```

### 2. Configurer les identifiants Firebase

**Option A : Télécharger la clé de compte de service**

1. Allez sur **Firebase Console** → Votre projet **ArtisanSafe**
2. Cliquez sur l'icône **⚙️ (Paramètres)** → **Paramètres du projet**
3. Onglet **Comptes de service**
4. Cliquez sur **Générer une nouvelle clé privée**
5. Un fichier JSON sera téléchargé (ex: `artisansafe-firebase-adminsdk-xxxxx.json`)
6. Déplacez ce fichier dans le dossier racine du projet :
   ```bash
   mv ~/Downloads/artisansafe-firebase-adminsdk-xxxxx.json /c/Users/moham/ArtisanSafe/firebase-admin-key.json
   ```

**Option B : Utiliser les variables d'environnement**

Créez un fichier `.env` à la racine du projet :

```bash
GOOGLE_APPLICATION_CREDENTIALS=./firebase-admin-key.json
FIREBASE_PROJECT_ID=your-project-id
```

## 🚀 Utilisation

### Exécuter le script

```bash
cd /c/Users/moham/ArtisanSafe

# Avec la clé de service
GOOGLE_APPLICATION_CREDENTIALS=./firebase-admin-key.json node scripts/create-admin.js

# OU avec npx
npx node scripts/create-admin.js
```

### Saisie interactive

Le script vous demandera :

```
📧 Email admin (ex: admin@artisandispo.fr): admin@artisandispo.fr
🔑 Mot de passe (min 12 caractères): VotreMotDePasseSecurise123!
👤 Nom (ex: Admin): Admin
👤 Prénom (ex: ArtisanDispo): ArtisanDispo
📱 Téléphone (ex: +33600000000): +33600000000
```

### Résultat

```
⏳ Création du compte admin...

✅ Utilisateur créé dans Firebase Auth
   UID: xJ4kL9mNpQ2rS5tU7vW8x
✅ Document admin créé dans Firestore

🎉 Compte admin créé avec succès!

📋 Informations de connexion:
   Email: admin@artisandispo.fr
   UID: xJ4kL9mNpQ2rS5tU7vW8x
   Rôle: admin

🔐 Vous pouvez maintenant vous connecter sur:
   http://localhost:3000/admin/login
```

## 🔍 Vérification dans Firebase

### Firebase Authentication

1. **Firebase Console** → **Authentication** → **Users**
2. Vous verrez l'utilisateur avec l'email créé
3. Vérifiez l'UID

### Firestore Database

1. **Firebase Console** → **Firestore Database**
2. Collection **`users`**
3. Document avec l'UID créé
4. Vérifiez que `role: "admin"` est présent
5. Vérifiez que `dateCreation` contient un timestamp

## ⚠️ Sécurité

**IMPORTANT** : Ajoutez `firebase-admin-key.json` au `.gitignore` :

```bash
echo "firebase-admin-key.json" >> .gitignore
```

Ne commitez **jamais** la clé de service sur GitHub !

## 🐛 Dépannage

### Erreur : "Could not load the default credentials"

**Solution** : Spécifiez explicitement le chemin vers la clé :

```bash
export GOOGLE_APPLICATION_CREDENTIALS="/c/Users/moham/ArtisanSafe/firebase-admin-key.json"
node scripts/create-admin.js
```

### Erreur : "auth/email-already-exists"

Le script détectera automatiquement que l'email existe et réutilisera l'utilisateur existant.

### Erreur : "permission-denied"

Vérifiez que la clé de service a les bonnes permissions dans Firebase Console.

## 🎯 Alternatives

Si vous ne voulez pas utiliser le script, vous pouvez créer l'admin manuellement dans la console Firebase :

1. **Firebase Auth** → Add user → Email + Password
2. **Firestore** → Collection `users` → Add document
3. Document ID = UID de l'étape 1
4. Ajoutez tous les champs manuellement (voir structure dans le script)

Pour `dateCreation`, utilisez simplement la date/heure actuelle dans le sélecteur de timestamp.
