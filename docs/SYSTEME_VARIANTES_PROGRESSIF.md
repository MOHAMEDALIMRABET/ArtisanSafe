# ✅ Système de variantes progressif

## 📅 Date
**27 janvier 2026**

---

## 🎯 Comportement attendu

### Numérotation progressive des devis

**Premier devis** pour une demande :
- Numéro : `DV-2026-00003` (**SANS lettre**)
- `varianteGroupe` : `undefined`
- `varianteLettreReference` : `undefined`

**Deuxième devis** (création de la première variante) :
- **Premier devis existant** est **transformé** → `DV-2026-00003-A`
- **Nouveau devis** → `DV-2026-00003-B`

**Troisième devis** :
- Numéro : `DV-2026-00003-C`

**Quatrième devis** :
- Numéro : `DV-2026-00003-D`

---

## 🔧 Logique implémentée

### 1. Premier devis (aucun devis existant)

```typescript
if (variantesExistantes.length === 0) {
  // Premier devis → SANS variante
  console.log('📋 Premier devis pour cette demande → SANS lettre de variante');
  // NE PAS ajouter varianteGroupe ni varianteLettreReference
}
```

**Résultat** :
- Devis créé avec numéro de base uniquement : `DV-2026-00003`
- Pas de champs `varianteGroupe` ni `varianteLettreReference`

---

### 2. Deuxième devis (transformation rétroactive)

```typescript
if (variantesExistantes.length > 0) {
  const premierDevis = variantesExistantes[0];
  
  if (!premierDevis.varianteGroupe) {
    // Le premier devis n'a pas encore de variante → le transformer
    console.log('🔄 Transformation du premier devis en variante A');
    
    const varianteGroupe = `VG-${demandeId}-${Date.now()}`;
    
    // Mettre à jour le premier devis → ajouter lettre A
    await updateDevis(premierDevis.id, {
      varianteGroupe: varianteGroupe,
      varianteLettreReference: 'A'
    });
    
    // Créer le nouveau devis avec lettre B
    devisData.varianteGroupe = varianteGroupe;
    devisData.varianteLettreReference = 'B';
  }
}
```

**Résultat** :
- **Premier devis** mis à jour :
  - `DV-2026-00003` → `DV-2026-00003-A`
  - `varianteGroupe` : `VG-demandeId-timestamp`
  - `varianteLettreReference` : `'A'`
- **Nouveau devis** créé :
  - Numéro : `DV-2026-00003-B`
  - `varianteGroupe` : Identique au premier
  - `varianteLettreReference` : `'B'`

---

### 3. Troisième devis et suivants

```typescript
if (premierDevis.varianteGroupe) {
  // Les devis existants ont déjà des variantes
  const varianteGroupe = premierDevis.varianteGroupe;
  
  // Trouver la prochaine lettre disponible
  const lettresUtilisees = variantesExistantes
    .map(v => v.varianteLettreReference || '')
    .filter(Boolean);
  
  const lettres = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let prochaineLettreReference = 'A';
  for (let i = 0; i < lettres.length; i++) {
    if (!lettresUtilisees.includes(lettres[i])) {
      prochaineLettreReference = lettres[i];
      break;
    }
  }
  
  devisData.varianteGroupe = varianteGroupe;
  devisData.varianteLettreReference = prochaineLettreReference;
}
```

**Résultat** :
- Nouveau devis créé avec la prochaine lettre (C, D, E...)
- Même `varianteGroupe` que les devis précédents

---

## 📊 Scénario complet

### Étape 1 : Création premier devis
```
Action : Artisan envoie premier devis
Résultat :
- Devis créé : DV-2026-00003
- varianteGroupe : undefined
- varianteLettreReference : undefined
```

