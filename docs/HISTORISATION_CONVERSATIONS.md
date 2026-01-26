# 🛡️ Système d'Historisation des Conversations - Guide Complet

## Vue d'ensemble

Le système d'historisation des conversations garantit que **tous les messages échangés entre clients et artisans sont enregistrés de manière permanente** dans Firebase Firestore pour permettre la résolution de litiges par les administrateurs.

## 🎯 Objectifs

1. **Archive complète** : Aucun message ne peut être supprimé (protection Firestore Rules)
2. **Accès admin** : Les administrateurs peuvent consulter tout l'historique
3. **Traçabilité** : Chaque message est horodaté avec identité du sender
4. **Marquage litige** : Système de flagging pour identifier les conversations problématiques
5. **Export** : Possibilité d'exporter les conversations en PDF (à venir)

---

## 📊 Architecture de la Base de Données

### Collection `conversations`

Stocke les métadonnées de chaque conversation entre un client et un artisan.

**Structure :**
```typescript
{
  id: string;                          // ID Firestore auto-généré
  participants: string[];              // [userId_client, userId_artisan]
  participantNames: {                  // Cache des noms pour affichage rapide
    [userId]: string;                  // "Prénom Nom"
  };
  lastMessage: string;                 // Dernier message (max 100 caractères)
  lastMessageDate: Timestamp;          // Horodatage du dernier message
  unreadCount: {                       // Compteur de messages non lus par utilisateur
    [userId]: number;
  };
  
  // Champs litige (optionnels)
  litige?: boolean;                    // true si conversation marquée comme litige
  litigeDate?: Timestamp;              // Date de marquage du litige
  litigeDescription?: string;          // Motif du litige (libre)
  litigeMarkedBy?: string;             // UID de l'admin qui a marqué
}
```

**Exemple :**
```json
{
  "id": "conv_abc123",
  "participants": ["client_xyz", "artisan_789"],
  "participantNames": {
    "client_xyz": "Jean Dupont",
    "artisan_789": "Marie Martin"
  },
  "lastMessage": "Bonjour, quand pouvez-vous commencer les travaux ?",
  "lastMessageDate": "2026-01-26T10:30:00Z",
  "unreadCount": {
    "artisan_789": 1
  },
  "litige": true,
  "litigeDate": "2026-01-27T14:00:00Z",
  "litigeDescription": "Non-paiement après fin de chantier",
  "litigeMarkedBy": "admin_001"
}
```

---

### Collection `messages`

Stocke **tous les messages** échangés dans les conversations. **Aucune suppression possible**.

**Structure :**
```typescript
{
  id: string;                    // ID Firestore auto-généré
  conversationId: string;        // Référence vers la conversation
  senderId: string;              // UID de l'expéditeur
  receiverId: string;            // UID du destinataire
  content: string;               // Contenu du message (texte)
  createdAt: Timestamp;          // Horodatage de création
  read: boolean;                 // true si lu par le destinataire
}
```

**Exemple :**
```json
{
  "id": "msg_def456",
  "conversationId": "conv_abc123",
  "senderId": "client_xyz",
  "receiverId": "artisan_789",
  "content": "Bonjour, quand pouvez-vous commencer les travaux ?",
  "createdAt": "2026-01-26T10:30:00Z",
  "read": false
}
```

---

## 🔐 Règles de Sécurité Firestore

Les règles garantissent la protection des données tout en permettant l'accès admin pour les litiges.

### Règles `conversations`

```javascript
match /conversations/{conversationId} {
  // Lecture : participants OU admin
  allow read: if isAdmin() || 
                 (isAuthenticated() && request.auth.uid in resource.data.participants);
  
  // Création : participants uniquement
  allow create: if isAuthenticated() && 
                   request.auth.uid in request.resource.data.participants;
  
  // Modification : participants OU admin (pour marquage litige)
  allow update: if isAdmin() ||
                   (isAuthenticated() && request.auth.uid in resource.data.participants);
  
  // Suppression : JAMAIS - archive obligatoire
  allow delete: if false;
}
```

### Règles `messages`

```javascript
match /messages/{messageId} {
  // Lecture : tous les utilisateurs authentifiés OU admin
  allow read: if isAdmin() || isAuthenticated();
  
  // Création : expéditeur uniquement
  allow create: if isAuthenticated() &&
                   request.auth.uid == request.resource.data.senderId;
  
  // Modification : expéditeur (marquer comme lu) OU admin
  allow update: if isOwner(resource.data.senderId) || isAdmin();
  
  // Suppression : JAMAIS - archive obligatoire
  allow delete: if false;
}
```

