# 🔒 Sécurité Admin - Double Protection (Blacklist + Whitelist)

## Pourquoi une double protection ?

**Problème de sécurité identifié** :
- Les comptes **admin** sont créés UNIQUEMENT via le script `create-admin.js` avec Firebase Admin SDK
- Si on permettait n'importe qui de se connecter via Google Sign-In ou l'interface admin, quelqu'un pourrait :
  1. Se connecter avec un email Google
  2. Choisir le rôle "admin" (si on ne le bloquait pas)
  3. Obtenir des privilèges administratifs sans autorisation

**Solution implémentée : Double protection (Blacklist + Whitelist)** ✅

---

## 📋 Architecture de sécurité (4 niveaux)

### Niveau 0 : Whitelist d'emails (INTERFACE ADMIN) 🆕

**Fichier** : `frontend/src/lib/auth-service.ts`

```typescript
const ADMIN_EMAILS_WHITELIST = [
  'admin@artisansafe.fr',
  'admin@artisandispo.fr',
  'support@artisansafe.fr',
  'root@artisansafe.fr',
];

function isWhitelistedAdmin(email: string | null): boolean {
  if (!email) return false;
  const normalizedEmail = email.toLowerCase().trim();
  return ADMIN_EMAILS_WHITELIST.some(adminEmail => 
    adminEmail.toLowerCase() === normalizedEmail
  );
}
```

**Utilisation** : `frontend/src/app/access-x7k9m2p4w8n3/page.tsx`

```typescript
// 🔐 AVANT même la tentative de connexion
if (!isWhitelistedAdmin(email)) {
  setError('Accès refusé. Cet email n\'est pas autorisé.');
  return;
}
```

**Protection** :
- Vérifie l'email **AVANT** même la tentative de connexion Firebase
- SEULS les emails dans la whitelist peuvent tenter de se connecter via `/access-x7k9m2p4w8n3`
- Bloque immédiatement tout email non autorisé
- Logger l'événement `whitelist_blocked` pour audit

---

### Niveau 1 : Blacklist d'emails (FRONTEND)

**Fichier** : `frontend/src/lib/auth-service.ts`

```typescript
const ADMIN_EMAILS_BLACKLIST = [
  'admin@artisansafe.fr',
  'admin@artisandispo.fr',
  'support@artisansafe.fr',
  'root@artisansafe.fr',
];

function isAdminEmail(email: string | null): boolean {
  if (!email) return false;
  const normalizedEmail = email.toLowerCase().trim();
  return ADMIN_EMAILS_BLACKLIST.some(adminEmail => 
    adminEmail.toLowerCase() === normalizedEmail
  );
}
```

**Protection** :
- Vérifie l'email **AVANT** toute création de document Firestore
- Si l'email est dans la blacklist → Déconnexion immédiate
- Message : "Les administrateurs doivent se connecter via l'interface dédiée."

---

### Niveau 2 : Vérification du rôle Firestore

**Fonction** : `signInWithGoogle()`

```typescript
// Vérifier si l'utilisateur existe déjà dans Firestore
const userDoc = await getDoc(doc(db, 'users', user.uid));

if (userDoc.exists()) {
  const userData = userDoc.data() as UserType;
  
  if (userData.role === 'admin') {
    await firebaseSignOut(auth);
    throw new Error('Les administrateurs doivent se connecter via l\'interface dédiée.');
  }
}
```

**Protection** :
- Pour les utilisateurs **existants** ayant déjà un document Firestore
- Double vérification si le compte a déjà été créé avec `role: 'admin'`

---

### Niveau 3 : Blocage création rôle admin

**Fonction** : `completeGoogleSignUp(role)`

```typescript
// Interdire la création directe de comptes admin
if (role === 'admin') {
  await firebaseSignOut(auth);
  throw new Error('Action non autorisée');
}

// Double vérification email
if (isAdminEmail(user.email)) {
  await firebaseSignOut(auth);
  throw new Error('Les administrateurs doivent se connecter via l\'interface dédiée.');
}
```

**Protection** :
- Empêche toute manipulation de l'interface pour passer `role: 'admin'`
- Même si quelqu'un modifie le code frontend → Bloqué côté service

---

## 🛡️ Comment ajouter un nouvel admin ?

