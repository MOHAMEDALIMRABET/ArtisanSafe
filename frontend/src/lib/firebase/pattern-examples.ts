/**
 * Exemples d'utilisation des patterns Soft Delete et Schema Versioning
 * 
 * Ces exemples montrent comment intégrer les deux patterns dans vos services.
 */

import { db } from './config';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
} from 'firebase/firestore';

// Pattern 4 : Soft Delete
import {
  softDelete,
  restoreSoftDeleted,
  permanentDelete,
  excludeDeleted,
  onlyDeleted,
  isNotDeleted,
  batchSoftDelete,
  cleanupExpiredSoftDeleted,
  getSoftDeleteStats,
  type SoftDeletable,
} from './soft-delete';

// Pattern 5 : Schema Versioning
import {
  artisanMigrationChain,
  devisMigrationChain,
  createMigrationChain,
  type ArtisanV1,
  type ArtisanV2,
  type DevisV1,
  type DevisV2,
  type MigrationStep,
} from './schema-versioning';

// ============================================
// EXEMPLE 1 : SOFT DELETE - Suppression utilisateur
// ============================================

/**
 * Supprime un compte utilisateur (soft delete)
 * Préserve les données pendant 30 jours avant suppression définitive
 */
export async function deleteUserAccount(
  userId: string,
  deletedBy: string,
  reason: string = 'Demande utilisateur'
): Promise<void> {
  console.log(`🗑️ Suppression compte utilisateur ${userId}...`);

  // 1. Soft delete du profil utilisateur
  await softDelete(db, 'users', userId, deletedBy, reason);

  // 2. Soft delete du profil artisan (si existe)
  try {
    const artisanSnap = await getDoc(doc(db, 'artisans', userId));
    if (artisanSnap.exists()) {
      await softDelete(db, 'artisans', userId, deletedBy, reason);
    }
  } catch (error) {
    // Profil artisan n'existe pas
  }

  // 3. Soft delete des documents associés
  const collections = ['demandes', 'devis', 'contrats', 'disponibilites'];
  
  for (const collectionName of collections) {
    const q = query(
      collection(db, collectionName),
      where('userId', '==', userId)
    );
    const snapshot = await getDocs(q);
    const ids = snapshot.docs.map(doc => doc.id);

    if (ids.length > 0) {
      await batchSoftDelete(db, collectionName, ids, deletedBy, reason);
    }
  }

  console.log(`✅ Compte ${userId} marqué comme supprimé (restauration possible pendant 30 jours)`);
}

/**
 * Restaure un compte utilisateur supprimé
 */
export async function restoreUserAccount(userId: string): Promise<void> {
  console.log(`♻️ Restauration compte utilisateur ${userId}...`);

  await restoreSoftDeleted(db, 'users', userId);

  // Restaurer profil artisan si existe
  try {
    await restoreSoftDeleted(db, 'artisans', userId);
  } catch (error) {
    // Pas de profil artisan
  }

  console.log(`✅ Compte ${userId} restauré`);
}

// ============================================
// EXEMPLE 2 : SOFT DELETE - Recherche avec filtre
// ============================================

/**
 * Recherche artisans actifs (exclut les supprimés)
 */
export async function searchActiveArtisans(metier: string): Promise<any[]> {
  // Méthode 1 : Utiliser excludeDeleted() dans la query
  const q = query(
    collection(db, 'artisans'),
    where('metiers', 'array-contains', metier),
    excludeDeleted()  // ← Exclut automatiquement les artisans supprimés
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

/**
 * Alternative : Filtre côté client (évite index composite)
 */
export async function searchActiveArtisansClientSide(metier: string): Promise<any[]> {
  const q = query(
    collection(db, 'artisans'),
    where('metiers', 'array-contains', metier)
  );

  const snapshot = await getDocs(q);
  
  return snapshot.docs
    .map(doc => ({ id: doc.id, ...doc.data() }))
    .filter(isNotDeleted);  // ← Filtre côté client
}

/**
 * Admin : Liste des artisans supprimés
 */
export async function getDeletedArtisans(): Promise<any[]> {
  const q = query(
    collection(db, 'artisans'),
    onlyDeleted()  // ← Uniquement les supprimés
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  }));
}

