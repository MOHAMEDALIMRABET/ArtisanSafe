/**
 * Cloud Function : Suppression automatique des devis refusés après 24h
 * 
 * Supprime les devis avec :
 * - statut: 'refuse'
 * - typeRefus: 'artisan' | 'variante' | 'automatique' (SAUF 'revision')
 * - dateRefus > 24h
 * 
 * Exécution : Tous les jours à 3h du matin (heure de Paris)
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

// Initialiser Firebase Admin (si pas déjà fait)
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

/**
 * Cloud Function scheduled - Nettoyage quotidien
 * Schedule : Tous les jours à 3h (Europe/Paris)
 */
export const cleanupRefusedDevis = functions
  .region('europe-west1')
  .pubsub
  .schedule('0 3 * * *')
  .timeZone('Europe/Paris')
  .onRun(async (context) => {
    console.log('🧹 Démarrage nettoyage devis refusés...');
    
    const now = admin.firestore.Timestamp.now();
    const vingtQuatreHeuresEnMillis = 24 * 60 * 60 * 1000;
    const dateLimite = admin.firestore.Timestamp.fromMillis(
      now.toMillis() - vingtQuatreHeuresEnMillis
    );

    try {
      // Les révisions ont maintenant leur propre statut 'en_revision'
      // Tous les devis avec statut='refuse' sont de vrais refus à supprimer
      const devisRefusesQuery = await db
        .collection('devis')
        .where('statut', '==', 'refuse')
        .get();

      // Récupérer aussi les devis remplacés (suppression immédiate)
      const devisRemplacesQuery = await db
        .collection('devis')
        .where('statut', '==', 'remplace')
        .get();

      let devisASupprimerCount = 0;
      const batch = db.batch();
      let batchCount = 0;

      // 1. Traiter les devis refusés (avec délai 24h)
      for (const docSnap of devisRefusesQuery.docs) {
        const devis = docSnap.data();
        const dateRefus = devis.dateRefus;

        // Vérifier si dateRefus existe
        if (!dateRefus) {
          console.warn(`  ⚠️  Devis sans dateRefus: ${docSnap.id}`);
          continue;
        }

        // SUPPRIMER si refusé depuis > 24h
        if (dateRefus.toMillis() < dateLimite.toMillis()) {
          console.log(`🗑️  Suppression devis ${docSnap.id} (refusé depuis ${Math.round((now.toMillis() - dateRefus.toMillis()) / 1000 / 60 / 60)}h)`);
          
          batch.delete(docSnap.ref);
          batchCount++;
          devisASupprimerCount++;

          // Firestore limite : 500 opérations par batch
          if (batchCount >= 500) {
            await batch.commit();
            console.log(`✅ Batch de ${batchCount} devis supprimés`);
            batchCount = 0;
          }
        }
      }

      // 2. Traiter les devis remplacés (suppression IMMÉDIATE)
      console.log('\n🔄 Suppression devis remplacés (immédiate)...');
      
      for (const docSnap of devisRemplacesQuery.docs) {
        const devis = docSnap.data();
        const dateRemplacement = devis.dateRemplacement;
        const tempsEcoule = dateRemplacement
          ? Math.round((now.toMillis() - dateRemplacement.toMillis()) / 1000 / 60)
          : 'Inconnu';

        console.log(`🗑️  Suppression devis ${docSnap.id} (remplacé depuis ${tempsEcoule} min)`);
        
        batch.delete(docSnap.ref);
        batchCount++;
        devisASupprimerCount++;

        // Firestore limite : 500 opérations par batch
        if (batchCount >= 500) {
          await batch.commit();
          console.log(`✅ Batch de ${batchCount} devis supprimés`);
          batchCount = 0;
        }
      }

      // Commit final si des opérations restent
      if (batchCount > 0) {
        await batch.commit();
        console.log(`✅ Batch final de ${batchCount} devis supprimés`);
      }

      console.log(`
📊 RÉSUMÉ NETTOYAGE DEVIS REFUSÉS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ ${devisASupprimerCount} devis refusés supprimés (>24h)
ℹ️  Les révisions (statut='en_revision') ne sont jamais supprimées
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      `);

      return {
        success: true,
        devisSupprimes: devisASupprimerCount,
        devisConserves: devisConservesCount,
      };
    } catch (error) {
      console.error('❌ Erreur lors du nettoyage:', error);
      throw error;
    }
  });

/**
 * Fonction HTTP callable (pour test manuel)
 * Utilisation : POST https://[region]-[project].cloudfunctions.net/cleanupRefusedDevisManual
 */
export const cleanupRefusedDevisManual = functions
  .region('europe-west1')
  .https
  .onRequest(async (req, res) => {
    console.log('🧹 Nettoyage manuel déclenché...');
    
    const now = admin.firestore.Timestamp.now();
    const vingtQuatreHeuresEnMillis = 24 * 60 * 60 * 1000;
    const dateLimite = admin.firestore.Timestamp.fromMillis(
      now.toMillis() - vingtQuatreHeuresEnMillis
    );

    try {
      const devisRefusesQuery = await db
        .collection('devis')
        .where('statut', '==', 'refuse')
        .get();

      let devisASupprimerCount = 0;
      let devisConservesCount = 0;
      const devisSupprimes: string[] = [];
      const batch = db.batch();

      for (const docSnap of devisRefusesQuery.docs) {
        const devis = docSnap.data();
        const typeRefus = devis.typeRefus;
        const dateRefus = devis.dateRefus;

        if (typeRefus === 'revision') {
          devisConservesCount++;
          continue;
        }

        if (
          dateRefus &&
          dateRefus.toMillis() < dateLimite.toMillis() &&
          (typeRefus === 'artisan' || typeRefus === 'variante' || typeRefus === 'automatique' || typeRefus === 'definitif')
        ) {
          batch.delete(docSnap.ref);
          devisSupprimes.push(docSnap.id);
          devisASupprimerCount++;
        }
      }

      await batch.commit();

      res.status(200).json({
        success: true,
        devisSupprimes: devisASupprimerCount,
        devisConserves: devisConservesCount,
        ids: devisSupprimes,
        message: `✅ ${devisASupprimerCount} devis supprimés, ${devisConservesCount} révisions conservées`,
      });
    } catch (error) {
      console.error('❌ Erreur:', error);
      res.status(500).json({
        success: false,
        error: String(error),
      });
    }
  });