**⚠️ Point critique :** `allow delete: if false` empêche TOUTE suppression, même par les admins via l'interface. Les suppressions doivent se faire manuellement via la console Firebase si absolument nécessaire (RGPD uniquement).

---

## 🖥️ Interface Admin - Page Litiges

L'interface admin (`/admin/litiges`) permet de consulter et gérer les conversations.

### Fonctionnalités

#### 1. **Vue globale des conversations**
- Liste toutes les conversations de la plateforme
- Affiche les noms complets des participants (Prénom + Nom)
- Affiche le rôle (client/artisan)
- Indique les conversations marquées comme litige (badge rouge 🚨)
- Tri par date décroissante (derniers messages en premier)

#### 2. **Filtres et recherche**
- **Recherche** : Par nom, email, ou ID de conversation
- **Filtre statut** :
  - Toutes les conversations
  - Litiges uniquement
  - Conversations normales

#### 3. **Historique complet**
- Affichage chronologique de tous les messages
- Distinction visuelle client/artisan (couleurs différentes)
- Horodatage de chaque message
- Nom complet + rôle de l'expéditeur

#### 4. **Marquage litige**
- Bouton "Marquer comme litige"
- Modal pour décrire le motif du litige
- Enregistrement dans Firestore :
  - `litige: true`
  - `litigeDate: Timestamp.now()`
  - `litigeDescription: "..."`
  - `litigeMarkedBy: admin_uid`

#### 5. **Retrait marquage litige**
- Bouton "Retirer litige" si déjà marqué
- Confirmation avant action
- Réinitialisation des champs litige

#### 6. **Export PDF** (à venir)
- Bouton "Exporter PDF"
- Génération d'un PDF complet de la conversation
- Inclut : ID conversation, participants, tous les messages, marquage litige

---

## 🚀 Accès à l'Interface

### Pour les administrateurs

1. **Se connecter** sur `/admin/login`
2. **Dashboard** : `/admin/dashboard`
3. **Cliquer** sur la carte "Litiges & Conversations"
4. Ou accéder directement à `/admin/litiges`

---

## 📋 Cas d'Usage Typiques

### Scénario 1 : Client se plaint d'un artisan

1. Client contacte le support : "L'artisan a abandonné le chantier"
2. Admin va sur `/admin/litiges`
3. Admin recherche le nom du client ou de l'artisan
4. Admin sélectionne la conversation
5. Admin consulte l'historique complet
6. Admin clique sur "Marquer comme litige"
7. Admin décrit : "Abandon de chantier confirmé par le client"
8. Conversation marquée avec badge rouge 🚨

### Scénario 2 : Artisan conteste un non-paiement

1. Artisan signale un client qui ne paie pas
2. Admin recherche la conversation
3. Admin vérifie l'historique des messages
4. Admin confirme les accords de paiement dans les messages
5. Admin marque comme litige : "Non-paiement après fin de travaux"
6. Admin peut exporter le PDF pour le service juridique

### Scénario 3 : Résolution d'un malentendu

1. Admin consulte une conversation marquée comme litige
2. Admin lit l'historique complet
3. Admin constate qu'il s'agit d'un malentendu
4. Admin clique sur "Retirer litige"
5. Conversation retourne à l'état normal

---

## 🔍 Détails Techniques

### Chargement des conversations

**Code :**
```typescript
const q = query(collection(db, 'conversations'));
const querySnapshot = await getDocs(q);

const convs: Conversation[] = [];
querySnapshot.forEach((doc) => {
  const data = doc.data();
  convs.push({ id: doc.id, ...data });
});

// Tri client-side (évite index Firebase composite)
convs.sort((a, b) => {
  const dateA = a.lastMessageDate?.toMillis() || 0;
  const dateB = b.lastMessageDate?.toMillis() || 0;
  return dateB - dateA;
});
```

### Chargement des messages

**Code :**
```typescript
const q = query(
  collection(db, 'messages'),
  where('conversationId', '==', conversationId)
);

const querySnapshot = await getDocs(q);
const msgs: Message[] = [];

querySnapshot.forEach((doc) => {
  msgs.push({ id: doc.id, ...doc.data() } as Message);
});

// Tri client-side (ordre chronologique)
msgs.sort((a, b) => {
  const dateA = a.createdAt?.toMillis() || 0;
  const dateB = b.createdAt?.toMillis() || 0;
  return dateA - dateB;
});
```

