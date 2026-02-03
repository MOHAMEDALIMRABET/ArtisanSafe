# 🗂️ Gestion complète du cycle de vie des DEMANDES client

> **Analyse complète** : Quand supprimer, archiver ou conserver les demandes ?  
> **Compatibilité** : Devis, refus artisan, paiements, expiration automatique

---

## 📊 Vue d'ensemble des statuts DEMANDES

### Statuts actuels (7)

```typescript
type DemandeStatut = 
  | 'genere'      // Brouillon client (pas encore publiée)
  | 'publiee'     // Publiée, visible artisans
  | 'matchee'     // Artisan matché (demande directe)
  | 'en_cours'    // Devis accepté, travaux en cours
  | 'attribuee'   // Devis payé, demande fermée définitivement
  | 'expiree'     // Date + flexibilité dépassée ⏰ (Cloud Function quotidienne)
  | 'terminee'    // Travaux terminés et validés
  | 'annulee';    // Annulée par client ou refusée par artisan
```

---

## 🔄 Cycle de vie complet d'une DEMANDE

### 📍 PHASE 1 : Création

**Statut initial** : `'genere'` (brouillon)

**Déclencheur** : Client crée demande mais ne publie pas encore

**Actions** :
- ❌ Non visible artisans
- ✅ Client peut modifier/supprimer librement
- ✅ Aucun devis lié

**Suppression** : ✅ **IMMÉDIATE sur demande client** (bouton "Supprimer brouillon")

**Archivage** : ❌ Non pertinent (jamais publiée)

---

### 📍 PHASE 2 : Publication

**Statut** : `'publiee'`

**Déclencheur** : Client clique "Publier la demande"

**Actions automatiques** :
1. Calcul `dateExpiration` = `dateDebut + flexibiliteDays` 
2. Si demande directe → Notification artisan(s) matché(s)
3. Si demande publique → Visible dans recherche artisans

**Liens créés** :
- ✅ Peut recevoir devis
- ✅ Artisans peuvent refuser

**Suppression** : ⚠️ **RESTREINTE** (voir scénarios ci-dessous)

**Archivage** : ❌ Demande active

---

### 📍 PHASE 2B : ⏰ EN ATTENTE de réponse artisan (NOUVEAU SCÉNARIO)

**Statut** : `'publiee'` (reste inchangé)

**Problème** : Artisan voit la demande mais ne répond pas (oubli, busy, pas intéressé)

**Durée d'attente recommandée** : **7 jours calendaires**

#### 🔔 Système de rappels automatiques

**Jour 3** : Rappel artisan
```typescript
// Cloud Function quotidienne
Notification artisan: "Rappel : Demande en attente de réponse"
+ Badge "🔔 Urgent" sur la demande
```

**Jour 7** : Timeout + Option annulation client
```typescript
// Si toujours aucun devis reçu
Notification client: 
  "L'artisan n'a pas répondu. Vous pouvez annuler ou attendre."
  
// Bouton "Annuler la demande" devient visible
canCancelDemande = true
```

#### ✅ SOLUTION RECOMMANDÉE : Annulation client après 7 jours

**Actions client possibles** :

**Option A : Annuler la demande** (recommandé)
```typescript
{
  statut: 'annulee',
  motifAnnulation: 'Pas de réponse artisan après 7 jours',
  dateAnnulation: Timestamp.now(),
  annulePar: 'client'
}
```
- ✅ Demande devient invisible pour artisan
- ✅ Si artisan répond après → Devis auto-refusé avec message explicatif
- ✅ Client peut créer nouvelle demande immédiatement
- ✅ Conservation trace (historique)

**Option B : Attendre plus longtemps**
```typescript
// Client clique "Prolonger l'attente"
{
  delaiSupplementaire: +7 jours,
  dateRappelArtisan: now() + 7 jours
}
```
- Nouveau rappel artisan dans 7 jours
- Nouveau timeout dans 14 jours

**Option C : Contacter artisan directement**
```typescript
// Bouton "Envoyer message" apparaît après 7 jours
→ Ouvre conversation directe
→ "Bonjour, êtes-vous disponible pour cette demande ?"
```

