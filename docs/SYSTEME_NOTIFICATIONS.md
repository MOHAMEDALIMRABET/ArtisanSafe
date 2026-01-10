# 🔔 Système de Notifications - Documentation Complète

## Vue d'ensemble

Le système de notifications d'ArtisanSafe permet aux artisans et clients de recevoir des alertes en temps réel pour les événements importants (devis acceptés/refusés, nouveaux messages, paiements, etc.).

---

## 🎯 Fonctionnalités

### ✅ Implémenté

1. **Notifications en temps réel** via Firestore onSnapshot
2. **Badge compteur** sur l'icône cloche (nombre de notifications non lues)
3. **Dropdown interactif** avec liste complète des notifications
4. **Marquage comme lu** au clic sur une notification
5. **Redirection automatique** vers le contenu lié (devis, messages, etc.)
6. **Badges sur dashboard** : compteurs visuels sur les cartes "Mes Devis"
7. **Icônes par type** : 📄 devis, ✅ accepté, ❌ refusé, 💬 message, 💰 paiement
8. **Dates relatives** : "il y a 5 min", "il y a 2h" (formatage FR)
9. **Bouton "Tout marquer comme lu"**
10. **Fermeture au clic extérieur**

---

## 📊 Types de notifications

| Type | Icône | Destinataire | Déclencheur |
|------|-------|--------------|-------------|
| `devis_recu` | 📄 | Client | Artisan envoie un devis |
| `nouveau_devis` | 📄 | Client | Alternative pour nouveau devis |
| `devis_accepte` | ✅ | Artisan | Client accepte un devis |
| `devis_refuse` | ❌ | Artisan | Client refuse un devis (avec motif) |
| `nouveau_message` | 💬 | Artisan/Client | Nouveau message dans conversation |
| `contrat_signe` | 📝 | Artisan/Client | Signature d'un contrat |
| `paiement_libere` | 💰 | Artisan | Paiement disponible |
| `nouvel_avis` | ⭐ | Artisan | Client laisse un avis |

---

## 🏗️ Architecture technique

### 1. Hook personnalisé : `useNotifications`

**Fichier :** `frontend/src/hooks/useNotifications.ts`

```typescript
export function useNotifications(userId: string | undefined, maxResults: number = 20)
```

**Retourne :**
```typescript
{
  notifications: Notification[],  // Liste des notifications
  unreadCount: number,            // Nombre de non lues
  loading: boolean,               // État de chargement
  markAsRead: (id: string) => Promise<void>,
  markAllAsRead: () => Promise<void>
}
```

**Fonctionnement :**
- Écoute Firestore en temps réel (`onSnapshot`)
- Filtre par `userId`
- Tri par date décroissante
- Calcul automatique du compteur non lues

---

### 2. Composant : `NotificationBell`

**Fichier :** `frontend/src/components/NotificationBell.tsx`

