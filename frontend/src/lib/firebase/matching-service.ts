import { db } from './config';
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import type { Artisan, Demande, MatchingResult, MatchingCriteria } from '@/types/firestore';

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
  console.log(`  🗺️  Vérif zone - Client à: ${demande.localisation.ville} ${demande.localisation.codePostal}`);
  
  if (!artisan.zonesIntervention || artisan.zonesIntervention.length === 0) {
    console.log(`  ⚠️  Pas de zone d'intervention définie → ACCEPTER par défaut (artisan disponible partout)`);
    return true; // ✅ CHANGEMENT: Accepter par défaut si pas de zones définies
  }

  const clientVille = demande.localisation.ville.toLowerCase().trim();
  const clientCP = demande.localisation.codePostal?.trim() || '';

  // Vérifier si la ville/CP correspond ou si dans le rayon
  for (const zone of artisan.zonesIntervention) {
    console.log(`  🔍 Zone artisan: ${zone.ville}, rayon: ${zone.rayonKm || zone.rayon || 30}km`);
    console.log(`  📍 Coords artisan: lat=${zone.latitude}, lon=${zone.longitude}`);
    console.log(`  📍 Coords client:`, demande.localisation.coordonneesGPS);
    
    const zoneVille = zone.ville.toLowerCase().trim();
    
    // Match exacte de ville
    if (zoneVille === clientVille) {
      console.log(`  ✅ MATCH ville exacte: ${zone.ville}`);
      return true;
    }

    // ✅ NOUVEAU: Match par code postal (département)
    if (clientCP.length >= 2 && zone.codePostal) {
      const departementClient = clientCP.substring(0, 2);
      const departementZone = zone.codePostal.substring(0, 2);
      if (departementClient === departementZone) {
        console.log(`  ✅ MATCH département: ${departementClient}`);
        return true;
      }
    }

    // Vérification par GPS si disponible
    if (zone.latitude && zone.longitude && demande.localisation.coordonneesGPS) {
      const distance = calculateDistance(
        zone.latitude,
        zone.longitude,
        demande.localisation.coordonneesGPS.latitude,
        demande.localisation.coordonneesGPS.longitude
      );
      
      const rayonKm = zone.rayonKm || zone.rayon || 30;
      
      console.log(`  📏 Distance calculée: ${distance.toFixed(2)}km (rayon: ${rayonKm}km)`);
      
      if (distance <= rayonKm) {
        console.log(`  ✅ MATCH GPS: dans le rayon`);
        return true;
      } else {
        console.log(`  ❌ Hors rayon: ${distance.toFixed(2)}km > ${rayonKm}km`);
      }
    } else {
      console.log(`  ⚠️  Coordonnées GPS manquantes`);
    }
  }

  console.log(`  ❌ Aucune zone ne correspond`);
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
    if (zone.latitude && zone.longitude) {
      const distance = calculateDistance(
        zone.latitude,
        zone.longitude,
        demande.localisation.coordonneesGPS.latitude,
        demande.localisation.coordonneesGPS.longitude
      );
      minDistance = Math.min(minDistance, distance);
    }
  }

  if (minDistance === Infinity) return 0;

  // Score décroissant avec la distance (max 50 points)
  // 0-5km: 50 points, 5-10km: 40 points, 10-20km: 30 points, 20-30km: 20 points, 30+km: 10 points
  console.log(`  📏 Distance minimale calculée: ${minDistance.toFixed(2)} km`);
  
  if (minDistance <= 5) return 50;
  if (minDistance <= 10) return 40;
  if (minDistance <= 20) return 30;
  if (minDistance <= 30) return 20;
  return 10;
}

