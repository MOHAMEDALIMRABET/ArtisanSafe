/**
 * Pattern 5 : Schema Versioning Implementation
 * 
 * Permet de gérer l'évolution des structures de données Firestore au fil du temps.
 * 
 * Avantages :
 * - Migration progressive sans casser les anciennes données
 * - Code défensif qui gère plusieurs versions simultanément
 * - Migration lazy (seulement à la lecture/écriture)
 * - Rollback facilité si nouvelle version a des bugs
 * - Debug simplifié (version visible dans chaque document)
 * 
 * Usage:
 * ```typescript
 * // 1. Définir les versions
 * interface ArtisanV1 {
 *   schemaVersion: 1;
 *   metiers: string[];
 *   location: { city: string; postalCode: string; };
 * }
 * 
 * interface ArtisanV2 extends ArtisanV1 {
 *   schemaVersion: 2;
 *   location: {
 *     city: string;
 *     postalCode: string;
 *     coordinates: { lat: number; lng: number; };  // ← Nouveau
 *     region: string;  // ← Nouveau
 *   };
 * }
 * 
 * // 2. Créer migration
 * const artisanMigration = createMigrationChain<ArtisanV2>([
 *   { from: 1, to: 2, migrate: migrateArtisanV1toV2 }
 * ]);
 * 
 * // 3. Utiliser dans service
 * const artisan = await getDoc(...);
 * const migrated = await artisanMigration.migrate(artisan, db);
 * ```
 */

import { Firestore, doc, updateDoc, Timestamp } from 'firebase/firestore';

// ============================================
// TYPES DE BASE
// ============================================

/**
 * Interface de base pour documents versionné
 */
export interface Versionable {
  schemaVersion: number;
}

/**
 * Métadonnées de migration
 */
export interface MigrationMetadata {
  lastMigrationDate?: Timestamp;
  lastMigrationFrom?: number;
  lastMigrationTo?: number;
  migrationHistory?: Array<{
    from: number;
    to: number;
    date: Timestamp;
  }>;
}

/**
 * Document avec versioning complet
 */
export type VersionedDocument<T extends Versionable> = T & MigrationMetadata;

// ============================================
// MIGRATION FUNCTIONS
// ============================================

/**
 * Fonction de migration d'une version à une autre
 */
export type MigrationFunction<TFrom extends Versionable, TTo extends Versionable> = (
  doc: TFrom,
  db: Firestore
) => Promise<TTo> | TTo;

/**
 * Définition d'une étape de migration
 */
export interface MigrationStep<TFrom extends Versionable, TTo extends Versionable> {
  from: number;
  to: number;
  migrate: MigrationFunction<TFrom, TTo>;
  description?: string;
}

/**
 * Chaîne de migrations
 */
export class MigrationChain<TLatest extends Versionable> {
  private steps: Map<number, MigrationStep<any, any>>;
  private latestVersion: number;

  constructor(steps: MigrationStep<any, any>[]) {
    this.steps = new Map();
    this.latestVersion = 1;

    // Indexer les migrations par version source
    for (const step of steps) {
      this.steps.set(step.from, step);
      if (step.to > this.latestVersion) {
        this.latestVersion = step.to;
      }
    }
  }

  /**
   * Migre un document vers la dernière version
   */
  async migrate(
    doc: Versionable,
    db: Firestore,
    options: {
      persistToFirestore?: boolean;
      collectionName?: string;
      documentId?: string;
    } = {}
  ): Promise<TLatest & MigrationMetadata> {
    let current: any = { ...doc };
    const migrationHistory: Array<{ from: number; to: number; date: Timestamp }> = [];

    // Si pas de version, considérer comme v1
    if (!current.schemaVersion) {
      current.schemaVersion = 1;
    }

    // Migrer progressivement jusqu'à la dernière version
    while (current.schemaVersion < this.latestVersion) {
      const step = this.steps.get(current.schemaVersion);

      if (!step) {
        throw new Error(
          `❌ Migration manquante : v${current.schemaVersion} → v${current.schemaVersion + 1}`
        );
      }

      console.log(
        `🔄 Migration ${step.description || ''} v${step.from} → v${step.to}`,
        options.documentId ? `(${options.documentId})` : ''
      );

      // Exécuter migration
      const migrated = await step.migrate(current, db);

      // Enregistrer dans historique
      migrationHistory.push({
        from: step.from,
        to: step.to,
        date: Timestamp.now(),
      });

      current = migrated;
    }

    // Ajouter métadonnées de migration
    if (migrationHistory.length > 0) {
      const lastMigration = migrationHistory[migrationHistory.length - 1];
      
      current.lastMigrationDate = lastMigration.date;
      current.lastMigrationFrom = lastMigration.from;
      current.lastMigrationTo = lastMigration.to;
      current.migrationHistory = [
        ...(current.migrationHistory || []),
        ...migrationHistory,
      ];

      // Persister dans Firestore si demandé
      if (
        options.persistToFirestore &&
        options.collectionName &&
        options.documentId
      ) {
        const docRef = doc(db, options.collectionName, options.documentId);
        await updateDoc(docRef, current);
        console.log(`💾 Migration persistée: ${options.collectionName}/${options.documentId}`);
      }
    }

    return current as TLatest & MigrationMetadata;
  }

