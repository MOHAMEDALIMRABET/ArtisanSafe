/**
 * Service de gestion des devis
 * CRUD operations pour la collection 'devis'
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
  Timestamp,
} from 'firebase/firestore';
import { db } from './config';
import type { 
  Devis, 
  CreateDocument,
  DevisStatut 
} from '@/types/firestore';

const COLLECTION_NAME = 'devis';

/**
 * Créer un nouveau devis
 */
export async function createDevis(
  devisData: CreateDocument<Devis>
): Promise<Devis> {
  const devisRef = collection(db, COLLECTION_NAME);
  
  const newDevis = {
    ...devisData,
    statut: devisData.statut || 'brouillon' as DevisStatut,
    validiteDevis: devisData.validiteDevis || 30,
    version: 1,
    dateCreation: Timestamp.now(),
  };

  const docRef = await addDoc(devisRef, newDevis);
  
  return {
    ...newDevis,
    id: docRef.id,
  } as Devis;
}

/**
 * Récupérer un devis par son ID
 */
export async function getDevisById(devisId: string): Promise<Devis | null> {
  const devisRef = doc(db, COLLECTION_NAME, devisId);
  const devisSnap = await getDoc(devisRef);

  if (!devisSnap.exists()) {
    return null;
  }

  return {
    id: devisSnap.id,
    ...devisSnap.data(),
  } as Devis;
}

/**
 * Récupérer tous les devis d'une demande
 */
export async function getDevisByDemande(demandeId: string): Promise<Devis[]> {
  const devisRef = collection(db, COLLECTION_NAME);
  const q = query(
    devisRef,
    where('demandeId', '==', demandeId),
    orderBy('dateCreation', 'desc')
  );
  const querySnapshot = await getDocs(q);
  
  return querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  } as Devis));
}

/**
 * Récupérer tous les devis d'un artisan
 */
export async function getDevisByArtisan(artisanId: string): Promise<Devis[]> {
  const devisRef = collection(db, COLLECTION_NAME);
  const q = query(
    devisRef,
    where('artisanId', '==', artisanId),
    orderBy('dateCreation', 'desc')
  );
  const querySnapshot = await getDocs(q);
  
  return querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  } as Devis));
}

/**
 * Récupérer tous les devis d'un client
 */
export async function getDevisByClient(clientId: string): Promise<Devis[]> {
  const devisRef = collection(db, COLLECTION_NAME);
  const q = query(
    devisRef,
    where('clientId', '==', clientId),
    orderBy('dateCreation', 'desc')
  );
  const querySnapshot = await getDocs(q);
  
  return querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  } as Devis));
}

/**
 * Mettre à jour un devis
 */
export async function updateDevis(
  devisId: string,
  updates: Partial<Devis>
): Promise<void> {
  const devisRef = doc(db, COLLECTION_NAME, devisId);
  
  // Incrémenter la version si modification du contenu
  const currentDevis = await getDevisById(devisId);
  const version = currentDevis ? currentDevis.version + 1 : 1;
  
  await updateDoc(devisRef, {
    ...updates,
    version,
  });
}

/**
 * Envoyer un devis (changer statut de brouillon à envoyé)
 */
export async function envoyerDevis(devisId: string): Promise<void> {
  const devisRef = doc(db, COLLECTION_NAME, devisId);
  await updateDoc(devisRef, {
    statut: 'envoye',
    dateEnvoi: Timestamp.now(),
  });
}

/**
 * Accepter un devis (client)
 */
export async function accepterDevis(devisId: string): Promise<void> {
  const devisRef = doc(db, COLLECTION_NAME, devisId);
  await updateDoc(devisRef, {
    statut: 'accepte',
    dateValidation: Timestamp.now(),
  });
}

/**
 * Refuser un devis (client)
 */
export async function refuserDevis(devisId: string): Promise<void> {
  const devisRef = doc(db, COLLECTION_NAME, devisId);
  await updateDoc(devisRef, {
    statut: 'refuse',
    dateValidation: Timestamp.now(),
  });
}

/**
 * Marquer un devis comme expiré
 */
export async function marquerDevisExpire(devisId: string): Promise<void> {
  const devisRef = doc(db, COLLECTION_NAME, devisId);
  await updateDoc(devisRef, {
    statut: 'expire',
  });
}

/**
 * Supprimer un devis
 */
export async function deleteDevis(devisId: string): Promise<void> {
  const devisRef = doc(db, COLLECTION_NAME, devisId);
  await deleteDoc(devisRef);
}

/**
 * Calculer les montants TTC à partir du HT
 */
export function calculateMontantTTC(
  montantHT: number,
  tauxTVA: number = 20
): { montantTVA: number; montantTTC: number } {
  const montantTVA = montantHT * (tauxTVA / 100);
  const montantTTC = montantHT + montantTVA;
  
  return {
    montantTVA: Math.round(montantTVA * 100) / 100,
    montantTTC: Math.round(montantTTC * 100) / 100,
  };
}

/**
 * Vérifier si un devis est expiré
 */
export function isDevisExpire(devis: Devis): boolean {
  if (!devis.dateEnvoi || devis.statut !== 'envoye') {
    return false;
  }

  const dateEnvoi = devis.dateEnvoi.toDate();
  const dateExpiration = new Date(dateEnvoi);
  dateExpiration.setDate(dateExpiration.getDate() + devis.validiteDevis);
  
  return new Date() > dateExpiration;
}