**⚠️ Important :** Pas d'`orderBy()` dans les requêtes Firestore pour éviter les index composites.

### Marquage litige

**Code :**
```typescript
await updateDoc(doc(db, 'conversations', conversationId), {
  litige: true,
  litigeDate: Timestamp.now(),
  litigeDescription: "Motif du litige",
  litigeMarkedBy: admin.uid,
});
```

---

## 📊 Statistiques et Monitoring

### Statistiques disponibles

- **Total conversations** : Nombre total de conversations
- **Conversations litige** : Nombre de conversations marquées comme litige
- **Conversations normales** : Conversations sans litige

### Affichage

```typescript
<option value="all">Toutes ({conversations.length})</option>
<option value="litige">Litiges ({conversations.filter(c => c.litige).length})</option>
<option value="normal">Normales ({conversations.filter(c => !c.litige).length})</option>
```

---

## 🛠️ Maintenance et Support

### Vérification de l'intégrité des données

**Script de vérification** (à exécuter périodiquement) :
```typescript
// Vérifier que tous les messages ont une conversation valide
const messagesSnapshot = await getDocs(collection(db, 'messages'));
const conversationsSnapshot = await getDocs(collection(db, 'conversations'));

const conversationIds = new Set(conversationsSnapshot.docs.map(d => d.id));

messagesSnapshot.docs.forEach(msgDoc => {
  const msg = msgDoc.data();
  if (!conversationIds.has(msg.conversationId)) {
    console.error(`❌ Message orphelin: ${msgDoc.id}`);
  }
});
```

### Nettoyage RGPD (cas exceptionnels)

Si un utilisateur demande la suppression de ses données (droit à l'oubli) :

1. **Identifier les conversations** de l'utilisateur
2. **Anonymiser les messages** (remplacer senderId/receiverId par "DELETED_USER")
3. **Ne pas supprimer** les messages eux-mêmes (archive légale)
4. **Marquer la conversation** avec un flag `rgpdDeletion: true`

**Code :**
```typescript
// Anonymiser les messages d'un utilisateur
const messagesQuery = query(
  collection(db, 'messages'),
  where('senderId', '==', userId)
);

const snapshot = await getDocs(messagesQuery);
snapshot.docs.forEach(async (doc) => {
  await updateDoc(doc.ref, {
    senderId: 'DELETED_USER',
    content: '[Message supprimé - RGPD]'
  });
});
```

---

## 📈 Évolutions Futures

### Fonctionnalités prévues

1. **Export PDF automatique**
   - Génération de PDF complet de la conversation
   - Inclusion des métadonnées (dates, participants, litige)
   - Signature numérique pour valeur légale

2. **Système de tags**
   - Tags personnalisés pour catégoriser les litiges
   - Ex: "non-paiement", "abandon", "malfaçons", "retard"

3. **Notifications admin**
   - Alerte automatique quand un artisan/client signale un problème
   - Dashboard avec compteur de litiges non traités

4. **Recherche avancée**
   - Recherche fulltext dans le contenu des messages
   - Filtres par date, participant, tag

5. **Statistiques avancées**
   - Graphiques d'évolution des litiges
   - Taux de résolution
   - Temps moyen de traitement

---

## 🔗 Liens Utiles

- **Interface admin** : `/admin/litiges`
- **Dashboard admin** : `/admin/dashboard`
- **Documentation Firestore Rules** : `firestore.rules`
- **Code source interface** : `frontend/src/app/admin/litiges/page.tsx`

---

## ✅ Checklist de Vérification

Pour vérifier que le système fonctionne correctement :

- [ ] Les conversations sont visibles dans `/admin/litiges`
- [ ] Les messages s'affichent correctement dans l'historique
- [ ] Le marquage litige fonctionne (badge rouge + date + description)
- [ ] Le retrait de marquage fonctionne
- [ ] La recherche filtre correctement les conversations
- [ ] Les filtres "Toutes/Litiges/Normales" fonctionnent
- [ ] Les noms complets s'affichent (Prénom + Nom)
- [ ] Les rôles (client/artisan) sont corrects
- [ ] Aucune erreur dans la console lors de la navigation
- [ ] Les règles Firestore empêchent la suppression des messages

---

**Auteur** : Système ArtisanDispo  
**Dernière mise à jour** : 26 janvier 2026  
**Version** : 1.0
