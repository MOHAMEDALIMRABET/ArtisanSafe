/**
 * Cloud Function : Nettoyage automatique des demandes obsolètes
 * 
 * Exécution : Tous les dimanches à 2h du matin (Europe/Paris)
 * 
 * Fonctionnement :
 * 1. Récupère demandes expirées ou annulées depuis > 30 jours
 * 2. Supprime définitivement ces demandes (hard delete)
 * 3. Log statistiques de nettoyage
 * 4. Notification client optionnelle (si souhaité)
 * 
 * Règles de suppression :
 * - Demandes EXPIRÉES : dateExpiration + 30 jours < maintenant
 * - Demandes ANNULÉES : dateModification + 30 jours < maintenant (statut='annulee')
 * - Demandes EXCLUES : en_cours, attribuee, terminee (conservation légale)
 * 
 * Conformité RGPD :
 * - Suppression automatique données obsolètes
 * - Conservation 30 jours pour audit/réclamation
 * - Logs de suppression pour traçabilité
 * 
 * Déploiement :
 * firebase deploy --only functions:cleanupOldDemandes
 * 
 * Monitoring :
 * firebase functions:log --only cleanupOldDemandes --follow
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

interface Demande {
  id: string;
  clientId: string;
  titre: string;
  statut: string;
  dateExpiration?: admin.firestore.Timestamp;
  dateModification?: admin.firestore.Timestamp;
  dateCreation: admin.firestore.Timestamp;
  devisRecus?: number;
}

/**
 * Helper : Calculer ancienneté d'une date en jours
 */
function getAgeInDays(timestamp: admin.firestore.Timestamp): number {
  const now = Date.now();
  const created = timestamp.toMillis();
  const diffMs = now - created;
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Cron hebdomadaire : Supprimer demandes obsolètes
 */
export const cleanupOldDemandes = functions
  .runWith({
    timeoutSeconds: 540, // 9 minutes max
    memory: '512MB' // Plus de mémoire pour batch operations
  })
  .pubsub
  .schedule('every sunday 02:00')
  .timeZone('Europe/Paris')
  .onRun(async (context) => {
    const db = admin.firestore();
    const now = admin.firestore.Timestamp.now();
    
    // Date limite : il y a 30 jours
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const timestampLimit = admin.firestore.Timestamp.fromDate(thirtyDaysAgo);
    
    console.log('🗑️ ========================================');
    console.log('🗑️ Nettoyage automatique demandes obsolètes');
    console.log('🗑️ ========================================');
    console.log(`⏰ Exécution : ${new Date().toLocaleString('fr-FR', { timeZone: 'Europe/Paris' })}`);
    console.log(`📅 Seuil suppression : ${thirtyDaysAgo.toLocaleDateString('fr-FR')} (30 jours)`);
    console.log('');
    
    let totalDeleted = 0;
    const stats = {
      expirees: 0,
      annulees: 0,
      errors: 0
    };
    
    try {
      // ========================================
      // 1. RÉCUPÉRER DEMANDES EXPIRÉES (> 30 jours)
      // ========================================
      
      console.log('🔍 Recherche demandes expirées...');
      
      const expireeSnapshot = await db.collection('demandes')
        .where('statut', '==', 'expiree')
        .where('dateExpiration', '<', timestampLimit)
        .limit(500) // Limiter à 500 par exécution
        .get();
      
      console.log(`📊 ${expireeSnapshot.size} demande(s) expirée(s) trouvée(s)`);
      
      // Logs détaillés
      if (!expireeSnapshot.empty) {
        console.log('');
        console.log('📋 Demandes expirées à supprimer :');
        console.log('─────────────────────────────────────');
      }
      
      const batchExpirees = db.batch();
      
      for (const docSnap of expireeSnapshot.docs) {
        const demande = docSnap.data() as Demande;
        const demandeId = docSnap.id;
        const age = demande.dateExpiration ? getAgeInDays(demande.dateExpiration) : 'N/A';
        
        console.log(`  ⏰ ${demandeId}`);
        console.log(`     - Titre: ${demande.titre || 'Sans titre'}`);
        console.log(`     - Expirée depuis: ${age} jours`);
        console.log(`     - Devis reçus: ${demande.devisRecus || 0}`);
        
        // Ajouter à batch delete
        batchExpirees.delete(docSnap.ref);
        stats.expirees++;
      }
      
      // Commit batch expirées
      if (stats.expirees > 0) {
        await batchExpirees.commit();
        console.log(`✅ ${stats.expirees} demande(s) expirée(s) supprimée(s)`);
        console.log('');
      }
      
      // ========================================
      // 2. RÉCUPÉRER DEMANDES ANNULÉES (> 30 jours)
      // ========================================
      
      console.log('🔍 Recherche demandes annulées...');
      
      const annuleeSnapshot = await db.collection('demandes')
        .where('statut', '==', 'annulee')
        .where('dateModification', '<', timestampLimit)
        .limit(500)
        .get();
      
      console.log(`📊 ${annuleeSnapshot.size} demande(s) annulée(s) trouvée(s)`);
      
      // Logs détaillés
      if (!annuleeSnapshot.empty) {
        console.log('');
        console.log('📋 Demandes annulées à supprimer :');
        console.log('─────────────────────────────────────');
      }
      
      const batchAnnulees = db.batch();
      
      for (const docSnap of annuleeSnapshot.docs) {
        const demande = docSnap.data() as Demande;
        const demandeId = docSnap.id;
        const age = demande.dateModification ? getAgeInDays(demande.dateModification) : 'N/A';
        
        console.log(`  ❌ ${demandeId}`);
        console.log(`     - Titre: ${demande.titre || 'Sans titre'}`);
        console.log(`     - Annulée depuis: ${age} jours`);
        console.log(`     - Devis reçus: ${demande.devisRecus || 0}`);
        
        // Ajouter à batch delete
        batchAnnulees.delete(docSnap.ref);
        stats.annulees++;
      }
      
      // Commit batch annulées
      if (stats.annulees > 0) {
        await batchAnnulees.commit();
        console.log(`✅ ${stats.annulees} demande(s) annulée(s) supprimée(s)`);
        console.log('');
      }
      
      // ========================================
      // 3. STATISTIQUES FINALES
      // ========================================
      
      totalDeleted = stats.expirees + stats.annulees;
      
      console.log('🗑️ ========================================');
      console.log('🗑️ RÉSUMÉ DU NETTOYAGE');
      console.log('🗑️ ========================================');
      console.log(`⏰ Demandes expirées supprimées : ${stats.expirees}`);
      console.log(`❌ Demandes annulées supprimées : ${stats.annulees}`);
      console.log(`📊 TOTAL supprimé : ${totalDeleted}`);
      console.log(`❌ Erreurs : ${stats.errors}`);
      console.log('');
      
      if (totalDeleted === 0) {
        console.log('✅ Base de données propre - Aucune demande à supprimer');
      } else {
        console.log(`✅ Nettoyage terminé avec succès - ${totalDeleted} demande(s) supprimée(s)`);
        console.log(`💾 Espace Firestore libéré`);
        console.log(`⚡ Optimisation performances queries`);
      }
      
      console.log('🗑️ ========================================');
      
      // Retourner résultat
      return {
        success: true,
        timestamp: now.toDate(),
        deleted: totalDeleted,
        breakdown: stats
      };
      
    } catch (error) {
      console.error('❌ ERREUR lors du nettoyage:', error);
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        deleted: totalDeleted,
        breakdown: stats
      };
    }
  });

