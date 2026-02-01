/**
 * Cloud Function : Rappel automatique devis non répondus
 * 
 * Exécution : Tous les jours à 9h (Europe/Paris)
 * 
 * Logique :
 * - -7 jours avant dateDebutPrevue : Rappel 1 (🔔 Info)
 * - -3 jours avant dateDebutPrevue : Rappel 2 (⚠️ Urgent)
 * - 0 jour (date dépassée) : Expiration automatique (❌ Finale)
 * 
 * Statuts concernés : 'envoye' uniquement (devis non répondus)
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

const db = admin.firestore();

/**
 * Fonction principale : Rappeler les clients sur les devis non répondus
 */
export const rappellerDevisNonRepondus = functions
  .region('europe-west1')
  .pubsub.schedule('0 9 * * *') // Tous les jours à 9h
  .timeZone('Europe/Paris')
  .onRun(async (context) => {
    console.log('🔔 Démarrage rappel devis non répondus...');
    
    const aujourdHui = new Date();
    aujourdHui.setHours(0, 0, 0, 0); // Minuit pour comparaison
    
    try {
      // Récupérer tous les devis 'envoye' (non répondus)
      const devisSnapshot = await db
        .collection('devis')
        .where('statut', '==', 'envoye')
        .get();
      
      if (devisSnapshot.empty) {
        console.log('✅ Aucun devis non répondu');
        return null;
      }
      
      console.log(`📊 ${devisSnapshot.size} devis non répondu(s) à vérifier`);
      
      let rappel7Jours = 0;
      let rappel3Jours = 0;
      let expires = 0;
      
      // Traiter chaque devis
      for (const docSnap of devisSnapshot.docs) {
        const devis = docSnap.data();
        const devisId = docSnap.id;
        
        // Vérifier que dateDebutPrevue existe
        if (!devis.dateDebutPrevue) {
          console.warn(`⚠️ Devis ${devisId} sans dateDebutPrevue - ignoré`);
          continue;
        }
        
        const dateDebut = devis.dateDebutPrevue.toDate();
        dateDebut.setHours(0, 0, 0, 0);
        
        // Calculer les jours restants
        const diffTime = dateDebut.getTime() - aujourdHui.getTime();
        const joursRestants = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        console.log(`📅 Devis ${devisId} : ${joursRestants} jour(s) avant début travaux`);
        
        // RAPPEL 1 : -7 jours (une semaine avant)
        if (joursRestants === 7) {
          await envoyerRappel7Jours(devisId, devis);
          rappel7Jours++;
        }
        
        // RAPPEL 2 : -3 jours (urgent)
        else if (joursRestants === 3) {
          await envoyerRappel3Jours(devisId, devis);
          rappel3Jours++;
        }
        
        // EXPIRATION : Date dépassée (0 ou négatif)
        else if (joursRestants <= 0) {
          await expirerDevisDateDepassee(devisId, devis);
          expires++;
        }
      }
      
      console.log('✅ Rappels terminés :');
      console.log(`   - 🔔 Rappels -7 jours : ${rappel7Jours}`);
      console.log(`   - ⚠️ Rappels -3 jours : ${rappel3Jours}`);
      console.log(`   - ❌ Devis expirés : ${expires}`);
      
      return {
        success: true,
        rappel7Jours,
        rappel3Jours,
        expires,
      };
      
    } catch (error) {
      console.error('❌ Erreur rappel devis :', error);
      throw error;
    }
  });

/**
 * Rappel -7 jours : Information
 */
async function envoyerRappel7Jours(devisId: string, devis: any): Promise<void> {
  console.log(`🔔 Rappel -7j : Devis ${devisId}`);
  
  const dateDebut = devis.dateDebutPrevue.toDate().toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
  
  // Créer notification client
  await db.collection('notifications').add({
    recipientId: devis.clientId,
    type: 'rappel_devis_7j',
    title: '🔔 Rappel : Répondez au devis',
    message: `Début des travaux prévu le ${dateDebut} (dans 7 jours). Vous devez répondre avant cette date : Accepter, Refuser ou Proposer une nouvelle date.`,
    relatedId: devisId,
    relatedType: 'devis',
    isRead: false,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  
  // Mettre à jour le devis avec date de rappel
  await db.collection('devis').doc(devisId).update({
    'rappels.rappel7JoursEnvoye': admin.firestore.FieldValue.serverTimestamp(),
  });
  
  console.log(`✅ Notification -7j envoyée à ${devis.clientId}`);
}

/**
 * Rappel -3 jours : Urgent
 */
async function envoyerRappel3Jours(devisId: string, devis: any): Promise<void> {
  console.log(`⚠️ Rappel -3j : Devis ${devisId}`);
  
  const dateDebut = devis.dateDebutPrevue.toDate().toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
  
  // Créer notification client (URGENTE)
  await db.collection('notifications').add({
    recipientId: devis.clientId,
    type: 'rappel_devis_3j',
    title: '⚠️ URGENT : Devis expire dans 3 jours',
    message: `Début des travaux : ${dateDebut}. Si vous ne répondez pas, le devis sera automatiquement annulé. Répondez maintenant !`,
    relatedId: devisId,
    relatedType: 'devis',
    isRead: false,
    priority: 'urgent',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  
  // Mettre à jour le devis
  await db.collection('devis').doc(devisId).update({
    'rappels.rappel3JoursEnvoye': admin.firestore.FieldValue.serverTimestamp(),
  });
  
  console.log(`✅ Notification urgente -3j envoyée à ${devis.clientId}`);
}

/**
 * Expiration automatique : Date de début dépassée
 */
async function expirerDevisDateDepassee(devisId: string, devis: any): Promise<void> {
  console.log(`❌ Expiration : Devis ${devisId} (date dépassée)`);
  
  const dateDebut = devis.dateDebutPrevue.toDate().toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
  
  // Mettre à jour le statut du devis
  await db.collection('devis').doc(devisId).update({
    statut: 'expire',
    motifExpiration: 'date_debut_depassee',
    dateExpiration: admin.firestore.FieldValue.serverTimestamp(),
    historiqueStatuts: admin.firestore.FieldValue.arrayUnion({
      statut: 'expire',
      date: admin.firestore.FieldValue.serverTimestamp(),
      commentaire: `Date de début dépassée (${dateDebut}) sans réponse client - Expiration automatique`,
    }),
  });
  
  // Notification client
  await db.collection('notifications').add({
    recipientId: devis.clientId,
    type: 'devis_expire_date',
    title: '❌ Devis expiré - Date de début dépassée',
    message: `Le devis n°${devis.numeroDevis} a été automatiquement annulé car la date de début des travaux (${dateDebut}) est dépassée sans réponse. Contactez l'artisan pour un nouveau devis.`,
    relatedId: devisId,
    relatedType: 'devis',
    isRead: false,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  
  // Notification artisan
  await db.collection('notifications').add({
    recipientId: devis.artisanId,
    type: 'devis_expire_date',
    title: '❌ Devis expiré - Client n\'a pas répondu',
    message: `Devis n°${devis.numeroDevis} : Le client n'a pas répondu avant la date de début prévue (${dateDebut}). Le devis a été automatiquement annulé.`,
    relatedId: devisId,
    relatedType: 'devis',
    isRead: false,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  
  console.log(`✅ Devis ${devisId} expiré - Notifications envoyées`);
}
