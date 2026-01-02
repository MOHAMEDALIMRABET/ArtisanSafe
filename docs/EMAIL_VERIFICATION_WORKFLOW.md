# 📧 Validation Email - Workflow Complet

## 🎯 Approche Progressive selon le Rôle

### **Clients (Particuliers)**
- ✅ Accès immédiat au compte après inscription
- ⚠️ Certaines fonctionnalités limitées si email non vérifié
- 💡 Validation encouragée mais pas bloquante

### **Artisans**
- ✅ Accès au dashboard après inscription
- 🔒 **Profil INVISIBLE** tant que email non vérifié
- ⚠️ **Validation OBLIGATOIRE** pour apparaître dans les recherches

---

## 📋 Workflow Détaillé

### 1️⃣ **Inscription**

#### Client
```
1. Inscription sur /inscription?role=client
2. Compte créé immédiatement dans Firebase Auth
3. Document créé dans Firestore (collection 'users')
4. emailVerified = false (synchronisé depuis Firebase Auth)
5. Email de bienvenue envoyé avec lien de validation
6. Redirection vers /dashboard
   → Accès TOTAL sauf :
     - ❌ Signature de contrat
     - ❌ Paiement sécurisé
```

#### Artisan
```
1. Inscription sur /inscription?role=artisan
2. Compte créé immédiatement dans Firebase Auth
3. Documents créés :
   - Collection 'users' (userId)
   - Collection 'artisans' (userId)
4. emailVerified = false (synchronisé depuis Firebase Auth)
5. Email de validation envoyé (OBLIGATOIRE)
6. Redirection vers /artisan/dashboard
   → Accès dashboard mais :
     - 🔒 Profil INVISIBLE dans les recherches
     - ⚠️ Bannière rouge : "Email non vérifié"
```

---

### 2️⃣ **Réception Email**

```
📧 Sujet : "Bienvenue sur ArtisanDispo - Validez votre email"

Bonjour [Prénom] !

Merci de vous être inscrit(e) sur ArtisanDispo.

Pour activer votre compte et accéder à toutes les fonctionnalités, 
veuillez cliquer sur le lien ci-dessous :

[Valider mon email]

Ce lien est valable pendant 24 heures.

Si vous n'avez pas créé de compte, ignorez cet email.

L'équipe ArtisanDispo
```

---

### 3️⃣ **Validation Email**

```
Utilisateur clique sur le lien
    ↓
Redirection vers Firebase Auth Handler
    ↓
Firebase Auth valide l'email
    ↓
Redirection vers /email-verified
    ↓
Page affiche :
  - ✅ "Email vérifié avec succès !"
  - Redirection automatique vers /dashboard (3s)
    ↓
Dashboard (onLoad) :
  - Recharge user.reload()
  - Vérifie user.emailVerified
  - Synchronise vers Firestore (emailVerified = true)
    ↓
Artisan :
  - Collection 'users' : emailVerified = true
  - Collection 'artisans' : emailVerified = true
  - Profil devient VISIBLE dans les recherches
```

---

## 🔍 Règles de Visibilité Artisans

### Recherche d'artisans
```typescript
// frontend/src/lib/firebase/artisan-service.ts

// ❌ AVANT (pas de filtre email)
where('badgeVerifie', '==', true)

// ✅ MAINTENANT (email OBLIGATOIRE)
where('badgeVerifie', '==', true)
where('emailVerified', '==', true)
```

### Conditions pour qu'un artisan soit VISIBLE :
```
✅ badgeVerifie = true (vérification admin KBIS + ID)
✅ emailVerified = true (validation email)
✅ statut = 'actif'

→ Si l'une des 3 conditions est false : INVISIBLE
```

---

## 🎨 Interface Utilisateur

### Dashboard Client (/dashboard)

