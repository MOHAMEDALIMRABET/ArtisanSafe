# Patterns Soft Delete & Schema Versioning

## 📋 Vue d'ensemble

Ce module implémente **deux patterns critiques** pour la gestion de données Firestore :

1. **Pattern 4 : Soft Delete** - Suppression réversible avec période de rétention
2. **Pattern 5 : Schema Versioning** - Évolution progressive des structures de données

---

## 🗑️ Pattern 4 : Soft Delete

### Concept

Au lieu de supprimer définitivement (`deleteDoc()`), on **marque le document comme supprimé** avec métadonnées.

**Avantages** :
- ✅ Récupération possible en cas d'erreur
- ✅ Conformité RGPD (délai de rétention 30 jours)
- ✅ Historique des suppressions
- ✅ Rollback facilité
- ✅ Pas de perte de données accidentelle

### Utilisation de base

```typescript
import { softDelete, restoreSoftDeleted, excludeDeleted } from '@/lib/firebase/soft-delete';
import { db } from '@/lib/firebase/config';

// Supprimer un artisan (soft delete)
await softDelete(db, 'artisans', artisanId, adminUid, 'Compte inactif');

// Rechercher uniquement les actifs
const q = query(
  collection(db, 'artisans'),
  where('metiers', 'array-contains', 'plomberie'),
  excludeDeleted()  // ← Exclut les supprimés
);

// Restaurer un artisan supprimé
await restoreSoftDeleted(db, 'artisans', artisanId);

// Admin : Voir les documents supprimés
const q = query(collection(db, 'artisans'), onlyDeleted());
```

### Métadonnées ajoutées

```typescript
{
  deleted: true,
  deletedAt: Timestamp("2026-01-26T10:30:00Z"),
  deletedBy: "admin-uid-123",
  deletionReason: "Demande utilisateur RGPD"
}
```

### Nettoyage automatique

```typescript
import { cleanupExpiredSoftDeleted } from '@/lib/firebase/soft-delete';

// Supprimer définitivement les docs > 30 jours
const deleted = await cleanupExpiredSoftDeleted(db, 'artisans', 30);
console.log(`${deleted} artisans supprimés définitivement`);
```

**Recommandation** : Déployer Cloud Function pour nettoyage automatique hebdomadaire.

### Intégration dans services

```typescript
// artisan-service.ts
import { excludeDeleted, isNotDeleted } from '@/lib/firebase/soft-delete';

export async function searchArtisans(metier: string) {
  // Méthode 1 : Query Firestore (peut nécessiter index)
  const q = query(
    collection(db, 'artisans'),
    where('metiers', 'array-contains', metier),
    excludeDeleted()  // ← Exclut supprimés
  );

  // Méthode 2 : Filtre côté client (évite index composite)
  const q = query(
    collection(db, 'artisans'),
    where('metiers', 'array-contains', metier)
  );
  const snapshot = await getDocs(q);
  return snapshot.docs
    .map(doc => ({ id: doc.id, ...doc.data() }))
    .filter(isNotDeleted);  // ← Filtre JavaScript
}
```

---

## 🔄 Pattern 5 : Schema Versioning

### Concept

Ajouter un champ `schemaVersion` dans chaque document pour gérer l'évolution de la structure.

**Problème résolu** :
```typescript
// Ancien code (casse si coordinates absent)
const lat = artisan.location.coordinates.lat;  // ❌ TypeError

// Nouveau code (défensif)
if (artisan.schemaVersion === 1) {
  // Ancien format : géocoder l'adresse
  const coords = await geocodeAddress(artisan.location.city);
} else {
  // Nouveau format : coordinates déjà présentes
  const lat = artisan.location.coordinates.lat;  // ✅ Safe
}
```

### Définition des versions

```typescript
// Version 1 : Format actuel
interface ArtisanV1 {
  schemaVersion: 1;
  location: {
    city: string;
    postalCode: string;
  };
}

// Version 2 : Avec géolocalisation
interface ArtisanV2 extends ArtisanV1 {
  schemaVersion: 2;
  location: {
    city: string;
    postalCode: string;
    coordinates: { lat: number; lng: number; };  // ← Nouveau
    region: string;  // ← Nouveau
  };
}
```

### Fonction de migration

```typescript
async function migrateArtisanV1toV2(
  artisan: ArtisanV1,
  db: Firestore
): Promise<ArtisanV2> {
  return {
    ...artisan,
    schemaVersion: 2,
    location: {
      ...artisan.location,
      coordinates: await geocodeAddress(artisan.location.city),
      region: detectRegion(artisan.location.postalCode),
    },
  };
}
```

### Chaîne de migration

```typescript
import { createMigrationChain } from '@/lib/firebase/schema-versioning';

const artisanMigration = createMigrationChain<ArtisanV2>([
  {
    from: 1,
    to: 2,
    migrate: migrateArtisanV1toV2,
    description: 'Ajout géolocalisation',
  },
]);
```

### Migration automatique à la lecture