#### ⚠️ Règles de SUPPRESSION

**Avant 7 jours** :
```typescript
// Client peut annuler (pas supprimer)
if (devisRecus === 0 && daysSincePublication < 7) {
  return 'ANNULATION_AUTORISEE';  // Changement statut uniquement
}
```

**Après 7 jours** :
```typescript
// Client peut annuler ET supprimer
if (devisRecus === 0 && daysSincePublication >= 7) {
  return 'ANNULATION_ET_SUPPRESSION_AUTORISEES';
}
```

**Si devis reçu** :
```typescript
// Suppression INTERDITE, annulation possible avec avertissement
if (devisRecus > 0) {
  return 'SUPPRESSION_INTERDITE';
  // Message: "Vous avez reçu des devis. Vous pouvez les refuser mais pas supprimer la demande."
}
```

---

### 📍 PHASE 3A : Réception devis

**Statut** : `'publiee'` (reste inchangé)

**Changements** :
- `devisRecus` incrémenté
- Liens créés vers devis
- Client peut accepter/refuser chaque devis

**CAS 1 : Client refuse tous les devis**
```
statut: 'publiee' (reste)
→ Si dateExpiration dépassée → statut: 'expiree' (Cloud Function)
→ Suppression automatique après 30 jours (statut 'expiree')
```

**CAS 2 : Client accepte un devis**
```
statut: 'publiee' → 'en_cours'
devisAccepteId: <id du devis accepté>
→ Autres devis automatiquement refusés
→ Demande FERMÉE aux nouveaux devis
```

**Suppression** : ❌ **INTERDITE** (devis liés existent)

**Archivage** : ❌ Demande active avec devis

---

### 📍 PHASE 3B : Artisan refuse demande

**Statut** : `'annulee'`

**Déclencheur** : Artisan clique "Refuser la demande"

**Données enregistrées** :
```typescript
{
  statut: 'annulee',
  artisanRefuseId: <id artisan>,
  artisanRefuseNom: <nom artisan>,
  motifRefus: <raison>,
  dateRefus: Timestamp.now()
}
```

**Suppression** : ⏰ **AUTOMATIQUE après 30 jours** (Cloud Function recommandée)

**Archivage** : ✅ **IMMÉDIAT** (visible dans onglet "Refusées")

---

### 📍 PHASE 4 : Expiration automatique

**Statut** : `'expiree'`

**Déclencheur** : Cloud Function quotidienne (1h du matin)

**Condition** :
```typescript
dateExpiration < now() 
AND statut === 'publiee' 
AND !devisAccepteId
```

**Actions automatiques** :
1. Change `statut` → `'expiree'`
2. Notification client : "Demande expirée - Date souhaitée dépassée"
3. Invisible pour artisans (filtrée automatiquement)

**Suppression** : ⏰ **AUTOMATIQUE après 30 jours** (Cloud Function)

**Archivage** : ✅ **IMMÉDIAT** (visible dans onglet "Expirées")

---

### 📍 PHASE 5 : Paiement & Attribution

**Statut** : `'en_cours'` → `'attribuee'`

**Déclencheur** : Client paie le devis accepté

**Actions** :
```typescript
{
  statut: 'attribuee',
  devisPayeId: <id devis>,
  datePaiement: Timestamp.now(),
  artisanAttributeId: <id artisan>
}
```

**Suppression** : ❌ **JAMAIS** (contrat juridique actif)

**Archivage** : ✅ **OPTIONNEL** après fin travaux (pour historique)

---

### 📍 PHASE 6 : Fin travaux

**Statut** : `'attribuee'` → `'terminee'`

**Déclencheur** : Client valide fin des travaux

**Suppression** : ❌ **JAMAIS** (historique légal)

**Archivage** : ✅ **AUTOMATIQUE** (tab "Terminées")

---

## 🗑️ Stratégie de SUPPRESSION (recommandée)

### ✅ CAS 1 : Suppression IMMÉDIATE (client peut supprimer manuellement)

