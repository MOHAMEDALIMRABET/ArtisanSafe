/**
 * Script de migration: Renommer le statut 'brouillon' en 'genere'
 * 
 * Ce script met à jour tous les documents dans Firestore:
 * - Collection 'demandes': statut 'brouillon' → 'genere'
 * - Collection 'devis': statut 'brouillon' → 'genere'
 * 
 * Utilisation:
 * cd frontend/scripts
 * npx ts-node --project tsconfig.json migrate-brouillon-to-genere.ts
 */

import * as admin from 'firebase-admin';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Charger les variables d'environnement depuis le backend
dotenv.config({ path: path.resolve(__dirname, '../../backend/.env') });

// Initialiser Firebase Admin SDK
const serviceAccount = {
  projectId: process.env.FIREBASE_PROJECT_ID,
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
};

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
  });
}

const db = admin.firestore();

interface MigrationStats {
  collection: string;
  total: number;
  migrated: number;
  skipped: number;
  errors: number;
}

/**
 * Migrer une collection de 'brouillon' à 'genere'
 */
async function migrateCollection(collectionName: string): Promise<MigrationStats> {
  console.log(`\n🔄 Migration de la collection: ${collectionName}`);
  
  const stats: MigrationStats = {
    collection: collectionName,
    total: 0,
    migrated: 0,
    skipped: 0,
    errors: 0,
  };

  try {
    // Récupérer tous les documents avec statut 'brouillon'
    const snapshot = await db
      .collection(collectionName)
      .where('statut', '==', 'brouillon')
      .get();

    stats.total = snapshot.size;
    console.log(`   📊 ${stats.total} document(s) avec statut 'brouillon' trouvé(s)`);

    if (stats.total === 0) {
      console.log(`   ✅ Aucune migration nécessaire`);
      return stats;
    }

    // Migrer chaque document
    for (const docSnap of snapshot.docs) {
      try {
        const data = docSnap.data();
        
        console.log(`\n   📝 Document: ${docSnap.id}`);
        console.log(`      Avant: statut = 'brouillon'`);

        // Mettre à jour le statut
        await db.collection(collectionName).doc(docSnap.id).update({
          statut: 'genere',
          // Ajouter un champ de traçabilité
          migratedAt: admin.firestore.FieldValue.serverTimestamp(),
          migratedFrom: 'brouillon',
          migratedTo: 'genere',
        });

        console.log(`      Après: statut = 'genere' ✅`);
        stats.migrated++;
      } catch (error) {
        console.error(`      ❌ Erreur lors de la migration:`, error);
        stats.errors++;
      }
    }

    return stats;
  } catch (error) {
    console.error(`❌ Erreur lors de la migration de ${collectionName}:`, error);
    throw error;
  }
}

/**
 * Fonction principale
 */
async function main() {
  console.log('🚀 Démarrage de la migration: brouillon → genere\n');
  console.log('=' . repeat(60));

  const allStats: MigrationStats[] = [];

  try {
    // Migrer la collection 'demandes'
    const demandesStats = await migrateCollection('demandes');
    allStats.push(demandesStats);

    // Migrer la collection 'devis'
    const devisStats = await migrateCollection('devis');
    allStats.push(devisStats);

    // Afficher le résumé
    console.log('\n\n' + '='.repeat(60));
    console.log('✨ RÉSUMÉ DE LA MIGRATION');
    console.log('='.repeat(60));

    let totalMigrated = 0;
    let totalErrors = 0;

    for (const stats of allStats) {
      console.log(`\n📦 Collection: ${stats.collection}`);
      console.log(`   Total trouvé: ${stats.total}`);
      console.log(`   ✅ Migré: ${stats.migrated}`);
      console.log(`   ⏭️  Ignoré: ${stats.skipped}`);
      console.log(`   ❌ Erreurs: ${stats.errors}`);

      totalMigrated += stats.migrated;
      totalErrors += stats.errors;
    }

    console.log('\n' + '='.repeat(60));
    console.log(`📊 TOTAL GÉNÉRAL`);
    console.log(`   ✅ ${totalMigrated} document(s) migré(s)`);
    console.log(`   ❌ ${totalErrors} erreur(s)`);
    console.log('='.repeat(60));

    if (totalErrors > 0) {
      console.log('\n⚠️  Certains documents n\'ont pas pu être migrés. Vérifiez les erreurs ci-dessus.');
      process.exit(1);
    } else {
      console.log('\n✅ Migration terminée avec succès !');
      console.log('\n📝 Prochaines étapes:');
      console.log('   1. Déployer les règles Firestore: firebase deploy --only firestore:rules');
      console.log('   2. Vérifier que l\'application frontend fonctionne correctement');
      console.log('   3. Commit les changements: git add . && git commit -m "feat: renommer statut brouillon en genere"');
      process.exit(0);
    }
  } catch (error) {
    console.error('\n❌ Erreur fatale:', error);
    process.exit(1);
  }
}

// Exécuter la migration
main();