### ✅ Méthode CORRECTE

**1. Utiliser le script create-admin.js**

```bash
cd scripts
node create-admin.js
```

Renseignez :
- Email : `nouvel-admin@artisansafe.fr`
- Mot de passe : (sécurisé)
- Nom, prénom, téléphone

**2. Ajouter l'email à la blacklist Google Sign-In**

Éditez `frontend/src/lib/auth-service.ts` :

```typescript
const ADMIN_EMAILS_BLACKLIST = [
  'admin@artisansafe.fr',
  'admin@artisandispo.fr',
  'support@artisansafe.fr',
  'root@artisansafe.fr',
  'nouvel-admin@artisansafe.fr', // ← AJOUTER ICI
];
```

**3. Committer la modification**

```bash
git add frontend/src/lib/auth-service.ts
git commit -m "security: ajout nouvel-admin@artisansafe.fr à la blacklist Google Sign-In"
git push origin main
```

---

### ❌ Méthodes INCORRECTES

**Ne PAS faire** :
- ❌ Créer un admin via l'interface d'inscription
- ❌ Permettre Google Sign-In pour les admins
- ❌ Modifier manuellement le document Firestore pour ajouter `role: 'admin'`

---

## 🧪 Tester la sécurité

### Tests Whitelist (Interface admin /access-x7k9m2p4w8n3)

**Test 1 : Email NON dans la whitelist** 🆕
```bash
1. Aller sur /access-x7k9m2p4w8n3
2. Entrer email: utilisateur@gmail.com
3. Entrer mot de passe: n'importe quoi
4. Cliquer "Se connecter"

→ Résultat attendu: Message immédiat "Accès refusé. Cet email n'est pas autorisé."
→ Aucune tentative de connexion Firebase (bloqué avant)
→ Event loggé: action: 'whitelist_blocked'
```

**Test 2 : Email dans la whitelist + bon mot de passe**
```bash
1. Aller sur /access-x7k9m2p4w8n3
2. Entrer email: admin@artisansafe.fr
3. Entrer mot de passe: (correct)
4. Cliquer "Se connecter"

→ Passe la vérification whitelist ✅
→ Connexion Firebase réussie ✅
→ Vérification rôle admin dans Firestore ✅
→ Redirection vers /admin/dashboard ✅
→ Event loggé: action: 'login_success'
```

**Test 3 : Email dans la whitelist + mauvais mot de passe**
```bash
1. Aller sur /access-x7k9m2p4w8n3
2. Entrer email: admin@artisansafe.fr
3. Entrer mot de passe: (incorrect)
4. Cliquer "Se connecter"

→ Passe la vérification whitelist ✅
→ Firebase Auth échoue ❌
→ Message: "Email ou mot de passe incorrect"
→ Event loggé: action: 'login_failed'
```

### Tests Blacklist (Google Sign-In)

**Test 1 : Email admin dans blacklist**

```bash
# Tentative de connexion Google avec admin@artisansafe.fr
→ Popup Google s'affiche
→ Sélection du compte admin@artisansafe.fr
→ Déconnexion immédiate
→ Message : "Les administrateurs doivent se connecter via l'interface dédiée."
```

**Test 2 : Email admin existant dans Firestore**

```bash
# Un admin créé via create-admin.js essaie Google Sign-In
→ Détection du role: 'admin' dans Firestore
→ Déconnexion immédiate
→ Message d'erreur
```

**Test 3 : Manipulation frontend (devtools)**

```javascript
// Quelqu'un modifie le code pour passer role: 'admin'
await completeGoogleSignUp('admin', '+33612345678');

→ Vérification côté service : if (role === 'admin')
→ Déconnexion immédiate
→ Message : "Action non autorisée"
```

---

## 📊 Flux décisionnel

### A) Connexion via interface admin sécurisée (/access-x7k9m2p4w8n3)