**Conditions** :
```typescript
statut === 'genere' // Brouillon jamais publié
|| (statut === 'publiee' && devisRecus === 0 && daysSincePublication >= 7)
```

**Action** : Bouton "Supprimer" visible **après 7 jours sans réponse**

**Implémentation** :
```typescript
// frontend/src/app/client/demandes/page.tsx
function canDeleteDemande(demande: Demande): boolean {
  // Cas 1: Brouillon → Suppression immédiate
  if (demande.statut === 'genere') return true;
  
  // Cas 2: Publiée sans devis → Attendre 7 jours
  if (demande.statut === 'publiee' && (demande.devisRecus || 0) === 0) {
    const daysSincePublished = getDaysSince(demande.createdAt);
    return daysSincePublished >= 7;  // ⏰ Délai de 7 jours
  }
  
  return false;
}

function canCancelDemande(demande: Demande): boolean {
  // Annulation possible avant 7 jours (sans suppression)
  if (demande.statut === 'publiee' && (demande.devisRecus || 0) === 0) {
    return true;  // ✅ Annulation toujours possible
  }
  
  return false;
}

// UI - Boutons différenciés
{canCancelDemande(demande) && !canDeleteDemande(demande) && (
  <Button 
    variant="warning" 
    onClick={() => handleCancelDemande(demande.id)}
  >
    ⚠️ Annuler (artisan ne pourra plus répondre)
  </Button>
)}

{canDeleteDemande(demande) && (
  <Button 
    variant="danger" 
    onClick={() => handleDeleteDemande(demande.id, demande.titre)}
  >
    🗑️ Supprimer définitivement
  </Button>
)}
```

**Helper functions** :
```typescript
// utils/date-helpers.ts
function getDaysSince(timestamp: Timestamp): number {
  const now = Date.now();
  const created = timestamp.toMillis();
  const diffMs = now - created;
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}
```

---

### ⏰ CAS 2 : Suppression AUTOMATIQUE après 30 jours

**Conditions** :
```typescript
(statut === 'expiree' || statut === 'annulee')
&& dateExpiration < (now() - 30 jours)
```

**Raison** : Nettoyage base de données, demandes obsolètes

**Implémentation** : Cloud Function hebdomadaire

**Fichier** : `functions/src/scheduledJobs/cleanupOldDemandes.ts`

```typescript
/**
 * Suppression automatique demandes expirées/annulées > 30 jours
 * Exécution : Tous les dimanches à 2h du matin
 */
export const cleanupOldDemandes = functions.pubsub
  .schedule('0 2 * * 0')  // Dimanche 2h
  .timeZone('Europe/Paris')
  .onRun(async () => {
    const db = admin.firestore();
    const il30Jours = new Date();
    il30Jours.setDate(il30Jours.getDate() - 30);
    const timestamp30j = admin.firestore.Timestamp.fromDate(il30Jours);
    
    console.log('🗑️ Nettoyage demandes anciennes...');
    
    // 1. Récupérer demandes expirées > 30j
    const expireeSnapshot = await db.collection('demandes')
      .where('statut', '==', 'expiree')
      .where('dateExpiration', '<', timestamp30j)
      .get();
    
    // 2. Récupérer demandes annulées > 30j
    const annuleeSnapshot = await db.collection('demandes')
      .where('statut', '==', 'annulee')
      .where('dateRefus', '<', timestamp30j)
      .get();
    
    const batch = db.batch();
    let count = 0;
    
    // Supprimer expirées
    expireeSnapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
      count++;
      console.log(`  🗑️ Supprimé: ${doc.id} (expirée)`);
    });
    
    // Supprimer annulées
    annuleeSnapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
      count++;
      console.log(`  🗑️ Supprimé: ${doc.id} (annulée)`);
    });
    
    await batch.commit();
    
    console.log(`✅ ${count} demande(s) supprimée(s)`);
    
    return { success: true, deleted: count };
  });
```

**Déploiement** :
```bash
firebase deploy --only functions:cleanupOldDemandes
```

