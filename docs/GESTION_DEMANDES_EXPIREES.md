# 📅 Gestion des Demandes Expirées - Analyse & Recommandations

**Date** : 1er février 2026  
**Contexte** : Demande de devis avec date souhaitée + flexibilité dépassée

---

## 📋 Scénario Utilisateur

**Demande créée** : 27/01/2026  
**Date souhaitée début travaux** : 29/01/2026  
**Flexibilité** : ±3 jours  
**→ Fenêtre valide** : **26/01/2026 au 01/02/2026**

**Aujourd'hui** : 01/02/2026 (dernier jour !)  
**Demain** : 02/02/2026 → **HORS FENÊTRE**

---

## ⚙️ Comportement Actuel de la Plateforme

### 1. Structure des Données (Demande)

```typescript
interface DatesSouhaitees {
  dateDebut: string;          // "2026-01-29" (format YYYY-MM-DD)
  dateFin?: string;           // Optionnel
  dates: Timestamp[];         // [Timestamp(29/01/2026)]
  flexible: boolean;          // true
  flexibiliteDays?: number;   // 3
  urgence: Urgence;
}

interface Demande {
  id: string;
  datesSouhaitees: DatesSouhaitees;
  statut: DemandeStatut;      // 'publiee' | 'en_attente_devis' | ...
  dateCreation: Timestamp;
  // ...
}
```

### 2. Validation Côté Artisan (Création Devis)

**Fichier** : `frontend/src/app/artisan/devis/nouveau/page.tsx` (lignes 1041-1060)

```typescript
// ✅ VALIDATION ACTIVE lors de la création du devis
const dateProposee = new Date(dateDebutPrevue);
const dateClient = demande.datesSouhaitees.dates[0].toDate();
const flexDays = demande.datesSouhaitees.flexibiliteDays || 0;

const dateMin = new Date(dateClient);
dateMin.setDate(dateMin.getDate() - flexDays); // 26/01/2026
const dateMax = new Date(dateClient);
dateMax.setDate(dateMax.getDate() + flexDays); // 01/02/2026

if (dateProposee < dateMin || dateProposee > dateMax) {
  alert(
    `❌ DEVIS BLOQUÉ : Date hors préférences du client\n\n` +
    `📅 Date proposée : ${dateProposee.toLocaleDateString('fr-FR')}\n` +
    `✅ Date souhaitée par le client : ${dateClient.toLocaleDateString('fr-FR')} (±${flexDays} jours)\n` +
    `📆 Plage acceptée : du ${dateMin.toLocaleDateString('fr-FR')} au ${dateMax.toLocaleDateString('fr-FR')}`
  );
  return; // ❌ BLOQUE L'ENVOI DU DEVIS
}
```

**→ Comportement** : 
- ✅ **Pendant la fenêtre** (26/01 → 01/02) : Artisan peut créer et envoyer devis
- ❌ **Après la fenêtre** (02/02+) : Artisan **BLOQUÉ** s'il essaie de proposer date hors fenêtre

### 3. Affichage UI Artisan

**Fichier** : `frontend/src/app/artisan/devis/nouveau/page.tsx` (lignes 1331-1348)

```tsx
{/* Indicateur visuel en temps réel */}
{dateProposee < dateMin || dateProposee > dateMax ? (
  <p className="text-xs text-orange-600 bg-orange-50 px-2 py-1 rounded">
    ⚠️ Cette date est en dehors des préférences du client.
    Le client pourrait refuser le devis.
  </p>
) : (
  <p className="text-xs text-green-600">
    ✅ Correspond aux préférences du client
  </p>
)}
```

### 4. Statuts Demande

```typescript
export type DemandeStatut =
  | 'brouillon'           // Client n'a pas encore publié
  | 'publiee'             // Visible par artisans
  | 'en_attente_devis'    // Artisans consultent
  | 'devis_recus'         // Au moins 1 devis reçu
  | 'acceptee'            // Client a accepté un devis
  | 'terminee'            // Contrat terminé
  | 'annulee';            // Annulée par client
```

