/**
 * Service de gestion des statistiques artisan
 * Utilisé pour le scoring de réactivité dans le matching
 * 
 * Collection Firestore: artisan_stats/{artisanId}
 */

import { 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  increment,
  serverTimestamp,
  Timestamp,
  runTransaction,
} from 'firebase/firestore';
import { db } from './config';
import type { ArtisanStats } from '@/types/firestore';

const COLLECTION_NAME = 'artisan_stats';
const MAX_HISTORIQUE_REPONSES = 20; // Garder les 20 derniers délais pour moyenne glissante

// ============================================
// INITIALISATION
// ============================================

/**
 * Initialise les statistiques d'un nouvel artisan
 */
export async function initializeArtisanStats(artisanId: string): Promise<void> {
  const statsRef = doc(db, COLLECTION_NAME, artisanId);
  
  const initialStats: ArtisanStats = {
    artisanId,
    
    // Taux de réponse
    demandesRecues: 0,
    devisEnvoyes: 0,
    tauxReponseDevis: 0,
    
    // Délai de réponse
    delaiMoyenReponseHeures: 0,
    dernieresReponses: [],
    reponseRapide24h: 0,
    
    // Taux d'acceptation
    devisAcceptes: 0,
    devisRefuses: 0,
    tauxAcceptation: 0,
    
    // Fiabilité
    missionsTerminees: 0,
    missionsAnnulees: 0,
    tauxCompletion: 0,
    
    // Qualité
    noteGlobale: 0,
    nombreAvis: 0,
    
    // Litiges
    nombreLitiges: 0,
    litigesResolus: 0,
    
    // Historique
    premiereActivite: Timestamp.now(),
    derniereMiseAJour: Timestamp.now(),
  };

  await setDoc(statsRef, initialStats);
  console.log(`✅ Stats initialisées pour artisan ${artisanId}`);
}

/**
 * Récupère les stats d'un artisan (ou les initialise si inexistantes)
 */
export async function getArtisanStats(artisanId: string): Promise<ArtisanStats> {
  const statsRef = doc(db, COLLECTION_NAME, artisanId);
  const statsSnap = await getDoc(statsRef);

  if (!statsSnap.exists()) {
    console.log(`⚠️ Stats inexistantes pour ${artisanId}, initialisation...`);
    await initializeArtisanStats(artisanId);
    const newSnap = await getDoc(statsRef);
    return { id: newSnap.id, ...newSnap.data() } as unknown as ArtisanStats;
  }

  return { id: statsSnap.id, ...statsSnap.data() } as unknown as ArtisanStats;
}

// ============================================
// TRACKING DES ÉVÉNEMENTS
// ============================================

/**
 * Incrémente le compteur de demandes reçues
 * Appelé quand un artisan est matché avec une nouvelle demande
 */
export async function trackDemandeRecue(artisanId: string, demandeId: string): Promise<void> {
  const statsRef = doc(db, COLLECTION_NAME, artisanId);
  
  try {
    // Vérifier si stats existent
    const statsSnap = await getDoc(statsRef);
    if (!statsSnap.exists()) {
      await initializeArtisanStats(artisanId);
    }

    await updateDoc(statsRef, {
      demandesRecues: increment(1),
      derniereActivite: serverTimestamp(),
      derniereMiseAJour: serverTimestamp(),
    });

    console.log(`📊 Demande reçue trackée pour artisan ${artisanId}`);
  } catch (error) {
    console.error('❌ Erreur trackDemandeRecue:', error);
  }
}

/**
 * Track l'envoi d'un devis et calcule le délai de réponse
 * @param artisanId ID de l'artisan
 * @param demandeCreatedAt Date de création de la demande (Timestamp)
 * @param devisCreatedAt Date de création du devis (Timestamp)
 */
export async function trackDevisEnvoye(
  artisanId: string,
  demandeCreatedAt: Timestamp,
  devisCreatedAt: Timestamp
): Promise<void> {
  const statsRef = doc(db, COLLECTION_NAME, artisanId);

  try {
    await runTransaction(db, async (transaction) => {
      const statsDoc = await transaction.get(statsRef);
      
      if (!statsDoc.exists()) {
        throw new Error('Stats non initialisées');
      }

      const stats = statsDoc.data() as ArtisanStats;

      // Calculer délai de réponse en heures
      const delaiMs = devisCreatedAt.toMillis() - demandeCreatedAt.toMillis();
      const delaiHeures = delaiMs / (1000 * 60 * 60);

      // Mettre à jour historique des réponses (garder 20 dernières)
      const nouvellesReponses = [...stats.dernieresReponses, delaiHeures];
      if (nouvellesReponses.length > MAX_HISTORIQUE_REPONSES) {
        nouvellesReponses.shift(); // Supprimer la plus ancienne
      }

      // Calculer nouveau délai moyen
      const sommeDelais = nouvellesReponses.reduce((sum, d) => sum + d, 0);
      const nouveauDelaiMoyen = sommeDelais / nouvellesReponses.length;

      // Compter réponses rapides
      const nouveauReponseRapide24h = delaiHeures < 24 
        ? stats.reponseRapide24h + 1 
        : stats.reponseRapide24h;

      // Nouveau nombre de devis envoyés
      const nouveauDevisEnvoyes = stats.devisEnvoyes + 1;

      // Recalculer taux de réponse
      const nouveauTauxReponse = stats.demandesRecues > 0
        ? (nouveauDevisEnvoyes / stats.demandesRecues) * 100
        : 0;

      transaction.update(statsRef, {
        devisEnvoyes: nouveauDevisEnvoyes,
        tauxReponseDevis: nouveauTauxReponse,
        delaiMoyenReponseHeures: nouveauDelaiMoyen,
        dernieresReponses: nouvellesReponses,
        reponseRapide24h: nouveauReponseRapide24h,
        derniereActivite: serverTimestamp(),
        derniereMiseAJour: serverTimestamp(),
      });
    });

    console.log(`📊 Devis envoyé tracké pour artisan ${artisanId}`);
  } catch (error) {
    console.error('❌ Erreur trackDevisEnvoye:', error);
  }
}

