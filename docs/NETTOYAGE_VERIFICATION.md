# Nettoyage du système de vérification - 5 janvier 2026

## 🧹 Champs supprimés (ancien système)

Les champs suivants ont été **complètement retirés** du code :

- ❌ `badgeVerifie` (boolean)
- ❌ `documentsVerifies` (boolean)  
- ❌ `dateVerification` (Timestamp)

## ✅ Nouveau système (unique)

**Champs principaux** :
- `verified` (boolean) - **Utilisé dans toutes les recherches Firestore**
- `verificationStatus` ('pending' | 'approved' | 'rejected')
- `verificationDate` (Timestamp)

**Champs de vérification SIRET** :
- `siretVerified` (boolean)
- `siretVerificationDate` (Timestamp)

---

## 📝 Fichiers modifiés

### 1. Types TypeScript
**`frontend/src/types/firestore.ts`**
- ❌ Supprimé : `badgeVerifie`, `documentsVerifies`, `dateVerification`
- ✅ Gardé : `verified`, `verificationStatus`, `verificationDate`

### 2. Services backend

**`frontend/src/lib/auth-service.ts`**
- ❌ Supprimé l'initialisation de `badgeVerifie: false, documentsVerifies: false`
- ✅ Conservé : `verified: false, verificationStatus: 'pending'`
- ✅ Ajouté : `siretVerified: false`

**`frontend/src/lib/firebase/verification-service.ts`**
- ❌ Supprimé les mises à jour de `badgeVerifie`, `documentsVerifies`, `dateVerification`
- ✅ Mise à jour : Quand KBIS + Carte ID validés → `verified: true`
- ✅ Mise à jour : Si document rejeté → `verified: false, verificationStatus: 'rejected'`

**`frontend/src/lib/firebase/artisan-service.ts`**
- ❌ Supprimé : `badgeVerifie`, `documentsVerifies`, `dateVerification`
- ✅ Remplacé toutes les requêtes `where('badgeVerifie', '==', true)` par `where('verified', '==', true)`

**`frontend/src/lib/firebase/matching-service.ts`**
- ✅ Déjà corrigé : Utilise `where('verified', '==', true)`

### 3. Composants UI

**`frontend/src/app/artisan/dashboard/page.tsx`**
- ❌ Supprimé : `artisan?.badgeVerifie`
- ✅ Remplacé par : `artisan?.verified`

**`frontend/src/app/artisan/profil/page.tsx`**
- ❌ Supprimé : `artisan?.badgeVerifie`
- ✅ Remplacé par : `artisan?.verified`

**`frontend/src/app/resultats/page.tsx`**
- ❌ Supprimé : `result.artisan.badgeVerifie`
- ✅ Remplacé par : `result.artisan.verified`

### 4. Scripts utilitaires

**`frontend/src/scripts/verifier-artisan-manuel.ts`**
- ❌ Supprimé : `badgeVerifie`, `documentsVerifies`, `dateVerification`
- ✅ Conservé : `verified: true, verificationStatus: 'approved'`

---

## 🎯 Workflow de vérification (nouveau système)

### Inscription artisan
```typescript
{
  verified: false,
  verificationStatus: 'pending',
  siretVerified: false
}
```

### Admin valide KBIS
```typescript
{
  verificationDocuments.kbis.verified: true,
  // verified reste à false (en attente de la carte ID)
}
```

### Admin valide RC Pro (activation automatique)
```typescript
{
  verificationDocuments.rcPro.verified: true,
  
  // ✅ Les 3 documents sont validés (KBIS + ID + RC Pro) → activation automatique
  verified: true,
  verificationStatus: 'approved',
  verificationDate: Timestamp.now()
}
```

### Admin rejette un document
```typescript
{
  verificationDocuments.kbis.rejected: true,
  verificationDocuments.kbis.rejectionReason: "...",
  
  // ❌ Désactivation immédiate
  verified: false,
  verificationStatus: 'rejected'
}
```

---

## 🔍 Requêtes Firestore affectées

### AVANT (ancien système)
```typescript
where('badgeVerifie', '==', true)
where('documentsVerifies', '==', false)
```

### APRÈS (nouveau système)
```typescript
where('verified', '==', true)  // Artisans actifs
where('verified', '==', false) // Artisans en attente
```

---

## ⚠️ Migration des données existantes

**Si vous avez des artisans existants dans Firestore** :

### Option 1 - Via l'interface admin
1. Aller dans `/admin/verifications`
2. Valider le KBIS de l'artisan
3. Valider la Carte ID de l'artisan
4. → Le champ `verified: true` sera automatiquement ajouté

### Option 2 - Manuellement dans Firebase Console
1. Ouvrir [Firebase Console](https://console.firebase.google.com)
2. Firestore → Collection `artisans`
3. Pour chaque artisan, ajouter :
   - `verified` = `true` (boolean)
   - `verificationStatus` = `'approved'` (string)
   - `siretVerified` = `false` (boolean)
4. Supprimer (optionnel) :
   - `badgeVerifie`
   - `documentsVerifies`
   - `dateVerification`

---

## ✅ Avantages du nouveau système

1. **Un seul champ de vérification** : `verified` (plus simple)
2. **Workflow clair** : `pending` → `approved` | `rejected`
3. **Activation automatique** : Dès que les 3 documents (KBIS + ID + RC Pro) sont validés
4. **Désactivation immédiate** : Si un document est rejeté
5. **Cohérence** : Toutes les requêtes utilisent le même champ

---

## 🧪 Tests à effectuer

- [ ] Inscription d'un nouvel artisan → `verified: false`
- [ ] Validation KBIS uniquement → `verified` reste `false`
- [ ] Validation Carte ID après KBIS → `verified` reste `false`
- [ ] Validation RC Pro après KBIS + ID → `verified` passe à `true`
- [ ] Recherche artisan → Apparaît uniquement si `verified: true`
- [ ] Rejet d'un document → `verified` passe à `false`
- [ ] Badge "Vérifié" affiché sur profil → Utilise `artisan.verified`

---

**Date de nettoyage** : 5 janvier 2026  
**Développeur** : GitHub Copilot  
**Statut** : ✅ Terminé
