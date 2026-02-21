# Activer Google Sign-In dans Firebase Console

## 🚨 Problème

Vous voyez ce message d'erreur lors du clic sur "Continuer avec Google" :

```
Cette méthode de connexion n'est pas activée. 
Veuillez contacter l'administrateur ou utiliser une autre méthode.
```

**Cause** : Le provider Google n'est **PAS activé** dans Firebase Console.

## ✅ Solution - Activation en 5 étapes

### Étape 1 : Accéder à Firebase Console

1. Allez sur https://console.firebase.google.com
2. Sélectionnez votre projet **ArtisanSafe**

### Étape 2 : Naviguer vers Authentication

1. Dans le menu de gauche, cliquez sur **Authentication** (🔐)
2. Cliquez sur l'onglet **Sign-in method** en haut

### Étape 3 : Activer Google

1. Vous verrez la liste des providers :
   ```
   Provider                Status
   ──────────────────────────────
   Email/Password          Activé ✅
   Google                  Désactivé ❌  ← À activer
   Facebook                Désactivé
   GitHub                  Désactivé
   ```

2. Cliquez sur **Google** dans la liste

### Étape 4 : Configurer Google Provider

Une popup s'ouvre avec les paramètres :

1. **Activer le provider** :
   - Cochez la case **"Activer"** (Enable)

2. **Nom public du projet** :
   - Laissez **"ArtisanSafe"** ou **"ArtisanDispo"**

3. **Email d'assistance** :
   - Sélectionnez votre email (celui du compte Firebase)
   - Exemple : `votre-email@gmail.com`

4. Cliquez sur **Enregistrer** (Save)

### Étape 5 : Vérifier l'activation

Retournez sur l'onglet **Sign-in method**, vous devriez voir :

```
Provider                Status
──────────────────────────────
Email/Password          Activé ✅
Google                  Activé ✅  ← Maintenant activé !
```

## 🧪 Tester

1. Allez sur http://localhost:3000/connexion
2. Cliquez sur le bouton **"Google"**
3. Une popup Google s'ouvre → Sélectionnez votre compte
4. ✅ Connexion réussie !

## 📸 Captures d'écran

### 1. Sign-in method (avant activation)
```
┌─────────────────────────────────────────┐
│ Sign-in method                          │
├─────────────────────────────────────────┤
│ Provider          Status       Actions  │
│ Email/Password    Enabled      Edit     │
│ Google            Disabled     Edit  ←  │ Cliquez ici
│ Facebook          Disabled              │
└─────────────────────────────────────────┘
```

### 2. Configuration Google (popup)
```
┌─────────────────────────────────────────┐
│ Set up Google sign-in                   │
├─────────────────────────────────────────┤
│ ☑ Enable                        ← Cochez│
│                                          │
│ Project public-facing name               │
│ ┌──────────────────────────────────┐    │
│ │ ArtisanSafe                      │    │
│ └──────────────────────────────────┘    │
│                                          │
│ Project support email                    │
│ ┌──────────────────────────────────┐    │
│ │ votre-email@gmail.com        ▼   │    │
│ └──────────────────────────────────┘    │
│                                          │
│         [Cancel]  [Save]         ← Clic │
└─────────────────────────────────────────┘
```

### 3. Résultat (après activation)
```
┌─────────────────────────────────────────┐
│ Provider          Status       Actions  │
│ Email/Password    Enabled      Edit     │
│ Google            Enabled ✅   Edit     │
│ Facebook          Disabled              │
└─────────────────────────────────────────┘
```

## ⚠️ Erreurs fréquentes

### Erreur 1 : "Email d'assistance manquant"
**Symptôme** : Impossible de sauvegarder sans email  
**Solution** : Sélectionnez un email dans la liste déroulante

### Erreur 2 : "Popup bloquée par le navigateur"
**Symptôme** : Rien ne se passe au clic sur Google  
**Solution** : Autoriser les popups pour localhost (icône dans la barre d'adresse)

### Erreur 3 : "Compte Google déjà utilisé"
**Symptôme** : Erreur `auth/account-exists-with-different-credential`  
**Solution** : Activez "Email enumeration protection" dans Firebase Auth Settings (voir `docs/QUICKSTART_EMAIL_ENUMERATION.md`)

## 🎯 Résultat attendu

Après activation, vos utilisateurs pourront :

1. ✅ Se connecter avec Google (compte existant)
2. ✅ S'inscrire avec Google (nouveau compte)
3. ✅ Lier compte email/password + Google (même email = même UID)

## 📚 Voir aussi

- `docs/QUICKSTART_EMAIL_ENUMERATION.md` - Liaison automatique des comptes
- `docs/ACCOUNT_LINKING_MARCHE.md` - Comportement standard du marché
- `docs/FIREBASE_AUTH_DUPLICATE_BEHAVIOR.md` - Explication technique

## 🆘 Aide supplémentaire

Si vous avez toujours des problèmes après activation :

1. **Vérifier la configuration Firebase** :
   ```bash
   node verify-setup.js
   ```

2. **Vérifier les variables d'environnement** :
   ```bash
   # frontend/.env.local
   NEXT_PUBLIC_FIREBASE_API_KEY=...
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
   ```

3. **Redémarrer le serveur** :
   ```bash
   cd frontend && npm run dev
   ```

4. **Effacer le cache navigateur** : Ctrl+Shift+R (Windows) ou Cmd+Shift+R (Mac)

---

**Note** : Cette activation est nécessaire UNIQUEMENT pour la connexion Google. Les autres méthodes (email/password, email link, téléphone) nécessitent leurs propres activations.