---

### ❌ CAS 3 : Suppression INTERDITE

**Conditions** :
```typescript
statut === 'en_cours'     // Devis accepté
|| statut === 'attribuee' // Devis payé
|| statut === 'terminee'  // Travaux terminés
|| (statut === 'publiee' && devisRecus > 0)  // A reçu des devis
```

**Raison** : Liens juridiques, historique contractuel, conformité légale

**Action** : Bouton "Supprimer" masqué

**Alternative** : ✅ **ARCHIVAGE uniquement**

---

## 📦 Stratégie d'ARCHIVAGE (recommandée)

### Objectif
Masquer demandes terminées/obsolètes **sans les supprimer** (historique).

### Implémentation

#### 1. Ajout champ `archived` (optionnel)

```typescript
// frontend/src/types/firestore.ts
export interface Demande {
  // ... existing fields
  archived?: boolean;          // Archivée par client
  dateArchivage?: Timestamp;   // Quand archivée
}
```

#### 2. Archivage AUTOMATIQUE

**Déclencheurs** :
- Demande passe à statut `'terminee'` → archived = true
- Demande passe à statut `'expiree'` → archived = true
- Demande passe à statut `'annulee'` → archived = true

**Implémentation** : Dans chaque fonction de mise à jour statut

```typescript
// demande-service.ts
export async function updateDemandeStatut(
  demandeId: string, 
  statut: DemandeStatut
): Promise<void> {
  const updates: Partial<Demande> = { statut };
  
  // Archivage automatique
  if (statut === 'terminee' || statut === 'expiree' || statut === 'annulee') {
    updates.archived = true;
    updates.dateArchivage = Timestamp.now();
  }
  
  await updateDoc(doc(db, 'demandes', demandeId), updates);
}
```

#### 3. Archivage MANUEL (bouton client)

```typescript
// demande-service.ts
export async function archiverDemande(demandeId: string): Promise<void> {
  await updateDoc(doc(db, 'demandes', demandeId), {
    archived: true,
    dateArchivage: Timestamp.now(),
  });
}
```

#### 4. UI Client - Filtrage archives

```typescript
// frontend/src/app/client/demandes/page.tsx
const [showArchived, setShowArchived] = useState(false);

// Filtrage
const demandesVisibles = demandes.filter(d => {
  if (!showArchived && d.archived) return false;  // Masquer archivées par défaut
  // ... autres filtres
  return true;
});

// Toggle
<Button onClick={() => setShowArchived(!showArchived)}>
  {showArchived ? '📂 Masquer archives' : '🗂️ Voir archives'}
</Button>
```

---

## 📊 Tableau récapitulatif

| Statut | Annulation client | Suppression immédiate | Suppression auto (30j) | Archivage auto | Archivage manuel |
|--------|-------------------|----------------------|------------------------|----------------|------------------|
| `genere` | N/A | ✅ Immédiat | ❌ | ❌ | ❌ |
| `publiee` (0 devis, <7j) | ✅ Oui | ❌ Trop tôt | ❌ | ❌ | ✅ |
| `publiee` (0 devis, ≥7j) | ✅ Oui | ✅ Après 7j | ❌ | ❌ | ✅ |
| `publiee` (>0 devis) | ⚠️ Avec avertissement | ❌ | ❌ | ❌ | ✅ |
| `expiree` | N/A | ❌ | ✅ Après 30j | ✅ Immédiat | N/A |
| `annulee` | N/A | ❌ | ✅ Après 30j | ✅ Immédiat | N/A |
| `en_cours` | ❌ | ❌ | ❌ | ❌ | ✅ |
| `attribuee` | ❌ | ❌ | ❌ | ❌ | ✅ |
| `terminee` | N/A | ❌ | ❌ | ✅ Immédiat | N/A |

---

## ⚙️ Compatibilité avec autres composants

### 🔗 Avec DEVIS

**Problème** : Si demande supprimée, devis deviennent orphelins