// ============================================
// EXEMPLE 3 : SOFT DELETE - Nettoyage automatique
// ============================================

/**
 * Cloud Function : Nettoyage automatique des données supprimées > 30 jours
 * À déployer dans functions/src/index.ts
 */
export async function scheduledCleanup(): Promise<void> {
  console.log('🧹 Démarrage nettoyage automatique...');

  const collections = ['users', 'artisans', 'demandes', 'devis', 'contrats'];
  let totalDeleted = 0;

  for (const collectionName of collections) {
    const deleted = await cleanupExpiredSoftDeleted(db, collectionName, 30);
    totalDeleted += deleted;
  }

  console.log(`✅ Nettoyage terminé : ${totalDeleted} documents supprimés définitivement`);
}

/**
 * Admin : Statistiques suppressions
 */
export async function getDeletedStats(): Promise<Record<string, any>> {
  const collections = ['users', 'artisans', 'demandes', 'devis'];
  const stats: Record<string, any> = {};

  for (const collectionName of collections) {
    stats[collectionName] = await getSoftDeleteStats(db, collectionName);
  }

  return stats;
}

// ============================================
// EXEMPLE 4 : SCHEMA VERSIONING - Migration artisan
// ============================================

/**
 * Récupère un artisan et migre automatiquement si nécessaire
 */
export async function getArtisanWithMigration(artisanId: string): Promise<ArtisanV2> {
  const docRef = doc(db, 'artisans', artisanId);
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists()) {
    throw new Error(`Artisan ${artisanId} non trouvé`);
  }

  const artisan = docSnap.data() as ArtisanV1 | ArtisanV2;

  // Vérifier si migration nécessaire
  if (artisanMigrationChain.needsMigration(artisan)) {
    console.log(`🔄 Migration nécessaire pour artisan ${artisanId}`);

    // Migrer et persister automatiquement
    const migrated = await artisanMigrationChain.migrate(artisan, db, {
      persistToFirestore: true,
      collectionName: 'artisans',
      documentId: artisanId,
    });

    return migrated;
  }

  return artisan as ArtisanV2;
}

/**
 * Recherche artisans avec migration automatique
 */
export async function searchArtisansWithMigration(metier: string): Promise<ArtisanV2[]> {
  const q = query(
    collection(db, 'artisans'),
    where('metiers', 'array-contains', metier),
    excludeDeleted()  // ← Bonus : Exclut aussi les supprimés
  );

  const snapshot = await getDocs(q);
  const artisans: ArtisanV2[] = [];

  for (const docSnap of snapshot.docs) {
    const artisan = docSnap.data() as ArtisanV1 | ArtisanV2;

    // Migrer si nécessaire
    if (artisanMigrationChain.needsMigration(artisan)) {
      const migrated = await artisanMigrationChain.migrate(artisan, db, {
        persistToFirestore: true,
        collectionName: 'artisans',
        documentId: docSnap.id,
      });
      artisans.push(migrated);
    } else {
      artisans.push(artisan as ArtisanV2);
    }
  }

  return artisans;
}

// ============================================
// EXEMPLE 5 : SCHEMA VERSIONING - Migration devis
// ============================================

/**
 * Récupère un devis et migre si nécessaire
 */
export async function getDevisWithMigration(devisId: string): Promise<DevisV2> {
  const docRef = doc(db, 'devis', devisId);
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists()) {
    throw new Error(`Devis ${devisId} non trouvé`);
  }

  const devis = docSnap.data() as DevisV1 | DevisV2;

  if (devisMigrationChain.needsMigration(devis)) {
    console.log(`🔄 Migration devis ${devisId} : ajout TVA détaillée`);

    const migrated = await devisMigrationChain.migrate(devis, db, {
      persistToFirestore: true,
      collectionName: 'devis',
      documentId: devisId,
    });

    return migrated;
  }

  return devis as DevisV2;
}

// ============================================
// EXEMPLE 6 : COMBINAISON DES DEUX PATTERNS
// ============================================

/**
 * Service artisan complet avec soft delete + versioning
 */
