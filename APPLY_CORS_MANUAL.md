# 🚨 URGENCE : Appliquer les règles CORS Firebase Storage

## ❌ Problème actuel
Les uploads échouent avec l'erreur CORS car Firebase Storage bloque POST/PUT.

## ✅ Solution IMMÉDIATE (5 minutes)

### Étape 1 : Ouvrir la console Google Cloud
Cliquez sur ce lien : https://console.cloud.google.com/storage/browser

### Étape 2 : Sélectionner le projet
- Connectez-vous avec votre compte Google
- Sélectionnez le projet **artisansafe**

### Étape 3 : Accéder au bucket
- Cliquez sur le bucket **artisansafe.appspot.com**
- Cliquez sur l'onglet **"Configuration"** (en haut)

### Étape 4 : Modifier CORS
1. Faites défiler jusqu'à **"CORS"**
2. Cliquez sur **"Modifier"** ou **"Ajouter une entrée CORS"**
3. **Supprimez** toutes les règles existantes
4. **Collez** cette configuration :

```json
[
  {
    "origin": ["http://localhost:3000", "https://artisansafe.web.app", "https://artisansafe.firebaseapp.com"],
    "method": ["GET", "HEAD", "POST", "PUT", "DELETE"],
    "maxAgeSeconds": 3600
  }
]
```

5. Cliquez sur **"Enregistrer"**

### Étape 5 : Vérifier
- Attendez 1-2 minutes pour la propagation
- Rechargez http://localhost:3000/artisan/documents
- Sélectionnez un fichier et cliquez "Upload"
- ✅ L'upload devrait fonctionner !

---

## 🔍 Comment vérifier les règles CORS actuelles

Dans la console (F12) → Network → Rechercher `firebasestorage.googleapis.com`
- Requête OPTIONS (preflight) doit retourner **200** (pas 403)
- Headers de réponse doivent inclure `Access-Control-Allow-Methods: GET, HEAD, POST, PUT, DELETE`

---

## ⚠️ Pourquoi le problème est apparu

Les règles CORS Firebase Storage peuvent avoir été :
1. Réinitialisées lors d'une manipulation dans la console
2. Jamais appliquées initialement (règles par défaut de Firebase)
3. Expirées ou supprimées par erreur

Le fichier `cors.json` local ne suffit PAS - il faut l'appliquer manuellement.

---

## 📋 Statut actuel

- ✅ `cors.json` local : Correctement configuré avec POST/PUT/DELETE
- ✅ `storage.rules` : Correctement configuré (permettent upload authentifié)
- ❌ **CORS Firebase Storage Cloud** : Manque POST/PUT/DELETE
- ✅ Code upload `verification-service.ts` : Fonctionnel

**→ SEUL** le CORS cloud doit être corrigé via la console Google Cloud Storage.