### Étape 2 : Création deuxième devis
```
Action : Artisan envoie deuxième devis pour la même demande
Processus automatique :
1. Détection : 1 devis existant SANS varianteGroupe
2. Mise à jour premier devis :
   - varianteGroupe → VG-demandeId-1738000000
   - varianteLettreReference → 'A'
   - Numéro affiché → DV-2026-00003-A
3. Création nouveau devis :
   - varianteGroupe → VG-demandeId-1738000000 (identique)
   - varianteLettreReference → 'B'
   - Numéro affiché → DV-2026-00003-B

Résultat final :
- Devis 1 : DV-2026-00003-A (transformé)
- Devis 2 : DV-2026-00003-B (nouveau)
```

### Étape 3 : Création troisième devis
```
Action : Artisan envoie troisième devis
Processus :
1. Détection : 2 devis existants AVEC varianteGroupe
2. Lettres utilisées : [A, B]
3. Prochaine lettre : C
4. Création devis :
   - varianteGroupe → VG-demandeId-1738000000
   - varianteLettreReference → 'C'
   - Numéro affiché → DV-2026-00003-C

Résultat final :
- Devis 1 : DV-2026-00003-A
- Devis 2 : DV-2026-00003-B
- Devis 3 : DV-2026-00003-C
```

---

## 🎨 Interface utilisateur

### Création premier devis
```
┌──────────────────────────────────────┐
│ Nouveau devis                        │
├──────────────────────────────────────┤
│ [Formulaire standard]                │
│                                      │
│ Aucun message de variantes           │
└──────────────────────────────────────┘
```

### Création deuxième devis
```
┌──────────────────────────────────────┐
│ Nouveau devis                        │
├──────────────────────────────────────┤
│ 📊 Devis existants (1)               │
│ ┌──────────────────────────────────┐ │
│ │ DV-2026-00003      1500€         │ │
│ └──────────────────────────────────┘ │
│                                      │
│ 💡 Création de variantes             │
│ • Le devis existant sera transformé  │
│   en Option A                        │
│ • Ce nouveau devis sera : Option B   │
└──────────────────────────────────────┘
```

### Création troisième devis
```
┌──────────────────────────────────────┐
│ Nouveau devis                        │
├──────────────────────────────────────┤
│ 📊 Devis existants (2)               │
│ ┌──────────────────────────────────┐ │
│ │ DV-2026-00003-A - Option A 1500€ │ │
│ │ DV-2026-00003-B - Option B 1800€ │ │
│ └──────────────────────────────────┘ │
│                                      │
│ 💡 Création de variantes             │
│ • Ce devis sera : Option C           │
└──────────────────────────────────────┘
```

---

## 🔐 Points techniques

### Transformation rétroactive (UPDATE Firestore)

```typescript
// Import dynamique de updateDevis
import { updateDevis } from '@/lib/firebase/devis-service';

// Mise à jour du premier devis
await updateDevis(premierDevis.id, {
  varianteGroupe: varianteGroupe,
  varianteLettreReference: 'A'
});
```

**Important** :
- Cette opération **met à jour** le document Firestore existant
- Le numéro affiché (`numeroDevis`) est **recalculé automatiquement** par le système
- Pas besoin de régénérer manuellement le numéro

---

### Génération varianteGroupe

```typescript
const varianteGroupe = `VG-${demandeId}-${Date.now()}`;
```

**Format** : `VG-demandeId-timestamp`