export class ArtisanServiceWithPatterns {
  /**
   * Recherche artisans (gère versions + supprimés)
   */
  async search(metier: string): Promise<ArtisanV2[]> {
    const q = query(
      collection(db, 'artisans'),
      where('metiers', 'array-contains', metier),
      excludeDeleted()  // Pattern 4 : Exclut supprimés
    );

    const snapshot = await getDocs(q);
    const artisans: ArtisanV2[] = [];

    for (const docSnap of snapshot.docs) {
      const artisan = docSnap.data() as ArtisanV1 | ArtisanV2;

      // Pattern 5 : Migrer si nécessaire
      if (artisanMigrationChain.needsMigration(artisan)) {
        const migrated = await artisanMigrationChain.migrate(artisan, db, {
          persistToFirestore: true,
          collectionName: 'artisans',
          documentId: docSnap.id,
        });
        artisans.push(migrated);
      } else {
        artisans.push(artisan as ArtisanV2);
      }
    }

    return artisans;
  }

  /**
   * Supprime un artisan (soft delete)
   */
  async delete(artisanId: string, deletedBy: string, reason?: string): Promise<void> {
    await softDelete(db, 'artisans', artisanId, deletedBy, reason);
  }

  /**
   * Restaure un artisan supprimé
   */
  async restore(artisanId: string): Promise<void> {
    await restoreSoftDeleted(db, 'artisans', artisanId);
  }

  /**
   * Récupère artisan par ID (gère version + supprimés)
   */
  async getById(artisanId: string): Promise<ArtisanV2 | null> {
    const docRef = doc(db, 'artisans', artisanId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return null;
    }

    const artisan = docSnap.data() as (ArtisanV1 | ArtisanV2) & SoftDeletable;

    // Exclure si supprimé
    if (artisan.deleted) {
      return null;
    }

    // Migrer si nécessaire
    if (artisanMigrationChain.needsMigration(artisan)) {
      return await artisanMigrationChain.migrate(artisan, db, {
        persistToFirestore: true,
        collectionName: 'artisans',
        documentId: artisanId,
      });
    }

    return artisan as ArtisanV2;
  }
}

// ============================================
// EXEMPLE 7 : Migration personnalisée
// ============================================

/**
 * Exemple : Migration custom pour ajouter photos aux avis
 */
interface AvisV1 {
  schemaVersion: 1;
  note: number;
  commentaire: string;
  clientId: string;
  artisanId: string;
}

interface AvisV2 extends AvisV1 {
  schemaVersion: 2;
  photos?: string[];  // URLs Firebase Storage
  reponseArtisan?: string;
}

const avisV1toV2: MigrationStep<AvisV1, AvisV2> = {
  from: 1,
  to: 2,
  description: 'Ajout photos et réponse artisan',
  migrate: (avis: AvisV1): AvisV2 => {
    return {
      ...avis,
      schemaVersion: 2,
      photos: [],  // Vide par défaut
      reponseArtisan: undefined,
    };
  },
};

export const avisMigrationChain = createMigrationChain<AvisV2>([avisV1toV2]);

// ============================================
// EXEMPLE 8 : Script migration batch
// ============================================

/**
 * Script pour migrer toute une collection
 * À exécuter dans un terminal : npx ts-node migrate-all-artisans.ts
 */
export async function migrateAllArtisans(): Promise<void> {
  console.log('🚀 Migration de tous les artisans...');

  const q = query(collection(db, 'artisans'), excludeDeleted());
  const snapshot = await getDocs(q);

  let migrated = 0;
  let skipped = 0;

  for (const docSnap of snapshot.docs) {
    const artisan = docSnap.data() as ArtisanV1 | ArtisanV2;

    if (artisanMigrationChain.needsMigration(artisan)) {
      await artisanMigrationChain.migrate(artisan, db, {
        persistToFirestore: true,
        collectionName: 'artisans',
        documentId: docSnap.id,
      });
      migrated++;
    } else {
      skipped++;
    }

    // Log progression tous les 10 documents
    if ((migrated + skipped) % 10 === 0) {
      console.log(`   Progression: ${migrated + skipped}/${snapshot.size}`);
    }
  }

  console.log('\n✨ Migration terminée !');
  console.log(`   ✅ Migrés: ${migrated}`);
  console.log(`   ⏭️  Ignorés: ${skipped}`);
}
