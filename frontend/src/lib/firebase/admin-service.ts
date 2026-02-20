/**
 * Service de gestion admin pour la vérification des artisans
 * ArtisanDispo - Dashboard Admin
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  updateDoc,
  Timestamp,
  orderBy,
  limit,
  addDoc,
} from 'firebase/firestore';
import { db, auth } from './config';
import {
  Artisan,
  AdminVerificationRequest,
  AdminVerificationAction,
  AdminActionHistory,
  Admin,
  VerificationStatus,
} from '@/types/firestore';

// ============================================
// VÉRIFICATION DES PERMISSIONS ADMIN
// ============================================

/**
 * Vérifie si l'utilisateur connecté est admin
 */
export async function isAdmin(userId: string): Promise<boolean> {
  try {
    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      return false;
    }

    const userData = userSnap.data();
    return userData.role === 'admin';
  } catch (error) {
    console.error('Erreur vérification admin:', error);
    return false;
  }
}

/**
 * Récupère les données admin de l'utilisateur
 */
export async function getAdminData(userId: string): Promise<Admin | null> {
  try {
    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      return null;
    }

    const userData = userSnap.data() as Admin;
    
    if (userData.role !== 'admin') {
      return null;
    }

    return userData;
  } catch (error) {
    console.error('Erreur récupération admin:', error);
    return null;
  }
}

/**
 * Vérifie si l'admin a la permission de vérifier des artisans
 */
export async function canVerifyArtisans(userId: string): Promise<boolean> {
  const adminData = await getAdminData(userId);
  return adminData?.permissions?.canVerifyArtisans || false;
}

// ============================================
// RÉCUPÉRATION DES ARTISANS EN ATTENTE
// ============================================

/**
 * Récupère tous les artisans en attente de vérification
 */
export async function getPendingVerifications(): Promise<AdminVerificationRequest[]> {
  try {
    // Récupère artisans avec status pending ou incomplete
    const artisansRef = collection(db, 'artisans');
    const q = query(
      artisansRef,
      where('verified', '==', false)
    );

    const querySnapshot = await getDocs(q);
    const requests: AdminVerificationRequest[] = [];

    for (const docSnap of querySnapshot.docs) {
      const artisan = { id: docSnap.id, ...docSnap.data() } as Artisan;
      
      // Calculer les étapes manquantes
      const missingSteps = calculateMissingSteps(artisan);
      const completionPercentage = calculateCompletionPercentage(artisan);

      requests.push({
        artisanId: docSnap.id,
        userId: artisan.userId,
        nomComplet: `${artisan.nom} ${artisan.prenom}`,
        email: artisan.email,
        telephone: artisan.telephone,
        entreprise: {
          nom: artisan.entreprise.nom,
          siret: artisan.entreprise.siret,
          formeJuridique: artisan.entreprise.formeJuridique,
        },
        verificationStatus: artisan.verificationStatus || 'incomplete',
        siretVerified: artisan.siretVerified || false,
        contactVerification: artisan.contactVerification,
        verificationDocuments: artisan.verificationDocuments,
        dateInscription: artisan.dateCreation,
        dateLastUpdate: artisan.dateModification,
        missingSteps,
        completionPercentage,
      });
    }

    // Tri par date (plus récents en premier)
    return requests.sort((a, b) => {
      const dateA = a.dateLastUpdate?.toMillis() || a.dateInscription.toMillis();
      const dateB = b.dateLastUpdate?.toMillis() || b.dateInscription.toMillis();
      return dateB - dateA;
    });
  } catch (error) {
    console.error('Erreur récupération vérifications:', error);
    throw error;
  }
}

/**
 * Récupère les artisans avec documents uploadés en attente
 */
