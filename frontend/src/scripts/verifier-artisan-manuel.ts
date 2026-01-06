/**
 * Script d'urgence pour vérifier manuellement un artisan
 * 
 * UTILISATION TEMPORAIRE en attendant le système admin automatique
 * 
 * 1. Ouvrir Firebase Console
 * 2. Firestore → artisans → Trouver l'artisan
 * 3. Copier son userId
 * 4. Remplacer USER_ID ci-dessous
 * 5. Exécuter ce script dans la console navigateur de votre app
 */

import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';

export async function verifierArtisanManuellement(userId: string) {
  try {
    console.log('🔄 Vérification manuelle de l\'artisan:', userId);
    
    const artisanRef = doc(db, 'artisans', userId);
    
    await updateDoc(artisanRef, {
      verified: true,
      verificationStatus: 'approved',
      verificationDate: new Date(),
    });
    
    console.log('✅ Artisan vérifié avec succès !');
    console.log('→ L\'artisan apparaîtra maintenant dans les recherches');
    
  } catch (error) {
    console.error('❌ Erreur lors de la vérification:', error);
  }
}

// EXEMPLE D'UTILISATION :
// Dans la console navigateur :
// import { verifierArtisanManuellement } from './scripts/verifier-artisan-manuel';
// verifierArtisanManuellement('VOTRE_USER_ID_ICI');