/**
 * Track l'acceptation d'un devis par un client
 */
export async function trackDevisAccepte(artisanId: string): Promise<void> {
  const statsRef = doc(db, COLLECTION_NAME, artisanId);

  try {
    await runTransaction(db, async (transaction) => {
      const statsDoc = await transaction.get(statsRef);
      
      if (!statsDoc.exists()) {
        throw new Error('Stats non initialisées');
      }

      const stats = statsDoc.data() as ArtisanStats;
      const nouveauDevisAcceptes = stats.devisAcceptes + 1;
      
      // Recalculer taux d'acceptation
      const nouveauTauxAcceptation = stats.devisEnvoyes > 0
        ? (nouveauDevisAcceptes / stats.devisEnvoyes) * 100
        : 0;

      transaction.update(statsRef, {
        devisAcceptes: nouveauDevisAcceptes,
        tauxAcceptation: nouveauTauxAcceptation,
        derniereActivite: serverTimestamp(),
        derniereMiseAJour: serverTimestamp(),
      });
    });

    console.log(`📊 Devis accepté tracké pour artisan ${artisanId}`);
  } catch (error) {
    console.error('❌ Erreur trackDevisAccepte:', error);
  }
}

/**
 * Track le refus d'un devis par un client
 */
export async function trackDevisRefuse(artisanId: string): Promise<void> {
  const statsRef = doc(db, COLLECTION_NAME, artisanId);

  try {
    await runTransaction(db, async (transaction) => {
      const statsDoc = await transaction.get(statsRef);
      
      if (!statsDoc.exists()) {
        throw new Error('Stats non initialisées');
      }

      const stats = statsDoc.data() as ArtisanStats;
      const nouveauDevisRefuses = stats.devisRefuses + 1;
      
      // Recalculer taux d'acceptation
      const nouveauTauxAcceptation = stats.devisEnvoyes > 0
        ? (stats.devisAcceptes / stats.devisEnvoyes) * 100
        : 0;

      transaction.update(statsRef, {
        devisRefuses: nouveauDevisRefuses,
        tauxAcceptation: nouveauTauxAcceptation,
        derniereMiseAJour: serverTimestamp(),
      });
    });

    console.log(`📊 Devis refusé tracké pour artisan ${artisanId}`);
  } catch (error) {
    console.error('❌ Erreur trackDevisRefuse:', error);
  }
}

/**
 * Track la fin d'une mission (contrat terminé)
 */
export async function trackMissionTerminee(artisanId: string): Promise<void> {
  const statsRef = doc(db, COLLECTION_NAME, artisanId);

  try {
    await runTransaction(db, async (transaction) => {
      const statsDoc = await transaction.get(statsRef);
      
      if (!statsDoc.exists()) {
        throw new Error('Stats non initialisées');
      }

      const stats = statsDoc.data() as ArtisanStats;
      const nouveauMissionsTerminees = stats.missionsTerminees + 1;
      const totalMissions = nouveauMissionsTerminees + stats.missionsAnnulees;
      
      // Recalculer taux de complétion
      const nouveauTauxCompletion = totalMissions > 0
        ? (nouveauMissionsTerminees / totalMissions) * 100
        : 0;

      transaction.update(statsRef, {
        missionsTerminees: nouveauMissionsTerminees,
        tauxCompletion: nouveauTauxCompletion,
        derniereActivite: serverTimestamp(),
        derniereMiseAJour: serverTimestamp(),
      });
    });

    console.log(`📊 Mission terminée trackée pour artisan ${artisanId}`);
  } catch (error) {
    console.error('❌ Erreur trackMissionTerminee:', error);
  }
}

/**
 * Track l'annulation d'une mission
 */