**Props :** Aucune (récupère automatiquement l'utilisateur via `useAuth`)

**Composition :**
```
NotificationBell
├── Bouton cloche + badge compteur
└── Dropdown (si isOpen)
    ├── Header (titre + "Tout marquer comme lu")
    ├── Liste notifications (scroll)
    │   └── Notification Item
    │       ├── Icône emoji (par type)
    │       ├── Titre + badge "non lu"
    │       ├── Message
    │       └── Date relative
    └── Footer ("Voir toutes")
```

**Couleurs :**
- Badge compteur : `bg-red-600` (rouge vif)
- Badge nouveau devis : `bg-[#FF6B00]` (orange ArtisanSafe)
- Notification non lue : `bg-blue-50` (fond bleu clair)
- Point orange : `bg-[#FF6B00]` (indicateur non lu)

---

### 3. Service : `notification-service.ts`

**Fichier :** `frontend/src/lib/firebase/notification-service.ts`

**Fonctions principales :**

#### Création
```typescript
createNotification(userId: string, notificationData: Omit<Notification, 'id' | 'userId' | 'dateCreation' | 'lue'>)
```

#### Lecture
```typescript
getUserNotifications(userId: string, onlyUnread: boolean, maxResults: number)
getUnreadCount(userId: string)
```

#### Marquage
```typescript
markNotificationAsRead(notificationId: string)
markAllNotificationsAsRead(userId: string)
```

#### Helpers métier
```typescript
// Client
notifyClientDevisRecu(clientId, devisId, artisanNom)

// Artisan
notifyArtisanDevisAccepte(artisanId, devisId, clientNom, numeroDevis)
notifyArtisanDevisRefuse(artisanId, devisId, clientNom, numeroDevis, motif)
```

---

## 🎨 Intégration UI

### Dashboard Artisan

**Fichier :** `frontend/src/app/artisan/dashboard/page.tsx`

```tsx
// Import
import NotificationBell from '@/components/NotificationBell';
import { useNotifications } from '@/hooks/useNotifications';

// Hook
const { notifications, unreadCount } = useNotifications(user?.uid);
const devisNotifications = notifications.filter(
  n => n.type === 'devis_accepte' || n.type === 'devis_refuse'
).length;

// Navigation
<nav>
  <NotificationBell />  {/* Cloche + badge */}
</nav>

// Badge carte "Mes Devis"
<div className="relative">
  {devisNotifications > 0 && (
    <span className="bg-[#FF6B00] px-2 py-1 rounded-full">
      {devisNotifications} nouvelle(s)
    </span>
  )}
</div>
```

### Dashboard Client

**Fichier :** `frontend/src/app/dashboard/page.tsx`

```tsx
// Même structure que l'artisan
const devisNotifications = notifications.filter(
  n => n.type === 'devis_recu' || n.type === 'nouveau_devis'
).length;
```

---

## 🔥 Firestore - Structure de données

### Collection : `notifications`

```typescript
{
  id: string,                    // Auto-généré Firestore
  userId: string,                // Destinataire
  type: NotificationType,        // Type de notification
  titre: string,                 // "✅ Devis accepté !"
  message: string,               // "Client Dupont a accepté votre devis DV-2026-00001"
  lien?: string,                 // "/artisan/devis/abc123"
  lue: boolean,                  // false par défaut
  dateCreation: Timestamp        // Auto Firestore
}
```

### Index requis

```javascript
// firestore.indexes.json
{
  "collectionGroup": "notifications",
  "fields": [
    { "fieldPath": "userId", "order": "ASCENDING" },
    { "fieldPath": "dateCreation", "order": "DESCENDING" }
  ]
}
```

⚠️ **Important :** Cet index est **obligatoire** pour la requête `where + orderBy`.

---

## 📱 Workflow complet

### Scénario : Client accepte un devis

```
1. Client clique "Accepter" sur /client/devis/[id]
   ↓
2. handleAccepter() → updateDoc(statut: 'accepte', dateAcceptation)
   ↓
3. notifyArtisanDevisAccepte(artisanId, devisId, clientNom, numeroDevis)
   ↓
4. createNotification() → Firestore crée document dans 'notifications'
   {
     userId: artisanId,
     type: 'devis_accepte',
     titre: '✅ Devis accepté !',
     message: 'Client Dupont a accepté votre devis DV-2026-00001...',
     lien: '/artisan/devis/abc123',
     lue: false
   }
   ↓
5. useNotifications (côté artisan) → onSnapshot détecte nouveau doc
   ↓
6. State mis à jour : notifications++, unreadCount++
   ↓
7. UI se met à jour automatiquement :
   - Badge cloche passe à [1]
   - Badge "Mes Devis" affiche "1 nouvelle"
   - Dropdown affiche la notification en haut
   ↓
8. Artisan clique sur la notification
   ↓
9. markAsRead() → updateDoc(lue: true)
   ↓
10. router.push('/artisan/devis/abc123')
   ↓
11. Badge revient à [0], fond bleu disparaît
```

---

## 🧪 Tests à effectuer

### Test 1 : Notification de devis accepté

```
✅ Artisan crée et envoie un devis (statut='envoye')
✅ Client voit notification "📄 Nouveau devis reçu"
✅ Client clique → notification marquée lue
✅ Client accepte le devis
✅ Artisan reçoit notification "✅ Devis accepté !"
✅ Badge artisan affiche [1]
✅ Artisan clique → redirection vers devis
✅ Badge revient à [0]
```

### Test 2 : Notification de devis refusé

```
✅ Client refuse un devis avec motif "Prix trop élevé"
✅ Artisan reçoit notification "❌ Devis refusé"
✅ Message inclut le motif
✅ Lien pointe vers le devis
✅ Badge dashboard "Mes Devis" affiche compteur
```

### Test 3 : Marquage multiple

```
✅ Créer 3 notifications non lues
✅ Badge affiche [3]
✅ Cliquer "Tout marquer comme lu"
✅ Badge revient à [0]
✅ Fond bleu disparaît de toutes les notifications
```

### Test 4 : Temps réel

```
✅ Ouvrir 2 fenêtres : artisan + client
✅ Client accepte un devis
✅ Vérifier que l'artisan voit la notification apparaître instantanément
✅ Sans rafraîchir la page
```

---

## 🎨 Personnalisation UI

### Modifier les couleurs

```tsx
// NotificationBell.tsx

// Badge compteur
<span className="bg-red-600">  {/* Rouge → Modifier ici */}

// Badge orange dashboard
<span className="bg-[#FF6B00]">  {/* Orange ArtisanSafe */}

// Point indicateur non lu
<span className="bg-[#FF6B00]">  {/* Orange */}

// Fond notification non lue
<div className="bg-blue-50">  {/* Bleu clair */}
```

### Modifier le nombre max de notifications

```tsx
// Dashboard
const { notifications } = useNotifications(user?.uid, 50);  // Défaut: 20
```

### Ajouter un type de notification

1. **Ajouter dans `types/firestore.ts` :**
```typescript
export type NotificationType = 
  | 'devis_recu'
  | 'nouveau_message'  // ← Nouveau type
  | ...;
```

2. **Ajouter l'icône dans `NotificationBell.tsx` :**
```typescript
const getNotificationIcon = (type: string) => {
  switch (type) {
    case 'nouveau_message': return '💬';  // ← Nouveau
    ...
  }
};
```

3. **Créer la fonction helper dans `notification-service.ts` :**
```typescript
export async function notifyNouveauMessage(
  userId: string,
  messageId: string,
  expediteurNom: string
) {
  await createNotification(userId, {
    type: 'nouveau_message',
    titre: '💬 Nouveau message',
    message: `${expediteurNom} vous a envoyé un message`,
    lien: `/messages/${messageId}`,
  });
}
```

---

## 🐛 Debugging

### Problème : Badge ne s'affiche pas

```typescript
// Vérifier dans la console
console.log('User ID:', user?.uid);
console.log('Notifications:', notifications);
console.log('Unread count:', unreadCount);
```

**Solutions :**
- ✅ Vérifier que `user.uid` est défini
- ✅ Vérifier l'index Firestore (voir console Firebase)
- ✅ Vérifier les permissions Firestore Rules

### Problème : Notifications pas en temps réel

**Cause :** `onSnapshot` ne s'abonne pas correctement.

**Solution :**
```typescript
// useNotifications.ts - Vérifier le cleanup
return () => unsubscribe();  // Important !
```

### Problème : "Failed to execute 'removeEventListener'"

**Cause :** Référence changeante dans `useEffect`.

**Solution :**
```typescript
useEffect(() => {
  const handler = (e) => { /* ... */ };
  document.addEventListener('mousedown', handler);
  return () => document.removeEventListener('mousedown', handler);
}, [isOpen]);  // Dépendance correcte
```

---

## 📦 Dépendances

```json
{
  "date-fns": "^3.x.x"  // Formatage dates relatives
}
```

**Installation :**
```bash
npm install date-fns
```

---

## 🚀 Améliorations futures

### Phase 2 (À venir)

- [ ] Page dédiée `/notifications` (historique complet)
- [ ] Filtres par type de notification
- [ ] Notifications push (PWA)
- [ ] Emails de notification (SendGrid)
- [ ] Son de notification (optionnel)
- [ ] Préférences de notification (activer/désactiver par type)
- [ ] Marquage groupé (sélection multiple)
- [ ] Recherche dans notifications
- [ ] Archivage des anciennes notifications (>30 jours)

---

## ✅ Checklist d'implémentation

- [x] Créer `useNotifications` hook
- [x] Créer composant `NotificationBell`
- [x] Intégrer dans dashboard artisan
- [x] Intégrer dans dashboard client
- [x] Ajouter badges sur cartes "Mes Devis"
- [x] Installer `date-fns`
- [x] Tester notifications de devis
- [x] Tester marquage comme lu
- [x] Tester redirection
- [x] Tester temps réel (2 fenêtres)
- [x] Documentation complète
- [x] Commit et push

---

## 📞 Support

Pour toute question sur le système de notifications, consultez :
- `frontend/src/hooks/useNotifications.ts` : Hook principal
- `frontend/src/components/NotificationBell.tsx` : Composant UI
- `frontend/src/lib/firebase/notification-service.ts` : Service Firestore
- `docs/WORKFLOW_CLIENT_DEVIS.md` : Workflow de notifications de devis

---

**Dernière mise à jour :** 10 janvier 2026  
**Version :** 1.0.0
