import { db } from './config';
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import type { Artisan, Demande, MatchingResult, MatchingCriteria } from '@/types/firestore';
import { isArtisanDisponible } from './artisan-service';

/**
 * Calcule la distance entre deux points GPS (formule de Haversine)
 * @param lat1 Latitude point 1
 * @param lon1 Longitude point 1
 * @param lat2 Latitude point 2
 * @param lon2 Longitude point 2
 * @returns Distance en kilomètres
 */
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Rayon de la Terre en km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Vérifie si l'artisan est dans la zone d'intervention
 * @param artisan Profil artisan
 * @param demande Demande client
 * @returns true si dans la zone
 */
function isInZone(artisan: Artisan, demande: Demande): boolean {
  if (!artisan.zonesIntervention || artisan.zonesIntervention.length === 0) {
    return false;
  }

  // Vérifier si la ville correspond ou si dans le rayon
  for (const zone of artisan.zonesIntervention) {
    // Match exacte de ville
    if (zone.ville.toLowerCase() === demande.localisation.ville.toLowerCase()) {
      return true;
    }

    // Vérification par GPS si disponible
    if (zone.coordonneesGPS && demande.localisation.coordonneesGPS) {
      const distance = calculateDistance(
        zone.coordonneesGPS.latitude,
        zone.coordonneesGPS.longitude,
        demande.localisation.coordonneesGPS.latitude,
        demande.localisation.coordonneesGPS.longitude
      );
      
      if (distance <= zone.rayonKm) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Calcule le score de distance (plus proche = meilleur score)
 * @param artisan Profil artisan
 * @param demande Demande client
 * @returns Score de 0 à 50
 */
function calculateDistanceScore(artisan: Artisan, demande: Demande): number {
  if (!artisan.zonesIntervention || artisan.zonesIntervention.length === 0) {
    return 0;
  }

  if (!demande.localisation.coordonneesGPS) {
    // Si pas de GPS, score basique si ville match
    const villeMatch = artisan.zonesIntervention.some(
      (zone) => zone.ville.toLowerCase() === demande.localisation.ville.toLowerCase()
    );
    return villeMatch ? 25 : 0;
  }

  // Trouver la zone la plus proche
  let minDistance = Infinity;
  for (const zone of artisan.zonesIntervention) {
    if (zone.coordonneesGPS) {
      const distance = calculateDistance(
        zone.coordonneesGPS.latitude,
        zone.coordonneesGPS.longitude,
        demande.localisation.coordonneesGPS.latitude,
        demande.localisation.coordonneesGPS.longitude
      );
      minDistance = Math.min(minDistance, distance);
    }
  }

  if (minDistance === Infinity) return 0;

  // Score décroissant avec la distance (max 50 points)
  // 0-5km: 50 points, 5-10km: 40 points, 10-20km: 30 points, 20-30km: 20 points, 30+km: 10 points
  if (minDistance <= 5) return 50;
  if (minDistance <= 10) return 40;
  if (minDistance <= 20) return 30;
  if (minDistance <= 30) return 20;
  return 10;
}

/**
 * Calcule le score de disponibilité (CORE FEATURE)
 * @param artisan Profil artisan
 * @param demande Demande client
 * @returns Score de 0 à 50
 */
async function calculateDisponibiliteScore(artisan: Artisan, demande: Demande): Promise<number> {
  if (!demande.datesSouhaitees || demande.datesSouhaitees.dates.length === 0) {
    return 0;
  }

  const dates = demande.datesSouhaitees.dates.map(ts => ts.toDate());
  let matchCount = 0;
  let totalDates = dates.length;

  // Si flexible, étendre les dates avec la flexibilité
  if (demande.datesSouhaitees.flexible && demande.datesSouhaitees.flexibiliteDays) {
    const flexDays = demande.datesSouhaitees.flexibiliteDays;
    const extendedDates: Date[] = [];

    for (const date of dates) {
      // Ajouter dates avant
      for (let i = -flexDays; i <= flexDays; i++) {
        const newDate = new Date(date);
        newDate.setDate(newDate.getDate() + i);
        extendedDates.push(newDate);
      }
    }

    // Vérifier combien de dates matchent
    for (const date of extendedDates) {
      const dispo = await isArtisanDisponible(artisan, Timestamp.fromDate(date));
      if (dispo) {
        matchCount++;
      }
    }

    totalDates = extendedDates.length;
  } else {
    // Dates fixes
    for (const date of dates) {
      const dispo = await isArtisanDisponible(artisan, Timestamp.fromDate(date));
      if (dispo) {
        matchCount++;
      }
    }
  }

  // Score proportionnel au taux de match
  const matchRate = matchCount / totalDates;
  return Math.round(matchRate * 50);
}

/**
 * Calcule le score de notation (réputation artisan)
 * @param artisan Profil artisan
 * @returns Score de 0 à 50
 */
function calculateNotationScore(artisan: Artisan): number {
  if (!artisan.notation || artisan.nombreAvis === 0) {
    return 0; // Pas encore noté
  }

  // Score basé sur la note (0-5 étoiles → 0-50 points)
  const baseScore = (artisan.notation / 5) * 40;

  // Bonus pour nombre d'avis (fiabilité)
  let bonusAvis = 0;
  if (artisan.nombreAvis >= 50) bonusAvis = 10;
  else if (artisan.nombreAvis >= 20) bonusAvis = 7;
  else if (artisan.nombreAvis >= 10) bonusAvis = 5;
  else if (artisan.nombreAvis >= 5) bonusAvis = 3;

  return Math.round(baseScore + bonusAvis);
}

/**
 * Matching principal - Trouve les artisans correspondants
 * @param criteria Critères de recherche
 * @returns Liste d'artisans matchés avec score
 */
export async function matchArtisans(criteria: MatchingCriteria): Promise<MatchingResult[]> {
  try {
    // 1. Requête Firestore: artisans vérifiés + catégorie matching
    const artisansRef = collection(db, 'artisans');
    const q = query(
      artisansRef,
      where('badgeVerifie', '==', true),
      where('statut', '==', 'actif'),
      where('metiers', 'array-contains', criteria.categorie)
    );

    const snapshot = await getDocs(q);
    if (snapshot.empty) {
      return [];
    }

    // 2. Créer une demande temporaire pour le scoring
    const tempDemande: Partial<Demande> = {
      categorie: criteria.categorie,
      localisation: {
        adresse: criteria.adresse || '',
        ville: criteria.ville,
        codePostal: criteria.codePostal,
        coordonneesGPS: criteria.coordonneesGPS,
      },
      datesSouhaitees: {
        dates: criteria.dates.map(d => Timestamp.fromDate(new Date(d))),
        flexible: criteria.flexible,
        flexibiliteDays: criteria.flexibiliteDays,
      },
      urgence: criteria.urgence,
    };

    // 3. Calculer le score pour chaque artisan
    const results: MatchingResult[] = [];

    for (const doc of snapshot.docs) {
      const artisan = { id: doc.id, ...doc.data() } as Artisan;

      // Filtre: doit être dans la zone
      if (!isInZone(artisan, tempDemande as Demande)) {
        continue;
      }

      // Calcul des scores
      const metierScore = 100; // Match catégorie garanti par la query
      const distanceScore = calculateDistanceScore(artisan, tempDemande as Demande);
      const disponibiliteScore = await calculateDisponibiliteScore(artisan, tempDemande as Demande);
      const notationScore = calculateNotationScore(artisan);
      
      // Bonus urgence: si artisan a capacité disponible immédiatement
      let urgenceScore = 0;
      if (criteria.urgence === 'urgent') {
        // Vérifier si dispo dans les 3 prochains jours
        const today = new Date();
        for (let i = 0; i < 3; i++) {
          const checkDate = new Date(today);
          checkDate.setDate(checkDate.getDate() + i);
          const dispo = await isArtisanDisponible(artisan, Timestamp.fromDate(checkDate));
          if (dispo) {
            urgenceScore = 20;
            break;
          }
        }
      } else if (criteria.urgence === 'normale') {
        urgenceScore = 10; // Score neutre
      } else {
        urgenceScore = 5;
      }

      // Score total (max 320 points)
      const scoreTotal = 
        metierScore + 
        distanceScore + 
        disponibiliteScore + 
        notationScore + 
        urgenceScore;

      results.push({
        artisan,
        score: scoreTotal,
        details: {
          metierMatch: metierScore,
          distanceScore,
          disponibiliteScore,
          notationScore,
          urgenceMatch: urgenceScore,
        },
      });
    }

    // 4. Trier par score décroissant et retourner top 10
    results.sort((a, b) => b.score - a.score);
    return results.slice(0, 10);

  } catch (error) {
    console.error('Erreur matching artisans:', error);
    throw new Error('Impossible de trouver des artisans correspondants');
  }
}

/**
 * Récupère les artisans disponibles pour une date spécifique
 * @param categorie Catégorie de métier
 * @param date Date souhaitée
 * @param ville Ville du chantier
 * @returns Liste d'artisans disponibles
 */
export async function getArtisansDisponibles(
  categorie: string,
  date: Date,
  ville: string
): Promise<Artisan[]> {
  const artisansRef = collection(db, 'artisans');
  const q = query(
    artisansRef,
    where('badgeVerifie', '==', true),
    where('statut', '==', 'actif'),
    where('metiers', 'array-contains', categorie)
  );

  const snapshot = await getDocs(q);
  const disponibles: Artisan[] = [];

  for (const doc of snapshot.docs) {
    const artisan = { id: doc.id, ...doc.data() } as Artisan;
    
    // Vérifier zone
    const inZone = artisan.zonesIntervention?.some(
      (zone) => zone.ville.toLowerCase() === ville.toLowerCase()
    );
    if (!inZone) continue;

    // Vérifier disponibilité
    const dispo = await isArtisanDisponible(artisan, Timestamp.fromDate(date));
    if (dispo) {
      disponibles.push(artisan);
    }
  }

  return disponibles;
}

/**
 * Calcule la distance minimale entre un artisan et une localisation
 * @param artisan Profil artisan
 * @param lat Latitude destination
 * @param lon Longitude destination
 * @returns Distance en km (ou null si pas de GPS)
 */
export function getDistanceToArtisan(
  artisan: Artisan,
  lat: number,
  lon: number
): number | null {
  if (!artisan.zonesIntervention || artisan.zonesIntervention.length === 0) {
    return null;
  }

  let minDistance = Infinity;
  for (const zone of artisan.zonesIntervention) {
    if (zone.coordonneesGPS) {
      const distance = calculateDistance(
        zone.coordonneesGPS.latitude,
        zone.coordonneesGPS.longitude,
        lat,
        lon
      );
      minDistance = Math.min(minDistance, distance);
    }
  }

  return minDistance === Infinity ? null : Math.round(minDistance * 10) / 10;
}