export async function getArtisansWithPendingDocuments(): Promise<AdminVerificationRequest[]> {
  try {
    const artisansRef = collection(db, 'artisans');
    const q = query(
      artisansRef,
      where('verified', '==', false)
    );

    const querySnapshot = await getDocs(q);
    const requests: AdminVerificationRequest[] = [];

    for (const docSnap of querySnapshot.docs) {
      const artisan = { id: docSnap.id, ...docSnap.data() } as Artisan;
      
      // Filtrer seulement ceux avec documents uploadés
      const hasKbis = artisan.verificationDocuments?.kbis?.url;
      const hasIdCard = artisan.verificationDocuments?.idCard?.url;
      
      if (!hasKbis && !hasIdCard) {
        continue; // Pas de documents uploadés
      }

      const missingSteps = calculateMissingSteps(artisan);
      const completionPercentage = calculateCompletionPercentage(artisan);

      requests.push({
        artisanId: docSnap.id,
        userId: artisan.userId,
        nomComplet: `${artisan.nom} ${artisan.prenom}`,
        email: artisan.email,
        telephone: artisan.telephone,
        entreprise: {
          nom: artisan.entreprise.nom,
          siret: artisan.entreprise.siret,
          formeJuridique: artisan.entreprise.formeJuridique,
        },
        verificationStatus: artisan.verificationStatus || 'incomplete',
        siretVerified: artisan.siretVerified || false,
        contactVerification: artisan.contactVerification,
        verificationDocuments: artisan.verificationDocuments,
        dateInscription: artisan.dateCreation,
        dateLastUpdate: artisan.dateModification,
        missingSteps,
        completionPercentage,
      });
    }

    return requests.sort((a, b) => {
      const dateA = a.dateLastUpdate?.toMillis() || a.dateInscription.toMillis();
      const dateB = b.dateLastUpdate?.toMillis() || b.dateInscription.toMillis();
      return dateB - dateA;
    });
  } catch (error) {
    console.error('Erreur récupération documents pending:', error);
    throw error;
  }
}

/**
 * Récupère un artisan spécifique pour vérification
 */
export async function getArtisanForVerification(
  artisanId: string
): Promise<AdminVerificationRequest | null> {
  try {
    const artisanRef = doc(db, 'artisans', artisanId);
    const artisanSnap = await getDoc(artisanRef);

    if (!artisanSnap.exists()) {
      return null;
    }

    const artisan = { id: artisanSnap.id, ...artisanSnap.data() } as Artisan;
    const missingSteps = calculateMissingSteps(artisan);
    const completionPercentage = calculateCompletionPercentage(artisan);

    return {
      artisanId: artisanSnap.id,
      userId: artisan.userId,
      nomComplet: `${artisan.nom} ${artisan.prenom}`,
      email: artisan.email,
      telephone: artisan.telephone,
      entreprise: {
        nom: artisan.entreprise.nom,
        siret: artisan.entreprise.siret,
        formeJuridique: artisan.entreprise.formeJuridique,
      },
      verificationStatus: artisan.verificationStatus || 'incomplete',
      siretVerified: artisan.siretVerified || false,
      contactVerification: artisan.contactVerification,
      verificationDocuments: artisan.verificationDocuments,
      dateInscription: artisan.dateCreation,
      dateLastUpdate: artisan.dateModification,
      missingSteps,
      completionPercentage,
    };
  } catch (error) {
    console.error('Erreur récupération artisan:', error);
    throw error;
  }
}

// ============================================
// CALCUL DES ÉTAPES MANQUANTES
// ============================================

/**
 * Calcule les étapes de vérification manquantes
 */
function calculateMissingSteps(artisan: Artisan): string[] {
  const missing: string[] = [];

  if (!artisan.siretVerified) {
    missing.push('Vérification SIRET');
  }

  if (!artisan.contactVerification?.email?.verified) {
    missing.push('Vérification email');
  }

  if (!artisan.contactVerification?.telephone?.verified) {
    missing.push('Vérification téléphone');
  }

  if (!artisan.verificationDocuments?.kbis?.url) {
    missing.push('Upload Kbis');
  } else if (!artisan.verificationDocuments?.kbis?.verified) {
    missing.push('Validation Kbis (admin)');
  }

  if (!artisan.verificationDocuments?.idCard?.url) {
    missing.push('Upload pièce d\'identité');
  } else if (!artisan.verificationDocuments?.idCard?.verified) {
    missing.push('Validation pièce d\'identité (admin)');
  }

  return missing;
}

/**
 * Calcule le pourcentage de complétion (0-100)
 */
function calculateCompletionPercentage(artisan: Artisan): number {
  const totalSteps = 5;
  let completed = 0;

  if (artisan.siretVerified) completed++;
  if (artisan.contactVerification?.email?.verified) completed++;
  if (artisan.contactVerification?.telephone?.verified) completed++;
  if (artisan.verificationDocuments?.kbis?.verified) completed++;
  if (artisan.verificationDocuments?.idCard?.verified) completed++;

  return Math.round((completed / totalSteps) * 100);
}