**→ AUCUN statut "expirée" ou "hors délai"** ❌

---

## 🔍 Problèmes Identifiés

### 1. ❌ Aucune Expiration Automatique des Demandes

**Problème** :  
Une demande créée le 27/01/2026 avec date souhaitée 29/01 (±3 jours) reste en statut `'publiee'` **indéfiniment**, même après le 01/02/2026.

**Conséquences** :
- Artisans voient encore la demande dans `/artisan/demandes`
- Artisans peuvent CONSULTER la demande mais sont BLOQUÉS s'ils proposent date hors fenêtre
- Client continue de recevoir devis potentiellement HORS DÉLAI
- Confusion : "Pourquoi cette demande est encore visible si la date est passée ?"

### 2. ❌ Aucune Notification Client

**Problème** :  
Si aucun artisan n'a répondu avant la date limite (01/02/2026), **aucune alerte automatique** au client.

**Conséquences** :
- Client attend indéfiniment
- Client ne sait pas s'il doit modifier sa demande ou créer une nouvelle

### 3. ❌ Demandes "Zombies" dans la Liste Artisan

**Problème** :  
Les demandes expirées polluent la liste des demandes artisan, augmentant le bruit et diminuant la qualité.

---

## ✅ Solutions Recommandées

### Phase 1 : Expiration Automatique des Demandes (PRIORITÉ HAUTE)

#### A. Ajouter Champ `dateExpiration` dans Demande

**Modification** : `frontend/src/types/firestore.ts`

```typescript
export interface Demande {
  id: string;
  // ... champs existants
  datesSouhaitees: DatesSouhaitees;
  dateExpiration?: Timestamp; // ← NOUVEAU : Date de fin de fenêtre
  statut: DemandeStatut;
  // ...
}
```

**Calcul automatique lors de la création** :

```typescript
// frontend/src/lib/firebase/demande-service.ts
export async function createDemande(data: CreateDemande): Promise<Demande> {
  const dateClient = data.datesSouhaitees.dates[0]; // Timestamp
  const flexDays = data.datesSouhaitees.flexibiliteDays || 0;
  
  // Calculer date d'expiration (dateClient + flexibilité)
  const dateExpiration = new Date(dateClient.toDate());
  dateExpiration.setDate(dateExpiration.getDate() + flexDays);
  
  const demandeData = {
    ...data,
    dateExpiration: Timestamp.fromDate(dateExpiration), // 01/02/2026 23:59
    statut: 'publiee',
    dateCreation: Timestamp.now()
  };
  
  await addDoc(collection(db, 'demandes'), demandeData);
}
```

---

#### B. Cloud Function : Expiration Automatique

**Fichier à créer** : `functions/src/scheduledJobs/expirerDemandesPassees.ts`

