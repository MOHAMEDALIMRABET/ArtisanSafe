/**
 * Cloud Function : Expiration automatique des demandes passées
 * 
 * Exécution : Tous les jours à 1h du matin (Europe/Paris)
 * 
 * Fonctionnement :
 * 1. Récupère toutes les demandes en statut 'publiee'
 * 2. Vérifie si dateExpiration < maintenant
 * 3. Change statut → 'expiree'
 * 4. Envoie notification au client
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

interface Demande {
  id: string;
  clientId: string;
  titre: string;
  statut: string;
  dateExpiration?: admin.firestore.Timestamp;
  devisRecus?: number;
  datesSouhaitees: {
    dateDebut: string;
    flexibiliteDays?: number;
  };
}

/**
 * Cron quotidien : Marquer demandes expirées
 */
export const expirerDemandesPassees = functions
  .runWith({
    timeoutSeconds: 540, // 9 minutes max
    memory: '256MB'
  })
  .pubsub
  .schedule('every day 01:00')
  .timeZone('Europe/Paris')
  .onRun(async (context) => {
    const db = admin.firestore();
    const now = admin.firestore.Timestamp.now();
    
    console.log('🔄 Début expiration demandes passées...');
    console.log(`⏰ Date/heure : ${new Date().toLocaleString('fr-FR')}`);
    
    try {
      // 1. Récupérer demandes publiées avec dateExpiration < maintenant
      const snapshot = await db.collection('demandes')
        .where('statut', '==', 'publiee')
        .where('dateExpiration', '<', now)
        .limit(500) // Limiter à 500 par exécution
        .get();
      
      console.log(`📊 ${snapshot.size} demande(s) expirée(s) trouvée(s)`);
      
      if (snapshot.empty) {
        console.log('✅ Aucune demande à expirer');
        return null;
      }
      
      // 2. Batch update (max 500 docs)
      const batch = db.batch();
      const notifications: any[] = [];
      let count = 0;
      
      for (const docSnap of snapshot.docs) {
        const demande = docSnap.data() as Demande;
        const demandeId = docSnap.id;
        
        // Marquer comme expirée
        batch.update(docSnap.ref, {
          statut: 'expiree',
          dateModification: now
        });
        count++;
        
        console.log(`⏰ Demande ${demandeId} expirée`);
        console.log(`   - Titre: ${demande.titre}`);
        console.log(`   - Date expiration: ${demande.dateExpiration?.toDate().toLocaleDateString('fr-FR')}`);
        console.log(`   - Devis reçus: ${demande.devisRecus || 0}`);
        
        // Préparer notification client
        const message = demande.devisRecus && demande.devisRecus > 0
          ? `Votre demande "${demande.titre}" est expirée. Vous avez ${demande.devisRecus} devis en attente de réponse.`
          : `Votre demande "${demande.titre}" est expirée sans réponse. Créez une nouvelle demande avec des dates actualisées.`;
        
        notifications.push({
          recipientId: demande.clientId,
          type: 'demande_expiree',
          title: '📅 Demande expirée',
          message,
          relatedId: demandeId,
          isRead: false,
          createdAt: now
        });
      }
      
      // 3. Commit batch update
      await batch.commit();
      console.log(`✅ ${count} demande(s) marquée(s) comme expirée(s)`);
      
      // 4. Créer notifications (batch séparé pour éviter limite 500)
      if (notifications.length > 0) {
        const notifBatch = db.batch();
        notifications.forEach(notif => {
          const notifRef = db.collection('notifications').doc();
          notifBatch.set(notifRef, notif);
        });
        await notifBatch.commit();
        console.log(`📧 ${notifications.length} notification(s) envoyée(s)`);
      }
      
      console.log('✨ Expiration demandes terminée avec succès');
      
      return {
        success: true,
        demandesExpirees: count,
        notificationsEnvoyees: notifications.length
      };
      
    } catch (error) {
      console.error('❌ Erreur expiration demandes:', error);
      
      // Ne pas faire échouer la fonction, logger seulement
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue'
      };
    }
  });

/**
 * Alerte 24h avant expiration (optionnel - Phase 2)
 * Exécution : Tous les jours à 9h du matin
 */
export const alerterDemandesProchesExpiration = functions
  .runWith({
    timeoutSeconds: 300,
    memory: '256MB'
  })
  .pubsub
  .schedule('every day 09:00')
  .timeZone('Europe/Paris')
  .onRun(async (context) => {
    const db = admin.firestore();
    const now = new Date();
    const demain = new Date(now);
    demain.setDate(demain.getDate() + 1);
    demain.setHours(23, 59, 59, 999);
    
    console.log('⏰ Début alerte demandes proches expiration...');
    
    try {
      // Demandes qui expirent dans les 24h
      const snapshot = await db.collection('demandes')
        .where('statut', '==', 'publiee')
        .where('dateExpiration', '>', admin.firestore.Timestamp.now())
        .where('dateExpiration', '<', admin.firestore.Timestamp.fromDate(demain))
        .limit(100)
        .get();
      
      console.log(`📊 ${snapshot.size} demande(s) expire(nt) dans 24h`);
      
      if (snapshot.empty) {
        console.log('✅ Aucune alerte à envoyer');
        return null;
      }
      
      const batch = db.batch();
      let alertCount = 0;
      
      for (const docSnap of snapshot.docs) {
        const demande = docSnap.data() as Demande;
        
        // Alerter uniquement si aucun devis reçu
        if ((demande.devisRecus || 0) === 0) {
          const notifRef = db.collection('notifications').doc();
          batch.set(notifRef, {
            recipientId: demande.clientId,
            type: 'demande_proche_expiration',
            title: '⏰ Votre demande expire bientôt',
            message: `Votre demande "${demande.titre}" expire dans 24h. Aucun devis reçu pour le moment.`,
            relatedId: docSnap.id,
            isRead: false,
            createdAt: admin.firestore.Timestamp.now()
          });
          alertCount++;
          
          console.log(`⏰ Alerte envoyée pour demande: ${demande.titre}`);
        }
      }
      
      if (alertCount > 0) {
        await batch.commit();
        console.log(`✅ ${alertCount} alerte(s) envoyée(s)`);
      }
      
      return {
        success: true,
        alertesEnvoyees: alertCount
      };
      
    } catch (error) {
      console.error('❌ Erreur alerte demandes:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue'
      };
    }
  });
