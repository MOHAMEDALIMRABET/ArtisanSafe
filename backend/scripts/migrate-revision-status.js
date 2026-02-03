/**
 * Script de migration : Statut 'refuse' + typeRefus='revision' → 'en_revision'
 * 
 * CONTEXTE :
 * - Avant : Révisions stockées comme statut='refuse' + typeRefus='revision'
 * - Après : Révisions ont leur propre statut='en_revision' (clarté sémantique)
 * 
 * CHANGEMENTS :
 * 1. statut: 'refuse' → 'en_revision'
 * 2. motifRefus → motifRevision
 * 3. dateRefus → dateRevision
 * 4. typeRefus supprimé (plus nécessaire)
 * 5. nombreRevisions initialisé à 1 (nouveau champ)
 * 
 * EXÉCUTION :
 * cd backend/scripts
 * node migrate-revision-status.js
 */

const admin = require('firebase-admin');
const readline = require('readline');
const dotenv = require('dotenv');
const path = require('path');

// Charger les variables d'environnement
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Initialiser Firebase Admin SDK
const serviceAccount = {
  projectId: process.env.FIREBASE_PROJECT_ID,
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
};

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

// Interface readline pour confirmation
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (query) => new Promise((resolve) => rl.question(query, resolve));

/**
 * Fonction principale de migration
 */
async function migrateRevisionStatus() {
  console.log('\n🔄 MIGRATION : statut revision → en_revision\n');
  console.log('═'.repeat(60));
  console.log('⚠️  ATTENTION : Cette migration est IRRÉVERSIBLE');
  console.log('═'.repeat(60));
  console.log('\nChangements appliqués :');
  console.log('  • statut: "refuse" → "en_revision"');
  console.log('  • motifRefus → motifRevision');
  console.log('  • dateRefus → dateRevision');
  console.log('  • typeRefus supprimé');
  console.log('  • nombreRevisions initialisé à 1\n');

  try {
    // 1. ANALYSE : Chercher tous les devis avec typeRefus='revision'
    console.log('📊 Analyse des données existantes...\n');
    
    const devisRefusesSnapshot = await db
      .collection('devis')
      .where('statut', '==', 'refuse')
      .where('typeRefus', '==', 'revision')
      .get();

    const totalRevisions = devisRefusesSnapshot.size;

    if (totalRevisions === 0) {
      console.log('✅ Aucune révision à migrer (typeRefus="revision" non trouvé)');
      console.log('ℹ️  Le système est déjà à jour ou aucune révision n\'existe encore.\n');
      process.exit(0);
    }

    console.log(`📋 ${totalRevisions} révision(s) trouvée(s) à migrer :\n`);

    // Afficher aperçu des devis à migrer
    devisRefusesSnapshot.docs.slice(0, 5).forEach((doc, index) => {
      const data = doc.data();
      console.log(`${index + 1}. ${data.numeroDevis || doc.id}`);
      console.log(`   Motif : ${(data.motifRefus || 'Aucun').substring(0, 60)}...`);
      console.log(`   Date refus : ${data.dateRefus?.toDate().toLocaleDateString('fr-FR') || 'Non définie'}`);
      console.log('');
    });

    if (totalRevisions > 5) {
      console.log(`   ... et ${totalRevisions - 5} autre(s)\n`);
    }

    // 2. CONFIRMATION
    console.log('═'.repeat(60));
    const confirmation = await question(
      `⚠️  Confirmer la migration de ${totalRevisions} révision(s) ? (oui/non) : `
    );

    if (confirmation.toLowerCase() !== 'oui') {
      console.log('\n❌ Migration annulée par l\'utilisateur\n');
      process.exit(0);
    }

    console.log('\n🚀 Démarrage de la migration...\n');

    // 3. MIGRATION
    let migratedCount = 0;
    let errorCount = 0;
    const batch = db.batch();
    let batchCount = 0;

    for (const docSnap of devisRefusesSnapshot.docs) {
      const data = docSnap.data();
      const devisRef = docSnap.ref;

      try {
        // Préparer les nouveaux champs
        const updatedFields = {
          statut: 'en_revision',
          motifRevision: data.motifRefus || 'Migration : motif non précisé',
          dateRevision: data.dateRefus || admin.firestore.Timestamp.now(),
          nombreRevisions: 1, // Initialiser à 1 pour les révisions existantes
          
          // Supprimer les anciens champs
          typeRefus: admin.firestore.FieldValue.delete(),
          motifRefus: admin.firestore.FieldValue.delete(),
          dateRefus: admin.firestore.FieldValue.delete(),
        };

        batch.update(devisRef, updatedFields);
        batchCount++;
        migratedCount++;

        console.log(`✅ Migré: ${data.numeroDevis || docSnap.id}`);

        // Firestore limite : 500 opérations par batch
        if (batchCount >= 500) {
          await batch.commit();
          console.log(`\n💾 Batch de ${batchCount} devis sauvegardé\n`);
          batchCount = 0;
        }
      } catch (error) {
        console.error(`❌ Erreur migration ${docSnap.id}:`, error.message);
        errorCount++;
      }
    }

    // Commit final si des opérations restent
    if (batchCount > 0) {
      await batch.commit();
      console.log(`\n💾 Batch final de ${batchCount} devis sauvegardé\n`);
    }

    // 4. RÉSUMÉ
    console.log('═'.repeat(60));
    console.log('✅ MIGRATION TERMINÉE\n');
    console.log(`📊 Résumé :`);
    console.log(`   • ${migratedCount} révision(s) migrée(s) avec succès`);
    console.log(`   • ${errorCount} erreur(s)`);
    console.log('═'.repeat(60));

    // 5. VÉRIFICATION POST-MIGRATION
    console.log('\n🔍 Vérification post-migration...\n');

    const newRevisionSnapshot = await db
      .collection('devis')
      .where('statut', '==', 'en_revision')
      .get();

    const oldRevisionSnapshot = await db
      .collection('devis')
      .where('statut', '==', 'refuse')
      .where('typeRefus', '==', 'revision')
      .get();

    console.log(`✅ Devis avec statut 'en_revision' : ${newRevisionSnapshot.size}`);
    console.log(`⚠️  Devis restants avec typeRefus='revision' : ${oldRevisionSnapshot.size}`);

    if (oldRevisionSnapshot.size > 0) {
      console.log('\n⚠️  Certains devis n\'ont pas été migrés. Relancer le script si nécessaire.\n');
    } else {
      console.log('\n🎉 Migration 100% réussie ! Tous les devis ont été migrés.\n');
    }

    console.log('═'.repeat(60));
    console.log('ℹ️  PROCHAINES ÉTAPES :');
    console.log('   1. Déployer les Cloud Functions : firebase deploy --only functions');
    console.log('   2. Vérifier l\'interface artisan : /artisan/devis');
    console.log('   3. Tester la création d\'une nouvelle révision');
    console.log('═'.repeat(60) + '\n');

  } catch (error) {
    console.error('\n❌ ERREUR CRITIQUE :', error);
    process.exit(1);
  } finally {
    rl.close();
    process.exit(0);
  }
}

// Exécuter la migration
migrateRevisionStatus();
