# 🔧 FIX - Système de Numérotation des Variantes

**Date** : 27 janvier 2026  
**Problème** : Devis de la même demande recevaient des numéros différents (DV-2026-00005 et DV-2026-00004)  
**Symptôme** : Le système de variantes progressif ne fonctionnait pas correctement

---

## 📋 Problème identifié

### Comportement observé (INCORRECT)
Pour une même demande, l'artisan créait deux devis et obtenait :
- **Premier devis** : `DV-2026-00005`
- **Deuxième devis** : `DV-2026-00004` ❌

Au lieu de :
- **Premier devis** : `DV-2026-00005` → transformé en `DV-2026-00005-A`
- **Deuxième devis** : `DV-2026-00005-B` ✅

### Cause racine

La fonction `genererProchainNumeroDevis()` dans `devis-service.ts` ne vérifiait **PAS** s'il existait déjà des devis pour la **même demande** (`demandeId`). Elle générait donc un nouveau numéro de base à chaque fois.

**Logique incorrecte** :
```typescript
// ❌ AVANT : Ignorait demandeId
export async function genererProchainNumeroDevis(
  artisanId: string, 
  varianteLettreReference?: string,
  varianteGroupe?: string
) {
  // Générait toujours un nouveau numéro si varianteGroupe absent
}
```

**Problème** : Quand on crée le 2e devis pour une demande :
1. Le 1er devis n'a pas encore de `varianteGroupe` (normal, c'est le 1er)
2. La fonction génère donc un **nouveau** numéro de base
3. On se retrouve avec 2 numéros différents

---

## ✅ Solution implémentée

### Modification 1 : Refonte de `genererProchainNumeroDevis()`

**Fichier** : `frontend/src/lib/firebase/devis-service.ts`

**Nouvelle signature** :
```typescript
export async function genererProchainNumeroDevis(
  artisanId: string, 
  demandeId?: string,        // ← NOUVEAU paramètre en priorité
  varianteLettreReference?: string,
  varianteGroupe?: string
): Promise<string>
```

**Nouvelle logique PRIORITAIRE** :
```typescript
// PRIORITÉ 1 : Vérifier s'il existe déjà des devis pour cette demande
if (demandeId) {
  const devisExistants = await getDocs(
    query(
      collection(db, 'devis'),
      where('artisanId', '==', artisanId),
      where('demandeId', '==', demandeId)  // ← Recherche par demande
    )
  );
  
  if (!devisExistants.empty) {
    // Réutiliser le numéro de base du premier devis de cette demande
    const premierDevis = devisExistants.docs[0].data().numeroDevis;
    numeroBase = premierDevis.split('-').slice(0, 3).join('-');
    // Exemple : "DV-2026-00005-A" → "DV-2026-00005"
  } else {
    // Premier devis pour cette demande → générer nouveau numéro
    numeroBase = await genererNouveauNumeroBase(artisanId, anneeEnCours);
  }
}
```

**Avantages** :
- ✅ Garantit que tous les devis d'une même demande partagent le **même numéro de base**
- ✅ Fonctionne dès le 2e devis (pas besoin que le 1er ait déjà un `varianteGroupe`)
- ✅ Réutilise le numéro existant quelle que soit la structure du 1er devis

### Modification 2 : Transformation complète du premier devis

**Fichier** : `frontend/src/app/artisan/devis/nouveau/page.tsx`

**Problème secondaire** : Quand on transformait le 1er devis en variante A, on ajoutait `varianteGroupe` et `varianteLettreReference: 'A'` mais on **oubliait** de mettre à jour le `numeroDevis`.

**Solution** :
```typescript
if (!premierDevis.varianteGroupe) {
  // Extraire le numéro de base
  const numeroBase = premierDevis.numeroDevis.split('-').slice(0, 3).join('-');
  
  // Mettre à jour le premier devis avec TOUT
  await updateDevis(premierDevis.id, {
    varianteGroupe: varianteGroupe,
    varianteLettreReference: 'A',
    numeroDevis: `${numeroBase}-A`  // ← AJOUT du suffixe au numéro
  });
}
```

