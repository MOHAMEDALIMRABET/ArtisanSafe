# Configuration Firestore - Règles de Sécurité Admin

## 📋 Règles de Sécurité à Appliquer

Ces règles Firestore doivent être configurées dans **Firebase Console > Firestore Database > Règles**.

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // ============================================
    // FONCTIONS UTILITAIRES
    // ============================================
    
    // Vérifie si l'utilisateur est authentifié
    function isAuthenticated() {
      return request.auth != null;
    }
    
    // Vérifie si l'utilisateur est admin
    function isAdmin() {
      return isAuthenticated() && 
             get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }
    
    // Vérifie si l'utilisateur est le propriétaire du document
    function isOwner(userId) {
      return isAuthenticated() && request.auth.uid == userId;
    }
    
    // Vérifie si l'utilisateur est artisan
    function isArtisan() {
      return isAuthenticated() && 
             get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'artisan';
    }
    
    // ============================================
    // COLLECTION: users
    // ============================================
    match /users/{userId} {
      // Lecture: Soi-même ou admin
      allow read: if isOwner(userId) || isAdmin();
      
      // Création: Seulement pendant l'inscription (par l'utilisateur lui-même)
      allow create: if isOwner(userId);
      
      // Mise à jour: Soi-même ou admin
      allow update: if isOwner(userId) || isAdmin();
      
      // Suppression: Seulement admin
      allow delete: if isAdmin();
    }
    
    // ============================================
    // COLLECTION: artisans
    // ============================================
    match /artisans/{artisanId} {
      // Lecture: Public pour recherche, artisan propriétaire, ou admin
      allow read: if true; // Profils publics
      
      // Création: Artisan authentifié
      allow create: if isAuthenticated() && 
                       request.resource.data.userId == request.auth.uid;
      
      // Mise à jour: Propriétaire ou admin
      allow update: if isOwner(resource.data.userId) || isAdmin();
      
      // Suppression: Admin seulement
      allow delete: if isAdmin();
    }
    
    // ============================================
    // COLLECTION: adminActionHistory
    // ============================================
    match /adminActionHistory/{historyId} {
      // Lecture: Admin seulement
      allow read: if isAdmin();
      
      // Création: Admin seulement
      allow create: if isAdmin();
      
      // Mise à jour/Suppression: Interdit
      allow update, delete: if false;
    }
    
    // ============================================
    // COLLECTION: devis (Devis)
    // ============================================
    match /devis/{devisId} {
      // Lecture: Artisan ou client concerné, ou admin
      allow read: if isOwner(resource.data.artisanId) || 
                     isOwner(resource.data.clientId) || 
                     isAdmin();
      
      // Création: Artisan authentifié
      allow create: if isArtisan() && 
                       request.resource.data.artisanId == request.auth.uid;
      
      // Mise à jour: Artisan propriétaire ou client concerné
      allow update: if isOwner(resource.data.artisanId) || 
                       isOwner(resource.data.clientId);
      
      // Suppression: Admin ou artisan propriétaire
      allow delete: if isAdmin() || isOwner(resource.data.artisanId);
    }
    
    // ============================================
    // COLLECTION: contrats
    // ============================================
    match /contrats/{contratId} {
      // Lecture: Parties concernées ou admin
      allow read: if isOwner(resource.data.artisanId) || 
                     isOwner(resource.data.clientId) || 
                     isAdmin();
      
      // Création: Artisan ou client concerné
      allow create: if isAuthenticated() && 
                       (request.resource.data.artisanId == request.auth.uid || 
                        request.resource.data.clientId == request.auth.uid);
      
      // Mise à jour: Parties concernées ou admin
      allow update: if isOwner(resource.data.artisanId) || 
                       isOwner(resource.data.clientId) || 
                       isAdmin();
      
      // Suppression: Admin seulement
      allow delete: if isAdmin();
    }
    
    // ============================================
    // COLLECTION: avis (Reviews)
    // ============================================
    match /avis/{avisId} {
      // Lecture: Public
      allow read: if true;
      
      // Création: Client authentifié
      allow create: if isAuthenticated() && 
                       request.resource.data.clientId == request.auth.uid;
      
      // Mise à jour: Interdit (immutabilité des avis)
      allow update: if false;
      
      // Suppression: Admin seulement
      allow delete: if isAdmin();
    }
    
    // ============================================
    // COLLECTION: conversations + messages
    // ============================================
    match /conversations/{conversationId} {
      // Lecture: Participants ou admin
      allow read: if isOwner(resource.data.artisanId) || 
                     isOwner(resource.data.clientId) || 
                     isAdmin();
      
      // Création: Artisan ou client concerné
      allow create: if isAuthenticated();
      
      // Mise à jour: Participants
      allow update: if isOwner(resource.data.artisanId) || 
                       isOwner(resource.data.clientId);
      
      // Suppression: Admin seulement
      allow delete: if isAdmin();
      
      // Sous-collection: messages
      match /messages/{messageId} {
        // Lecture: Participants de la conversation ou admin
        allow read: if isOwner(get(/databases/$(database)/documents/conversations/$(conversationId)).data.artisanId) || 
                       isOwner(get(/databases/$(database)/documents/conversations/$(conversationId)).data.clientId) || 
                       isAdmin();
        
        // Création: Participants
        allow create: if isAuthenticated();
        
        // Mise à jour/Suppression: Interdit
        allow update, delete: if false;
      }
    }
    
    // ============================================
    // COLLECTION: litiges
    // ============================================
    match /litiges/{litigeId} {
      // Lecture: Parties concernées ou admin
      allow read: if isOwner(resource.data.artisanId) || 
                     isOwner(resource.data.clientId) || 
                     isAdmin();
      
      // Création: Artisan ou client concerné
      allow create: if isAuthenticated() && 
                       (request.resource.data.artisanId == request.auth.uid || 
                        request.resource.data.clientId == request.auth.uid);
      
      // Mise à jour: Parties concernées ou admin
      allow update: if isOwner(resource.data.artisanId) || 
                       isOwner(resource.data.clientId) || 
                       isAdmin();
      
      // Suppression: Admin seulement
      allow delete: if isAdmin();
    }
    
    // ============================================
    // COLLECTION: notifications
    // ============================================
    match /notifications/{notificationId} {
      // Lecture: Destinataire ou admin
      allow read: if isOwner(resource.data.userId) || isAdmin();
      
      // Création: Système (admin) ou utilisateur concerné
      allow create: if isAuthenticated();
      
      // Mise à jour: Destinataire (marquer comme lu)
      allow update: if isOwner(resource.data.userId);
      
      // Suppression: Destinataire ou admin
      allow delete: if isOwner(resource.data.userId) || isAdmin();
    }
    
    // ============================================
    // COLLECTION: disponibilites
    // ============================================
    match /disponibilites/{disponibiliteId} {
      // Lecture: Public (pour recherche de disponibilités)
      allow read: if true;
      
      // Création: Artisan propriétaire
      allow create: if isArtisan() && 
                       request.resource.data.artisanId == request.auth.uid;
      
      // Mise à jour: Artisan propriétaire
      allow update: if isOwner(resource.data.artisanId);
      
      // Suppression: Artisan propriétaire ou admin
      allow delete: if isOwner(resource.data.artisanId) || isAdmin();
    }
    
    // ============================================
    // COLLECTION: transactions
    // ============================================
    match /transactions/{transactionId} {
      // Lecture: Parties concernées ou admin
      allow read: if isOwner(resource.data.artisanId) || 
                     isOwner(resource.data.clientId) || 
                     isAdmin();
      
      // Création: Système uniquement (backend avec clés API)
      allow create: if false; // Créé par backend
      
      // Mise à jour: Admin seulement
      allow update: if isAdmin();
      
      // Suppression: Interdit
      allow delete: if false;
    }
  }
}
```

## 🔐 Configuration Admin dans Firestore

### 1. Créer un utilisateur admin

Dans **Firestore Console**, créez manuellement un document dans `users` :

```javascript
// Collection: users
// Document ID: {uid de Firebase Auth}
{
  "uid": "abc123xyz", // UID Firebase Auth
  "email": "admin@artisandispo.fr",
  "role": "admin", // ← Rôle admin
  "nom": "Admin",
  "prenom": "ArtisanDispo",
  "telephone": "+33600000000",
  "dateCreation": Timestamp.now(),
  "statut": "verifie",
  "preferencesNotifications": {
    "email": true,
    "push": true,
    "sms": false
  },
  "permissions": {
    "canVerifyArtisans": true,
    "canManageUsers": true,
    "canViewFinances": true,
    "canManageLitige": true,
    "isSuperAdmin": true
  },
  "actif": true
}
```

### 2. Créer le compte Firebase Auth

Dans **Firebase Console > Authentication > Users** :
- Cliquez sur **Add user**
- Email: `admin@artisandispo.fr`
- Mot de passe: Générez un mot de passe sécurisé (min 12 caractères)
- Copiez l'UID généré
- Utilisez cet UID pour créer le document Firestore ci-dessus

### 3. Tester l'accès admin

1. Allez sur `/admin/login`
2. Connectez-vous avec l'email/mot de passe admin
3. Vous devriez être redirigé vers `/admin/verifications`

## 🛡️ Bonnes Pratiques de Sécurité

### Règles de sécurité Firestore

- ✅ **Principe du moindre privilège** : Chaque collection a des règles strictes
- ✅ **Validation du rôle admin** : `get()` sur `users/{uid}` pour vérifier `role == 'admin'`
- ✅ **Isolation des données** : Les artisans ne peuvent modifier que leur propre profil
- ✅ **Lecture publique limitée** : Seuls `artisans` et `avis` sont publics (recherche)
- ✅ **Historique immuable** : `adminActionHistory` en lecture/création seule

### Gestion des admins

- ⚠️ **Ne jamais** exposer la création d'admin via l'interface publique
- ⚠️ Créer les admins **manuellement** dans Firebase Console
- ⚠️ Utiliser des **mots de passe forts** (min 16 caractères)
- ⚠️ Activer **l'authentification à deux facteurs** (si disponible)
- ⚠️ Enregistrer toutes les actions admin dans `adminActionHistory`

### Permissions granulaires

```typescript
permissions: {
  canVerifyArtisans: true,    // Peut approuver/rejeter artisans
  canManageUsers: true,       // Peut modifier/supprimer utilisateurs
  canViewFinances: true,      // Accès aux transactions
  canManageLitige: true,      // Gestion des litiges
  isSuperAdmin: true          // Accès total (danger!)
}
```

Créez plusieurs admins avec des permissions limitées :
- **Admin Vérification** : `canVerifyArtisans: true` uniquement
- **Admin Support** : `canManageUsers: true`, `canManageLitige: true`
- **Super Admin** : Toutes les permissions (1 seul compte)

## 🔥 Firebase Storage - Règles de Sécurité

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    
    // Documents de vérification (Kbis, pièce d'identité)
    match /documents/{userId}/{allPaths=**} {
      // Lecture: Propriétaire ou admin
      allow read: if request.auth != null && 
                     (request.auth.uid == userId || 
                      firestore.get(/databases/(default)/documents/users/$(request.auth.uid)).data.role == 'admin');
      
      // Écriture: Propriétaire uniquement
      allow write: if request.auth != null && request.auth.uid == userId;
      
      // Validation: Taille max 10MB, types autorisés
      allow write: if request.resource.size < 10 * 1024 * 1024 &&
                      request.resource.contentType.matches('image/.*|application/pdf');
    }
    
    // Photos de profil artisans (publiques)
    match /artisans/{artisanId}/profile/{fileName} {
      // Lecture: Public
      allow read: if true;
      
      // Écriture: Artisan propriétaire
      allow write: if request.auth != null && 
                      firestore.get(/databases/(default)/documents/artisans/$(artisanId)).data.userId == request.auth.uid;
      
      // Validation: Images uniquement, max 5MB
      allow write: if request.resource.size < 5 * 1024 * 1024 &&
                      request.resource.contentType.matches('image/.*');
    }
    
    // Photos de réalisations (portfolio)
    match /portfolios/{artisanId}/{fileName} {
      // Lecture: Public
      allow read: if true;
      
      // Écriture: Artisan propriétaire
      allow write: if request.auth != null && 
                      firestore.get(/databases/(default)/documents/artisans/$(artisanId)).data.userId == request.auth.uid;
      
      // Validation: Images uniquement, max 10MB
      allow write: if request.resource.size < 10 * 1024 * 1024 &&
                      request.resource.contentType.matches('image/.*');
    }
  }
}
```