  /**
   * Vérifie si un document nécessite une migration
   */
  needsMigration(doc: Versionable): boolean {
    const version = doc.schemaVersion || 1;
    return version < this.latestVersion;
  }

  /**
   * Obtient la version actuelle du schéma
   */
  getLatestVersion(): number {
    return this.latestVersion;
  }
}

// ============================================
// HELPERS
// ============================================

/**
 * Crée une chaîne de migrations
 */
export function createMigrationChain<TLatest extends Versionable>(
  steps: MigrationStep<any, any>[]
): MigrationChain<TLatest> {
  return new MigrationChain<TLatest>(steps);
}

/**
 * Vérifie si un document est à jour
 */
export function isUpToDate(doc: Versionable, latestVersion: number): boolean {
  return (doc.schemaVersion || 1) >= latestVersion;
}

/**
 * Obtient la version d'un document
 */
export function getDocumentVersion(doc: Versionable): number {
  return doc.schemaVersion || 1;
}

// ============================================
// MIGRATIONS PRÉDÉFINIES ARTISANDISPO
// ============================================

/**
 * VERSION 1 : Format actuel Artisan
 */
export interface ArtisanV1 extends Versionable {
  schemaVersion: 1;
  userId: string;
  businessName: string;
  metiers: string[];
  location: {
    address: string;
    city: string;
    postalCode: string;
  };
  // ... autres champs
}

/**
 * VERSION 2 : Artisan avec géolocalisation
 */
export interface ArtisanV2 extends Omit<ArtisanV1, 'schemaVersion' | 'location'> {
  schemaVersion: 2;
  location: {
    address: string;
    city: string;
    postalCode: string;
    coordinates?: {
      lat: number;
      lng: number;
    };
    region?: string;
  };
}

/**
 * Migration Artisan V1 → V2
 * Ajoute géolocalisation et région
 */
export async function migrateArtisanV1toV2(
  artisan: ArtisanV1,
  db: Firestore
): Promise<ArtisanV2> {
  const migrated: ArtisanV2 = {
    ...artisan,
    schemaVersion: 2,
    location: {
      ...artisan.location,
      // Géocoder l'adresse (exemple - à implémenter avec Mapbox/Google Maps)
      coordinates: undefined, // await geocodeAddress(artisan.location.city)
      region: detectRegionFromPostalCode(artisan.location.postalCode),
    },
  };

  return migrated;
}

/**
 * Helper : Détecte région depuis code postal
 */
function detectRegionFromPostalCode(postalCode: string): string {
  const dept = postalCode.substring(0, 2);
  
  // Mapping département → région (simplifié)
  const regionMap: Record<string, string> = {
    '75': 'Île-de-France',
    '77': 'Île-de-France',
    '78': 'Île-de-France',
    '91': 'Île-de-France',
    '92': 'Île-de-France',
    '93': 'Île-de-France',
    '94': 'Île-de-France',
    '95': 'Île-de-France',
    '13': 'Provence-Alpes-Côte d\'Azur',
    '69': 'Auvergne-Rhône-Alpes',
    // ... compléter
  };

  return regionMap[dept] || 'France';
}

/**
 * VERSION 1 : Format actuel Devis
 */