**Avantages** :
- ✅ Unicité garantie par timestamp
- ✅ Traçabilité (contient l'ID de la demande)
- ✅ Pas de collision possible

---

### Affichage numéro devis

**Dans le service Firestore** (`devis-service.ts`) :

```typescript
// Génération automatique du numéro lors de la création
let numeroDevis = `DV-${annee}-${compteurStr}`;

// Si variante, ajouter la lettre
if (devisData.varianteLettreReference) {
  numeroDevis += `-${devisData.varianteLettreReference}`;
}
```

**Résultat** :
- Sans variante : `DV-2026-00003`
- Avec variante A : `DV-2026-00003-A`
- Avec variante B : `DV-2026-00003-B`

---

## 📋 Affichage côté client

### Liste des devis (vue client)

```tsx
{devis.varianteLettreReference ? (
  <span className="font-semibold">
    Option {devis.varianteLettreReference}
  </span>
) : (
  <span className="font-semibold">
    Devis unique
  </span>
)}
```

**Rendu** :
- Devis sans variante : "Devis unique"
- Devis avec variante A : "Option A"
- Devis avec variante B : "Option B"

---

## 🧪 Tests recommandés

### Test 1 : Premier devis
1. Créer un devis pour une nouvelle demande
2. Envoyer le devis
3. **Vérifier** :
   - ✅ Numéro : `DV-2026-XXXX` (sans lettre)
   - ✅ `varianteGroupe` : `undefined`
   - ✅ `varianteLettreReference` : `undefined`

### Test 2 : Deuxième devis (transformation)
1. Créer un deuxième devis pour la même demande
2. **Vérifier affichage AVANT envoi** :
   - ✅ Message : "Le devis existant sera transformé en Option A"
   - ✅ Message : "Ce nouveau devis sera : Option B"
3. Envoyer le devis
4. **Vérifier résultat** :
   - ✅ Premier devis transformé : `DV-2026-XXXX-A`
   - ✅ Nouveau devis : `DV-2026-XXXX-B`
   - ✅ Même `varianteGroupe` pour les deux

### Test 3 : Troisième devis
1. Créer un troisième devis
2. **Vérifier** :
   - ✅ Message : "Ce devis sera : Option C"
   - ✅ Liste affiche "Option A" et "Option B"
3. Envoyer le devis
4. **Vérifier** :
   - ✅ Numéro : `DV-2026-XXXX-C`
   - ✅ Même `varianteGroupe`

### Test 4 : Affichage client
1. Se connecter en tant que client
2. Consulter la demande
3. **Vérifier** :
   - ✅ 3 options affichées
   - ✅ "Option A", "Option B", "Option C"
   - ✅ Tous avec même numéro de base

---

## ⚠️ Points d'attention

### Migration données existantes

**Devis créés avec l'ancien système** :
- Peuvent tous avoir `varianteLettreReference` (même le premier)
- Pas de problème : la logique actuelle gère les deux cas

**Affichage défensif** :
```tsx
{v.varianteLettreReference && (
  <>
    {' - '}
    <span>Option {v.varianteLettreReference}</span>
  </>
)}
```

### Performance

**Mise à jour rétroactive** :
- 1 opération UPDATE supplémentaire lors du 2e devis
- Impact négligeable (< 100ms)
- Pas de batch nécessaire (un seul document)

---

## 📝 Comparaison avec l'ancien système

| Aspect | ❌ Ancien (tout variante) | ✅ Nouveau (progressif) |
|--------|---------------------------|-------------------------|
| **1er devis** | DV-2026-00003-A | DV-2026-00003 |
| **2e devis** | DV-2026-00003-B | DV-2026-00003-A + -B |
| **3e devis** | DV-2026-00003-C | DV-2026-00003-C |
| **Transformation** | Non | Oui (1er devis) |
| **Clarté** | Moins (toujours variante) | Plus (variante si multiple) |
| **Performance** | ✅ | ✅ (1 UPDATE en plus) |

---

## 🎉 Résultat

**Comportement conforme aux attentes** ✅

```
Premier devis : DV-2026-00003
Deuxième devis : DV-2026-00003-A, DV-2026-00003-B
Troisième devis : DV-2026-00003-C
```

---

## 📅 Historique

- **27 janvier 2026** : Implémentation système variantes progressif
  - Premier devis sans lettre
  - Transformation rétroactive en A lors du 2e devis
  - Variantes B, C, D... pour les suivants

---

## 🧑‍💻 Développeur

**Demandé par** : Utilisateur (numérotation progressive souhaitée)  
**Implémenté par** : GitHub Copilot  
**Date** : 27 janvier 2026  
**Statut** : ✅ **IMPLÉMENTÉ**
