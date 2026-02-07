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
  
  // Calculer automatiquement dateExpiration si dates souhaitées fournies
  let dateExpiration: Timestamp | undefined;
  if (demandeData.datesSouhaitees?.dates?.[0]) {
    const dateClient = demandeData.datesSouhaitees.dates[0]; // Timestamp
    const flexDays = demandeData.datesSouhaitees.flexibiliteDays || 0;
    
    // Date d'expiration = date souhaitée + flexibilité
    const dateExp = new Date(dateClient.toDate());
    dateExp.setDate(dateExp.getDate() + flexDays);
    dateExp.setHours(23, 59, 59, 999); // Fin de journée
    
    dateExpiration = Timestamp.fromDate(dateExp);
    
    console.log(`📅 Date expiration calculée: ${dateExp.toLocaleDateString('fr-FR')} (date: ${dateClient.toDate().toLocaleDateString('fr-FR')} + ${flexDays} jours)`);
  }
  
  const newDemande = {
    ...demandeData,
    type: demandeData.type || 'directe' as const, // Type par défaut = 'directe' (rétrocompatibilité)
    statut: demandeData.statut || 'genere' as DemandeStatut,
    photos: demandeData.photos || [],
    photosUrls: demandeData.photosUrls || [], // URLs Firebase Storage
    devisRecus: 0,
    artisansNotifiesIds: demandeData.artisansNotifiesIds || [], // Pour demandes publiques
    artisansInteressesIds: demandeData.artisansInteressesIds || [], // Pour demandes publiques
    dateExpiration, // Calculée automatiquement
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
  // ⚠️ ÉVITER index composite : where() seul, tri en JavaScript après
  const q = query(
    demandesRef,
    where('clientId', '==', clientId)
  );
  const querySnapshot = await getDocs(q);
  
  const demandes = querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  } as Demande));

  // Tri côté client par date de création (décroissant)
  return demandes.sort((a, b) => {
    const dateA = a.dateCreation?.toMillis() || 0;
    const dateB = b.dateCreation?.toMillis() || 0;
    return dateB - dateA;
  });
}

/**
 * Récupérer les demandes matchées pour un artisan
 * ⚠️ ÉVITER index composite : where() seul, tri en JavaScript après
 * Exclut les demandes déjà attribuées à un autre artisan
 */
export async function getDemandesForArtisan(artisanId: string): Promise<Demande[]> {
  const demandesRef = collection(db, COLLECTION_NAME);
  const q = query(
    demandesRef,
    where('artisansMatches', 'array-contains', artisanId)
  );
  const querySnapshot = await getDocs(q);
  
  const demandes = querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  } as Demande));

  // Filtrage et tri côté client
  return demandes
    .filter(d => {
      // Exclure demandes attribuées
      if (d.statut === 'attribuee') return false;
      
      // Garder seulement publiée ou matchée
      return d.statut === 'publiee' || d.statut === 'matchee';
    })
    .sort((a, b) => {
      const dateA = a.dateCreation?.toMillis() || 0;
      const dateB = b.dateCreation?.toMillis() || 0;
      return dateB - dateA; // Ordre décroissant (plus récent en premier)
    });
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
 * Retirer un artisan de la liste des artisans matchés (refus de la demande)
 */
export async function removeArtisanFromDemande(
  demandeId: string,
  artisanId: string
): Promise<void> {
  const demande = await getDemandeById(demandeId);
  if (!demande) {
    throw new Error('Demande non trouvée');
  }

  // Retirer l'artisan de la liste
  const updatedMatches = (demande.artisansMatches || []).filter(id => id !== artisanId);
  
  const demandeRef = doc(db, COLLECTION_NAME, demandeId);
  await updateDoc(demandeRef, {
    artisansMatches: updatedMatches,
    dateModification: Timestamp.now(),
  });

  console.log(`✅ Artisan ${artisanId} retiré de la demande ${demandeId}`);
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
 * Récupérer les demandes publiques actives correspondant au profil d'un artisan
 * (métier + zone géographique)
 */
export async function getDemandesPubliquesForArtisan(
  artisan: { metiers: string[]; location: { city: string; coordinates?: { latitude: number; longitude: number } } }
): Promise<Demande[]> {
  try {
    const demandesRef = collection(db, COLLECTION_NAME);
    
    // Requête simple (éviter index composite)
    const q = query(
      demandesRef,
      where('type', '==', 'publique'),
      where('statut', '==', 'publiee')
    );
    
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) {
      return [];
    }
    
    const demandes = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as Demande));
    
    // Filtrage côté client par métier
    const demandesFiltrees = demandes.filter(d => {
      // Vérifier si un des métiers de l'artisan correspond
      const metierMatch = artisan.metiers.some(metier => 
        d.critereRecherche?.metier === metier
      );
      
      if (!metierMatch) return false;
      
      // Vérifier distance si coordonnées disponibles
      if (d.localisation?.coordonneesGPS && artisan.location?.coordinates) {
        const { calculateDistance } = require('./matching-service');
        const distance = calculateDistance(
          d.localisation.coordonneesGPS.latitude,
          d.localisation.coordonneesGPS.longitude,
          artisan.location.coordinates.latitude,
          artisan.location.coordinates.longitude
        );
        const rayon = d.critereRecherche?.rayon || 50;
        return distance <= rayon;
      }
      
      // Sinon vérifier ville
      return d.localisation?.ville?.toLowerCase() === artisan.location.city?.toLowerCase();
    });
    
    // Tri par date de création (plus récentes en premier)
    return demandesFiltrees.sort((a, b) => {
      const dateA = a.dateCreation?.toMillis() || 0;
      const dateB = b.dateCreation?.toMillis() || 0;
      return dateB - dateA;
    });
    
  } catch (error) {
    console.error('❌ Erreur récupération demandes publiques:', error);
    return [];
  }
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