export interface DevisV1 extends Versionable {
  schemaVersion: 1;
  montantHT: number;
  montantTTC: number;
  prestations: Array<{
    designation: string;
    quantite: number;
    prixUnitaireHT: number;
  }>;
}

/**
 * VERSION 2 : Devis avec TVA par prestation
 */
export interface DevisV2 extends Omit<DevisV1, 'schemaVersion' | 'prestations'> {
  schemaVersion: 2;
  prestations: Array<{
    designation: string;
    quantite: number;
    prixUnitaireHT: number;
    tauxTVA: number;        // ← Nouveau
    montantTVA: number;     // ← Nouveau
    prixTTC: number;        // ← Nouveau
  }>;
}

/**
 * Migration Devis V1 → V2
 * Ajoute TVA détaillée par prestation
 */
export function migrateDevisV1toV2(devis: DevisV1): DevisV2 {
  // Calculer TVA globale pour répartir
  const tvaGlobale = devis.montantTTC - devis.montantHT;
  const tauxTVAMoyen = (tvaGlobale / devis.montantHT) * 100;

  const migrated: DevisV2 = {
    ...devis,
    schemaVersion: 2,
    prestations: devis.prestations.map(prestation => {
      const montantHT = prestation.quantite * prestation.prixUnitaireHT;
      const tauxTVA = Math.round(tauxTVAMoyen); // Arrondir à 20, 10, 5.5
      const montantTVA = (montantHT * tauxTVA) / 100;
      const prixTTC = montantHT + montantTVA;

      return {
        ...prestation,
        tauxTVA,
        montantTVA,
        prixTTC,
      };
    }),
  };

  return migrated;
}

// ============================================
// CHAÎNES DE MIGRATION PRÉDÉFINIES
// ============================================

/**
 * Chaîne de migration pour Artisans
 */
export const artisanMigrationChain = createMigrationChain<ArtisanV2>([
  {
    from: 1,
    to: 2,
    migrate: migrateArtisanV1toV2,
    description: 'Ajout géolocalisation et région',
  },
]);

/**
 * Chaîne de migration pour Devis
 */
export const devisMigrationChain = createMigrationChain<DevisV2>([
  {
    from: 1,
    to: 2,
    migrate: migrateDevisV1toV2,
    description: 'Ajout TVA détaillée par prestation',
  },
]);

// ============================================
// BATCH MIGRATION
// ============================================

/**
 * Migre tous les documents d'une collection
 * ⚠️ À utiliser avec précaution sur de grandes collections
 */
export async function migrateCollection<T extends Versionable>(
  db: Firestore,
  collectionName: string,
  migrationChain: MigrationChain<T>,
  options: {
    dryRun?: boolean;
    batchSize?: number;
    onProgress?: (current: number, total: number) => void;
  } = {}
): Promise<{
  total: number;
  migrated: number;
  skipped: number;
  errors: number;
}> {
  const { dryRun = false, batchSize = 100, onProgress } = options;

  console.log(
    `🚀 Migration collection ${collectionName} ` +
    `(${dryRun ? 'DRY RUN' : 'PRODUCTION'})`
  );

  // Récupérer tous les documents (attention : peut être lent)
  const snapshot = await db.collection(collectionName).get();
  const docs = snapshot.docs;

  let migrated = 0;
  let skipped = 0;
  let errors = 0;

  for (let i = 0; i < docs.length; i += batchSize) {
    const batch = docs.slice(i, i + batchSize);

    for (const docSnap of batch) {
      const data = docSnap.data() as Versionable;

      try {
        if (!migrationChain.needsMigration(data)) {
          skipped++;
          continue;
        }

        if (!dryRun) {
          await migrationChain.migrate(data, db, {
            persistToFirestore: true,
            collectionName,
            documentId: docSnap.id,
          });
        }

        migrated++;
      } catch (error) {
        console.error(`❌ Erreur migration ${docSnap.id}:`, error);
        errors++;
      }

      if (onProgress) {
        onProgress(i + batch.indexOf(docSnap) + 1, docs.length);
      }
    }
  }

  console.log('\n✨ Migration terminée !');
  console.log(`   ✅ Migrés: ${migrated}`);
  console.log(`   ⏭️  Ignorés: ${skipped}`);
  console.log(`   ❌ Erreurs: ${errors}`);

  return { total: docs.length, migrated, skipped, errors };
}
