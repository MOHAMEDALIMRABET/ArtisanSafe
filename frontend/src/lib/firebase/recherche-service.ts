/**
 * Service de recherche intelligente d'artisans
 * Prend en compte : métier, localisation, disponibilité, zone d'intervention
 */

import { db } from './config';
import { 
  collection, 
  query, 
  where, 
  getDocs,
  Timestamp 
} from 'firebase/firestore';
import type { Artisan, Categorie, DisponibiliteSlot } from '@/types/firestore';

interface CriteresRecherche {
  metier: Categorie;
  ville: string;
  codePostal: string;
  dateSouhaitee?: string; // Format YYYY-MM-DD
  datesFlexibles?: boolean;
  flexibiliteDays?: number; // Nombre de jours de flexibilité (ex: 7, 14, 30)
}

interface ArtisanResultat extends Artisan {
  distance?: number; // Distance en km
  disponible?: boolean;
  dateDisponible?: string;
}

/**
 * Calculer la distance entre deux points (formule de Haversine)
 * @param lat1 Latitude point 1
 * @param lon1 Longitude point 1
 * @param lat2 Latitude point 2
 * @param lon2 Longitude point 2
 * @returns Distance en kilomètres
 */
function calculerDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Rayon de la Terre en km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  
  return Math.round(distance * 10) / 10; // Arrondi à 0.1 km
}

/**
 * Obtenir les coordonnées géographiques d'une ville
 */
async function getCoordinatesFromCity(ville: string, codePostal: string): Promise<{ lat: number; lon: number } | null> {
  try {
    const response = await fetch(
      `https://geo.api.gouv.fr/communes?nom=${encodeURIComponent(ville)}&codePostal=${codePostal}&fields=centre&limit=1`
    );
    const data = await response.json();
    
    if (data.length > 0 && data[0].centre) {
      return {
        lat: data[0].centre.coordinates[1],
        lon: data[0].centre.coordinates[0]
      };
    }
    return null;
  } catch (error) {
    console.error('Erreur géocodage:', error);
    return null;
  }
}

/**
 * Vérifier si un artisan est disponible à une date donnée
 */
function verifierDisponibilite(
  disponibilites: DisponibiliteSlot[], 
  dateSouhaitee: Date,
  datesFlexibles: boolean = false,
  flexibiliteDays: number = 0
): { disponible: boolean; dateDisponible?: string } {
  // Si pas de date souhaitée, considérer comme disponible
  if (!dateSouhaitee) {
    return { disponible: true };
  }

  // Plage de dates à vérifier
  const dateDebut = new Date(dateSouhaitee);
  const dateFin = new Date(dateSouhaitee);
  
  if (datesFlexibles && flexibiliteDays > 0) {
    dateFin.setDate(dateFin.getDate() + flexibiliteDays);
  }

  // Filtrer les créneaux disponibles (disponible = true)
  const creneauxDisponibles = disponibilites.filter(slot => slot.disponible);

  // Vérifier les créneaux ponctuels
  for (const slot of creneauxDisponibles) {
    if (slot.recurrence === 'ponctuel' && slot.date) {
      const slotDate = slot.date.toDate();
      
      // Vérifier si la date du slot est dans la plage
      if (slotDate >= dateDebut && slotDate <= dateFin) {
        const dateStr = slotDate.toISOString().split('T')[0];
        return { disponible: true, dateDisponible: dateStr };
      }
    }
  }

  // Vérifier les créneaux récurrents (hebdomadaires)
  const joursSemaine = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
  
  for (let d = new Date(dateDebut); d <= dateFin; d.setDate(d.getDate() + 1)) {
    const jourName = joursSemaine[d.getDay()] as DisponibiliteSlot['jour'];
    
    const creneauJour = creneauxDisponibles.find(
      slot => slot.recurrence === 'hebdomadaire' && slot.jour === jourName
    );
    
    if (creneauJour) {
      const dateStr = d.toISOString().split('T')[0];
      return { disponible: true, dateDisponible: dateStr };
    }
  }

  return { disponible: false };
}

/**
 * Rechercher des artisans selon les critères
 */
