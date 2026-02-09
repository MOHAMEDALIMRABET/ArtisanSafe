# FIX : Attribution automatique artisan dans artisansMatches

## 📋 Contexte

### Problème identifié
Dans les versions précédentes, lorsqu'un client acceptait un devis, l'artisan **n'était pas automatiquement ajouté** au champ `artisansMatches` de la demande.

### Impact
```javascript
// AVANT (incohérent)
demande: {
  id: "DEM-001",
  type: "publique",
  artisansMatches: []  // ← VIDE ❌
}

devis: {
  artisanId: "artisan-123",
  statut: "paye"  // ← PAYÉ ✓
}
```

**Conséquences** :
- ✅ Badge "✅ Devis signé" s'affichait correctement (utilise devis, pas artisansMatches)
- ✅ Nom artisan affiché dans l'interface (récupéré depuis devis)
- ❌ **MAIS** données incohérentes dans Firestore
- ❌ Requêtes futures impossibles : `where('artisansMatches', 'array-contains', artisanId)`
- ❌ Traçabilité audit/RGPD difficile

---

## ✅ Solution implémentée

### Modification automatique lors acceptation

**Fichier** : `frontend/src/lib/firebase/devis-service.ts`

#### 1. Import `arrayUnion`
```typescript
import {
  // ... autres imports
  arrayUnion,  // ← Ajouté
} from 'firebase/firestore';
```

#### 2. Lors de l'acceptation (`statut: 'accepte'`)
```typescript
} else if (updates.statut === 'accepte') {
  updateData.dateAcceptation = Timestamp.now();
  updateData.dateDerniereNotification = Timestamp.now();
  
  // 🆕 ATTRIBUTION ARTISAN
  if (devisActuel.demandeId) {
    try {
      const demandeRef = doc(db, 'demandes', devisActuel.demandeId);
      await updateDoc(demandeRef, {
        artisansMatches: arrayUnion(devisActuel.artisanId),  // ← Ajoute si absent
        dateModification: Timestamp.now(),
      });
      console.log('✅ Artisan ajouté à artisansMatches:', devisActuel.artisanId);
    } catch (error) {
      console.error('⚠️ Erreur mise à jour artisansMatches:', error);
    }
  }
  
  // ... reste du code
}
```

#### 3. Lors du paiement direct (`statut: 'paye'`)
```typescript
} else if (updates.statut === 'paye') {
  updateData.datePaiement = Timestamp.now();
  updateData.dateDerniereNotification = Timestamp.now();
  
  // 🆕 ATTRIBUTION ARTISAN (même logique)
  if (devisActuel.demandeId) {
    try {
      const demandeRef = doc(db, 'demandes', devisActuel.demandeId);
      await updateDoc(demandeRef, {
        artisansMatches: arrayUnion(devisActuel.artisanId),
        dateModification: Timestamp.now(),
      });
      console.log('✅ Artisan ajouté à artisansMatches (paiement):', devisActuel.artisanId);
    } catch (error) {
      console.error('⚠️ Erreur mise à jour artisansMatches (paiement):', error);
    }
  }
  
  // ... reste du code
}
```

---

## 🔄 Migration des données existantes

### Script de migration
**Fichier** : `frontend/scripts/migrate-artisans-matches.ts`

**Objectif** : Corriger rétroactivement les demandes qui ont des devis acceptés/payés mais `artisansMatches` vide.

### Exécution
```bash
cd frontend/scripts
npx ts-node --project tsconfig.json migrate-artisans-matches.ts
```

### Fonctionnement
1. Récupère toutes les demandes
2. Récupère tous les devis avec statut : `['accepte', 'paye', 'en_cours', 'travaux_termines', 'termine_valide']`
3. Crée une Map `demandeId → Set<artisanId>`
4. Pour chaque demande :
   - Compare `artisansMatches` actuel vs artisans des devis
   - Si artisans manquants → Ajoute avec `arrayUnion`
   - Ignore si déjà à jour

### Exemple de logs
```
🚀 Démarrage migration artisansMatches...

📥 Récupération des demandes...
📊 15 demande(s) trouvée(s)

📥 Récupération des devis acceptés/payés...
📊 8 devis accepté(s)/payé(s) trouvé(s)

🔗 8 demande(s) avec devis accepté/payé

────────────────────────────────────────────────────────────────────────────────

👤 Demande : "Rénovation salle de bain" (DEM-001)
   Type : publique
   Statut : publiee
   artisansMatches AVANT : [VIDE]
   Artisans manquants : [artisan-123]
   ✅ artisansMatches APRÈS : [artisan-123]
   💾 Sauvegardé dans Firestore

⏭️  Demande "Installation électrique" (DEM-002)
   ✅ Déjà à jour : artisansMatches = [artisan-456]

────────────────────────────────────────────────────────────────────────────────

✨ Migration terminée !
   ✅ 5 demande(s) migrée(s)
   👥 5 artisan(s) ajouté(s) au total
   ⏭️  10 demande(s) ignorée(s) (déjà à jour ou sans devis)
```