```typescript
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

/**
 * Cron quotidien : Marquer demandes expirées
 * Exécution : Tous les jours à 1h du matin
 */
export const expirerDemandesPassees = functions.pubsub
  .schedule('every day 01:00')
  .timeZone('Europe/Paris')
  .onRun(async (context) => {
    const db = admin.firestore();
    const now = admin.firestore.Timestamp.now();
    
    console.log('🔄 Début expiration demandes passées...');
    
    // 1. Récupérer demandes publiées avec dateExpiration < maintenant
    const snapshot = await db.collection('demandes')
      .where('statut', '==', 'publiee')
      .where('dateExpiration', '<', now)
      .get();
    
    console.log(`📊 ${snapshot.size} demande(s) expirée(s) trouvée(s)`);
    
    if (snapshot.empty) {
      console.log('✅ Aucune demande à expirer');
      return;
    }
    
    // 2. Batch update : statut → 'expiree'
    const batch = db.batch();
    let count = 0;
    
    snapshot.docs.forEach(doc => {
      const demande = doc.data();
      
      // Marquer comme expirée uniquement si pas de devis accepté
      if (!demande.devisAccepteId) {
        batch.update(doc.ref, {
          statut: 'expiree',
          dateExpiration: now
        });
        count++;
        
        console.log(`⏰ Demande ${doc.id} expirée (date: ${demande.datesSouhaitees.dateDebut})`);
      }
    });
    
    await batch.commit();
    
    console.log(`✅ ${count} demande(s) marquée(s) comme expirée(s)`);
    
    // 3. TODO : Notifier clients
    // for (const doc of snapshot.docs) {
    //   await createNotification({
    //     recipientId: doc.data().clientId,
    //     type: 'demande_expiree',
    //     title: 'Demande expirée',
    //     message: 'Votre demande a expiré. Créez une nouvelle demande avec des dates actualisées.'
    //   });
    // }
    
    return null;
  });
```

**Déploiement** :
```bash
cd functions
npm install
npm run build
firebase deploy --only functions:expirerDemandesPassees
```

---

#### C. Ajouter Statut `'expiree'`

**Modification** : `frontend/src/types/firestore.ts`

```typescript
export type DemandeStatut =
  | 'brouillon'
  | 'publiee'
  | 'en_attente_devis'
  | 'devis_recus'
  | 'acceptee'
  | 'expiree'          // ← NOUVEAU
  | 'terminee'
  | 'annulee';
```

---

#### D. Filtrer Demandes Expirées (Vue Artisan)

**Modification** : `frontend/src/app/artisan/demandes/page.tsx`

```typescript
// Exclure demandes expirées de la liste artisan
const demandesActives = demandes.filter(d => 
  d.statut !== 'expiree' && 
  d.statut !== 'annulee' &&
  d.statut !== 'terminee'
);

// OU afficher section séparée
const demandesExpirees = demandes.filter(d => d.statut === 'expiree');
```

**UI** :
```tsx
{demandesExpirees.length > 0 && (
  <div className="mb-6">
    <details className="bg-gray-100 rounded-lg p-4">
      <summary className="cursor-pointer font-semibold text-gray-700">
        📦 Demandes expirées ({demandesExpirees.length})
      </summary>
      <p className="text-sm text-gray-600 mt-2">
        Ces demandes ont dépassé la fenêtre de dates souhaitées.
      </p>
    </details>
  </div>
)}
```

---

### Phase 2 : Notifications Proactives (PRIORITÉ MOYENNE)

#### A. Alerte 24h Avant Expiration

**Cloud Function** : `functions/src/scheduledJobs/alerterDemandesProchesExpiration.ts`

```typescript
export const alerterDemandesProchesExpiration = functions.pubsub
  .schedule('every day 09:00')
  .timeZone('Europe/Paris')
  .onRun(async () => {
    const db = admin.firestore();
    const now = new Date();
    const demain = new Date(now);
    demain.setDate(demain.getDate() + 1);
    
    // Demandes qui expirent dans les 24h
    const snapshot = await db.collection('demandes')
      .where('statut', '==', 'publiee')
      .where('dateExpiration', '>', admin.firestore.Timestamp.now())
      .where('dateExpiration', '<', admin.firestore.Timestamp.fromDate(demain))
      .get();
    
    for (const doc of snapshot.docs) {
      const demande = doc.data();
      
      // Si aucun devis reçu, alerter client
      if ((demande.devisRecus || 0) === 0) {
        await createNotification({
          recipientId: demande.clientId,
          type: 'demande_proche_expiration',
          title: '⏰ Votre demande expire bientôt',
          message: `Votre demande "${demande.titre}" expire dans 24h. Aucun devis reçu pour le moment.`
        });
      }
    }
  });
```

---

#### B. Notification Client : Demande Expirée

