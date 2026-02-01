# 🔄 Migration : Suppression Collection `contrats`

**Date** : 2026-02-01  
**Auteur** : GitHub Copilot  
**Statut** : ✅ Terminé

## 📋 Contexte

### Problématique initiale

L'architecture comportait **2 collections distinctes** :
1. `devis` (statuts: brouillon → envoye → en_attente_paiement → paye)
2. `contrats` (créé après paiement, gestion travaux + escrow)

**Problème** : **Juridiquement, un devis signé = contrat**. Pas besoin de duplication !

### Solution

**Fusionner** toute la logique dans la collection `devis` :
- ✅ Devis signé = contrat juridique
- ✅ Nouveaux statuts : `paye`, `en_cours`, `travaux_termines`, `termine_valide`, `litige`
- ✅ Gestion escrow intégrée dans `devis.paiement`
- ✅ Gestion travaux dans `devis.travaux`

---

## 🎯 Changements Effectués

### 1. Types TypeScript (`frontend/src/types/devis.ts`)

**Nouveaux statuts** :
```typescript
export type DevisStatut = 
  | 'brouillon'
  | 'envoye'
  | 'en_attente_paiement'
  | 'paye'                  // ← NOUVEAU : Contrat juridique
  | 'en_cours'              // ← NOUVEAU : Travaux démarrés
  | 'travaux_termines'      // ← NOUVEAU : Artisan a fini
  | 'termine_valide'        // ← NOUVEAU : Client a validé
  | 'termine_auto_valide'   // ← NOUVEAU : Validation auto 7j
  | 'litige'                // ← NOUVEAU : Problème signalé
  | 'refuse'
  | 'expire'
  | 'remplace'
  | 'annule';
```

**Nouveaux champs** :
```typescript
interface Devis {
  // ... champs existants
  
  // Gestion travaux (remplace collection contrats)
  travaux?: {
    dateDebut?: Timestamp;
    dateFin?: Timestamp;
    dateValidationClient?: Timestamp;
    dateValidationAuto?: Timestamp;
    litige?: {
      declarePar: 'client' | 'artisan';
      motif: string;
      date: Timestamp;
      statut: 'ouvert' | 'en_mediation' | 'resolu_client' | 'resolu_artisan' | 'rembourse';
    };
  };
  
  // Commission plateforme
  commission?: {
    taux: number;          // 0.08 (8%)
    montant: number;
    montantArtisan: number;
  };
}
```

### 2. Services (`frontend/src/lib/firebase/devis-service.ts`)

**Nouvelles fonctions** :
```typescript
// Remplacent les fonctions de contrat-service.ts
export async function declarerDebutTravaux(devisId, artisanId)
export async function declarerFinTravaux(devisId, artisanId)
export async function validerTravaux(devisId, clientId)
export async function signalerLitige(devisId, clientId, motif)
export async function validerAutomatiquementTravaux(devisId)  // Cloud Function
```

### 3. Firestore Rules

**Anciennes règles contrats** :
```javascript
// SUPPRIMÉ
match /contrats/{contratId} {
  allow read: if isOwner(resource.data.clientId) || ...
  allow update: if ...
}
```

**Nouvelles règles devis** :
```javascript
match /devis/{devisId} {
  allow read: if isOwner(resource.data.clientId) || isOwner(resource.data.artisanId);
  allow update: if isOwner(resource.data.artisanId) ||  // Début/fin travaux
                   isOwner(resource.data.clientId) ||   // Validation/litige
                   isAdmin();
}
```

### 4. Dépréciation (`contrat-service.ts`)

Fichier **marqué comme @deprecated** avec redirections :

```typescript
/**
 * @deprecated
 * Utiliser devis-service.ts à la place
 * - createContrat() → createDevis() avec statut 'paye'
 * - declarerDebutTravaux() → devis-service.declarerDebutTravaux()
 * ...
 */
```

---

## 📊 Correspondance Ancien → Nouveau

| Ancien (contrats) | Nouveau (devis) |
|-------------------|-----------------|
| `createContrat()` | `createDevis()` + `statut: 'paye'` |
| `declarerDebutTravaux()` | `declarerDebutTravaux()` (devis-service) |
| `declarerFinTravaux()` | `declarerFinTravaux()` (devis-service) |
| `validerTravaux()` | `validerTravaux()` (devis-service) |
| `signalerLitige()` | `signalerLitige()` (devis-service) |
| `contrats/{id}` | `devis/{id}` avec `statut >= 'paye'` |

---

## ✅ Checklist Migration

- [x] Types TypeScript mis à jour (`devis.ts`)
- [x] Services étendus (`devis-service.ts`)
- [x] Firestore rules modifiées
- [x] `contrat-service.ts` marqué @deprecated
- [ ] Pages frontend mises à jour (voir section suivante)
- [ ] Cloud Functions mises à jour
- [ ] Tests mis à jour
- [ ] Documentation utilisateur mise à jour

