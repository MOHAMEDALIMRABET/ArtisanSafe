# 🔄 Use Cases : Google Sign-In vs Email/Password

## ⚡ SOLUTION RAPIDE (Recommandée)

**Activer Email Enumeration Protection dans Firebase Console** → [Guide 5 minutes](QUICKSTART_EMAIL_ENUMERATION.md)

**Effet** : Account Linking automatique → Comportement identique au marché (AlloVoisins, Airbnb)
- ✅ User peut se connecter avec email/password OU Google
- ✅ Les 2 méthodes accèdent au MÊME compte (même UID)
- ✅ Pas de doublons possibles

**Voir aussi** : [ACCOUNT_LINKING_MARCHE.md](ACCOUNT_LINKING_MARCHE.md)

---

## Problème identifié (SI Email Enumeration Protection désactivée)

Firebase Auth permet d'avoir **PLUSIEURS comptes avec le MÊME email** si les providers sont différents :
- Un compte avec provider `password` (email/mot de passe)
- Un compte avec provider `google.com` (Google Sign-In)
- **Ce sont 2 UIDs différents !**

Cela crée des incohérences et confusion pour l'utilisateur.

---

## 📊 Scénarios actuels (SANS gestion)

### Scénario 1 : Compte email/password existant → Clique Google

```
État initial :
- User crée compte : email@example.com + password123
- Firebase Auth UID : abc123
- Document Firestore : users/abc123 (role: client)

Action :
- User clique "Se connecter avec Google"
- Sélectionne email@example.com dans Google OAuth

Résultat actuel (⚠️ PROBLÈME) :
- Firebase Auth crée NOUVEAU compte : UID xyz789
- Provider : google.com
- Document Firestore : users/xyz789 (PAS CRÉÉ encore)
- Redirection vers /choix-role (demande de choisir rôle)

Conséquences :
❌ L'utilisateur a maintenant 2 comptes Firebase Auth différents
❌ Son profil Firestore original (users/abc123) est inaccessible
❌ Confusion totale pour l'utilisateur
❌ Perte de données (demandes, devis, conversations)
```

### Scénario 2 : Compte Google existant → Essaie email/password

```
État initial :
- User crée compte via Google : email@example.com
- Firebase Auth UID : xyz789
- Document Firestore : users/xyz789 (role: artisan)

Action :
- User va sur /inscription
- Entre : email@example.com + password123
- Clique "S'inscrire"

Résultat actuel (⚠️ ERREUR) :
- createUserWithEmailAndPassword() échoue
- Erreur Firebase : auth/email-already-in-use
- Message FR : "Cette adresse email est déjà utilisée par un autre compte."

Conséquences :
❌ L'utilisateur ne peut pas s'inscrire
⚠️  Message confus (il pense qu'il n'a pas de compte)
✅ Au moins, pas de doublon créé
```

---

## ✅ Solutions à implémenter

### Solution 1 : Account Linking (Liaison de comptes) - RECOMMANDÉ

**Principe** : Lier automatiquement les providers au même compte Firebase Auth.

#### Implémentation

**A. Modifier signInWithGoogle() pour détecter provider existant**

```typescript
async signInWithGoogle(): Promise<{ user: User; isNewUser: boolean; existingRole?: string }> {
  try {
    const provider = new GoogleAuthProvider();
    const result = await signInWithPopup(auth, provider);
    const user = result.user;

    // 🔍 VÉRIFIER si email existe déjà avec un autre provider
    const methods = await fetchSignInMethodsForEmail(auth, user.email!);
    
    if (methods.length > 0 && !methods.includes('google.com')) {
      // Email existe avec password provider
      await firebaseSignOut(auth);
      throw new Error(
        'Ce compte existe déjà avec un mot de passe. Veuillez vous connecter avec votre mot de passe, ' +
        'puis lier votre compte Google depuis les paramètres.'
      );
    }

    // Suite du code normal...
    const userDoc = await getDoc(doc(db, 'users', user.uid));
    // ...
  }
}
```

**B. Modifier signUpClient/signUpArtisan pour détecter Google**