```typescript
// Après expiration, notifier client
await createNotification({
  recipientId: demande.clientId,
  type: 'demande_expiree',
  title: '📅 Demande expirée',
  message: demande.devisRecus > 0
    ? `Votre demande "${demande.titre}" est expirée. Vous avez ${demande.devisRecus} devis en attente de réponse.`
    : `Votre demande "${demande.titre}" est expirée sans réponse. Créez une nouvelle demande avec des dates actualisées.`,
  actions: [
    { label: 'Voir les devis', url: '/client/devis' },
    { label: 'Nouvelle demande', url: '/client/demandes/nouvelle' }
  ]
});
```

---

### Phase 3 : Options Client (PRIORITÉ BASSE)

#### A. Prolonger Demande

**UI Client** : `frontend/src/app/client/demandes/page.tsx`

```tsx
{demande.statut === 'expiree' && (
  <div className="bg-orange-50 border border-orange-200 p-4 rounded-lg">
    <h4 className="font-semibold text-orange-800">
      ⏰ Cette demande est expirée
    </h4>
    <p className="text-sm text-orange-700 mt-1">
      Fenêtre initiale : {demande.datesSouhaitees.dateDebut} 
      (±{demande.datesSouhaitees.flexibiliteDays} jours)
    </p>
    
    <div className="flex gap-3 mt-4">
      <button
        onClick={() => handleProlongerDemande(demande.id)}
        className="bg-[#FF6B00] text-white px-4 py-2 rounded-lg"
      >
        🔄 Prolonger de 7 jours
      </button>
      
      <button
        onClick={() => router.push('/client/demandes/nouvelle')}
        className="border-2 border-[#2C3E50] text-[#2C3E50] px-4 py-2 rounded-lg"
      >
        ✏️ Créer nouvelle demande
      </button>
    </div>
  </div>
)}
```

**Fonction** :
```typescript
async function handleProlongerDemande(demandeId: string) {
  const nouvelleExpiration = new Date();
  nouvelleExpiration.setDate(nouvelleExpiration.getDate() + 7);
  
  await updateDoc(doc(db, 'demandes', demandeId), {
    statut: 'publiee',
    dateExpiration: Timestamp.fromDate(nouvelleExpiration),
    datesSouhaitees: {
      ...demande.datesSouhaitees,
      flexibiliteDays: 7 // Nouvelle flexibilité
    }
  });
  
  toast.success('Demande prolongée de 7 jours');
}
```

---

#### B. Archivage Automatique (après 30 jours)

**Cloud Function** : `functions/src/scheduledJobs/archiverDemandesAncien.ts`

```typescript
export const archiverDemandesAnciennes = functions.pubsub
  .schedule('every week')
  .onRun(async () => {
    const db = admin.firestore();
    const il30Jours = new Date();
    il30Jours.setDate(il30Jours.getDate() - 30);
    
    // Demandes expirées depuis > 30 jours
    const snapshot = await db.collection('demandes')
      .where('statut', '==', 'expiree')
      .where('dateExpiration', '<', admin.firestore.Timestamp.fromDate(il30Jours))
      .get();
    
    const batch = db.batch();
    snapshot.docs.forEach(doc => {
      batch.update(doc.ref, { statut: 'archivee' });
    });
    await batch.commit();
    
    console.log(`🗄️ ${snapshot.size} demande(s) archivée(s)`);
  });
```

---

## 📊 Résumé des Changements

### Modifications de Code

| Fichier | Action | Priorité |
|---------|--------|----------|
| `frontend/src/types/firestore.ts` | Ajouter `dateExpiration` à `Demande` | HAUTE |
| `frontend/src/types/firestore.ts` | Ajouter statut `'expiree'` | HAUTE |
| `frontend/src/lib/firebase/demande-service.ts` | Calculer `dateExpiration` lors création | HAUTE |
| `functions/src/scheduledJobs/expirerDemandesPassees.ts` | Créer Cloud Function expiration | HAUTE |
| `frontend/src/app/artisan/demandes/page.tsx` | Filtrer demandes expirées | MOYENNE |
| `functions/src/scheduledJobs/alerterDemandesProchesExpiration.ts` | Notification 24h avant | MOYENNE |
| `frontend/src/app/client/demandes/page.tsx` | UI prolonger demande | BASSE |

