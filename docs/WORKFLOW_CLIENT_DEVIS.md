# Workflow Client - Gestion des Devis

## Vue d'ensemble

Le client peut maintenant consulter, accepter et refuser les devis reçus des artisans. Voici le workflow complet.

---

## 📋 Workflow End-to-End

### 1️⃣ Artisan crée et envoie un devis
**Page :** `/artisan/devis/nouveau`
**Actions :**
- Artisan sélectionne une demande client
- Remplit les informations du devis (titre, description, prestations, prix)
- Prévisualise le devis en temps réel
- Change le statut de "Brouillon" à "Envoyé"
- **Résultat :**
  - ✅ Devis créé dans Firestore (collection `devis`)
  - ✅ Compteur `devisRecus` incrémenté sur la demande
  - ✅ **Notification envoyée au client** (via `notifyClientDevisRecu`)

### 2️⃣ Client reçoit notification et consulte ses devis
**Page :** `/client/devis`
**Actions :**
- Client voit la liste de tous ses devis groupés par demande
- Filtre par statut : Tous, En attente, Acceptés, Refusés
- Voit les informations clés : montant TTC, artisan, date de création, date de validité
- Clique sur "📄 Voir le détail"

**Alternative :** Client peut accéder aux devis depuis :
- `/client/demandes` : bouton "📄 Voir les devis" quand `devisRecus > 0`
- `/dashboard` : carte "Mes devis"

### 3️⃣ Client consulte le détail d'un devis
**Page :** `/client/devis/[id]`
**Affichage :**
- Numéro de devis (ex: DV-2026-00001)
- Informations artisan et client
- Titre et description du devis
- Tableau détaillé des prestations (désignation, quantité, prix unitaire HT, TVA, total HT)
- Totaux : HT, TVA, **TTC**
- Délai de réalisation, conditions de paiement, notes
- Date de validité du devis

**Actions disponibles selon le statut :**

#### Si statut = "envoye" (En attente)
Bannière bleue avec 2 boutons :
- **✅ Accepter ce devis**
- **❌ Refuser ce devis**

#### Si statut = "accepte"
- **💬 Contacter l'artisan** (messagerie à venir)

#### Si statut = "refuse"
- Aucune action possible

### 4️⃣ Client accepte le devis
**Actions :**
1. Client clique sur "✅ Accepter ce devis"
2. Popup de confirmation : "Êtes-vous sûr de vouloir accepter ce devis ? Cette action est irréversible."
3. Si confirmé :
   - ✅ Statut du devis mis à jour : `statut = 'accepte'`
   - ✅ `dateAcceptation` enregistrée (Timestamp)
   - ✅ **Notification envoyée à l'artisan** (via `notifyArtisanDevisAccepte`)
   - ✅ Message : "Devis accepté avec succès ! L'artisan sera notifié."
4. Redirection vers `/client/devis`

**TODO (Phase future) :**
- Créer un contrat dans Firestore (collection `contrats`)
- Rediriger vers le workflow de paiement Stripe

### 5️⃣ Client refuse le devis
**Actions :**
1. Client clique sur "❌ Refuser ce devis"
2. Modal s'ouvre avec textarea pour motif optionnel :
   - Exemples : "Tarif trop élevé", "Délai trop long", "Prestation non adaptée"
3. Client clique sur "Confirmer le refus"
4. Si confirmé :
   - ✅ Statut du devis mis à jour : `statut = 'refuse'`
   - ✅ `dateRefus` enregistrée (Timestamp)
   - ✅ `motifRefus` enregistré (ou "Aucun motif précisé")
   - ✅ **Notification envoyée à l'artisan** (via `notifyArtisanDevisRefuse`)
   - ✅ Message : "Devis refusé. L'artisan sera notifié."
5. Redirection vers `/client/devis`

### 6️⃣ Artisan reçoit notification de réponse
**Page :** `/artisan/devis` (liste des devis)
**Actions :**
- Artisan voit le statut du devis mis à jour :
  - Badge vert "✅ Accepté" si accepté
  - Badge rouge "❌ Refusé" si refusé
- Artisan peut consulter le détail dans `/artisan/devis/[id]`
- **Si refusé :** Artisan peut voir le motif de refus dans les données du devis

---

## 🔔 Système de Notifications

### Notifications créées automatiquement

