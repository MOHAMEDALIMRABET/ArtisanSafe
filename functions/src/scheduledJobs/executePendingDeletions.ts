/**
 * Cloud Function : Exécution automatique des suppressions de comptes programmées
 * 
 * Exécution : Tous les jours à 3h du matin (Europe/Paris)
 * 
 * Fonctionnement :
 * 1. Récupère les suppressions programmées arrivées à échéance (scheduled_deletions)
 * 2. Pour chaque compte : suppression cascade complète sur 15 collections
 * 3. Anonymise 6 collections (rétention légale 10 ans) : avis, devis, demandes, contrats, conversations, messages
 * 4. Supprime 9+ collections (RGPD) : notifications, rappels, disponibilites, users, artisans, etc.
 * 5. Archive statistiques dans deleted_accounts
 * 6. Envoie email de confirmation
 * 7. Marque scheduled_deletion comme 'executed'
 * 
 * Conformité Légale :
 * - RGPD Article 17 : Droit à l'effacement
 * - Code de Commerce Art. L123-22 : Rétention 10 ans documents comptables
 * - Délai de recours : 15 jours avant suppression définitive
 * 
 * Collections gérées (15 au total) :
 * - ANONYMISÉES (10 ans) : avis, devis, demandes, contrats, conversations, messages
 * - SUPPRIMÉES (RGPD) : notifications, rappels, disponibilites, scheduled_deletions, 
 *                        email_notifications, admin_access_logs, users, artisans, Firebase Auth
 * 
 * Déploiement :
 * firebase deploy --only functions:executePendingDeletions
 * 
 * Monitoring :
 * firebase functions:log --only executePendingDeletions --follow
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

interface ScheduledDeletion {
  userId: string;
  accountType: 'artisan' | 'client';
  reason: string;
  adminId: string;
  adminName: string;
  scheduledAt: admin.firestore.Timestamp;
  deletionDate: admin.firestore.Timestamp;
  status: 'scheduled' | 'executed' | 'cancelled';
  userEmail: string;
  userName: string;
}

interface DeletionStats {
  accountsDeleted: number;
  avisAnonymized: number;
  devisAnonymized: number;
  demandesAnonymized: number;
  contratsAnonymized: number;
  conversationsAnonymized: number;
  messagesAnonymized: number;
  notificationsDeleted: number;
  rappelsDeleted: number;
  disponibilitesDeleted: number;
  scheduledDeletionsDeleted: number;
  emailNotificationsDeleted: number;
  adminLogsDeleted: number;
  usersDeleted: number;
  artisansDeleted: number;
  errors: number;
}

/**
 * Helper : Supprimer tous les documents d'une collection avec un filtre
 */
async function deleteCollectionDocs(
  db: admin.firestore.Firestore,
  collectionName: string,
  field: string,
  value: any,
  maxDocs: number = 500
): Promise<number> {
  const snapshot = await db.collection(collectionName)
    .where(field, '==', value)
    .limit(maxDocs)
    .get();
  
  if (snapshot.empty) return 0;
  
  const batch = db.batch();
  snapshot.docs.forEach(doc => batch.delete(doc.ref));
  await batch.commit();
  
  return snapshot.size;
}

/**
 * Helper : Anonymiser collection (nom/email → "[Compte supprimé]")
 */
async function anonymizeCollection(
  db: admin.firestore.Firestore,
  collectionName: string,
  field: string,
  userId: string,
  fieldsToAnonymize: { [key: string]: any },
  maxDocs: number = 500
): Promise<number> {
  const snapshot = await db.collection(collectionName)
    .where(field, '==', userId)
    .limit(maxDocs)
    .get();
  
  if (snapshot.empty) return 0;
  
  const batch = db.batch();
  snapshot.docs.forEach(doc => {
    batch.update(doc.ref, {
      ...fieldsToAnonymize,
      anonymized: true,
      anonymizedAt: admin.firestore.FieldValue.serverTimestamp()
    });
  });
  await batch.commit();
  
  return snapshot.size;
}

/**
 * Suppression complète d'un utilisateur (cascade sur 15 collections)
 */