**Solution** :
```typescript
// AVANT suppression demande
async function deleteDemande(demandeId: string): Promise<void> {
  // 1. Vérifier s'il y a des devis liés
  const devis = await getDevisByDemande(demandeId);
  
  if (devis.length > 0) {
    throw new Error(
      'Impossible de supprimer : Cette demande a reçu des devis. ' +
      'Vous pouvez seulement l\'archiver.'
    );
  }
  
  // 2. Si aucun devis → Suppression autorisée
  await deleteDoc(doc(db, 'demandes', demandeId));
}
```

### 🚫 Avec REFUS ARTISAN

**Scénario** : Artisan refuse demande directe

**Actions** :
```typescript
{
  statut: 'annulee',
  artisanRefuseId: artisanId,
  artisanRefuseNom: artisan.businessName,
  motifRefus: 'Pas disponible / Hors zone / Autre',
  dateRefus: Timestamp.now()
}
```

**Suppression** : ⏰ Automatique après 30 jours

**Archivage** : ✅ Immédiat (tab "Refusées")

### 💳 Avec PAIEMENTS

**Scénario** : Devis payé → Demande devient `'attribuee'`

**Règles STRICTES** :
- ❌ Suppression JAMAIS autorisée
- ❌ Archivage manuel possible uniquement
- ✅ Conservation LÉGALE (contrat, facture, TVA)

### ⏰ Avec EXPIRATION

**Workflow actuel** :
```
Cloud Function quotidienne (1h du matin)
→ Marque demandes comme 'expiree'
→ Notification client automatique
→ Invisible artisans
→ Suppression automatique après 30 jours
```

**Compatibilité** : ✅ Parfaite

---

## 🎯 Recommandations finales

### Phase 1 : IMMÉDIAT (priorité haute)

1. ✅ **Système de rappels artisan automatiques**
   - Cloud Function quotidienne : Rappel artisan après 3 jours sans réponse
   - Notification client après 7 jours : "Aucune réponse, vous pouvez annuler"

2. ✅ **Boutons Annuler vs Supprimer différenciés**
   - **Annuler** : Visible immédiatement si 0 devis (change statut seulement)
   - **Supprimer** : Visible APRÈS 7 jours si 0 devis (suppression définitive)
   - Message explicatif : "Annuler empêche l'artisan de répondre. Supprimer efface la demande."

3. ✅ **Restreindre suppression manuelle**
   - Autoriser uniquement si `statut='genere'` ou (`statut='publiee'` ET `devisRecus=0` ET `≥7 jours`)
   - Sinon → Message "Vous devez d'abord refuser tous les devis reçus"

4. ✅ **Créer Cloud Function cleanup**
   - Supprimer `expiree` et `annulee` après 30 jours
   - Exécution hebdomadaire (dimanche 2h)

5. ✅ **Ajouter bouton "Archiver"**
   - Visible pour toutes demandes sauf `genere`
   - Masque de la liste principale

### Phase 2 : Court terme (semaine prochaine)

6. ✅ **Cloud Function rappels artisans**
   - Fichier : `functions/src/scheduledJobs/rappelerArtisansDemandesEnAttente.ts`
   - Exécution : Quotidienne 10h
   - Logique :
     * Jour 3 → Rappel artisan
     * Jour 7 → Notification client + bouton "Annuler"

7. ✅ **Ajouter onglets filtre**
   - "Actives" (publiee, en_cours)
   - "En attente" (publiee + 0 devis + <7j) 🔔
   - "Terminées" (terminee, attribuee)
   - "Archives" (expiree, annulee, + archived=true)

8. ✅ **Notification avant suppression auto**
   - Email 7 jours avant : "Demande sera supprimée dans 7 jours"
   - Option "Prolonger conservation" (+30 jours)

### Phase 3 : Futur (optionnel)

6. ⏳ **Statistiques client**
   - Graphique demandes par mois
   - Taux de réussite (combien abouties)
   - Export PDF historique

7. ⏳ **Recherche archives**
   - Recherche par date, artisan, montant
   - Filtres avancés

---

## 📝 Checklist implémentation