---

## 🎯 Résultat attendu

### Scénario : Demande publique + Devis accepté

**AVANT** :
```javascript
demande: {
  id: "DEM-001",
  type: "publique",
  statut: "publiee",
  artisansMatches: []  // ← VIDE
}

devis: {
  id: "DEVIS-001",
  demandeId: "DEM-001",
  artisanId: "artisan-123",
  statut: "paye"
}
```

**APRÈS acceptation/paiement** :
```javascript
demande: {
  id: "DEM-001",
  type: "publique",
  statut: "publiee",
  artisansMatches: ["artisan-123"]  // ← ARTISAN AJOUTÉ ✅
}

devis: {
  id: "DEVIS-001",
  demandeId: "DEM-001",
  artisanId: "artisan-123",
  statut: "paye"
}
```

---

## ✅ Bénéfices

### 1. Cohérence des données
```javascript
// Données alignées
demande.artisansMatches = ["artisan-123"]
devis.artisanId = "artisan-123"
```

### 2. Requêtes possibles
```javascript
// Chercher toutes les demandes où j'ai travaillé
const q = query(
  collection(db, 'demandes'),
  where('artisansMatches', 'array-contains', artisanId)
);
```

### 3. Traçabilité audit
```javascript
// Admin peut rapidement voir quels artisans ont travaillé
const demande = await getDemandeById('DEM-001');
console.log('Artisans:', demande.artisansMatches);  // ["artisan-123", "artisan-456"]
```

### 4. Badge reste fonctionnel
```typescript
// Badge utilise PRIORITÉ (Set devisPayés), pas artisansMatches
if (demandesAvecDevisPayeIds.has(demande.id)) {
  return "✅ Devis signé";  // ← Fonctionne toujours
}
```

### 5. Sécurité (pas de race condition)
```typescript
// arrayUnion évite les doublons et les conflits
artisansMatches: arrayUnion(artisanId)  // ← Ajoute uniquement si absent
```

---

## 📊 Utilisation de `arrayUnion`

### Pourquoi `arrayUnion` ?

**Avantage** : Opération atomique Firestore qui :
- ✅ Ajoute l'élément uniquement s'il **n'existe pas déjà**
- ✅ Évite les **doublons**
- ✅ Évite les **race conditions** (2 clients acceptent simultanément)
- ✅ **Pas besoin** de lire avant d'écrire

**Comparaison** :

```typescript
// ❌ MAUVAIS : Race condition possible
const demande = await getDemandeById(demandeId);
const newMatches = [...(demande.artisansMatches || []), artisanId];
await updateDoc(demandeRef, { artisansMatches: newMatches });
// Si 2 clients acceptent en même temps → un artisan peut être oublié

// ✅ BON : Atomique avec arrayUnion
await updateDoc(demandeRef, {
  artisansMatches: arrayUnion(artisanId)
});
// Firestore gère automatiquement la concurrence
```

---

## 🛠️ Tests suggérés

### Test 1 : Demande publique + Acceptation
1. Créer demande publique (`type: 'publique'`, `artisansMatches: []`)
2. Artisan envoie devis
3. Client accepte devis
4. **Vérifier** : `artisansMatches` contient l'artisan

### Test 2 : Demande directe (déjà assigné)
1. Créer demande directe (`artisansMatches: ['artisan-123']`)
2. Artisan envoie devis
3. Client accepte devis
4. **Vérifier** : `artisansMatches` toujours `['artisan-123']` (pas de doublon)

### Test 3 : Paiement direct (sans acceptation)
1. Créer demande publique
2. Artisan envoie devis
3. Client paye **directement** (`statut: 'envoye' → 'paye'`)
4. **Vérifier** : `artisansMatches` contient l'artisan

### Test 4 : Plusieurs artisans
1. Demande publique
2. Artisan A envoie devis, client refuse
3. Artisan B envoie devis, client accepte
4. **Vérifier** : `artisansMatches = ['artisan-B']` (pas artisan-A)

---

## 📅 Date d'implémentation

**Date** : 9 février 2026  
**Commit** : `feat(devis): attribution automatique artisan dans artisansMatches`

**Fichiers modifiés** :
- `frontend/src/lib/firebase/devis-service.ts` (logique automatique)
- `frontend/scripts/migrate-artisans-matches.ts` (migration rétroactive)
- `docs/FIX_ARTISANS_MATCHES_AUTO.md` (documentation)

---

## 🔗 Références

- **Issue GitHub** : #XXX (à créer si besoin)
- **Documentation Firebase** : [arrayUnion](https://firebase.google.com/docs/firestore/manage-data/add-data#update_elements_in_an_array)
- **Pattern utilisé** : Soft update avec `arrayUnion` (évite race conditions)
