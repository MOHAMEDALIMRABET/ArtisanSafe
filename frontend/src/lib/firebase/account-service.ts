/**
 * Service de gestion des comptes utilisateurs (Admin)
 * ArtisanSafe - Gestion comptes artisans et clients
 */

import { doc, updateDoc, deleteDoc, setDoc, Timestamp, getDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { db, auth } from './config';
import { deleteUser } from 'firebase/auth';
import { sendDeletionConfirmationEmail, sendSuspensionEmail, sendReactivationEmail } from './email-notification-service';

// ============================================
// TYPES
// ============================================

export interface AdminNote {
  id: string;
  adminId: string;
  adminName: string;
  note: string;
  createdAt: Timestamp;
}

export interface AccountAction {
  action: 'suspension' | 'reactivation' | 'deletion' | 'modification';
  adminId: string;
  adminName: string;
  reason?: string;
  timestamp: Timestamp;
}

// ============================================
// ANONYMISATION DES DONNÉES
// ============================================

/**
 * Anonymiser tous les avis publiés par un utilisateur
 * Utilisé lors de la suppression d'un compte (RGPD)
 */
async function anonymizeUserReviews(userId: string): Promise<void> {
  try {
    const avisRef = collection(db, 'avis');
    const q = query(avisRef, where('auteurId', '==', userId));
    const querySnapshot = await getDocs(q);

    const anonymizePromises = querySnapshot.docs.map(async (avisDoc) => {
      await updateDoc(avisDoc.ref, {
        auteurNom: '[Compte supprimé]',
        auteurEmail: null,
        auteurId: null,
        anonymized: true,
        anonymizedAt: Timestamp.now()
      });
    });

    await Promise.all(anonymizePromises);
    console.log(`✅ ${querySnapshot.size} avis anonymisés pour userId ${userId}`);
  } catch (error) {
    console.error('Erreur anonymisation avis:', error);
    throw error;
  }
}

// ============================================
// SUSPENSION / RÉACTIVATION
// ============================================

/**
 * Suspendre un compte artisan
 */
export async function suspendArtisan(
  userId: string,
  reason: string,
  adminId: string,
  adminName: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const artisanRef = doc(db, 'artisans', userId);
    
    // Récupérer les infos utilisateur pour l'email
    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);
    
    await updateDoc(artisanRef, {
      suspended: true,
      suspendedAt: Timestamp.now(),
      suspendedBy: adminId,
      suspensionReason: reason,
      'accountHistory': {
        action: 'suspension',
        adminId,
        adminName,
        reason,
        timestamp: Timestamp.now()
      }
    });

    // Envoyer email de notification
    if (userSnap.exists()) {
      const userData = userSnap.data();
      const userName = `${userData.prenom} ${userData.nom}`;
      await sendSuspensionEmail(userData.email, userName, reason);
    }

    return { success: true };
  } catch (error) {
    console.error('Erreur suspension artisan:', error);
    return { success: false, error: 'Erreur lors de la suspension' };
  }
}

/**
 * Réactiver un compte artisan suspendu
 */
export async function reactivateArtisan(
  userId: string,
  adminId: string,
  adminName: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const artisanRef = doc(db, 'artisans', userId);
    
    // Récupérer les infos utilisateur pour l'email
    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);
    
    await updateDoc(artisanRef, {
      suspended: false,
      suspendedAt: null,
      suspendedBy: null,
      suspensionReason: null,
      reactivatedAt: Timestamp.now(),
      reactivatedBy: adminId,
      'accountHistory': {
        action: 'reactivation',
        adminId,
        adminName,
        timestamp: Timestamp.now()
      }
    });

    // Envoyer email de notification
    if (userSnap.exists()) {
      const userData = userSnap.data();
      const userName = `${userData.prenom} ${userData.nom}`;
      await sendReactivationEmail(userData.email, userName);
    }

    return { success: true };
  } catch (error) {
    console.error('Erreur réactivation artisan:', error);
    return { success: false, error: 'Erreur lors de la réactivation' };
  }
}

/**
 * Suspendre un compte client
 */
export async function suspendClient(
  userId: string,
  reason: string,
  adminId: string,
  adminName: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);
    
    await updateDoc(userRef, {
      suspended: true,
      suspendedAt: Timestamp.now(),
      suspendedBy: adminId,
      suspensionReason: reason,
      'accountHistory': {
        action: 'suspension',
        adminId,
        adminName,
        reason,
        timestamp: Timestamp.now()
      }
    });

    // Envoyer email de notification
    if (userSnap.exists()) {
      const userData = userSnap.data();
      const userName = `${userData.prenom} ${userData.nom}`;
      await sendSuspensionEmail(userData.email, userName, reason);
    }

    return { success: true };
  } catch (error) {
    console.error('Erreur suspension client:', error);
    return { success: false, error: 'Erreur lors de la suspension' };
  }
}