```typescript
async signUpClient(data: SignUpData) {
  try {
    // 🔍 VÉRIFIER si email existe déjà avec Google
    const methods = await fetchSignInMethodsForEmail(auth, data.email);
    
    if (methods.includes('google.com')) {
      throw new Error(
        'Ce compte existe déjà avec Google Sign-In. Veuillez vous connecter avec Google, ' +
        'puis ajouter un mot de passe depuis les paramètres.'
      );
    }

    // Suite du code normal...
    const userCredential = await createUserWithEmailAndPassword(auth, data.email, data.password);
    // ...
  }
}
```

**C. Ajouter page "Lier compte Google" dans paramètres**

```typescript
// Page : /parametres/securite
async function linkGoogleAccount() {
  const user = auth.currentUser;
  if (!user) return;

  try {
    const provider = new GoogleAuthProvider();
    const credential = await linkWithPopup(user, provider);
    
    console.log('✅ Compte Google lié avec succès');
    // Le même UID peut maintenant se connecter avec password OU Google
  } catch (error: any) {
    if (error.code === 'auth/provider-already-linked') {
      console.log('Compte Google déjà lié');
    }
  }
}
```

---

### Solution 2 : Email Enumeration Protection (Firebase Console) - COMPLÉMENTAIRE

**Configuration Firebase** :
1. Aller dans Firebase Console
2. Authentication → Settings
3. Activer "Email enumeration protection"

**Effet** :
- Empêche d'avoir plusieurs comptes avec le même email
- Force la liaison de comptes

⚠️ **Attention** : Peut casser les comptes existants avec doublons !

---

### Solution 3 : Détection + Migration (Pour comptes existants)

Si des utilisateurs ont déjà créé des doublons :

```typescript
// Script de migration
async function detectAndMergeAccounts() {
  // 1. Récupérer tous les utilisateurs Firebase Auth
  const listUsersResult = await admin.auth().listUsers();
  
  // 2. Grouper par email
  const emailMap = new Map();
  listUsersResult.users.forEach(user => {
    const email = user.email?.toLowerCase();
    if (!email) return;
    
    if (!emailMap.has(email)) {
      emailMap.set(email, []);
    }
    emailMap.get(email).push(user);
  });
  
  // 3. Identifier doublons
  const duplicates = Array.from(emailMap.entries())
    .filter(([_, users]) => users.length > 1);
  
  console.log(`${duplicates.length} emails avec doublons détectés`);
  
  // 4. Pour chaque doublon, fusionner les données Firestore
  for (const [email, users] of duplicates) {
    const passwordUser = users.find(u => u.providerData.some(p => p.providerId === 'password'));
    const googleUser = users.find(u => u.providerData.some(p => p.providerId === 'google.com'));
    
    if (passwordUser && googleUser) {
      // Migrer données Firestore du Google user vers Password user
      const googleDoc = await db.collection('users').doc(googleUser.uid).get();
      const passwordDoc = await db.collection('users').doc(passwordUser.uid).get();
      
      if (googleDoc.exists() && !passwordDoc.exists()) {
        // Copier données
        await db.collection('users').doc(passwordUser.uid).set(googleDoc.data());
        console.log(`✅ Migré données de ${googleUser.uid} → ${passwordUser.uid}`);
      }
      
      // Supprimer compte Google
      await admin.auth().deleteUser(googleUser.uid);
      await db.collection('users').doc(googleUser.uid).delete();
    }
  }
}
```

---

## 🎯 Plan d'implémentation recommandé

### Phase 1 : Prévention (URGENT)

**Fichiers à modifier** :
- `frontend/src/lib/auth-service.ts`
  - Ajouter import : `fetchSignInMethodsForEmail`
  - Modifier `signInWithGoogle()`
  - Modifier `signUpClient()`
  - Modifier `signUpArtisan()`

**Temps estimé** : 1-2 heures

**Code à ajouter** :

```typescript
import { 
  // ... imports existants
  fetchSignInMethodsForEmail
} from 'firebase/auth';

// Dans signInWithGoogle()
const methods = await fetchSignInMethodsForEmail(auth, user.email!);
if (methods.length > 0 && !methods.includes('google.com')) {
  await firebaseSignOut(auth);
  throw new Error(
    'Ce compte existe déjà avec un mot de passe. ' +
    'Connectez-vous avec votre mot de passe.'
  );
}

// Dans signUpClient() AVANT createUserWithEmailAndPassword
const methods = await fetchSignInMethodsForEmail(auth, data.email);
if (methods.length > 0) {
  if (methods.includes('google.com')) {
    throw new Error(
      'Ce compte existe déjà avec Google Sign-In. ' +
      'Connectez-vous avec Google.'
    );
  } else {
    throw new Error('Cette adresse email est déjà utilisée.');
  }
}
```