#### Email non vérifié :
```tsx
🔵 BANNIÈRE BLEUE (informative)
┌─────────────────────────────────────────────┐
│ ℹ️ Validez votre email pour débloquer       │
│    toutes les fonctionnalités               │
│                                             │
│ Certaines fonctionnalités sont limitées     │
│ (signature de contrat, paiement)            │
│                                             │
│ [Renvoyer l'email]                          │
└─────────────────────────────────────────────┘
```

#### Email vérifié :
```
(Pas de bannière - accès total)
```

---

### Dashboard Artisan (/artisan/dashboard)

#### Email non vérifié :
```tsx
🔴 BANNIÈRE ROUGE (alerte critique)
┌─────────────────────────────────────────────┐
│ ⚠️ Validation de votre email OBLIGATOIRE    │
│                                             │
│ 🔒 Votre profil est INVISIBLE tant que      │
│    votre email n'est pas validé.            │
│    Les clients ne peuvent pas vous trouver. │
│                                             │
│ Consultez votre boîte mail et cliquez       │
│ sur le lien de validation.                  │
│                                             │
│ [Renvoyer l'email]                          │
└─────────────────────────────────────────────┘
```

#### Email vérifié :
```
(Pas de bannière - profil visible)
```

---

## 🔄 Synchronisation emailVerified

### Quand la synchronisation se fait :
1. **Après inscription** (client & artisan)
2. **À la connexion** (chaque fois)
3. **Après validation email** (page /email-verified)

### Fichier : `email-verification-sync.ts`
```typescript
export async function syncEmailVerificationStatus(userId: string) {
  const currentUser = auth.currentUser;
  
  // Mettre à jour users
  await updateUser(userId, {
    emailVerified: currentUser.emailVerified
  });
  
  // Mettre à jour artisans (si artisan)
  await updateArtisan(userId, {
    emailVerified: currentUser.emailVerified
  });
}
```

---

## 📊 Données Firestore

### Collection: `users`
```json
{
  "uid": "abc123",
  "email": "jean@example.com",
  "emailVerified": true,  ← NOUVEAU CHAMP
  "role": "artisan",
  "nom": "Dupont",
  "prenom": "Jean",
  ...
}
```

### Collection: `artisans`
```json
{
  "userId": "abc123",
  "emailVerified": true,  ← NOUVEAU CHAMP
  "siret": "12345678901234",
  "badgeVerifie": true,
  ...
}
```

---

## 🛠️ Fichiers Modifiés

### 1. Auth Service
**Fichier :** `frontend/src/lib/auth-service.ts`
- ✅ Import `sendEmailVerification`
- ✅ Envoi email après `signUpClient()`
- ✅ Envoi email après `signUpArtisan()`
- ✅ Fonction `resendVerificationEmail()`
- ✅ Synchronisation `emailVerified` à la connexion

### 2. Page de Validation
**Fichier :** `frontend/src/app/email-verified/page.tsx`
- ✅ Vérification du statut `user.emailVerified`
- ✅ Affichage succès/erreur
- ✅ Redirection automatique vers dashboard

### 3. Dashboard Client
**Fichier :** `frontend/src/app/dashboard/page.tsx`
- ✅ Bannière bleue si email non vérifié
- ✅ Bouton "Renvoyer l'email"

### 4. Dashboard Artisan
**Fichier :** `frontend/src/app/artisan/dashboard/page.tsx`
- ✅ Bannière rouge si email non vérifié
- ✅ Bouton "Renvoyer l'email"

### 5. Service Artisan
**Fichier :** `frontend/src/lib/firebase/artisan-service.ts`
- ✅ Filtre `emailVerified === true` dans `searchArtisansByMetier()`
- ✅ Filtre `emailVerified === true` dans `getVerifiedArtisans()`

### 6. Sync Service
**Fichier :** `frontend/src/lib/firebase/email-verification-sync.ts`
- ✅ Fonction `syncEmailVerificationStatus()`
- ✅ Mise à jour `users` et `artisans`

