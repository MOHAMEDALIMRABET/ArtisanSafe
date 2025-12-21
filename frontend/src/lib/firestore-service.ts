import { db } from '@/lib/firebase';
import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  query, 
  where,
  orderBy,
  limit,
  DocumentData,
  QueryConstraint
} from 'firebase/firestore';

// Collections Firestore
export const COLLECTIONS = {
  USERS: 'users',
  ARTISANS: 'artisans', // Profils publics des artisans
  DEVIS: 'devis',
  AVIS: 'avis',
  CONVERSATIONS: 'conversations',
  MESSAGES: 'messages',
} as const;

/**
 * Service générique pour Firestore
 */
class FirestoreService {
  /**
   * Récupérer un document par ID
   */
  async getById<T>(collectionName: string, id: string): Promise<T | null> {
    try {
      const docRef = doc(db, collectionName, id);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() } as T;
      }
      return null;
    } catch (error) {
      console.error(`Error getting document from ${collectionName}:`, error);
      throw error;
    }
  }

  /**
   * Créer ou mettre à jour un document
   */
  async set<T extends DocumentData>(
    collectionName: string, 
    id: string, 
    data: T
  ): Promise<void> {
    try {
      const docRef = doc(db, collectionName, id);
      await setDoc(docRef, {
        ...data,
        updatedAt: new Date(),
      }, { merge: true });
    } catch (error) {
      console.error(`Error setting document in ${collectionName}:`, error);
      throw error;
    }
  }

  /**
   * Mettre à jour un document
   */
  async update(
    collectionName: string, 
    id: string, 
    data: Partial<DocumentData>
  ): Promise<void> {
    try {
      const docRef = doc(db, collectionName, id);
      await updateDoc(docRef, {
        ...data,
        updatedAt: new Date(),
      });
    } catch (error) {
      console.error(`Error updating document in ${collectionName}:`, error);
      throw error;
    }
  }

  /**
   * Requête avec filtres
   */
  async query<T>(
    collectionName: string,
    constraints: QueryConstraint[]
  ): Promise<T[]> {
    try {
      const q = query(collection(db, collectionName), ...constraints);
      const querySnapshot = await getDocs(q);
      
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as T[];
    } catch (error) {
      console.error(`Error querying ${collectionName}:`, error);
      throw error;
    }
  }
}

export const firestoreService = new FirestoreService();

/**
 * Services spécifiques par collection
 */

// Service Artisans
export const artisanService = {
  async searchByMetier(metier: string, maxResults = 20) {
    return firestoreService.query(
      COLLECTIONS.ARTISANS,
      [
        where('metiers', 'array-contains', metier),
        where('verified', '==', true),
        orderBy('rating', 'desc'),
        limit(maxResults)
      ]
    );
  },

  async searchByLocation(city: string, metier?: string) {
    const constraints: QueryConstraint[] = [
      where('location.city', '==', city),
      where('verified', '==', true),
    ];
    
    if (metier) {
      constraints.push(where('metiers', 'array-contains', metier));
    }
    
    return firestoreService.query(COLLECTIONS.ARTISANS, constraints);
  },
};

// Service Devis
export const devisService = {
  async getByClient(clientId: string) {
    return firestoreService.query(
      COLLECTIONS.DEVIS,
      [
        where('clientId', '==', clientId),
        orderBy('createdAt', 'desc')
      ]
    );
  },

  async getByArtisan(artisanId: string) {
    return firestoreService.query(
      COLLECTIONS.DEVIS,
      [
        where('artisanId', '==', artisanId),
        orderBy('createdAt', 'desc')
      ]
    );
  },
};