---

### Phase 2 : Détection des doublons existants

**Script** : `backend/scripts/detect-duplicate-accounts.js` ✅ **CRÉÉ**

**Exécution** :
```bash
cd backend
node scripts/detect-duplicate-accounts.js
```

**Sortie exemple (si aucun doublon)** :
```
✅ Firebase Admin SDK initialisé
📊 Total utilisateurs Firebase Auth : 8
Total emails uniques : 8
Emails avec doublons : 0

✅ Aucun doublon détecté !
```

**Sortie exemple (si doublons détectés)** :
```
📧 Email : test@example.com
   Nombre de comptes : 2

   Compte #1 :
   ├─ UID : abc123xyz789
   ├─ Providers : password
   ├─ Email vérifié : Oui
   ├─ Créé : Wed, 10 Jan 2026 10:30:00 GMT
   └─ Dernière connexion : Thu, 20 Feb 2026 15:45:00 GMT
   
   📄 Document Firestore : OUI
   └─ Rôle : client

   Compte #2 :
   ├─ UID : def456uvw123
   ├─ Providers : google.com
   ├─ Email vérifié : Oui
   ├─ Créé : Fri, 21 Feb 2026 09:00:00 GMT
   └─ Dernière connexion : Fri, 21 Feb 2026 09:00:00 GMT
   
   📄 Document Firestore : NON (compte orphelin)
```

---

### Phase 3 : Migration (si doublons détectés)

**Script** : `backend/scripts/merge-duplicate-accounts.js` (TODO)

⚠️ **TRÈS DÉLICAT** : Nécessite validation manuelle avant suppression.

---

## 📋 Messages utilisateur à afficher

### Connexion Google avec compte password existant

```
❌ Ce compte existe déjà

Vous avez déjà créé un compte avec cette adresse email et un mot de passe.

Pour vous connecter :
1. Utilisez le formulaire de connexion classique
2. Entrez votre mot de passe

Vous pourrez ensuite lier votre compte Google depuis vos paramètres.

[Se connecter avec mot de passe]
```

### Inscription password avec compte Google existant

```
❌ Ce compte existe déjà

Vous avez déjà créé un compte avec Google Sign-In.

Pour vous connecter :
1. Cliquez sur "Se connecter avec Google"
2. Sélectionnez votre compte Google

Vous pourrez ensuite ajouter un mot de passe depuis vos paramètres.

[Se connecter avec Google]
```

---

## 🔍 Tests à effectuer

### Test 1 : Créer doublon (AVANT fix)
```bash
1. Créer compte : test@example.com + password123
2. Se déconnecter
3. Cliquer "Google Sign-In"
4. Sélectionner test@example.com

Résultat attendu (après fix) : 
❌ Message : "Ce compte existe déjà avec un mot de passe..."
```

### Test 2 : Créer doublon inverse (AVANT fix)
```bash
1. Se connecter avec Google : test2@example.com
2. Se déconnecter
3. Aller /inscription
4. Entrer test2@example.com + password123

Résultat attendu (après fix) :
❌ Message : "Ce compte existe déjà avec Google Sign-In..."
```

### Test 3 : Liaison de compte (APRÈS implémentation)
```bash
1. Se connecter avec mot de passe
2. Aller /parametres/securite
3. Cliquer "Lier compte Google"
4. Sélectionner même email dans Google

Résultat attendu :
✅ Compte lié avec succès
✅ Peut maintenant se connecter avec password OU Google
✅ Même UID (pas de doublon)
```

---

## 📚 Références Firebase

- [Account Linking](https://firebase.google.com/docs/auth/web/account-linking)
- [fetchSignInMethodsForEmail](https://firebase.google.com/docs/reference/js/auth#fetchsigninmethodsforemail)
- [linkWithPopup](https://firebase.google.com/docs/reference/js/auth.user#userlinkwithpopup)
- [Email Enumeration Protection](https://cloud.google.com/identity-platform/docs/admin/email-enumeration-protection)

---

**Dernière mise à jour** : 21 février 2026  
**Statut** : ⚠️ PROBLÈME IDENTIFIÉ - Solution à implémenter  
**Priorité** : 🔴 HAUTE (peut créer confusion utilisateurs)