---

## 🎯 Workflow Final (Avec Expiration)

```
1. Client crée demande (27/01)
   → Date souhaitée: 29/01 ±3 jours
   → dateExpiration calculée: 01/02/2026 23:59
   → statut: 'publiee'

2. Artisan consulte demande (28/01)
   → Voit date souhaitée + flexibilité
   → Crée devis avec date DANS fenêtre
   → ✅ OK

3. Cloud Function quotidienne (02/02 à 1h)
   → Détecte demande avec dateExpiration < maintenant
   → statut → 'expiree'
   → Notification client : "Demande expirée"

4. Artisan consulte liste (02/02)
   → Demande n'apparaît PLUS dans liste active
   → Optionnel : Afficher dans section "Expirées"

5. Client reçoit notification
   → Option 1 : Prolonger demande (+7 jours)
   → Option 2 : Créer nouvelle demande
```

---

## ⚠️ Points d'Attention

### 1. Rétrocompatibilité

**Demandes existantes** sans `dateExpiration` :

```typescript
// Fonction de migration (à exécuter une fois)
export async function migrerDateExpiration() {
  const snapshot = await getDocs(collection(db, 'demandes'));
  
  for (const docSnap of snapshot.docs) {
    const demande = docSnap.data() as Demande;
    
    if (!demande.dateExpiration && demande.datesSouhaitees) {
      const dateClient = demande.datesSouhaitees.dates[0];
      const flexDays = demande.datesSouhaitees.flexibiliteDays || 0;
      
      const dateExpiration = new Date(dateClient.toDate());
      dateExpiration.setDate(dateExpiration.getDate() + flexDays);
      
      await updateDoc(doc(db, 'demandes', docSnap.id), {
        dateExpiration: Timestamp.fromDate(dateExpiration)
      });
    }
  }
}
```

### 2. Devis Déjà Envoyés

**Question** : Si demande expire APRÈS qu'un artisan ait envoyé un devis ?

**Réponse** : 
- ✅ Devis reste VALIDE (a sa propre `dateValidite`)
- ✅ Client peut toujours accepter le devis
- ✅ Demande passe en statut `'expiree'` mais déjà traitée

### 3. Performances

**Cloud Function quotidienne** :
- Limiter à 500 demandes par batch
- Index Firestore requis : `demandes` sur `statut` + `dateExpiration`

```bash
# Créer index composite
firebase firestore:indexes

# firestore.indexes.json
{
  "indexes": [
    {
      "collectionGroup": "demandes",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "statut", "order": "ASCENDING" },
        { "fieldPath": "dateExpiration", "order": "ASCENDING" }
      ]
    }
  ]
}
```

---

## 💡 Réponse Finale à la Question

### Scénario : Demande 27/01 avec date 29/01 (±3 jours)

**Actuellement (sans modifications)** :
- ❌ Demande reste en statut `'publiee'` indéfiniment
- ❌ Artisan voit la demande mais est bloqué s'il propose date hors fenêtre
- ❌ Aucune notification automatique au client
- ❌ Pollution de la liste artisan avec demandes obsolètes

**Avec les améliorations recommandées** :
- ✅ 02/02 à 1h : Cloud Function marque demande comme `'expiree'`
- ✅ Client reçoit notification : "Demande expirée"
- ✅ Artisan ne voit plus la demande dans liste active
- ✅ Client peut prolonger ou créer nouvelle demande

**Action recommandée** : Implémenter **Phase 1** (expiration automatique) en priorité.

