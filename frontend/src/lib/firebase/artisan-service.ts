/**
 * Service de gestion des artisans
 * CRUD operations pour la collection 'artisans'
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  Timestamp,
  arrayUnion,
  arrayRemove,
} from 'firebase/firestore';
import { db } from './config';
import type { 
  Artisan, 
  CreateDocument, 
  UpdateDocument,
  Categorie,
  ZoneIntervention,
  Disponibilite 
} from '@/types/firestore';

const COLLECTION_NAME = 'artisans';

/**
 * Créer un profil artisan
 */
export async function createArtisan(
  artisanData: CreateDocument<Artisan> & { userId: string }
): Promise<Artisan> {
  const artisanRef = doc(db, COLLECTION_NAME, artisanData.userId);
  
  // Filtrer les valeurs undefined
  const cleanData = Object.fromEntries(
    Object.entries(artisanData).filter(([_, v]) => v !== undefined)
  );
  
  const newArtisan: Artisan = {
    ...cleanData,
    notation: 0,
    nombreAvis: 0,
    documentsVerifies: false,
    badgeVerifie: false,
    disponibilites: artisanData.disponibilites || [],
  } as Artisan;

  await setDoc(artisanRef, newArtisan);
  return newArtisan;
}

/**
 * Récupérer un artisan par son userId
 */
export async function getArtisanByUserId(userId: string): Promise<Artisan | null> {
  const artisanRef = doc(db, COLLECTION_NAME, userId);
  const artisanSnap = await getDoc(artisanRef);

  if (!artisanSnap.exists()) {
    return null;
  }

  return {
    id: artisanSnap.id,
    ...artisanSnap.data()
  } as Artisan;
}

/**
 * Mettre à jour un profil artisan
 */
export async function updateArtisan(
  userId: string,
  updates: Partial<Artisan>
): Promise<void> {
  const artisanRef = doc(db, COLLECTION_NAME, userId);
  
  // Filtrer les valeurs undefined
  const cleanUpdates = Object.fromEntries(
    Object.entries(updates).filter(([_, v]) => v !== undefined)
  );
  
  await updateDoc(artisanRef, cleanUpdates);
}

/**
 * Ajouter un métier à un artisan
 */
export async function addMetier(
  userId: string,
  metier: Categorie
): Promise<void> {
  const artisanRef = doc(db, COLLECTION_NAME, userId);
  await updateDoc(artisanRef, {
    metiers: arrayUnion(metier)
  });
}

/**
 * Retirer un métier d'un artisan
 */
export async function removeMetier(
  userId: string,
  metier: Categorie
): Promise<void> {
  const artisanRef = doc(db, COLLECTION_NAME, userId);
  await updateDoc(artisanRef, {
    metiers: arrayRemove(metier)
  });
}

/**
 * Ajouter une zone d'intervention
 */
export async function addZoneIntervention(
  userId: string,
  zone: ZoneIntervention
): Promise<void> {
  const artisanRef = doc(db, COLLECTION_NAME, userId);
  await updateDoc(artisanRef, {
    zonesIntervention: arrayUnion(zone)
  });
}

/**
 * Mettre à jour les disponibilités
 */
export async function updateDisponibilites(
  userId: string,
  disponibilites: Disponibilite[]
): Promise<void> {
  const artisanRef = doc(db, COLLECTION_NAME, userId);
  await updateDoc(artisanRef, { disponibilites });
}

/**
 * Ajouter une disponibilité
 */
export async function addDisponibilite(
  userId: string,
  disponibilite: Disponibilite
): Promise<void> {
  const artisanRef = doc(db, COLLECTION_NAME, userId);
  await updateDoc(artisanRef, {
    disponibilites: arrayUnion(disponibilite)
  });
}

/**
 * Marquer un artisan comme vérifié
 */
export async function verifyArtisan(userId: string): Promise<void> {
  const artisanRef = doc(db, COLLECTION_NAME, userId);
  await updateDoc(artisanRef, {
    badgeVerifie: true,
    documentsVerifies: true,
    dateVerification: Timestamp.now(),
  });
}

/**
 * Mettre à jour la notation d'un artisan
 */
export async function updateNotation(
  userId: string,
  nouvelleNote: number
): Promise<void> {
  const artisan = await getArtisanByUserId(userId);
  if (!artisan) throw new Error('Artisan non trouvé');

  const totalNotes = artisan.notation * artisan.nombreAvis;
  const nouveauNombreAvis = artisan.nombreAvis + 1;
  const nouvelleNotationMoyenne = (totalNotes + nouvelleNote) / nouveauNombreAvis;

  const artisanRef = doc(db, COLLECTION_NAME, userId);
  await updateDoc(artisanRef, {
    notation: nouvelleNotationMoyenne,
    nombreAvis: nouveauNombreAvis,
  });
}

/**
 * Rechercher des artisans par métier
 */
export async function searchArtisansByMetier(metier: Categorie): Promise<Artisan[]> {
  const artisansRef = collection(db, COLLECTION_NAME);
  const q = query(
    artisansRef,
    where('metiers', 'array-contains', metier),
    where('badgeVerifie', '==', true)
  );
  const querySnapshot = await getDocs(q);
  
  return querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  } as Artisan));
}

/**
 * Récupérer tous les artisans vérifiés
 */
export async function getVerifiedArtisans(): Promise<Artisan[]> {
  const artisansRef = collection(db, COLLECTION_NAME);
  const q = query(artisansRef, where('badgeVerifie', '==', true));
  const querySnapshot = await getDocs(q);
  
  return querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  } as Artisan));
}

/**
 * Récupérer les artisans en attente de vérification
 */
export async function getPendingArtisans(): Promise<Artisan[]> {
  const artisansRef = collection(db, COLLECTION_NAME);
  const q = query(
    artisansRef,
    where('documentsVerifies', '==', false)
  );
  const querySnapshot = await getDocs(q);
  
  return querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  } as Artisan));
}

/**
 * Vérifier si un artisan est disponible à une date donnée
 */
export function isArtisanDisponible(
  artisan: Artisan,
  date: string // YYYY-MM-DD
): boolean {
  const dispo = artisan.disponibilites.find(d => d.date === date);
  return dispo ? dispo.disponible : false;
}

/**
 * Supprimer un profil artisan (admin uniquement)
 */
export async function deleteArtisan(userId: string): Promise<void> {
  const artisanRef = doc(db, COLLECTION_NAME, userId);
  await deleteDoc(artisanRef);
}
