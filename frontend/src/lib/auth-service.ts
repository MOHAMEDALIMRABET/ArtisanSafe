import { auth } from '@/lib/firebase/config';
import { 
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User,
  updateProfile,
  sendEmailVerification
} from 'firebase/auth';
import { createUser } from './firebase/user-service';
import { createArtisan } from './firebase/artisan-service';
import { syncEmailVerificationStatus } from './firebase/email-verification-sync';
import type { User as UserType, Artisan } from '@/types/firestore';
import { Timestamp } from 'firebase/firestore';

/**
 * Traduire les erreurs Firebase Auth en français
 */
function translateAuthError(error: any): string {
  const errorCode = error?.code || '';
  
  switch (errorCode) {
    case 'auth/email-already-in-use':
      return 'Cette adresse email est déjà utilisée par un autre compte. Veuillez vous connecter ou utiliser une autre adresse email.';
    case 'auth/invalid-email':
      return 'L\'adresse email n\'est pas valide.';
    case 'auth/operation-not-allowed':
      return 'L\'inscription par email/mot de passe n\'est pas activée.';
    case 'auth/weak-password':
      return 'Le mot de passe est trop faible. Utilisez au moins 6 caractères.';
    case 'auth/user-disabled':
      return 'Ce compte a été désactivé.';
    case 'auth/user-not-found':
    case 'auth/invalid-credential':
      return 'Aucun compte ne correspond à cette adresse email.';
    case 'auth/wrong-password':
      return 'Mot de passe incorrect.';
    case 'auth/too-many-requests':
      return 'Trop de tentatives. Veuillez réessayer plus tard.';
    case 'auth/network-request-failed':
      return 'Erreur de connexion. Vérifiez votre connexion internet.';
    default:
      return error?.message || 'Une erreur est survenue lors de l\'inscription';
  }
}

export interface SignUpData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  representantLegal?: string;
  role: 'client' | 'artisan';
  phone?: string;
}

export interface ArtisanSignUpData extends SignUpData {
  role: 'artisan';
  businessName: string;
  siret?: string;
  metiers: string[];
  location: {
    address: string;
    city: string;
    postalCode: string;
  };
}

/**
 * Service d'authentification Firebase
 */