/**
 * Réactiver un compte client suspendu
 */
export async function reactivateClient(
  userId: string,
  adminId: string,
  adminName: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);
    
    await updateDoc(userRef, {
      suspended: false,
      suspendedAt: null,
      suspendedBy: null,
      suspensionReason: null,
      reactivatedAt: Timestamp.now(),
      reactivatedBy: adminId,
      'accountHistory': {
        action: 'reactivation',
        adminId,
        adminName,
        timestamp: Timestamp.now()
      }
    });

    // Envoyer email de notification
    if (userSnap.exists()) {
      const userData = userSnap.data();
      const userName = `${userData.prenom} ${userData.nom}`;
      await sendReactivationEmail(userData.email, userName);
    }

    return { success: true };
  } catch (error) {
    console.error('Erreur réactivation client:', error);
    return { success: false, error: 'Erreur lors de la réactivation' };
  }
}

// ============================================
// SUPPRESSION RGPD
// ============================================

/**
 * Supprimer définitivement un compte artisan (RGPD)
 */
export async function deleteArtisanAccount(
  userId: string,
  adminId: string,
  adminName: string,
  reason: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // 1. Récupérer les données avant suppression
    const artisanRef = doc(db, 'artisans', userId);
    const artisanSnap = await getDoc(artisanRef);
    
    if (!artisanSnap.exists()) {
      return { success: false, error: 'Artisan non trouvé' };
    }

    const artisanData = artisanSnap.data();
    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);
    
    if (!userSnap.exists()) {
      return { success: false, error: 'Utilisateur non trouvé' };
    }

    const userData = userSnap.data();
    const userEmail = userData.email;
    const userName = `${userData.prenom} ${userData.nom}`;

    // 2. Anonymiser les avis publiés par cet artisan
    await anonymizeUserReviews(userId);

    // 3. Créer un enregistrement d'archive (anonymisé)
    const archiveRef = doc(collection(db, 'deleted_accounts'), userId);
    const archiveData: any = {
      type: 'artisan',
      deletedAt: Timestamp.now(),
      deletedBy: adminId,
      deletedByName: adminName,
      reason
    };

    // Ajouter seulement les données statistiques qui existent
    if (artisanData.siret) archiveData.siret = artisanData.siret;
    if (artisanData.dateInscription) archiveData.dateInscription = artisanData.dateInscription;
    if (artisanData.metiers) archiveData.metiers = artisanData.metiers;

    await setDoc(archiveRef, archiveData);

    // 4. Supprimer les documents Firestore
    await deleteDoc(artisanRef);
    await deleteDoc(userRef);

    // 5. Envoyer l'email de confirmation
    await sendDeletionConfirmationEmail(userEmail, userName, reason);

    // 6. Supprimer le compte Firebase Auth via l'API backend
    try {
      const response = await fetch(`http://localhost:5000/api/v1/auth/users/${userId}`, {
        method: 'DELETE'
      });
      
      if (response.ok) {
        console.log(`✅ Compte Firebase Auth supprimé pour ${userId}`);
      } else {
        console.warn(`⚠️ Erreur suppression Auth pour ${userId}:`, await response.text());
      }
    } catch (authError) {
      console.error('Erreur suppression Firebase Auth:', authError);
      // Continue quand même, les données Firestore sont déjà supprimées
    }

    console.log(`✅ Compte artisan ${userId} supprimé définitivement`);

    return { success: true };
  } catch (error) {
    console.error('Erreur suppression artisan:', error);
    return { success: false, error: 'Erreur lors de la suppression' };
  }
}

/**
 * Supprimer définitivement un compte client (RGPD)
 */