export async function rechercherArtisans(criteres: CriteresRecherche): Promise<ArtisanResultat[]> {
  try {
    console.log('🔍 Recherche artisans avec critères:', criteres);

    // 1. Récupérer les coordonnées de la ville du client
    const coordsClient = await getCoordinatesFromCity(criteres.ville, criteres.codePostal);
    
    if (!coordsClient) {
      console.warn('Impossible de géocoder la ville du client');
    }

    // 2. Requête Firestore : filtrer par métier et statut vérifié
    const artisansRef = collection(db, 'artisans');
    const q = query(
      artisansRef,
      where('metiers', 'array-contains', criteres.metier),
      where('verified', '==', true) // Uniquement artisans vérifiés
    );

    const querySnapshot = await getDocs(q);
    const artisans: ArtisanResultat[] = [];

    // 3. Filtrer par zone géographique et disponibilité
    for (const docSnap of querySnapshot.docs) {
      const artisan = { id: docSnap.id, ...docSnap.data() } as ArtisanResultat;

      // Vérifier si l'artisan a une zone d'intervention
      if (!artisan.zonesIntervention || artisan.zonesIntervention.length === 0) {
        continue;
      }

      // Vérifier chaque zone d'intervention de l'artisan
      let dansZone = false;
      let distanceMin = Infinity;

      for (const zone of artisan.zonesIntervention) {
        // Si on a les coordonnées du client et de la zone
        if (coordsClient && zone.latitude && zone.longitude) {
          const distance = calculerDistance(
            coordsClient.lat,
            coordsClient.lon,
            zone.latitude,
            zone.longitude
          );

          // Vérifier si le client est dans le rayon
          const rayonKm = zone.rayonKm || zone.rayon || 30; // Compatibilité ancien/nouveau champ
          
          if (distance <= rayonKm) {
            dansZone = true;
            distanceMin = Math.min(distanceMin, distance);
          }
        } else {
          // Fallback : comparer les villes (moins précis)
          if (zone.ville.toLowerCase() === criteres.ville.toLowerCase()) {
            dansZone = true;
            distanceMin = 0;
          }
        }
      }

      if (!dansZone) {
        continue; // Artisan hors zone
      }

      // Ajouter la distance
      artisan.distance = distanceMin !== Infinity ? distanceMin : undefined;

      // 4. Vérifier la disponibilité si date souhaitée
      if (criteres.dateSouhaitee) {
        const dateSouhaitee = new Date(criteres.dateSouhaitee);
        const { disponible, dateDisponible } = verifierDisponibilite(
          artisan.disponibilites || [],
          dateSouhaitee,
          criteres.datesFlexibles,
          criteres.flexibiliteDays
        );

        artisan.disponible = disponible;
        artisan.dateDisponible = dateDisponible;

        // Si dates non flexibles et pas disponible, exclure
        if (!criteres.datesFlexibles && !disponible) {
          continue;
        }
      } else {
        // Pas de date spécifiée = considérer comme disponible
        artisan.disponible = true;
      }

      artisans.push(artisan);
    }

    // 5. Trier les résultats
    artisans.sort((a, b) => {
      // Priorité 1 : Disponibilité
      if (a.disponible && !b.disponible) return -1;
      if (!a.disponible && b.disponible) return 1;

      // Priorité 2 : Distance
      const distA = a.distance || 999;
      const distB = b.distance || 999;
      if (distA !== distB) return distA - distB;

      // Priorité 3 : Notation
      return (b.notation || 0) - (a.notation || 0);
    });

    console.log(`✅ ${artisans.length} artisan(s) trouvé(s)`);
    return artisans;

  } catch (error) {
    console.error('❌ Erreur recherche artisans:', error);
    throw error;
  }
}

/**
 * Fonction utilitaire pour obtenir les coordonnées d'une zone
 * (à utiliser lors de la mise à jour du profil artisan)
 */
export async function enrichirZoneAvecCoordonnees(
  ville: string, 
  codePostal: string
): Promise<{ latitude: number; longitude: number } | null> {
  return getCoordinatesFromCity(ville, codePostal);
}