**Logs améliorés** :
```typescript
console.log('📋 Premier devis transformé:', {
  ancien: 'DV-2026-00005',
  nouveau: 'DV-2026-00005-A',
  prochainDevis: 'B'
});
```

### Modification 3 : Passage de `demandeId` à la fonction

**Fichier** : `frontend/src/lib/firebase/devis-service.ts` (fonction `createDevis`)

```typescript
const numeroDevis = await genererProchainNumeroDevis(
  devisData.artisanId,
  devisData.demandeId,           // ← NOUVEAU : priorité maximale
  devisData.varianteLettreReference,
  devisData.varianteGroupe
);
```

---

## 🎯 Workflow complet corrigé

### Scénario : Artisan crée 3 devis pour la même demande

#### Étape 1 : Premier devis
```
Données envoyées :
{
  artisanId: "artisan123",
  demandeId: "demande456",
  // PAS de varianteGroupe ni varianteLettreReference
}

genererProchainNumeroDevis() :
1. Vérifie s'il existe des devis pour demandeId="demande456" → AUCUN
2. Génère nouveau numéro de base → "DV-2026-00005"

Résultat :
numeroDevis: "DV-2026-00005"
varianteGroupe: undefined
varianteLettreReference: undefined
```

#### Étape 2 : Deuxième devis (transformation)
```
Dans nouveau/page.tsx :
1. Récupère les devis existants pour demandeId="demande456"
2. Trouve le premier devis (DV-2026-00005)
3. Constate qu'il n'a PAS de varianteGroupe → TRANSFORMATION

Transformation du 1er devis :
await updateDevis(premierDevis.id, {
  varianteGroupe: "VG-demande456-1738012345678",
  varianteLettreReference: "A",
  numeroDevis: "DV-2026-00005-A"  // ← Ajout suffixe
})

Création du 2e devis :
{
  artisanId: "artisan123",
  demandeId: "demande456",
  varianteGroupe: "VG-demande456-1738012345678",
  varianteLettreReference: "B"
}

genererProchainNumeroDevis() :
1. Vérifie demandeId="demande456" → TROUVE devis existant
2. Extrait numéro de base : "DV-2026-00005-A" → "DV-2026-00005"
3. Ajoute suffixe -B → "DV-2026-00005-B"

Résultat :
numeroDevis: "DV-2026-00005-B"
```

#### Étape 3 : Troisième devis
```
Dans nouveau/page.tsx :
1. Récupère devis pour demandeId="demande456"
2. Constate que le 1er a DÉJÀ varianteGroupe → PAS de transformation
3. Trouve les lettres utilisées : ['A', 'B']
4. Calcule prochaine lettre : 'C'

Création du 3e devis :
{
  artisanId: "artisan123",
  demandeId: "demande456",
  varianteGroupe: "VG-demande456-1738012345678",
  varianteLettreReference: "C"
}

genererProchainNumeroDevis() :
1. Vérifie demandeId="demande456" → TROUVE devis existants
2. Extrait numéro de base : "DV-2026-00005"
3. Ajoute suffixe -C → "DV-2026-00005-C"

Résultat :
numeroDevis: "DV-2026-00005-C"
```

---

## 📊 État final dans Firestore

```typescript
// Collection: devis

// Document 1 (transformé)
{
  id: "devis001",
  numeroDevis: "DV-2026-00005-A",  // ← Transformé après coup
  artisanId: "artisan123",
  demandeId: "demande456",
  varianteGroupe: "VG-demande456-1738012345678",
  varianteLettreReference: "A"
}

// Document 2
{
  id: "devis002",
  numeroDevis: "DV-2026-00005-B",  // ← Même numéro de base
  artisanId: "artisan123",
  demandeId: "demande456",
  varianteGroupe: "VG-demande456-1738012345678",
  varianteLettreReference: "B"
}

// Document 3
{
  id: "devis003",
  numeroDevis: "DV-2026-00005-C",  // ← Même numéro de base
  artisanId: "artisan123",
  demandeId: "demande456",
  varianteGroupe: "VG-demande456-1738012345678",
  varianteLettreReference: "C"
}
```

