/**
 * Service Firebase pour la gestion des disponibilités artisan
 */

import { db } from './config';
import { 
  collection, 
  doc, 
  getDoc, 
  updateDoc, 
  arrayUnion,
  arrayRemove,
  Timestamp 
} from 'firebase/firestore';
import type { DisponibiliteSlot } from '@/types/firestore';

/**
 * Récupérer les disponibilités d'un artisan
 */
export async function getDisponibilites(artisanId: string): Promise<DisponibiliteSlot[]> {
  try {
    const artisanRef = doc(db, 'artisans', artisanId);
    const artisanSnap = await getDoc(artisanRef);
    
    if (!artisanSnap.exists()) {
      console.error('Artisan non trouvé:', artisanId);
      return [];
    }
    
    const data = artisanSnap.data();
    return data.disponibilites || [];
  } catch (error) {
    console.error('Erreur récupération disponibilités:', error);
    throw error;
  }
}

/**
 * Ajouter une disponibilité
 */
export async function addDisponibilite(
  artisanId: string, 
  disponibilite: Omit<DisponibiliteSlot, 'id' | 'dateCreation'>
): Promise<void> {
  try {
    const artisanRef = doc(db, 'artisans', artisanId);
    
    const newDisponibilite: DisponibiliteSlot = {
      ...disponibilite,
      id: `dispo_${Date.now()}`,
      dateCreation: Timestamp.now()
    };
    
    await updateDoc(artisanRef, {
      disponibilites: arrayUnion(newDisponibilite)
    });
    
    console.log('Disponibilité ajoutée:', newDisponibilite.id);
  } catch (error) {
    console.error('Erreur ajout disponibilité:', error);
    throw error;
  }
}

/**
 * Supprimer une disponibilité
 */
export async function removeDisponibilite(
  artisanId: string, 
  disponibiliteId: string
): Promise<void> {
  try {
    // Récupérer les disponibilités actuelles
    const disponibilites = await getDisponibilites(artisanId);
    
    // Trouver la disponibilité à supprimer
    const dispoToRemove = disponibilites.find(d => d.id === disponibiliteId);
    
    if (!dispoToRemove) {
      console.warn('Disponibilité non trouvée:', disponibiliteId);
      return;
    }
    
    const artisanRef = doc(db, 'artisans', artisanId);
    
    await updateDoc(artisanRef, {
      disponibilites: arrayRemove(dispoToRemove)
    });
    
    console.log('Disponibilité supprimée:', disponibiliteId);
  } catch (error) {
    console.error('Erreur suppression disponibilité:', error);
    throw error;
  }
}

/**
 * Mettre à jour une disponibilité
 */
export async function updateDisponibilite(
  artisanId: string, 
  disponibiliteId: string,
  updates: Partial<DisponibiliteSlot>
): Promise<void> {
  try {
    // Récupérer les disponibilités actuelles
    const disponibilites = await getDisponibilites(artisanId);
    
    // Trouver l'index de la disponibilité
    const index = disponibilites.findIndex(d => d.id === disponibiliteId);
    
    if (index === -1) {
      throw new Error(`Disponibilité ${disponibiliteId} non trouvée`);
    }
    
    // Mettre à jour la disponibilité
    disponibilites[index] = {
      ...disponibilites[index],
      ...updates
    };
    
    const artisanRef = doc(db, 'artisans', artisanId);
    
    await updateDoc(artisanRef, {
      disponibilites: disponibilites
    });
    
    console.log('Disponibilité mise à jour:', disponibiliteId);
  } catch (error) {
    console.error('Erreur mise à jour disponibilité:', error);
    throw error;
  }
}

/**
 * Remplacer toutes les disponibilités d'un artisan
 */
export async function setDisponibilites(
  artisanId: string, 
  disponibilites: DisponibiliteSlot[]
): Promise<void> {
  try {
    const artisanRef = doc(db, 'artisans', artisanId);
    
    // Ajouter IDs et dateCreation si manquants
    const processedDisponibilites = disponibilites.map(dispo => ({
      ...dispo,
      id: dispo.id || `dispo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      dateCreation: dispo.dateCreation || Timestamp.now()
    }));
    
    await updateDoc(artisanRef, {
      disponibilites: processedDisponibilites
    });
    
    console.log(`${processedDisponibilites.length} disponibilités sauvegardées`);
  } catch (error) {
    console.error('Erreur sauvegarde disponibilités:', error);
    throw error;
  }
}

/**
 * Vérifier si un créneau chevauche d'autres créneaux
 */
export function checkChevauchement(
  newSlot: Pick<DisponibiliteSlot, 'jour' | 'date' | 'heureDebut' | 'heureFin' | 'recurrence'>,
  existingSlots: DisponibiliteSlot[]
): boolean {
  return existingSlots.some(slot => {
    // Si récurrence différente, pas de chevauchement
    if (slot.recurrence !== newSlot.recurrence) {
      return false;
    }
    
    // Pour récurrence hebdomadaire, comparer les jours
    if (newSlot.recurrence === 'hebdomadaire' && slot.jour === newSlot.jour) {
      return chevauchementHoraire(newSlot.heureDebut, newSlot.heureFin, slot.heureDebut, slot.heureFin);
    }
    
    // Pour créneaux ponctuels, comparer les dates
    if (newSlot.recurrence === 'ponctuel' && newSlot.date && slot.date) {
      const sameDay = newSlot.date.toDate().toDateString() === slot.date.toDate().toDateString();
      if (sameDay) {
        return chevauchementHoraire(newSlot.heureDebut, newSlot.heureFin, slot.heureDebut, slot.heureFin);
      }
    }
    
    return false;
  });
}

/**
 * Vérifier si deux plages horaires se chevauchent
 */
function chevauchementHoraire(
  debut1: string, 
  fin1: string, 
  debut2: string, 
  fin2: string
): boolean {
  const [h1Start, m1Start] = debut1.split(':').map(Number);
  const [h1End, m1End] = fin1.split(':').map(Number);
  const [h2Start, m2Start] = debut2.split(':').map(Number);
  const [h2End, m2End] = fin2.split(':').map(Number);
  
  const minutes1Start = h1Start * 60 + m1Start;
  const minutes1End = h1End * 60 + m1End;
  const minutes2Start = h2Start * 60 + m2Start;
  const minutes2End = h2End * 60 + m2End;
  
  return minutes1Start < minutes2End && minutes1End > minutes2Start;
}

// Exports
export const disponibiliteService = {
  getDisponibilites,
  addDisponibilite,
  removeDisponibilite,
  updateDisponibilite,
  setDisponibilites,
  checkChevauchement
};