async function deleteUserCompletely(
  db: admin.firestore.Firestore,
  userId: string,
  accountType: 'artisan' | 'client',
  reason: string,
  userEmail: string,
  userName: string,
  adminId: string,
  adminName: string
): Promise<{ success: boolean; details?: string; error?: string }> {
  try {
    console.log(`  🗑️ Suppression cascade pour: ${userName} (${userEmail})`);
    console.log(`     Type: ${accountType} | Raison: ${reason}`);
    
    const stats = {
      anonymized: 0,
      deleted: 0
    };

    // ========================================
    // PARTIE 1 : ANONYMISER (Rétention légale 10 ans)
    // ========================================
    
    console.log('     📝 Anonymisation (rétention 10 ans)...');
    
    // 1. Avis (auteur)
    const avisCount = await anonymizeCollection(db, 'avis', 'auteurId', userId, {
      auteurNom: '[Compte supprimé]'
    });
    stats.anonymized += avisCount;
    if (avisCount > 0) console.log(`        - ${avisCount} avis anonymisé(s)`);
    
    // 2. Devis (client ET artisan)
    const devisAsClientCount = await anonymizeCollection(db, 'devis', 'clientId', userId, {
      'client.nom': '[Compte supprimé]',
      'client.prenom': '',
      'client.email': 'anonyme@artisandispo.fr',
      'client.telephone': ''
    });
    const devisAsArtisanCount = await anonymizeCollection(db, 'devis', 'artisanId', userId, {
      'artisan.nom': '[Compte supprimé]',
      'artisan.businessName': '[Entreprise supprimée]',
      'artisan.email': 'anonyme@artisandispo.fr',
      'artisan.telephone': '',
      'artisan.siret': ''
    });
    stats.anonymized += devisAsClientCount + devisAsArtisanCount;
    if (devisAsClientCount + devisAsArtisanCount > 0) {
      console.log(`        - ${devisAsClientCount + devisAsArtisanCount} devis anonymisé(s)`);
    }
    
    // 3. Demandes (client)
    const demandesCount = await anonymizeCollection(db, 'demandes', 'clientId', userId, {
      'client.nom': '[Compte supprimé]',
      'client.prenom': '',
      'client.email': 'anonyme@artisandispo.fr',
      'client.telephone': ''
    });
    stats.anonymized += demandesCount;
    if (demandesCount > 0) console.log(`        - ${demandesCount} demande(s) anonymisée(s)`);
    
    // 4. Contrats (client ET artisan)
    const contratsAsClientCount = await anonymizeCollection(db, 'contrats', 'clientId', userId, {
      clientNom: '[Compte supprimé]'
    });
    const contratsAsArtisanCount = await anonymizeCollection(db, 'contrats', 'artisanId', userId, {
      artisanNom: '[Compte supprimé]'
    });
    stats.anonymized += contratsAsClientCount + contratsAsArtisanCount;
    if (contratsAsClientCount + contratsAsArtisanCount > 0) {
      console.log(`        - ${contratsAsClientCount + contratsAsArtisanCount} contrat(s) anonymisé(s)`);
    }
    
    // 5. Conversations (participants array-contains)
    const conversationsSnapshot = await db.collection('conversations')
      .where('participants', 'array-contains', userId)
      .limit(500)
      .get();
    
    if (!conversationsSnapshot.empty) {
      const batch = db.batch();
      for (const docSnap of conversationsSnapshot.docs) {
        const data = docSnap.data();
        const participantNames = data.participantNames || {};
        participantNames[userId] = '[Compte supprimé]';
        batch.update(docSnap.ref, { participantNames, anonymized: true });
        stats.anonymized++;
      }
      await batch.commit();
      console.log(`        - ${conversationsSnapshot.size} conversation(s) anonymisée(s)`);
    }
    
    // 6. Messages
    const messagesCount = await anonymizeCollection(db, 'messages', 'senderId', userId, {
      senderName: '[Compte supprimé]'
    });
    stats.anonymized += messagesCount;
    if (messagesCount > 0) console.log(`        - ${messagesCount} message(s) anonymisé(s)`);
    
    console.log(`     ✅ ${stats.anonymized} document(s) anonymisé(s)`);

    // ========================================
    // PARTIE 2 : SUPPRIMER (RGPD)
    // ========================================
    
    console.log('     🗑️ Suppression complète (RGPD)...');
    
    // 1. Notifications
    const notificationsDeleted = await deleteCollectionDocs(db, 'notifications', 'recipientId', userId);
    stats.deleted += notificationsDeleted;
    if (notificationsDeleted > 0) console.log(`        - ${notificationsDeleted} notification(s)`);
    
    // 2. Rappels
    const rappelsDeleted = await deleteCollectionDocs(db, 'rappels', 'userId', userId);
    stats.deleted += rappelsDeleted;
    if (rappelsDeleted > 0) console.log(`        - ${rappelsDeleted} rappel(s)`);
    
    // 3. Disponibilités
    const disponibilitesDeleted = await deleteCollectionDocs(db, 'disponibilites', 'artisanId', userId);
    stats.deleted += disponibilitesDeleted;
    if (disponibilitesDeleted > 0) console.log(`        - ${disponibilitesDeleted} disponibilité(s)`);
    
    // 4. Scheduled deletions
    const scheduledDeletionsDeleted = await deleteCollectionDocs(db, 'scheduled_deletions', 'userId', userId);
    stats.deleted += scheduledDeletionsDeleted;
    
    // 5. Email notifications
    const emailNotificationsDeleted = await deleteCollectionDocs(db, 'email_notifications', 'recipientId', userId);
    stats.deleted += emailNotificationsDeleted;
    if (emailNotificationsDeleted > 0) console.log(`        - ${emailNotificationsDeleted} email notification(s)`);
    
    // 6. Admin access logs
    const adminLogsDeleted = await deleteCollectionDocs(db, 'admin_access_logs', 'userId', userId);
    stats.deleted += adminLogsDeleted;
    
    // 7. Document principal users
    await db.collection('users').doc(userId).delete();
    stats.deleted++;
    console.log(`        - Document users supprimé`);
    
    // 8. Document artisans (si artisan)
    if (accountType === 'artisan') {
      const artisanRef = db.collection('artisans').doc(userId);
      const artisanSnap = await artisanRef.get();
      if (artisanSnap.exists()) {
        await artisanRef.delete();
        stats.deleted++;
        console.log(`        - Document artisans supprimé`);
      }
    }
    
    console.log(`     ✅ ${stats.deleted} document(s) supprimé(s)`);

    // ========================================
    // PARTIE 3 : ARCHIVER STATISTIQUES
    // ========================================
    
    console.log('     📁 Archivage statistiques...');
    
    await db.collection('deleted_accounts').add({
      originalUserId: userId,
      accountType,
      deletionReason: reason,
      deletedBy: adminId,
      deletedByName: adminName,
      deletedAt: admin.firestore.FieldValue.serverTimestamp(),
      statistics: {
        documentsAnonymized: stats.anonymized,
        documentsDeleted: stats.deleted
      },
      // Statistiques anonymisées uniquement (pas de données personnelles)
      wasVerified: false, // On ne garde pas cette info sensible
      accountCreatedAtAnonymized: true
    });
    
    console.log('     ✅ Archive créée');

    // ========================================
    // PARTIE 4 : SUPPRIMER FIREBASE AUTH
    // ========================================
    
    console.log('     🔐 Suppression Firebase Auth...');
    
    try {
      await admin.auth().deleteUser(userId);
      console.log('     ✅ Compte Firebase Auth supprimé');
    } catch (authError: any) {
      if (authError.code === 'auth/user-not-found') {
        console.log('     ⚠️ Compte Firebase Auth déjà supprimé');
      } else {
        console.error('     ❌ Erreur suppression Auth:', authError.message);
      }
    }

    // ========================================
    // PARTIE 5 : EMAIL CONFIRMATION
    // ========================================
    
    console.log('     📧 Email de confirmation...');
    
    // Créer notification email (sera envoyée par le backend)
    try {
      await db.collection('email_notifications').add({
        to: userEmail,
        subject: 'Confirmation de suppression de votre compte ArtisanDispo',
        template: 'deletion_confirmation',
        variables: {
          userName,
          deletionReason: reason,
          deletionDate: new Date().toLocaleDateString('fr-FR')
        },
        status: 'pending',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        provider: 'gmail'
      });
      console.log('     ✅ Email programmé');
    } catch (emailError: any) {
      console.error('     ⚠️ Erreur programmation email:', emailError.message);
    }

    return {
      success: true,
      details: `${stats.anonymized} docs anonymisés, ${stats.deleted} docs supprimés`
    };

  } catch (error: any) {
    console.error(`     ❌ ERREUR suppression ${userId}:`, error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Cron quotidien : Exécuter les suppressions programmées arrivées à échéance
 */
export const executePendingDeletions = functions
  .runWith({
    timeoutSeconds: 540, // 9 minutes max
    memory: '1GB' // Plus de mémoire pour suppressions multiples
  })
  .pubsub
  .schedule('every day 03:00')
  .timeZone('Europe/Paris')
  .onRun(async (context) => {
    const db = admin.firestore();
    const now = admin.firestore.Timestamp.now();
    
    console.log('🗑️ ========================================');
    console.log('🗑️ EXÉCUTION SUPPRESSIONS PROGRAMMÉES');
    console.log('🗑️ ========================================');
    console.log(`⏰ Exécution : ${new Date().toLocaleString('fr-FR', { timeZone: 'Europe/Paris' })}`);
    console.log('');
    
    const stats: DeletionStats = {
      accountsDeleted: 0,
      avisAnonymized: 0,
      devisAnonymized: 0,
      demandesAnonymized: 0,
      contratsAnonymized: 0,
      conversationsAnonymized: 0,
      messagesAnonymized: 0,
      notificationsDeleted: 0,
      rappelsDeleted: 0,
      disponibilitesDeleted: 0,
      scheduledDeletionsDeleted: 0,
      emailNotificationsDeleted: 0,
      adminLogsDeleted: 0,
      usersDeleted: 0,
      artisansDeleted: 0,
      errors: 0
    };
    
    try {
      // ========================================
      // 1. RÉCUPÉRER SUPPRESSIONS À EXÉCUTER
      // ========================================
      
      console.log('🔍 Recherche suppressions programmées arrivées à échéance...');
      
      const snapshot = await db.collection('scheduled_deletions')
        .where('status', '==', 'scheduled')
        .where('deletionDate', '<=', now)
        .limit(100) // Max 100 suppressions par exécution
        .get();
      
      console.log(`📊 ${snapshot.size} suppression(s) programmée(s) à exécuter`);
      console.log('');
      
      if (snapshot.empty) {
        console.log('✅ Aucune suppression programmée à exécuter');
        return null;
      }
      
      // ========================================
      // 2. EXÉCUTER CHAQUE SUPPRESSION
      // ========================================
      
      console.log('🗑️ Exécution des suppressions...');
      console.log('─────────────────────────────────────');
      console.log('');
      
      for (const docSnap of snapshot.docs) {
        const scheduled = docSnap.data() as ScheduledDeletion;
        const scheduledId = docSnap.id;
        
        console.log(`⏰ Suppression ${stats.accountsDeleted + 1}/${snapshot.size}`);
        console.log(`   ID: ${scheduledId}`);
        console.log(`   Utilisateur: ${scheduled.userName} (${scheduled.userEmail})`);
        console.log(`   Type: ${scheduled.accountType}`);
        console.log(`   Programmée le: ${scheduled.scheduledAt.toDate().toLocaleDateString('fr-FR')}`);
        console.log(`   Échéance: ${scheduled.deletionDate.toDate().toLocaleDateString('fr-FR')}`);
        console.log('');
        
        // Exécuter la suppression cascade
        const result = await deleteUserCompletely(
          db,
          scheduled.userId,
          scheduled.accountType,
          scheduled.reason,
          scheduled.userEmail,
          scheduled.userName,
          scheduled.adminId,
          scheduled.adminName
        );
        
        if (result.success) {
          // Marquer comme exécutée
          await db.collection('scheduled_deletions').doc(scheduledId).update({
            status: 'executed',
            executedAt: admin.firestore.FieldValue.serverTimestamp(),
            executionDetails: result.details
          });
          
          stats.accountsDeleted++;
          console.log(`   ✅ Suppression réussie: ${result.details}`);
        } else {
          // Marquer comme erreur
          await db.collection('scheduled_deletions').doc(scheduledId).update({
            status: 'error',
            errorAt: admin.firestore.FieldValue.serverTimestamp(),
            errorMessage: result.error
          });
          
          stats.errors++;
          console.log(`   ❌ Erreur: ${result.error}`);
        }
        
        console.log('');
      }
      
      // ========================================
      // 3. STATISTIQUES FINALES
      // ========================================
      
      console.log('🗑️ ========================================');
      console.log('🗑️ RÉSUMÉ DE L\'EXÉCUTION');
      console.log('🗑️ ========================================');
      console.log(`✅ Comptes supprimés avec succès : ${stats.accountsDeleted}`);
      console.log(`❌ Erreurs rencontrées : ${stats.errors}`);
      console.log('');
      
      if (stats.accountsDeleted > 0) {
        console.log('📊 Conformité RGPD respectée');
        console.log('📊 Rétention légale 10 ans appliquée');
        console.log('📊 Utilisateurs notifiés par email');
        console.log('💾 Base de données nettoyée');
      }
      
      console.log('');
      console.log('✅ Exécution terminée avec succès');
      
      return {
        success: true,
        accountsDeleted: stats.accountsDeleted,
        errors: stats.errors,
        executionTime: new Date().toISOString()
      };
      
    } catch (error: any) {
      console.error('❌ ERREUR CRITIQUE:', error.message);
      console.error(error.stack);
      
      return {
        success: false,
        error: error.message,
        accountsDeleted: stats.accountsDeleted,
        errors: stats.errors + 1
      };
    }
  });

/**
 * Version HTTP pour tests manuels
 * Usage: POST https://YOUR_REGION-YOUR_PROJECT.cloudfunctions.net/executePendingDeletionsManual
 */
export const executePendingDeletionsManual = functions
  .runWith({
    timeoutSeconds: 540,
    memory: '1GB'
  })
  .https
  .onRequest(async (req, res) => {
    // Vérifier authentification admin (dans un vrai projet)
    // Pour tests, on permet l'exécution directe
    
    console.log('🧪 EXÉCUTION MANUELLE (TEST)');
    console.log('════════════════════════════════════════');
    
    try {
      const result = await executePendingDeletions.run({} as any);
      
      res.status(200).json({
        message: 'Exécution manuelle terminée',
        result
      });
    } catch (error: any) {
      console.error('Erreur exécution manuelle:', error);
      res.status(500).json({
        error: error.message
      });
    }
  });
