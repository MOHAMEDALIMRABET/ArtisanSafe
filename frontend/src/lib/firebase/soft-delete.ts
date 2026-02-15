/**
 * Pattern 4 : Soft Delete Implementation
 * 
 * Permet de marquer des documents comme supprimés au lieu de les effacer définitivement.
 * Avantages :
 * - Récupération possible en cas d'erreur
 * - Conformité RGPD avec délai de rétention
 * - Historique des suppressions
 * - Rollback facilité
 * 
 * Usage:
 * ```typescript
 * // Au lieu de deleteDoc()
 * await softDelete(db, 'users', userId, adminUid);
 * 
 * // Dans les queries
 * const q = query(collection(db, 'users'), excludeDeleted());
 * 
 * // Restaurer
 * await restoreSoftDeleted(db, 'users', userId);
 * ```
 */

import {
  doc,
  getDoc,
  deleteDoc,
  updateDoc,
  Timestamp,
  query,
  where,
  QueryConstraint,
  Firestore,
  collection,
  getDocs,
  writeBatch,
} from 'firebase/firestore';

// ============================================
// TYPES
// ============================================

/**
 * Métadonnées ajoutées lors d'un soft delete
 */
export interface SoftDeleteMetadata {
  deleted: boolean;
  deletedAt: Timestamp | null;
  deletedBy: string | null;
  deletionReason?: string;
}

/**
 * Extension de document avec soft delete
 */
export interface SoftDeletable {
  deleted?: boolean;
  deletedAt?: Timestamp | null;
  deletedBy?: string | null;
  deletionReason?: string;
}

// ============================================
// FONCTIONS PRINCIPALES
// ============================================

/**
 * Marque un document comme supprimé (soft delete)
 * 
 * @param db - Instance Firestore
 * @param collectionName - Nom de la collection
 * @param documentId - ID du document
 * @param deletedBy - UID de l'utilisateur qui supprime
 * @param reason - Raison de la suppression (optionnel)
 */
export async function softDelete(
  db: Firestore,
  collectionName: string,
  documentId: string,
  deletedBy: string,
  reason?: string
): Promise<void> {
  const docRef = doc(db, collectionName, documentId);
  
  const metadata: any = {
    deleted: true,
    deletedAt: Timestamp.now(),
    deletedBy: deletedBy,
  };

  if (reason) {
    metadata.deletionReason = reason;
  }

  await updateDoc(docRef, metadata);
  
  console.log(`✅ Soft delete: ${collectionName}/${documentId} par ${deletedBy}`);
}

/**
 * Restaure un document supprimé (annule soft delete)
 * 
 * @param db - Instance Firestore
 * @param collectionName - Nom de la collection
 * @param documentId - ID du document
 */
export async function restoreSoftDeleted(
  db: Firestore,
  collectionName: string,
  documentId: string
): Promise<void> {
  const docRef = doc(db, collectionName, documentId);
  
  await updateDoc(docRef, {
    deleted: false,
    deletedAt: null,
    deletedBy: null,
    deletionReason: null,
  });
  
  console.log(`♻️ Restauration: ${collectionName}/${documentId}`);
}

/**
 * Suppression définitive d'un document soft deleted
 * ⚠️ ATTENTION : Suppression irréversible !
 * 
 * @param db - Instance Firestore
 * @param collectionName - Nom de la collection
 * @param documentId - ID du document
 */
export async function permanentDelete(
  db: Firestore,
  collectionName: string,
  documentId: string
): Promise<void> {
  const docRef = doc(db, collectionName, documentId);
  
  // Vérifier que le document est bien marqué deleted
  const docSnap = await getDoc(docRef);
  if (!docSnap.exists()) {
    throw new Error(`Document ${collectionName}/${documentId} n'existe pas`);
  }
  
  const data = docSnap.data();
  if (!data.deleted) {
    throw new Error(
      `Document ${collectionName}/${documentId} n'est pas marqué comme supprimé. ` +
      `Utilisez softDelete() d'abord ou deleteDoc() si vraiment nécessaire.`
    );
  }
  
  await deleteDoc(docRef);
  
  console.warn(`⚠️ Suppression définitive: ${collectionName}/${documentId}`);
}

// ============================================
// QUERY HELPERS
// ============================================

/**
 * Contrainte de query pour exclure les documents supprimés
 * 
 * @returns QueryConstraint à ajouter aux queries
 * 
 * @example
 * ```typescript
 * const q = query(
 *   collection(db, 'artisans'),
 *   where('metiers', 'array-contains', 'plomberie'),
 *   excludeDeleted()  // ← Exclut les artisans supprimés
 * );
 * ```
 */
export function excludeDeleted(): QueryConstraint {
  return where('deleted', '!=', true);
}

/**
 * Contrainte de query pour récupérer UNIQUEMENT les documents supprimés
 * 
 * @returns QueryConstraint à ajouter aux queries
 * 
 * @example
 * ```typescript
 * // Admin : Liste des artisans supprimés
 * const q = query(
 *   collection(db, 'artisans'),
 *   onlyDeleted()
 * );
 * ```
 */
export function onlyDeleted(): QueryConstraint {
  return where('deleted', '==', true);
}