/**
 * Version HTTP pour exécution manuelle (tests/debug)
 * 
 * Usage:
 * curl -X POST https://<region>-<project>.cloudfunctions.net/cleanupOldDemandesManual
 * 
 * ou depuis Firebase Console > Functions > cleanupOldDemandesManual > Execute
 */
export const cleanupOldDemandesManual = functions
  .runWith({
    timeoutSeconds: 540,
    memory: '512MB'
  })
  .https
  .onRequest(async (req, res) => {
    console.log('🔧 Exécution MANUELLE du nettoyage demandes');
    
    const db = admin.firestore();
    const now = admin.firestore.Timestamp.now();
    
    // Date limite : il y a 30 jours
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const timestampLimit = admin.firestore.Timestamp.fromDate(thirtyDaysAgo);
    
    let totalDeleted = 0;
    const stats = {
      expirees: 0,
      annulees: 0,
      errors: 0
    };
    
    try {
      // Demandes expirées
      const expireeSnapshot = await db.collection('demandes')
        .where('statut', '==', 'expiree')
        .where('dateExpiration', '<', timestampLimit)
        .limit(500)
        .get();
      
      const batchExpirees = db.batch();
      expireeSnapshot.docs.forEach(doc => {
        batchExpirees.delete(doc.ref);
        stats.expirees++;
      });
      
      if (stats.expirees > 0) {
        await batchExpirees.commit();
      }
      
      // Demandes annulées
      const annuleeSnapshot = await db.collection('demandes')
        .where('statut', '==', 'annulee')
        .where('dateModification', '<', timestampLimit)
        .limit(500)
        .get();
      
      const batchAnnulees = db.batch();
      annuleeSnapshot.docs.forEach(doc => {
        batchAnnulees.delete(doc.ref);
        stats.annulees++;
      });
      
      if (stats.annulees > 0) {
        await batchAnnulees.commit();
      }
      
      totalDeleted = stats.expirees + stats.annulees;
      
      res.status(200).json({
        success: true,
        message: `✅ Nettoyage terminé - ${totalDeleted} demande(s) supprimée(s)`,
        timestamp: now.toDate(),
        deleted: totalDeleted,
        breakdown: stats
      });
      
    } catch (error) {
      console.error('❌ Erreur:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        deleted: totalDeleted,
        breakdown: stats
      });
    }
  });