```
✅ 1. Ajouter helper getDaysSince() dans utils
✅ 2. Créer canCancelDemande() et canDeleteDemande() avec délai 7j
✅ 3. UI : Boutons "Annuler" (immédiat) vs "Supprimer" (après 7j)
✅ 4. Créer rappelerArtisansDemandesEnAttente Cloud Function
✅ 5. Créer cleanupOldDemandes Cloud Function (suppression 30j)
✅ 6. Ajouter champ archived + dateArchivage
✅ 7. Créer archiverDemande() service
✅ 8. UI : Onglet "En attente" avec badge 🔔
✅ 9. UI : Bouton "Archiver" + Toggle "Voir archives"
✅ 10. Déployer Cloud Functions
⏳ 11. Tests : Scénarios annulation/suppression/rappels
⏳ 12. Documentation utilisateur
```

---

## 🔄 Workflow final complet

```
CLIENT CRÉE DEMANDE
↓
statut: 'genere' (brouillon)
→ Client peut supprimer librement ✅
↓
CLIENT PUBLIE
↓
statut: 'publiee' + dateExpiration calculée
→ Visible artisans ✅
→ Client peut ANNULER (pas supprimer) ⚠️
↓
⏰ DÉLAI D'ATTENTE ARTISAN
↓
Jour 0-3 : En attente normale
→ Client peut annuler (statut → 'annulee')
→ Suppression interdite ❌
↓
Jour 3 : 🔔 RAPPEL ARTISAN
→ Notification: "Rappel : Demande en attente"
→ Badge "Urgent" sur demande
↓
Jour 7 : ⏰ TIMEOUT + OPTIONS CLIENT
→ Notification client: "Aucune réponse"
→ Bouton "Annuler" visible
→ Bouton "Supprimer" visible ✅
→ Bouton "Prolonger attente" (+7j)
↓
┌──────────────────────┬───────────────────────┐
│ ARTISAN REFUSE      │ ARTISAN ENVOIE DEVIS  │
├──────────────────────┼───────────────────────┤
│ statut: 'annulee'   │ devisRecus++          │
│ Archivage immédiat  │ Suppression interdite │
│ Suppression 30j     │                       │
└──────────────────────┤                       │
                      ↓                       │
              CLIENT ACCEPTE DEVIS            │
                      ↓                       │
              statut: 'en_cours'              │
              Suppression interdite ❌        │
                      ↓                       │
              CLIENT PAIE                     │
                      ↓                       │
              statut: 'attribuee'             │
              Conservation légale ✅          │
                      ↓                       │
              TRAVAUX FINIS                   │
                      ↓                       │
## 🆕 Nouveaux champs Demande recommandés

```typescript
// frontend/src/types/firestore.ts
export interface Demande {
  // ... existing fields
  
  // Gestion annulation client
  annulePar?: 'client' | 'artisan';           // Qui a annulé
  motifAnnulation?: string;                    // Raison annulation
  dateAnnulation?: Timestamp;                  // Quand annulé
  
  // Système rappels artisan
  dernierRappelArtisan?: Timestamp;            // Dernier rappel envoyé
  nombreRappelsEnvoyes?: number;               // Compteur rappels
  delaiSupplementaireDemande?: boolean;        // Client a prolongé attente
  dateProchainRappel?: Timestamp;              // Prochain rappel planifié
}
```

---

## 🔧 Implémentation Cloud Function - Rappels artisans

```typescript
// functions/src/scheduledJobs/rappelerArtisansDemandesEnAttente.ts

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

/**
 * Rappelle les artisans qui n'ont pas répondu aux demandes
 * Exécution : Quotidienne à 10h
 */