```typescript
export async function getArtisanById(id: string): Promise<ArtisanV2> {
  const docSnap = await getDoc(doc(db, 'artisans', id));
  const artisan = docSnap.data() as ArtisanV1 | ArtisanV2;

  // Migrer si version ancienne
  if (artisanMigration.needsMigration(artisan)) {
    return await artisanMigration.migrate(artisan, db, {
      persistToFirestore: true,  // Sauvegarder migration
      collectionName: 'artisans',
      documentId: id,
    });
  }

  return artisan as ArtisanV2;
}
```

### Migrations prédéfinies

Le module inclut 2 migrations exemples :

#### 1. Artisan V1 → V2
```typescript
import { artisanMigrationChain } from '@/lib/firebase/schema-versioning';

const artisan = await artisanMigrationChain.migrate(artisanV1, db, {
  persistToFirestore: true,
  collectionName: 'artisans',
  documentId: artisanId,
});
// Ajoute : coordinates, region
```

#### 2. Devis V1 → V2
```typescript
import { devisMigrationChain } from '@/lib/firebase/schema-versioning';

const devis = await devisMigrationChain.migrate(devisV1, db, {
  persistToFirestore: true,
  collectionName: 'devis',
  documentId: devisId,
});
// Ajoute : tauxTVA, montantTVA, prixTTC par prestation
```

---

## 🔗 Combinaison des deux patterns

```typescript
import { ArtisanServiceWithPatterns } from '@/lib/firebase/pattern-examples';

const service = new ArtisanServiceWithPatterns();

// Recherche (gère versions + exclut supprimés)
const artisans = await service.search('plomberie');

// Récupération par ID (migre automatiquement + exclut supprimés)
const artisan = await service.getById(artisanId);

// Suppression (soft delete)
await service.delete(artisanId, adminUid, 'Compte inactif');

// Restauration
await service.restore(artisanId);
```

---

## 📂 Fichiers créés

```
frontend/src/lib/firebase/
├── soft-delete.ts              # Pattern 4 : Soft Delete
├── schema-versioning.ts        # Pattern 5 : Schema Versioning
└── pattern-examples.ts         # Exemples d'intégration

frontend/scripts/
└── test-patterns.ts            # Tests automatisés
```

---

## 🧪 Tests

```bash
# Lancer les tests
cd frontend/scripts
npx ts-node test-patterns.ts
```

**Tests inclus** :
- ✅ Soft delete → exclusion query → restauration
- ✅ Migration V1 → V2 avec métadonnées
- ✅ Combinaison des deux patterns

---

## 🚀 Déploiement production

### Étape 1 : Ajouter schemaVersion aux nouveaux documents

```typescript
// artisan-service.ts
export async function createArtisan(data: CreateArtisanData) {
  await setDoc(doc(db, 'artisans', userId), {
    ...data,
    schemaVersion: 2,  // ← Version actuelle
    deleted: false,    // ← Initialiser soft delete
    createdAt: Timestamp.now(),
  });
}
```

### Étape 2 : Migrer documents existants

```bash
# Script migration batch (optionnel)
cd frontend/scripts
npx ts-node migrate-all-artisans.ts
```

### Étape 3 : Cloud Function nettoyage automatique

```typescript
// functions/src/index.ts
import { cleanupExpiredSoftDeleted } from './soft-delete';

export const scheduledCleanup = functions.pubsub
  .schedule('every sunday 03:00')
  .timeZone('Europe/Paris')
  .onRun(async () => {
    const collections = ['users', 'artisans', 'devis', 'contrats'];
    
    for (const collection of collections) {
      await cleanupExpiredSoftDeleted(db, collection, 30);
    }
  });
```

---

## 📖 Documentation complète

- **Exemples avancés** : [pattern-examples.ts](./pattern-examples.ts)
- **API Reference** : [soft-delete.ts](./soft-delete.ts), [schema-versioning.ts](./schema-versioning.ts)
- **Copilot Instructions** : [.github/copilot-instructions.md](../../.github/copilot-instructions.md)

---

## ⚠️ Important

**Soft Delete** :
- Documents restent dans Firestore (compte dans quotas)
- Nettoyage automatique recommandé après 30 jours
- Filter `deleted != true` peut nécessiter index composite

**Schema Versioning** :
- Migration lazy (à la lecture) recommandée
- Batch migration possible pour grandes collections
- Toujours tester migration sur environnement dev d'abord

---

## 🤝 Contribution

Pour ajouter une nouvelle migration :

```typescript
// 1. Définir nouvelle version
interface ArtisanV3 extends ArtisanV2 {
  schemaVersion: 3;
  certifications: string[];  // ← Nouveau champ
}

// 2. Créer fonction migration
async function migrateV2toV3(artisan: ArtisanV2): Promise<ArtisanV3> {
  return {
    ...artisan,
    schemaVersion: 3,
    certifications: [],  // Valeur par défaut
  };
}

// 3. Ajouter à la chaîne
const artisanMigration = createMigrationChain<ArtisanV3>([
  { from: 1, to: 2, migrate: migrateV1toV2 },
  { from: 2, to: 3, migrate: migrateV2toV3 },  // ← Nouvelle
]);
```