export async function trackMissionAnnulee(artisanId: string): Promise<void> {
  const statsRef = doc(db, COLLECTION_NAME, artisanId);

  try {
    await runTransaction(db, async (transaction) => {
      const statsDoc = await transaction.get(statsRef);
      
      if (!statsDoc.exists()) {
        throw new Error('Stats non initialisées');
      }

      const stats = statsDoc.data() as ArtisanStats;
      const nouveauMissionsAnnulees = stats.missionsAnnulees + 1;
      const totalMissions = stats.missionsTerminees + nouveauMissionsAnnulees;
      
      // Recalculer taux de complétion
      const nouveauTauxCompletion = totalMissions > 0
        ? (stats.missionsTerminees / totalMissions) * 100
        : 0;

      transaction.update(statsRef, {
        missionsAnnulees: nouveauMissionsAnnulees,
        tauxCompletion: nouveauTauxCompletion,
        derniereMiseAJour: serverTimestamp(),
      });
    });

    console.log(`📊 Mission annulée trackée pour artisan ${artisanId}`);
  } catch (error) {
    console.error('❌ Erreur trackMissionAnnulee:', error);
  }
}

/**
 * Met à jour la note globale après un nouvel avis
 */
export async function updateNoteGlobale(
  artisanId: string,
  nouvelleNote: number
): Promise<void> {
  const statsRef = doc(db, COLLECTION_NAME, artisanId);

  try {
    await runTransaction(db, async (transaction) => {
      const statsDoc = await transaction.get(statsRef);
      
      if (!statsDoc.exists()) {
        throw new Error('Stats non initialisées');
      }

      const stats = statsDoc.data() as ArtisanStats;
      
      // Calculer nouvelle moyenne
      const totalNotes = stats.noteGlobale * stats.nombreAvis;
      const nouveauNombreAvis = stats.nombreAvis + 1;
      const nouvelleNoteMoyenne = (totalNotes + nouvelleNote) / nouveauNombreAvis;

      transaction.update(statsRef, {
        noteGlobale: nouvelleNoteMoyenne,
        nombreAvis: nouveauNombreAvis,
        dernierAvisDate: serverTimestamp(),
        derniereMiseAJour: serverTimestamp(),
      });
    });

    console.log(`📊 Note globale mise à jour pour artisan ${artisanId}`);
  } catch (error) {
    console.error('❌ Erreur updateNoteGlobale:', error);
  }
}

// ============================================
// CALCUL DE SCORES
// ============================================

/**
 * Calcule le score de réactivité d'un artisan (0-80 points)
 * Utilisé dans le moteur de matching
 * 
 * @param stats Statistiques de l'artisan
 * @returns Score de 0 à 80
 */
export function calculateScoreReactivite(stats: ArtisanStats): number {
  let scoreTotal = 0;

  // === 1. TAUX DE RÉPONSE (0-40 points) ===
  const tauxReponse = stats.tauxReponseDevis;
  let scoreTauxReponse = 0;
  
  if (tauxReponse >= 90) scoreTauxReponse = 40;
  else if (tauxReponse >= 70) scoreTauxReponse = 30;
  else if (tauxReponse >= 50) scoreTauxReponse = 20;
  else if (tauxReponse >= 30) scoreTauxReponse = 10;
  else scoreTauxReponse = 0;

  // === 2. DÉLAI DE RÉPONSE (0-40 points) ===
  const delaiMoyen = stats.delaiMoyenReponseHeures;
  let scoreDelai = 0;
  
  if (delaiMoyen < 2) scoreDelai = 40;
  else if (delaiMoyen < 6) scoreDelai = 30;
  else if (delaiMoyen < 24) scoreDelai = 20;
  else if (delaiMoyen < 48) scoreDelai = 10;
  else scoreDelai = 0;

  scoreTotal = scoreTauxReponse + scoreDelai;

  console.log(`📊 Score réactivité artisan ${stats.artisanId}:`);
  console.log(`   - Taux réponse: ${tauxReponse.toFixed(1)}% → ${scoreTauxReponse}/40 pts`);
  console.log(`   - Délai moyen: ${delaiMoyen.toFixed(1)}h → ${scoreDelai}/40 pts`);
  console.log(`   - TOTAL: ${scoreTotal}/80 pts`);

  return scoreTotal;
}

/**
 * Calcule un score de qualité global (0-100)
 * Combine plusieurs métriques
 */
export function calculateScoreQualite(stats: ArtisanStats): number {
  const poidsTauxReponse = 0.25;
  const poidsDelai = 0.20;
  const poidsTauxAcceptation = 0.20;
  const poidsTauxCompletion = 0.20;
  const poidsNoteGlobale = 0.15;

  const scoreTauxReponse = stats.tauxReponseDevis;
  const scoreDelai = Math.max(0, 100 - (stats.delaiMoyenReponseHeures / 48) * 100);
  const scoreTauxAcceptation = stats.tauxAcceptation;
  const scoreTauxCompletion = stats.tauxCompletion;
  const scoreNote = (stats.noteGlobale / 5) * 100;

  const scoreTotal = Math.round(
    scoreTauxReponse * poidsTauxReponse +
    scoreDelai * poidsDelai +
    scoreTauxAcceptation * poidsTauxAcceptation +
    scoreTauxCompletion * poidsTauxCompletion +
    scoreNote * poidsNoteGlobale
  );

  return Math.min(100, scoreTotal);
}