export const authService = {
  /**
   * Inscription client
   */
  async signUpClient(data: SignUpData) {
    try {
      // Créer le compte Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        data.email,
        data.password
      );

      const user = userCredential.user;

      // Mettre à jour le profil
      await updateProfile(user, {
        displayName: `${data.firstName} ${data.lastName}`,
      });

      // Créer le document utilisateur dans Firestore avec notre nouveau service
      const userData: Omit<UserType, 'id'> = {
        email: data.email,
        nom: data.lastName,
        prenom: data.firstName,
        telephone: data.phone || '',
        role: 'client',
        statut: 'verifie', // Client vérifié par défaut
        preferences: {
          notifications: {
            email: true,
            push: true,
            sms: false,
          },
        },
        dateCreation: Timestamp.now(),
        dateModification: Timestamp.now(),
      };

      await createUser(user.uid, userData);

      // Synchroniser le statut emailVerified dans Firestore
      await syncEmailVerificationStatus(user.uid);

      // Envoyer l'email de vérification
      try {
        await sendEmailVerification(user, {
          url: `${window.location.origin}/email-verified`,
          handleCodeInApp: false,
        });
        console.log('✅ Email de vérification envoyé à', data.email);
      } catch (emailError) {
        console.error('⚠️ Erreur envoi email de vérification:', emailError);
        // Ne pas bloquer l'inscription si l'email échoue
      }

      return user;
    } catch (error: any) {
      console.error('Error signing up client:', error);
      const errorMessage = translateAuthError(error);
      throw new Error(errorMessage);
    }
  },

  /**
   * Inscription artisan
   */
  async signUpArtisan(data: ArtisanSignUpData) {
    try {
      // Créer le compte Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        data.email,
        data.password
      );

      const user = userCredential.user;

      // Mettre à jour le profil
      await updateProfile(user, {
        displayName: data.businessName,
      });

      // Créer le document utilisateur avec notre nouveau service
      const userData: Omit<UserType, 'id'> = {
        email: data.email,
        nom: data.lastName,
        prenom: data.firstName,
        representantLegal: data.representantLegal,
        telephone: data.phone || '',
        role: 'artisan',
        statut: 'non_verifie', // Artisan doit être vérifié manuellement
        preferences: {
          notifications: {
            email: true,
            push: true,
            sms: false,
          },
        },
        dateCreation: Timestamp.now(),
        dateModification: Timestamp.now(),
      };

      await createUser(user.uid, userData);

      // Créer le profil artisan public avec notre nouveau service
      const artisanData = {
        userId: user.uid,
        siret: data.siret || '', // SIRET fourni à l'inscription ou à remplir dans le profil
        raisonSociale: data.businessName,
        formeJuridique: 'SARL' as const, // Valeur par défaut, à modifier dans le profil
        metiers: (data.metiers || []) as any[], // Les métiers sont déjà normalisés depuis le formulaire
        zonesIntervention: data.location?.city ? [{
          ville: data.location.city,
          codePostal: data.location.postalCode || '',
          departements: [],
          rayonKm: 30, // Rayon par défaut
        }] : [],
        disponibilites: [], // À remplir dans l'agenda
        notation: 0,
        nombreAvis: 0,
        
        // Vérification SIRET
        siretVerified: false,
        
        // Nouveau système de vérification
        verified: false, // Sera mis à true après vérification admin
        verificationStatus: 'pending' as const,

        
        statut: 'inactif' as const, // Inactif jusqu'à vérification
      };

      await createArtisan(artisanData);

      // Synchroniser le statut emailVerified dans Firestore
      await syncEmailVerificationStatus(user.uid);

      // Envoyer l'email de vérification (OBLIGATOIRE pour artisans)
      try {
        await sendEmailVerification(user, {
          url: `${window.location.origin}/email-verified`,
          handleCodeInApp: false,
        });
        console.log('✅ Email de vérification envoyé à', data.email);
      } catch (emailError) {
        console.error('⚠️ Erreur envoi email de vérification:', emailError);
        // Ne pas bloquer l'inscription si l'email échoue
      }

      return user;
    } catch (error: any) {
      console.error('Error signing up artisan:', error);
      const errorMessage = translateAuthError(error);
      throw new Error(errorMessage);
    }
  },

  /**
   * Connexion
   */
  async signIn(email: string, password: string) {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      
      // Synchroniser le statut emailVerified
      await syncEmailVerificationStatus(userCredential.user.uid);
      
      return userCredential.user;
    } catch (error: any) {
      console.error('Error signing in:', error);
      const errorMessage = translateAuthError(error);
      throw new Error(errorMessage);
    }
  },

  /**
   * Déconnexion
   */
  async signOut() {
    try {
      await firebaseSignOut(auth);
    } catch (error) {
      console.error('Error signing out:', error);
      throw error;
    }
  },

  /**
   * Observer l'état d'authentification
   */
  onAuthStateChanged(callback: (user: User | null) => void) {
    return onAuthStateChanged(auth, callback);
  },

  /**
   * Récupérer l'utilisateur actuel
   */
  getCurrentUser() {
    return auth.currentUser;
  },

  /**
   * Renvoyer l'email de vérification
   */
  async resendVerificationEmail() {
    const user = auth.currentUser;
    if (!user) {
      throw new Error('Aucun utilisateur connecté');
    }

    if (user.emailVerified) {
      throw new Error('Email déjà vérifié');
    }

    try {
      // Générer nouveau token (validité 1h)
      const verificationToken = Math.random().toString(36).substring(2, 15) + 
                                Math.random().toString(36).substring(2, 15);
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 1);

      // Stocker le token dans Firestore
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        verificationToken,
        verificationTokenExpires: Timestamp.fromDate(expiresAt)
      });

      const verificationUrl = `${window.location.origin}/email-verified?token=${verificationToken}&uid=${user.uid}`;
      await sendEmailVerification(user, {
        url: verificationUrl,
        handleCodeInApp: false,
      });
      console.log('✅ Email de vérification renvoyé');
    } catch (error) {
      console.error('Erreur renvoi email:', error);
      throw error;
    }
  },
};

// Exports individuels pour faciliter l'import
export const signUpClient = authService.signUpClient.bind(authService);
export const signUpArtisan = authService.signUpArtisan.bind(authService);
export const signIn = authService.signIn.bind(authService);
export const signOut = authService.signOut.bind(authService);
export const getCurrentUser = authService.getCurrentUser.bind(authService);
export const resendVerificationEmail = authService.resendVerificationEmail.bind(authService);
export const onAuthChanged = authService.onAuthStateChanged.bind(authService);