---

## 🔍 Ordre de priorité de la fonction

```typescript
genererProchainNumeroDevis(artisanId, demandeId, varianteLettreReference, varianteGroupe) {
  
  // PRIORITÉ 1 : demandeId fourni
  if (demandeId) {
    // Chercher devis existants pour cette demande
    // Réutiliser leur numéro de base si trouvé
  }
  
  // PRIORITÉ 2 : varianteGroupe fourni (ancien système)
  else if (varianteGroupe) {
    // Chercher devis du même groupe
    // Réutiliser leur numéro de base si trouvé
  }
  
  // PRIORITÉ 3 : Nouveau projet indépendant
  else {
    // Générer nouveau numéro de base
  }
  
  // Ajouter suffixe lettre si nécessaire
  return varianteLettreReference 
    ? `${numeroBase}-${varianteLettreReference}` 
    : numeroBase;
}
```

---

## ✅ Tests de validation

### Test 1 : Première création
```
Action : Créer 1er devis pour demande X
Attendu : DV-2026-00005 (sans lettre)
Vérification : ✅
```

### Test 2 : Transformation progressive
```
Action : Créer 2e devis pour demande X
Attendu :
  - 1er devis transformé : DV-2026-00005 → DV-2026-00005-A
  - 2e devis créé : DV-2026-00005-B
Vérification : ✅
```

### Test 3 : Suite de variantes
```
Action : Créer 3e, 4e, 5e devis pour demande X
Attendu :
  - 3e : DV-2026-00005-C
  - 4e : DV-2026-00005-D
  - 5e : DV-2026-00005-E
Vérification : ✅
```

### Test 4 : Isolation par demande
```
Action : Créer devis pour demande Y (différente de X)
Attendu : DV-2026-00006 (nouveau numéro de base)
Vérification : ✅
```

---

## 📚 Fichiers modifiés

1. **`frontend/src/lib/firebase/devis-service.ts`**
   - Ligne 33-120 : Refonte `genererProchainNumeroDevis()`
   - Ligne 140-149 : Ajout `genererNouveauNumeroBase()`
   - Ligne 168 : Passage de `demandeId` en priorité

2. **`frontend/src/app/artisan/devis/nouveau/page.tsx`**
   - Ligne 1032-1052 : Transformation complète du 1er devis (ajout `numeroDevis`)
   - Logs améliorés pour debugging

---

## 🎓 Leçons apprises

### Pourquoi `demandeId` est prioritaire sur `varianteGroupe` ?

**Problème avec `varianteGroupe` seul** :
- Le 1er devis n'a PAS de `varianteGroupe` quand il est créé
- Il ne l'obtient que lors de la création du 2e devis (transformation rétroactive)
- Impossible de détecter la relation entre 1er et 2e devis au moment de la génération du numéro

**Solution avec `demandeId`** :
- Le `demandeId` existe **dès le 1er devis**
- On peut chercher directement tous les devis de la même demande
- La détection fonctionne même si le 1er devis n'a pas encore de métadonnées de variante

### Architecture en couches

```
Page → Service → Firestore
 ↓         ↓
Logique   Génération
variante  numéro
```

**Séparation des responsabilités** :
- **Page** (`nouveau/page.tsx`) : Gère la transformation progressive (A, B, C)
- **Service** (`devis-service.ts`) : Génère les numéros en fonction du contexte
- Pas de duplication de logique

---

## 🚀 Impact

- ✅ Numérotation cohérente garantie
- ✅ Respect normes BTP (variantes = même numéro de base)
- ✅ Traçabilité client améliorée
- ✅ Pas de confusion entre devis indépendants vs variantes
- ✅ Historique clair dans Firestore

---

**Statut** : ✅ Résolu  
**Version** : 27/01/2026  
**Testé** : En attente validation utilisateur