// ============================================
// ACTIONS ADMIN - APPROBATION/REJET
// ============================================

/**
 * Approuve la vérification d'un artisan
 */
export async function approveArtisan(
  artisanId: string,
  adminId: string,
  adminEmail: string,
  documentChecked: 'kbis' | 'idCard' | 'both'
): Promise<{ success: boolean; error?: string }> {
  try {
    // Vérifier permissions admin
    const hasPermission = await canVerifyArtisans(adminId);
    if (!hasPermission) {
      return { success: false, error: 'Permissions insuffisantes' };
    }

    const artisanRef = doc(db, 'artisans', artisanId);
    const artisanSnap = await getDoc(artisanRef);

    if (!artisanSnap.exists()) {
      return { success: false, error: 'Artisan introuvable' };
    }

    const artisan = artisanSnap.data() as Artisan;

    // Mettre à jour les documents vérifiés
    const updates: any = {
      dateModification: Timestamp.now(),
    };

    if (documentChecked === 'kbis' || documentChecked === 'both') {
      updates['verificationDocuments.kbis.verified'] = true;
    }

    if (documentChecked === 'idCard' || documentChecked === 'both') {
      updates['verificationDocuments.idCard.verified'] = true;
    }

    // Vérifier si toutes les étapes sont complètes (KBIS + ID Card + RC Pro)
    const allStepsComplete = 
      artisan.siretVerified &&
      artisan.contactVerification?.email?.verified &&
      artisan.contactVerification?.telephone?.verified &&
      (documentChecked === 'both' || 
       (artisan.verificationDocuments?.kbis?.verified || documentChecked === 'kbis')) &&
      (documentChecked === 'both' || 
       (artisan.verificationDocuments?.idCard?.verified || documentChecked === 'idCard')) &&
      artisan.verificationDocuments?.rcPro?.verified;

    if (allStepsComplete) {
      updates.verified = true;
      updates.verificationStatus = 'approved';
      updates.verificationDate = Timestamp.now();
    } else {
      updates.verificationStatus = 'pending';
    }

    await updateDoc(artisanRef, updates);

    // Enregistrer l'action admin
    await logAdminAction({
      artisanId,
      adminId,
      adminEmail,
      action: 'approve',
      documentChecked,
      timestamp: Timestamp.now(),
    });

    // Envoyer email de notification si profil totalement approuvé
    if (allStepsComplete) {
      try {
        const { getUserById } = await import('./user-service');
        const user = await getUserById(artisan.userId);
        
        if (user?.email) {
          const { sendArtisanApprovedEmail } = await import('./email-notification-service');
          await sendArtisanApprovedEmail(
            user.email,
            `${user.prenom} ${user.nom}`,
            artisan.businessName
          );
          console.log(`✅ Email d'approbation envoyé à ${user.email}`);
        }
      } catch (emailError) {
        console.error('⚠️ Erreur envoi email approbation:', emailError);
        // Ne pas bloquer l'exécution si l'email échoue
      }
    }

    return { success: true };
  } catch (error) {
    console.error('Erreur approbation artisan:', error);
    return { success: false, error: 'Erreur lors de l\'approbation' };
  }
}

/**
 * Rejette la vérification d'un artisan
 */