export async function deleteClientAccount(
  userId: string,
  adminId: string,
  adminName: string,
  reason: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // 1. Récupérer les données avant suppression
    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);
    
    if (!userSnap.exists()) {
      return { success: false, error: 'Client non trouvé' };
    }

    const userData = userSnap.data();
    const userEmail = userData.email;
    const userName = `${userData.prenom} ${userData.nom}`;

    // 2. Anonymiser les avis publiés par ce client
    await anonymizeUserReviews(userId);

    // 3. Créer archive
    const archiveRef = doc(collection(db, 'deleted_accounts'), userId);
    const archiveData: any = {
      type: 'client',
      deletedAt: Timestamp.now(),
      deletedBy: adminId,
      deletedByName: adminName,
      reason
    };

    // Ajouter seulement les données qui existent
    if (userData.dateInscription) archiveData.dateInscription = userData.dateInscription;

    await setDoc(archiveRef, archiveData);

    // 4. Supprimer le compte Firestore
    await deleteDoc(userRef);

    // 5. Envoyer l'email de confirmation
    await sendDeletionConfirmationEmail(userEmail, userName, reason);

    // 6. Supprimer le compte Firebase Auth via l'API backend
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';
      const response = await fetch(`${apiUrl}/auth/users/${userId}`, {
        method: 'DELETE'
      });
      
      if (response.ok) {
        console.log(`✅ Compte Firebase Auth supprimé pour ${userId}`);
      } else {
        console.warn(`⚠️ Erreur suppression Auth pour ${userId}:`, await response.text());
      }
    } catch (authError) {
      console.error('Erreur suppression Firebase Auth:', authError);
      // Continue quand même, les données Firestore sont déjà supprimées
    }

    console.log(`✅ Compte client ${userId} supprimé définitivement`);

    return { success: true };
  } catch (error) {
    console.error('Erreur suppression client:', error);
    return { success: false, error: 'Erreur lors de la suppression' };
  }
}

// ============================================
// SUPPRESSION PROGRAMMÉE (WORKFLOW AVEC PÉRIODE DE RECOURS)
// ============================================

/**
 * Programmer une suppression de compte avec période de recours (15 jours)
 * Utilisé pour respecter les obligations RGPD et donner un délai de contestation
 */
export async function scheduleAccountDeletion(
  userId: string,
  accountType: 'artisan' | 'client',
  reason: string,
  adminId: string,
  adminName: string,
  recoursPeriodDays: number = 15
): Promise<{ success: boolean; error?: string }> {
  try {
    const deletionDate = new Date();
    deletionDate.setDate(deletionDate.getDate() + recoursPeriodDays);

    // 1. Récupérer les infos utilisateur
    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);
    
    if (!userSnap.exists()) {
      return { success: false, error: 'Utilisateur non trouvé' };
    }

    const userData = userSnap.data();
    const userEmail = userData.email;
    const userName = `${userData.prenom} ${userData.nom}`;

    // 2. Créer un document de suppression programmée
    const scheduledDeletionRef = doc(collection(db, 'scheduled_deletions'), userId);
    await setDoc(scheduledDeletionRef, {
      userId,
      accountType,
      reason,
      adminId,
      adminName,
      scheduledAt: Timestamp.now(),
      deletionDate: Timestamp.fromDate(deletionDate),
      status: 'scheduled',
      userEmail,
      userName
    });

    // 3. Suspendre immédiatement le compte
    if (accountType === 'artisan') {
      await suspendArtisan(userId, `Compte programmé pour suppression le ${deletionDate.toLocaleDateString('fr-FR')}`, adminId, adminName);
    } else {
      await suspendClient(userId, `Compte programmé pour suppression le ${deletionDate.toLocaleDateString('fr-FR')}`, adminId, adminName);
    }

    // 4. Envoyer l'email d'avertissement (depuis email-notification-service)
    const { sendDeletionWarningEmail } = await import('./email-notification-service');
    await sendDeletionWarningEmail(userEmail, userName, reason, deletionDate);

    console.log(`✅ Suppression programmée pour ${userName} (${userEmail}) le ${deletionDate.toLocaleDateString('fr-FR')}`);

    return { success: true };
  } catch (error) {
    console.error('Erreur programmation suppression:', error);
    return { success: false, error: 'Erreur lors de la programmation de la suppression' };
  }
}

/**
 * Annuler une suppression programmée (en cas de contestation acceptée)
 */
export async function cancelScheduledDeletion(
  userId: string,
  adminId: string,
  adminName: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // 1. Récupérer le document de suppression programmée
    const scheduledDeletionRef = doc(db, 'scheduled_deletions', userId);
    const scheduledDeletionSnap = await getDoc(scheduledDeletionRef);
    
    if (!scheduledDeletionSnap.exists()) {
      return { success: false, error: 'Aucune suppression programmée trouvée' };
    }

    const scheduledData = scheduledDeletionSnap.data();

    // 2. Marquer comme annulée
    await updateDoc(scheduledDeletionRef, {
      status: 'cancelled',
      cancelledAt: Timestamp.now(),
      cancelledBy: adminId,
      cancelledByName: adminName
    });

    // 3. Réactiver le compte
    if (scheduledData.accountType === 'artisan') {
      await reactivateArtisan(userId, adminId, adminName);
    } else {
      await reactivateClient(userId, adminId, adminName);
    }

    console.log(`✅ Suppression annulée pour userId ${userId}`);

    return { success: true };
  } catch (error) {
    console.error('Erreur annulation suppression:', error);
    return { success: false, error: 'Erreur lors de l\'annulation de la suppression' };
  }
}

