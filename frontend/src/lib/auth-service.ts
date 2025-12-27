import { auth } from '@/lib/firebase/config';
import { 
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User,
  updateProfile
} from 'firebase/auth';
import { createUser } from './firebase/user-service';
import { createArtisan } from './firebase/artisan-service';
import type { User as UserType, Artisan } from '@/types/firestore';
import { Timestamp } from 'firebase/firestore';

export interface SignUpData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: 'client' | 'artisan';
  phone?: string;
}

export interface ArtisanSignUpData extends SignUpData {
  role: 'artisan';
  businessName: string;
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

      return user;
    } catch (error) {
      console.error('Error signing up client:', error);
      throw error;
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
        siret: '', // À remplir dans le profil
        raisonSociale: data.businessName,
        formeJuridique: 'SARL' as const, // Valeur par défaut, à modifier dans le profil
        metiers: (data.metiers || []).map(m => m.toLowerCase()) as any[], // Convertir en minuscules
        zonesIntervention: data.location?.city ? [{
          ville: data.location.city,
          codePostal: data.location.postalCode || '',
          departements: [],
          rayonKm: 30, // Rayon par défaut
        }] : [],
        disponibilites: [], // À remplir dans l'agenda
        notation: 0,
        nombreAvis: 0,
        badgeVerifie: false,
        documentsVerifies: false,
        statut: 'inactif' as const, // Inactif jusqu'à vérification
      };

      await createArtisan(artisanData);

      return user;
    } catch (error) {
      console.error('Error signing up artisan:', error);
      throw error;
    }
  },

  /**
   * Connexion
   */
  async signIn(email: string, password: string) {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      return userCredential.user;
    } catch (error) {
      console.error('Error signing in:', error);
      throw error;
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
};

// Exports individuels pour faciliter l'import
export const signUpClient = authService.signUpClient.bind(authService);
export const signUpArtisan = authService.signUpArtisan.bind(authService);
export const signIn = authService.signIn.bind(authService);
export const signOut = authService.signOut.bind(authService);
export const getCurrentUser = authService.getCurrentUser.bind(authService);
export const onAuthChanged = authService.onAuthStateChanged.bind(authService);

