/**
 * Script de test des patterns Soft Delete et Schema Versioning
 * 
 * Usage:
 * ```bash
 * cd frontend/scripts
 * npx ts-node test-patterns.ts
 * ```
 */

import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

import admin from 'firebase-admin';

// Initialiser Firebase Admin SDK
if (!admin.apps.length) {
  const serviceAccount = {
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  };

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
  });
}

const db = admin.firestore();

// ============================================
// TEST 1 : SOFT DELETE
// ============================================

async function testSoftDelete() {
  console.log('\n🧪 TEST 1 : Soft Delete\n');

  const testArtisanId = 'test-artisan-soft-delete';

  try {
    // 1. Créer un document test
    console.log('1️⃣ Création document test...');
    await db.collection('artisans').doc(testArtisanId).set({
      businessName: 'Test Plomberie',
      metiers: ['plomberie'],
      deleted: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    console.log('   ✅ Document créé');

    // 2. Soft delete
    console.log('\n2️⃣ Soft delete...');
    await db.collection('artisans').doc(testArtisanId).update({
      deleted: true,
      deletedAt: admin.firestore.FieldValue.serverTimestamp(),
      deletedBy: 'admin-test',
      deletionReason: 'Test automatique',
    });
    console.log('   ✅ Document marqué comme supprimé');

    // 3. Vérifier exclusion dans query
    console.log('\n3️⃣ Vérification exclusion query...');
    const activeArtisans = await db.collection('artisans')
      .where('deleted', '!=', true)
      .get();
    
    const testInActive = activeArtisans.docs.some(doc => doc.id === testArtisanId);
    console.log(`   ${testInActive ? '❌' : '✅'} Document ${testInActive ? 'encore visible' : 'bien exclu'}`);

    // 4. Récupérer documents supprimés
    console.log('\n4️⃣ Récupération documents supprimés...');
    const deletedArtisans = await db.collection('artisans')
      .where('deleted', '==', true)
      .get();
    
    const testInDeleted = deletedArtisans.docs.some(doc => doc.id === testArtisanId);
    console.log(`   ${testInDeleted ? '✅' : '❌'} Document ${testInDeleted ? 'bien trouvé' : 'non trouvé'} dans supprimés`);

    // 5. Restaurer
    console.log('\n5️⃣ Restauration...');
    await db.collection('artisans').doc(testArtisanId).update({
      deleted: false,
      deletedAt: null,
      deletedBy: null,
      deletionReason: null,
    });
    console.log('   ✅ Document restauré');

    // 6. Nettoyer
    console.log('\n6️⃣ Nettoyage...');
    await db.collection('artisans').doc(testArtisanId).delete();
    console.log('   ✅ Document test supprimé définitivement');

    console.log('\n✅ Test Soft Delete réussi !\n');

  } catch (error) {
    console.error('\n❌ Erreur test Soft Delete:', error);
    throw error;
  }
}

// ============================================
// TEST 2 : SCHEMA VERSIONING
// ============================================

async function testSchemaVersioning() {
  console.log('\n🧪 TEST 2 : Schema Versioning\n');

  const testArtisanId = 'test-artisan-versioning';

  try {
    // 1. Créer document V1 (sans coordinates)
    console.log('1️⃣ Création document V1...');
    await db.collection('artisans').doc(testArtisanId).set({
      schemaVersion: 1,
      businessName: 'Test Électricité',
      metiers: ['electricite'],
      location: {
        city: 'Paris',
        postalCode: '75001',
        address: '1 rue de Rivoli',
      },
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    console.log('   ✅ Document V1 créé');

    // 2. Lire et afficher
    console.log('\n2️⃣ Lecture document V1...');
    const docV1 = await db.collection('artisans').doc(testArtisanId).get();
    const dataV1 = docV1.data();
    console.log('   Données V1:', {
      schemaVersion: dataV1?.schemaVersion,
      location: dataV1?.location,
    });

    // 3. Simuler migration V1 → V2
    console.log('\n3️⃣ Migration V1 → V2...');
    await db.collection('artisans').doc(testArtisanId).update({
      schemaVersion: 2,
      'location.coordinates': {
        lat: 48.8566,
        lng: 2.3522,
      },
      'location.region': 'Île-de-France',
      lastMigrationDate: admin.firestore.FieldValue.serverTimestamp(),
      lastMigrationFrom: 1,
      lastMigrationTo: 2,
    });
    console.log('   ✅ Migration effectuée');

    // 4. Lire V2 et vérifier
    console.log('\n4️⃣ Vérification V2...');
    const docV2 = await db.collection('artisans').doc(testArtisanId).get();
    const dataV2 = docV2.data();
    
    console.log('   Données V2:', {
      schemaVersion: dataV2?.schemaVersion,
      location: dataV2?.location,
      lastMigrationFrom: dataV2?.lastMigrationFrom,
      lastMigrationTo: dataV2?.lastMigrationTo,
    });

    const hasCoordinates = dataV2?.location?.coordinates?.lat !== undefined;
    console.log(`   ${hasCoordinates ? '✅' : '❌'} Coordinates ${hasCoordinates ? 'ajoutées' : 'manquantes'}`);

    // 5. Nettoyer
    console.log('\n5️⃣ Nettoyage...');
    await db.collection('artisans').doc(testArtisanId).delete();
    console.log('   ✅ Document test supprimé');

    console.log('\n✅ Test Schema Versioning réussi !\n');

  } catch (error) {
    console.error('\n❌ Erreur test Schema Versioning:', error);
    throw error;
  }
}

// ============================================
// TEST 3 : COMBINAISON DES DEUX PATTERNS
// ============================================

async function testCombined() {
  console.log('\n🧪 TEST 3 : Soft Delete + Schema Versioning\n');

  const testArtisanId = 'test-artisan-combined';

  try {
    // 1. Créer V1
    console.log('1️⃣ Création document V1...');
    await db.collection('artisans').doc(testArtisanId).set({
      schemaVersion: 1,
      businessName: 'Test Menuiserie',
      metiers: ['menuiserie'],
      location: { city: 'Lyon', postalCode: '69001' },
      deleted: false,
    });
    console.log('   ✅ V1 créé');

    // 2. Migrer vers V2
    console.log('\n2️⃣ Migration V2...');
    await db.collection('artisans').doc(testArtisanId).update({
      schemaVersion: 2,
      'location.region': 'Auvergne-Rhône-Alpes',
    });
    console.log('   ✅ Migré vers V2');

    // 3. Soft delete
    console.log('\n3️⃣ Soft delete...');
    await db.collection('artisans').doc(testArtisanId).update({
      deleted: true,
      deletedAt: admin.firestore.FieldValue.serverTimestamp(),
      deletedBy: 'admin-test',
    });
    console.log('   ✅ Marqué comme supprimé');

    // 4. Vérifier exclusion malgré schemaVersion=2
    console.log('\n4️⃣ Vérification exclusion...');
    const activeV2 = await db.collection('artisans')
      .where('schemaVersion', '==', 2)
      .where('deleted', '!=', true)
      .get();
    
    const found = activeV2.docs.some(doc => doc.id === testArtisanId);
    console.log(`   ${found ? '❌' : '✅'} Document V2 supprimé ${found ? 'encore visible' : 'bien exclu'}`);

    // 5. Nettoyer
    console.log('\n5️⃣ Nettoyage...');
    await db.collection('artisans').doc(testArtisanId).delete();
    console.log('   ✅ Nettoyé');

    console.log('\n✅ Test combiné réussi !\n');

  } catch (error) {
    console.error('\n❌ Erreur test combiné:', error);
    throw error;
  }
}

// ============================================
// EXÉCUTION DES TESTS
// ============================================

async function runAllTests() {
  console.log('═══════════════════════════════════════════════');
  console.log('   TESTS PATTERNS SOFT DELETE + VERSIONING');
  console.log('═══════════════════════════════════════════════');

  try {
    await testSoftDelete();
    await testSchemaVersioning();
    await testCombined();

    console.log('═══════════════════════════════════════════════');
    console.log('✅ TOUS LES TESTS RÉUSSIS !');
    console.log('═══════════════════════════════════════════════');

    process.exit(0);
  } catch (error) {
    console.error('\n═══════════════════════════════════════════════');
    console.error('❌ ÉCHEC DES TESTS');
    console.error('═══════════════════════════════════════════════');
    console.error(error);
    process.exit(1);
  }
}

runAllTests();