/**
 * Filtre côté client pour exclure documents supprimés
 * Utiliser quand excludeDeleted() cause des problèmes d'index composite
 * 
 * @example
 * ```typescript
 * const snapshot = await getDocs(query(...));
 * const docs = snapshot.docs
 *   .map(doc => ({ id: doc.id, ...doc.data() }))
 *   .filter(isNotDeleted);  // ← Filtre côté client
 * ```
 */
export function isNotDeleted<T extends SoftDeletable>(doc: T): boolean {
  return !doc.deleted;
}

/**
 * Filtre côté client pour documents supprimés uniquement
 */
export function isDeleted<T extends SoftDeletable>(doc: T): boolean {
  return doc.deleted === true;
}

// ============================================
// BATCH OPERATIONS
// ============================================

/**
 * Soft delete en masse pour plusieurs documents
 * 
 * @param db - Instance Firestore
 * @param collectionName - Nom de la collection
 * @param documentIds - Tableau d'IDs de documents
 * @param deletedBy - UID de l'utilisateur
 * @param reason - Raison commune (optionnel)
 */
export async function batchSoftDelete(
  db: Firestore,
  collectionName: string,
  documentIds: string[],
  deletedBy: string,
  reason?: string
): Promise<void> {
  const batch = writeBatch(db);
  
  const metadata: any = {
    deleted: true,
    deletedAt: Timestamp.now(),
    deletedBy: deletedBy,
  };

  if (reason) {
    metadata.deletionReason = reason;
  }

  for (const docId of documentIds) {
    const docRef = doc(db, collectionName, docId);
    batch.update(docRef, metadata);
  }

  await batch.commit();
  
  console.log(`✅ Batch soft delete: ${documentIds.length} documents de ${collectionName}`);
}

// ============================================
// CLEANUP UTILITIES
// ============================================

/**
 * Récupère tous les documents supprimés depuis plus de X jours
 * Utile pour Cloud Function de nettoyage automatique
 * 
 * @param db - Instance Firestore
 * @param collectionName - Nom de la collection
 * @param daysOld - Nombre de jours (défaut: 30)
 */
export async function getExpiredSoftDeleted(
  db: Firestore,
  collectionName: string,
  daysOld: number = 30
): Promise<string[]> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);
  const cutoffTimestamp = Timestamp.fromDate(cutoffDate);

  const q = query(
    collection(db, collectionName),
    where('deleted', '==', true),
    where('deletedAt', '<', cutoffTimestamp)
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => doc.id);
}

/**
 * Supprime définitivement les documents soft deleted expirés
 * ⚠️ À utiliser avec précaution - suppression irréversible
 * 
 * @param db - Instance Firestore
 * @param collectionName - Nom de la collection
 * @param daysOld - Nombre de jours (défaut: 30)
 */
export async function cleanupExpiredSoftDeleted(
  db: Firestore,
  collectionName: string,
  daysOld: number = 30
): Promise<number> {
  const expiredIds = await getExpiredSoftDeleted(db, collectionName, daysOld);
  
  if (expiredIds.length === 0) {
    console.log(`ℹ️ Aucun document expiré dans ${collectionName}`);
    return 0;
  }

  // Batch delete (max 500 docs/batch)
  const batchSize = 500;
  let deletedCount = 0;

  for (let i = 0; i < expiredIds.length; i += batchSize) {
    const batch = writeBatch(db);
    const batchIds = expiredIds.slice(i, i + batchSize);

    for (const docId of batchIds) {
      const docRef = doc(db, collectionName, docId);
      batch.delete(docRef);
    }

    await batch.commit();
    deletedCount += batchIds.length;
  }

  console.warn(
    `⚠️ Nettoyage: ${deletedCount} documents supprimés définitivement de ${collectionName} ` +
    `(> ${daysOld} jours)`
  );

  return deletedCount;
}

// ============================================
// STATISTIQUES
// ============================================

/**
 * Compte le nombre de documents supprimés dans une collection
 */
export async function countSoftDeleted(
  db: Firestore,
  collectionName: string
): Promise<number> {
  const q = query(collection(db, collectionName), onlyDeleted());
  const snapshot = await getDocs(q);
  return snapshot.size;
}

/**
 * Statistiques détaillées sur les suppressions
 */
export async function getSoftDeleteStats(
  db: Firestore,
  collectionName: string
): Promise<{
  total: number;
  deletedLast7Days: number;
  deletedLast30Days: number;
  oldestDeletion: Date | null;
}> {
  const q = query(collection(db, collectionName), onlyDeleted());
  const snapshot = await getDocs(q);

  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  let deletedLast7Days = 0;
  let deletedLast30Days = 0;
  let oldestDeletion: Date | null = null;

  snapshot.docs.forEach(doc => {
    const data = doc.data();
    if (data.deletedAt) {
      const deletedDate = data.deletedAt.toDate();

      if (deletedDate > sevenDaysAgo) deletedLast7Days++;
      if (deletedDate > thirtyDaysAgo) deletedLast30Days++;

      if (!oldestDeletion || deletedDate < oldestDeletion) {
        oldestDeletion = deletedDate;
      }
    }
  });

  return {
    total: snapshot.size,
    deletedLast7Days,
    deletedLast30Days,
    oldestDeletion,
  };
}
