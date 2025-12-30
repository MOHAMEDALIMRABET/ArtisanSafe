# 🔑 Comment Récupérer les Credentials Firebase

> **Pour l'administrateur** : Guide pas à pas pour obtenir les credentials Firebase à partager avec les testeurs.

## 📋 Ce dont vous avez besoin

- ✅ Accès à [Firebase Console](https://console.firebase.google.com/)
- ✅ Rôle propriétaire ou éditeur du projet ArtisanSafe

## 1️⃣ Credentials Frontend (Firebase Web SDK)

### Étape 1 : Accéder au projet

1. Aller sur https://console.firebase.google.com/
2. Sélectionner le projet **ArtisanSafe**

### Étape 2 : Récupérer les credentials

1. Cliquer sur l'icône ⚙️ (Paramètres) en haut à gauche
2. Sélectionner **"Paramètres du projet"**
3. Descendre jusqu'à la section **"Vos applications"**
4. Si aucune app web n'existe :
   - Cliquer sur l'icône `</>` (Web)
   - Nom de l'app : `ArtisanSafe Web`
   - Cocher "Configurer aussi Firebase Hosting" (optionnel)
   - Cliquer "Enregistrer l'application"

5. Dans la section **"Configuration du SDK"**, sélectionner **"Config"**
6. Copier les valeurs de `firebaseConfig` :

```javascript
const firebaseConfig = {
  apiKey: "AIzaSy...",              // → NEXT_PUBLIC_FIREBASE_API_KEY
  authDomain: "xxx.firebaseapp.com", // → NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
  projectId: "artisansafe-xxxxx",    // → NEXT_PUBLIC_FIREBASE_PROJECT_ID
  storageBucket: "xxx.appspot.com",  // → NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
  messagingSenderId: "123456789012", // → NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
  appId: "1:123...:web:abc..."       // → NEXT_PUBLIC_FIREBASE_APP_ID
};
```

### Résultat : À copier dans `frontend/.env.local`

```env
NEXT_PUBLIC_API_URL=http://localhost:5000/api/v1

NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSy...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=artisansafe-xxxxx.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=artisansafe-xxxxx
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=artisansafe-xxxxx.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789012
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789012:web:abcdef123456
```

---

## 2️⃣ Credentials Backend (Firebase Admin SDK)

### Étape 1 : Générer la clé privée

1. Toujours dans **Firebase Console** → Projet ArtisanSafe
2. Cliquer sur ⚙️ → **"Paramètres du projet"**
3. Onglet **"Comptes de service"**
4. Cliquer sur **"Générer une nouvelle clé privée"**
5. **Confirmer** → Un fichier `serviceAccountKey.json` est téléchargé

⚠️ **ATTENTION** : Ce fichier est ultra-confidentiel ! Ne le partagez qu'avec les personnes de confiance.

### Étape 2 : Extraire les valeurs

Ouvrir le fichier `serviceAccountKey.json` téléchargé :

```json
{
  "type": "service_account",
  "project_id": "artisansafe-xxxxx",
  "private_key_id": "...",
  "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBg...\n-----END PRIVATE KEY-----\n",
  "client_email": "firebase-adminsdk-xxxxx@artisansafe-xxxxx.iam.gserviceaccount.com",
  "client_id": "...",
  "auth_uri": "...",
  ...
}
```

### Étape 3 : Mapper les valeurs

| Champ dans JSON | Variable .env | Remarque |
|----------------|---------------|----------|
| `project_id` | `FIREBASE_PROJECT_ID` | Simple copie |
| `client_email` | `FIREBASE_CLIENT_EMAIL` | Simple copie |
| `private_key` | `FIREBASE_PRIVATE_KEY` | ⚠️ Voir ci-dessous |

### ⚠️ IMPORTANT : `FIREBASE_PRIVATE_KEY`

La clé privée doit :
1. ✅ Conserver tous les `\n` (retours à la ligne)
2. ✅ Être entourée de guillemets doubles `"`
3. ✅ Commencer par `"-----BEGIN PRIVATE KEY-----\n`
4. ✅ Se terminer par `\n-----END PRIVATE KEY-----\n"`

**Exemple de format correct :**

```env
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEF...\n...beaucoup de lignes...\n...avec des caractères aléatoires...\n-----END PRIVATE KEY-----\n"
```

**❌ ERREUR COURANTE :** Retirer les `\n` ou oublier les guillemets

### Résultat : À copier dans `backend/.env`

```env
PORT=5000
NODE_ENV=development

FIREBASE_PROJECT_ID=artisansafe-xxxxx
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@artisansafe-xxxxx.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvQI...\n-----END PRIVATE KEY-----\n"

ALLOWED_ORIGINS=http://localhost:3000
```

---

## 3️⃣ Option alternative : Partager le fichier JSON directement

Au lieu d'extraire les valeurs, vous pouvez partager `serviceAccountKey.json` :

### Étape 1 : Partager le fichier

Envoyer `serviceAccountKey.json` au testeur de manière sécurisée :
- ✅ Email chiffré (ProtonMail, etc.)
- ✅ Google Drive avec accès restreint
- ✅ 1Password / Bitwarden
- ❌ **JAMAIS** par Slack public, GitHub, etc.

### Étape 2 : Instructions pour le testeur

1. Placer `serviceAccountKey.json` dans `backend/`
2. Modifier `backend/src/config/firebase-admin.ts` pour utiliser le fichier

**Méthode actuelle (variables .env) :**
```typescript
admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  }),
});
```

**Méthode alternative (fichier JSON) :**
```typescript
import serviceAccount from './serviceAccountKey.json';

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
});
```

⚠️ **Rappel** : `serviceAccountKey.json` est déjà dans `.gitignore`

---

## 📧 Envoyer les credentials

Une fois les credentials récupérés, utilisez le template dans :
- [docs/EMAIL_TEMPLATE_CREDENTIALS.md](EMAIL_TEMPLATE_CREDENTIALS.md)

---

## 🔒 Bonnes pratiques de sécurité

### ✅ À FAIRE
- Générer une nouvelle clé pour chaque environnement (dev, staging, prod)
- Partager via des canaux sécurisés (email chiffré, gestionnaire de mots de passe)
- Révoquer les clés après les tests si nécessaire
- Vérifier que `.gitignore` contient `.env` et `serviceAccountKey.json`

### ❌ NE JAMAIS FAIRE
- Commit les credentials sur Git/GitHub
- Partager sur Slack/Teams en public
- Envoyer par email non chiffré (pour `private_key`)
- Prendre des screenshots contenant la clé privée

---

## 🔄 Révoquer une clé compromise

Si une clé a été exposée publiquement :

1. Firebase Console → Projet → ⚙️ Paramètres
2. Onglet **"Comptes de service"**
3. Section **"Comptes de service Firebase Admin SDK"**
4. Cliquer sur **"Gérer les autorisations de comptes de service"**
5. Dans Google Cloud Console :
   - IAM & Admin → Comptes de service
   - Trouver le compte compromis
   - Cliquer sur les 3 points → **"Gérer les clés"**
   - Supprimer la clé compromise
6. Générer une nouvelle clé et redistribuer

---

## ✅ Checklist avant d'envoyer

- [ ] Credentials Frontend récupérés (6 valeurs)
- [ ] Credentials Backend récupérés (3 valeurs)
- [ ] `FIREBASE_PRIVATE_KEY` contient les `\n` et guillemets
- [ ] Template d'email préparé
- [ ] Canal de communication sécurisé choisi
- [ ] Testeur a accès au repository GitHub
- [ ] Testeur a Node.js 18+ installé

---

**📅 Dernière mise à jour :** 29 décembre 2025