| Événement | Destinataire | Type | Titre | Lien |
|-----------|--------------|------|-------|------|
| Devis envoyé | Client | `devis_recu` | "📄 Nouveau devis reçu" | `/client/devis/[id]` |
| Devis accepté | Artisan | `devis_accepte` | "✅ Devis accepté !" | `/artisan/devis/[id]` |
| Devis refusé | Artisan | `devis_refuse` | "❌ Devis refusé" | `/artisan/devis/[id]` |

### Service utilisé : `notification-service.ts`

**Fonctions disponibles :**
```typescript
// Notifier client d'un nouveau devis
await notifyClientDevisRecu(clientId, devisId, artisanNom, numeroDevis);

// Notifier artisan d'acceptation
await notifyArtisanDevisAccepte(artisanId, devisId, clientNom, numeroDevis);

// Notifier artisan de refus
await notifyArtisanDevisRefuse(artisanId, devisId, clientNom, numeroDevis, motif);
```

---

## 📂 Structure Firestore

### Collection : `devis`
```typescript
{
  id: string,
  numeroDevis: "DV-2026-00001",
  artisanId: string,
  clientId: string,
  demandeId: string,
  statut: "brouillon" | "envoye" | "accepte" | "refuse" | "expire",
  titre: string,
  description: string,
  lignes: LigneDevis[],
  totaux: {
    totalHT: number,
    totalTVA: number,
    totalTTC: number
  },
  dateCreation: Timestamp,
  dateValidite: Timestamp,
  dateAcceptation?: Timestamp,
  dateRefus?: Timestamp,
  motifRefus?: string,
  artisan: {...},
  client: {...}
}
```

### Collection : `notifications`
```typescript
{
  id: string,
  userId: string,
  type: NotificationType,
  titre: string,
  message: string,
  lien?: string,
  lue: boolean,
  dateCreation: Timestamp
}
```

### Collection : `demandes`
```typescript
{
  id: string,
  // ... autres champs ...
  devisRecus: number // Compteur auto-incrémenté
}
```

---

## 🎨 Pages Créées

### 1. `/client/devis` - Liste des devis
**Fichier :** `frontend/src/app/client/devis/page.tsx`
**Fonctionnalités :**
- Affiche tous les devis du client
- Filtres : Tous, En attente, Acceptés, Refusés
- Statistiques par statut
- Cards avec :
  - Titre du devis
  - Statut (badge coloré)
  - Informations demande associée
  - Nom artisan
  - Montant TTC
  - Numéro de devis, date, validité, délai
  - Boutons : Voir le détail, Accepter, Refuser

### 2. `/client/devis/[id]` - Détail d'un devis
**Fichier :** `frontend/src/app/client/devis/[id]/page.tsx`
**Fonctionnalités :**
- Affichage complet du devis (style professionnel)
- Bannière d'action si statut = "envoye"
- Boutons Accepter/Refuser avec logique complète
- Modal de refus avec motif optionnel
- Bouton Imprimer (print-friendly)
- Bouton Contacter artisan (si accepté)

### 3. Lien dans `/client/demandes`
**Modification :** Ajout du bouton "📄 Voir les devis" quand `devisRecus > 0`

### 4. Lien dans `/dashboard`
**Modification :** Ajout de la carte "Mes devis"

---

## 🔧 Services Modifiés

### `devis-service.ts`
**Modification :** `createDevis()`
```typescript
// Après création du devis, si statut='envoye' :
if (newDevis.statut === 'envoye') {
  await notifyClientDevisRecu(clientId, devisId, artisanNom, numeroDevis);
}
```

### `notification-service.ts`
**Ajouts :**
- `notifyClientDevisRecu()` : notifier client d'un nouveau devis
- `notifyArtisanDevisAccepte()` : notifier artisan d'acceptation
- `notifyArtisanDevisRefuse()` : notifier artisan de refus

---

## ✅ Checklist de Test

### Test E2E complet :

1. **Artisan crée un devis**
   - [ ] Se connecter comme artisan
   - [ ] Aller sur `/artisan/devis/nouveau`
   - [ ] Sélectionner une demande client
   - [ ] Remplir les informations du devis
   - [ ] Changer statut à "Envoyé"
   - [ ] Sauvegarder
   - [ ] ✅ Vérifier que `devisRecus` de la demande = 1