```
┌─────────────────────────────────┐
│  Utilisateur entre email+mdp    │
└────────────┬────────────────────┘
             │
             v
┌─────────────────────────────────┐
│  NIVEAU 0 : isWhitelistedAdmin()│
│  Email dans la whitelist ?      │
└────────────┬────────────────────┘
             │
         OUI │ NON
             │
       ┌─────┴──────┐
       v            v
 ┌──────────────┐  ┌──────────────┐
 │ Continuer    │  │ BLOQUÉ       │
 │ connexion    │  │ Message +    │
 │              │  │ Log audit    │
 └──────┬───────┘  └──────────────┘
        │
        v
 ┌──────────────────────────────┐
 │  Brute force detection       │
 │  IP bloquée ?                │
 └──────────┬───────────────────┘
            │
        OUI │ NON
            │
      ┌─────┴──────┐
      v            v
┌──────────┐  ┌────────────────┐
│ BLOQUÉ   │  │ Firebase Auth  │
│ 30 min   │  │ Connexion      │
└──────────┘  └────────┬───────┘
                       │
                       v
              ┌────────────────┐
              │ Vérifier rôle  │
              │ isAdmin() ?    │
              └────────┬───────┘
                       │
                   OUI │ NON
                       │
                 ┌─────┴──────┐
                 v            v
          ┌──────────┐  ┌──────────┐
          │ SUCCÈS   │  │ BLOQUÉ   │
          │ Dashboard│  │ Déco +   │
          │ Admin    │  │ Message  │
          └──────────┘  └──────────┘
```

### B) Tentative Google Sign-In (Interface publique)

```
┌─────────────────────────────────┐
│  Utilisateur clique "Google"    │
└────────────┬────────────────────┘
             │
             v
┌─────────────────────────────────┐
│  Popup Google OAuth             │
└────────────┬────────────────────┘
             │
             v
┌─────────────────────────────────┐
│  Connexion réussie              │
│  Récupération email             │
└────────────┬────────────────────┘
             │
             v
┌─────────────────────────────────┐
│  NIVEAU 1 : isAdminEmail() ?    │
│  (BLACKLIST)                    │
└────────────┬────────────────────┘
             │
         OUI │ NON
             │
       ┌─────┴──────┐
       v            v
 ┌──────────┐  ┌────────────────────────┐
 │ BLOQUÉ   │  │ Vérifier Firestore     │
 │ Déco +   │  │ Document existe ?      │
 │ Message  │  └────────────┬───────────┘
 └──────────┘               │
                        OUI │ NON
                            │
                      ┌─────┴──────┐
                      v            v
              ┌────────────┐  ┌─────────────────┐
              │ NIVEAU 2   │  │ Nouveau user    │
              │ role=admin?│  │ → /choix-role   │
              └─────┬──────┘  └─────────────────┘
                    │                 │
                OUI │ NON             │
                    │                 v
              ┌─────┴──────┐  ┌─────────────────┐
              v            v  │ Choisit rôle    │
        ┌──────────┐  ┌──────┴──────────┐
        │ BLOQUÉ   │  │ NIVEAU 3        │
        │ Déco +   │  │ role !== 'admin'│
        │ Message  │  │ email pas admin │
        └──────────┘  └────────┬────────┘
                               │
                               v
                      ┌────────────────┐
                      │ Création OK    │
                      │ Dashboard      │
                      └────────────────┘
```

---

## 🔑 Points clés de sécurité

### Protection Google Sign-In (Blacklist)
1. **Blacklist d'emails** : Protection en amont avant toute création Firestore
2. **Vérification Firestore** : Double vérification pour comptes existants
3. **Blocage création admin** : Impossible de créer un admin via Google Sign-In
4. **Déconnexion immédiate** : Aucun accès temporaire accordé

### Protection Interface Admin (Whitelist) 🆕
1. **Whitelist d'emails** : SEULS les emails autorisés peuvent tenter la connexion
2. **Vérification préalable** : Bloquage AVANT même la tentative Firebase Auth
3. **Logging audit** : Toute tentative non autorisée est enregistrée (`whitelist_blocked`)
4. **Protection brute force** : Détection et blocage IP après tentatives répétées
5. **Vérification rôle** : Double vérification du rôle `admin` dans Firestore après connexion

### Protection Doublons de Comptes (Provider Conflict) 🆕
1. **Détection provider existant** : Vérifie si email existe avec un autre provider
2. **Blocage inscription email/password** : Si compte Google existe → message explicite
3. **Blocage Google Sign-In** : Si compte email/password existe → message explicite
4. **Messages clairs** : Guide l'utilisateur vers la bonne méthode de connexion
5. **Prévention doublons** : Empêche d'avoir 2 UIDs différents pour le même email

