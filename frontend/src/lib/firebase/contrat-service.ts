/**
 * Service de gestion des contrats
 * CRUD operations pour la collection 'contrats'
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
  Contrat, 
  CreateDocument,
  ContratStatut,
  PaiementStatut 
} from '@/types/firestore';

const COLLECTION_NAME = 'contrats';
const COMMISSION_RATE = 0.08; // 8%

/**
 * Créer un nouveau contrat
 */
export async function createContrat(
  contratData: CreateDocument<Contrat>
): Promise<Contrat> {
  const contratsRef = collection(db, COLLECTION_NAME);
  
  // Calculer automatiquement la commission et le montant artisan
  const commission = contratData.montantTTC * COMMISSION_RATE;
  const montantArtisan = contratData.montantTTC - commission;
  
  const newContrat = {
    ...contratData,
    commission: Math.round(commission * 100) / 100,
    montantArtisan: Math.round(montantArtisan * 100) / 100,
    statut: contratData.statut || 'signe' as ContratStatut,
    paiementStatut: contratData.paiementStatut || 'attente' as PaiementStatut,
    dateCreation: Timestamp.now(),
    dateSignature: Timestamp.now(),
  };

  const docRef = await addDoc(contratsRef, newContrat);
  
  return {
    ...newContrat,
    id: docRef.id,
  } as Contrat;
}

/**
 * Récupérer un contrat par son ID
 */
export async function getContratById(contratId: string): Promise<Contrat | null> {
  const contratRef = doc(db, COLLECTION_NAME, contratId);
  const contratSnap = await getDoc(contratRef);

  if (!contratSnap.exists()) {
    return null;
  }

  return {
    id: contratSnap.id,
    ...contratSnap.data(),
  } as Contrat;
}

/**
 * Récupérer le contrat d'un devis
 */
export async function getContratByDevis(devisId: string): Promise<Contrat | null> {
  const contratsRef = collection(db, COLLECTION_NAME);
  const q = query(contratsRef, where('devisId', '==', devisId));
  const querySnapshot = await getDocs(q);

  if (querySnapshot.empty) {
    return null;
  }

  const doc = querySnapshot.docs[0];
  return {
    id: doc.id,
    ...doc.data(),
  } as Contrat;
}

/**
 * Récupérer tous les contrats d'un client
 */
export async function getContratsByClient(clientId: string): Promise<Contrat[]> {
  const contratsRef = collection(db, COLLECTION_NAME);
  const q = query(
    contratsRef,
    where('clientId', '==', clientId)
    // Retirer orderBy pour éviter l'index composite
  );
  const querySnapshot = await getDocs(q);
  
  const contrats = querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  } as Contrat));
  
  // Tri côté client par dateCreation desc
  return contrats.sort((a, b) => {
    const dateA = a.dateCreation?.toMillis() || 0;
    const dateB = b.dateCreation?.toMillis() || 0;
    return dateB - dateA;
  });
}

/**
 * Récupérer tous les contrats d'un artisan
 */
export async function getContratsByArtisan(artisanId: string): Promise<Contrat[]> {
  const contratsRef = collection(db, COLLECTION_NAME);
  const q = query(
    contratsRef,
    where('artisanId', '==', artisanId)
    // Retirer orderBy pour éviter l'index composite
    // Le tri sera fait côté client si nécessaire
  );
  const querySnapshot = await getDocs(q);
  
  const contrats = querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  } as Contrat));
  
  // Tri côté client par dateCreation desc
  return contrats.sort((a, b) => {
    const dateA = a.dateCreation?.toMillis() || 0;
    const dateB = b.dateCreation?.toMillis() || 0;
    return dateB - dateA;
  });
}

/**
 * Mettre à jour un contrat
 */
export async function updateContrat(
  contratId: string,
  updates: Partial<Contrat>
): Promise<void> {
  const contratRef = doc(db, COLLECTION_NAME, contratId);
  await updateDoc(contratRef, updates);
}

/**
 * Mettre à jour le statut d'un contrat
 */
export async function updateContratStatut(
  contratId: string,
  statut: ContratStatut
): Promise<void> {
  const contratRef = doc(db, COLLECTION_NAME, contratId);
  await updateDoc(contratRef, { statut });
}

/**
 * Mettre à jour le statut de paiement
 */
export async function updatePaiementStatut(
  contratId: string,
  paiementStatut: PaiementStatut,
  paiementId?: string
): Promise<void> {
  const contratRef = doc(db, COLLECTION_NAME, contratId);
  const updates: any = { paiementStatut };
  
  if (paiementId) {
    updates.paiementId = paiementId;
  }
  
  await updateDoc(contratRef, updates);
}

/**
 * Démarrer un chantier
 */
export async function demarrerChantier(contratId: string): Promise<void> {
  const contratRef = doc(db, COLLECTION_NAME, contratId);
  await updateDoc(contratRef, {
    statut: 'en_cours',
  });
}

/**
 * Terminer un chantier
 */
export async function terminerChantier(
  contratId: string,
  dateFinReelle: string
): Promise<void> {
  const contratRef = doc(db, COLLECTION_NAME, contratId);
  await updateDoc(contratRef, {
    statut: 'termine',
    dateFinReelle,
  });
}

/**
 * Ouvrir un litige sur un contrat
 */
export async function ouvrirLitige(contratId: string): Promise<void> {
  const contratRef = doc(db, COLLECTION_NAME, contratId);
  await updateDoc(contratRef, {
    statut: 'litige',
    paiementStatut: 'bloque_escrow', // Bloquer le paiement
  });
}

/**
 * Annuler un contrat
 */
export async function annulerContrat(contratId: string): Promise<void> {
  const contratRef = doc(db, COLLECTION_NAME, contratId);
  await updateDoc(contratRef, {
    statut: 'annule',
  });
}

/**
 * Supprimer un contrat (admin uniquement)
 */
export async function deleteContrat(contratId: string): Promise<void> {
  const contratRef = doc(db, COLLECTION_NAME, contratId);
  await deleteDoc(contratRef);
}

/**
 * Calculer la commission (8%)
 */
export function calculateCommission(montantTTC: number): {
  commission: number;
  montantArtisan: number;
} {
  const commission = montantTTC * COMMISSION_RATE;
  const montantArtisan = montantTTC - commission;
  
  return {
    commission: Math.round(commission * 100) / 100,
    montantArtisan: Math.round(montantArtisan * 100) / 100,
  };
}

/**
 * Vérifier si le délai de 7 jours est écoulé pour libérer le paiement
 */
export function shouldReleasePaiement(contrat: Contrat): boolean {
  if (!contrat.dateFinReelle || contrat.statut !== 'termine') {
    return false;
  }

  const dateFinReelle = new Date(contrat.dateFinReelle);
  const dateLiberation = new Date(dateFinReelle);
  dateLiberation.setDate(dateLiberation.getDate() + 7);
  
  return new Date() >= dateLiberation;
}