2. **Client reçoit notification**
   - [ ] Se connecter comme client
   - [ ] Vérifier qu'une notification apparaît (icône 🔔)
   - [ ] Cliquer sur notification → redirige vers `/client/devis/[id]`

3. **Client consulte le devis**
   - [ ] Aller sur `/client/devis`
   - [ ] Vérifier que le devis apparaît avec statut "⏳ En attente"
   - [ ] Cliquer sur "📄 Voir le détail"
   - [ ] Vérifier affichage complet : prix, prestations, artisan

4. **Client accepte le devis**
   - [ ] Cliquer sur "✅ Accepter ce devis"
   - [ ] Confirmer dans la popup
   - [ ] ✅ Vérifier statut mis à jour : "✅ Accepté"
   - [ ] ✅ Vérifier que l'artisan reçoit une notification

5. **Artisan reçoit notification d'acceptation**
   - [ ] Se reconnecter comme artisan
   - [ ] Vérifier notification "✅ Devis accepté !"
   - [ ] Aller sur `/artisan/devis`
   - [ ] Vérifier que le devis a le badge "✅ Accepté"

### Test de refus :

1. **Client refuse un devis**
   - [ ] Aller sur `/client/devis/[id]` (devis en attente)
   - [ ] Cliquer sur "❌ Refuser ce devis"
   - [ ] Écrire un motif : "Tarif trop élevé"
   - [ ] Confirmer le refus
   - [ ] ✅ Vérifier statut mis à jour : "❌ Refusé"

2. **Artisan reçoit notification de refus**
   - [ ] Se reconnecter comme artisan
   - [ ] Vérifier notification "❌ Devis refusé"
   - [ ] Vérifier que le motif apparaît dans le message

---

## 🚀 Prochaines Étapes (Phase Future)

### Workflow de paiement (après acceptation)
1. Créer collection `contrats` dans Firestore
2. Intégrer Stripe Payment Intent
3. Workflow de séquestre des fonds
4. Libération du paiement après travaux terminés
5. Signature électronique du contrat

### Messagerie client-artisan
1. Collection `conversations` + `messages`
2. Interface de chat temps réel
3. Bouton "💬 Contacter l'artisan" fonctionnel

### Centre de notifications
1. Page `/notifications` avec liste complète
2. Badge de compteur non lues
3. Marquer comme lues
4. Filtres par type de notification

---

## 📊 Données de Test

### Pour tester le workflow complet :

**Compte Artisan :**
- Email: [créer dans Firebase Auth]
- Profil complété avec SIRET valide

**Compte Client :**
- Email: [créer dans Firebase Auth]
- Demande publiée avec artisan assigné

**Scénario :**
1. Artisan crée devis pour la demande
2. Client consulte `/client/devis`
3. Client accepte ou refuse
4. Artisan reçoit notification
5. Vérifier Firestore :
   - `devis.statut` = 'accepte' ou 'refuse'
   - `devis.dateAcceptation` ou `devis.dateRefus` défini
   - `notifications` créées pour client et artisan

---

## 🔍 Debugging

### Si le client ne voit pas le devis :
```typescript
// Vérifier dans Firestore :
- Collection 'devis' → clientId = UID du client ?
- devis.statut = 'envoye' ?
- demande.devisRecus > 0 ?
```

### Si la notification n'est pas reçue :
```typescript
// Vérifier dans Console :
console.log('✅ Notification envoyée au client');
// Vérifier dans Firestore :
- Collection 'notifications' → userId = UID du client/artisan ?
- notification.lue = false ?
```

### Si le compteur devisRecus n'est pas mis à jour :
```typescript
// Vérifier dans devis-service.ts createDevis() :
await updateDoc(demandeRef, { devisRecus: increment(1) });
```

---

## ✨ Résumé

Le workflow client de gestion des devis est **100% fonctionnel** :
- ✅ Client peut consulter tous ses devis
- ✅ Client peut accepter un devis
- ✅ Client peut refuser un devis avec motif
- ✅ Artisan reçoit notification d'acceptation/refus
- ✅ Client reçoit notification de nouveau devis
- ✅ Toutes les données Firestore sont cohérentes
- ✅ Interface professionnelle et intuitive

**Prochaine phase :** Paiement sécurisé et création de contrat.