function getMinDistanceToClient(artisan: Artisan, demande: Demande): number | null {
  if (!demande.localisation.coordonneesGPS) {
    return null;
  }

  if (!artisan.zonesIntervention || artisan.zonesIntervention.length === 0) {
    return null;
  }

  let minDistance = Infinity;
  for (const zone of artisan.zonesIntervention) {
    if (zone.latitude && zone.longitude) {
      const distance = calculateDistance(
        zone.latitude,
        zone.longitude,
        demande.localisation.coordonneesGPS.latitude,
        demande.localisation.coordonneesGPS.longitude
      );
      minDistance = Math.min(minDistance, distance);
    }
  }

  return minDistance === Infinity ? null : minDistance;
}

/**
 * Vérifie si un artisan est disponible à une date donnée (basé sur les slots d'agenda)
 * LOGIQUE CORRECTE : Disponible PAR DÉFAUT, sauf si indisponibilité marquée
 * @param artisan Profil artisan
 * @param date Date à vérifier
 * @returns true si disponible
 */
function isArtisanDisponibleDate(artisan: Artisan, date: Date): boolean {
  console.log(`  📅 Vérif dispo pour ${date.toISOString().split('T')[0]}`);
  
  // Si pas de disponibilités définies → DISPONIBLE par défaut
  if (!artisan.disponibilites || artisan.disponibilites.length === 0) {
    console.log(`  ✅ Pas d'agenda défini → Disponible par défaut`);
    return true;
  }

  const joursSemaine = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
  const jourName = joursSemaine[date.getDay()] as any;
  console.log(`  📆 Jour de la semaine: ${jourName} (${date.getDay()})`);

  // Vérifier les créneaux INDISPONIBLES (disponible = false = occupé)
  const creneauxOccupes = artisan.disponibilites.filter(slot => !slot.disponible);
  console.log(`  🔒 ${creneauxOccupes.length} créneau(x) occupé(s) sur ${artisan.disponibilites.length}`);

  // 1. Vérifier les indisponibilités ponctuelles
  for (const slot of creneauxOccupes) {
    if (slot.recurrence === 'ponctuel' && slot.date) {
      const slotDate = slot.date.toDate();
      const slotDateStr = slotDate.toISOString().split('T')[0];
      const checkDateStr = date.toISOString().split('T')[0];
      
      console.log(`  🔍 Indisponibilité ponctuelle: ${slotDateStr} vs ${checkDateStr}`);
      
      if (slotDateStr === checkDateStr) {
        console.log(`  ❌ INDISPONIBLE (créneau occupé trouvé)`);
        return false;
      }
    }
  }

  // 2. Vérifier les indisponibilités hebdomadaires récurrentes
  const creneauOccupeJour = creneauxOccupes.find(
    slot => slot.recurrence === 'hebdomadaire' && slot.jour === jourName
  );

  if (creneauOccupeJour) {
    console.log(`  ❌ INDISPONIBLE (${jourName} récurrent occupé)`);
    return false;
  }

  console.log(`  ✅ DISPONIBLE (aucune indisponibilité trouvée)`);
  return true;
}

/**
 * Calcule le score de disponibilité (CORE FEATURE - basé sur agenda)
 * @param artisan Profil artisan
 * @param demande Demande client
 * @returns Score de 0 à 50
 */