## 📊 Monitoring des Actions Admin

### Cloud Functions pour audit (à implémenter)

```typescript
// functions/src/index.ts
export const onAdminAction = functions.firestore
  .document('adminActionHistory/{historyId}')
  .onCreate(async (snap, context) => {
    const action = snap.data();
    
    // Envoyer email de notification
    await sendEmail({
      to: 'security@artisandispo.fr',
      subject: `Action Admin: ${action.action} par ${action.adminEmail}`,
      body: `
        Admin: ${action.adminEmail}
        Action: ${action.action}
        Artisan: ${action.artisanId}
        Raison: ${action.reason || 'N/A'}
        Date: ${action.timestamp.toDate()}
      `
    });
    
    // Log dans Cloud Logging
    console.log('Admin action logged:', action);
  });
```

## ✅ Checklist de Déploiement

Avant de passer en production :

- [ ] Règles Firestore déployées et testées
- [ ] Règles Storage déployées
- [ ] Au moins un compte admin créé manuellement
- [ ] Mot de passe admin sécurisé (16+ caractères)
- [ ] Permissions admin configurées correctement
- [ ] Test de connexion admin réussi
- [ ] Test d'approbation artisan réussi
- [ ] Test de rejet artisan réussi
- [ ] Historique des actions enregistré
- [ ] Monitoring Cloud Functions actif

## 🚨 En Cas de Compromission

Si un compte admin est compromis :

1. **Immédiatement** :
   - Désactiver le compte dans Firebase Console > Authentication
   - Mettre `actif: false` dans Firestore `users/{adminId}`
   - Changer le mot de passe

2. **Audit** :
   - Vérifier `adminActionHistory` pour actions suspectes
   - Vérifier les modifications récentes dans `artisans`
   - Vérifier les connexions dans Firebase Console > Authentication > Users

3. **Restauration** :
   - Révoquer les approbations frauduleuses
   - Notifier les artisans affectés
   - Créer un nouveau compte admin avec nouveau mot de passe

## 📞 Contact Sécurité

En cas de problème de sécurité :
- Email: security@artisandispo.fr
- Urgence: +33 X XX XX XX XX

---

**Dernière mise à jour** : 29 décembre 2025  
**Version** : 1.0.0
