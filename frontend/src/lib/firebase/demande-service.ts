/**
 * Service de gestion des demandes de travaux
 * CRUD operations pour la collection 'demandes'
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
} from 'firebase/firestore';
import { db } from './config';
import type { 
  Demande, 
  CreateDocument,
  DemandeStatut 
} from '@/types/firestore';

const COLLECTION_NAME = 'demandes';

/**
 * Créer une nouvelle demande
 */
export async function createDemande(
  demandeData: CreateDocument<Demande>
): Promise<Demande> {
  const demandesRef = collection(db, COLLECTION_NAME);
  
  const newDemande = {
    ...demandeData,
    statut: demandeData.statut || 'brouillon' as DemandeStatut,
    photos: demandeData.photos || [],
    devisRecus: 0,
    dateCreation: Timestamp.now(),
    dateModification: Timestamp.now(),
  };

  const docRef = await addDoc(demandesRef, newDemande);
  
  return {
    ...newDemande,
    id: docRef.id,
  } as Demande;
}

/**
 * Récupérer une demande par son ID
 */
export async function getDemandeById(demandeId: string): Promise<Demande | null> {
  const demandeRef = doc(db, COLLECTION_NAME, demandeId);
  const demandeSnap = await getDoc(demandeRef);

  if (!demandeSnap.exists()) {
    return null;
  }

  return {
    id: demandeSnap.id,
    ...demandeSnap.data(),
  } as Demande;
}

/**
 * Récupérer toutes les demandes d'un client
 */
export async function getDemandesByClient(clientId: string): Promise<Demande[]> {
  const demandesRef = collection(db, COLLECTION_NAME);
  const q = query(
    demandesRef,
    where('clientId', '==', clientId),
    orderBy('dateCreation', 'desc')
  );
  const querySnapshot = await getDocs(q);
  
  return querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  } as Demande));
}

/**
 * Récupérer les demandes matchées pour un artisan
 */
export async function getDemandesForArtisan(artisanId: string): Promise<Demande[]> {
  const demandesRef = collection(db, COLLECTION_NAME);
  const q = query(
    demandesRef,
    where('artisansMatches', 'array-contains', artisanId),
    where('statut', 'in', ['matchee', 'publiee']),
    orderBy('dateCreation', 'desc')
  );
  const querySnapshot = await getDocs(q);
  
  return querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  } as Demande));
}

/**
 * Mettre à jour une demande
 */
export async function updateDemande(
  demandeId: string,
  updates: Partial<Demande>
): Promise<void> {
  const demandeRef = doc(db, COLLECTION_NAME, demandeId);
  await updateDoc(demandeRef, {
    ...updates,
    dateModification: Timestamp.now(),
  });
}

/**
 * Mettre à jour le statut d'une demande
 */
export async function updateDemandeStatut(
  demandeId: string,
  statut: DemandeStatut
): Promise<void> {
  const demandeRef = doc(db, COLLECTION_NAME, demandeId);
  await updateDoc(demandeRef, {
    statut,
    dateModification: Timestamp.now(),
  });
}

/**
 * Ajouter des artisans matchés à une demande
 */
export async function addArtisansMatches(
  demandeId: string,
  artisanIds: string[]
): Promise<void> {
  const demandeRef = doc(db, COLLECTION_NAME, demandeId);
  await updateDoc(demandeRef, {
    artisansMatches: artisanIds,
    statut: 'matchee',
    dateModification: Timestamp.now(),
  });
}

/**
 * Incrémenter le nombre de devis reçus
 */
export async function incrementDevisRecus(demandeId: string): Promise<void> {
  const demande = await getDemandeById(demandeId);
  if (!demande) throw new Error('Demande non trouvée');

  const demandeRef = doc(db, COLLECTION_NAME, demandeId);
  await updateDoc(demandeRef, {
    devisRecus: (demande.devisRecus || 0) + 1,
    dateModification: Timestamp.now(),
  });
}

/**
 * Publier une demande (passer de brouillon à publiée)
 */
export async function publierDemande(demandeId: string): Promise<void> {
  await updateDemandeStatut(demandeId, 'publiee');
}

/**
 * Annuler une demande
 */
export async function annulerDemande(demandeId: string): Promise<void> {
  await updateDemandeStatut(demandeId, 'annulee');
}

/**
 * Supprimer une demande
 */
export async function deleteDemande(demandeId: string): Promise<void> {
  const demandeRef = doc(db, COLLECTION_NAME, demandeId);
  await deleteDoc(demandeRef);
}

/**
 * Rechercher des demandes par catégorie
 */
export async function searchDemandesByCategorie(
  categorie: Demande['categorie']
): Promise<Demande[]> {
  const demandesRef = collection(db, COLLECTION_NAME);
  const q = query(
    demandesRef,
    where('categorie', '==', categorie),
    where('statut', '==', 'publiee'),
    orderBy('dateCreation', 'desc'),
    limit(20)
  );
  const querySnapshot = await getDocs(q);
  
  return querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  } as Demande));
}

/**
 * Récupérer les demandes récentes (publiques)
 */
export async function getRecentDemandes(limitCount: number = 10): Promise<Demande[]> {
  const demandesRef = collection(db, COLLECTION_NAME);
  const q = query(
    demandesRef,
    where('statut', '==', 'publiee'),
    orderBy('dateCreation', 'desc'),
    limit(limitCount)
  );
  const querySnapshot = await getDocs(q);
  
  return querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  } as Demande));
}