export const rappelerArtisansDemandesEnAttente = functions.pubsub
  .schedule('0 10 * * *')  // 10h tous les jours
  .timeZone('Europe/Paris')
  .onRun(async () => {
    const db = admin.firestore();
    const now = admin.firestore.Timestamp.now();
    const nowMs = now.toMillis();
    
    // Calculer il y a 3 et 7 jours
    const il3Jours = new Date(nowMs - 3 * 24 * 60 * 60 * 1000);
    const il7Jours = new Date(nowMs - 7 * 24 * 60 * 60 * 1000);
    const timestamp3j = admin.firestore.Timestamp.fromDate(il3Jours);
    const timestamp7j = admin.firestore.Timestamp.fromDate(il7Jours);
    
    console.log('🔔 Rappels artisans - Demandes en attente');
    
    // Récupérer demandes publiées sans devis
    const demandesSnapshot = await db.collection('demandes')
      .where('statut', '==', 'publiee')
      .where('devisRecus', '==', 0)
      .get();
    
    let rappels3j = 0;
    let rappels7j = 0;
    
    for (const demandeDoc of demandesSnapshot.docs) {
      const demande = demandeDoc.data();
      const createdAt = demande.createdAt as admin.firestore.Timestamp;
      const daysSince = Math.floor((nowMs - createdAt.toMillis()) / (24 * 60 * 60 * 1000));
      
      // CAS 1: Jour 3 - Rappel artisan
      if (daysSince === 3 && !demande.dernierRappelArtisan) {
        // Notification artisan(s)
        const artisanIds = demande.artisanMatcheIds || [];
        
        for (const artisanId of artisanIds) {
          await db.collection('notifications').add({
            recipientId: artisanId,
            type: 'rappel_demande_en_attente',
            title: '🔔 Rappel : Demande en attente',
            message: `La demande "${demande.titre}" attend votre réponse depuis 3 jours`,
            relatedId: demandeDoc.id,
            relatedType: 'demande',
            isRead: false,
            createdAt: now,
          });
        }
        
        // Mettre à jour demande
        await demandeDoc.ref.update({
          dernierRappelArtisan: now,
          nombreRappelsEnvoyes: (demande.nombreRappelsEnvoyes || 0) + 1,
        });
        
        rappels3j++;
        console.log(`  🔔 Rappel J+3 : ${demandeDoc.id}`);
      }
      
      // CAS 2: Jour 7 - Notification client
      if (daysSince === 7) {
        // Notification client
        await db.collection('notifications').add({
          recipientId: demande.clientId,
          type: 'demande_sans_reponse',
          title: '⏰ Aucune réponse de l\'artisan',
          message: `Votre demande "${demande.titre}" n'a pas reçu de réponse après 7 jours. Vous pouvez l'annuler ou attendre.`,
          relatedId: demandeDoc.id,
          relatedType: 'demande',
          isRead: false,
          createdAt: now,
          actionButtons: [
            { label: 'Annuler la demande', action: 'cancel' },
            { label: 'Prolonger l\'attente', action: 'extend' },
          ],
        });
        
        rappels7j++;
        console.log(`  ⏰ Notification client J+7 : ${demandeDoc.id}`);
      }
    }
    
    console.log(`✅ ${rappels3j} rappel(s) artisan J+3, ${rappels7j} notification(s) client J+7`);
    
    return { success: true, rappels3j, rappels7j };
  });
```

**Déploiement** :
```bash
firebase deploy --only functions:rappelerArtisansDemandesEnAttente
```

---

**Résumé en 1 phrase** :  
*Client peut ANNULER immédiatement mais SUPPRIMER uniquement après 7 jours sans réponse artisan, avec système de rappels automatiques (J+3 artisan, J+7 client) et conservation trace pour historique
              Conservation légale ✅          │
              
┌──────────────────────────────────────────┐
│ SI AUCUN DEVIS ACCEPTÉ + DATE DÉPASSÉE  │
├──────────────────────────────────────────┤
│ Cloud Function quotidienne (1h)         │
│ statut: 'expiree'                        │
│ Archivage auto ✅                        │
│ Suppression auto après 30j ✅            │
└──────────────────────────────────────────┘
```

---

**Résumé en 1 phrase** :  
*Demandes brouillons supprimables immédiatement, demandes publiées sans devis supprimables, demandes avec devis/paiement archivables uniquement, expirées/annulées supprimées automatiquement après 30 jours.*