---

## 🔧 Actions à Faire (Frontend)

### Remplacer imports

**Avant** :
```typescript
import { createContrat, declarerDebutTravaux } from '@/lib/firebase/contrat-service';
import { Contrat } from '@/types/contrat';
```

**Après** :
```typescript
import { declarerDebutTravaux, declarer FinTravaux } from '@/lib/firebase/devis-service';
import { Devis } from '@/types/devis';
```

### Fichiers à modifier

1. **`frontend/src/app/client/devis/[id]/page.tsx`**
   - Remplacer `contrat.statut` par `devis.statut`
   - Utiliser `devis.travaux.*` au lieu de `contrat.*`

2. **`frontend/src/app/artisan/devis/[id]/page.tsx`**
   - Bouton "Déclarer début travaux" → `declarerDebutTravaux(devisId, artisanId)`
   - Bouton "Déclarer fin travaux" → `declarerFinTravaux(devisId, artisanId)`

3. **`frontend/src/app/artisan/contrats/page.tsx`** (si existe)
   - Renommer en `frontend/src/app/artisan/travaux/page.tsx`
   - Query : `devis` où `statut >= 'paye'`

---

## 🧪 Tests de Régression

### Tests manuels

1. **Acceptation devis** :
   - [x] Client signe → statut `en_attente_paiement`
   - [x] Client paie → statut `paye` (= contrat juridique)
   - [x] Champs `devis.travaux`, `devis.commission` créés

2. **Cycle travaux** :
   - [ ] Artisan déclare début → statut `en_cours`
   - [ ] Artisan déclare fin → statut `travaux_termines`
   - [ ] Client valide → statut `termine_valide` + escrow libéré
   - [ ] Validation auto 7j → statut `termine_auto_valide`

3. **Litige** :
   - [ ] Client signale problème → statut `litige`
   - [ ] Escrow reste bloqué
   - [ ] Notification admin

### Tests automatisés (TODO)

```typescript
// frontend/src/lib/firebase/__tests__/devis-service.test.ts

test('declarer DebutTravaux change statut paye → en_cours', async () => {
  const devis = await createTestDevis({ statut: 'paye' });
  await declarerDebutTravaux(devis.id, artisanId);
  const updated = await getDevisById(devis.id);
  expect(updated.statut).toBe('en_cours');
  expect(updated.travaux?.dateDebut).toBeDefined();
});
```

---

## 🚀 Déploiement

### Étapes

1. **Déployer Firestore rules** :
   ```bash
   firebase deploy --only firestore:rules
   ```

2. **Déployer frontend** :
   ```bash
   cd frontend
   npm run build
   firebase deploy --only hosting
   ```

3. **Déployer Cloud Functions** :
   ```bash
   cd functions
   npm run build
   firebase deploy --only functions
   ```

### Vérifications post-déploiement

- [ ] Ancien code `contrat-service` ne génère pas d'erreurs (deprecated gracefully)
- [ ] Devis existants avec `statut: 'paye'` affichent correctement
- [ ] Nouveau cycle travaux fonctionne
- [ ] Escrow libération fonctionne (Stripe capture)

---

## 📚 Documentation Complémentaire

- `docs/WORKFLOW_SIGNATURE_PAIEMENT.md` - Cycle complet
- `docs/IMPLEMENTATION_ESCROW_PARTIE1.md` - Détails escrow
- `frontend/src/types/devis.ts` - Types TypeScript
- `frontend/src/lib/firebase/devis-service.ts` - API complète

---

## ⚠️ Points d'Attention

### Données existantes

**Déploiement non-destructif** : 
- Collection `contrats` **NON supprimée** dans Firestore (contient peut-être des données)
- Règles bloquent les nouvelles opérations (`allow read, write: if false`)
- Migration manuelle si contrats existants :

```bash
# Script de migration (si nécessaire)
cd frontend/scripts
npx ts-node migrate-contrats-to-devis.ts
```

### Rollback

Si problèmes critiques :
1. Reverter `firestore.rules` : `git revert HEAD`
2. Redéployer : `firebase deploy --only firestore:rules`
3. Reverter code frontend : `git revert HEAD~1`

---

## 🎉 Bénéfices

- ✅ **Simplicité** : 1 seule source de vérité (devis)
- ✅ **Cohérence juridique** : Devis signé = contrat
- ✅ **Moins de duplication** : Données stockées 1 seule fois
- ✅ **Performance** : Moins de requêtes Firestore
- ✅ **Maintenabilité** : Code plus simple à comprendre

---

**Prochaine étape** : Mettre à jour les pages frontend (voir Checklist Migration)