/**
 * Exécuter les suppressions programmées arrivées à échéance
 * (À appeler via Cloud Function quotidiennement)
 */
export async function executePendingDeletions(): Promise<{ 
  success: boolean; 
  deletedCount: number; 
  errors: string[] 
}> {
  try {
    const now = Timestamp.now();
    const scheduledDeletionsRef = collection(db, 'scheduled_deletions');
    const q = query(
      scheduledDeletionsRef,
      where('status', '==', 'scheduled'),
      where('deletionDate', '<=', now)
    );

    const querySnapshot = await getDocs(q);
    const errors: string[] = [];
    let deletedCount = 0;

    for (const docSnap of querySnapshot.docs) {
      const scheduledData = docSnap.data();
      
      try {
        // Exécuter la suppression
        if (scheduledData.accountType === 'artisan') {
          await deleteArtisanAccount(
            scheduledData.userId,
            scheduledData.adminId,
            scheduledData.adminName,
            scheduledData.reason
          );
        } else {
          await deleteClientAccount(
            scheduledData.userId,
            scheduledData.adminId,
            scheduledData.adminName,
            scheduledData.reason
          );
        }

        // Marquer comme exécutée
        await updateDoc(docSnap.ref, {
          status: 'executed',
          executedAt: Timestamp.now()
        });

        deletedCount++;
      } catch (error) {
        errors.push(`Erreur suppression ${scheduledData.userId}: ${error}`);
        console.error(`Erreur suppression ${scheduledData.userId}:`, error);
      }
    }

    console.log(`✅ ${deletedCount} suppressions exécutées`);

    return { success: true, deletedCount, errors };
  } catch (error) {
    console.error('Erreur exécution suppressions programmées:', error);
    return { success: false, deletedCount: 0, errors: [String(error)] };
  }
}

// ============================================
// NOTES ADMIN PRIVÉES
// ============================================

/**
 * Ajouter une note admin privée sur un artisan
 */
export async function addAdminNoteArtisan(
  userId: string,
  note: string,
  adminId: string,
  adminName: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const artisanRef = doc(db, 'artisans', userId);
    const artisanSnap = await getDoc(artisanRef);
    
    if (!artisanSnap.exists()) {
      return { success: false, error: 'Artisan non trouvé' };
    }

    const currentNotes = artisanSnap.data().adminNotes || [];
    
    const newNote: AdminNote = {
      id: `note_${Date.now()}`,
      adminId,
      adminName,
      note,
      createdAt: Timestamp.now()
    };

    await updateDoc(artisanRef, {
      adminNotes: [...currentNotes, newNote]
    });

    return { success: true };
  } catch (error) {
    console.error('Erreur ajout note:', error);
    return { success: false, error: 'Erreur lors de l\'ajout de la note' };
  }
}

/**
 * Ajouter une note admin privée sur un client
 */
export async function addAdminNoteClient(
  userId: string,
  note: string,
  adminId: string,
  adminName: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);
    
    if (!userSnap.exists()) {
      return { success: false, error: 'Client non trouvé' };
    }

    const currentNotes = userSnap.data().adminNotes || [];
    
    const newNote: AdminNote = {
      id: `note_${Date.now()}`,
      adminId,
      adminName,
      note,
      createdAt: Timestamp.now()
    };

    await updateDoc(userRef, {
      adminNotes: [...currentNotes, newNote]
    });

    return { success: true };
  } catch (error) {
    console.error('Erreur ajout note:', error);
    return { success: false, error: 'Erreur lors de l\'ajout de la note' };
  }
}

// ============================================
// RÉCUPÉRATION LISTE CLIENTS
// ============================================

/**
 * Récupérer tous les clients pour l'admin
 */
export async function getAllClientsForAdmin() {
  try {
    const usersQuery = query(
      collection(db, 'users'),
      where('role', '==', 'client')
    );
    
    const snapshot = await getDocs(usersQuery);
    const clients = snapshot.docs.map(doc => ({
      userId: doc.id,
      ...doc.data()
    }));

    return clients;
  } catch (error) {
    console.error('Erreur récupération clients:', error);
    return [];
  }
}
