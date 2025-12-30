# 🔑 Instructions pour l'Administrateur - Partage des Credentials

> **Ce document est pour l'administrateur du projet** qui doit fournir les credentials Firebase aux testeurs.

## 📋 Checklist : Fichiers à partager

Pour qu'un testeur puisse utiliser l'application, vous devez lui fournir :

### ✅ 1. Credentials Firebase Frontend

**Où les trouver :**
1. Aller sur [Firebase Console](https://console.firebase.google.com/)
2. Sélectionner le projet **ArtisanSafe**
3. Cliquer sur l'icône ⚙️ → **Paramètres du projet**
4. Descendre jusqu'à **Vos applications** → Section **SDK**
5. Copier les valeurs de `firebaseConfig`

**Valeurs à partager (à copier dans leur `frontend/.env.local`) :**

```env
NEXT_PUBLIC_API_URL=http://localhost:5000/api/v1

NEXT_PUBLIC_FIREBASE_API_KEY=AIza...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=artisansafe-xxxxx.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=artisansafe-xxxxx
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=artisansafe-xxxxx.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789012
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789012:web:abcdef123456
```

### ✅ 2. Credentials Firebase Backend (Admin SDK)

**Où les trouver :**
1. Aller sur [Firebase Console](https://console.firebase.google.com/)
2. Sélectionner le projet **ArtisanSafe**
3. Cliquer sur ⚙️ → **Paramètres du projet**
4. Onglet **Comptes de service**
5. Cliquer sur **Générer une nouvelle clé privée**
6. Télécharger le fichier `serviceAccountKey.json`

**Option A : Partager le fichier JSON complet**
- Envoyer `serviceAccountKey.json` de manière sécurisée (email chiffré, drive privé)
- Le testeur le place dans `backend/serviceAccountKey.json`
- ⚠️ **Ne JAMAIS commit ce fichier sur Git !**

**Option B : Extraire les valeurs du JSON (plus sécurisé)**

Ouvrir `serviceAccountKey.json` et extraire :

```json
{
  "project_id": "artisansafe-xxxxx",           ← FIREBASE_PROJECT_ID
  "private_key": "-----BEGIN PRIVATE KEY-----\n...",  ← FIREBASE_PRIVATE_KEY
  "client_email": "firebase-adminsdk-xxxxx@..."      ← FIREBASE_CLIENT_EMAIL
}
```

**Valeurs à partager (à copier dans leur `backend/.env`) :**

```env
PORT=5000
NODE_ENV=development

FIREBASE_PROJECT_ID=artisansafe-xxxxx
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@artisansafe-xxxxx.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANB...\n-----END PRIVATE KEY-----\n"

ALLOWED_ORIGINS=http://localhost:3000
```

⚠️ **IMPORTANT pour `FIREBASE_PRIVATE_KEY` :**
- Garder les guillemets doubles `"`
- Garder tous les `\n` (retours à la ligne)
- La clé doit commencer par `-----BEGIN PRIVATE KEY-----`
- La clé doit se terminer par `-----END PRIVATE KEY-----`

## 📧 Email type à envoyer au testeur

```
Objet : ArtisanSafe - Credentials de test

Bonjour [Nom],

Voici les credentials pour tester l'application ArtisanSafe localement :

📁 Instructions complètes : Voir le fichier INSTALLATION.md dans le projet

🔑 Credentials Frontend (.env.local)
=====================================
NEXT_PUBLIC_API_URL=http://localhost:5000/api/v1
NEXT_PUBLIC_FIREBASE_API_KEY=AIza...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=artisansafe-xxxxx.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=artisansafe-xxxxx
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=artisansafe-xxxxx.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789012
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789012:web:abcdef123456

🔑 Credentials Backend (.env)
=====================================
PORT=5000
NODE_ENV=development
FIREBASE_PROJECT_ID=artisansafe-xxxxx
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@...
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
ALLOWED_ORIGINS=http://localhost:3000

⚠️ IMPORTANT :
- Ne JAMAIS partager ces credentials publiquement
- Ne JAMAIS les commit sur Git
- Les fichiers .env et .env.local sont déjà dans .gitignore

📚 Étapes d'installation :
1. Cloner le projet : git clone https://github.com/MOHAMEDALIMRABET/ArtisanSafe.git
2. Suivre le fichier INSTALLATION.md étape par étape
3. Tester l'inscription sur http://localhost:3000/inscription

Si tu rencontres des problèmes, n'hésite pas à me contacter !

Cordialement,
[Votre nom]
```

## 🔒 Bonnes pratiques de sécurité

1. **Ne jamais partager les credentials par :**
   - Message Slack public
   - Email non chiffré (pour la clé privée)
   - GitHub/GitLab issues ou pull requests
   - Screenshots publics

2. **Méthodes sécurisées :**
   - Email chiffré (ProtonMail, etc.)
   - Google Drive avec accès restreint
   - 1Password, Bitwarden ou autre gestionnaire de mots de passe
   - En personne (clé USB)

3. **Vérifier que `.gitignore` contient :**
   ```gitignore
   # Frontend
   frontend/.env.local
   frontend/.env*.local
   
   # Backend
   backend/.env
   backend/serviceAccountKey.json
   ```

4. **Après les tests :**
   - Demander au testeur de supprimer les fichiers `.env` et `.env.local`
   - Ou régénérer les clés Firebase si nécessaire

## 🧪 Vérification post-installation (à demander au testeur)

Demandez au testeur de vous confirmer :

✅ "J'ai créé le fichier `frontend/.env.local` avec les credentials"
✅ "J'ai créé le fichier `backend/.env` avec les credentials"
✅ "Le frontend démarre sur http://localhost:3000"
✅ "Le backend démarre sur http://localhost:5000"
✅ "Je peux accéder à la page d'inscription"
✅ "J'ai réussi à créer un compte client/artisan"
✅ "Je vois mon utilisateur dans Firebase Console > Authentication"
✅ "Je vois les données dans Firebase Console > Firestore"

## 📞 Support

Si le testeur rencontre des erreurs, demandez-lui :

1. **Capture d'écran** de l'erreur dans le navigateur
2. **Logs du terminal** (frontend et backend)
3. **Contenu des fichiers .env** (⚠️ masquer la clé privée si partagé publiquement)

---

**📅 Dernière mise à jour :** 29 décembre 2025
