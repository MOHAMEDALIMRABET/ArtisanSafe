/**
 * Script manuel : Suppression des devis refusés après 24h
 * 
 * Ce script supprime définitivement de Firestore les devis avec :
 * - statut: 'refuse'
 * - typeRefus: 'artisan' | 'variante' | 'automatique' | 'definitif'
 * - dateRefus > 24h
 * 
 * Les devis avec typeRefus: 'revision' sont CONSERVÉS
 * 
 * Utilisation:
 * cd backend/scripts
 * node cleanup-devis-refuses.js
 */

const admin = require('firebase-admin');
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

/**
 * Fonction principale de nettoyage
 */
async function cleanupDevisRefuses() {
  console.log('🧹 Démarrage nettoyage devis refusés...\n');
  console.log('═'.repeat(60));

  const now = admin.firestore.Timestamp.now();
  const VINGT_QUATRE_HEURES_MS = 24 * 60 * 60 * 1000;
  const dateLimite = admin.firestore.Timestamp.fromMillis(
    now.toMillis() - VINGT_QUATRE_HEURES_MS
  );

  console.log(`📅 Date limite : ${new Date(dateLimite.toMillis()).toLocaleString('fr-FR')}`);
  console.log(`📅 Maintenant : ${new Date(now.toMillis()).toLocaleString('fr-FR')}`);
  console.log('═'.repeat(60) + '\n');

  try {
    // Récupérer tous les devis refusés
    const devisRefusesSnapshot = await db
      .collection('devis')
      .where('statut', '==', 'refuse')
      .get();

    console.log(`📊 ${devisRefusesSnapshot.size} devis avec statut 'refuse' trouvés\n`);

    // Récupérer tous les devis remplacés (à supprimer immédiatement)
    const devisRemplacesSnapshot = await db
      .collection('devis')
      .where('statut', '==', 'remplace')
      .get();

    console.log(`🔄 ${devisRemplacesSnapshot.size} devis avec statut 'remplace' trouvés\n`);

    if (devisRefusesSnapshot.empty && devisRemplacesSnapshot.empty) {
      console.log('✅ Aucun devis à nettoyer');
      process.exit(0);
    }

    let devisASupprimerCount = 0;
    let devisTropRecentsCount = 0;
    const devisASupprimerIds = [];

    // Les révisions ont maintenant leur propre statut 'en_revision'
    // Tous les devis avec statut='refuse' sont de vrais refus à supprimer

    // Analyser chaque devis refusé
    for (const docSnap of devisRefusesSnapshot.docs) {
      const devis = docSnap.data();
      const devisId = docSnap.id;
      const typeRefus = devis.typeRefus;
      const dateRefus = devis.dateRefus;
      const numeroDevis = devis.numeroDevis || 'N/A';

      console.log(`\n📋 Devis: ${numeroDevis} (${devisId})`);
      console.log(`   Type refus: ${typeRefus || 'NON DÉFINI'}`);
      console.log(`   Date refus: ${dateRefus ? new Date(dateRefus.toMillis()).toLocaleString('fr-FR') : 'NON DÉFINIE'}`);

      // GARDER les révisions
      if (typeRefus === 'revision') {
        console.log('   ✅ CONSERVÉ : Révision (artisan peut répondre)');
        devisConservesCount++;
        continue;
      }

      // Vérifier si dateRefus existe
      if (!dateRefus) {
        console.log('   ⚠️  IGNORÉ : dateRefus manquante');
        devisConservesCount++;
        continue;
      }

      // Calculer l'âge du refus
      const ageEnHeures = (now.toMillis() - dateRefus.toMillis()) / 1000 / 60 / 60;
      console.log(`   ⏱️  Âge : ${ageEnHeures.toFixed(1)}h`);

      // SUPPRIMER si > 24h
      if (dateRefus.toMillis() < dateLimite.toMillis()) {
        if (typeRefus === 'artisan' || typeRefus === 'variante' || typeRefus === 'automatique' || typeRefus === 'definitif') {
          console.log(`   🗑️  SERA SUPPRIMÉ : ${typeRefus} refusé depuis ${ageEnHeures.toFixed(1)}h`);
          devisASupprimerIds.push(devisId);
          devisASupprimerCount++;
        } else {
          console.log(`   ⚠️  CONSERVÉ : typeRefus inconnu (${typeRefus})`);
          devisConservesCount++;
        }
      } else {
        console.log(`   ⏰ CONSERVÉ : Trop récent (${ageEnHeures.toFixed(1)}h < 24h)`);
        devisTropRecentsCount++;
      }
    }

    console.log('\n' + '═'.repeat(60));
    console.log('📊 RÉSUMÉ');
    console.log('═'.repeat(60));
    console.log(`Total analysé : ${devisRefusesSnapshot.size}`);
    console.log(`🗑️  À supprimer : ${devisASupprimerCount} (artisan/variante/automatique/definitif > 24h)`);
    console.log(`🔄 Révisions conservées : ${devisConservesCount}`);
    console.log(`⏰ Trop récents : ${devisTropRecentsCount} (< 24h)`);
    console.log('═'.repeat(60) + '\n');

    if (devisASupprimerCount === 0) {
      console.log('✅ Aucun devis à supprimer');
      process.exit(0);
    }

    // Demander confirmation
    console.log('⚠️  ATTENTION : Cette action est IRRÉVERSIBLE !');
    console.log(`\nVous allez supprimer définitivement ${devisASupprimerCount} devis de Firestore.\n`);

    const readline = require('readline').createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    const confirmation = await new Promise((resolve) => {
      readline.question('Confirmer la suppression ? (oui/non) : ', (answer) => {
        readline.close();
        resolve(answer.toLowerCase().trim());
      });
    });

    if (confirmation !== 'oui') {
      console.log('\n❌ Suppression annulée par l\'utilisateur');
      process.exit(0);
    }

    // Supprimer par batch (500 max)
    console.log('\n🗑️  Suppression en cours...\n');

    const batch = db.batch();
    let batchCount = 0;

    for (const devisId of devisASupprimerIds) {
      const devisRef = db.collection('devis').doc(devisId);
      batch.delete(devisRef);
      batchCount++;

      console.log(`   🗑️  ${devisId}`);

      // Firestore limite : 500 opérations/batch
      if (batchCount >= 500) {
        await batch.commit();
        console.log(`\n✅ Batch de ${batchCount} devis supprimés`);
        batchCount = 0;
      }
    }

    // Commit final
    if (batchCount > 0) {
      await batch.commit();
      console.log(`\n✅ Batch final de ${batchCount} devis supprimés`);
    }

    console.log('\n' + '═'.repeat(60));
    console.log('✅ NETTOYAGE TERMINÉ');
    console.log('═'.repeat(60));
    console.log(`🗑️  ${devisASupprimerCount} devis supprimés définitivement`);
    console.log(`🔄 ${devisConservesCount} révisions conservées`);
    console.log('═'.repeat(60));

    process.exit(0);
  } catch (error) {
    console.error('\n❌ ERREUR FATALE :', error);
    process.exit(1);
  }
}

// Exécuter le nettoyage
cleanupDevisRefuses();
