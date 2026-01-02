/**
 * Service de synchronisation du statut emailVerified
 * Synchronise Firebase Auth vers Firestore pour permettre les requêtes
 */

import { auth } from './config';
import { updateUser } from './user-service';
import { updateArtisan } from './artisan-service';
import { onAuthStateChanged } from 'firebase/auth';

/**
 * Synchroniser le statut emailVerified de Auth vers Firestore
 */
export async function syncEmailVerificationStatus(userId: string): Promise<void> {
  const currentUser = auth.currentUser;
  
  if (!currentUser || currentUser.uid !== userId) {
    return;
  }

  // Mettre à jour le statut dans Firestore
  await updateUser(userId, {
    emailVerified: currentUser.emailVerified,
  });

  // Si artisan, mettre à jour aussi le profil artisan
  try {
    await updateArtisan(userId, {
      emailVerified: currentUser.emailVerified,
    });
  } catch (error) {
    // Pas un artisan, on ignore l'erreur
  }
}

/**
 * Observer les changements de statut d'email et synchroniser
 */
export function startEmailVerificationSync() {
  return onAuthStateChanged(auth, async (user) => {
    if (user) {
      // Recharger l'utilisateur pour avoir les dernières données
      await user.reload();
      
      // Synchroniser le statut
      await syncEmailVerificationStatus(user.uid);
    }
  });
}