function calculateDisponibiliteScore(artisan: Artisan, demande: Demande): number {
  console.log(`  📅 Calcul score disponibilité...`);
  
  if (!demande.datesSouhaitees || demande.datesSouhaitees.dates.length === 0) {
    console.log(`  ⚠️  Pas de dates souhaitées → score=0`);
    return 0;
  }

  const dates = demande.datesSouhaitees.dates.map(ts => ts.toDate());
  console.log(`  📆 Dates à vérifier:`, dates.map(d => d.toISOString().split('T')[0]));
  let matchCount = 0;
  let totalDates = dates.length;

  // Si flexible, étendre les dates avec la flexibilité
  if (demande.datesSouhaitees.flexible && demande.datesSouhaitees.flexibiliteDays) {
    const flexDays = demande.datesSouhaitees.flexibiliteDays;
    const extendedDates: Date[] = [];

    for (const date of dates) {
      // Ajouter dates dans la fenêtre de flexibilité (AVANT et APRÈS)
      for (let i = -flexDays; i <= flexDays; i++) {
        const newDate = new Date(date);
        newDate.setDate(newDate.getDate() + i);
        extendedDates.push(newDate);
      }
    }

    // Vérifier combien de dates matchent
    for (const date of extendedDates) {
      if (isArtisanDisponibleDate(artisan, date)) {
        matchCount++;
      }
    }

    totalDates = extendedDates.length;
  } else {
    // Dates fixes
    for (const date of dates) {
      if (isArtisanDisponibleDate(artisan, date)) {
        matchCount++;
      }
    }
  }

  // Score proportionnel au taux de match
  const matchRate = matchCount / totalDates;
  const score = Math.round(matchRate * 50);
  
  console.log(`  📊 Résultat: ${matchCount}/${totalDates} dates matchées → score=${score}/50`);
  
  // ✅ BONUS: Si aucune dispo définie ou score=0, donner un score minimum (25) pour afficher quand même
  if (score === 0 && (!artisan.disponibilites || artisan.disponibilites.length === 0)) {
    console.log(`  ⚠️  Pas d'agenda → score bonus=25 (artisan joignable)`);
    return 25; // Score minimum pour artisans sans agenda défini
  }
  
  return score;
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
    console.log('🔍 Lancement du matching avec critères:', criteria);

    // 1. Requête Firestore: artisans vérifiés + catégorie matching
    const artisansRef = collection(db, 'artisans');
    
    // ✅ SIMPLIFICATION: D'abord récupérer tous les artisans vérifiés, puis filtrer manuellement
    // Car le where('metiers', 'array-contains') peut échouer si le champ n'existe pas ou est mal formaté
    const q = query(
      artisansRef,
      where('verified', '==', true)
    );

    const snapshot = await getDocs(q);
    console.log(`📊 ${snapshot.docs.length} artisan(s) vérifié(s) au total`);
    
    if (snapshot.empty) {
      console.log('❌ Aucun artisan vérifié dans la base de données');
      return [];
    }
    
    // Filtrer manuellement par catégorie
    const artisansWithMetier = snapshot.docs.filter(doc => {
      const data = doc.data();
      const metiers = data.metiers as string[] | undefined;
      console.log(`🔍 ${data.raisonSociale || 'Artisan'}: métiers =`, metiers);
      return metiers && Array.isArray(metiers) && metiers.includes(criteria.categorie);
    });
    
    console.log(`📊 ${artisansWithMetier.length} artisan(s) trouvé(s) pour la catégorie "${criteria.categorie}"`);
    
    if (artisansWithMetier.length === 0) {
      console.log(`⚠️ Aucun artisan trouvé pour la catégorie "${criteria.categorie}". Catégories disponibles:`, 
        snapshot.docs.map(doc => doc.data().metiers).filter(Boolean));
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
        dateDebut: criteria.dates[0] || '',
        dates: criteria.dates.map(d => Timestamp.fromDate(new Date(d))),
        flexible: criteria.flexible,
        flexibiliteDays: criteria.flexibiliteDays,
        urgence: criteria.urgence as any,
      },
      urgence: criteria.urgence,
    };

    // 3. Calculer le score pour chaque artisan
    const results: MatchingResult[] = [];

    for (const doc of artisansWithMetier) {
      const artisan = { id: doc.id, userId: doc.id, ...doc.data() } as Artisan;

      console.log(`\n🔍 Analyse artisan: ${artisan.raisonSociale}`);
      console.log(`  - Métiers:`, artisan.metiers);
      console.log(`  - Zones:`, artisan.zonesIntervention);
      console.log(`  - Disponibilités:`, artisan.disponibilites?.length || 0, 'créneau(x)');
      console.log(`  - Verified:`, artisan.verified);

      // Filtre: doit être dans la zone
      if (!isInZone(artisan, tempDemande as Demande)) {
        console.log(`❌ ${artisan.raisonSociale}: HORS ZONE`);
        continue;
      }
      console.log(`✅ ${artisan.raisonSociale}: dans la zone`);

      if (criteria.rayonMax && criteria.rayonMax > 0) {
        const minDistance = getMinDistanceToClient(artisan, tempDemande as Demande);
        if (minDistance !== null && minDistance > criteria.rayonMax) {
          console.log(`❌ ${artisan.raisonSociale}: hors rayon client (${minDistance.toFixed(2)}km > ${criteria.rayonMax}km)`);
          continue;
        }
      }

      // Calcul des scores
      const metierScore = 100; // Match catégorie garanti par la query
      const distanceScore = calculateDistanceScore(artisan, tempDemande as Demande);
      const disponibiliteScore = calculateDisponibiliteScore(artisan, tempDemande as Demande);
      const notationScore = calculateNotationScore(artisan);
      
      console.log(`📊 Scores détaillés:`);
      console.log(`   - Métier: ${metierScore}/100`);
      console.log(`   - Distance: ${distanceScore}/50`);
      console.log(`   - Disponibilité: ${disponibiliteScore}/50`);
      console.log(`   - Notation: ${notationScore}/50`);
      
      // ✅ CHANGEMENT: Accepter même avec disponibiliteScore=0 (artisan peut être contacté)
      // Si score dispo = 0, on affiche quand même l'artisan avec un score réduit
      
      // Bonus urgence: si artisan a capacité disponible immédiatement
      let urgenceScore = 0;
      if (criteria.urgence === 'urgent') {
        // Vérifier si dispo dans les 3 prochains jours
        const today = new Date();
        for (let i = 0; i < 3; i++) {
          const checkDate = new Date(today);
          checkDate.setDate(checkDate.getDate() + i);
          if (isArtisanDisponibleDate(artisan, checkDate)) {
            urgenceScore = 20;
            break;
          }
        }
      } else if (criteria.urgence === 'normale') {
        urgenceScore = 10; // Score neutre
      } else {
        urgenceScore = 5;
      }

      // Score total (max 270 points)
      const scoreTotal = 
        metierScore + 
        distanceScore + 
        disponibiliteScore + 
        notationScore + 
        urgenceScore;

      console.log(`✅ ${artisan.raisonSociale}: score=${scoreTotal} (distance=${distanceScore}, dispo=${disponibiliteScore}, note=${notationScore})`);

      const details = {
        metierMatch: metierScore,
        distanceScore,
        disponibiliteScore,
        notationScore,
        urgenceMatch: urgenceScore,
      };

      results.push({
        artisanId: artisan.userId,
        artisan,
        score: scoreTotal,
        breakdown: details,
        details, // Alias pour compatibilité avec l'interface existante
      });
    }

    // 4. Trier par score décroissant et retourner top 10
    results.sort((a, b) => b.score - a.score);
    console.log(`🎯 ${results.length} artisan(s) matchés (après filtres)`);
    
    return results.slice(0, 10);

  } catch (error) {
    console.error('❌ Erreur matching artisans:', error);
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
    where('verified', '==', true),
    where('statut', '==', 'actif'),
    where('metiers', 'array-contains', categorie)
  );

  const snapshot = await getDocs(q);
  const disponibles: Artisan[] = [];

  for (const doc of snapshot.docs) {
    const artisan = { id: doc.id, userId: doc.id, ...doc.data() } as Artisan;
    
    // Vérifier zone
    const inZone = artisan.zonesIntervention?.some(
      (zone) => zone.ville.toLowerCase() === ville.toLowerCase()
    );
    if (!inZone) continue;

    // Vérifier disponibilité
    const dispo = isArtisanDisponibleDate(artisan, date);
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
    if (zone.latitude && zone.longitude) { // Corrigé: utiliser zone.latitude/longitude
      const distance = calculateDistance(
        zone.latitude,
        zone.longitude,
        lat,
        lon
      );
      minDistance = Math.min(minDistance, distance);
    }
  }

  return minDistance === Infinity ? null : Math.round(minDistance * 10) / 10;
}