export async function rejectArtisan(
  artisanId: string,
  adminId: string,
  adminEmail: string,
  reason: string,
  documentChecked: 'kbis' | 'idCard' | 'both'
): Promise<{ success: boolean; error?: string }> {
  try {
    // Vérifier permissions admin
    const hasPermission = await canVerifyArtisans(adminId);
    if (!hasPermission) {
      return { success: false, error: 'Permissions insuffisantes' };
    }

    if (!reason || reason.trim().length === 0) {
      return { success: false, error: 'Raison du rejet requise' };
    }

    const artisanRef = doc(db, 'artisans', artisanId);
    const artisanSnap = await getDoc(artisanRef);

    if (!artisanSnap.exists()) {
      return { success: false, error: 'Artisan introuvable' };
    }

    // Mettre à jour le statut
    const updates: any = {
      verified: false,
      verificationStatus: 'rejected',
      rejectionReason: reason,
      dateModification: Timestamp.now(),
    };

    // Marquer les documents comme non vérifiés
    if (documentChecked === 'kbis' || documentChecked === 'both') {
      updates['verificationDocuments.kbis.verified'] = false;
    }

    if (documentChecked === 'idCard' || documentChecked === 'both') {
      updates['verificationDocuments.idCard.verified'] = false;
    }

    await updateDoc(artisanRef, updates);

    // Enregistrer l'action admin
    await logAdminAction({
      artisanId,
      adminId,
      adminEmail,
      action: 'reject',
      reason,
      documentChecked,
      timestamp: Timestamp.now(),
    });

    // Envoyer email de notification à l'artisan
    try {
      const artisanData = artisanSnap.data() as any;
      const { getUserById } = await import('./user-service');
      const user = await getUserById(artisanData.userId);
      
      if (user?.email) {
        const { sendArtisanRejectedEmail } = await import('./email-notification-service');
        await sendArtisanRejectedEmail(
          user.email,
          `${user.prenom} ${user.nom}`,
          reason
        );
        console.log(`✅ Email de rejet envoyé à ${user.email}`);
      }
    } catch (emailError) {
      console.error('⚠️ Erreur envoi email rejet:', emailError);
      // Ne pas bloquer l'exécution si l'email échoue
    }

    return { success: true };
  } catch (error) {
    console.error('Erreur rejet artisan:', error);
    return { success: false, error: 'Erreur lors du rejet' };
  }
}

// ============================================
// HISTORIQUE DES ACTIONS ADMIN
// ============================================

/**
 * Enregistre une action admin dans l'historique
 */
async function logAdminAction(
  action: Omit<AdminVerificationAction, 'adminId' | 'adminEmail'> & {
    artisanId: string;
    adminId: string;
    adminEmail: string;
  }
): Promise<void> {
  try {
    const historyRef = collection(db, 'adminActionHistory');
    
    const actionData: AdminVerificationAction = {
      adminId: action.adminId,
      adminEmail: action.adminEmail,
      action: action.action,
      reason: action.reason,
      timestamp: action.timestamp,
      documentChecked: action.documentChecked,
    };

    await addDoc(historyRef, {
      artisanId: action.artisanId,
      actions: [actionData],
      dateCreation: Timestamp.now(),
    });
  } catch (error) {
    console.error('Erreur enregistrement action admin:', error);
  }
}

/**
 * Récupère l'historique des actions pour un artisan
 */
export async function getArtisanActionHistory(
  artisanId: string
): Promise<AdminVerificationAction[]> {
  try {
    const historyRef = collection(db, 'adminActionHistory');
    const q = query(
      historyRef,
      where('artisanId', '==', artisanId),
      orderBy('dateCreation', 'desc'),
      limit(20)
    );

    const querySnapshot = await getDocs(q);
    const actions: AdminVerificationAction[] = [];

    querySnapshot.forEach((doc) => {
      const history = doc.data() as AdminActionHistory;
      actions.push(...history.actions);
    });

    return actions.sort((a, b) => b.timestamp.toMillis() - a.timestamp.toMillis());
  } catch (error) {
    console.error('Erreur récupération historique:', error);
    return [];
  }
}

// ============================================
// STATISTIQUES ADMIN
// ============================================

/**
 * Récupère les statistiques de vérification
 */
export async function getVerificationStats(): Promise<{
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  incomplete: number;
}> {
  try {
    const artisansRef = collection(db, 'artisans');
    const querySnapshot = await getDocs(artisansRef);

    let total = 0;
    let pending = 0;
    let approved = 0;
    let rejected = 0;
    let incomplete = 0;

    querySnapshot.forEach((doc) => {
      const artisan = doc.data() as Artisan;
      total++;

      if (artisan.verified) {
        approved++;
      } else if (artisan.verificationStatus === 'rejected') {
        rejected++;
      } else if (artisan.verificationStatus === 'pending') {
        pending++;
      } else {
        incomplete++;
      }
    });

    return { total, pending, approved, rejected, incomplete };
  } catch (error) {
    console.error('Erreur récupération stats:', error);
    return { total: 0, pending: 0, approved: 0, rejected: 0, incomplete: 0 };
  }
}