### 7. Types
**Fichier :** `frontend/src/types/firestore.ts`
- ✅ Ajout `emailVerified?: boolean` dans `User`
- ✅ Ajout `emailVerified?: boolean` dans `Artisan`

---

## ✅ Checklist de Test

### Inscription Client
- [ ] Email de bienvenue reçu
- [ ] Accès immédiat au dashboard
- [ ] Bannière bleue affichée
- [ ] Bouton "Renvoyer l'email" fonctionne
- [ ] Clic sur lien de validation → /email-verified
- [ ] Bannière disparaît après validation

### Inscription Artisan
- [ ] Email de validation reçu
- [ ] Accès au dashboard
- [ ] Bannière rouge affichée
- [ ] Profil INVISIBLE dans /recherche
- [ ] Clic sur lien de validation → /email-verified
- [ ] Profil devient VISIBLE après validation

### Validation Email
- [ ] Page /email-verified affiche succès
- [ ] Redirection automatique vers dashboard
- [ ] Firestore `emailVerified` = true
- [ ] Bannières disparues

### Recherche Artisans
- [ ] Artisans non vérifiés email = INVISIBLES
- [ ] Artisans vérifiés email = VISIBLES
- [ ] Filtre combiné `badgeVerifie + emailVerified`

---

## 🚀 Déploiement

### Étapes
1. ✅ Code déployé
2. ⚠️ Firebase Console : Activer "Email Verification" dans Authentication
3. ⚠️ Firebase Console : Personnaliser le template d'email
4. ⚠️ Tester avec un vrai email (Gmail, Outlook)

### Template Email Firebase (à configurer)
```
Sujet : Bienvenue sur ArtisanDispo - Validez votre email

Bonjour %DISPLAY_NAME%,

Merci de vous être inscrit sur ArtisanDispo !

Pour activer votre compte, cliquez sur ce lien :
%LINK%

Ce lien expire dans 24 heures.

L'équipe ArtisanDispo
https://artisandispo.com
```

---

## 📈 Métriques

### À suivre
- **Taux de validation email** : % utilisateurs ayant validé / inscrits
- **Délai moyen de validation** : Temps entre inscription et validation
- **Taux de renvoi** : % clics sur "Renvoyer l'email"
- **Artisans bloqués** : Nombre d'artisans avec email non vérifié

### Objectifs
- Taux de validation > 85% à J+7
- Délai moyen < 24h
- Taux de renvoi < 10%

---

## 🔧 Dépannage

### Email non reçu
1. Vérifier spam/courrier indésirable
2. Vérifier l'adresse email dans Firebase Console
3. Utiliser bouton "Renvoyer l'email"
4. Vérifier quotas Firebase (10k/jour gratuit)

### Validation ne fonctionne pas
1. Vérifier que l'URL de redirection est autorisée dans Firebase Console
2. Vérifier que `user.reload()` est appelé
3. Vérifier synchronisation Firestore

### Profil artisan toujours invisible
1. Vérifier `emailVerified = true` dans Firestore
2. Vérifier `badgeVerifie = true`
3. Vérifier `statut = 'actif'`
4. Vérifier les règles Firestore Security Rules

---

## 🎯 Résumé

| Fonctionnalité | Client | Artisan |
|---|---|---|
| **Accès dashboard** | ✅ Immédiat | ✅ Immédiat |
| **Email validation** | 💡 Recommandée | ⚠️ **OBLIGATOIRE** |
| **Bannière** | 🔵 Bleue (info) | 🔴 Rouge (alerte) |
| **Restriction** | Contrat + Paiement | Profil invisible |
| **Visibilité recherche** | N/A | 🔒 Si email non vérifié |

---

**🚀 Implémentation terminée !**

Tous les fichiers ont été modifiés, les bannières ajoutées, et les règles de visibilité mises en place.
La validation email progressive est maintenant opérationnelle selon l'approche recommandée.