/**
 * Marquer qu'un artisan a consulté une demande publique
 * Ajoute l'artisan à artisansInteressesIds
 */
export async function markDemandeAsViewed(demandeId: string, artisanId: string): Promise<void> {
  try {
    const demandeRef = doc(db, COLLECTION_NAME, demandeId);
    const demandeSnap = await getDoc(demandeRef);
    
    if (!demandeSnap.exists()) {
      console.warn(`⚠️ Demande ${demandeId} n'existe pas`);
      return;
    }
    
    const demande = demandeSnap.data() as Demande;
    const artisansInteressesIds = demande.artisansInteressesIds || [];
    
    // Ajouter seulement si pas déjà présent
    if (!artisansInteressesIds.includes(artisanId)) {
      await updateDoc(demandeRef, {
        artisansInteressesIds: [...artisansInteressesIds, artisanId],
        dateModification: Timestamp.now()
      });
      console.log(`✅ Artisan ${artisanId} marqué comme intéressé par demande ${demandeId}`);
    }
  } catch (error) {
    console.error('❌ Erreur markDemandeAsViewed:', error);
  }
}

/**
 * Notifier les artisans qualifiés qu'une nouvelle demande publique est disponible
 * Retourne les IDs des artisans notifiés
 */
export async function notifyQualifiedArtisans(demandeId: string): Promise<string[]> {
  try {
    const demandeRef = doc(db, COLLECTION_NAME, demandeId);
    const demandeSnap = await getDoc(demandeRef);
    
    if (!demandeSnap.exists()) {
      console.warn(`⚠️ Demande ${demandeId} n'existe pas`);
      return [];
    }
    
    const demande = demandeSnap.data() as Demande;
    
    if (demande.type !== 'publique') {
      console.warn(`⚠️ Demande ${demandeId} n'est pas publique`);
      return [];
    }
    
    // Récupérer tous les artisans qualifiés
    const { getArtisansByMetierAndLocation } = await import('./artisan-service');
    const artisansQualifies = await getArtisansByMetierAndLocation(
      demande.critereRecherche?.metier || demande.categorie,
      demande.localisation?.ville || '',
      demande.critereRecherche?.rayon || 50
    );
    
    const artisansIds = artisansQualifies.map(a => a.userId);
    
    if (artisansIds.length === 0) {
      console.log('ℹ️ Aucun artisan qualifié trouvé');
      return [];
    }
    
    // Créer notifications pour chaque artisan
    const { createNotification } = await import('./notification-service');
    
    for (const artisanId of artisansIds) {
      await createNotification({
        recipientId: artisanId,
        type: 'nouvelle_demande_publique',
        title: '📢 Nouvelle demande publique',
        message: `Nouvelle demande de ${demande.categorie} à ${demande.localisation?.ville}`,
        relatedId: demandeId,
        isRead: false,
      });
    }
    
    // Enregistrer les artisans notifiés
    await updateDoc(demandeRef, {
      artisansNotifiesIds: artisansIds,
      dateModification: Timestamp.now()
    });
    
    console.log(`✅ ${artisansIds.length} artisans notifiés pour demande ${demandeId}`);
    return artisansIds;
    
  } catch (error) {
    console.error('❌ Erreur notifyQualifiedArtisans:', error);
    return [];
  }
}
