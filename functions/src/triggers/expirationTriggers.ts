/**
 * Cloud Function : Expiration automatique des demandes publiques
 * 
 * S'exécute automatiquement chaque jour à 1h00 du matin (Europe/Paris)
 * 
 * Processus :
 * 1. Query Firestore : Trouve toutes les demandes expirées
 * 2. Update statut : 'publiee' ou 'matchee' → 'expiree'
 * 3. Notifie clients : Email + notification in-app
 * 4. Logs analytics : Tracking taux d'expiration
 * 
 * Règles d'expiration :
 * - dateExpiration calculée intelligemment à la création (voir dateExpirationUtils.ts)
 * - SI date début travaux < 30 jours : expiration = dateDebut - 3 jours
 * - SI date début travaux >= 30 jours : expiration = création + 30 jours (cap)
 * - SI pas de date début : expiration = création + 30 jours (par défaut)
 * 
 * Déploiement :
 * firebase deploy --only functions:expirerDemandesPassees
 * 
 * Monitoring :
 * firebase functions:log --only expirerDemandesPassees --follow
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

const db = admin.firestore();

/**
 * Cloud Function schedulée : Expirer demandes passées
 * Cron : Tous les jours à 1h00 (Europe/Paris)
 */
export const expirerDemandesPassees = functions
  .region('europe-west1')
  .pubsub
  .schedule('0 1 * * *') // Cron: minute 0, heure 1, chaque jour
  .timeZone('Europe/Paris')
  .onRun(async (context) => {
    console.log(`🔄 [expirerDemandesPassees] Démarrage vérification demandes expirées...`);
    
    const now = admin.firestore.Timestamp.now();
    const startTime = Date.now();
    
    try {
      // ✅ ÉTAPE 1 : Query demandes expirées
      // Statuts concernés : 'publiee', 'matchee' (demandes actives)
      // Exclure : 'expiree', 'terminee', 'annulee', 'quota_atteint'
      const expiredDemandesSnap = await db.collection('demandes')
        .where('dateExpiration', '<', now)
        .where('statut', 'in', ['publiee', 'matchee'])
        .get();
      
      const totalExpired = expiredDemandesSnap.size;
      
      if (totalExpired === 0) {
        console.log(`✅ [expirerDemandesPassees] Aucune demande expirée. Tout est à jour !`);
        return null;
      }
      
      console.log(`📊 [expirerDemandesPassees] ${totalExpired} demande(s) expirée(s) trouvée(s)`);
      
      // ✅ ÉTAPE 2 : Mettre à jour statut + notifier clients
      let successCount = 0;
      let errorCount = 0;
      const errors: string[] = [];
      
      // Batch updates (500 max par batch Firestore)
      const batch = db.batch();
      const notifications: Array<{ clientId: string; demandeId: string; metier: string }> = [];
      
      expiredDemandesSnap.docs.forEach((doc) => {
        try {
          const demande = doc.data();
          
          // Update statut demande
          batch.update(doc.ref, {
            statut: 'expiree',
            dateModification: now,
          });
          
          // Préparer notification client
          notifications.push({
            clientId: demande.clientId,
            demandeId: doc.id,
            metier: demande.metier,
          });
          
          console.log(`✅ [expirerDemandesPassees] Demande ${doc.id} → 'expiree' (métier: ${demande.metier})`);
          successCount++;
          
        } catch (err) {
          errorCount++;
          const errorMsg = `Erreur demande ${doc.id}: ${err}`;
          errors.push(errorMsg);
          console.error(`❌ [expirerDemandesPassees] ${errorMsg}`);
        }
      });
      
      // Commit batch update
      await batch.commit();
      console.log(`💾 [expirerDemandesPassees] Batch update committed: ${successCount} demandes mises à jour`);
      
      // ✅ ÉTAPE 3 : Créer notifications pour clients
      const notificationsBatch = db.batch();
      
      for (const notif of notifications) {
        const notificationRef = db.collection('notifications').doc();
        notificationsBatch.set(notificationRef, {
          userId: notif.clientId,
          type: 'demande_expiree',
          title: 'Demande expirée',
          message: `Votre demande de ${notif.metier} a expiré. Vous pouvez créer une nouvelle demande si le besoin persiste.`,
          relatedId: notif.demandeId,
          isRead: false,
          createdAt: now,
        });
      }
      
      await notificationsBatch.commit();
      console.log(`📧 [expirerDemandesPassees] ${notifications.length} notification(s) créée(s)`);
      
      // ✅ ÉTAPE 4 : Logs analytics finaux
      const duration = Date.now() - startTime;
      
      console.log(`\n✨ [expirerDemandesPassees] RÉSUMÉ :`);
      console.log(`   - Total demandes expirées : ${totalExpired}`);
      console.log(`   - Succès : ${successCount}`);
      console.log(`   - Erreurs : ${errorCount}`);
      console.log(`   - Notifications envoyées : ${notifications.length}`);
      console.log(`   - Durée : ${duration}ms`);
      
      if (errors.length > 0) {
        console.error(`\n⚠️ [expirerDemandesPassees] ERREURS :`);
        errors.forEach(err => console.error(`   - ${err}`));
      }
      
      // Tracker analytics (optionnel)
      // await trackAnalytics('demandes_expired', { count: totalExpired, duration });
      
      return {
        success: true,
        totalExpired,
        successCount,
        errorCount,
        duration,
      };
      
    } catch (error) {
      console.error(`❌ [expirerDemandesPassees] ERREUR CRITIQUE :`, error);
      throw error; // Remonter erreur pour retry automatique Firebase
    }
  });

/**
 * Cloud Function HTTP : Exécution manuelle expiration demandes
 * Utile pour tests ou exécution ponctuelle
 * 
 * Usage :
 * curl -X POST https://europe-west1-artisandispo.cloudfunctions.net/expireManualDemandes \
 *   -H "Content-Type: application/json"
 */
export const expireManualDemandes = functions
  .region('europe-west1')
  .https
  .onRequest(async (req, res) => {
    // CORS
    res.set('Access-Control-Allow-Origin', '*');
    if (req.method === 'OPTIONS') {
      res.set('Access-Control-Allow-Methods', 'POST');
      res.set('Access-Control-Allow-Headers', 'Content-Type');
      res.status(204).send('');
      return;
    }
    
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Méthode non autorisée' });
      return;
    }
    
    console.log(`🔄 [expireManualDemandes] Exécution manuelle demandée`);
    
    try {
      // Réutiliser la logique de la fonction schedulée
      const now = admin.firestore.Timestamp.now();
      
      const expiredDemandesSnap = await db.collection('demandes')
        .where('dateExpiration', '<', now)
        .where('statut', 'in', ['publiee', 'matchee'])
        .get();
      
      if (expiredDemandesSnap.empty) {
        res.status(200).json({
          success: true,
          message: 'Aucune demande expirée',
          totalExpired: 0,
        });
        return;
      }
      
      const batch = db.batch();
      
      expiredDemandesSnap.docs.forEach((doc) => {
        batch.update(doc.ref, {
          statut: 'expiree',
          dateModification: now,
        });
      });
      
      await batch.commit();
      
      console.log(`✅ [expireManualDemandes] ${expiredDemandesSnap.size} demande(s) expirée(s)`);
      
      res.status(200).json({
        success: true,
        message: 'Demandes expirées avec succès',
        totalExpired: expiredDemandesSnap.size,
      });
      
    } catch (error) {
      console.error(`❌ [expireManualDemandes] Erreur:`, error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });
