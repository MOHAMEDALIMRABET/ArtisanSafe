# 🔧 Fix CORS Upload - Guide Rapide

## 🔴 Problème

Les uploads de documents (KBIS, RC Pro, Pièce d'identité) échouent avec l'erreur :
```
Access to XMLHttpRequest has been blocked by CORS policy: 
Response to preflight request doesn't pass access control check
```

## ✅ Solution

Les règles CORS de Firebase Storage doivent autoriser les méthodes POST, PUT et DELETE.

### Méthode 1: Console Firebase (RECOMMANDÉ) ⚡

1. **Ouvrir la console Google Cloud Storage** (pas Firebase !)
   ```
   https://console.cloud.google.com/storage/browser
   ```

2. **Sélectionner le bucket** `artisansafe.appspot.com`

3. **Onglet "Configuration"** → **CORS**

4. **Ajouter cette configuration JSON :**
   ```json
   [
     {
       "origin": ["http://localhost:3000", "https://artisansafe.web.app"],
       "method": ["GET", "HEAD", "POST", "PUT", "DELETE"],
       "maxAgeSeconds": 3600
     }
   ]
   ```

5. **Enregistrer** et attendre 1-2 minutes

### Méthode 2: Ligne de commande (avec gsutil)

Si vous avez installé Google Cloud SDK :

```bash
gsutil cors set cors.json gs://artisansafe.appspot.com
```

### Méthode 3: Vérification alternative

Si les CORS ne fonctionnent pas, vérifier dans Storage Rules :

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /artisans/{userId}/documents/{allPaths=**} {
      allow read: if true;  // Lecture publique
      allow write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

## 🧪 Test

Après configuration :
1. Recharger la page `http://localhost:3000/artisan/documents`
2. Sélectionner un fichier
3. Cliquer sur "📤 Uploader"
4. Vérifier la console (F12) - plus d'erreurs CORS !

## 📋 Fichier cors.json actuel

```json
[
  {
    "origin": ["http://localhost:3000", "https://artisansafe.web.app", "https://artisansafe.firebaseapp.com"],
    "method": ["GET", "HEAD", "POST", "PUT", "DELETE"],
    "maxAgeSeconds": 3600
  }
]
```

## 🔍 Débogage

### Vérifier les règles CORS actuelles :
```bash
gsutil cors get gs://artisansafe.appspot.com
```

### Logs utiles :
- Console navigateur (F12) → Network → Filtrer "firebasestorage"
- Chercher les requêtes OPTIONS (preflight)
- Status devrait être 200, pas 403

## ⚠️ Important

Les règles CORS sont **indépendantes** des Storage Rules (firestore.rules).
- **CORS** : Contrôle les requêtes HTTP cross-origin
- **Storage Rules** : Contrôle les permissions d'accès Firebase

Les deux doivent être configurés correctement !
