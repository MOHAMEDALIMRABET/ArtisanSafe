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
import { withTimeout } from './firestore-utils';
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
  
  // Ajouter un timeout de 8 secondes
  const artisanSnap = await withTimeout(getDoc(artisanRef), 8000);

  if (!artisanSnap.exists()) {
    return null;
  }

  return {
    id: artisanSnap.id,
    ...artisanSnap.data()
  } as Artisan;
}

/**
 * Récupérer un artisan par son ID de document
 */
export async function getArtisanById(artisanId: string): Promise<Artisan | null> {
  return getArtisanByUserId(artisanId); // Même logique (ID doc = userId)
}

/**
 * Obtenir les coordonnées géographiques d'une ville via API française
 */
async function getCoordinatesFromCity(ville: string, codePostal: string): Promise<{ latitude: number; longitude: number } | null> {
  try {
    const response = await fetch(
      `https://geo.api.gouv.fr/communes?nom=${encodeURIComponent(ville)}&codePostal=${codePostal}&fields=centre&limit=1`
    );
    const data = await response.json();
    
    if (data.length > 0 && data[0].centre) {
      return {
        latitude: data[0].centre.coordinates[1],
        longitude: data[0].centre.coordinates[0]
      };
    }
    return null;
  } catch (error) {
    console.error('Erreur géocodage:', error);
    return null;
  }
}

/**
 * Mettre à jour un profil artisan
 */
export async function updateArtisan(
  userId: string,
  updates: Partial<Artisan>
): Promise<void> {
  const artisanRef = doc(db, COLLECTION_NAME, userId);
  
  // Si zonesIntervention est mis à jour, enrichir avec coordonnées GPS
  if (updates.zonesIntervention && updates.zonesIntervention.length > 0) {
    const enrichedZones: ZoneIntervention[] = [];
    
    for (const zone of updates.zonesIntervention) {
      let enrichedZone = { ...zone };
      
      // Si coordonnées GPS manquantes, les récupérer
      if (!zone.latitude || !zone.longitude) {
        const coords = await getCoordinatesFromCity(zone.ville, zone.codePostal || '');
        if (coords) {
          enrichedZone = {
            ...enrichedZone,
            latitude: coords.latitude,
            longitude: coords.longitude
          };
          console.log(`📍 Coordonnées ajoutées pour ${zone.ville}: ${coords.latitude}, ${coords.longitude}`);
        }
      }
      
      enrichedZones.push(enrichedZone);
    }
    
    updates.zonesIntervention = enrichedZones;
  }
  
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
    where('verified', '==', true),
    where('emailVerified', '==', true) // Email vérifié OBLIGATOIRE
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
  const q = query(
    artisansRef,
    where('verified', '==', true),
    where('emailVerified', '==', true) // Email vérifié OBLIGATOIRE
  );
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
    where('verified', '==', false)
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
 * Récupérer tous les artisans (Admin uniquement)
 * Pour la page de vérification des documents
 * Enrichit les données avec les informations de la collection users
 */
export async function getAllArtisansForAdmin(): Promise<Artisan[]> {
  try {
    const q = query(collection(db, COLLECTION_NAME));
    const querySnapshot = await getDocs(q);
    
    // Récupérer les données artisans avec enrichissement des données users
    const artisansPromises = querySnapshot.docs.map(async (artisanDoc) => {
      const artisanData = artisanDoc.data();
      
      // Récupérer les données utilisateur depuis la collection users
      try {
        const userRef = doc(db, 'users', artisanDoc.id);
        const userSnap = await getDoc(userRef);
        
        if (userSnap.exists()) {
          const userData = userSnap.data();
          return {
            userId: artisanDoc.id,
            ...artisanData,
            // Enrichir avec les données de users
            nom: userData.nom,
            prenom: userData.prenom,
            email: userData.email,
            role: userData.role,
            telephone: userData.telephone,
            telephoneVerified: userData.telephoneVerified,
            adresse: userData.adresse,
            dateCreation: userData.dateCreation,
            emailVerified: userData.emailVerified,
            suspended: userData.suspended,
            suspensionReason: userData.suspensionReason,
            accountActions: userData.accountActions,
            adminNotes: userData.adminNotes,
          } as Artisan;
        }
      } catch (error) {
        console.error(`Erreur récupération user ${artisanDoc.id}:`, error);
      }
      
      // Si pas de données user, retourner uniquement les données artisan
      return {
        userId: artisanDoc.id,
        ...artisanData,
      } as Artisan;
    });
    
    return await Promise.all(artisansPromises);
  } catch (error) {
    console.error('Erreur récupération artisans:', error);
    throw error;
  }
}

/**
 * Vérifier si un SIRET existe déjà
 */
export async function checkSiretExists(siret: string): Promise<boolean> {
  try {
    if (!siret || siret.trim() === '') {
      return false;
    }

    const artisansRef = collection(db, COLLECTION_NAME);
    const q = query(artisansRef, where('siret', '==', siret.trim()));
    const querySnapshot = await getDocs(q);
    
    return !querySnapshot.empty;
  } catch (error) {
    console.error('Erreur vérification SIRET:', error);
    throw error;
  }
}

/**
 * Récupérer plusieurs artisans par leurs IDs
 */
export async function getArtisansByIds(userIds: string[]): Promise<Artisan[]> {
  if (!userIds || userIds.length === 0) return [];

  try {
    const artisans = await Promise.all(
      userIds.map(async (userId) => {
        const artisanRef = doc(db, COLLECTION_NAME, userId);
        const artisanSnap = await getDoc(artisanRef);
        
        if (!artisanSnap.exists()) return null;
        
        return {
          id: artisanSnap.id,
          ...artisanSnap.data()
        } as Artisan;
      })
    );

    // Filtrer les null (artisans non trouvés)
    return artisans.filter((a): a is Artisan => a !== null);
  } catch (error) {
    console.error('Erreur récupération artisans:', error);
    return [];
  }
}

/**
 * Supprimer un profil artisan (admin uniquement)
 */
export async function deleteArtisan(userId: string): Promise<void> {
  const artisanRef = doc(db, COLLECTION_NAME, userId);
  await deleteDoc(artisanRef);
}

/**
 * Récupérer les artisans qualifiés par métier et localisation
 * Utilisé pour notifier les artisans d'une nouvelle demande publique
 */
export async function getArtisansByMetierAndLocation(
  metier: string,
  ville: string,
  rayonKm: number = 50
): Promise<Artisan[]> {
  try {
    const artisansRef = collection(db, COLLECTION_NAME);
    
    // Requête simple (éviter index composite)
    const q = query(
      artisansRef,
      where('verificationStatus', '==', 'approved')
    );
    
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) {
      return [];
    }
    
    const artisans = snapshot.docs.map(doc => ({
      userId: doc.id,
      ...doc.data()
    } as Artisan));
    
    // Filtrage côté client
    const artisansFiltres = artisans.filter(artisan => {
      // Vérifier métier
      if (!artisan.metiers?.includes(metier)) {
        return false;
      }
      
      // Vérifier si actif (email vérifié)
      const { getUserById } = require('./user-service');
      // Note: Cette vérification sera async, donc on la fait après
      
      // Vérifier localisation (ville ou rayon si coordonnées disponibles)
      if (artisan.location?.city?.toLowerCase() === ville?.toLowerCase()) {
        return true;
      }
      
      // TODO: Ajouter calcul distance si coordonnées disponibles
      return false;
    });
    
    return artisansFiltres;
    
  } catch (error) {
    console.error('❌ Erreur getArtisansByMetierAndLocation:', error);
    return [];
  }
}