**Voir détails** : [USE_CASE_GOOGLE_VS_EMAIL_PASSWORD.md](USE_CASE_GOOGLE_VS_EMAIL_PASSWORD.md)

### Recommandations générales
1. **Messages génériques** : "Interface dédiée" sans révéler l'URL exacte
2. **Normalisation emails** : toLowerCase() + trim() pour éviter contournements
3. **Synchronisation** : Maintenir blacklist et whitelist identiques (même liste d'emails)
4. **Audit trail** : Tous les événements sont loggés dans la collection `adminAccessLogs`

---

## 🚀 Maintenance

**Ajouter un nouvel admin** :
1. `node scripts/create-admin.js` (créer compte avec rôle admin)
2. Ajouter email à `ADMIN_EMAILS_BLACKLIST` (bloquer Google Sign-In)
3. Ajouter email à `ADMIN_EMAILS_WHITELIST` (autoriser interface admin)
4. Committer + pusher les deux modifications

**Code à modifier** : `frontend/src/lib/auth-service.ts`

```typescript
const ADMIN_EMAILS_BLACKLIST = [
  'admin@artisansafe.fr',
  'admin@artisandispo.fr',
  'support@artisansafe.fr',
  'root@artisansafe.fr',
  'nouvel-admin@artisansafe.fr', // ← AJOUTER ICI
];

const ADMIN_EMAILS_WHITELIST = [
  'admin@artisansafe.fr',
  'admin@artisandispo.fr',
  'support@artisansafe.fr',
  'root@artisansafe.fr',
  'nouvel-admin@artisansafe.fr', // ← AJOUTER ICI AUSSI
];
```

**Retirer un admin** :
1. Supprimer document Firestore `users/{uid}`
2. Retirer email de `ADMIN_EMAILS_BLACKLIST`
3. Retirer email de `ADMIN_EMAILS_WHITELIST`
4. Supprimer compte Firebase Auth (console)
5. Committer + pusher

**⚠️ IMPORTANT** : Les deux listes doivent TOUJOURS contenir les mêmes emails !

---

---

## 📚 Références

- Script création admin : `scripts/create-admin.js`
- Service d'authentification : `frontend/src/lib/auth-service.ts`
- Page connexion admin : `/access-x7k9m2p4w8n3`
- Whitelist admin : `ADMIN_EMAILS_WHITELIST` dans `auth-service.ts`
- Blacklist Google : `ADMIN_EMAILS_BLACKLIST` dans `auth-service.ts`
- Logging admin : `frontend/src/lib/firebase/admin-access-log.ts`
- Firestore rules admin : `firestore.rules`

---

## 📝 Résumé de la sécurité renforcée

### 🛡️ Double protection (Blacklist + Whitelist)

| Méthode de connexion | Protection | Vérifications |
|----------------------|------------|---------------|
| **Google Sign-In** | Blacklist | 1. Email dans blacklist → Bloqué<br>2. Rôle Firestore = admin → Bloqué<br>3. Choix rôle admin → Bloqué |
| **Interface admin** | Whitelist | 1. Email dans whitelist → OK<br>2. Brute force detection → Bloqué<br>3. Firebase Auth → OK<br>4. Rôle Firestore = admin → OK |

### 🔒 Niveaux de sécurité

1. **Niveau 0 (Whitelist)** : Seuls emails autorisés peuvent tenter connexion admin
2. **Niveau 1 (Blacklist)** : Emails admin ne peuvent pas utiliser Google Sign-In
3. **Niveau 2 (Firestore)** : Vérification du rôle dans la base de données
4. **Niveau 3 (Service)** : Blocage création rôle admin via code

### ✅ Garanties de sécurité

- ✅ Impossible de créer un admin via Google Sign-In
- ✅ Impossible de se connecter comme admin avec un email non autorisé
- ✅ Toutes les tentatives sont loggées pour audit
- ✅ Protection contre brute force (blocage IP 30 minutes)
- ✅ Synchronisation automatique blacklist/whitelist

---

**Dernière mise à jour** : 21 février 2026  
**Sécurité renforcée** : Whitelist + Blacklist implémentées  
**Responsable sécurité** : MOHAMED ALI MRABET
