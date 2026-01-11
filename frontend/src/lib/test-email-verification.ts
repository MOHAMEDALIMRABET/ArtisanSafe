/**
 * Script de test pour l'envoi d'emails de vérification Firebase
 * 
 * Usage : Créer un compte test et vérifier l'envoi d'email
 */

import { auth } from './firebase/config';
import { sendEmailVerification } from 'firebase/auth';

export async function testEmailVerification() {
  try {
    const user = auth.currentUser;
    
    if (!user) {
      console.error('❌ Aucun utilisateur connecté');
      return {
        success: false,
        error: 'Vous devez être connecté pour tester l\'envoi d\'email'
      };
    }

    if (user.emailVerified) {
      console.log('✅ Email déjà vérifié');
      return {
        success: true,
        message: 'Email déjà vérifié',
        email: user.email
      };
    }

    console.log('📧 Envoi de l\'email de vérification à:', user.email);
    
    await sendEmailVerification(user, {
      url: `${window.location.origin}/email-verified`,
      handleCodeInApp: false,
    });

    console.log('✅ Email de vérification envoyé avec succès');
    console.log('📬 Vérifiez votre boîte de réception (et spam):', user.email);
    
    return {
      success: true,
      message: 'Email de vérification envoyé',
      email: user.email
    };
    
  } catch (error: any) {
    console.error('❌ Erreur lors de l\'envoi de l\'email:', error);
    
    // Traduire les erreurs courantes
    let errorMessage = error.message;
    
    if (error.code === 'auth/too-many-requests') {
      errorMessage = 'Trop de tentatives d\'envoi. Attendez quelques minutes.';
    } else if (error.code === 'auth/invalid-email') {
      errorMessage = 'Adresse email invalide';
    } else if (error.code === 'auth/network-request-failed') {
      errorMessage = 'Erreur réseau. Vérifiez votre connexion.';
    }
    
    return {
      success: false,
      error: errorMessage,
      code: error.code
    };
  }
}

/**
 * Vérifier le statut de l'email
 */
export function checkEmailVerificationStatus() {
  const user = auth.currentUser;
  
  if (!user) {
    return {
      connected: false,
      message: 'Aucun utilisateur connecté'
    };
  }
  
  return {
    connected: true,
    email: user.email,
    emailVerified: user.emailVerified,
    uid: user.uid,
    createdAt: user.metadata.creationTime,
    lastSignIn: user.metadata.lastSignInTime
  };
}

// Fonction pour recharger le statut de vérification
export async function refreshEmailVerificationStatus() {
  try {
    const user = auth.currentUser;
    
    if (!user) {
      return { success: false, error: 'Aucun utilisateur connecté' };
    }
    
    // Recharger les infos utilisateur depuis Firebase
    await user.reload();
    
    return {
      success: true,
      emailVerified: user.emailVerified,
      email: user.email
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message
    };
  }
}
